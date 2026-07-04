import { Injectable } from '@nestjs/common';
import {
  Document,
  DocumentStatus,
  DocumentType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { IngestChunk } from '../ai/ai.types';

interface CreateDocumentInput {
  ownerId: string;
  title: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storageUrl: string;
  storageKey: string;
  type: DocumentType;
  subjectId?: string;
}

interface ListParams {
  ownerId: string;
  page: number;
  pageSize: number;
  status?: DocumentStatus;
  type?: DocumentType;
}

/** Prisma access for Document and its EmbeddingMetadata children. */
@Injectable()
export class DocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateDocumentInput): Promise<Document> {
    return this.prisma.document.create({ data: input });
  }

  findOwned(id: string, ownerId: string): Promise<Document | null> {
    return this.prisma.document.findFirst({
      where: { id, ownerId, deletedAt: null },
    });
  }

  async list(params: ListParams): Promise<{ items: Document[]; total: number }> {
    const where: Prisma.DocumentWhereInput = {
      ownerId: params.ownerId,
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.type ? { type: params.type } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.document.count({ where }),
    ]);
    return { items, total };
  }

  setStatus(
    id: string,
    status: DocumentStatus,
    extra?: { errorMessage?: string | null },
  ): Promise<Document> {
    return this.prisma.document.update({
      where: { id },
      data: { status, ...(extra ?? {}) },
    });
  }

  /**
   * Persist ingestion output atomically: replace any prior chunks, write the new
   * EmbeddingMetadata rows, and mark the document READY. Re-runnable on retry.
   */
  async saveIngestion(
    documentId: string,
    chunks: IngestChunk[],
    meta: { pageCount?: number; chunkCount: number },
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.embeddingMetadata.deleteMany({ where: { documentId } }),
      this.prisma.embeddingMetadata.createMany({
        data: chunks.map((chunk) => ({
          documentId,
          vectorId: chunk.vectorId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          pageNumber: chunk.pageNumber ?? null,
          metadata: chunk.metadata as Prisma.InputJsonValue,
        })),
      }),
      this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.READY,
          chunkCount: meta.chunkCount,
          pageCount: meta.pageCount ?? null,
          errorMessage: null,
        },
      }),
    ]);
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
