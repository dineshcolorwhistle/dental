import api from './api';

// ─── Types ───────────────────────────────────────────────

export interface CreateTenantPayload {
  tenantName: string;
  ownerName: string;
  branchName?: string;
  ownerEmail: string;
  maxOwners: number;
  maxAdmins: number;
  maxTechnicians: number;
}

export interface TenantOwner {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status?: string;
}

export interface TenantBranch {
  id: string;
  name: string;
  code?: string;
}

export interface TenantListItem {
  id: string;
  name: string;
  subdomain: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
  branchCount: number;
  userCount: number;
  owner: TenantOwner | null;
  primaryBranch: TenantBranch | null;
  settings?: {
    features?: Record<string, boolean>;
  } | null;
  maxOwners: number;
  maxAdmins: number;
  maxTechnicians: number;
}

export interface CreateTenantResponse {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  owner: TenantOwner;
  branch?: TenantBranch | null;
  createdAt: string;
}

// ─── Service ─────────────────────────────────────────────

export const tenantService = {
  create: async (payload: CreateTenantPayload): Promise<CreateTenantResponse> => {
    const { data } = await api.post<CreateTenantResponse>('/tenants', payload);
    return data;
  },

  getAll: async (): Promise<TenantListItem[]> => {
    const { data } = await api.get<TenantListItem[]>('/tenants');
    return data;
  },

  getById: async (id: string): Promise<TenantListItem> => {
    const { data } = await api.get<TenantListItem>(`/tenants/${id}`);
    return data;
  },

  update: async (
    id: string,
    payload: Partial<{
      name: string;
      contactEmail: string;
      contactPhone: string;
      address: string;
      status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
      settings: { features?: Record<string, boolean> };
      maxOwners?: number;
      maxAdmins?: number;
      maxTechnicians?: number;
    }>,
  ): Promise<TenantListItem> => {
    const { data } = await api.patch<TenantListItem>(`/tenants/${id}`, payload);
    return data;
  },

  updateStatus: async (
    id: string,
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
  ): Promise<TenantListItem> => {
    const { data } = await api.patch<TenantListItem>(`/tenants/${id}/status`, { status });
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/tenants/${id}`);
  },

  getMyProfile: async (): Promise<{ id: string; name: string; subdomain: string; logoUrl: string | null }> => {
    const { data } = await api.get<{ id: string; name: string; subdomain: string; logoUrl: string | null }>('/tenants/my/profile');
    return data;
  },

  updateMyProfile: async (payload: { logoUrl: string }): Promise<{ id: string; name: string; subdomain: string; logoUrl: string | null }> => {
    const { data } = await api.patch<{ id: string; name: string; subdomain: string; logoUrl: string | null }>('/tenants/my/profile', payload);
    return data;
  },
};
