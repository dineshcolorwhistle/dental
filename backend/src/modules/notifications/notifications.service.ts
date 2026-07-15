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

    if (title === 'New Work Order from Clinic') {
      translatedTitle = 'Nueva orden de trabajo de la clínica';
      // Match: Work Order "WO-0001" (Patient: John Doe) has been received from the Clinic application.
      const regex =
        /^Work Order "([^"]+)" \(Patient: ([^)]+)\) has been received from the Clinic application\.?$/;
      const match = message.match(regex);
      if (match) {
        const [, folioNumber, patient] = match;
        translatedMessage = `La orden de trabajo "${folioNumber}" (Paciente: ${patient}) ha sido recibida desde la aplicación de la clínica.`;
      }
    } else if (title === 'New Work Order Assigned') {
      translatedTitle = 'Nueva orden de trabajo asignada';
      // Match: You have been assigned to "Metal Casting" for work order WO-0001 (Patient: John Doe) (Box: 12).
      // or without box: You have been assigned to "Metal Casting" for work order WO-0001 (Patient: John Doe).
      const regex =

        /^You have been assigned to "([^"]+)" for work order ([^\s]+) \(Patient: ([^)]+)\)(?: \(Box: ([^)]+)\))?\.?$/;
      const match = message.match(regex);
      if (match) {
        const [, processName, folioNumber, patient, boxNumber] = match;
        translatedMessage = `Se le ha asignado a "${processName}" para la orden de trabajo ${folioNumber} (Paciente: ${patient})${boxNumber ? ` (Caja: ${boxNumber})` : ''}.`;
      }
    } else if (title === 'Work Order Flagged for Rework') {
      translatedTitle = 'Orden de trabajo marcada para retrabajo';
      // Match: Work Order "WO-0001" has been flagged for rework. Please review step "Metal Casting".
      const regex =
        /^Work Order "([^"]+)" has been flagged for rework\. Please review step "([^"]+)"\.?$/;
      const match = message.match(regex);
      if (match) {
        const [, folioNumber, processName] = match;
        translatedMessage = `La orden de trabajo "${folioNumber}" ha sido marcada para retrabajo. Por favor, revise el paso "${processName}".`;
      }
    } else if (title === 'Work Order Repetition Triggered') {
      translatedTitle = 'Repetición de orden de trabajo activada';
      // Match: Work Order "WO-0001" has been restarted due to a repetition request from verification step "Quality Check". Please restart step "Waxing".
      const regex =
        /^Work Order "([^"]+)" has been restarted due to a repetition request from verification step "([^"]+)". Please restart step "([^"]+)"\.?$/;
      const match = message.match(regex);
      if (match) {
        const [, folioNumber, verificationName, processName] = match;
        translatedMessage = `La orden de trabajo "${folioNumber}" se ha reiniciado debido a una solicitud de repetición del paso de verificación "${verificationName}". Por favor, reinicie el paso "${processName}".`;
      }
    } else if (title === 'Verification Pending Alert') {
      translatedTitle = 'Alerta de verificación pendiente';
      // Match: Work Order "WO-0001" (Box: 12) requires verification step "Visual Check".
      // or without box: Work Order "WO-0001" requires verification step "Visual Check".
      const regex =
        /^Work Order "([^"]+)"(?:\s*\(Box:\s*([^)]+)\))? requires verification step "([^"]+)"\.?$/;
      const match = message.match(regex);
      if (match) {
        const [, folioNumber, boxNumber, processName] = match;
        translatedMessage = `La orden de trabajo "${folioNumber}"${boxNumber ? ` (Caja: ${boxNumber})` : ''} requiere el paso de verificación "${processName}".`;
      }
    } else if (title === 'New Active Work Order Step') {
      translatedTitle = 'Nuevo paso activo de orden de trabajo';
      // Match: Work Order "WO-0001" (Box: 12) is ready for you. The previous step "Waxing" has been completed.
      // or without box: Work Order "WO-0001" is ready for you. The previous step "Waxing" has been completed.
      // or with verification step complete: Work Order "WO-0001" (Box: 12) is ready for you. The previous verification step has been completed.
      // or without box: Work Order "WO-0001" is ready for you. The previous verification step has been completed.
      const regex =
        /^Work Order "([^"]+)"(?:\s*\(Box:\s*([^)]+)\))? is ready for you\. The previous (?:step "([^"]+)"|verification step) has been completed\.?$/;
      const match = message.match(regex);
      if (match) {
        const [, folioNumber, boxNumber, processName] = match;
        if (processName) {
          translatedMessage = `La orden de trabajo "${folioNumber}"${boxNumber ? ` (Caja: ${boxNumber})` : ''} está lista para usted. El paso anterior "${processName}" ha sido completado.`;
        } else {
          translatedMessage = `La orden de trabajo "${folioNumber}"${boxNumber ? ` (Caja: ${boxNumber})` : ''} está lista para usted. El paso de verificación anterior ha sido completado.`;
        }
      }
    } else if (title === 'Work Order Completed') {
      translatedTitle = 'Orden de trabajo completada';
      // Match: Work Order "WO-0001" (Box: 12) has been fully completed!
      // or without box: Work Order "WO-0001" has been fully completed!
      const regex =
        /^Work Order "([^"]+)"(?:\s*\(Box:\s*([^)]+)\))? has been fully completed!?$/;
      const match = message.match(regex);
      if (match) {
        const [, folioNumber, boxNumber] = match;
        translatedMessage = `¡La orden de trabajo "${folioNumber}"${boxNumber ? ` (Caja: ${boxNumber})` : ''} ha sido completada por completo!`;
      }
    } else if (title === 'Limit Upgrade Request') {
      translatedTitle = 'Solicitud de aumento de límite';
      const regex = /^Owner (.+?) \((.+?)\) requested a limits upgrade: (.*)$/;
      const match = message.match(regex);
      if (match) {
        const [, userName, tenantName, detailMessage] = match;
        translatedMessage = `El propietario ${userName} (${tenantName}) solicitó un aumento de límite: ${detailMessage}`;
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
}
