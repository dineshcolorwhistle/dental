import api from './api';

export interface ApiKeyItem {
  id: string;
  name: string;
  key: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  branch?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface CreateApiKeyPayload {
  name: string;
}

export const apiKeyService = {
  getAll: async (): Promise<ApiKeyItem[]> => {
    const response = await api.get<ApiKeyItem[]>('/api-keys');
    return response.data;
  },

  create: async (payload: CreateApiKeyPayload): Promise<ApiKeyItem> => {
    const response = await api.post<ApiKeyItem>('/api-keys', payload);
    return response.data;
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    const response = await api.delete<{ success: boolean }>(`/api-keys/${id}`);
    return response.data;
  },
};
