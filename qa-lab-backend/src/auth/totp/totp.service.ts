import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';

/**
 * TOTP (RFC 6238) helpers — enrollment, verify, recovery codes.
 * Secrets should be encrypted at rest before persistence (caller responsibility).
 * Required for OWNER/ADMIN in product policy (enforcement wired when enrollment UI lands).
 */
@Injectable()
export class TotpService {
  generateSecret(bytes = 20): string {
    return base32Encode(randomBytes(bytes));
  }

  buildOtpAuthUrl(
    secret: string,
    accountName: string,
    issuer = 'QA Lab',
  ): string {
    const label = encodeURIComponent(`${issuer}:${accountName}`);
    const q = new URLSearchParams({
      secret,
      issuer,
      algorithm: 'SHA1',
      digits: '6',
      period: '30',
    });
    return `otpauth://totp/${label}?${q.toString()}`;
  }

  verify(secret: string, token: string, window = 1): boolean {
    const clean = (token || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(clean)) return false;
    const step = Math.floor(Date.now() / 1000 / 30);
    for (let w = -window; w <= window; w++) {
      if (generateTotp(secret, step + w) === clean) return true;
    }
    return false;
  }

  generateRecoveryCodes(count = 8): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(randomBytes(5).toString('hex'));
    }
    return codes;
  }
}

function generateTotp(secret: string, step: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(step / 2 ** 32), 0);
  buf.writeUInt32BE(step & 0xffff_ffff, 4);
  const hmac = createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** 6).padStart(6, '0');
}

function base32Encode(buf: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = input.replace(/=+$/, '').toUpperCase().replace(/[\s-]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of cleaned) {
    const idx = alphabet.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
