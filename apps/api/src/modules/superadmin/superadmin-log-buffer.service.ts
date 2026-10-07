import { ConsoleLogger, Injectable } from '@nestjs/common';

export interface LineaLog {
  t: number;
  nivel: 'warn' | 'error';
  contexto?: string;
  mensaje: string;
}

const MAX_LINEAS = 50;

/**
 * Se instala via app.useLogger() en main.ts, lo que la convierte en el
 * logger de TODA la app: cualquier `new Logger(contexto).warn/error(...)`
 * (el filtro global de excepciones, las acciones correctivas de
 * SuperadminAccionesService, conexiones de Redis/Prisma, etc.) pasa por
 * aqui sin tocar esos archivos. Solo warn/error se guardan en el buffer;
 * log/debug/verbose se comportan igual que el ConsoleLogger por defecto.
 */
@Injectable()
export class SuperadminLogBufferService extends ConsoleLogger {
  private readonly buffer: LineaLog[] = [];

  warn(message: unknown, ...params: unknown[]) {
    this.agregar('warn', message, params);
    super.warn(message, ...(params as []));
  }

  error(message: unknown, ...params: unknown[]) {
    this.agregar('error', message, params);
    super.error(message, ...(params as []));
  }

  obtenerUltimas(): LineaLog[] {
    return this.buffer;
  }

  private agregar(nivel: 'warn' | 'error', message: unknown, params: unknown[]) {
    const contexto = params.find((p) => typeof p === 'string') as string | undefined;
    const mensaje = typeof message === 'string' ? message : JSON.stringify(message);
    this.buffer.push({ t: Date.now(), nivel, contexto, mensaje: mensaje.slice(0, 500) });
    if (this.buffer.length > MAX_LINEAS) this.buffer.shift();
  }
}
