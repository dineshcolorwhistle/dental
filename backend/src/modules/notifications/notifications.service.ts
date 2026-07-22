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
    const subject =
      this.configService.get<string>('VAPID_SUBJECT') ||
      'mailto:admin@dental.com';

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
   * Helper to translate notification title and message into Spanish.
   */
  private translateNotification(
    title: string,
    message: string,
  ): { title: string; message: string } {
    let translatedTitle = title;
    let translatedMessage = message;

    if (title === 'New Work Order from Clinic' || title === 'New WO from Clinic') {
      translatedTitle = 'Nueva WO de Clínica';
      const regexNew = /^(?:Work Order|WO) "([^"]+)" \((?:Patient: )?([^)]+)\) (?:has been received|received) from (?:the )?Clinic(?: application)?\.?$/;
      const match = message.match(regexNew);
      if (match) {
        const [, folioNumber, patient] = match;
        translatedMessage = `WO "${folioNumber}" (${patient}) recibida de Clínica.`;
      }
    } else if (title === 'New Work Order Assigned' || title === 'WO Assigned') {
      translatedTitle = 'WO Asignada';
      const regexNew = /^(?:You have been assigned|Assigned) to "([^"]+)" for (?:work order|WO) ([^\s]+) \((?:Patient: )?([^)]+)\)(?: \(Box: ([^)]+)\))?\.?$/;
      const match = message.match(regexNew);
      if (match) {
        const [, processName, folioNumber, patient, boxNumber] = match;
        translatedMessage = `Asignado a "${processName}" para WO ${folioNumber} (${patient})${boxNumber ? ` (Caja: ${boxNumber})` : ''}.`;
      }
    } else if (title === 'Work Order Flagged for Rework' || title === 'WO Rework Flagged') {
      translatedTitle = 'WO para Retrabajo';
      const regexNew = /^(?:Work Order|WO) "([^"]+)" (?:has been flagged|flagged) for rework\.?(?: Please review step| at step)? "([^"]+)"\.?$/;
      const match = message.match(regexNew);
      if (match) {
        const [, folioNumber, processName] = match;
        translatedMessage = `WO "${folioNumber}" marcada para retrabajo en paso "${processName}".`;
      }
    } else if (title === 'Work Order Repetition Triggered' || title === 'WO Repetition Triggered') {
      translatedTitle = 'Repetición de WO Activada';
      const regexNew = /^(?:Work Order|WO) "([^"]+)" (?:has been restarted due to a repetition request from|restarted from) (?:verification step )?"([^"]+)"\.? (?:Please restart|Restart)(?: step)? "([^"]+)"\.?$/;
      const match = message.match(regexNew);
      if (match) {
        const [, folioNumber, verificationName, processName] = match;
        translatedMessage = `WO "${folioNumber}" reiniciada por "${verificationName}". Reiniciar paso "${processName}".`;
      }
    } else if (title === 'Verification Pending Alert' || title === 'Internal Verification Pending Alert' || title === 'Verification Pending') {
      translatedTitle = 'Verificación Pendiente';
      const regexNew = /^(?:Work Order|WO) "([^"]+)"(?:\s*\(Box:\s*([^)]+)\))? (?:requires|needs) (?:internal )?(?:verification step|verification) "([^"]+)"\.?$/;
      const match = message.match(regexNew);
      if (match) {
        const [, folioNumber, boxNumber, processName] = match;
        translatedMessage = `WO "${folioNumber}"${boxNumber ? ` (Caja: ${boxNumber})` : ''} requiere verificación "${processName}".`;
      }
    } else if (title === 'New Active Work Order Step' || title === 'WO Step Ready') {
      translatedTitle = 'Paso de WO Listo';
      const regexNew = /^(?:Work Order|WO) "([^"]+)"(?:\s*\(Box:\s*([^)]+)\))? (?:is ready for you|is ready|ready)\.? (?:The previous|Previous) (?:step "([^"]+)"|verification step) (?:has been completed|completed)\.?$/;
      const match = message.match(regexNew);
      if (match) {
        const [, folioNumber, boxNumber, processName] = match;
        if (processName) {
          translatedMessage = `WO "${folioNumber}"${boxNumber ? ` (Caja: ${boxNumber})` : ''} lista. Paso anterior "${processName}" completado.`;
        } else {
          translatedMessage = `WO "${folioNumber}"${boxNumber ? ` (Caja: ${boxNumber})` : ''} lista. Paso de verificación anterior completado.`;
        }
      }
    } else if (title === 'Work Order Completed' || title === 'WO Completed') {
      translatedTitle = 'WO Completada';
      const regexNew = /^(?:Work Order|WO) "([^"]+)"(?:\s*\(Box:\s*([^)]+)\))? (?:has been fully completed|completed)!?$/;
      const match = message.match(regexNew);
      if (match) {
        const [, folioNumber, boxNumber] = match;
        translatedMessage = `¡WO "${folioNumber}"${boxNumber ? ` (Caja: ${boxNumber})` : ''} completada!`;
      }
    } else if (title === 'Limit Upgrade Request') {
      translatedTitle = 'Solicitud de aumento de límite';
      const regex = /^Owner (.+?) \((.+?)\) requested (?:a limits|limit) upgrade: (.*)$/;
      const match = message.match(regex);
      if (match) {
        const [, userName, tenantName, detailMessage] = match;
        translatedMessage = `Propietario ${userName} (${tenantName}) solicitó aumento de límite: ${detailMessage}`;
      }
    }

    return { title: translatedTitle, message: translatedMessage };
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
    // Retrieve recipient's language preference
    const recipient = await this.prisma.user.findUnique({
      where: { id: data.userId },
      select: { preferredLanguage: true },
    });
    const lang = recipient?.preferredLanguage || 'ES';

    let finalTitle = data.title;
    let finalMessage = data.message;

    if (lang === 'ES') {
      const translated = this.translateNotification(data.title, data.message);
      finalTitle = translated.title;
      finalMessage = translated.message;
    }

    const notification = await this.prisma.notification.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId,
        title: finalTitle,
        message: finalMessage,
        type: data.type || 'INFO',
        referenceId: data.referenceId,
      },
    });

    this.logger.log(
      `Notification created for user ${data.userId}: ${finalTitle}`,
    );

    // Broadcast in real-time
    this.websocketsGateway.sendToUser(
      data.userId,
      'notification_created',
      notification,
    );

    // Queue push notification
    try {
      const subscriptions = await this.prisma.pushSubscription.findMany({
        where: { userId: data.userId },
      });

      if (subscriptions.length > 0) {
        const payload = JSON.stringify({
          notification: {
            title: finalTitle,
            body: finalMessage,
            data: {
              url:
                data.type === 'REWORK' ||
                data.type === 'REPETITION' ||
                data.type === 'ASSIGNED'
                  ? data.referenceId
                    ? `/work-orders/${data.referenceId}`
                    : '/dashboard'
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

  /**
   * Delete all read notifications for the current user.
   */
  async removeAllRead(tenantId: string, userId: string) {
    await this.prisma.notification.deleteMany({
      where: { tenantId, userId, isRead: true },
    });
    return { success: true };
  }
}
