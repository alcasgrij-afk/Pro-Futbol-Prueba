import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ACADEMIA_QUEUE, RESERVAS_QUEUE } from '../../queue/queue.module';

type Estado = 'ok' | 'warn' | 'critical';

const UMBRAL_CONEXIONES_WARN = 0.8; // 80% del max_connections
const MINUTOS_PAGO_ESTANCADO = 15;
const TIMEOUT_CHEQUEO_MS = 5000;

export interface ConsultaBloqueada {
  pid: number;
  query: string;
  bloqueadaPorPids: number[];
}

export interface ConexionActiva {
  pid: number;
  state: string | null;
  query: string;
  applicationName: string | null;
  duracionSegundos: number;
}

export interface JobFallido {
  id: string;
  name: string;
  failedReason: string | null;
  attemptsMade: number;
}

export interface PagoEstancado {
  id: string;
  montoQ: number;
  tipoReferencia: string;
  referenciaId: string;
  creadoEn: Date;
}

/**
 * Lecturas de solo-lectura sobre lo que ya corre en el stack (Postgres,
 * Redis, colas BullMQ, proceso API, tabla Pago). No agrega tablas ni
 * extensiones nuevas: pg_locks/pg_stat_activity son vistas del core de
 * Postgres, disponibles aunque pg_stat_statements no este habilitado.
 */
@Injectable()
export class SuperadminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @InjectQueue(RESERVAS_QUEUE) private readonly reservasQueue: Queue,
    @InjectQueue(ACADEMIA_QUEUE) private readonly academiaQueue: Queue,
  ) {}

  async overview() {
    const [database, redis, colas, pagos] = await Promise.all([
      this.chequearBaseDeDatos(),
      this.chequearRedis(),
      this.chequearColas(),
      this.chequearPagos(),
    ]);

    return {
      generadoEn: new Date().toISOString(),
      database,
      redis,
      colas,
      api: this.chequearApi(),
      pagos,
    };
  }

  /** Subconjunto numerico de overview(), para el buffer de tendencia (SuperadminHistorialService). */
  async snapshotLigero() {
    const [database, redis, colas, pagos] = await Promise.all([
      this.chequearBaseDeDatos(),
      this.chequearRedis(),
      this.chequearColas(),
      this.chequearPagos(),
    ]);

    return {
      t: Date.now(),
      dbConexiones: database.conexiones?.usadas ?? null,
      dbEstado: database.estado,
      redisLatenciaMs: redis.latenciaMs,
      redisEstado: redis.estado,
      colasFallidos: colas.reservas.fallidos.length + colas.academia.fallidos.length,
      colasEstado: colas.reservas.estado === 'warn' || colas.academia.estado === 'warn' ? 'warn' : 'ok',
      pagosEstancados: pagos.pendientesEstancados,
      pagosEstado: pagos.estado,
    };
  }

  private async chequearBaseDeDatos() {
    try {
      const [maxConexionesRow] = await this.prisma.$queryRawUnsafe<{ setting: string }[]>(
        `SELECT setting FROM pg_settings WHERE name = 'max_connections'`,
      );
      const [{ count: conexionesUsadas }] = await this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT count(*)::bigint AS count FROM pg_stat_activity WHERE datname = current_database()`,
      );
      const bloqueadas = await this.prisma.$queryRawUnsafe<ConsultaBloqueada[]>(
        `SELECT pid, query, pg_blocking_pids(pid) AS "bloqueadaPorPids"
         FROM pg_stat_activity
         WHERE cardinality(pg_blocking_pids(pid)) > 0`,
      );
      const [consultaMasLenta] = await this.prisma.$queryRawUnsafe<
        { pid: number; query: string; duracionSegundos: number }[]
      >(
        `SELECT pid, query, EXTRACT(EPOCH FROM (now() - query_start))::int AS "duracionSegundos"
         FROM pg_stat_activity
         WHERE state = 'active' AND pid != pg_backend_pid() AND query_start IS NOT NULL
         ORDER BY query_start ASC
         LIMIT 1`,
      );
      const conexionesActivas = await this.prisma.$queryRawUnsafe<ConexionActiva[]>(
        `SELECT pid, state, query, application_name AS "applicationName",
           EXTRACT(EPOCH FROM (now() - COALESCE(query_start, state_change)))::int AS "duracionSegundos"
         FROM pg_stat_activity
         WHERE datname = current_database() AND pid != pg_backend_pid()
         ORDER BY query_start ASC NULLS LAST`,
      );

      const max = Number(maxConexionesRow.setting);
      const usadas = Number(conexionesUsadas);
      const ratio = max > 0 ? usadas / max : 0;

      const idleCount = conexionesActivas.filter((c) => c.state === 'idle').length;
      const otras = conexionesActivas.filter((c) => c.state !== 'idle').slice(0, 20);

      let estado: Estado = 'ok';
      if (bloqueadas.length > 0) estado = 'critical';
      else if (ratio >= UMBRAL_CONEXIONES_WARN) estado = 'warn';

      return {
        estado,
        conexiones: { usadas, max },
        bloqueadas,
        consultaMasLenta: consultaMasLenta ?? null,
        conexionesDetalle: { idleCount, otras },
      };
    } catch {
      return {
        estado: 'critical' as Estado,
        conexiones: null,
        bloqueadas: [],
        consultaMasLenta: null,
        conexionesDetalle: { idleCount: 0, otras: [] },
      };
    }
  }

  private async chequearRedis() {
    const inicio = Date.now();
    try {
      await this.conTimeout(this.redis.client.ping());
      const latenciaMs = Date.now() - inicio;
      const info = await this.conTimeout(this.redis.client.info());
      const memoriaUsadaMb = this.extraerInfoNumerico(info, 'used_memory') / (1024 * 1024);
      const memoriaPicoMb = this.extraerInfoNumerico(info, 'used_memory_peak') / (1024 * 1024);
      const clientesConectados = this.extraerInfoNumerico(info, 'connected_clients');
      const uptimeSegundos = this.extraerInfoNumerico(info, 'uptime_in_seconds');
      const clavesEvictadas = this.extraerInfoNumerico(info, 'evicted_keys');
      const comandosProcesados = this.extraerInfoNumerico(info, 'total_commands_processed');
      const hits = this.extraerInfoNumerico(info, 'keyspace_hits');
      const misses = this.extraerInfoNumerico(info, 'keyspace_misses');
      const tasaAciertoPct = hits + misses > 0 ? Math.round((hits / (hits + misses)) * 1000) / 10 : null;

      return {
        estado: (latenciaMs > 200 ? 'warn' : 'ok') as Estado,
        latenciaMs,
        memoriaUsadaMb: Math.round(memoriaUsadaMb * 10) / 10,
        clientesConectados,
        uptimeSegundos,
        memoriaPicoMb: Math.round(memoriaPicoMb * 10) / 10,
        tasaAciertoPct,
        clavesEvictadas,
        comandosProcesados,
      };
    } catch {
      return {
        estado: 'critical' as Estado,
        latenciaMs: null,
        memoriaUsadaMb: null,
        clientesConectados: null,
        uptimeSegundos: null,
        memoriaPicoMb: null,
        tasaAciertoPct: null,
        clavesEvictadas: null,
        comandosProcesados: null,
      };
    }
  }

  private extraerInfoNumerico(info: string, clave: string): number {
    const match = info.match(new RegExp(`^${clave}:(\\d+)`, 'm'));
    return match ? Number(match[1]) : 0;
  }

  private async chequearColas() {
    const vacio: Record<string, number> = { waiting: 0, active: 0, failed: 0, delayed: 0 };
    const estadoDe = (counts: Record<string, number>): Estado => (counts.failed > 0 ? 'warn' : 'ok');

    const [reservas, academia, fallidosReservas, fallidosAcademia] = await Promise.all([
      this.conTimeout(this.reservasQueue.getJobCounts('waiting', 'active', 'failed', 'delayed')).catch(() => null),
      this.conTimeout(this.academiaQueue.getJobCounts('waiting', 'active', 'failed', 'delayed')).catch(() => null),
      this.obtenerJobsFallidos(this.reservasQueue),
      this.obtenerJobsFallidos(this.academiaQueue),
    ]);

    return {
      reservas: reservas
        ? { ...reservas, estado: estadoDe(reservas), fallidos: fallidosReservas }
        : { ...vacio, estado: 'critical' as Estado, fallidos: [] },
      academia: academia
        ? { ...academia, estado: estadoDe(academia), fallidos: fallidosAcademia }
        : { ...vacio, estado: 'critical' as Estado, fallidos: [] },
    };
  }

  private async obtenerJobsFallidos(queue: Queue): Promise<JobFallido[]> {
    const jobs = await this.conTimeout(queue.getJobs(['failed'], 0, 20)).catch(() => []);
    return jobs.map((job) => ({
      id: String(job.id),
      name: job.name,
      failedReason: job.failedReason ?? null,
      attemptsMade: job.attemptsMade,
    }));
  }

  // BullMQ usa maxRetriesPerRequest: null en su conexion (lo exige la libreria
  // para sus comandos bloqueantes), asi que getJobCounts() reintenta sin
  // limite si Redis esta caido. Sin este timeout, una caida de Redis cuelga
  // el endpoint entero en vez de mostrarla como "critical".
  private conTimeout<T>(promesa: Promise<T>): Promise<T> {
    return Promise.race([
      promesa,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_CHEQUEO_MS)),
    ]);
  }

  private chequearApi() {
    return {
      estado: 'ok' as Estado,
      uptimeSegundos: Math.round(process.uptime()),
      memoriaRssMb: Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10,
    };
  }

  private async chequearPagos() {
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const porEstadoRaw = await this.prisma.pago.groupBy({
      by: ['estado'],
      where: { creadoEn: { gte: desde } },
      _count: true,
    });

    const porEstado = { PENDIENTE: 0, COMPLETADO: 0, FALLIDO: 0, CANCELADO: 0 };
    for (const fila of porEstadoRaw) {
      porEstado[fila.estado] = fila._count;
    }

    const limiteEstancado = new Date(Date.now() - MINUTOS_PAGO_ESTANCADO * 60 * 1000);
    const dondeEstancados = { estado: 'PENDIENTE' as const, creadoEn: { lt: limiteEstancado } };
    const [pendientesEstancados, filasEstancadasRaw] = await Promise.all([
      this.prisma.pago.count({ where: dondeEstancados }),
      this.prisma.pago.findMany({
        where: dondeEstancados,
        select: { id: true, montoQ: true, tipoReferencia: true, referenciaId: true, creadoEn: true },
        orderBy: { creadoEn: 'asc' },
        take: 20,
      }),
    ]);
    const filasEstancadas: PagoEstancado[] = filasEstancadasRaw.map((p) => ({ ...p, montoQ: Number(p.montoQ) }));

    let estado: Estado = 'ok';
    if (porEstado.FALLIDO > 0 || pendientesEstancados > 0) estado = 'warn';

    return { estado, ultimas24h: porEstado, pendientesEstancados, estancados: filasEstancadas };
  }
}
