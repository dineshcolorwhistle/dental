import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReminderDto, UpdateReminderDto } from './dto';
import { ReminderRecurrence, ReminderStatus, UserRole } from '@prisma/client';
import {
  isDateBeforeTodayInTz,
  parseCalendarDate,
} from '../../common/utils/timezone.util';
import {
  getNextOccurrence,
  type RecurrenceConfig,
} from '../../common/utils/recurrence.util';

/** Standard include for Reminder queries */
const REMINDER_INCLUDE = {
  assignees: {
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
    },
  },
  createdBy: {
    select: { id: true, firstName: true, lastName: true, role: true },
  },
};

const REMINDER_INCLUDE_WITH_BRANCH = {
  ...REMINDER_INCLUDE,
  branch: {
    select: { id: true, name: true },
  },
};

@Injectable()
export class RemindersService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Cross-field validation for recurrence configuration.
   */
  private validateRecurrenceConfig(dto: CreateReminderDto): void {
    const recurrence = dto.recurrence || ReminderRecurrence.ONE_TIME;

    if (recurrence === ReminderRecurrence.ONE_TIME) return;

    // All recurring types require a start date
    if (!dto.reminderDate) {
      throw new BadRequestException(
        'Start date (reminderDate) is required for recurring reminders.',
      );
    }

    // Validate endType conditions
    if (dto.endType === 'ON_DATE') {
      if (!dto.endDate) {
        throw new BadRequestException(
          'End date is required when end type is ON_DATE.',
        );
      }
      if (dto.endDate && dto.reminderDate && dto.endDate < dto.reminderDate) {
        throw new BadRequestException(
          'End date must not be before the start date.',
        );
      }
    }

    if (dto.endType === 'AFTER') {
      if (
        dto.endAfterOccurrences === undefined ||
        dto.endAfterOccurrences === null
      ) {
        throw new BadRequestException(
          'Number of occurrences is required when end type is AFTER.',
        );
      }
      if (dto.endAfterOccurrences < 1 || dto.endAfterOccurrences > 365) {
        throw new BadRequestException(
          'Occurrences must be between 1 and 365.',
        );
      }
    }

    // Weekly-specific
    if (recurrence === ReminderRecurrence.WEEKLY) {
      if (!dto.weeklyDays || dto.weeklyDays.length === 0) {
        throw new BadRequestException(
          'At least one weekday must be selected for weekly recurrence.',
        );
      }
      for (const d of dto.weeklyDays) {
        if (d < 0 || d > 6) {
          throw new BadRequestException(
            'Weekly days must be between 0 (Sunday) and 6 (Saturday).',
          );
        }
      }
    }

    // Monthly-specific
    if (recurrence === ReminderRecurrence.MONTHLY) {
      if (!dto.monthlyPattern) {
        throw new BadRequestException(
          'Monthly pattern is required for monthly recurrence.',
        );
      }

      if (dto.monthlyPattern === 'DAY_OF_MONTH') {
        if (
          dto.monthlyDayOfMonth === undefined ||
          dto.monthlyDayOfMonth === null
        ) {
          throw new BadRequestException(
            'Day of month is required for DAY_OF_MONTH pattern.',
          );
        }
        if (dto.monthlyDayOfMonth < 1 || dto.monthlyDayOfMonth > 31) {
          throw new BadRequestException('Day of month must be between 1 and 31.');
        }
      }

      if (dto.monthlyPattern === 'POSITIONAL_WEEKDAY') {
        if (!dto.monthlyWeekPosition) {
          throw new BadRequestException(
            'Week position is required for POSITIONAL_WEEKDAY pattern.',
          );
        }
        if (
          dto.monthlyWeekDay === undefined ||
          dto.monthlyWeekDay === null
        ) {
          throw new BadRequestException(
            'Weekday is required for POSITIONAL_WEEKDAY pattern.',
          );
        }
      }
    }
  }

  /**
   * Build the recurrence data fields from DTO.
   */
  private buildRecurrenceData(dto: Partial<CreateReminderDto>): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if (dto.repeatInterval !== undefined)
      data.repeatInterval = dto.repeatInterval;
    if (dto.endType !== undefined) data.endType = dto.endType;
    if (dto.endDate !== undefined)
      data.endDate = dto.endDate ? parseCalendarDate(dto.endDate) : null;
    if (dto.endAfterOccurrences !== undefined)
      data.endAfterOccurrences = dto.endAfterOccurrences;
    if (dto.weeklyDays !== undefined)
      data.weeklyDays = dto.weeklyDays
        ? JSON.stringify(dto.weeklyDays)
        : null;
    if (dto.monthlyPattern !== undefined)
      data.monthlyPattern = dto.monthlyPattern;
    if (dto.monthlyDayOfMonth !== undefined)
      data.monthlyDayOfMonth = dto.monthlyDayOfMonth;
    if (dto.monthlyWeekPosition !== undefined)
      data.monthlyWeekPosition = dto.monthlyWeekPosition;
    if (dto.monthlyWeekDay !== undefined)
      data.monthlyWeekDay = dto.monthlyWeekDay;

    return data;
  }

  /**
   * Build a RecurrenceConfig from a Reminder record.
   */
  private buildRecurrenceConfig(reminder: {
    recurrence: ReminderRecurrence;
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
    if (!reminder.reminderDate) return null;

    return {
      recurrence: reminder.recurrence as RecurrenceConfig['recurrence'],
      startDate: reminder.reminderDate,
      repeatInterval: reminder.repeatInterval || 1,
      endType: (reminder.endType || 'NEVER') as RecurrenceConfig['endType'],
      endDate: reminder.endDate,
      endAfterOccurrences: reminder.endAfterOccurrences,
      weeklyDays: reminder.weeklyDays
        ? JSON.parse(reminder.weeklyDays)
        : undefined,
      monthlyPattern: reminder.monthlyPattern as RecurrenceConfig['monthlyPattern'],
      monthlyDayOfMonth: reminder.monthlyDayOfMonth ?? undefined,
      monthlyWeekPosition:
        reminder.monthlyWeekPosition as RecurrenceConfig['monthlyWeekPosition'],
      monthlyWeekDay: reminder.monthlyWeekDay ?? undefined,
    };
  }

  /**
   * Create a reminder — ADMIN only.
   */
  async create(
    tenantId: string,
    branchId: string | null,
    userId: string,
    userRole: UserRole,
    dto: CreateReminderDto,
  ) {
    if (!userId) {
      throw new BadRequestException('User context is required.');
    }

    if (userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only lab admins can create reminders.');
    }

    // For ONE_TIME recurrence, reminderDate is required
    if (
      (!dto.recurrence || dto.recurrence === ReminderRecurrence.ONE_TIME) &&
      !dto.reminderDate
    ) {
      throw new BadRequestException(
        'Reminder date is required for one-time reminders.',
      );
    }

    // Validate recurrence config cross-field rules
    this.validateRecurrenceConfig(dto);

    if (dto.reminderDate) {
      // Fetch tenant timezone for date comparison
      const tenantSettings = await this.prisma.tenantSettings.findUnique({
        where: { tenantId },
        select: { timezone: true },
      });
      const tz = tenantSettings?.timezone || 'America/Mexico_City';

      if (isDateBeforeTodayInTz(dto.reminderDate, tz)) {
        throw new BadRequestException('Reminder date cannot be in the past.');
      }
    }

    const resolvedBranchId = dto.branchId || branchId || null;

    // Validate assignees exist and are not OWNER
    if (!dto.assigneeIds || dto.assigneeIds.length === 0) {
      throw new BadRequestException('At least one assignee is required.');
    }

    if (dto.assigneeIds && dto.assigneeIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: {
          id: { in: dto.assigneeIds },
          tenantId,
          status: 'ACTIVE',
        },
        select: { id: true, role: true, branchId: true },
      });

      if (users.length !== dto.assigneeIds.length) {
        throw new BadRequestException(
          'One or more assignee users not found or inactive.',
        );
      }

      const ownerAssignees = users.filter((u) => u.role === UserRole.OWNER);
      if (ownerAssignees.length > 0) {
        throw new BadRequestException(
          'Owner users cannot be assigned to reminders.',
        );
      }
    }

    // Build recurrence data
    const recurrenceData = this.buildRecurrenceData(dto);

    const reminder = await this.prisma.reminder.create({
      data: {
        tenantId,
        branchId: resolvedBranchId,
        title: dto.title,
        description: dto.description || null,
        category: dto.category || null,
        priority: dto.priority || 'MEDIUM',
        reminderDate: dto.reminderDate ? parseCalendarDate(dto.reminderDate) : null,
        reminderTime: dto.reminderTime,
        recurrence: dto.recurrence || 'ONE_TIME',
        createdById: userId,
        ...recurrenceData,
        assignees:
          dto.assigneeIds && dto.assigneeIds.length > 0
            ? {
              create: dto.assigneeIds.map((uid) => ({
                userId: uid,
              })),
            }
            : undefined,
      },
      include: REMINDER_INCLUDE,
    });

    return reminder;
  }

  /**
   * List all reminders for a tenant (optionally filtered by branch).
   */
  async findAll(
    tenantId: string,
    branchId: string | null,
    userRole: UserRole,
    query?: {
      search?: string;
      priority?: string;
      status?: string;
      category?: string;
      recurrence?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const where: Record<string, unknown> = { tenantId };

    // ADMIN sees only their branch reminders; OWNER sees all
    if (userRole === UserRole.ADMIN && branchId) {
      where.branchId = branchId;
    }

    if (query?.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { category: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query?.priority) {
      where.priority = query.priority;
    }

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.category) {
      where.category = { contains: query.category, mode: 'insensitive' };
    }

    if (query?.recurrence) {
      where.recurrence = query.recurrence;
    }

    if (query?.dateFrom || query?.dateTo) {
      where.reminderDate = {};
      if (query?.dateFrom) {
        (where.reminderDate as Record<string, unknown>).gte = new Date(
          query.dateFrom,
        );
      }
      if (query?.dateTo) {
        (where.reminderDate as Record<string, unknown>).lte = new Date(
          query.dateTo,
        );
      }
    }

    return this.prisma.reminder.findMany({
      where,
      include: REMINDER_INCLUDE_WITH_BRANCH,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Get a single reminder by ID.
   */
  async findOne(tenantId: string, id: string) {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id, tenantId },
      include: REMINDER_INCLUDE_WITH_BRANCH,
    });

    if (!reminder) {
      throw new NotFoundException('Reminder not found.');
    }

    return reminder;
  }

  /**
   * Update a reminder — ADMIN only.
   */
  async update(
    tenantId: string,
    id: string,
    userRole: UserRole,
    dto: UpdateReminderDto,
  ) {
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.OWNER) {
      throw new ForbiddenException(
        'Only lab admins and owners can edit reminders.',
      );
    }

    const existing = await this.prisma.reminder.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Reminder not found.');
    }

    // Validate one-time requires date
    const recurrence = dto.recurrence ?? existing.recurrence;
    if (recurrence === ReminderRecurrence.ONE_TIME) {
      const reminderDate =
        dto.reminderDate !== undefined
          ? dto.reminderDate
          : existing.reminderDate;
      if (!reminderDate) {
        throw new BadRequestException(
          'Reminder date is required for one-time reminders.',
        );
      }
    }

    // Validate recurrence config if recurrence fields are being updated
    if (
      recurrence !== ReminderRecurrence.ONE_TIME &&
      (dto.recurrence !== undefined ||
        dto.weeklyDays !== undefined ||
        dto.monthlyPattern !== undefined ||
        dto.endType !== undefined)
    ) {
      // Build a merged DTO for validation
      const mergedDto: CreateReminderDto = {
        title: dto.title ?? existing.title,
        reminderTime: dto.reminderTime ?? existing.reminderTime,
        assigneeIds: dto.assigneeIds ?? [],
        recurrence: recurrence as ReminderRecurrence,
        reminderDate: dto.reminderDate ?? (existing.reminderDate?.toISOString() || undefined),
        repeatInterval: dto.repeatInterval ?? existing.repeatInterval,
        endType: dto.endType ?? existing.endType,
        endDate: dto.endDate ?? (existing.endDate?.toISOString() || undefined),
        endAfterOccurrences: dto.endAfterOccurrences ?? (existing.endAfterOccurrences || undefined),
        weeklyDays: dto.weeklyDays ?? (existing.weeklyDays ? JSON.parse(existing.weeklyDays) : undefined),
        monthlyPattern: dto.monthlyPattern ?? (existing.monthlyPattern || undefined),
        monthlyDayOfMonth: dto.monthlyDayOfMonth ?? (existing.monthlyDayOfMonth || undefined),
        monthlyWeekPosition: dto.monthlyWeekPosition ?? (existing.monthlyWeekPosition || undefined),
        monthlyWeekDay: dto.monthlyWeekDay ?? (existing.monthlyWeekDay ?? undefined),
      };
      this.validateRecurrenceConfig(mergedDto);
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.reminderDate !== undefined)
      updateData.reminderDate = dto.reminderDate
        ? parseCalendarDate(dto.reminderDate)
        : null;
    if (dto.reminderTime !== undefined)
      updateData.reminderTime = dto.reminderTime;
    if (dto.recurrence !== undefined) updateData.recurrence = dto.recurrence;
    if (dto.branchId !== undefined) updateData.branchId = dto.branchId;

    // Add recurrence config data
    const recurrenceData = this.buildRecurrenceData(dto);
    Object.assign(updateData, recurrenceData);

    // Reset completed occurrences if recurrence config changed
    if (
      dto.recurrence !== undefined ||
      dto.repeatInterval !== undefined ||
      dto.endType !== undefined ||
      dto.weeklyDays !== undefined ||
      dto.monthlyPattern !== undefined
    ) {
      updateData.completedOccurrences = 0;
    }

    // Handle assignees update
    if (dto.assigneeIds !== undefined) {
      // Validate no OWNER in assignees
      if (dto.assigneeIds.length > 0) {
        const users = await this.prisma.user.findMany({
          where: {
            id: { in: dto.assigneeIds },
            tenantId,
            status: 'ACTIVE',
          },
          select: { id: true, role: true },
        });

        if (users.length !== dto.assigneeIds.length) {
          throw new BadRequestException(
            'One or more assignee users not found or inactive.',
          );
        }

        const ownerAssignees = users.filter((u) => u.role === UserRole.OWNER);
        if (ownerAssignees.length > 0) {
          throw new BadRequestException(
            'Owner users cannot be assigned to reminders.',
          );
        }
      }

      // Delete existing and re-create
      await this.prisma.reminderAssignee.deleteMany({
        where: { reminderId: id },
      });

      if (dto.assigneeIds.length > 0) {
        await this.prisma.reminderAssignee.createMany({
          data: dto.assigneeIds.map((uid) => ({
            reminderId: id,
            userId: uid,
          })),
        });
      }
    }

    return this.prisma.reminder.update({
      where: { id },
      data: updateData,
      include: REMINDER_INCLUDE,
    });
  }

  /**
   * Update reminder status (PENDING / COMPLETED / CANCELLED).
   * For recurring reminders, completing advances to the next occurrence
   * using the recurrence engine.
   */
  async updateStatus(tenantId: string, id: string, status: ReminderStatus) {
    const existing = await this.prisma.reminder.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Reminder not found.');
    }

    const updateData: Record<string, any> = { status };

    // For recurring reminders, marking complete advances to next cycle
    if (
      status === ReminderStatus.COMPLETED &&
      existing.recurrence !== ReminderRecurrence.ONE_TIME
    ) {
      const config = this.buildRecurrenceConfig(existing);
      const newCompletedCount = existing.completedOccurrences + 1;

      if (config) {
        // Check if we've reached the AFTER limit
        if (
          config.endType === 'AFTER' &&
          config.endAfterOccurrences != null &&
          newCompletedCount >= config.endAfterOccurrences
        ) {
          // Series is truly complete
          updateData.status = ReminderStatus.COMPLETED;
          updateData.completedOccurrences = newCompletedCount;
        } else {
          const currentDate = existing.reminderDate || new Date();
          const nextDate = getNextOccurrence(config, currentDate);

          if (nextDate) {
            // Advance to next occurrence
            updateData.status = ReminderStatus.PENDING;
            updateData.reminderDate = nextDate;
            updateData.lastNotifiedAt = null;
            updateData.completedOccurrences = newCompletedCount;
          } else {
            // No more occurrences — series complete
            updateData.status = ReminderStatus.COMPLETED;
            updateData.completedOccurrences = newCompletedCount;
          }
        }
      } else {
        // Fallback: legacy reminder without config — use simple advance
        const baseDate = existing.reminderDate
          ? new Date(existing.reminderDate)
          : new Date();
        const nextDate = new Date(baseDate);

        if (existing.recurrence === ReminderRecurrence.DAILY) {
          nextDate.setDate(nextDate.getDate() + (existing.repeatInterval || 1));
        } else if (existing.recurrence === ReminderRecurrence.WEEKLY) {
          nextDate.setDate(nextDate.getDate() + 7 * (existing.repeatInterval || 1));
        } else if (existing.recurrence === ReminderRecurrence.MONTHLY) {
          nextDate.setMonth(nextDate.getMonth() + (existing.repeatInterval || 1));
        } else if (existing.recurrence === ReminderRecurrence.YEARLY) {
          nextDate.setFullYear(nextDate.getFullYear() + (existing.repeatInterval || 1));
        }

        updateData.status = ReminderStatus.PENDING;
        updateData.reminderDate = nextDate;
        updateData.lastNotifiedAt = null;
        updateData.completedOccurrences = newCompletedCount;
      }
    }

    return this.prisma.reminder.update({
      where: { id },
      data: updateData,
      include: REMINDER_INCLUDE,
    });
  }

  /**
   * Delete a reminder — OWNER only.
   */
  async remove(tenantId: string, id: string, userRole: UserRole) {
    if (userRole !== UserRole.OWNER) {
      throw new ForbiddenException('Only owners can delete reminders.');
    }

    const existing = await this.prisma.reminder.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Reminder not found.');
    }

    await this.prisma.reminder.delete({ where: { id } });

    return { message: 'Reminder deleted successfully.' };
  }

  /**
   * Get assignable users for a branch (excludes OWNER role).
   */
  async getAssignableUsers(tenantId: string, branchId?: string) {
    const where: Record<string, unknown> = {
      tenantId,
      status: 'ACTIVE',
      role: { not: UserRole.OWNER },
    };

    if (branchId) {
      where.branchId = branchId;
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
      orderBy: { firstName: 'asc' },
    });
  }
}
