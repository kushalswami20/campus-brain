import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { randomUUID } from 'node:crypto';
import { AppConfigService } from '@/config/config.module';
import type {
  SaveFileInput,
  StorageProvider,
  StoredFile,
} from './storage.types';

/**
 * Cloudinary-backed storage for production. Configured from CLOUDINARY_URL.
 * Uploads use `resource_type: 'auto'` so documents and images both work.
 */
@Injectable()
export class CloudinaryStorageProvider implements StorageProvider {
  private readonly logger = new Logger(CloudinaryStorageProvider.name);

  constructor(private readonly config: AppConfigService) {
    const url = this.config.get('CLOUDINARY_URL');
    if (!url) {
      throw new Error(
        'STORAGE_DRIVER=cloudinary requires CLOUDINARY_URL to be set.',
      );
    }
    // The SDK reads CLOUDINARY_URL from the environment automatically.
    cloudinary.config({ secure: true });
  }

  save(input: SaveFileInput): Promise<StoredFile> {
    const publicId = `campusbrain/${input.prefix}/${randomUUID()}`;
    return new Promise<StoredFile>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { public_id: publicId, resource_type: 'auto' },
        (error, result?: UploadApiResponse) => {
          if (error || !result) {
            return reject(
              error ?? new Error('Cloudinary upload returned no result.'),
            );
          }
          this.logger.log(`Uploaded ${result.public_id}`);
          resolve({ url: result.secure_url, key: result.public_id });
        },
      );
      stream.end(input.buffer);
    });
  }

  async read(key: string): Promise<Buffer> {
    const url = cloudinary.url(key, { resource_type: 'auto', secure: true });
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${key} from Cloudinary (${response.status}).`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    await cloudinary.uploader.destroy(key, { resource_type: 'image' });
  }
}
