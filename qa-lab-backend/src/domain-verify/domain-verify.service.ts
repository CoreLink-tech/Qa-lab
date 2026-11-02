import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { promises as dns } from 'dns';
import { join } from 'path';
import { PrismaService } from '../database/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { OrganizationRole } from '../generated/prisma/client';

@Injectable()
export class DomainVerifyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
  ) {}

  async startVerification(userId: string, websiteId: string) {
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
      include: { project: true },
    });
    if (!website) throw new NotFoundException('Website not found');

    await this.organizations.requireMembership(
      userId,
      website.project.organizationId,
      [OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.MEMBER],
    );

    const token = `qalab-verify-${randomBytes(16).toString('hex')}`;
    await this.prisma.website.update({
      where: { id: websiteId },
      data: { domainVerifyToken: token, domainVerifiedAt: null },
    });

    const host = new URL(website.url).hostname;
    return {
      websiteId,
      host,
      dnsTxt: `qa-lab-verification=${token}`,
      wellKnownUrl: `https://${host}/.well-known/qa-lab-verification.txt`,
      wellKnownBody: token,
      instructions:
        'Add the DNS TXT record OR serve the token at the well-known URL, then call verify.',
    };
  }

  async verify(userId: string, websiteId: string) {
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
      include: { project: true },
    });
    if (!website) throw new NotFoundException('Website not found');
    if (!website.domainVerifyToken) {
      throw new BadRequestException('Start verification first');
    }

    await this.organizations.requireMembership(
      userId,
      website.project.organizationId,
      [OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.MEMBER],
    );

    const host = new URL(website.url).hostname;
    const token = website.domainVerifyToken;
    let ok = false;
    let method: string | null = null;

    try {
      const records = await dns.resolveTxt(host);
      const flat = records.map((r) => r.join(''));
      if (flat.some((r) => r.includes(`qa-lab-verification=${token}`))) {
        ok = true;
        method = 'dns_txt';
      }
    } catch {
      /* try well-known */
    }

    if (!ok) {
      try {
        // Use scanner safeGet when available
        const scannerRoot =
          process.env.QA_LAB_SCANNER_ROOT ||
          join(process.cwd(), '..', 'src', 'lib');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { safeGet } = require(
          join(scannerRoot, '..', 'utils', 'safeHttp'),
        ) as {
          safeGet: (
            url: string,
            opts?: object,
          ) => Promise<{ data: unknown; status: number }>;
        };
        const url = `https://${host}/.well-known/qa-lab-verification.txt`;
        const res = await safeGet(url, { timeoutMs: 10_000 });
        const body = String(String(res.data ?? '')).trim();
        if (body.includes(token)) {
          ok = true;
          method = 'well_known';
        }
      } catch {
        /* fail below */
      }
    }

    if (!ok) {
      throw new BadRequestException(
        'Verification token not found via DNS TXT or well-known file',
      );
    }

    await this.prisma.website.update({
      where: { id: websiteId },
      data: { domainVerifiedAt: new Date() },
    });

    return { verified: true, method, websiteId };
  }

  async assertVerified(websiteId: string): Promise<void> {
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
      select: { domainVerifiedAt: true },
    });
    if (!website?.domainVerifiedAt) {
      throw new BadRequestException(
        'Domain ownership must be verified before scheduling or exposed-path probes',
      );
    }
  }
}
