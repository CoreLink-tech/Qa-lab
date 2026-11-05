import { BadRequestException } from '@nestjs/common';
import { assertSafeExternalUrl } from './assert-safe-url';

/**
 * SSRF matrix at the backend boundary (assertSafeExternalUrl).
 * These inputs must be rejected; tests fail if the guard is removed.
 */
describe('assertSafeExternalUrl SSRF matrix', () => {
  const blocked = [
    'http://127.0.0.1/',
    'http://[::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://[::ffff:169.254.169.254]/',
    'http://169.254.169.254/latest/meta-data/',
    'http://198.18.0.1/',
    'http://localhost/',
    'http://0.0.0.0/',
    'http://10.0.0.1/',
    'http://192.168.1.1/',
    'http://172.16.0.1/',
    'ftp://example.com/',
    'file:///etc/passwd',
    'https://user:pass@example.com/',
    'https://example.com:22/',
    'https://example.com:6379/',
    'https://example.com:5432/',
  ];

  for (const url of blocked) {
    it(`rejects ${url}`, async () => {
      await expect(assertSafeExternalUrl(url)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  }

  it('accepts a public IPv4 literal HTTPS URL', async () => {
    const href = await assertSafeExternalUrl('https://1.1.1.1/');
    expect(href).toContain('1.1.1.1');
  });
});
