/**
 * Child process entry for isolated scan runs.
 * Receives ScanChildRequest via IPC and replies with result.
 */
import { getScannerLibrary } from './scanner-bridge';

process.on(
  'message',
  (payload: {
    startUrl: string;
    scanId: string;
    maxPages: number;
    maxDepth: number;
    concurrency: number;
    respectRobotsTxt: boolean;
    checkExposedPaths: boolean;
    checkAssets: boolean;
  }) => {
    void (async () => {
      try {
        const { scan } = getScannerLibrary();
        const controller = new AbortController();
        const result = await scan({
          startUrl: payload.startUrl,
          scanId: payload.scanId,
          maxPages: payload.maxPages,
          maxDepth: payload.maxDepth,
          concurrency: payload.concurrency,
          respectRobotsTxt: payload.respectRobotsTxt,
          checkExposedPaths: payload.checkExposedPaths,
          checkAssets: payload.checkAssets,
          writeReports: false,
          signal: controller.signal,
        });
        process.send?.({ ok: true, result });
        process.exit(0);
      } catch (err) {
        process.send?.({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
        process.exit(1);
      }
    })();
  },
);
