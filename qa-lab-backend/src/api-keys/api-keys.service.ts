import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { OrganizationRole } from '../generated/prisma/client';
import { OrganizationsService } from '../organizations/organizations.service';
import { AuditService } from '../audit/audit.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

/** Digest for high-entropy API tokens (not user passwords). */
function hashApiKeyMaterial(rawKey: string): string {
  // HMAC-SHA256 over random API tokens — not a password-hashing scheme.
  const pepper = process.env.API_KEY_PEPPER || process.env.JWT_ACCESS_SECRET || 'qalab-api-key-v1';
  return createHmac('sha256', pepper).update(rawKey, 'utf8').digest('hex');
}

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, dto: CreateApiKeyDto) {
    await this.organizations.requireMembership(
      userId,
      dto.organizationId,
      [OrganizationRole.OWNER, OrganizationRole.ADMIN],
    );

    const rawKey = `qalab_${randomBytes(24).toString('base64url')}`;
    const prefix = rawKey.slice(0, 12);
    const keyHash = hashApiKeyMaterial(rawKey);

    const record = await this.prisma.apiKey.create({
      data: {
        organizationId: dto.organizationId,
        createdById: userId,
        name: dto.name.trim(),
        prefix,
        keyHash,
        scopes: dto.scopes ?? ['scans:write', 'scans:read'],
      },
    });

    await this.audit.log({
      organizationId: dto.organizationId,
      userId,
      action: 'api_key.create',
      resource: 'ApiKey',
      resourceId: record.id,
      metadata: { name: record.name, prefix },
    });

    // Raw key shown once
    return {
      id: record.id,
      name: record.name,
      prefix: record.prefix,
      scopes: record.scopes,
      key: rawKey,
      createdAt: record.createdAt,
      warning: 'Store this key securely. It will not be shown again.',
    };
  }

  async list(userId: string, organizationId: string) {
    await this.organizations.requireMembership(userId, organizationId);

    const keys = await this.prisma.apiKey.findMany({
      where: { organizationId, revokedAt: null },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return keys;
  }

  async revoke(userId: string, keyId: string) {
    const key = await this.prisma.apiKey.findUnique({ where: { id: keyId } });
    if (!key) throw new NotFoundException('API key not found');

    await this.organizations.requireMembership(
      userId,
      key.organizationId,
      [OrganizationRole.OWNER, OrganizationRole.ADMIN],
    );

    if (key.revokedAt) {
      throw new ForbiddenException('API key already revoked');
    }

    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });

    await this.audit.log({
      organizationId: key.organizationId,
      userId,
      action: 'api_key.revoke',
      resource: 'ApiKey',
      resourceId: keyId,
    });

    return { id: keyId, revoked: true };
  }

  /**
   * Validate a raw API key. Uses constant-time hash compare against stored digests.
   * lastUsedAt updates are throttled to at most once per 60s per key.
   */
  async validateRawKey(rawKey: string) {
    if (!rawKey || typeof rawKey !== 'string' || !rawKey.startsWith('qalab_')) {
      return null;
    }

    const keyHash = hashApiKeyMaterial(rawKey);
    const keyHashBuf = Buffer.from(keyHash, 'hex');

    // Lookup by hash (indexed unique). Still compare with timingSafeEqual.
    const key = await this.prisma.apiKey.findUnique({
      where: { keyHash },
    });
    if (!key) return null;

    const stored = Buffer.from(key.keyHash, 'hex');
    if (
      stored.length !== keyHashBuf.length ||
      !timingSafeEqual(stored, keyHashBuf)
    ) {
      return null;
    }

    if (key.revokedAt) return null;
    if (key.expiresAt && key.expiresAt.getTime() < Date.now()) return null;

    const shouldTouch =
      !key.lastUsedAt ||
      Date.now() - key.lastUsedAt.getTime() > 60_000;
    if (shouldTouch) {
      await this.prisma.apiKey
        .update({
          where: { id: key.id },
          data: { lastUsedAt: new Date() },
        })
        .catch(() => undefined);
    }

    return key;
  }
}

