import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RESERVAS_QUEUE } from '../../queue/queue.module';
import { JOB_MATERIALIZAR_RECURRENTES } from './reservas.service';

/**
 * Registra el trabajo recurrente que materializa las reglas de
 * ReservaRecurrente (Especial/Academia) como filas Reserva reales. Mismo
 * patron que MensualidadesSchedulerService: BullMQ deduplica por jobId, asi
 * que reiniciar la API no crea duplicados.
 */
@Injectable()
export class ReservasSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(ReservasSchedulerService.name);

  constructor(@InjectQueue(RESERVAS_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    // Todos los dias a las 03:00.
    await this.queue.add(
      JOB_MATERIALIZAR_RECURRENTES,
      {},
      { repeat: { pattern: '0 3 * * *' }, jobId: JOB_MATERIALIZAR_RECURRENTES },
    );
    this.logger.log('Trabajo recurrente de materializacion de reservas registrado (diario 03:00).');
  }
}
