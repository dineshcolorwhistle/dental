import api from './api';

export interface PaymentMethodItem {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentMethodPayload {
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdatePaymentMethodPayload {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export const paymentMethodService = {
  getAll: async (onlyActive = false): Promise<PaymentMethodItem[]> => {
    const params = onlyActive ? { onlyActive: 'true' } : {};
    const { data } = await api.get<PaymentMethodItem[]>('/payment-methods', { params });
    return data;
  },

  getById: async (id: string): Promise<PaymentMethodItem> => {
    const { data } = await api.get<PaymentMethodItem>(`/payment-methods/${id}`);
    return data;
  },

  create: async (payload: CreatePaymentMethodPayload): Promise<PaymentMethodItem> => {
    const { data } = await api.post<PaymentMethodItem>('/payment-methods', payload);
    return data;
  },

  update: async (id: string, payload: UpdatePaymentMethodPayload): Promise<PaymentMethodItem> => {
    const { data } = await api.patch<PaymentMethodItem>(`/payment-methods/${id}`, payload);
    return data;
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    const { data } = await api.delete<{ success: boolean }>(`/payment-methods/${id}`);
    return data;
  },
};
