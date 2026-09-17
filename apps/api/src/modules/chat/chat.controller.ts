import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { randomUUID } from 'crypto';
import { MensajeSaliente } from '@profutbol/shared-types';
import { Public } from '../../common/decorators/public.decorator';
import { ChatService } from './chat.service';
import { MensajeChatDto } from './dto/mensaje-chat.dto';

/**
 * Endpoint HTTP del chatbot (reemplaza al WebSocket /chat, que devolvia 404:
 * ver PENDIENTES.md 10.1). El bot es una maquina de estados síncrona:
 * cliente envia texto -> servidor procesa y devuelve MENSAJES => no necesita
 * push en tiempo real, un POST basta. La sesion vive en Redis via
 * ChatSessionService; el `sessionId` viaja en el cuerpo y se persiste en
 * localStorage del navegador.
 *
 * Rate limiting propio (30/min por IP) mas estricto que el global (120/min),
 * replica el limite en memoria que tenia el gateway.
 */
@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @ApiOperation({ summary: 'Enviar un mensaje al chatbot y obtener su respuesta' })
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('mensajes')
  async mensajes(@Body() dto: MensajeChatDto): Promise<{ sessionId: string; mensajes: MensajeSaliente[] }> {
    const sessionId = dto.sessionId || randomUUID();
    const mensajes = await this.chatService.procesar(sessionId, dto.texto, dto.fecha);
    return { sessionId, mensajes };
  }
}