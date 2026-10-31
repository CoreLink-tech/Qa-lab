import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';
import { OrganizationRole, UserStatus } from '../generated/prisma/client';
import { EmailService } from '../email/email.service';
import { AuthService } from './auth.service';

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
    organization: {
      create: jest.Mock;
      findUnique: jest.Mock;
    };
    organizationMember: {
      findFirst: jest.Mock;
    };
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let jwt: { signAsync: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      organization: {
        create: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      organizationMember: {
        findFirst: jest.fn(),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    jwt = {
      signAsync: jest.fn().mockResolvedValue('access.jwt.token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: EmailService, useValue: { send: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'jwt.accessSecret') return 'test-access-secret';
              if (key === 'jwt.refreshSecret') return 'test-refresh-secret';
              return undefined;
            },
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  });

  describe('register', () => {
    it('creates a user, organization, and returns tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          user: {
            create: jest.fn().mockResolvedValue({
              id: 'user-1',
              email: 'alex@example.com',
              firstName: 'Alex',
              lastName: null,
              status: UserStatus.ACTIVE,
            }),
          },
          organization: {
            create: jest.fn().mockResolvedValue({
              id: 'org-1',
              name: 'Acme',
              slug: 'acme',
            }),
          },
        };
        return fn(tx);
      });

      const result = await service.register({
        email: 'Alex@Example.com',
        password: 'Str0ng!Pass',
        firstName: 'Alex',
        organizationName: 'Acme',
      });

      expect(result.user.email).toBe('alex@example.com');
      expect(result.organization?.role).toBe(OrganizationRole.OWNER);
      expect(result.tokens.accessToken).toBe('access.jwt.token');
      expect(result.tokens.refreshToken).toBeTruthy();
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });

    it('rejects duplicate email', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(
        service.register({
          email: 'alex@example.com',
          password: 'Str0ng!Pass',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'alex@example.com',
        passwordHash: 'hashed',
        firstName: 'Alex',
        lastName: null,
        status: UserStatus.ACTIVE,
        memberships: [
          {
            role: OrganizationRole.OWNER,
            organization: { id: 'org-1', name: 'Acme', slug: 'acme' },
          },
        ],
      });

      const result = await service.login({
        email: 'alex@example.com',
        password: 'Str0ng!Pass',
      });

      expect(result.user.id).toBe('user-1');
      expect(result.tokens.accessToken).toBeTruthy();
    });

    it('rejects bad password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'alex@example.com',
        passwordHash: 'hashed',
        status: UserStatus.ACTIVE,
        memberships: [],
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'alex@example.com', password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('rotates tokens for a valid refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        tokenHash: 'abc',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        user: {
          id: 'user-1',
          email: 'alex@example.com',
          firstName: null,
          lastName: null,
          status: UserStatus.ACTIVE,
        },
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.organizationMember.findFirst.mockResolvedValue(null);

      const result = await service.refresh('some-raw-refresh-token');
      expect(result.tokens.accessToken).toBeTruthy();
      expect(prisma.refreshToken.update).toHaveBeenCalled();
    });

    it('rejects expired refresh tokens', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        tokenHash: 'abc',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
        user: { id: 'user-1', status: UserStatus.ACTIVE },
      });

      await expect(service.refresh('expired')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
