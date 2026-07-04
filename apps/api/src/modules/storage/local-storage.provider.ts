import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { AppConfigService } from '@/config/config.module';
import type {
  SaveFileInput,
  StorageProvider,
  StoredFile,
} from './storage.types';

/**
 * Filesystem-backed storage for local development. Files live under UPLOAD_DIR;
 * the `key` is the relative path. No external service required.
 */
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);

  constructor(private readonly config: AppConfigService) {}

  private get root(): string {
    return path.resolve(this.config.get('UPLOAD_DIR'));
  }

  async save(input: SaveFileInput): Promise<StoredFile> {
    const safeName = input.originalName.replace(/[^\w.\-]+/g, '_');
    const key = path.posix.join(input.prefix, `${randomUUID()}_${safeName}`);
    const absolute = path.join(this.root, key);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, input.buffer);
    this.logger.log(`Stored ${key} (${input.buffer.length} bytes)`);
    return { url: `file://${absolute}`, key };
  }

  async read(key: string): Promise<Buffer> {
    try {
      return await fs.readFile(path.join(this.root, key));
    } catch {
      throw new NotFoundException(`Stored file not found: ${key}`);
    }
  }

  async delete(key: string): Promise<void> {
    await fs.rm(path.join(this.root, key), { force: true });
  }
}
