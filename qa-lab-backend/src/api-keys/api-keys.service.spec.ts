import { createHash } from 'crypto';
import { ApiKeysService } from './api-keys.service';

describe('ApiKeysService.validateRawKey', () => {
  const prisma = {
    apiKey: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const organizations = {};
  const audit = { log: jest.fn() };

  const service = new ApiKeysService(
    prisma as never,
    organizations as never,
    audit as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects non-qalab prefixes', async () => {
    await expect(service.validateRawKey('sk_live_abc')).resolves.toBeNull();
    expect(prisma.apiKey.findUnique).not.toHaveBeenCalled();
  });

  it('rejects unknown keys', async () => {
    prisma.apiKey.findUnique.mockResolvedValue(null);
    await expect(service.validateRawKey('qalab_unknownkeyvalue')).resolves.toBeNull();
  });

  it('rejects revoked keys', async () => {
    const raw = 'qalab_testkeyvalue123456789012';
    const keyHash = createHash('sha256').update(raw).digest('hex');
    prisma.apiKey.findUnique.mockResolvedValue({
      id: 'k1',
      keyHash,
      revokedAt: new Date(),
      expiresAt: null,
      lastUsedAt: null,
      organizationId: 'org1',
      createdById: 'u1',
      scopes: ['scans:read'],
    });
    await expect(service.validateRawKey(raw)).resolves.toBeNull();
  });

  it('accepts valid key and touches lastUsedAt', async () => {
    const raw = 'qalab_testkeyvalue123456789012';
    const keyHash = createHash('sha256').update(raw).digest('hex');
    prisma.apiKey.findUnique.mockResolvedValue({
      id: 'k1',
      keyHash,
      revokedAt: null,
      expiresAt: null,
      lastUsedAt: null,
      organizationId: 'org1',
      createdById: 'u1',
      scopes: ['scans:write'],
    });
    prisma.apiKey.update.mockResolvedValue({});
    const key = await service.validateRawKey(raw);
    expect(key?.id).toBe('k1');
    expect(prisma.apiKey.update).toHaveBeenCalled();
  });
});
