import { Module } from '@nestjs/common';
import { CanchasModule } from '../canchas/canchas.module';
import { ReservasModule } from '../reservas/reservas.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatSessionService } from './chat-session.service';

@Module({
  imports: [CanchasModule, ReservasModule],
  controllers: [ChatController],
  providers: [ChatService, ChatSessionService],
  exports: [ChatService],
})
export class ChatModule {}