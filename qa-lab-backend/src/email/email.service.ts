import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Email port. Dev/default: log only. Production: set SMTP_* env vars
 * and wire a real transport (nodemailer optional later).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  async send(message: EmailMessage): Promise<void> {
    const mode = this.config.get<string>('email.mode') || 'log';
    if (mode === 'log') {
      this.logger.log(
        `[email:log] to=${message.to} subject=${message.subject}\n${message.text}`,
      );
      return;
    }
    // Placeholder for SMTP provider — do not claim delivery without adapter
    this.logger.warn(
      `email.mode=${mode} but no SMTP adapter configured; logging instead`,
    );
    this.logger.log(
      `[email:fallback] to=${message.to} subject=${message.subject}`,
    );
  }
}
