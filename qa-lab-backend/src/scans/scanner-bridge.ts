/**
 * Thin bridge that loads the root CommonJS scanner library from the monorepo
 * root without pulling it into the Nest TypeScript compile graph.
 *
 * Resolved relative to process.cwd() (expected to be qa-lab-backend/ when
 * running via nest start) or QA_LAB_SCANNER_ROOT when set.
 */

import { join } from 'path';

export type LibraryScanRequest = {
  startUrl: string;
  maxPages?: number;
  maxDepth?: number;
  concurrency?: number;
  delayMs?: number;
  respectRobotsTxt?: boolean;
  useSitemap?: boolean;
  includeExternalLinks?: boolean;
  checkExposedPaths?: boolean;
  checkAssets?: boolean;
  userAgent?: string;
  scanId?: string;
  writeReports?: boolean;
  onProgress?: (event: {
    type: string;
    pagesScanned?: number;
    message?: string;
  }) => void;
  signal?: AbortSignal;
};

export type LibraryScanResult = {
  scanId: string;
  startUrl: string;
  startedAt: string;
  completedAt: string;
  status: 'completed' | 'failed' | 'cancelled' | 'partial';
  pagesScanned: number;
  overallScore: number;
  grade: string;
  findings: unknown[];
  recommendations: unknown[];
  summary?: Record<string, unknown>;
  error?: string;
  report?: unknown;
};

type ScannerLib = {
  scan: (request: LibraryScanRequest) => Promise<LibraryScanResult>;
  scoreToGrade: (score: number) => string;
};

let cached: ScannerLib | null = null;

export function getScannerLibrary(): ScannerLib {
  if (cached) return cached;

  const root =
    process.env.QA_LAB_SCANNER_ROOT ||
    join(process.cwd(), '..', 'src', 'lib');

  // CommonJS require — scanner stays CJS by design
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const lib = require(root) as ScannerLib;

  if (typeof lib.scan !== 'function') {
    throw new Error(
      `Scanner library not found or invalid at ${root}. Set QA_LAB_SCANNER_ROOT if needed.`,
    );
  }

  cached = lib;
  return lib;
}
