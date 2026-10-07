import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EstadoPago } from '@profutbol/shared-types';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { ACADEMIA_QUEUE, RESERVAS_QUEUE } from '../../queue/queue.module';
import { PagosService } from '../pagos/pagos.service';

const COLAS = ['reservas', 'academia'];

/**
 * Acciones correctivas disparadas desde el panel /superadmin. Separado de
 * SuperadminService (solo lectura) a proposito: todo lo que vive aqui muta
 * estado real, asi que cada metodo deja una linea de log con que se hizo y
 * sobre que — el unico rastro de auditoria posible, dado que el login de
 * /superadmin es una sola contrasena compartida sin identidad por usuario.
 */
@Injectable()
export class SuperadminAccionesService {
  private readonly logger = new Logger(SuperadminAccionesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pagosService: PagosService,
    @InjectQueue(RESERVAS_QUEUE) private readonly reservasQueue: Queue,
    @InjectQueue(ACADEMIA_QUEUE) private readonly academiaQueue: Queue,
  ) {}

  async terminarConsulta(pid: number) {
    const [backend] = await this.prisma.$queryRaw<{ pg_backend_pid: number }[]>`SELECT pg_backend_pid()`;
    if (pid === backend.pg_backend_pid) {
      throw new BadRequestException('No se puede terminar la propia conexion del chequeo.');
    }

    // Reverificar contra el estado actual: nunca confiar en un pid que viene
    // del cliente sin confirmar que SIGUE bloqueando algo ahora mismo.
    const [esBloqueante] = await this.prisma.$queryRaw<{ existe: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_stat_activity b
        WHERE cardinality(pg_blocking_pids(b.pid)) > 0 AND ${pid} = ANY(pg_blocking_pids(b.pid))
      ) AS existe
    `;
    if (!esBloqueante?.existe) {
      throw new BadRequestException('Ese pid ya no esta bloqueando ninguna consulta.');
    }

    await this.prisma.$queryRaw`SELECT pg_terminate_backend(${pid}::integer)`;
    this.logger.warn(`[accion] terminar_consulta pid=${pid}`);
    return { terminado: true, pid };
  }

  async reintentarJob(cola: string, jobId: string) {
    const job = await this.obtenerJob(cola, jobId);
    await job.retry();
    this.logger.warn(`[accion] reintentar_job cola=${cola} jobId=${jobId}`);
    return { reintentado: true, jobId };
  }

  async eliminarJob(cola: string, jobId: string) {
    const job = await this.obtenerJob(cola, jobId);
    await job.remove();
    this.logger.warn(`[accion] eliminar_job cola=${cola} jobId=${jobId}`);
    return { eliminado: true, jobId };
  }

  async marcarPago(id: string, estado: 'COMPLETADO' | 'CANCELADO') {
    const pago = await this.pagosService.marcarManualmente(id, EstadoPago[estado]);
    this.logger.warn(`[accion] marcar_pago id=${id} estado=${estado}`);
    return pago;
  }

  private async obtenerJob(cola: string, jobId: string) {
    if (!COLAS.includes(cola)) throw new BadRequestException(`Cola desconocida: ${cola}`);
    const queue = cola === 'reservas' ? this.reservasQueue : this.academiaQueue;
    const job = await queue.getJob(jobId);
    if (!job) throw new NotFoundException('Job no encontrado.');
    return job;
  }
}
