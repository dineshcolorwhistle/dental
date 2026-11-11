import api from './api';

export interface ConnectedClinicDoctorItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  workOrders: Array<{
    id: string;
    folioNumber?: string;
    patient?: string | null;
    status: string;
    totalQuote?: number | null;
    initialPayment?: number | null;
    deliveryDate?: string | null;
    createdAt?: string;
    prosthesisType?: {
      id: string;
      name: string;
    };
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
  address?: string | null;
  phone?: string | null;
  isConnected: boolean;
  connectedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  branch: {
    id: string;
    name: string;
    code: string;
  };
  doctors: ConnectedClinicDoctorItem[];
  allowedProsthesisTypes?: ConnectedClinicProsthesisItem[];
  totalQuoted?: number;
  totalCollected?: number;
  totalPending?: number;
}

export interface ClinicWorkOrderListItem {
  id: string;
  folioNumber: string;
  patient: string | null;
  status: string;
  totalQuote: number | null;
  initialPayment: number | null;
  collectedAmount: number;
  pendingAmount: number;
  deliveryDate: string | null;
  createdAt: string;
  doctor: {
    id: string;
    name: string;
    email?: string | null;
  };
  prosthesisType?: {
    id: string;
    name: string;
  };
}

export interface ClinicWorkOrdersResponse {
  clinic: {
    id: string;
    name: string;
    url: string;
    branch: {
      id: string;
      name: string;
      code: string;
    };
  };
  summary: {
    totalOrders: number;
    totalQuote: number;
    totalCollected: number;
    totalPending: number;
  };
  workOrders: ClinicWorkOrderListItem[];
}

export interface UpdateClinicProsthesisItem {
  prosthesisTypeId: string;
  price?: number;
}

export interface CreateClinicPayload {
  name: string;
  url: string;
  address?: string;
  phone?: string;
  branchId?: string;
}

export interface UpdateClinicPayload {
  name?: string;
  url?: string;
  address?: string;
  phone?: string;
}

export const connectedClinicService = {
  getAll: async (): Promise<ConnectedClinicListItem[]> => {
    const response = await api.get<ConnectedClinicListItem[]>('/connected-clinics');
    return response.data;
  },

  create: async (payload: CreateClinicPayload): Promise<ConnectedClinicListItem> => {
    const response = await api.post<ConnectedClinicListItem>('/connected-clinics', payload);
    return response.data;
  },

  update: async (
    clinicId: string,
    payload: UpdateClinicPayload
  ): Promise<ConnectedClinicListItem> => {
    const response = await api.put<ConnectedClinicListItem>(
      `/connected-clinics/${clinicId}`,
      payload
    );
    return response.data;
  },

  connect: async (
    clinicId: string
  ): Promise<ConnectedClinicListItem & { pingSuccess?: boolean; pingMessage?: string }> => {
    const response = await api.post<
      ConnectedClinicListItem & { pingSuccess?: boolean; pingMessage?: string }
    >(`/connected-clinics/${clinicId}/connect`);
    return response.data;
  },

  disconnect: async (clinicId: string): Promise<ConnectedClinicListItem> => {
    const response = await api.post<ConnectedClinicListItem>(
      `/connected-clinics/${clinicId}/disconnect`
    );
    return response.data;
  },

  getWorkOrders: async (clinicId: string): Promise<ClinicWorkOrdersResponse> => {
    const response = await api.get<ClinicWorkOrdersResponse>(
      `/connected-clinics/${clinicId}/work-orders`
    );
    return response.data;
  },

  updateProsthesisTypes: async (
    clinicId: string,
    payload: string[] | UpdateClinicProsthesisItem[]
  ): Promise<ConnectedClinicListItem> => {
    const body =
      Array.isArray(payload) && payload.length > 0 && typeof payload[0] === 'object'
        ? { items: payload }
        : { prosthesisTypeIds: payload as string[] };
    const response = await api.put<ConnectedClinicListItem>(
      `/connected-clinics/${clinicId}/prosthesis-types`,
      body
    );
    return response.data;
  },

  delete: async (clinicId: string): Promise<{ success: boolean; message?: string }> => {
    const response = await api.delete<{ success: boolean; message?: string }>(
      `/connected-clinics/${clinicId}`
    );
    return response.data;
  },
};
