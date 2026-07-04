import { BadRequestException } from '@nestjs/common';
import { DocumentType } from '@prisma/client';
import { DocumentsService } from './documents.service';
import { DocumentsRepository } from './documents.repository';
import type { StorageProvider } from '../storage/storage.types';
import type { AppConfigService } from '@/config/config.module';

describe('DocumentsService.upload', () => {
  const buildService = () => {
    const repo = {
      create: jest.fn(async (input) => ({
        id: 'doc1',
        ...input,
        status: 'QUEUED',
        chunkCount: 0,
        pageCount: null,
        errorMessage: null,
        createdAt: new Date(),
        subjectId: input.subjectId ?? null,
      })),
    } as unknown as DocumentsRepository;
    const storage: StorageProvider = {
      save: jest.fn(async () => ({ url: 'file://x', key: 'k' })),
      read: jest.fn(),
      delete: jest.fn(),
    };
    const config = {
      get: (key: string) => (key === 'MAX_UPLOAD_MB' ? 25 : undefined),
    } as unknown as AppConfigService;
    const queue = { add: jest.fn(async () => undefined) };
    const service = new DocumentsService(
      repo,
      config,
      storage,
      queue as never,
    );
    return { service, storage, queue };
  };

  const file = (over: Partial<Express.Multer.File> = {}): Express.Multer.File =>
    ({
      originalname: 'notes.txt',
      mimetype: 'text/plain',
      size: 1000,
      buffer: Buffer.from('hello'),
      ...over,
    }) as Express.Multer.File;

  it('rejects an unsupported mime type', async () => {
    const { service } = buildService();
    await expect(
      service.upload('u1', file({ mimetype: 'application/zip' }), {}, 'r1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a file over the size limit', async () => {
    const { service } = buildService();
    await expect(
      service.upload('u1', file({ size: 26 * 1024 * 1024 }), {}, 'r1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores the file and enqueues an ingestion job', async () => {
    const { service, storage, queue } = buildService();
    const result = await service.upload(
      'u1',
      file(),
      { type: DocumentType.NOTES },
      'r1',
    );
    expect(storage.save).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('QUEUED');
    expect(result.type).toBe(DocumentType.NOTES);
  });
});
