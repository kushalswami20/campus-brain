import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(AppConfigService);
  const logger = new Logger('Bootstrap');

  // Global input validation: strip unknown props, transform to DTO types,
  // and reject payloads with fields we did not declare.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api', { exclude: ['health', 'health/ready'] });
  app.enableCors({
    origin: config.get('CORS_ORIGINS'),
    credentials: true,
  });
  app.enableShutdownHooks();

  // OpenAPI / Swagger docs at /docs.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('CampusBrain API')
    .setDescription('Auth, business logic, persistence, and AI orchestration.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get('PORT');
  await app.listen(port);
  logger.log(`API listening on http://localhost:${port} (docs at /docs)`);
}

void bootstrap();
