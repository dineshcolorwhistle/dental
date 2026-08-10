import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ReminderRecurrence, ReminderStatus } from '@prisma/client';

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
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleReminderNotifications() {
    try {
      const now = new Date();
      const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const currentHHmm = `${String(twoHoursFromNow.getHours()).padStart(2, '0')}:${String(twoHoursFromNow.getMinutes()).padStart(2, '0')}`;

      // Get all active (PENDING) reminders
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
          tenant: { select: { name: true } },
        },
      });

      for (const reminder of reminders) {
        const shouldNotify = this.shouldSendNotification(
          reminder,
          now,
          currentHHmm,
        );

        if (shouldNotify) {
          await this.sendNotificationEmails(reminder);

          // Update lastNotifiedAt
          await this.prisma.reminder.update({
            where: { id: reminder.id },
            data: { lastNotifiedAt: now },
          });

          this.logger.log(
            `Sent reminder notification for "${reminder.title}" (ID: ${reminder.id})`,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error processing reminder notifications', error);
    }
  }

  /**
   * Determine if a reminder should trigger a notification right now.
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
  ): boolean {
    // Only process if the current 5-min window aligns with the reminder time
    const reminderMinutes = this.parseTimeToMinutes(reminder.reminderTime);
    const targetMinutes = this.parseTimeToMinutes(targetHHmm);

    // Check if we're within a 5-minute window
    if (Math.abs(reminderMinutes - targetMinutes) > 5) {
      return false;
    }

    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    switch (reminder.recurrence) {
      case ReminderRecurrence.ONE_TIME: {
        if (!reminder.reminderDate) return false;
        const reminderDateStart = new Date(
          reminder.reminderDate.getFullYear(),
          reminder.reminderDate.getMonth(),
          reminder.reminderDate.getDate(),
        );
        // Must be today and not already notified
        if (reminderDateStart.getTime() !== todayStart.getTime()) return false;
        if (reminder.lastNotifiedAt) {
          const lastNotifiedDate = new Date(
            reminder.lastNotifiedAt.getFullYear(),
            reminder.lastNotifiedAt.getMonth(),
            reminder.lastNotifiedAt.getDate(),
          );
          if (lastNotifiedDate.getTime() === todayStart.getTime()) return false;
        }
        return true;
      }

      case ReminderRecurrence.DAILY: {
        // Send every day if not already notified today
        if (reminder.lastNotifiedAt) {
          const lastNotifiedDate = new Date(
            reminder.lastNotifiedAt.getFullYear(),
            reminder.lastNotifiedAt.getMonth(),
            reminder.lastNotifiedAt.getDate(),
          );
          if (lastNotifiedDate.getTime() === todayStart.getTime()) return false;
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
        // Send on same day-of-month if not already notified this month
        if (reminder.lastNotifiedAt) {
          if (
            reminder.lastNotifiedAt.getFullYear() === now.getFullYear() &&
            reminder.lastNotifiedAt.getMonth() === now.getMonth()
          ) {
            return false;
          }
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
