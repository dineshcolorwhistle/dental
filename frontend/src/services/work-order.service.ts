import api from './api';

export interface ProcessActivityLogItem {
  id: string;
  workOrderProcessId: string;
  action: 'START' | 'PAUSE' | 'RESUME' | 'END';
  timestamp: string;
  notes: string | null;
}

export interface WorkOrderProcessItem {
  id: string;
  workOrderId: string;
  processName: string;
  technicianId: string | null;
  sequence: number;
  isVerification: boolean;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  createdAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
  activityLogs?: ProcessActivityLogItem[];
  technician?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  reworkCount?: number;
  reworkActive?: boolean;
}

export interface ReworkLogItem {
  id: string;
  workOrderId: string;
  processName: string;
  reworkCount: number;
  initiatedById: string;
  initiatedAt: string;
  verificationStage: string;
  technicianId: string | null;
  completedAt: string | null;
  approvedAt: string | null;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Approved';
  initiatedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  technician?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

export interface RepetitionLogItem {
  id: string;
  workOrderId: string;
  repetitionCount: number;
  initiatedById: string;
  initiatedAt: string;
  verificationStage: string;
  completedSteps: string;
  createdAt: string;
  initiatedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

export interface WorkOrderNoteItem {
  id: string;
  workOrderId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  } | null;
}

export interface WorkOrderListItem {
  id: string;
  tenantId: string;
  branchId: string | null;
  folioNumber: string;
  fileNumber?: string | null;
  doctorId: string;
  patient: string;
  boxNumber: string | null;
  prosthesisTypeId: string;
  specification: string | null;
  color: string;
  notes: string | null;
  totalQuote: number | null;
  initialPayment: number | null;
  paymentReferenceNumber?: string | null;
  qrToken: string;
  status: 'CREATED' | 'ASSIGNED' | 'IN_PROGRESS' | 'INTERNAL_VERIFICATION' | 'EXTERNAL_VERIFICATION' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  repetitionCount?: number;
  createdById: string;
  isExternal: boolean;
  createdAt: string;
  updatedAt: string;
  doctor?: {
    id: string;
    name: string;
    clinicName: string | null;
    clinicId?: string | null;
  };
  prosthesisType?: {
    id: string;
    name: string;
  };
  branch?: {
    id: string;
    name: string;
    code: string;
  };
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
  processes: WorkOrderProcessItem[];
  reworkLogs?: ReworkLogItem[];
  repetitionLogs?: RepetitionLogItem[];
  notesList?: WorkOrderNoteItem[];
}

export interface CreateWorkOrderProcessPayload {
  processName: string;
  technicianId?: string;
  sequence: number;
  isVerification?: boolean;
  status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  rework?: boolean;
}

export interface CreateWorkOrderPayload {
  doctorId: string;
  patient: string;
  boxNumber?: string;
  fileNumber?: string;
  prosthesisTypeId: string;
  specification?: string;
  color: string;
  notes?: string;
  totalQuote?: number;
  initialPayment?: number;
  paymentReferenceNumber?: string;
  branchId?: string;
  action: 'create' | 'createAndAssign';
  processes: CreateWorkOrderProcessPayload[];
}

export interface UpdateWorkOrderPayload {
  doctorId?: string;
  patient?: string;
  boxNumber?: string;
  fileNumber?: string;
  prosthesisTypeId?: string;
  specification?: string;
  color?: string;
  notes?: string;
  totalQuote?: number;
  initialPayment?: number;
  paymentReferenceNumber?: string;
  status?: 'CREATED' | 'ASSIGNED' | 'IN_PROGRESS' | 'INTERNAL_VERIFICATION' | 'EXTERNAL_VERIFICATION' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  processes?: CreateWorkOrderProcessPayload[];
}

export const workOrderService = {
  getAll: async (branchId?: string, status?: string): Promise<WorkOrderListItem[]> => {
    const params: Record<string, string> = {};
    if (branchId && branchId !== 'ALL') params.branchId = branchId;
    if (status && status !== 'ALL') params.status = status;
    const response = await api.get<WorkOrderListItem[]>('/work-orders', { params });
    return response.data;
  },

  getById: async (id: string): Promise<WorkOrderListItem> => {
    const response = await api.get<WorkOrderListItem>(`/work-orders/${id}`);
    return response.data;
  },

  getNextFolioNumber: async (branchId?: string): Promise<{ folioNumber: string }> => {
    const params: Record<string, string> = {};
    if (branchId) params.branchId = branchId;
    const response = await api.get<{ folioNumber: string }>('/work-orders/next-folio', { params });
    return response.data;
  },

  create: async (payload: CreateWorkOrderPayload): Promise<WorkOrderListItem> => {
    const response = await api.post<WorkOrderListItem>('/work-orders', payload);
    return response.data;
  },

  update: async (id: string, payload: UpdateWorkOrderPayload): Promise<WorkOrderListItem> => {
    const response = await api.patch<WorkOrderListItem>(`/work-orders/${id}`, payload);
    return response.data;
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    const response = await api.delete<{ success: boolean }>(`/work-orders/${id}`);
    return response.data;
  },

  getDashboardStats: async (): Promise<any> => {
    const response = await api.get<any>('/work-orders/dashboard-stats');
    return response.data;
  },

  startVerification: async (workOrderId: string, processId: string): Promise<any> => {
    const response = await api.post<any>(`/work-orders/${workOrderId}/processes/${processId}/start-verification`);
    return response.data;
  },

  endVerification: async (workOrderId: string, processId: string, status: 'SUCCESS' | 'REWORK' | 'REPETITION'): Promise<any> => {
    const response = await api.post<any>(`/work-orders/${workOrderId}/processes/${processId}/end-verification`, { status });
    return response.data;
  },

  getByQrToken: async (token: string): Promise<WorkOrderListItem> => {
    const response = await api.get<WorkOrderListItem>(`/work-orders/qr/${token}`);
    return response.data;
  },

  // Note History APIs
  getNotes: async (workOrderId: string): Promise<WorkOrderNoteItem[]> => {
    const response = await api.get<WorkOrderNoteItem[]>(`/work-orders/${workOrderId}/notes`);
    return response.data;
  },

  addNote: async (workOrderId: string, content: string): Promise<WorkOrderNoteItem> => {
    const response = await api.post<WorkOrderNoteItem>(`/work-orders/${workOrderId}/notes`, { content });
    return response.data;
  },

  updateNote: async (workOrderId: string, noteId: string, content: string): Promise<WorkOrderNoteItem> => {
    const response = await api.patch<WorkOrderNoteItem>(`/work-orders/${workOrderId}/notes/${noteId}`, { content });
    return response.data;
  },

  deleteNote: async (workOrderId: string, noteId: string): Promise<{ success: boolean }> => {
    const response = await api.delete<{ success: boolean }>(`/work-orders/${workOrderId}/notes/${noteId}`);
    return response.data;
  },
};
