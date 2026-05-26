import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

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

    this.logger.log(`Notification created for user ${data.userId}: ${data.title}`);
    return notification;
  }

  /**
   * Get all notifications for the current user (newest first).
   */
  async findAllForUser(tenantId: string, userId: string) {
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
}
