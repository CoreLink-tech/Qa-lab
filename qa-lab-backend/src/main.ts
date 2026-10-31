import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { StructuredLogger } from './observability/structured-logger';
import { initErrorTracking } from './observability/error-tracking';

async function bootstrap() {
  initErrorTracking();

  const app = await NestFactory.create(AppModule, {
    logger: new StructuredLogger('Bootstrap'),
  });

  if (process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1') {
    // Nest's INestApplication does not expose Express's app.set; use the
    // underlying HTTP adapter (Express by default).
    const httpAdapter = app.getHttpAdapter();
    if (typeof httpAdapter?.getInstance === 'function') {
      const instance = httpAdapter.getInstance();
      if (instance && typeof instance.set === 'function') {
        instance.set('trust proxy', 1);
      }
    }
  }

  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('QA Lab API')
    .setDescription(
      'Website Quality Assurance platform API — auth, workspaces, projects, scans, and reports.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT || 3000);
}

bootstrap().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: 'error',
      message: 'Failed to start QA Lab backend',
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exit(1);
});
