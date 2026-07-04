import { Global, Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRepository } from './analytics.repository';

/**
 * Global so any feature module can record usage/events without re-importing.
 * Admin reads and chat writes both depend on this single service.
 */
@Global()
@Module({
  providers: [AnalyticsService, AnalyticsRepository],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
