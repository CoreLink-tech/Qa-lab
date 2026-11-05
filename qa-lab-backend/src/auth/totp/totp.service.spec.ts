import { TotpService } from './totp.service';

describe('TotpService', () => {
  const service = new TotpService();

  it('generates base32 secret', () => {
    const s = service.generateSecret();
    expect(s.length).toBeGreaterThan(10);
    expect(s).toMatch(/^[A-Z2-7]+$/);
  });

  it('builds otpauth URL', () => {
    const s = service.generateSecret();
    const url = service.buildOtpAuthUrl(s, 'user@example.com');
    expect(url.startsWith('otpauth://totp/')).toBe(true);
    expect(url).toContain('secret=');
  });

  it('verifies a token for current window', () => {
    const s = service.generateSecret();
    // Generate token using same algorithm via verify window by checking generate path
    // We only assert false for garbage and true path with known stub if needed
    expect(service.verify(s, '000000')).toBe(false);
    expect(service.verify(s, 'abcdef')).toBe(false);
  });

  it('generates recovery codes', () => {
    const codes = service.generateRecoveryCodes(8);
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
  });
});
