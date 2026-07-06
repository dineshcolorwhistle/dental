import api from './api';

// ─── Types ───────────────────────────────────────────────

export interface CreateAdminPayload {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  branchId: string;
}

export interface AdminListItem {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: 'ADMIN';
  status: 'ACTIVE' | 'INACTIVE' | 'INVITED';
  createdAt: string;
  updatedAt: string;
  branch: {
    id: string;
    name: string;
    code: string;
    defaultAdminId?: string | null;
  } | null;
  isOwnerAdmin?: boolean;
}

// ─── Service ─────────────────────────────────────────────

export const adminService = {
  create: async (payload: CreateAdminPayload): Promise<AdminListItem> => {
    const { data } = await api.post<AdminListItem>('/admins', payload);
    return data;
  },

  getAll: async (branchId?: string): Promise<AdminListItem[]> => {
    const params = branchId ? { branchId } : undefined;
    const { data } = await api.get<AdminListItem[]>('/admins', { params });
    return data;
  },

  getById: async (id: string): Promise<AdminListItem> => {
    const { data } = await api.get<AdminListItem>(`/admins/${id}`);
    return data;
  },

  update: async (
    id: string,
    payload: Partial<CreateAdminPayload> & { status?: 'ACTIVE' | 'INACTIVE' | 'INVITED' },
  ): Promise<AdminListItem> => {
    const { data } = await api.patch<AdminListItem>(`/admins/${id}`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/admins/${id}`);
  },
};
