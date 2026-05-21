import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Send an owner invitation email with a password-reset link.
   */
  async sendOwnerInvite(
    email: string,
    ownerName: string,
    tenantName: string,
    resetToken: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: `Welcome to ${tenantName} — Set Up Your Account`,
        template: 'owner-invite',
        context: {
          ownerName,
          tenantName,
          resetLink,
          year: new Date().getFullYear(),
        },
      });

      this.logger.log(`Owner invite email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send owner invite email to ${email}`, error);
      // Don't throw — tenant creation should still succeed even if email fails
    }
  }
}
