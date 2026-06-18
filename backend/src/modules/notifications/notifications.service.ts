import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WebsocketsGateway } from '../websockets/websockets.gateway';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as webpush from 'web-push';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly websocketsGateway: WebsocketsGateway,
    private readonly configService: ConfigService,
    @InjectQueue('push-notification-queue')
    private readonly pushQueue: Queue,
  ) {}

  onModuleInit() {
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.configService.get<string>('VAPID_SUBJECT') || 'mailto:admin@dental.com';

    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.logger.log('VAPID details configured successfully.');
    } else {
      this.logger.warn(
        'VAPID keys are missing. Web push notifications will be disabled.',
      );
    }
  }

  getVapidPublicKey() {
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    return { publicKey: publicKey || null };
  }

  async saveSubscription(
    userId: string,
    data: { endpoint: string; auth: string; p256dh: string },
  ) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: data.endpoint },
      update: {
        userId,
        auth: data.auth,
        p256dh: data.p256dh,
      },
      create: {
        userId,
        endpoint: data.endpoint,
        auth: data.auth,
        p256dh: data.p256dh,
      },
    });
    return { success: true };
  }

  async deleteSubscription(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
    return { success: true };
  }

  /**
   * Create an in-app notification for a specific user.
   */
  async create(data: {
    tenantId: string;
    userId: string;
    title: string;
    message: string;
    type?: string;
    referenceId?: string;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type || 'INFO',
        referenceId: data.referenceId,
      },
    });

    this.logger.log(
      `Notification created for user ${data.userId}: ${data.title}`,
    );

    // Broadcast in real-time
    this.websocketsGateway.sendToUser(data.userId, 'notification_created', notification);

    // Queue push notification
    try {
      const subscriptions = await this.prisma.pushSubscription.findMany({
        where: { userId: data.userId },
      });

      if (subscriptions.length > 0) {
        const payload = JSON.stringify({
          notification: {
            title: data.title,
            body: data.message,
            data: {
              url: data.type === 'REWORK' || data.type === 'REPETITION' || data.type === 'ASSIGNED'
                ? (data.referenceId ? `/work-orders/${data.referenceId}` : '/dashboard')
                : '/dashboard',
            },
          },
        });

        for (const sub of subscriptions) {
          await this.pushQueue.add(
            'send-push',
            {
              subscriptionId: sub.id,
              userId: data.userId,
              subscription: {
                endpoint: sub.endpoint,
                auth: sub.auth,
                p256dh: sub.p256dh,
              },
              payload,
            },
            {
              removeOnComplete: true,
              removeOnFail: 100,
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 5000,
              },
            },
          );
        }
      }
    } catch (pushErr) {
      this.logger.error(
        `Failed to queue push notifications for user ${data.userId}`,
        pushErr,
      );
    }

    return notification;
  }

  /**
   * Get all notifications for the current user (newest first).
   */
  async findAllForUser(tenantId: string, userId: string) {
    // Automatic cleanup of read notifications older than 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    try {
      await this.prisma.notification.deleteMany({
        where: {
          tenantId,
          userId,
          isRead: true,
          createdAt: { lt: sevenDaysAgo },
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to clean up old read notifications for user ${userId}`,
        err,
      );
    }

    return this.prisma.notification.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Get count of unread notifications.
   */
  async getUnreadCount(tenantId: string, userId: string) {
    const count = await this.prisma.notification.count({
      where: { tenantId, userId, isRead: false },
    });
    return { count };
  }

  /**
   * Mark a single notification as read.
   */
  async markAsRead(tenantId: string, userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, tenantId, userId },
      data: { isRead: true },
    });
    return { success: true };
  }

  /**
   * Mark all notifications for the user as read.
   */
  async markAllAsRead(tenantId: string, userId: string) {
    await this.prisma.notification.updateMany({
      where: { tenantId, userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }

  /**
   * Manually delete a notification.
   */
  async remove(tenantId: string, userId: string, id: string) {
    await this.prisma.notification.deleteMany({
      where: { id, tenantId, userId },
    });
    return { success: true };
  }
}
