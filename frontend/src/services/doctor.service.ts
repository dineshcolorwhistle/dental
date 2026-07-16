import api from './api';

export interface DoctorListItem {
  id: string;
  tenantId: string;
  branchId: string | null;
  name: string;
  clinicName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  branch?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface CreateDoctorPayload {
  name: string;
  clinicName?: string;
  email?: string;
  phone?: string;
  address?: string;
  branchId?: string;
}

export interface UpdateDoctorPayload {
  name?: string;
  clinicName?: string;
  email?: string;
  phone?: string;
  address?: string;
  branchId?: string;
  isActive?: boolean;
}

export const doctorService = {
  getAll: async (branchId?: string): Promise<DoctorListItem[]> => {
    const params = branchId && branchId !== 'ALL' ? { branchId } : {};
    const response = await api.get<DoctorListItem[]>('/doctors', { params });
    return response.data;
  },

  getById: async (id: string): Promise<DoctorListItem> => {
    const response = await api.get<DoctorListItem>(`/doctors/${id}`);
    return response.data;
  },

  create: async (payload: CreateDoctorPayload): Promise<DoctorListItem> => {
    const response = await api.post<DoctorListItem>('/doctors', payload);
    return response.data;
  },

  update: async (id: string, payload: UpdateDoctorPayload): Promise<DoctorListItem> => {
    const response = await api.patch<DoctorListItem>(`/doctors/${id}`, payload);
    return response.data;
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    const response = await api.delete<{ success: boolean }>(`/doctors/${id}`);
    return response.data;
  },
};
