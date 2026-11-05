import { fork, type ChildProcess } from 'child_process';
import { join } from 'path';

export type ScanChildRequest = {
  startUrl: string;
  scanId: string;
  maxPages: number;
  maxDepth: number;
  concurrency: number;
  respectRobotsTxt: boolean;
  checkExposedPaths: boolean;
  checkAssets: boolean;
  timeoutMs: number;
};

/**
 * Run scanner in a child process so a runaway scan cannot exhaust the
 * worker Node heap. The child is killed on wall-clock timeout.
 */
export function runScanInChild(payload: ScanChildRequest): Promise<{
  status: string;
  pagesScanned?: number;
  error?: string;
  [k: string]: unknown;
}> {
  return new Promise((resolve, reject) => {
    const script = join(__dirname, 'scan-child-entrypoint.js');
    const child: ChildProcess = fork(script, [], {
      env: {
        ...process.env,
        QA_LAB_SCANNER_ROOT:
          process.env.QA_LAB_SCANNER_ROOT ||
          join(process.cwd(), '..', 'src', 'lib'),
      },
      serialization: 'json',
    });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Scan child exceeded ${payload.timeoutMs}ms`));
    }, payload.timeoutMs);

    child.on(
      'message',
      (msg: { ok?: boolean; result?: unknown; error?: string }) => {
        clearTimeout(timer);
        if (msg.error || msg.ok === false) {
          reject(new Error(msg.error || 'Scan child failed'));
          return;
        }
        resolve(
          (msg.result || { status: 'failed' }) as {
            status: string;
            pagesScanned?: number;
            error?: string;
          },
        );
      },
    );

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      if (code !== 0 && code !== null) {
        reject(new Error(`Scan child exited code=${code} signal=${signal}`));
      }
    });

    child.send(payload);
  });
}
