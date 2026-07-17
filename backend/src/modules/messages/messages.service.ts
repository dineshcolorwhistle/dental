import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { WebsocketsGateway } from '../websockets/websockets.gateway';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

interface CurrentUser {
  id: string;
  tenantId: string;
  branchId: string | null;
  role: UserRole;
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly websocketsGateway: WebsocketsGateway,
  ) {}

  // ─── Contact Visibility ──────────────────────────────────

  async getContacts(user: CurrentUser) {
    const where: Prisma.UserWhereInput = {
      tenantId: user.tenantId,
      status: 'ACTIVE',
      id: { not: user.id },
    };

    if (user.role === 'OWNER') {
      where.role = { in: ['OWNER', 'ADMIN', 'TECHNICIAN'] };
    } else if (user.role === 'ADMIN') {
      where.OR = [
        { role: 'OWNER' },
        { role: 'ADMIN', branchId: user.branchId },
        { role: 'TECHNICIAN', branchId: user.branchId },
      ];
    } else if (user.role === 'TECHNICIAN') {
      where.OR = [
        { role: 'OWNER' },
        { role: 'ADMIN', branchId: user.branchId },
        { role: 'TECHNICIAN', branchId: user.branchId, id: { not: user.id } },
      ];
    } else if (user.role === 'DOCTOR') {
      // Doctors can only see participants in their WO conversations (handled separately)
      return [];
    } else {
      return [];
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        branch: { select: { id: true, name: true } },
      },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    });
  }

  /**
   * Validate that a target user is within the current user's contact scope.
   */
  private async validateContactAccess(
    user: CurrentUser,
    targetUserId: string,
  ): Promise<void> {
    const contacts = await this.getContacts(user);
    const allowed = contacts.some((c) => c.id === targetUserId);
    if (!allowed) {
      throw new ForbiddenException(
        'You do not have permission to message this user.',
      );
    }
  }

  // ─── Conversations ──────────────────────────────────────

  async getConversations(user: CurrentUser) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        tenantId: user.tenantId,
        participants: { some: { userId: user.id } },
        workOrderId: null,
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
                branch: { select: { name: true } },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            createdAt: true,
            senderId: true,
            sender: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Calculate unread count for each conversation
    const result = await Promise.all(
      conversations.map(async (conv) => {
        const myParticipant = conv.participants.find(
          (p) => p.userId === user.id,
        );
        const lastReadAt = myParticipant?.lastReadAt;
        const clearedAt = myParticipant?.clearedAt;

        const unreadWhere: Prisma.MessageWhereInput = {
          conversationId: conv.id,
          senderId: { not: user.id },
        };

        if (lastReadAt) {
          unreadWhere.createdAt = { gt: lastReadAt };
        }
        if (clearedAt) {
          unreadWhere.createdAt = {
            ...(unreadWhere.createdAt as any),
            gt: lastReadAt
              ? lastReadAt > clearedAt
                ? lastReadAt
                : clearedAt
              : clearedAt,
          };
        }

        const unreadCount = await this.prisma.message.count({
          where: unreadWhere,
        });

        // Filter last message if cleared
        let lastMessage: any = conv.messages[0] || null;
        if (lastMessage && clearedAt && new Date(lastMessage.createdAt) < clearedAt) {
          lastMessage = null;
        }

        return {
          id: conv.id,
          name: conv.name,
          isGroup: conv.isGroup,
          createdById: conv.createdById,
          participants: conv.participants.map((p) => ({
            id: p.user.id,
            firstName: p.user.firstName,
            lastName: p.user.lastName,
            role: p.user.role,
            branchName: p.user.branch?.name || null,
          })),
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                content: lastMessage.content,
                createdAt: lastMessage.createdAt,
                senderId: lastMessage.senderId,
                senderName: `${lastMessage.sender.firstName} ${lastMessage.sender.lastName}`,
              }
            : null,
          unreadCount,
          updatedAt: conv.updatedAt,
        };
      }),
    );

    return result;
  }

  async createConversation(user: CurrentUser, targetUserId: string) {
    // Validate target user is in contacts
    await this.validateContactAccess(user, targetUserId);

    // Check if 1:1 conversation already exists
    const existing = await this.prisma.conversation.findFirst({
      where: {
        tenantId: user.tenantId,
        isGroup: false,
        AND: [
          { participants: { some: { userId: user.id } } },
          { participants: { some: { userId: targetUserId } } },
        ],
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
                branch: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (existing) {
      return {
        id: existing.id,
        name: existing.name,
        isGroup: existing.isGroup,
        participants: existing.participants.map((p) => ({
          id: p.user.id,
          firstName: p.user.firstName,
          lastName: p.user.lastName,
          role: p.user.role,
          branchName: p.user.branch?.name || null,
        })),
      };
    }

    // Create new 1:1 conversation
    const conversation = await this.prisma.conversation.create({
      data: {
        tenantId: user.tenantId,
        isGroup: false,
        participants: {
          create: [{ userId: user.id }, { userId: targetUserId }],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
                branch: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    return {
      id: conversation.id,
      name: conversation.name,
      isGroup: conversation.isGroup,
      participants: conversation.participants.map((p) => ({
        id: p.user.id,
        firstName: p.user.firstName,
        lastName: p.user.lastName,
        role: p.user.role,
        branchName: p.user.branch?.name || null,
      })),
    };
  }

  async createGroup(
    user: CurrentUser,
    name: string,
    memberIds: string[],
  ) {
    // Validate all members are in the user's contact scope
    const contacts = await this.getContacts(user);
    const contactIds = new Set(contacts.map((c) => c.id));

    for (const memberId of memberIds) {
      if (!contactIds.has(memberId)) {
        throw new ForbiddenException(
          `User ${memberId} is not in your contact list.`,
        );
      }
    }

    // Include creator as a participant
    const allParticipantIds = [...new Set([user.id, ...memberIds])];

    const conversation = await this.prisma.conversation.create({
      data: {
        tenantId: user.tenantId,
        name,
        isGroup: true,
        createdById: user.id,
        participants: {
          create: allParticipantIds.map((id) => ({ userId: id })),
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
                branch: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    // Notify all participants in real-time
    for (const pid of allParticipantIds) {
      if (pid !== user.id) {
        this.websocketsGateway.sendToUser(pid, 'conversation_updated', {
          conversationId: conversation.id,
        });
      }
    }

    return {
      id: conversation.id,
      name: conversation.name,
      isGroup: conversation.isGroup,
      createdById: conversation.createdById,
      participants: conversation.participants.map((p) => ({
        id: p.user.id,
        firstName: p.user.firstName,
        lastName: p.user.lastName,
        role: p.user.role,
        branchName: p.user.branch?.name || null,
      })),
    };
  }

  // ─── Messages ──────────────────────────────────────────

  async getMessages(
    user: CurrentUser,
    conversationId: string,
    cursor?: string,
    limit = 50,
  ) {
    // Verify user is a participant
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException('You are not a member of this conversation.');
    }

    const where: Prisma.MessageWhereInput = {
      conversationId,
    };

    // Respect clearedAt — hide messages cleared by this user
    if (participant.clearedAt) {
      where.createdAt = { gt: participant.clearedAt };
    }

    // Cursor-based pagination
    if (cursor) {
      where.id = { lt: cursor };
    }

    const messages = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        senderId: true,
        content: true,
        createdAt: true,
        sender: {
          select: { id: true, firstName: true, lastName: true },
        },
        readReceipts: {
          select: {
            userId: true,
            readAt: true,
          },
        },
      },
    });

    return {
      messages: messages.reverse(), // Return in chronological order
      hasMore: messages.length === limit,
    };
  }

  async sendMessage(
    user: CurrentUser,
    conversationId: string,
    content: string,
  ) {
    // Verify user is a participant
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException('You are not a member of this conversation.');
    }

    // Create message
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: user.id,
        content,
      },
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        content: true,
        createdAt: true,
        sender: {
          select: { id: true, firstName: true, lastName: true },
        },
        readReceipts: {
          select: { userId: true, readAt: true },
        },
        conversation: {
          select: { workOrderId: true },
        },
      },
    });

    // Update conversation's updatedAt
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Send real-time to all other participants
    const allParticipants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });

    for (const p of allParticipants) {
      if (p.userId !== user.id) {
        this.websocketsGateway.sendToUser(
          p.userId,
          'message_received',
          message,
        );
      }
    }

    // ─── Notify external/integrated doctor via webhook ───
    await this.notifyExternalDoctorIfNeeded(conversationId, message, user);

    return message;
  }

  /**
   * If the conversation is linked to a Work Order with an integrated doctor,
   * and the sender is NOT the doctor, send a webhook notification to the clinic.
   */
  private async notifyExternalDoctorIfNeeded(
    conversationId: string,
    message: any,
    sender: CurrentUser,
  ) {
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { workOrderId: true },
      });

      if (!conversation?.workOrderId) return;

      const workOrder = await this.prisma.workOrder.findUnique({
        where: { id: conversation.workOrderId },
        select: {
          id: true,
          folioNumber: true,
          branchId: true,
          doctorId: true,
          doctor: {
            select: {
              id: true,
              name: true,
              userId: true,
              clinicId: true,
              clinic: { select: { url: true } },
            },
          },
        },
      });

      if (!workOrder?.doctor) return;

      const doctor = workOrder.doctor;
      const isIntegrated = doctor.clinicId && doctor.clinic?.url;

      // Only send webhook if it's an integrated doctor AND the sender is NOT the doctor
      if (!isIntegrated) return;
      if (doctor.userId && doctor.userId === sender.id) return;

      const clinicUrl = doctor.clinic!.url;
      const notificationUrl = `${clinicUrl}/api/integration/notifications`;

      const apiKeyRecord = workOrder.branchId
        ? await this.prisma.apiKey.findFirst({
            where: { branchId: workOrder.branchId, isActive: true },
          })
        : null;
      const apiKey = apiKeyRecord ? apiKeyRecord.key : '';

      const senderName = message.sender
        ? `${message.sender.firstName} ${message.sender.lastName}`.trim()
        : 'Lab Staff';

      await (global as any).fetch(notificationUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { 'X-API-Key': apiKey }),
        },
        body: JSON.stringify({
          event: 'CHAT_MESSAGE_RECEIVED',
          workOrderId: workOrder.id,
          folioNumber: workOrder.folioNumber,
          message: {
            id: message.id,
            content: message.content,
            createdAt: message.createdAt,
            senderName,
          },
        }),
      });

      this.logger.log(
        `Notified integrated clinic at ${notificationUrl} about new WO chat message`,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to notify external doctor about chat message: ${err.message}`,
      );
    }
  }

  // ─── Read Receipts ──────────────────────────────────────

  async markSeen(user: CurrentUser, conversationId: string) {
    // Verify user is a participant
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException('You are not a member of this conversation.');
    }

    const now = new Date();

    // Update lastReadAt
    await this.prisma.conversationParticipant.update({
      where: { id: participant.id },
      data: { lastReadAt: now },
    });

    // Create read receipts for unread messages
    const unreadMessages = await this.prisma.message.findMany({
      where: {
        conversationId,
        senderId: { not: user.id },
        readReceipts: {
          none: { userId: user.id },
        },
        ...(participant.clearedAt
          ? { createdAt: { gt: participant.clearedAt } }
          : {}),
      },
      select: { id: true, senderId: true },
    });

    if (unreadMessages.length > 0) {
      await this.prisma.messageReadReceipt.createMany({
        data: unreadMessages.map((m) => ({
          messageId: m.id,
          userId: user.id,
          readAt: now,
        })),
        skipDuplicates: true,
      });

      // Notify senders that their messages were seen
      const senderIds = [...new Set(unreadMessages.map((m) => m.senderId))];
      for (const senderId of senderIds) {
        this.websocketsGateway.sendToUser(senderId, 'message_seen', {
          conversationId,
          userId: user.id,
          readAt: now,
        });
      }
    }

    return { success: true };
  }

  // ─── Clear / Manage ─────────────────────────────────────

  async clearConversation(user: CurrentUser, conversationId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException('You are not a member of this conversation.');
    }

    await this.prisma.conversationParticipant.update({
      where: { id: participant.id },
      data: { clearedAt: new Date() },
    });

    return { success: true };
  }

  async getUnreadCount(user: CurrentUser) {
    const conversations = await this.prisma.conversationParticipant.findMany({
      where: {
        userId: user.id,
        conversation: { workOrderId: null },
      },
      select: {
        conversationId: true,
        lastReadAt: true,
        clearedAt: true,
      },
    });

    let total = 0;
    for (const conv of conversations) {
      const where: Prisma.MessageWhereInput = {
        conversationId: conv.conversationId,
        senderId: { not: user.id },
      };

      const cutoff = conv.lastReadAt && conv.clearedAt
        ? conv.lastReadAt > conv.clearedAt
          ? conv.lastReadAt
          : conv.clearedAt
        : conv.lastReadAt || conv.clearedAt;

      if (cutoff) {
        where.createdAt = { gt: cutoff };
      }

      total += await this.prisma.message.count({ where });
    }

    return { count: total };
  }

  // ─── Group Management ──────────────────────────────────

  async getGroupMembers(user: CurrentUser, conversationId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException('You are not a member of this conversation.');
    }

    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { createdById: true },
    });

    const members = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            branch: { select: { name: true } },
          },
        },
      },
    });

    return members.map((m) => ({
      id: m.user.id,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      role: m.user.role,
      branchName: m.user.branch?.name || null,
      isCreator: m.user.id === conv?.createdById,
    }));
  }

  async addGroupMembers(
    user: CurrentUser,
    conversationId: string,
    memberIds: string[],
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { isGroup: true, createdById: true, tenantId: true },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }
    if (!conversation.isGroup) {
      throw new BadRequestException('Cannot add members to a 1:1 conversation.');
    }
    if (conversation.createdById !== user.id && user.role !== 'OWNER') {
      throw new ForbiddenException(
        'Only the group creator or Owner can add members.',
      );
    }

    // Validate all members are within contact scope
    const contacts = await this.getContacts(user);
    const contactIds = new Set(contacts.map((c) => c.id));
    for (const memberId of memberIds) {
      if (!contactIds.has(memberId)) {
        throw new ForbiddenException(
          `User ${memberId} is not in your contact list.`,
        );
      }
    }

    // Add only new members (skip existing)
    const existingParticipants =
      await this.prisma.conversationParticipant.findMany({
        where: { conversationId },
        select: { userId: true },
      });
    const existingIds = new Set(existingParticipants.map((p) => p.userId));
    const newMemberIds = memberIds.filter((id) => !existingIds.has(id));

    if (newMemberIds.length > 0) {
      await this.prisma.conversationParticipant.createMany({
        data: newMemberIds.map((userId) => ({
          conversationId,
          userId,
        })),
      });

      // Notify all participants
      const allParticipantIds = [
        ...Array.from(existingIds),
        ...newMemberIds,
      ];
      for (const pid of allParticipantIds) {
        this.websocketsGateway.sendToUser(pid, 'conversation_updated', {
          conversationId,
        });
      }
    }

    return { success: true, addedCount: newMemberIds.length };
  }

  async removeGroupMember(
    user: CurrentUser,
    conversationId: string,
    memberUserId: string,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { isGroup: true, createdById: true },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }
    if (!conversation.isGroup) {
      throw new BadRequestException(
        'Cannot remove members from a 1:1 conversation.',
      );
    }

    // Allow self-leave or creator/Owner removal
    const isSelfLeave = memberUserId === user.id;
    const isCreatorOrOwner =
      conversation.createdById === user.id || user.role === 'OWNER';

    if (!isSelfLeave && !isCreatorOrOwner) {
      throw new ForbiddenException(
        'Only the group creator or Owner can remove members.',
      );
    }

    await this.prisma.conversationParticipant.deleteMany({
      where: {
        conversationId,
        userId: memberUserId,
      },
    });

    // Notify remaining participants
    const remaining = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });

    for (const p of remaining) {
      this.websocketsGateway.sendToUser(p.userId, 'conversation_updated', {
        conversationId,
      });
    }

    // Also notify the removed user
    this.websocketsGateway.sendToUser(
      memberUserId,
      'group_member_removed',
      { conversationId },
    );

    return { success: true };
  }

  async renameGroup(
    user: CurrentUser,
    conversationId: string,
    name: string,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { isGroup: true, createdById: true },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }
    if (!conversation.isGroup) {
      throw new BadRequestException('Cannot rename a 1:1 conversation.');
    }
    if (conversation.createdById !== user.id && user.role !== 'OWNER') {
      throw new ForbiddenException(
        'Only the group creator or Owner can rename the group.',
      );
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { name },
    });

    // Notify participants
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });

    for (const p of participants) {
      this.websocketsGateway.sendToUser(p.userId, 'conversation_updated', {
        conversationId,
      });
    }

    return { success: true };
  }

  // ─── Cron: 7-Day Auto-Delete ───────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldMessages() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);

    try {
      // Delete old messages (read receipts cascade)
      // Exclude messages in Work Order conversations (they should persist)
      const deleted = await this.prisma.message.deleteMany({
        where: {
          createdAt: { lt: cutoff },
          conversation: { workOrderId: null },
        },
      });

      this.logger.log(
        `Messaging cleanup: Deleted ${deleted.count} messages older than 7 days.`,
      );

      // Delete empty conversations (only non-WO conversations)
      const emptied = await this.prisma.conversation.deleteMany({
        where: {
          messages: { none: {} },
          workOrderId: null,
        },
      });

      if (emptied.count > 0) {
        this.logger.log(
          `Messaging cleanup: Removed ${emptied.count} empty conversations.`,
        );
      }
    } catch (err) {
      this.logger.error('Failed to cleanup old messages', err);
    }
  }

  // ─── Work Order Chat ──────────────────────────────────

  /**
   * Get or create a dedicated conversation for a Work Order.
   * Automatically syncs all associated users as participants.
   */
  async getOrCreateWorkOrderConversation(
    user: CurrentUser,
    workOrderId: string,
  ) {
    // 1. Validate the Work Order exists and belongs to the user's tenant
    const workOrder = await this.prisma.workOrder.findFirst({
      where: {
        id: workOrderId,
        tenantId: user.tenantId,
        ...(user.role === 'ADMIN' || user.role === 'TECHNICIAN'
          ? { branchId: user.branchId }
          : {}),
      },
      select: {
        id: true,
        tenantId: true,
        branchId: true,
        folioNumber: true,
        doctorId: true,
        createdById: true,
        doctor: {
          select: {
            id: true,
            name: true,
            userId: true,
          },
        },
        processes: {
          select: {
            technicianId: true,
          },
        },
      },
    });

    if (!workOrder) {
      throw new NotFoundException('Work order not found.');
    }

    // 2. Check if a conversation already exists for this WO
    let conversation = await this.prisma.conversation.findUnique({
      where: { workOrderId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
                branch: { select: { name: true } },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            createdAt: true,
            senderId: true,
            sender: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    });

    // 3. If no conversation exists, create one
    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          tenantId: workOrder.tenantId,
          name: `WO Chat - ${workOrder.folioNumber}`,
          isGroup: true,
          createdById: user.id,
          workOrderId,
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                  branch: { select: { name: true } },
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              content: true,
              createdAt: true,
              senderId: true,
              sender: {
                select: { firstName: true, lastName: true },
              },
            },
          },
        },
      });
    }

    // 4. Sync participants — gather all associated user IDs
    const participantUserIds = new Set<string>();

    // Add the WO creator
    if (workOrder.createdById) {
      participantUserIds.add(workOrder.createdById);
    }

    // Add all tenant owners
    const owners = await this.prisma.user.findMany({
      where: {
        tenantId: workOrder.tenantId,
        role: 'OWNER',
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    owners.forEach((o) => participantUserIds.add(o.id));

    // Add branch admins
    if (workOrder.branchId) {
      const admins = await this.prisma.user.findMany({
        where: {
          tenantId: workOrder.tenantId,
          branchId: workOrder.branchId,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      admins.forEach((a) => participantUserIds.add(a.id));
    }

    // Add assigned technicians
    for (const proc of workOrder.processes) {
      if (proc.technicianId) {
        participantUserIds.add(proc.technicianId);
      }
    }

    // Add doctor's user account (resolves or creates placeholder User with role DOCTOR)
    if (workOrder.doctorId) {
      const docUserId = await this.getOrCreateDoctorUser(
        workOrder.tenantId,
        workOrder.branchId,
        workOrder.doctorId,
      );
      if (docUserId) {
        participantUserIds.add(docUserId);
      }
    }

    // 5. Upsert participants
    const existingParticipantIds = new Set(
      conversation.participants.map((p) => p.user.id),
    );
    const newParticipantIds = Array.from(participantUserIds).filter(
      (id) => !existingParticipantIds.has(id),
    );

    if (newParticipantIds.length > 0) {
      await this.prisma.conversationParticipant.createMany({
        data: newParticipantIds.map((userId) => ({
          conversationId: conversation!.id,
          userId,
        })),
        skipDuplicates: true,
      });

      // Re-fetch conversation with updated participants
      conversation = await this.prisma.conversation.findUnique({
        where: { id: conversation!.id },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                  branch: { select: { name: true } },
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              content: true,
              createdAt: true,
              senderId: true,
              sender: {
                select: { firstName: true, lastName: true },
              },
            },
          },
        },
      });
    }

    // 6. Calculate unread count for the requesting user
    const myParticipant = conversation!.participants.find(
      (p) => p.user.id === user.id,
    );
    const lastReadAt = myParticipant?.lastReadAt;

    const unreadWhere: Prisma.MessageWhereInput = {
      conversationId: conversation!.id,
      senderId: { not: user.id },
    };
    if (lastReadAt) {
      unreadWhere.createdAt = { gt: lastReadAt };
    }
    const unreadCount = await this.prisma.message.count({ where: unreadWhere });

    const lastMessage = conversation!.messages[0] || null;

    return {
      id: conversation!.id,
      name: conversation!.name,
      isGroup: conversation!.isGroup,
      workOrderId: conversation!.workOrderId,
      createdById: conversation!.createdById,
      participants: conversation!.participants.map((p) => ({
        id: p.user.id,
        firstName: p.user.firstName,
        lastName: p.user.lastName,
        role: p.user.role,
        branchName: p.user.branch?.name || null,
      })),
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            content: lastMessage.content,
            createdAt: lastMessage.createdAt,
            senderId: lastMessage.senderId,
            senderName: `${lastMessage.sender.firstName} ${lastMessage.sender.lastName}`.trim(),
          }
        : null,
      unreadCount,
    };
  }

  /**
   * Resolve or create a User record for a doctor.
   */
  private async getOrCreateDoctorUser(
    tenantId: string,
    branchId: string | null,
    doctorId: string,
  ) {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        userId: true,
        user: { select: { id: true } },
      },
    });

    if (!doctor) return null;

    // If doctor already has a linked user, return it
    if (doctor.userId && doctor.user) {
      return doctor.user.id;
    }

    // Create a placeholder User with DOCTOR role
    const dummyHash = await bcrypt.hash(`doctor-${doctor.id}-${Date.now()}`, 10);
    const nameParts = doctor.name.split(' ');
    const firstName = nameParts[0] || 'Doctor';
    const lastName = nameParts.slice(1).join(' ') || '';

    const newUser = await this.prisma.user.create({
      data: {
        tenantId,
        branchId: branchId || null,
        email: doctor.email || `doctor-${doctor.id}@placeholder.local`,
        passwordHash: dummyHash,
        firstName,
        lastName,
        role: 'DOCTOR',
        status: 'ACTIVE',
      },
    });

    // Link doctor to user
    await this.prisma.doctor.update({
      where: { id: doctor.id },
      data: { userId: newUser.id },
    });

    this.logger.log(
      `Created placeholder User (${newUser.id}) for doctor ${doctor.name} (${doctor.id})`,
    );

    return newUser.id;
  }

  /**
   * Get unread message counts for all dedicated Work Order conversations for a user.
   */
  async getWorkOrderUnreadCounts(user: CurrentUser) {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: {
        userId: user.id,
        conversation: { workOrderId: { not: null } },
      },
      select: {
        lastReadAt: true,
        clearedAt: true,
        conversation: {
          select: {
            id: true,
            workOrderId: true,
          },
        },
      },
    });

    const result: Record<string, number> = {};

    for (const part of participants) {
      const workOrderId = part.conversation.workOrderId;
      if (!workOrderId) continue;

      const cutoff = part.lastReadAt && part.clearedAt
        ? part.lastReadAt > part.clearedAt
          ? part.lastReadAt
          : part.clearedAt
        : part.lastReadAt || part.clearedAt;

      const where: Prisma.MessageWhereInput = {
        conversationId: part.conversation.id,
        senderId: { not: user.id },
      };

      if (cutoff) {
        where.createdAt = { gt: cutoff };
      }

      const count = await this.prisma.message.count({ where });
      result[workOrderId] = count;
    }

    return result;
  }
}
