import api from './api';

export interface ProcessListItem {
  id: string;
  tenantId: string;
  branchId: string | null;
  name: string;
  processArea: string;
  processAreaId?: string | null;
  defaultTechnicianId: string;
  createdAt: string;
  updatedAt: string;
  branch?: {
    id: string;
    name: string;
  };
  defaultTechnician?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  prosthesisTypeAssignments?: {
    id: string;
    sequence: number;
    prosthesisType: {
      id: string;
      name: string;
    };
  }[];
}

export interface CreateProcessPayload {
  name: string;
  processAreaId: string;
  defaultTechnicianId: string;
  branchId?: string;
}

export const processService = {
  getAll: async (branchId?: string): Promise<ProcessListItem[]> => {
    const params = branchId && branchId !== 'ALL' ? { branchId } : {};
    const response = await api.get<ProcessListItem[]>('/processes', { params });
    return response.data;
  },

  getById: async (id: string): Promise<ProcessListItem> => {
    const response = await api.get<ProcessListItem>(`/processes/${id}`);
    return response.data;
  },

  create: async (payload: CreateProcessPayload): Promise<ProcessListItem> => {
    const response = await api.post<ProcessListItem>('/processes', payload);
    return response.data;
  },

  update: async (id: string, payload: Partial<CreateProcessPayload>): Promise<ProcessListItem> => {
    const response = await api.patch<ProcessListItem>(`/processes/${id}`, payload);
    return response.data;
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    const response = await api.delete<{ success: boolean }>(`/processes/${id}`);
    return response.data;
  },
};
