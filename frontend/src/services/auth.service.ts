import api from './api';

export interface LoginPayload {
  email: string;
  password: string;
  subdomain?: string;
  role?: 'SUPER_ADMIN' | 'OWNER' | 'ADMIN' | 'TECHNICIAN' | 'DELIVERY' | 'DOCTOR';
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'SUPER_ADMIN' | 'OWNER' | 'ADMIN' | 'TECHNICIAN' | 'DELIVERY' | 'DOCTOR';
  tenantId: string | null;
  tenantName?: string | null;
  branchId: string | null;
  branchName?: string | null;
  maxAdmins?: number | null;
  maxTechnicians?: number | null;
  preferredLanguage?: 'EN' | 'ES' | null;
}

export interface AuthResponse {
  user?: AuthUser;
  accessToken?: string;
  refreshToken?: string;
  requiresRoleSelection?: boolean;
  roles?: ('OWNER' | 'ADMIN')[];
}

export interface UserProfile extends AuthUser {
  phone: string | null;
  status: string;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  preferredLanguage: 'EN' | 'ES';
  tenant: {
    id: string;
    name: string;
    subdomain: string;
    maxAdmins?: number;
    maxTechnicians?: number;
  } | null;
  branch: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface TenantLimitsResponse {
  maxAdmins: number;
  currentAdmins: number;
  maxTechnicians: number;
  currentTechnicians: number;
}

export const authService = {
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/login', payload);
    return data;
  },

  refresh: async (refreshToken: string): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/refresh', {
      refreshToken,
    });
    return data;
  },

  resetPassword: async (payload: { token: string; newPassword: string }) => {
    const { data } = await api.post('/auth/reset-password', payload);
    return data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  getProfile: async (): Promise<UserProfile> => {
    const { data } = await api.get<UserProfile>('/auth/profile');
    return data;
  },

  getTenantLimits: async (): Promise<TenantLimitsResponse> => {
    const { data } = await api.get<TenantLimitsResponse>('/auth/tenant-limits');
    return data;
  },

  requestTenantLimitIncrease: async (message: string): Promise<void> => {
    await api.post('/auth/tenant-limits/request', { message });
  },

  updateLanguage: async (language: 'EN' | 'ES'): Promise<{ message: string; language: string }> => {
    const { data } = await api.patch('/auth/language', { language });
    return data;
  },
  getTenantInfo: async (subdomain: string): Promise<{ name: string; status: string }> => {
    const { data } = await api.get<{ name: string; status: string }>(`/auth/tenant-info/${subdomain}`);
    return data;
  },
};

