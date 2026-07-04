import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '@/config/config.module';
import { STORAGE_PROVIDER, type StorageProvider } from './storage.types';
import { LocalStorageProvider } from './local-storage.provider';
import { CloudinaryStorageProvider } from './cloudinary-storage.provider';

/**
 * Binds STORAGE_PROVIDER to the driver chosen by config. Only the selected
 * driver is instantiated (the factory news it up) so the Cloudinary provider's
 * config check never runs in local dev. Global so any module can inject it.
 */
@Global()
@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useFactory: (config: AppConfigService): StorageProvider =>
        config.get('STORAGE_DRIVER') === 'cloudinary'
          ? new CloudinaryStorageProvider(config)
          : new LocalStorageProvider(config),
      inject: [AppConfigService],
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
