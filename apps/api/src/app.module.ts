import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HealthModule } from './modules/health/health.module';

/**
 * Root module. Global cross-cutting concerns (config, prisma, exception filter,
 * logging interceptor) are registered exactly once here. Feature modules are
 * added as their milestones land.
 */
@Module({
  imports: [AppConfigModule, PrismaModule, HealthModule],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
