import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ReminderRecurrence, ReminderStatus } from '@prisma/client';
import {
  getHHmmInTz,
  getDateKeyInTz,
} from '../../common/utils/timezone.util';

@Injectable()
export class RemindersSchedulerService {
  private readonly logger = new Logger(RemindersSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Runs every 5 minutes to check for reminders that need notification
   * (2 hours before scheduled time).
   *
   * Time comparisons now use the tenant's configured timezone so notifications
   * trigger at the correct local time for the client (e.g., Mexico City time).
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleReminderNotifications() {
    try {
      const now = new Date();

      // Get all active (PENDING) reminders with their tenant timezone
      const reminders = await this.prisma.reminder.findMany({
        where: {
          status: ReminderStatus.PENDING,
        },
        include: {
          assignees: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  preferredLanguage: true,
                },
              },
            },
          },
          tenant: {
            select: {
              name: true,
              settings: {
                select: { timezone: true },
              },
            },
          },
        },
      });

      for (const reminder of reminders) {
        // Get the tenant's timezone (fall back to America/Mexico_City)
        const tz =
          (reminder.tenant as any)?.settings?.timezone ||
          'America/Mexico_City';

        // Calculate "2 hours from now" in the tenant's timezone
        const twoHoursFromNow = new Date(
          now.getTime() + 2 * 60 * 60 * 1000,
        );
        const targetHHmm = getHHmmInTz(twoHoursFromNow, tz);

        const shouldNotify = this.shouldSendNotification(
          reminder,
          now,
          targetHHmm,
          tz,
        );

        if (shouldNotify) {
          await this.sendNotificationEmails(reminder);

          // Update lastNotifiedAt
          await this.prisma.reminder.update({
            where: { id: reminder.id },
            data: { lastNotifiedAt: now },
          });

          this.logger.log(
            `Sent reminder notification for "${reminder.title}" (ID: ${reminder.id}) [TZ: ${tz}]`,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error processing reminder notifications', error);
    }
  }

  /**
   * Determine if a reminder should trigger a notification right now.
   * All date comparisons use the tenant's timezone.
   */
  private shouldSendNotification(
    reminder: {
      recurrence: ReminderRecurrence;
      reminderDate: Date | null;
      reminderTime: string;
      lastNotifiedAt: Date | null;
    },
    now: Date,
    targetHHmm: string,
    tz: string,
  ): boolean {
    // Only process if the current 5-min window aligns with the reminder time
    const reminderMinutes = this.parseTimeToMinutes(reminder.reminderTime);
    const targetMinutes = this.parseTimeToMinutes(targetHHmm);

    // Check if we're within a 5-minute window
    if (Math.abs(reminderMinutes - targetMinutes) > 5) {
      return false;
    }

    // Get "today" in the tenant's timezone (YYYY-MM-DD key)
    const todayKey = getDateKeyInTz(now, tz);

    switch (reminder.recurrence) {
      case ReminderRecurrence.ONE_TIME: {
        if (!reminder.reminderDate) return false;
        // Compare reminder date against "today" in tenant's timezone
        const reminderDateKey = getDateKeyInTz(reminder.reminderDate, tz);
        if (reminderDateKey !== todayKey) return false;
        // Check if already notified today
        if (reminder.lastNotifiedAt) {
          const lastNotifiedKey = getDateKeyInTz(
            reminder.lastNotifiedAt,
            tz,
          );
          if (lastNotifiedKey === todayKey) return false;
        }
        return true;
      }

      case ReminderRecurrence.DAILY: {
        // Send every day if not already notified today (in tenant's TZ)
        if (reminder.lastNotifiedAt) {
          const lastNotifiedKey = getDateKeyInTz(
            reminder.lastNotifiedAt,
            tz,
          );
          if (lastNotifiedKey === todayKey) return false;
        }
        return true;
      }

      case ReminderRecurrence.WEEKLY: {
        // Send on same day-of-week if not already notified this week
        if (reminder.lastNotifiedAt) {
          const daysSinceLastNotified = Math.floor(
            (now.getTime() - reminder.lastNotifiedAt.getTime()) /
              (1000 * 60 * 60 * 24),
          );
          if (daysSinceLastNotified < 7) return false;
        }
        return true;
      }

      case ReminderRecurrence.MONTHLY: {
        // Send on same day-of-month if not already notified this month (in tenant's TZ)
        if (reminder.lastNotifiedAt) {
          const lastNotifiedKey = getDateKeyInTz(
            reminder.lastNotifiedAt,
            tz,
          );
          const lastMonth = lastNotifiedKey.slice(0, 7); // YYYY-MM
          const currentMonth = todayKey.slice(0, 7);
          if (lastMonth === currentMonth) return false;
        }
        return true;
      }

      default:
        return false;
    }
  }

  /**
   * Parse HH:mm string to total minutes since midnight.
   */
  private parseTimeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Send email notifications to all assignees.
   */
  private async sendNotificationEmails(reminder: {
    title: string;
    description: string | null;
    category: string | null;
    priority: string;
    reminderTime: string;
    recurrence: string;
    tenant: { name: string };
    assignees: Array<{
      user: {
        firstName: string;
        lastName: string;
        email: string;
        preferredLanguage: string;
      };
    }>;
  }) {
    for (const assignee of reminder.assignees) {
      try {
        await this.mailService.sendReminderNotification(
          assignee.user.email,
          assignee.user.firstName,
          reminder.title,
          reminder.description || '',
          reminder.category || '',
          reminder.priority,
          reminder.reminderTime,
          reminder.recurrence,
          reminder.tenant.name,
          assignee.user.preferredLanguage as 'EN' | 'ES',
        );
      } catch (error) {
        this.logger.error(
          `Failed to send reminder email to ${assignee.user.email}`,
          error,
        );
      }
    }
  }
}
