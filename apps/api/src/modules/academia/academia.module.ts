import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PagosModule } from '../pagos/pagos.module';
import { QueueModule } from '../../queue/queue.module';
import { AcademiaController } from './academia.controller';
import { AsistenciaController } from './asistencia.controller';
import { AlumnosService } from './alumnos.service';
import { MensualidadesService } from './mensualidades.service';
import { AsistenciaService } from './asistencia.service';
import { AcademiaNotificacionesScanner } from './academia-notificaciones.scanner';
import { MensualidadesProcessor } from './mensualidades.processor';
import { MensualidadesSchedulerService } from './mensualidades-scheduler.service';

@Module({
  imports: [ConfigModule, PagosModule, QueueModule],
  controllers: [AcademiaController, AsistenciaController],
  providers: [
    AlumnosService,
    MensualidadesService,
    AsistenciaService,
    AcademiaNotificacionesScanner,
    MensualidadesProcessor,
    MensualidadesSchedulerService,
  ],
  exports: [MensualidadesService, AlumnosService],
})
export class AcademiaModule {}
