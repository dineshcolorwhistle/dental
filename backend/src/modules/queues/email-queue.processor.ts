import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../mail/mail.service';

@Processor('email-queue')
@Injectable()
export class EmailQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailQueueProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}...`);
    const data = job.data;

    try {
      switch (job.name) {
        case 'send-owner-invite':
          await this.mailService.sendOwnerInvite(
            data.email,
            data.ownerName,
            data.tenantName,
            data.resetToken,
            data.subdomain,
          );
          break;
        case 'send-admin-invite':
          await this.mailService.sendAdminInvite(
            data.email,
            data.adminName,
            data.tenantName,
            data.branchName,
            data.resetToken,
            data.subdomain,
          );
          break;
        case 'send-technician-invite':
          await this.mailService.sendTechnicianInvite(
            data.email,
            data.technicianName,
            data.tenantName,
            data.branchName,
            data.resetToken,
            data.subdomain,
          );
          break;
        default:
          this.logger.warn(`Unknown job type: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to process email job ${job.id} (${job.name}):`,
        error,
      );
      throw error; // Let BullMQ handle retries
    }
  }
}
