import api from './api';

// ─── Types ───────────────────────────────────────────────

export interface CreateBranchPayload {
  name: string;
  code?: string;
  address?: string;
  phone?: string;
  email?: string;
  isActive?: boolean;
}

export interface BranchListItem {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    users: number;
  };
}

// ─── Service ─────────────────────────────────────────────

export const branchService = {
  create: async (payload: CreateBranchPayload): Promise<BranchListItem> => {
    const { data } = await api.post<BranchListItem>('/branches', payload);
    return data;
  },

  getAll: async (): Promise<BranchListItem[]> => {
    const { data } = await api.get<BranchListItem[]>('/branches');
    return data;
  },

  getById: async (id: string): Promise<BranchListItem> => {
    const { data } = await api.get<BranchListItem>(`/branches/${id}`);
    return data;
  },

  update: async (
    id: string,
    payload: Partial<CreateBranchPayload>,
  ): Promise<BranchListItem> => {
    const { data } = await api.patch<BranchListItem>(`/branches/${id}`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/branches/${id}`);
  },
};
