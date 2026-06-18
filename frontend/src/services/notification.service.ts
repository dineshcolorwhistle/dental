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

  getPushPublicKey: async (): Promise<{ publicKey: string | null }> => {
    const response = await api.get<{ publicKey: string | null }>('/notifications/push-public-key');
    return response.data;
  },

  subscribePush: async (subscription: any): Promise<{ success: boolean }> => {
    const response = await api.post<{ success: boolean }>('/notifications/push-subscribe', subscription);
    return response.data;
  },

  unsubscribePush: async (endpoint: string): Promise<{ success: boolean }> => {
    const response = await api.post<{ success: boolean }>('/notifications/push-unsubscribe', { endpoint });
    return response.data;
  },
};
