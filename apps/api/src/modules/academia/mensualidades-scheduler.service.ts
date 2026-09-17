import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ACADEMIA_QUEUE } from '../../queue/queue.module';
import { JOB_AVISO_MENSUALIDAD_VENCIDA, JOB_GENERAR_MENSUALIDADES } from './mensualidades.processor';

/**
 * Registra los trabajos recurrentes de la academia al arrancar la aplicacion.
 * Igual que el scheduler de reservas (Fase 1), BullMQ deduplica trabajos
 * repetibles por nombre+patron, asi que reiniciar la API no crea duplicados.
 */
@Injectable()
export class MensualidadesSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(MensualidadesSchedulerService.name);

  constructor(@InjectQueue(ACADEMIA_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    // Dia 1 de cada mes a las 06:00 (zona horaria del proceso, ver TZ en .env).
    await this.queue.add(
      JOB_GENERAR_MENSUALIDADES,
      {},
      { repeat: { pattern: '0 6 1 * *' }, jobId: JOB_GENERAR_MENSUALIDADES },
    );

    // Todos los dias a las 09:00: avisa a los encargados con mensualidades vencidas.
    await this.queue.add(
      JOB_AVISO_MENSUALIDAD_VENCIDA,
      {},
      { repeat: { pattern: '0 9 * * *' }, jobId: JOB_AVISO_MENSUALIDAD_VENCIDA },
    );

    this.logger.log(
      'Trabajos recurrentes de academia registrados (cobro mensual dia 1, avisos de mora diarios).',
    );
  }
}
