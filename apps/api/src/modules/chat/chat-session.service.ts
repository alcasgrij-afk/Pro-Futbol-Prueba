import { Injectable } from '@nestjs/common';
import { SesionChat } from '@profutbol/shared-types';
import { RedisService } from '../../redis/redis.service';

const TTL_SEGUNDOS = 30 * 60; // 30 minutos de inactividad (ver .env.example)

@Injectable()
export class ChatSessionService {
  constructor(private readonly redis: RedisService) {}

  async obtener(sessionId: string): Promise<SesionChat | null> {
    const raw = await this.redis.client.get(this.clave(sessionId));
    return raw ? (JSON.parse(raw) as SesionChat) : null;
  }

  async guardar(sesion: SesionChat): Promise<void> {
    sesion.actualizadoEn = new Date().toISOString();
    await this.redis.client.set(
      this.clave(sesion.sessionId),
      JSON.stringify(sesion),
      'EX',
      TTL_SEGUNDOS,
    );
  }

  async reiniciar(sessionId: string): Promise<void> {
    await this.redis.client.del(this.clave(sessionId));
  }

  private clave(sessionId: string): string {
    return `session:${sessionId}`;
  }
}
