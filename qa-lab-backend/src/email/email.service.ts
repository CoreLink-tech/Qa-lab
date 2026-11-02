import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Email delivery.
 * - EMAIL_MODE=log (default): log only — safe for local/dev.
 * - EMAIL_MODE=smtp: deliver via nodemailer using SMTP_* env vars.
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: import('nodemailer').Transporter | null = null; // eslint-disable-line @typescript-eslint/no-redundant-type-constituents
  private mode: string = 'log';
  private fromAddress = 'noreply@localhost';

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.mode = this.config.get<string>('email.mode') || 'log';
    this.fromAddress =
      this.config.get<string>('email.from') || 'QA Lab <noreply@localhost>';

    if (this.mode === 'smtp') {
      this.initSmtp();
    } else if (this.mode !== 'log') {
      this.logger.warn(
        `Unknown email.mode="${this.mode}"; falling back to log`,
      );
      this.mode = 'log';
    }
  }

  private initSmtp(): void {
    const host = this.config.get<string>('email.smtp.host');
    const port = this.config.get<number>('email.smtp.port') ?? 587;
    const user = this.config.get<string>('email.smtp.user');
    const pass = this.config.get<string>('email.smtp.pass');
    const secure = this.config.get<boolean>('email.smtp.secure') === true;

    if (!host) {
      this.logger.error(
        'EMAIL_MODE=smtp but SMTP_HOST is missing — falling back to log',
      );
      this.mode = 'log';
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
      const nodemailer = require('nodemailer') as typeof import('nodemailer');
      /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: user ? { user, pass: pass || '' } : undefined,
      });
      this.logger.log(
        `SMTP email adapter ready (host=${host} port=${port} secure=${secure})`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to init SMTP transporter: ${(err as Error).message} — falling back to log`,
      );
      this.mode = 'log';
      this.transporter = null;
    }
  }

  async send(message: EmailMessage): Promise<void> {
    if (this.mode === 'smtp' && this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: this.fromAddress,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
        this.logger.log(
          `email sent to=${message.to} subject=${message.subject} id=${(info as { messageId?: string }).messageId || 'n/a'}`,
        );
        return;
      } catch (err) {
        this.logger.error(
          `SMTP send failed to=${message.to}: ${(err as Error).message}`,
        );
        throw err;
      }
    }

    this.logger.log(
      `[email:log] to=${message.to} subject=${message.subject}\n${message.text}`,
    );
  }
}
