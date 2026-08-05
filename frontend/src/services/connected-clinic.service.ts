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
  allowedProsthesisTypes?: Array<{
    prosthesisType: {
      id: string;
      name: string;
      description: string | null;
    };
  }>;
}

export const connectedClinicService = {
  getAll: async (): Promise<ConnectedClinicListItem[]> => {
    const response = await api.get<ConnectedClinicListItem[]>('/connected-clinics');
    return response.data;
  },

  updateProsthesisTypes: async (
    clinicId: string,
    prosthesisTypeIds: string[]
  ): Promise<ConnectedClinicListItem> => {
    const response = await api.put<ConnectedClinicListItem>(
      `/connected-clinics/${clinicId}/prosthesis-types`,
      { prosthesisTypeIds }
    );
    return response.data;
  },
};

