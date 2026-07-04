import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Document, DocumentType } from '@prisma/client';
import type { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { AppConfigService } from '@/config/config.module';
import { paginate, type PaginatedResponse } from '@/common/dto/api-response';
import { STORAGE_PROVIDER, type StorageProvider } from '../storage/storage.types';
import { DocumentsRepository } from './documents.repository';
import { UploadDocumentDto, DocumentResponseDto } from './dto/upload-document.dto';
import { ListDocumentsDto } from './dto/list-documents.dto';
import { INGESTION_QUEUE, type IngestionJobData } from './ingestion.queue';

/** Content types we accept for ingestion. */
const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'image/png',
  'image/jpeg',
]);

@Injectable()
export class DocumentsService {
  constructor(
    private readonly documents: DocumentsRepository,
    private readonly config: AppConfigService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    @InjectQueue(INGESTION_QUEUE) private readonly queue: Queue<IngestionJobData>,
  ) {}

  async upload(
    ownerId: string,
    file: Express.Multer.File,
    dto: UploadDocumentDto,
    requestId: string,
  ): Promise<DocumentResponseDto> {
    if (!file) throw new BadRequestException('A file is required.');
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }
    const maxBytes = this.config.get('MAX_UPLOAD_MB') * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `File exceeds the ${this.config.get('MAX_UPLOAD_MB')}MB limit.`,
      );
    }

    const stored = await this.storage.save({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      prefix: ownerId,
    });

    const document = await this.documents.create({
      ownerId,
      title: dto.title?.trim() || file.originalname,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storageUrl: stored.url,
      storageKey: stored.key,
      type: dto.type ?? this.inferType(file.mimetype),
      subjectId: dto.subjectId,
    });

    // Ingestion runs asynchronously; retries with backoff, keep last results.
    await this.queue.add(
      'ingest',
      { documentId: document.id, ownerId, requestId },
      {
        jobId: `ingest:${document.id}:${randomUUID()}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );

    return DocumentsService.toResponse(document);
  }

  async list(
    ownerId: string,
    dto: ListDocumentsDto,
  ): Promise<PaginatedResponse<DocumentResponseDto>> {
    const { items, total } = await this.documents.list({
      ownerId,
      page: dto.page,
      pageSize: dto.pageSize,
      status: dto.status,
      type: dto.type,
    });
    return paginate(
      items.map(DocumentsService.toResponse),
      total,
      dto.page,
      dto.pageSize,
    );
  }

  async getById(ownerId: string, id: string): Promise<DocumentResponseDto> {
    const document = await this.documents.findOwned(id, ownerId);
    if (!document) throw new NotFoundException('Document not found.');
    return DocumentsService.toResponse(document);
  }

  async remove(ownerId: string, id: string): Promise<void> {
    const document = await this.documents.findOwned(id, ownerId);
    if (!document) throw new NotFoundException('Document not found.');
    await this.documents.softDelete(id);
    // Best-effort cleanup of the stored object; DB soft-delete is the record.
    await this.storage.delete(document.storageKey).catch(() => undefined);
  }

  private inferType(mime: string): DocumentType {
    if (mime.startsWith('image/')) return DocumentType.IMAGE;
    if (mime.includes('presentation')) return DocumentType.SLIDES;
    return DocumentType.OTHER;
  }

  private static toResponse(document: Document): DocumentResponseDto {
    return {
      id: document.id,
      title: document.title,
      originalName: document.originalName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      type: document.type,
      status: document.status,
      chunkCount: document.chunkCount,
      pageCount: document.pageCount,
      subjectId: document.subjectId,
      errorMessage: document.errorMessage,
      createdAt: document.createdAt,
    };
  }
}
