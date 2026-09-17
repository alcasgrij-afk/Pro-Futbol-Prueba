import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ACADEMIA_QUEUE } from '../../queue/queue.module';
import { MensualidadesService } from './mensualidades.service';
import { AcademiaNotificacionesScanner } from './academia-notificaciones.scanner';

export const JOB_GENERAR_MENSUALIDADES = 'cobro-mensualidad-academia';
export const JOB_AVISO_MENSUALIDAD_VENCIDA = 'aviso-mensualidad-vencida';

@Processor(ACADEMIA_QUEUE)
export class MensualidadesProcessor extends WorkerHost {
  private readonly logger = new Logger(MensualidadesProcessor.name);

  constructor(
    private readonly mensualidadesService: MensualidadesService,
    private readonly scanner: AcademiaNotificacionesScanner,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case JOB_GENERAR_MENSUALIDADES:
        await this.mensualidadesService.generarParaMesActual();
        break;
      case JOB_AVISO_MENSUALIDAD_VENCIDA:
        await this.scanner.escanearMensualidadesVencidas();
        break;
      default:
        this.logger.warn(`Tipo de trabajo desconocido: ${job.name}`);
    }
  }
}
