import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Cliente de Redis compartido. Se usa para tres cosas distintas en la
 * Fase 1 (ver Plan Tecnico, seccion 3.4):
 *   1) Estado de sesion de conversacion del bot (bot.service.ts)
 *   2) Locks temporales de horario al crear una reserva (reservas.service.ts)
 *   3) Backend de la cola BullMQ (queue.module.ts)
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  public readonly client: Redis;

  constructor(private readonly config: ConfigService) {
    this.client = new Redis({
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
      maxRetriesPerRequest: 3,
    });

    this.client.on('connect', () => this.logger.log('Conectado a Redis'));
    this.client.on('error', (err) => this.logger.error('Error de Redis', err));
  }

  /**
   * Intenta adquirir un lock distribuido con expiracion automatica.
   * Devuelve true si se obtuvo el lock, false si alguien mas ya lo tiene.
   *
   * Se usa antes de crear una reserva, para que dos clientes que intentan
   * reservar el mismo horario al mismo tiempo no puedan ambos avanzar.
   */
  async adquirirLock(clave: string, ttlSegundos: number): Promise<boolean> {
    const resultado = await this.client.set(clave, '1', 'EX', ttlSegundos, 'NX');
    return resultado === 'OK';
  }

  async liberarLock(clave: string): Promise<void> {
    await this.client.del(clave);
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
