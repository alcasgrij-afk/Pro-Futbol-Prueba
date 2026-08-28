import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const RESERVAS_QUEUE = 'reservas';

/**
 * Configuracion central de BullMQ. Cada modulo que necesite encolar
 * trabajos (reservas, notificaciones, academia...) importa este modulo y
 * registra su propia cola con BullModule.registerQueue({ name: '...' }).
 *
 * Fase 1 solo usa la cola "reservas" (liberar-reserva-pendiente). Las colas
 * de notificaciones y cobros recurrentes se agregan en Fases 2 y 4.
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
  ],
  exports: [BullModule],
})
export class QueueModule {}
