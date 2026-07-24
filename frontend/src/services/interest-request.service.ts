import api from './api';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// ─── Types ───────────────────────────────────────────────

export interface PublicWorkOrder {
  id: string;
  folioNumber: string;
  patient: string;
  boxNumber: string | null;
  color: string;
  status: string;
  specification: string | null;
  createdAt: string;
  tenantId: string;
  tenant: {
    id: string;
    name: string;
    logoUrl: string | null;
  };
  doctor: {
    name: string;
    clinicName: string | null;
  } | null;
  prosthesisType: {
    name: string;
  } | null;
  processes: PublicProcessItem[];
}

export interface PublicProcessItem {
  id: string;
  processName: string;
  status: string;
  sequence: number;
  isVerification: boolean;
}

export interface CreateInterestRequestPayload {
  name: string;
  email: string;
  phone: string;
  tenantId: string;
  workOrderId?: string;
  notes?: string;
}

export interface InterestRequestItem {
  id: string;
  tenantId: string;
  workOrderId: string | null;
  name: string;
  email: string;
  phone: string;
  notes: string | null;
  status: 'PENDING' | 'CONTACTED' | 'CONVERTED' | 'DISCARDED';
  createdAt: string;
  updatedAt: string;
  tenant: {
    id: string;
    name: string;
  };
  workOrder: {
    id: string;
    folioNumber: string;
    patient: string;
    doctor: {
      name: string;
    } | null;
  } | null;
}

// ─── Service ─────────────────────────────────────────────

export const interestRequestService = {
  // Public endpoints (no auth required — uses raw axios to skip interceptors)
  getPublicWorkOrder: async (token: string): Promise<PublicWorkOrder> => {
    const response = await axios.get<PublicWorkOrder>(
      `${API_URL}/public/work-orders/qr/${token}`,
    );
    return response.data;
  },

  submitInterestRequest: async (
    payload: CreateInterestRequestPayload,
  ): Promise<InterestRequestItem> => {
    const response = await axios.post<InterestRequestItem>(
      `${API_URL}/public/interest-requests`,
      payload,
    );
    return response.data;
  },

  // Admin endpoints (auth required)
  getAll: async (params?: {
    status?: string;
    search?: string;
  }): Promise<InterestRequestItem[]> => {
    const response = await api.get<InterestRequestItem[]>(
      '/interest-requests',
      { params },
    );
    return response.data;
  },

  updateStatus: async (
    id: string,
    status: string,
  ): Promise<InterestRequestItem> => {
    const response = await api.patch<InterestRequestItem>(
      `/interest-requests/${id}/status`,
      { status },
    );
    return response.data;
  },

  remove: async (id: string): Promise<{ success: boolean }> => {
    const response = await api.delete<{ success: boolean }>(
      `/interest-requests/${id}`,
    );
    return response.data;
  },
};
