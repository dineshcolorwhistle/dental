import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ReminderRecurrence, ReminderStatus } from '@prisma/client';
import { getHHmmInTz, getDateKeyInTz } from '../../common/utils/timezone.util';
import {
  isOccurrenceDate,
  generateOccurrences,
  type RecurrenceConfig,
} from '../../common/utils/recurrence.util';

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
          (reminder.tenant as any)?.settings?.timezone || 'America/Mexico_City';

        // Calculate "2 hours from now" in the tenant's timezone to target the occurrence
        const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        const targetDateKey = getDateKeyInTz(twoHoursFromNow, tz);
        const targetHHmm = getHHmmInTz(twoHoursFromNow, tz);

        const shouldNotify = this.shouldSendNotification(
          reminder,
          now,
          targetDateKey,
          targetHHmm,
          tz,
        );

        if (shouldNotify) {
          await this.sendNotificationEmails(reminder);

          if (reminder.recurrence === ReminderRecurrence.ONE_TIME) {
            // One-time reminder auto-completes immediately once notification is sent
            await this.prisma.reminder.update({
              where: { id: reminder.id },
              data: {
                lastNotifiedAt: now,
                status: ReminderStatus.COMPLETED,
              },
            });

            this.logger.log(
              `Sent and COMPLETED one-time reminder "${reminder.title}" (ID: ${reminder.id}) [TZ: ${tz}]`,
            );
          } else {
            // Recurring reminder: advance occurrence or complete if end condition is met
            const config = this.buildRecurrenceConfig(reminder);
            if (config) {
              const maxOcc = config.endAfterOccurrences || 365;
              const allOccurrences = generateOccurrences(config, 0, maxOcc);

              // All occurrences up to and including targetDateKey are completed
              const completedCount = allOccurrences.filter(
                (d) => getDateKeyInTz(d, tz) <= targetDateKey,
              ).length;

              // Next upcoming occurrence after targetDateKey
              const nextOccurrence = allOccurrences.find(
                (d) => getDateKeyInTz(d, tz) > targetDateKey,
              );

              let isComplete = false;
              if (
                config.endType === 'AFTER' &&
                config.endAfterOccurrences != null &&
                completedCount >= config.endAfterOccurrences
              ) {
                isComplete = true;
              } else if (
                config.endType === 'ON_DATE' &&
                config.endDate &&
                (!nextOccurrence ||
                  getDateKeyInTz(nextOccurrence, tz) >
                    getDateKeyInTz(config.endDate, tz))
              ) {
                isComplete = true;
              } else if (!nextOccurrence) {
                isComplete = true;
              }

              if (isComplete) {
                await this.prisma.reminder.update({
                  where: { id: reminder.id },
                  data: {
                    lastNotifiedAt: now,
                    completedOccurrences: completedCount,
                    status: ReminderStatus.COMPLETED,
                  },
                });

                this.logger.log(
                  `Sent and COMPLETED recurring reminder "${reminder.title}" (ID: ${reminder.id}) - all occurrences finished (${completedCount}).`,
                );
              } else {
                await this.prisma.reminder.update({
                  where: { id: reminder.id },
                  data: {
                    lastNotifiedAt: now,
                    completedOccurrences: completedCount,
                    ...(nextOccurrence ? { reminderDate: nextOccurrence } : {}),
                  },
                });

                this.logger.log(
                  `Sent recurring reminder notification for "${reminder.title}" (ID: ${reminder.id}). Completed: ${completedCount}. Next date: ${nextOccurrence?.toISOString() || 'None'}`,
                );
              }
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Error processing reminder notifications', error);
    }
  }

  /**
   * Determine if a reminder should trigger a notification right now.
   * All date comparisons use the tenant's timezone.
   * Uses the recurrence utility for recurring types.
   */
  private shouldSendNotification(
    reminder: {
      recurrence: ReminderRecurrence;
      startDate?: Date | null;
      reminderDate: Date | null;
      reminderTime: string;
      lastNotifiedAt: Date | null;
      repeatInterval: number;
      endType: string;
      endDate: Date | null;
      endAfterOccurrences: number | null;
      completedOccurrences: number;
      weeklyDays: string | null;
      monthlyPattern: string | null;
      monthlyDayOfMonth: number | null;
      monthlyWeekPosition: string | null;
      monthlyWeekDay: number | null;
    },
    now: Date,
    targetDateKey: string,
    targetHHmm: string,
    tz: string,
  ): boolean {
    const reminderMinutes = this.parseTimeToMinutes(reminder.reminderTime);
    const targetMinutes = this.parseTimeToMinutes(targetHHmm);

    // Trigger window: notification is scheduled 2 hours before reminderTime.
    // Allow a catch-up window of up to 60 minutes after trigger time.
    if (
      targetMinutes < reminderMinutes - 5 ||
      targetMinutes > reminderMinutes + 60
    ) {
      return false;
    }

    // Check if already notified within the last 18 hours
    if (reminder.lastNotifiedAt) {
      const hoursSinceLast =
        (now.getTime() - new Date(reminder.lastNotifiedAt).getTime()) /
        (1000 * 60 * 60);
      if (hoursSinceLast < 18) {
        return false;
      }
    }

    // ONE_TIME: simple date comparison
    if (reminder.recurrence === ReminderRecurrence.ONE_TIME) {
      if (!reminder.reminderDate) return false;
      const reminderDateKey = getDateKeyInTz(reminder.reminderDate, tz);
      return reminderDateKey === targetDateKey;
    }

    // Recurring types: check if targetDateKey is a valid occurrence date
    const config = this.buildRecurrenceConfig(reminder);
    if (!config) return false;

    const [year, month, day] = targetDateKey.split('-').map(Number);
    const targetDateNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

    return isOccurrenceDate(
      config,
      targetDateNoon,
      reminder.completedOccurrences,
    );
  }

  /**
   * Build a RecurrenceConfig from a reminder record.
   */
  private buildRecurrenceConfig(reminder: {
    recurrence: ReminderRecurrence;
    startDate?: Date | null;
    reminderDate: Date | null;
    repeatInterval: number;
    endType: string;
    endDate: Date | null;
    endAfterOccurrences: number | null;
    weeklyDays: string | null;
    monthlyPattern: string | null;
    monthlyDayOfMonth: number | null;
    monthlyWeekPosition: string | null;
    monthlyWeekDay: number | null;
  }): RecurrenceConfig | null {
    if (reminder.recurrence === ReminderRecurrence.ONE_TIME) return null;
    const baseDate = reminder.startDate || reminder.reminderDate;
    if (!baseDate) return null;

    return {
      recurrence: reminder.recurrence,
      startDate: baseDate,
      repeatInterval: reminder.repeatInterval || 1,
      endType: (reminder.endType || 'NEVER') as RecurrenceConfig['endType'],
      endDate: reminder.endDate,
      endAfterOccurrences: reminder.endAfterOccurrences,
      weeklyDays: reminder.weeklyDays
        ? JSON.parse(reminder.weeklyDays)
        : undefined,
      monthlyPattern:
        reminder.monthlyPattern as RecurrenceConfig['monthlyPattern'],
      monthlyDayOfMonth: reminder.monthlyDayOfMonth ?? undefined,
      monthlyWeekPosition:
        reminder.monthlyWeekPosition as RecurrenceConfig['monthlyWeekPosition'],
      monthlyWeekDay: reminder.monthlyWeekDay ?? undefined,
    };
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
