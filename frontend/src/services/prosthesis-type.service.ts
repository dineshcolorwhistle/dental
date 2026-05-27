import api from './api';

export interface ProsthesisTypeProcessAssignment {
  id: string;
  sequence: number;
  process: {
    id: string;
    name: string;
    processArea: string;
    defaultTechnicianId: string;
    defaultTechnician?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    branch?: {
      id: string;
      name: string;
    };
  };
}

export interface ProsthesisTypeListItem {
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
  };
  processAssignments?: ProsthesisTypeProcessAssignment[];
}

export interface CreateProsthesisTypePayload {
  name: string;
  description?: string;
  branchId?: string;
  processIds?: string[];
}

export const prosthesisTypeService = {
  getAll: async (branchId?: string): Promise<ProsthesisTypeListItem[]> => {
    const params = branchId && branchId !== 'ALL' ? { branchId } : {};
    const response = await api.get<ProsthesisTypeListItem[]>('/prosthesis-types', { params });
    return response.data;
  },

  getById: async (id: string): Promise<ProsthesisTypeListItem> => {
    const response = await api.get<ProsthesisTypeListItem>(`/prosthesis-types/${id}`);
    return response.data;
  },

  create: async (payload: CreateProsthesisTypePayload): Promise<ProsthesisTypeListItem> => {
    const response = await api.post<ProsthesisTypeListItem>('/prosthesis-types', payload);
    return response.data;
  },

  update: async (id: string, payload: Partial<CreateProsthesisTypePayload>): Promise<ProsthesisTypeListItem> => {
    const response = await api.patch<ProsthesisTypeListItem>(`/prosthesis-types/${id}`, payload);
    return response.data;
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    const response = await api.delete<{ success: boolean }>(`/prosthesis-types/${id}`);
    return response.data;
  },

  getProcesses: async (id: string): Promise<ProsthesisTypeProcessAssignment[]> => {
    const response = await api.get<ProsthesisTypeProcessAssignment[]>(`/prosthesis-types/${id}/processes`);
    return response.data;
  },

  reorderProcesses: async (id: string, processIds: string[]): Promise<{ success: boolean }> => {
    const response = await api.post<{ success: boolean }>(`/prosthesis-types/${id}/reorder-processes`, {
      processIds,
    });
    return response.data;
  },
};
