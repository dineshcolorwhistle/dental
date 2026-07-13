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

    return message;
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
      where: { userId: user.id },
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
      const deleted = await this.prisma.message.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });

      this.logger.log(
        `Messaging cleanup: Deleted ${deleted.count} messages older than 7 days.`,
      );

      // Delete empty conversations
      const emptied = await this.prisma.conversation.deleteMany({
        where: { messages: { none: {} } },
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
}
