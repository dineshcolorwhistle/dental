import api from './api';

export interface TechnicianListItem {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: 'TECHNICIAN';
  status: 'ACTIVE' | 'INACTIVE' | 'INVITED';
  createdAt: string;
  updatedAt: string;
  branch?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface CreateTechnicianPayload {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  branchId: string;
}

export interface UpdateTechnicianPayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  branchId?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'INVITED';
}

export const technicianService = {
  getAll: async (branchId?: string): Promise<TechnicianListItem[]> => {
    const params = branchId && branchId !== 'ALL' ? { branchId } : {};
    const response = await api.get<TechnicianListItem[]>('/technicians', { params });
    return response.data;
  },

  getById: async (id: string): Promise<TechnicianListItem> => {
    const response = await api.get<TechnicianListItem>(`/technicians/${id}`);
    return response.data;
  },

  create: async (payload: CreateTechnicianPayload): Promise<TechnicianListItem> => {
    const response = await api.post<TechnicianListItem>('/technicians', payload);
    return response.data;
  },

  update: async (id: string, payload: UpdateTechnicianPayload): Promise<TechnicianListItem> => {
    const response = await api.patch<TechnicianListItem>(`/technicians/${id}`, payload);
    return response.data;
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    const response = await api.delete<{ success: boolean }>(`/technicians/${id}`);
    return response.data;
  },
};
