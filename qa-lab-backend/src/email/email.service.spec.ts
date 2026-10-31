import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

describe('EmailService', () => {
  it('logs in log mode without throwing', async () => {
    const config = {
      get: (key: string) => {
        if (key === 'email.mode') return 'log';
        if (key === 'email.from') return 'test@localhost';
        return undefined;
      },
    } as unknown as ConfigService;

    const service = new EmailService(config);
    service.onModuleInit();
    await expect(
      service.send({
        to: 'user@example.com',
        subject: 'Hello',
        text: 'Body',
      }),
    ).resolves.toBeUndefined();
  });

  it('falls back to log when smtp mode lacks host', async () => {
    const config = {
      get: (key: string) => {
        if (key === 'email.mode') return 'smtp';
        if (key === 'email.smtp.host') return '';
        return undefined;
      },
    } as unknown as ConfigService;

    const service = new EmailService(config);
    service.onModuleInit();
    await expect(
      service.send({
        to: 'user@example.com',
        subject: 'Hello',
        text: 'Body',
      }),
    ).resolves.toBeUndefined();
  });
});
