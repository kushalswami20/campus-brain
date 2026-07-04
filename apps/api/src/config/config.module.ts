import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';
import { validateEnv, type Env } from './env.validation';

/**
 * Typed configuration access. `AppConfigService` narrows `ConfigService` to our
 * validated `Env` shape so consumers get autocomplete and non-nullable types
 * for keys that are guaranteed present.
 */
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }
}

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
  ],
  providers: [
    {
      provide: AppConfigService,
      useFactory: (config: ConfigService<Env, true>) =>
        new AppConfigService(config),
      inject: [ConfigService],
    },
  ],
  exports: [AppConfigService],
})
export class AppConfigModule {}
