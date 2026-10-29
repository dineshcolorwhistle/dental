import api from './api';

export type TeethModel = 'ADULT' | 'CHILD';

export interface OdontogramConfigItem {
  id?: string;
  tenantId: string;
  branchId: string | null;
  defaultTeethModel: TeethModel;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateOdontogramConfigPayload {
  defaultTeethModel: TeethModel;
  branchId?: string;
}

export interface OdontogramTreatmentItem {
  id: string;
  tenantId: string;
  branchId: string | null;
  name: string;
  description: string | null;
  color: string;
  appliesToWholeTooth: boolean;
  createdAt: string;
  updatedAt: string;
  branch?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface CreateOdontogramTreatmentPayload {
  name: string;
  description?: string;
  color: string;
  appliesToWholeTooth: boolean;
  branchId?: string;
}

export interface UpdateOdontogramTreatmentPayload {
  name?: string;
  description?: string;
  color?: string;
  appliesToWholeTooth?: boolean;
}

export interface OdontogramDiagnosticItem {
  id: string;
  tenantId: string;
  branchId: string | null;
  name: string;
  description: string | null;
  color: string;
  appliesToWholeTooth: boolean;
  createdAt: string;
  updatedAt: string;
  branch?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface CreateOdontogramDiagnosticPayload {
  name: string;
  description?: string;
  color: string;
  appliesToWholeTooth: boolean;
  branchId?: string;
}

export interface UpdateOdontogramDiagnosticPayload {
  name?: string;
  description?: string;
  color?: string;
  appliesToWholeTooth?: boolean;
}

export const odontogramService = {
  // Config
  getConfig: async (branchId?: string): Promise<OdontogramConfigItem> => {
    const params = branchId && branchId !== 'ALL' ? { branchId } : {};
    const { data } = await api.get<OdontogramConfigItem>('/odontogram/config', { params });
    return data;
  },

  updateConfig: async (payload: UpdateOdontogramConfigPayload): Promise<OdontogramConfigItem> => {
    const { data } = await api.put<OdontogramConfigItem>('/odontogram/config', payload);
    return data;
  },

  // Treatments
  getTreatments: async (branchId?: string): Promise<OdontogramTreatmentItem[]> => {
    const params = branchId && branchId !== 'ALL' ? { branchId } : {};
    const { data } = await api.get<OdontogramTreatmentItem[]>('/odontogram/treatments', { params });
    return data;
  },

  createTreatment: async (payload: CreateOdontogramTreatmentPayload): Promise<OdontogramTreatmentItem> => {
    const { data } = await api.post<OdontogramTreatmentItem>('/odontogram/treatments', payload);
    return data;
  },

  updateTreatment: async (id: string, payload: UpdateOdontogramTreatmentPayload): Promise<OdontogramTreatmentItem> => {
    const { data } = await api.patch<OdontogramTreatmentItem>(`/odontogram/treatments/${id}`, payload);
    return data;
  },

  deleteTreatment: async (id: string): Promise<{ success: boolean; message: string }> => {
    const { data } = await api.delete<{ success: boolean; message: string }>(`/odontogram/treatments/${id}`);
    return data;
  },

  // Diagnostics
  getDiagnostics: async (branchId?: string): Promise<OdontogramDiagnosticItem[]> => {
    const params = branchId && branchId !== 'ALL' ? { branchId } : {};
    const { data } = await api.get<OdontogramDiagnosticItem[]>('/odontogram/diagnostics', { params });
    return data;
  },

  createDiagnostic: async (payload: CreateOdontogramDiagnosticPayload): Promise<OdontogramDiagnosticItem> => {
    const { data } = await api.post<OdontogramDiagnosticItem>('/odontogram/diagnostics', payload);
    return data;
  },

  updateDiagnostic: async (id: string, payload: UpdateOdontogramDiagnosticPayload): Promise<OdontogramDiagnosticItem> => {
    const { data } = await api.patch<OdontogramDiagnosticItem>(`/odontogram/diagnostics/${id}`, payload);
    return data;
  },

  deleteDiagnostic: async (id: string): Promise<{ success: boolean; message: string }> => {
    const { data } = await api.delete<{ success: boolean; message: string }>(`/odontogram/diagnostics/${id}`);
    return data;
  },
};

