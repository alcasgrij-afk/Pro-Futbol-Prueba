import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SuperadminService } from './superadmin.service';

const INTERVALO_MS = 30_000;
const MAX_PUNTOS = 240; // ~2h a 30s por punto

type SnapshotBase = Awaited<ReturnType<SuperadminService['snapshotLigero']>>;

export type PuntoHistorial = SnapshotBase & {
  /** Tasa de la ultima ventana (vs. el acumulado desde el arranque de Redis), null sin punto anterior comparable. */
  redisComandosPorSegundo: number | null;
  redisTasaAciertoVentanaPct: number | null;
};

export interface EstadoDesde {
  estado: string;
  desde: number;
}

/**
 * Buffer de tendencia en memoria, propio del proceso API: se llena solo
 * (no depende de que alguien tenga el dashboard abierto) y se comparte
 * entre todos los que vean /superadmin. Se reinicia en cada redeploy; no
 * hay tabla nueva porque el usuario pidio explicitamente no persistirlo.
 */
@Injectable()
export class SuperadminHistorialService implements OnModuleInit, OnModuleDestroy {
  private readonly puntos: PuntoHistorial[] = [];
  private readonly estadoDesde: Record<string, EstadoDesde> = {};
  private intervalo?: NodeJS.Timeout;

  constructor(private readonly superadminService: SuperadminService) {}

  onModuleInit() {
    this.capturar();
    this.intervalo = setInterval(() => this.capturar(), INTERVALO_MS);
  }

  onModuleDestroy() {
    clearInterval(this.intervalo);
  }

  obtenerHistorial(): PuntoHistorial[] {
    return this.puntos;
  }

  /** Desde cuando cada check esta en su estado actual (para "OK desde hace Xh" en la UI). */
  obtenerEstadoDesde(): Record<string, EstadoDesde> {
    return this.estadoDesde;
  }

  private async capturar() {
    const base = await this.superadminService.snapshotLigero().catch(() => null);
    if (!base) return;
    const anterior = this.puntos[this.puntos.length - 1];
    const punto: PuntoHistorial = { ...base, ...this.calcularTasasRedis(base, anterior) };
    this.puntos.push(punto);
    if (this.puntos.length > MAX_PUNTOS) this.puntos.shift();

    this.registrarEstado('database', punto.dbEstado);
    this.registrarEstado('redis', punto.redisEstado);
    this.registrarEstado('colas', punto.colasEstado);
    this.registrarEstado('pagos', punto.pagosEstado);
  }

  private calcularTasasRedis(
    actual: SnapshotBase,
    anterior: PuntoHistorial | undefined,
  ): Pick<PuntoHistorial, 'redisComandosPorSegundo' | 'redisTasaAciertoVentanaPct'> {
    const vacio = { redisComandosPorSegundo: null, redisTasaAciertoVentanaPct: null };
    if (!anterior || actual.redisComandosProcesados == null || anterior.redisComandosProcesados == null) return vacio;

    const segundos = (actual.t - anterior.t) / 1000;
    const deltaComandos = actual.redisComandosProcesados - anterior.redisComandosProcesados;
    // Delta negativo = Redis se reinicio entre snapshots (contador volvio a 0); no hay tasa valida.
    if (segundos <= 0 || deltaComandos < 0) return vacio;

    let redisTasaAciertoVentanaPct: number | null = null;
    if (actual.redisHits != null && actual.redisMisses != null && anterior.redisHits != null && anterior.redisMisses != null) {
      const deltaTotal = actual.redisHits - anterior.redisHits + (actual.redisMisses - anterior.redisMisses);
      redisTasaAciertoVentanaPct =
        deltaTotal > 0 ? Math.round(((actual.redisHits - anterior.redisHits) / deltaTotal) * 1000) / 10 : null;
    }

    return {
      redisComandosPorSegundo: Math.round((deltaComandos / segundos) * 10) / 10,
      redisTasaAciertoVentanaPct,
    };
  }

  private registrarEstado(clave: string, estado: string) {
    const actual = this.estadoDesde[clave];
    if (!actual || actual.estado !== estado) {
      this.estadoDesde[clave] = { estado, desde: Date.now() };
    }
  }
}
