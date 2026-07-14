import api from './api';

export interface ProcessAreaListItem {
  id: string;
  tenantId: string;
  branchId: string | null;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  branch?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface CreateProcessAreaPayload {
  name: string;
  description?: string;
  branchId?: string;
}

export const processAreaService = {
  getAll: async (branchId?: string): Promise<ProcessAreaListItem[]> => {
    const params = branchId && branchId !== 'ALL' ? { branchId } : {};
    const response = await api.get<ProcessAreaListItem[]>('/process-areas', { params });
    return response.data;
  },

  getById: async (id: string): Promise<ProcessAreaListItem> => {
    const response = await api.get<ProcessAreaListItem>(`/process-areas/${id}`);
    return response.data;
  },

  create: async (payload: CreateProcessAreaPayload): Promise<ProcessAreaListItem> => {
    const response = await api.post<ProcessAreaListItem>('/process-areas', payload);
    return response.data;
  },

  update: async (id: string, payload: Partial<CreateProcessAreaPayload>): Promise<ProcessAreaListItem> => {
    const response = await api.patch<ProcessAreaListItem>(`/process-areas/${id}`, payload);
    return response.data;
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    const response = await api.delete<{ success: boolean }>(`/process-areas/${id}`);
    return response.data;
  },
};
