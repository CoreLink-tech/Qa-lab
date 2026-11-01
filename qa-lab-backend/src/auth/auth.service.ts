import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { OrganizationRole, UserStatus } from '../generated/prisma/client';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { AuthResponseDto } from './dto/auth-response.dto';
import type { JwtPayload } from './strategies/jwt.strategy';

/** bcrypt cost 12 — deliberate CPU tradeoff vs brute-force resistance. */
const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FAILED_LOGINS = 8;
const LOCKOUT_MS = 15 * 60 * 1000;
const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const orgName =
      dto.organizationName?.trim() || this.defaultOrgName(dto.firstName, email);
    const orgSlug = await this.uniqueSlug(this.slugify(orgName));
    const verifyRaw = randomBytes(32).toString('base64url');
    const verifyHash = this.hashToken(verifyRaw);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: dto.firstName?.trim() || null,
          lastName: dto.lastName?.trim() || null,
          status: UserStatus.ACTIVE,
          emailVerifyTokenHash: verifyHash,
          emailVerifyExpiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_MS),
        },
      });

      const organization = await tx.organization.create({
        data: {
          name: orgName,
          slug: orgSlug,
          members: {
            create: {
              userId: user.id,
              role: OrganizationRole.OWNER,
            },
          },
        },
      });

      return { user, organization };
    });

    const appUrl =
      this.config.get<string>('app.publicUrl') || 'http://localhost:3001';
    await this.email.send({
      to: email,
      subject: 'Verify your QA Lab email',
      text: `Verify your email: ${appUrl}/verify-email?token=${verifyRaw}`,
    });

    const tokens = await this.issueTokens(result.user.id, result.user.email);

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        status: result.user.status,
      },
      tokens,
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
        role: OrganizationRole.OWNER,
      },
    };
  }

  async login(
    dto: LoginDto,
    meta?: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthResponseDto> {
    const email = dto.email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: { organization: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException(
        `Account temporarily locked until ${user.lockedUntil.toISOString()}`,
      );
    }

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) {
      const failed = user.failedLoginCount + 1;
      const lockedUntil =
        failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCKOUT_MS) : null;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failed,
          lockedUntil,
        },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });

    const tokens = await this.issueTokens(user.id, user.email, meta);
    const primaryMembership = user.memberships[0];

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
      },
      tokens,
      organization: primaryMembership
        ? {
            id: primaryMembership.organization.id,
            name: primaryMembership.organization.name,
            slug: primaryMembership.organization.slug,
            role: primaryMembership.role,
          }
        : undefined,
    };
  }

  async refresh(
    rawRefreshToken: string,
    meta?: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthResponseDto> {
    const tokenHash = this.hashToken(rawRefreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Reuse detection: revoked/replaced token presented → burn the family
    if (stored.revokedAt || stored.replacedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(
        'Refresh token reuse detected; session family revoked',
      );
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (stored.user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User is not active');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { replacedAt: new Date(), revokedAt: new Date() },
    });

    const tokens = await this.issueTokens(
      stored.user.id,
      stored.user.email,
      meta,
      stored.familyId,
    );

    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId: stored.user.id },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      user: {
        id: stored.user.id,
        email: stored.user.email,
        firstName: stored.user.firstName,
        lastName: stored.user.lastName,
        status: stored.user.status,
      },
      tokens,
      organization: membership
        ? {
            id: membership.organization.id,
            name: membership.organization.name,
            slug: membership.organization.slug,
            role: membership.role,
          }
        : undefined,
    };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        emailVerifiedAt: true,
        createdAt: true,
        memberships: {
          select: {
            role: true,
            organization: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User is not active');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
      organizations: user.memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role,
      })),
    };
  }

  async verifyEmail(rawToken: string): Promise<{ verified: boolean }> {
    const tokenHash = this.hashToken(rawToken);
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerifyTokenHash: tokenHash,
        emailVerifyExpiresAt: { gt: new Date() },
      },
    });
    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerifyTokenHash: null,
        emailVerifyExpiresAt: null,
      },
    });
    return { verified: true };
  }

  async forgotPassword(emailRaw: string): Promise<{ ok: true }> {
    const email = emailRaw.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return ok to avoid account enumeration
    if (!user || user.status !== UserStatus.ACTIVE) {
      return { ok: true };
    }

    const raw = randomBytes(32).toString('base64url');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(raw),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });

    const appUrl =
      this.config.get<string>('app.publicUrl') || 'http://localhost:3001';
    await this.email.send({
      to: email,
      subject: 'Reset your QA Lab password',
      text: `Reset password (expires in 1 hour): ${appUrl}/reset-password?token=${raw}`,
    });

    return { ok: true };
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.userId },
        data: {
          passwordHash,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  private async issueTokens(
    userId: string,
    email: string,
    meta?: { userAgent?: string; ipAddress?: string },
    existingFamilyId?: string,
  ) {
    const payload: JwtPayload = { sub: userId, email };

    const accessSecret = this.config.get<string>('jwt.accessSecret');
    if (!accessSecret) {
      throw new Error('JWT_ACCESS_SECRET is not configured');
    }

    const accessToken = await this.jwt.signAsync(payload, {
      secret: accessSecret,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });

    const rawRefresh = randomBytes(48).toString('base64url');
    const tokenHash = this.hashToken(rawRefresh);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    const familyId = existingFamilyId || randomBytes(16).toString('hex');

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        familyId,
        userAgent: meta?.userAgent?.slice(0, 512) || null,
        ipAddress: meta?.ipAddress?.slice(0, 64) || null,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    };
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private slugify(input: string): string {
    return (
      input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '')
        .slice(0, 60) || 'workspace'
    );
  }

  private defaultOrgName(firstName: string | undefined, email: string): string {
    if (firstName?.trim()) {
      return `${firstName.trim()}'s Workspace`;
    }
    const local = email.split('@')[0] || 'user';
    return `${local}'s Workspace`;
  }

  private async uniqueSlug(base: string): Promise<string> {
    let candidate = base;
    let attempt = 0;
    while (attempt < 20) {
      const existing = await this.prisma.organization.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!existing) return candidate;
      attempt += 1;
      candidate = `${base}-${randomBytes(2).toString('hex')}`;
    }
    return `${base}-${randomBytes(4).toString('hex')}`;
  }
}
