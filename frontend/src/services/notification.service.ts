import api from './api';

export interface NotificationItem {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  referenceId: string | null;
  isRead: boolean;
  createdAt: string;
}

export const notificationService = {
  getAll: async (): Promise<NotificationItem[]> => {
    const response = await api.get<NotificationItem[]>('/notifications');
    return response.data;
  },

  getUnreadCount: async (): Promise<{ count: number }> => {
    const response = await api.get<{ count: number }>('/notifications/unread-count');
    return response.data;
  },

  markRead: async (id: string): Promise<{ success: boolean }> => {
    const response = await api.patch<{ success: boolean }>(`/notifications/${id}/read`);
    return response.data;
  },

  markAllRead: async (): Promise<{ success: boolean }> => {
    const response = await api.patch<{ success: boolean }>('/notifications/read-all');
    return response.data;
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    const response = await api.delete<{ success: boolean }>(`/notifications/${id}`);
    return response.data;
  },
};
