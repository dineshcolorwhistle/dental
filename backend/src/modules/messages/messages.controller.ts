import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { MessagesService } from './messages.service';
import {
  SendMessageDto,
  CreateConversationDto,
  CreateGroupDto,
  AddMembersDto,
  RenameGroupDto,
} from './dto';
import { Roles, CurrentUser } from '../../common/decorators';

@ApiTags('Messages')
@ApiBearerAuth()
@Controller('messages')
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.DOCTOR)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('contacts')
  @ApiOperation({ summary: 'List contactable users (role-based visibility)' })
  async getContacts(
    @CurrentUser() user: any,
  ) {
    return this.messagesService.getContacts({
      id: user.id,
      tenantId: user.tenantId,
      branchId: user.branchId,
      role: user.role,
    });
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List user conversations with last message & unread count' })
  async getConversations(
    @CurrentUser() user: any,
  ) {
    return this.messagesService.getConversations({
      id: user.id,
      tenantId: user.tenantId,
      branchId: user.branchId,
      role: user.role,
    });
  }

  @Post('conversations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create or get a 1:1 conversation' })
  async createConversation(
    @CurrentUser() user: any,
    @Body() dto: CreateConversationDto,
  ) {
    return this.messagesService.createConversation(
      {
        id: user.id,
        tenantId: user.tenantId,
        branchId: user.branchId,
        role: user.role,
      },
      dto.targetUserId,
    );
  }

  @Post('conversations/group')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new group conversation' })
  async createGroup(
    @CurrentUser() user: any,
    @Body() dto: CreateGroupDto,
  ) {
    return this.messagesService.createGroup(
      {
        id: user.id,
        tenantId: user.tenantId,
        branchId: user.branchId,
        role: user.role,
      },
      dto.name,
      dto.memberIds,
    );
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get messages in a conversation (paginated)' })
  async getMessages(
    @CurrentUser() user: any,
    @Param('id') conversationId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messagesService.getMessages(
      {
        id: user.id,
        tenantId: user.tenantId,
        branchId: user.branchId,
        role: user.role,
      },
      conversationId,
      cursor,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('conversations/:id/members')
  @ApiOperation({ summary: 'Get group members list' })
  async getGroupMembers(
    @CurrentUser() user: any,
    @Param('id') conversationId: string,
  ) {
    return this.messagesService.getGroupMembers(
      {
        id: user.id,
        tenantId: user.tenantId,
        branchId: user.branchId,
        role: user.role,
      },
      conversationId,
    );
  }

  @Post('conversations/:id/members')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add members to a group' })
  async addGroupMembers(
    @CurrentUser() user: any,
    @Param('id') conversationId: string,
    @Body() dto: AddMembersDto,
  ) {
    return this.messagesService.addGroupMembers(
      {
        id: user.id,
        tenantId: user.tenantId,
        branchId: user.branchId,
        role: user.role,
      },
      conversationId,
      dto.memberIds,
    );
  }

  @Delete('conversations/:id/members/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a member from a group' })
  async removeGroupMember(
    @CurrentUser() user: any,
    @Param('id') conversationId: string,
    @Param('userId') memberUserId: string,
  ) {
    return this.messagesService.removeGroupMember(
      {
        id: user.id,
        tenantId: user.tenantId,
        branchId: user.branchId,
        role: user.role,
      },
      conversationId,
      memberUserId,
    );
  }

  @Patch('conversations/:id/name')
  @ApiOperation({ summary: 'Rename a group conversation' })
  async renameGroup(
    @CurrentUser() user: any,
    @Param('id') conversationId: string,
    @Body() dto: RenameGroupDto,
  ) {
    return this.messagesService.renameGroup(
      {
        id: user.id,
        tenantId: user.tenantId,
        branchId: user.branchId,
        role: user.role,
      },
      conversationId,
      dto.name,
    );
  }

  @Post('conversations/:id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a message' })
  async sendMessage(
    @CurrentUser() user: any,
    @Param('id') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(
      {
        id: user.id,
        tenantId: user.tenantId,
        branchId: user.branchId,
        role: user.role,
      },
      conversationId,
      dto.content,
    );
  }

  @Patch('conversations/:id/seen')
  @ApiOperation({ summary: 'Mark all messages as seen' })
  async markSeen(
    @CurrentUser() user: any,
    @Param('id') conversationId: string,
  ) {
    return this.messagesService.markSeen(
      {
        id: user.id,
        tenantId: user.tenantId,
        branchId: user.branchId,
        role: user.role,
      },
      conversationId,
    );
  }

  @Patch('conversations/:id/clear')
  @ApiOperation({ summary: 'Clear conversation (hide old messages)' })
  async clearConversation(
    @CurrentUser() user: any,
    @Param('id') conversationId: string,
  ) {
    return this.messagesService.clearConversation(
      {
        id: user.id,
        tenantId: user.tenantId,
        branchId: user.branchId,
        role: user.role,
      },
      conversationId,
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get total unread message count' })
  async getUnreadCount(
    @CurrentUser() user: any,
  ) {
    return this.messagesService.getUnreadCount({
      id: user.id,
      tenantId: user.tenantId,
      branchId: user.branchId,
      role: user.role,
    });
  }

  @Get('work-orders/unread-counts')
  @ApiOperation({ summary: 'Get unread chat counts for all dedicated Work Order conversations' })
  async getWorkOrderUnreadCounts(
    @CurrentUser() user: any,
  ) {
    return this.messagesService.getWorkOrderUnreadCounts({
      id: user.id,
      tenantId: user.tenantId,
      branchId: user.branchId,
      role: user.role,
    });
  }

  @Get('work-orders/:workOrderId')
  @ApiOperation({ summary: 'Get or create a dedicated Work Order conversation' })
  async getWorkOrderConversation(
    @CurrentUser() user: any,
    @Param('workOrderId') workOrderId: string,
  ) {
    return this.messagesService.getOrCreateWorkOrderConversation(
      {
        id: user.id,
        tenantId: user.tenantId,
        branchId: user.branchId,
        role: user.role,
      },
      workOrderId,
    );
  }
}
