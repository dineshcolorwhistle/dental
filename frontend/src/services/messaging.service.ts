import api from './api';

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  branch: { id: string; name: string } | null;
}

export interface ConversationParticipant {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  branchName: string | null;
}

export interface ConversationSummary {
  id: string;
  name: string | null;
  isGroup: boolean;
  createdById: string | null;
  participants: ConversationParticipant[];
  lastMessage: {
    id: string;
    content: string;
    createdAt: string;
    senderId: string;
    senderName: string;
  } | null;
  unreadCount: number;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender: { id: string; firstName: string; lastName: string };
  readReceipts: { userId: string; readAt: string }[];
  conversation?: { workOrderId: string | null };
}

export interface GroupMember {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  branchName: string | null;
  isCreator: boolean;
}

export const messagingService = {
  getContacts: async (): Promise<Contact[]> => {
    const { data } = await api.get<Contact[]>('/messages/contacts');
    return data;
  },

  getConversations: async (): Promise<ConversationSummary[]> => {
    const { data } = await api.get<ConversationSummary[]>(
      '/messages/conversations',
    );
    return data;
  },

  createConversation: async (
    targetUserId: string,
  ): Promise<{ id: string; name: string | null; isGroup: boolean; participants: ConversationParticipant[] }> => {
    const { data } = await api.post('/messages/conversations', {
      targetUserId,
    });
    return data;
  },

  createGroup: async (
    name: string,
    memberIds: string[],
  ): Promise<{ id: string; name: string; isGroup: boolean; participants: ConversationParticipant[] }> => {
    const { data } = await api.post('/messages/conversations/group', {
      name,
      memberIds,
    });
    return data;
  },

  getMessages: async (
    conversationId: string,
    cursor?: string,
    limit?: number,
  ): Promise<{ messages: ChatMessage[]; hasMore: boolean }> => {
    const params: Record<string, string> = {};
    if (cursor) params.cursor = cursor;
    if (limit) params.limit = limit.toString();
    const { data } = await api.get(
      `/messages/conversations/${conversationId}`,
      { params },
    );
    return data;
  },

  sendMessage: async (
    conversationId: string,
    content: string,
  ): Promise<ChatMessage> => {
    const { data } = await api.post(
      `/messages/conversations/${conversationId}/messages`,
      { content },
    );
    return data;
  },

  markSeen: async (
    conversationId: string,
  ): Promise<{ success: boolean }> => {
    const { data } = await api.patch(
      `/messages/conversations/${conversationId}/seen`,
    );
    return data;
  },

  clearConversation: async (
    conversationId: string,
  ): Promise<{ success: boolean }> => {
    const { data } = await api.patch(
      `/messages/conversations/${conversationId}/clear`,
    );
    return data;
  },

  getUnreadCount: async (): Promise<{ count: number }> => {
    const { data } = await api.get<{ count: number }>(
      '/messages/unread-count',
    );
    return data;
  },

  getGroupMembers: async (
    conversationId: string,
  ): Promise<GroupMember[]> => {
    const { data } = await api.get<GroupMember[]>(
      `/messages/conversations/${conversationId}/members`,
    );
    return data;
  },

  addGroupMembers: async (
    conversationId: string,
    memberIds: string[],
  ): Promise<{ success: boolean; addedCount: number }> => {
    const { data } = await api.post(
      `/messages/conversations/${conversationId}/members`,
      { memberIds },
    );
    return data;
  },

  removeGroupMember: async (
    conversationId: string,
    userId: string,
  ): Promise<{ success: boolean }> => {
    const { data } = await api.delete(
      `/messages/conversations/${conversationId}/members/${userId}`,
    );
    return data;
  },

  renameGroup: async (
    conversationId: string,
    name: string,
  ): Promise<{ success: boolean }> => {
    const { data } = await api.patch(
      `/messages/conversations/${conversationId}/name`,
      { name },
    );
    return data;
  },

  getOrCreateWorkOrderConversation: async (
    workOrderId: string,
  ): Promise<ConversationSummary> => {
    const { data } = await api.get<ConversationSummary>(
      `/messages/work-orders/${workOrderId}`,
    );
    return data;
  },

  getWorkOrderUnreadCounts: async (): Promise<Record<string, number>> => {
    const { data } = await api.get<Record<string, number>>(
      '/messages/work-orders/unread-counts',
    );
    return data;
  },
};
