import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentsRepository } from './documents.repository';
import { IngestionProcessor } from './ingestion.processor';
import { INGESTION_QUEUE } from './ingestion.queue';

@Module({
  imports: [
    AiModule,
    BullModule.registerQueue({ name: INGESTION_QUEUE }),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsRepository, IngestionProcessor],
  exports: [DocumentsRepository],
})
export class DocumentsModule {}
