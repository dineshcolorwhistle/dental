import api from './api';

export interface ProsthesisTypeListItem {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProsthesisTypePayload {
  name: string;
  description?: string;
}

export const prosthesisTypeService = {
  getAll: async (): Promise<ProsthesisTypeListItem[]> => {
    const response = await api.get<ProsthesisTypeListItem[]>('/prosthesis-types');
    return response.data;
  },

  getById: async (id: string): Promise<ProsthesisTypeListItem> => {
    const response = await api.get<ProsthesisTypeListItem>(`/prosthesis-types/${id}`);
    return response.data;
  },

  create: async (payload: CreateProsthesisTypePayload): Promise<ProsthesisTypeListItem> => {
    const response = await api.post<ProsthesisTypeListItem>('/prosthesis-types', payload);
    return response.data;
  },

  update: async (id: string, payload: Partial<CreateProsthesisTypePayload>): Promise<ProsthesisTypeListItem> => {
    const response = await api.patch<ProsthesisTypeListItem>(`/prosthesis-types/${id}`, payload);
    return response.data;
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    const response = await api.delete<{ success: boolean }>(`/prosthesis-types/${id}`);
    return response.data;
  },
};
