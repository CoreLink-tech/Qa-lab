import { BadRequestException } from '@nestjs/common';
import { join } from 'path';

/**
 * Validate a website/scan URL using the root scanner SSRF guard.
 * Used at website create/update and can be reused at scan enqueue.
 */
export async function assertSafeExternalUrl(url: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { assertSafeScanUrl } = require(
    process.env.QA_LAB_SCANNER_ROOT
      ? join(process.env.QA_LAB_SCANNER_ROOT, '..', 'utils', 'ssrfGuard')
      : join(process.cwd(), '..', 'src', 'utils', 'ssrfGuard'),
  ) as {
    assertSafeScanUrl: (u: string, o?: object) => Promise<{ href: string }>;
  };

  try {
    const result = await assertSafeScanUrl(url, {
      allowHttp: true,
      resolveDns: true,
    });
    return result.href.replace(/\/+$/, '') || result.href;
  } catch (err) {
    throw new BadRequestException(
      (err as Error).message || 'URL failed SSRF safety checks',
    );
  }
}
