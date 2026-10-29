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

export type ToothPart =
  | 'center'
  | 'top'
  | 'upper_inner'
  | 'right'
  | 'lower_inner'
  | 'bottom'
  | 'left'
  | 'whole';

export interface AppliedFinding {
  itemId: string;
  itemType: 'DIAGNOSTIC' | 'TREATMENT';
  name: string;
  color: string;
  appliesToWholeTooth?: boolean;
  appliedAt?: string;
}

export type ToothPartsMap = Partial<Record<ToothPart, AppliedFinding>>;

export type OdontogramTeethData = Record<string, ToothPartsMap>;

export interface WorkOrderOdontogramResponse {
  workOrder: {
    id: string;
    folioNumber: string;
    patient: string | null;
    doctor: { id: string; name: string } | null;
    branch: { id: string; name: string; code: string } | null;
    prosthesisTypeId?: string;
  };
  defaultTeethModel: TeethModel;
  teethModel: TeethModel;
  teethData: OdontogramTeethData;
  notes: string;
  treatments: OdontogramTreatmentItem[];
  diagnostics: OdontogramDiagnosticItem[];
  hasSavedData: boolean;
  updatedAt: string | null;
}

export interface SaveWorkOrderOdontogramPayload {
  teethModel: TeethModel;
  teethData: OdontogramTeethData;
  notes?: string;
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

  // Work Order Odontogram
  getWorkOrderOdontogram: async (workOrderId: string): Promise<WorkOrderOdontogramResponse> => {
    const { data } = await api.get<WorkOrderOdontogramResponse>(`/odontogram/work-order/${workOrderId}`);
    return data;
  },

  saveWorkOrderOdontogram: async (
    workOrderId: string,
    payload: SaveWorkOrderOdontogramPayload,
  ): Promise<{ success: boolean; message: string }> => {
    const { data } = await api.put<{ success: boolean; message: string }>(
      `/odontogram/work-order/${workOrderId}`,
      payload,
    );
    return data;
  },

  deleteWorkOrderOdontogram: async (
    workOrderId: string,
  ): Promise<{ success: boolean; message: string }> => {
    const { data } = await api.delete<{ success: boolean; message: string }>(
      `/odontogram/work-order/${workOrderId}`,
    );
    return data;
  },
};

