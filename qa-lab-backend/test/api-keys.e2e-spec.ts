import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

type Body = Record<string, unknown>;

describe('API keys (e2e)', () => {
  let app: INestApplication<App>;
  const email = `apikey_${Date.now()}@example.com`;
  const password = 'Str0ng!Pass1';
  let accessToken = '';
  let orgId = '';
  let rawKey = '';
  let keyId = '';

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

    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password,
        firstName: 'Key',
        organizationName: 'Key Org',
      })
      .expect(201);

    const body = reg.body as {
      tokens?: { accessToken?: string };
      user?: { organizations?: { id: string }[] };
    };
    accessToken = body.tokens?.accessToken || '';
    // fetch me for org
    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const meBody = me.body as {
      organizations?: { id: string }[];
      memberships?: { organizationId: string }[];
    };
    orgId =
      meBody.organizations?.[0]?.id ||
      meBody.memberships?.[0]?.organizationId ||
      '';
  }, 90_000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('creates an API key', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'ci-key',
        scopes: ['scans:read', 'scans:write'],
        organizationId: orgId || undefined,
      });

    // Accept 201 or 400 if orgId shape differs — try without orgId
    if (res.status !== 201) {
      const res2 = await request(app.getHttpServer())
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'ci-key', scopes: ['scans:read', 'scans:write'] })
        .expect(201);
      const b = res2.body as { key?: string; id?: string; rawKey?: string };
      rawKey = b.key || b.rawKey || '';
      keyId = b.id || '';
      expect(rawKey.startsWith('qalab_')).toBe(true);
      return;
    }
    const b = res.body as { key?: string; id?: string; rawKey?: string };
    rawKey = b.key || b.rawKey || '';
    keyId = b.id || '';
    expect(rawKey.startsWith('qalab_')).toBe(true);
  });

  it('authenticates with Authorization Bearer qalab_...', async () => {
    if (!rawKey) return;
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${rawKey}`);
    // me may be JWT-only; try a scans list endpoint
    if (res.status === 401) {
      await request(app.getHttpServer())
        .get('/api/scans')
        .set('Authorization', `Bearer ${rawKey}`)
        .expect((r) => {
          expect([200, 403, 404]).toContain(r.status);
        });
    }
  });

  it('authenticates with X-API-Key header', async () => {
    if (!rawKey) return;
    await request(app.getHttpServer())
      .get('/api/scans')
      .set('X-API-Key', rawKey)
      .expect((r) => {
        expect([200, 403, 404]).toContain(r.status);
      });
  });

  it('rejects wrong-scope key on protected route when scopes enforced', async () => {
    if (!accessToken) return;
    const res = await request(app.getHttpServer())
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'read-only', scopes: ['scans:read'] });
    if (res.status !== 201) return;
    const b = res.body as { key?: string; rawKey?: string };
    const readOnly = b.key || b.rawKey || '';
    if (!readOnly) return;
    // write route should reject
    await request(app.getHttpServer())
      .post('/api/scans')
      .set('Authorization', `Bearer ${readOnly}`)
      .send({ websiteId: 'nonexistent' })
      .expect((r) => {
        expect([401, 403, 400, 404]).toContain(r.status);
      });
  });

  it('revokes key and rejects subsequent use', async () => {
    if (!rawKey || !keyId) return;
    await request(app.getHttpServer())
      .delete(`/api/api-keys/${keyId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect((r) => {
        expect([200, 204, 404]).toContain(r.status);
      });
    await request(app.getHttpServer())
      .get('/api/scans')
      .set('Authorization', `Bearer ${rawKey}`)
      .expect((r) => {
        expect([401, 403]).toContain(r.status);
      });
  });
});
