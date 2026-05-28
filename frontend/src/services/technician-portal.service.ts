import api from './api';
import type { WorkOrderListItem, WorkOrderProcessItem } from './work-order.service';

export interface ProcessActivityLogItem {
  id: string;
  workOrderProcessId: string;
  action: 'START' | 'PAUSE' | 'RESUME' | 'END';
  timestamp: string;
  notes: string | null;
}

export interface TechnicianProcessItem extends WorkOrderProcessItem {
  startedAt: string | null;
  endedAt: string | null;
  lastPausedAt: string | null;
  pauseCount: number;
  totalPauseDuration: number;
  totalActiveDuration: number;
  activityLogs?: ProcessActivityLogItem[];
}

export interface TechnicianWorkOrderListItem extends Omit<WorkOrderListItem, 'processes'> {
  processes: TechnicianProcessItem[];
}

export interface TechnicianDashboardStats {
  pendingCount: number;
  activeCount: number;
  pausedCount: number;
  completedTodayCount: number;
}

export const technicianPortalService = {
  getDashboardStats: async (): Promise<TechnicianDashboardStats> => {
    const response = await api.get<TechnicianDashboardStats>('/technician-portal/dashboard-stats');
    return response.data;
  },

  getAssignedWorkOrders: async (status?: string): Promise<TechnicianWorkOrderListItem[]> => {
    const params: Record<string, string> = {};
    if (status && status !== 'ALL') {
      params.status = status;
    }
    const response = await api.get<TechnicianWorkOrderListItem[]>('/technician-portal/work-orders', { params });
    return response.data;
  },

  getWorkOrderDetail: async (id: string): Promise<TechnicianWorkOrderListItem> => {
    const response = await api.get<TechnicianWorkOrderListItem>(`/technician-portal/work-orders/${id}`);
    return response.data;
  },

  startProcess: async (processId: string): Promise<TechnicianProcessItem> => {
    const response = await api.post<TechnicianProcessItem>(`/technician-portal/processes/${processId}/start`);
    return response.data;
  },

  pauseProcess: async (processId: string): Promise<TechnicianProcessItem> => {
    const response = await api.post<TechnicianProcessItem>(`/technician-portal/processes/${processId}/pause`);
    return response.data;
  },

  resumeProcess: async (processId: string): Promise<TechnicianProcessItem> => {
    const response = await api.post<TechnicianProcessItem>(`/technician-portal/processes/${processId}/resume`);
    return response.data;
  },

  endProcess: async (processId: string): Promise<TechnicianProcessItem> => {
    const response = await api.post<TechnicianProcessItem>(`/technician-portal/processes/${processId}/end`);
    return response.data;
  },
};
