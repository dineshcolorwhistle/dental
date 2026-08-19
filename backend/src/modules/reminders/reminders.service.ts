import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReminderDto, UpdateReminderDto } from './dto';
import { ReminderRecurrence, ReminderStatus, UserRole } from '@prisma/client';

@Injectable()
export class RemindersService {
  constructor(private readonly prisma: PrismaService) {}

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

    if (dto.reminderDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const reminderDate = new Date(dto.reminderDate);
      if (reminderDate < today) {
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

    const reminder = await this.prisma.reminder.create({
      data: {
        tenantId,
        branchId: resolvedBranchId,
        title: dto.title,
        description: dto.description || null,
        category: dto.category || null,
        priority: dto.priority || 'MEDIUM',
        reminderDate: dto.reminderDate ? new Date(dto.reminderDate) : null,
        reminderTime: dto.reminderTime,
        recurrence: dto.recurrence || 'ONE_TIME',
        createdById: userId,
        assignees:
          dto.assigneeIds && dto.assigneeIds.length > 0
            ? {
                create: dto.assigneeIds.map((uid) => ({
                  userId: uid,
                })),
              }
            : undefined,
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
                role: true,
              },
            },
          },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
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
      include: {
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
        branch: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Get a single reminder by ID.
   */
  async findOne(tenantId: string, id: string) {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id, tenantId },
      include: {
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
        branch: {
          select: { id: true, name: true },
        },
      },
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

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.reminderDate !== undefined)
      updateData.reminderDate = dto.reminderDate
        ? new Date(dto.reminderDate)
        : null;
    if (dto.reminderTime !== undefined)
      updateData.reminderTime = dto.reminderTime;
    if (dto.recurrence !== undefined) updateData.recurrence = dto.recurrence;
    if (dto.branchId !== undefined) updateData.branchId = dto.branchId;

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
      include: {
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
      },
    });
  }

  /**
   * Update reminder status (PENDING / COMPLETED / CANCELLED).
   */
  async updateStatus(tenantId: string, id: string, status: ReminderStatus) {
    const existing = await this.prisma.reminder.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Reminder not found.');
    }

    const updateData: Record<string, any> = { status };

    // Option 1: For recurring reminders, marking complete advances the reminder date to the next cycle and keeps status PENDING
    if (
      status === ReminderStatus.COMPLETED &&
      existing.recurrence !== ReminderRecurrence.ONE_TIME
    ) {
      const baseDate = existing.reminderDate
        ? new Date(existing.reminderDate)
        : new Date();
      const nextDate = new Date(baseDate);

      if (existing.recurrence === ReminderRecurrence.DAILY) {
        nextDate.setDate(nextDate.getDate() + 1);
      } else if (existing.recurrence === ReminderRecurrence.WEEKLY) {
        nextDate.setDate(nextDate.getDate() + 7);
      } else if (existing.recurrence === ReminderRecurrence.MONTHLY) {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }

      updateData.status = ReminderStatus.PENDING;
      updateData.reminderDate = nextDate;
      updateData.lastNotifiedAt = null;
    }

    return this.prisma.reminder.update({
      where: { id },
      data: updateData,
      include: {
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
      },
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
