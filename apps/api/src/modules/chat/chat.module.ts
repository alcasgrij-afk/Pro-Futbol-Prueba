import { Module } from '@nestjs/common';
import { CanchasModule } from '../canchas/canchas.module';
import { ReservasModule } from '../reservas/reservas.module';
import { ChatGateway } from './chat-gateway';
import { ChatService } from './chat.service';
import { ChatSessionService } from './chat-session.service';

@Module({
  imports: [CanchasModule, ReservasModule],
  providers: [ChatGateway, ChatService, ChatSessionService],
  exports: [ChatService],
})
export class ChatModule {}
