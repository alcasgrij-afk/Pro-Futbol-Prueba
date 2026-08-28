import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { randomUUID } from 'crypto';
import { MensajeSaliente } from '@profutbol/shared-types';
import { ChatService } from './chat.service';

const LIMITE_MSJ_POR_SESION = 10; // por minuto
const LIMITE_MSJ_POR_IP = 30; // por minuto
const VENTANA_MS = 60_000;

interface Conteo {
  cuenta: number;
  reinicioEn: number;
}

/**
 * Gateway de WebSocket del chatbot web, namespace `/chat`.
 * El widget se conecta aca y recibe las respuestas de la maquina de estados.
 *
 * Rate limiting en memoria (por proceso). ponytail: si el hosting usa varias
 * instancias del backend, mover esto a Redis (contador con INCR+EXPIRE).
 */
@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
})
export class ChatGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);
  private readonly ventanas = new Map<string, Conteo>();

  @WebSocketServer()
  server: Server;

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket) {
    const sessionId =
      (typeof client.handshake.auth?.sessionId === 'string' && client.handshake.auth.sessionId) ||
      (typeof client.handshake.query?.sessionId === 'string' && client.handshake.query.sessionId) ||
      randomUUID();

    client.data.sessionId = sessionId;
    client.emit('chat:session', { sessionId });
    this.logger.log(`Chat conectado: ${sessionId}`);
  }

  @SubscribeMessage('chat:message')
  async manejarMensaje(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { texto?: string },
  ) {
    if (!this.permitido(client)) {
      client.emit('chat:error', { mensaje: 'Demasiados mensajes. Espera un momento.' });
      return;
    }

    const texto = (payload?.texto ?? '').toString().trim();
    if (!texto) return;

    const sessionId = client.data.sessionId as string;

    try {
      const mensajes = await this.chatService.procesar(sessionId, texto);
      client.emit('chat:respuesta', { mensajes });
    } catch (error) {
      this.logger.error(`Error procesando mensaje de ${sessionId}: ${(error as Error).message}`);
      client.emit('chat:error', { mensaje: 'Ocurrio un error. Intenta de nuevo.' });
    }
  }

  private permitido(client: Socket): boolean {
    const ahora = Date.now();
    const claves = [client.id, client.handshake.address];

    for (const clave of claves) {
      let conteo = this.ventanas.get(clave);
      if (!conteo || ahora > conteo.reinicioEn) {
        conteo = { cuenta: 0, reinicioEn: ahora + VENTANA_MS };
        this.ventanas.set(clave, conteo);
      }

      const limite = clave === client.id ? LIMITE_MSJ_POR_SESION : LIMITE_MSJ_POR_IP;
      if (conteo.cuenta >= limite) return false;
      conteo.cuenta += 1;
    }

    return true;
  }
}
