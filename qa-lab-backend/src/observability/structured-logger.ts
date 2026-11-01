import { LoggerService } from '@nestjs/common';

/**
 * JSON structured logger with secret redaction.
 * No extra dependency — Nest-compatible LoggerService.
 */
const REDACT_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'key',
  'secret',
  'jwt',
]);

function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[MaxDepth]';
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACT_KEYS.has(k.toLowerCase())) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redact(v, depth + 1);
      }
    }
    return out;
  }
  if (typeof value === 'string' && value.startsWith('qalab_')) {
    return 'qalab_[REDACTED]';
  }
  return value;
}

export class StructuredLogger implements LoggerService {
  constructor(private readonly context?: string) {}

  private write(
    level: string,
    message: unknown,
    ...optionalParams: unknown[]
  ): void {
    const payload: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      context: this.context,
      message: typeof message === 'string' ? message : redact(message),
    };
    if (optionalParams.length) {
      payload.meta = redact(
        optionalParams.length === 1 ? optionalParams[0] : optionalParams,
      );
    }

    console.log(JSON.stringify(payload));
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, ...optionalParams);
  }
  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, ...optionalParams);
  }
  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, ...optionalParams);
  }
  debug?(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, ...optionalParams);
  }
  verbose?(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, ...optionalParams);
  }
}
