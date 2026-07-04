import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';
import type { Job } from 'bullmq';
import { AiService } from '../ai/ai.service';
import { STORAGE_PROVIDER, type StorageProvider } from '../storage/storage.types';
import { Inject } from '@nestjs/common';
import { DocumentsRepository } from './documents.repository';
import { INGESTION_QUEUE, type IngestionJobData } from './ingestion.queue';

/**
 * Background worker that turns an uploaded document into searchable vectors:
 * read bytes -> AI ingest -> persist EmbeddingMetadata -> mark READY. Failures
 * flip the document to FAILED with a message; BullMQ retries per queue config.
 */
@Processor(INGESTION_QUEUE)
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(
    private readonly documents: DocumentsRepository,
    private readonly ai: AiService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {
    super();
  }

  async process(job: Job<IngestionJobData>): Promise<void> {
    const { documentId, ownerId, requestId } = job.data;
    const log = `[${requestId}] document ${documentId}`;

    const document = await this.documents.findOwned(documentId, ownerId);
    if (!document) {
      this.logger.warn(`${log}: not found (deleted?); skipping.`);
      return;
    }

    try {
      await this.documents.setStatus(documentId, DocumentStatus.PROCESSING);

      const buffer = await this.storage.read(document.storageKey);
      const result = await this.ai.ingest({
        requestId,
        documentId,
        filename: document.originalName,
        mimeType: document.mimeType,
        contentBase64: buffer.toString('base64'),
        subjectId: document.subjectId ?? undefined,
        documentType: document.type,
      });

      await this.documents.saveIngestion(documentId, result.chunks, {
        pageCount: result.pageCount,
        chunkCount: result.chunkCount,
      });
      this.logger.log(`${log}: ready (${result.chunkCount} chunks).`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Ingestion failed.';
      this.logger.error(`${log}: ${message}`);
      await this.documents.setStatus(documentId, DocumentStatus.FAILED, {
        errorMessage: message.slice(0, 500),
      });
      throw error; // surface to BullMQ for retry/backoff
    }
  }
}
