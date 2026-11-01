import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  const email = `e2e_${Date.now()}@example.com`;
  const password = 'Str0ng!Pass1';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api');
    await app.init();
  }, 60_000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('POST /api/auth/register creates user and returns access token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password,
        firstName: 'E2E',
        organizationName: 'E2E Org',
      })
      .expect(201);

    expect(res.body.user?.email).toBe(email);
    expect(typeof res.body.tokens?.accessToken).toBe('string');
    expect(res.body.tokens.accessToken.length).toBeGreaterThan(20);
    expect(typeof res.body.tokens?.refreshToken).toBe('string');
  });

  it('POST /api/auth/register rejects duplicate email', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password })
      .expect(409);
  });

  it('POST /api/auth/login returns tokens for valid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    expect(typeof res.body.tokens?.accessToken).toBe('string');
  });

  it('POST /api/auth/login rejects bad password', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'WrongPass1' })
      .expect(401);
  });

  it('GET /api/auth/me requires auth and returns profile', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    const token = login.body.tokens.accessToken as string;

    await request(app.getHttpServer()).get('/api/auth/me').expect(401);

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(me.body.email).toBe(email);
  });
});
