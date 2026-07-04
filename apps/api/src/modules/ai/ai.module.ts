import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiClient } from './ai.client';

/**
 * The only module that talks to the FastAPI AI service. Exports AiService so
 * feature modules (chat, study tools) orchestrate AI without touching HTTP.
 */
@Module({
  controllers: [AiController],
  providers: [AiService, AiClient],
  exports: [AiService],
})
export class AiModule {}
