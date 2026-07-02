import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Helper to get user preferred language by email
   */
  private async getUserLanguage(email: string): Promise<'EN' | 'ES'> {
    try {
      const user = await this.prisma.user.findFirst({
        where: { email },
        select: { preferredLanguage: true },
      });
      return user?.preferredLanguage || 'ES'; // Default to ES (Spanish)
    } catch {
      return 'ES'; // Fallback to ES
    }
  }

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
    const lang = await this.getUserLanguage(email);

    const subject = lang === 'ES' 
      ? `Bienvenido a ${tenantName} — Configura tu cuenta`
      : `Welcome to ${tenantName} — Set Up Your Account`;
    
    const template = lang === 'ES' ? 'owner-invite-es' : 'owner-invite';

    try {
      await this.mailerService.sendMail({
        to: email,
        subject,
        template,
        context: {
          ownerName,
          tenantName,
          resetLink,
          year: new Date().getFullYear(),
        },
      });

      this.logger.log(`Owner invite email sent to ${email} (Lang: ${lang})`);
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
    const lang = await this.getUserLanguage(email);

    const subject = lang === 'ES'
      ? `Bienvenido a ${tenantName} — Configura tu cuenta de administrador`
      : `Welcome to ${tenantName} — Set Up Your Admin Account`;

    const template = lang === 'ES' ? 'admin-invite-es' : 'admin-invite';

    try {
      await this.mailerService.sendMail({
        to: email,
        subject,
        template,
        context: {
          adminName,
          tenantName,
          branchName,
          resetLink,
          year: new Date().getFullYear(),
        },
      });

      this.logger.log(`Admin invite email sent to ${email} (Lang: ${lang})`);
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
    const lang = await this.getUserLanguage(email);

    const subject = lang === 'ES'
      ? `Bienvenido a ${tenantName} — Configura tu cuenta de técnico`
      : `Welcome to ${tenantName} — Set Up Your Technician Account`;

    const template = lang === 'ES' ? 'technician-invite-es' : 'technician-invite';

    try {
      await this.mailerService.sendMail({
        to: email,
        subject,
        template,
        context: {
          technicianName,
          tenantName,
          branchName,
          resetLink,
          year: new Date().getFullYear(),
        },
      });

      this.logger.log(`Technician invite email sent to ${email} (Lang: ${lang})`);
    } catch (error) {
      this.logger.error(
        `Failed to send technician invite email to ${email}`,
        error,
      );
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
