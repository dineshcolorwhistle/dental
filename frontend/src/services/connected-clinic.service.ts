import api from './api';

export interface ConnectedClinicDoctorItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  workOrders: Array<{
    id: string;
    status: string;
  }>;
}

export interface ConnectedClinicProsthesisItem {
  prosthesisType: {
    id: string;
    name: string;
    description: string | null;
    price?: number | null;
  };
  price?: number | null;
}

export interface ConnectedClinicListItem {
  id: string;
  tenantId: string;
  branchId: string;
  name: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  branch: {
    id: string;
    name: string;
    code: string;
  };
  doctors: ConnectedClinicDoctorItem[];
  allowedProsthesisTypes?: ConnectedClinicProsthesisItem[];
}

export interface UpdateClinicProsthesisItem {
  prosthesisTypeId: string;
  price?: number;
}

export const connectedClinicService = {
  getAll: async (): Promise<ConnectedClinicListItem[]> => {
    const response = await api.get<ConnectedClinicListItem[]>('/connected-clinics');
    return response.data;
  },

  updateProsthesisTypes: async (
    clinicId: string,
    payload: string[] | UpdateClinicProsthesisItem[]
  ): Promise<ConnectedClinicListItem> => {
    const body = Array.isArray(payload) && payload.length > 0 && typeof payload[0] === 'object'
      ? { items: payload }
      : { prosthesisTypeIds: payload as string[] };
    const response = await api.put<ConnectedClinicListItem>(
      `/connected-clinics/${clinicId}/prosthesis-types`,
      body
    );
    return response.data;
  },
};
