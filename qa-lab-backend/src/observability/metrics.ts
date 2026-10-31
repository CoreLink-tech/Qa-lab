/**
 * Minimal in-process Prometheus text metrics (no extra dependency).
 * Multi-instance: each process exposes its own series; aggregate at scrape layer.
 */

class Counter {
  private readonly values = new Map<string, number>();

  inc(method: string, status: number, by = 1): void {
    const key = `${method}|${status}`;
    this.values.set(key, (this.values.get(key) || 0) + by);
  }

  render(name: string, help: string): string {
    const lines = [`# HELP ${name} ${help}`, `# TYPE ${name} counter`];
    for (const [key, val] of this.values) {
      const [method, status] = key.split('|');
      lines.push(
        `${name}{method="${method}",status="${status}"} ${val}`,
      );
    }
    return lines.join('\n');
  }
}

class HistogramLite {
  private count = 0;
  private sum = 0;
  private readonly buckets = [50, 100, 250, 500, 1000, 2500, 5000, 10000];
  private readonly counts: number[];

  constructor() {
    this.counts = this.buckets.map(() => 0);
  }

  observe(ms: number): void {
    this.count += 1;
    this.sum += ms;
    for (let i = 0; i < this.buckets.length; i++) {
      if (ms <= this.buckets[i]) this.counts[i] += 1;
    }
  }

  render(name: string, help: string): string {
    const lines = [`# HELP ${name} ${help}`, `# TYPE ${name} histogram`];
    let cumulative = 0;
    for (let i = 0; i < this.buckets.length; i++) {
      cumulative += this.counts[i];
      lines.push(
        `${name}_bucket{le="${this.buckets[i]}"} ${cumulative}`,
      );
    }
    lines.push(`${name}_bucket{le="+Inf"} ${this.count}`);
    lines.push(`${name}_sum ${this.sum}`);
    lines.push(`${name}_count ${this.count}`);
    return lines.join('\n');
  }
}

export const metrics = {
  httpRequests: new Counter(),
  httpDuration: new HistogramLite(),
  scansCompleted: { value: 0, inc() { this.value += 1; } },
  scansFailed: { value: 0, inc() { this.value += 1; } },

  render(): string {
    return [
      this.httpRequests.render(
        'qa_lab_http_requests_total',
        'HTTP requests by method and status',
      ),
      this.httpDuration.render(
        'qa_lab_http_request_duration_ms',
        'HTTP request duration in milliseconds',
      ),
      `# HELP qa_lab_scans_completed_total Completed scans`,
      `# TYPE qa_lab_scans_completed_total counter`,
      `qa_lab_scans_completed_total ${this.scansCompleted.value}`,
      `# HELP qa_lab_scans_failed_total Failed scans`,
      `# TYPE qa_lab_scans_failed_total counter`,
      `qa_lab_scans_failed_total ${this.scansFailed.value}`,
      '',
    ].join('\n');
  },
};
