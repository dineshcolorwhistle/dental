import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as webpush from 'web-push';

@Processor('push-notification-queue')
@Injectable()
export class PushNotificationQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(PushNotificationQueueProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing push notification job ${job.id} for user ${job.data.userId}...`);
    const { subscriptionId, subscription, payload } = job.data;

    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            auth: subscription.auth,
            p256dh: subscription.p256dh,
          },
        },
        payload,
      );
      this.logger.log(`Push notification sent successfully to subscription ${subscriptionId}`);
    } catch (error: any) {
      // If the subscription is no longer valid (e.g. 410 Gone or 404 Not Found), remove it from our database
      if (error.statusCode === 410 || error.statusCode === 404) {
        this.logger.warn(
          `Subscription ${subscriptionId} is no longer active (Status ${error.statusCode}). Deleting from database.`,
        );
        try {
          await this.prisma.pushSubscription.delete({
            where: { id: subscriptionId },
          });
        } catch (dbErr) {
          this.logger.error(`Failed to delete expired subscription ${subscriptionId}`, dbErr);
        }
      } else {
        this.logger.error(
          `Failed to send push notification to subscription ${subscriptionId}: ${error.message}`,
          error,
        );
        throw error; // Let BullMQ retry for other temporary failures
      }
    }
  }
}
