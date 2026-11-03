import api from './api';

export interface TechnicianListItem {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: 'TECHNICIAN' | 'ADMIN' | 'OWNER' | 'SUPER_ADMIN';
  status: 'ACTIVE' | 'INACTIVE' | 'INVITED';
  createdAt: string;
  updatedAt: string;
  branch?: {
    id: string;
    name: string;
    code: string;
    defaultTechnicianId?: string | null;
  };
}

export interface InactivationCheckResult {
  canInactivate: boolean;
  isDefaultTechnician: boolean;
  activeWorkOrders: string[];
  pendingProcessesCount: number;
  defaultTechnician: { id: string; name: string; email: string } | null;
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
  getAll: async (branchId?: string, includeAdmins?: boolean): Promise<TechnicianListItem[]> => {
    const params: Record<string, string> = {};
    if (branchId && branchId !== 'ALL') params.branchId = branchId;
    if (includeAdmins) params.includeAdmins = 'true';
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

  setDefaultTechnician: async (technicianId: string): Promise<{ success: boolean; defaultTechnicianId: string }> => {
    const response = await api.patch<{ success: boolean; defaultTechnicianId: string }>(`/technicians/${technicianId}/set-default`);
    return response.data;
  },

  checkInactivation: async (technicianId: string): Promise<InactivationCheckResult> => {
    const response = await api.get<InactivationCheckResult>(`/technicians/${technicianId}/inactivation-check`);
    return response.data;
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    const response = await api.delete<{ success: boolean }>(`/technicians/${id}`);
    return response.data;
  },
};
