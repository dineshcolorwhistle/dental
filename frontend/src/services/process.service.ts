import api from './api';
import { type ProsthesisTypeListItem } from './prosthesis-type.service';

export interface ProcessListItem {
  id: string;
  tenantId: string;
  branchId: string | null;
  name: string;
  processArea: string;
  defaultTechnicianId: string;
  prosthesisTypeId: string;
  sequence: number;
  createdAt: string;
  updatedAt: string;
  prosthesisType: ProsthesisTypeListItem;
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
}

export interface CreateProcessPayload {
  name: string;
  processArea: string;
  defaultTechnicianId: string;
  prosthesisTypeId: string;
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

  reorder: async (prosthesisTypeId: string, processIds: string[]): Promise<{ success: boolean }> => {
    const response = await api.post<{ success: boolean }>('/processes/reorder', {
      prosthesisTypeId,
      processIds,
    });
    return response.data;
  },
};
