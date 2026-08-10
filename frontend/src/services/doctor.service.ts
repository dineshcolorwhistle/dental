import api from './api';

export interface DoctorListItem {
  id: string;
  tenantId: string;
  branchId: string | null;
  clinicId: string | null;
  externalId: string | null;
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

export interface DoctorListMemberItem {
  id: string;
  listId: string;
  doctorId: string;
  createdAt: string;
  doctor: {
    id: string;
    name: string;
    clinicName: string | null;
    email: string | null;
    phone: string | null;
  };
}

export interface DoctorGroupListItem {
  id: string;
  tenantId: string;
  branchId: string | null;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  branch?: {
    id: string;
    name: string;
    code: string;
  };
  members: DoctorListMemberItem[];
}

export interface CreateDoctorListPayload {
  name: string;
  description?: string;
  branchId?: string;
  doctorIds?: string[];
}

export interface UpdateDoctorListPayload {
  name?: string;
  description?: string;
  branchId?: string;
  doctorIds?: string[];
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

  // ─── Doctor Lists API ──────────────────────────────────────────

  getLists: async (branchId?: string): Promise<DoctorGroupListItem[]> => {
    const params = branchId && branchId !== 'ALL' ? { branchId } : {};
    const response = await api.get<DoctorGroupListItem[]>('/doctors/lists/all', { params });
    return response.data;
  },

  getListById: async (id: string): Promise<DoctorGroupListItem> => {
    const response = await api.get<DoctorGroupListItem>(`/doctors/lists/detail/${id}`);
    return response.data;
  },

  createList: async (payload: CreateDoctorListPayload): Promise<DoctorGroupListItem> => {
    const response = await api.post<DoctorGroupListItem>('/doctors/lists/create', payload);
    return response.data;
  },

  updateList: async (id: string, payload: UpdateDoctorListPayload): Promise<DoctorGroupListItem> => {
    const response = await api.patch<DoctorGroupListItem>(`/doctors/lists/update/${id}`, payload);
    return response.data;
  },

  deleteList: async (id: string): Promise<{ success: boolean }> => {
    const response = await api.delete<{ success: boolean }>(`/doctors/lists/delete/${id}`);
    return response.data;
  },
};
