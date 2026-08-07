import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Mirror the pipes/prefix set up in main.ts so this exercises the app
    // the way it actually runs, not a bare NestFactory instance.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api');

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  interface HealthCheckResponseBody {
    status: string;
    details: Record<string, { status: string }>;
  }

  it('GET /api/health returns ok status with a memory heap check', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        const body = res.body as HealthCheckResponseBody;
        expect(body.status).toBe('ok');
        expect(body.details.memory_heap.status).toBe('up');
      });
  });

  it('GET /api/nonexistent-route returns 404', () => {
    return request(app.getHttpServer())
      .get('/api/nonexistent-route')
      .expect(404);
  });
});
