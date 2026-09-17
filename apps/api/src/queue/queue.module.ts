import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const RESERVAS_QUEUE = 'reservas';
export const ACADEMIA_QUEUE = 'academia';

/**
 * Configuracion central de BullMQ. Cada modulo que necesite encolar
 * trabajos (reservas, academia...) importa este modulo y registra su propia
 * cola con BullModule.registerQueue({ name: '...' }).
 *
 * Fase 1 usa la cola "reservas" (liberar-reserva-pendiente). La Fase 4 agrega
 * la cola "academia" (cobro de mensualidades + avisos de mora).
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 500,
          removeOnFail: 1000,
        },
      }),
    }),
    BullModule.registerQueue({ name: RESERVAS_QUEUE }),
    BullModule.registerQueue({ name: ACADEMIA_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
