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
    subdomain: string,
  ): Promise<void> {
    const frontendUrl = this.buildSubdomainUrl(subdomain);
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

  /**
   * Send an admin invitation email with a password-reset link.
   */
  async sendAdminInvite(
    email: string,
    adminName: string,
    tenantName: string,
    branchName: string,
    resetToken: string,
    subdomain: string,
  ): Promise<void> {
    const frontendUrl = this.buildSubdomainUrl(subdomain);
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: `Welcome to ${tenantName} — Set Up Your Admin Account`,
        template: 'admin-invite',
        context: {
          adminName,
          tenantName,
          branchName,
          resetLink,
          year: new Date().getFullYear(),
        },
      });

      this.logger.log(`Admin invite email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send admin invite email to ${email}`, error);
      // Don't throw — user creation should still succeed even if email fails
    }
  }

  /**
   * Send a technician invitation email with a password-reset link.
   */
  async sendTechnicianInvite(
    email: string,
    technicianName: string,
    tenantName: string,
    branchName: string,
    resetToken: string,
    subdomain: string,
  ): Promise<void> {
    const frontendUrl = this.buildSubdomainUrl(subdomain);
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: `Welcome to ${tenantName} — Set Up Your Technician Account`,
        template: 'technician-invite',
        context: {
          technicianName,
          tenantName,
          branchName,
          resetLink,
          year: new Date().getFullYear(),
        },
      });

      this.logger.log(`Technician invite email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send technician invite email to ${email}`, error);
      // Don't throw — user creation should still succeed even if email fails
    }
  }

  /**
   * Build a subdomain-specific frontend URL.
   * e.g., http://localhost:5173 -> http://happy-dental.localhost:5173
   */
  private buildSubdomainUrl(subdomain: string | null): string {
    const frontendUrl = this.configService.get(
      'FRONTEND_URL',
      'http://localhost:5173',
    );

    if (!subdomain) {
      return frontendUrl;
    }

    try {
      const url = new URL(frontendUrl);
      url.hostname = `${subdomain}.${url.hostname}`;
      return url.toString().replace(/\/$/, '');
    } catch {
      const protoMatch = frontendUrl.match(/^(https?:\/\/)(.*)$/i);
      if (protoMatch) {
        return `${protoMatch[1]}${subdomain}.${protoMatch[2]}`;
      }
      return frontendUrl;
    }
  }
}

