import api from './api';

export interface LoginPayload {
  email: string;
  password: string;
  subdomain?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'SUPER_ADMIN' | 'OWNER' | 'ADMIN' | 'TECHNICIAN' | 'DELIVERY';
  tenantId: string | null;
  tenantName?: string | null;
  branchId: string | null;
  branchName?: string | null;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile extends AuthUser {
  phone: string | null;
  status: string;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  tenant: {
    id: string;
    name: string;
    subdomain: string;
  } | null;
  branch: {
    id: string;
    name: string;
    code: string;
  } | null;
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
};
