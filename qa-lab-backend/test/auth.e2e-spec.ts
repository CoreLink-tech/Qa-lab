import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

type AuthBody = {
  user?: { email?: string };
  tokens?: { accessToken?: string; refreshToken?: string };
  email?: string;
};

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

    expect((res.body as AuthBody).user?.email).toBe(email);
    expect(typeof (res.body as AuthBody).tokens?.accessToken).toBe('string');
    expect((res.body as AuthBody).tokens!.accessToken!.length).toBeGreaterThan(
      20,
    );
    expect(typeof (res.body as AuthBody).tokens?.refreshToken).toBe('string');
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

    expect(typeof (res.body as AuthBody).tokens?.accessToken).toBe('string');
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

    const token = (login.body as AuthBody).tokens!.accessToken as string;

    await request(app.getHttpServer()).get('/api/auth/me').expect(401);

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect((me.body as AuthBody).email).toBe(email);
  });

  it('refresh rotates tokens and reuse of old refresh is rejected', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    const body = login.body as {
      tokens?: { accessToken?: string; refreshToken?: string };
    };
    const refresh1 = body.tokens?.refreshToken;
    if (!refresh1) return;

    const rotated = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: refresh1 })
      .expect(200);

    const body2 = rotated.body as {
      tokens?: { refreshToken?: string };
    };
    expect(body2.tokens?.refreshToken).toBeTruthy();
    expect(body2.tokens?.refreshToken).not.toBe(refresh1);

    // Reuse of the old refresh must fail (family burned)
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: refresh1 })
      .expect((r) => {
        expect([401, 403]).toContain(r.status);
      });
  });
});
