import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RESERVAS_QUEUE } from '../../queue/queue.module';
import { ReservasService, JOB_LIBERAR_RESERVA } from './reservas.service';

/**
 * Worker que procesa los trabajos de la cola "reservas".
 * Fase 1 solo tiene un tipo de trabajo: liberar-reserva-pendiente.
 * Fases posteriores agregan mas tipos de trabajo a esta misma cola o a
 * colas nuevas (recordatorio-24h, cobro-mensualidad-academia, etc).
 */
@Processor(RESERVAS_QUEUE)
export class ReservasProcessor extends WorkerHost {
  private readonly logger = new Logger(ReservasProcessor.name);

  constructor(private readonly reservasService: ReservasService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case JOB_LIBERAR_RESERVA:
        await this.reservasService.liberarPorTimeout(job.data.reservaId);
        break;
      default:
        this.logger.warn(`Tipo de trabajo desconocido: ${job.name}`);
    }
  }
}
