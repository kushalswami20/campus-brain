import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { ChatsRepository } from './chats.repository';

@Module({
  imports: [AiModule],
  controllers: [ChatsController],
  providers: [ChatsService, ChatsRepository],
  exports: [ChatsService],
})
export class ChatModule {}
