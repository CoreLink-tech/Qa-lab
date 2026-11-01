import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    organizationId: string;
    userId?: string | null;
    action: string;
    resource: string;
    resourceId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          organizationId: input.organizationId,
          userId: input.userId ?? null,
          action: input.action,
          resource: input.resource,
          resourceId: input.resourceId ?? null,
          metadata:
            (input.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
        },
      });
    } catch {
      // Never fail the main request because of audit logging
    }
  }
}
