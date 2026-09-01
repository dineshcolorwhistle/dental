import api from './api';

export interface ReminderAssigneeUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export interface ReminderAssignee {
  id: string;
  reminderId: string;
  userId: string;
  user: ReminderAssigneeUser;
}

export interface ReminderItem {
  id: string;
  tenantId: string;
  branchId: string | null;
  title: string;
  description: string | null;
  category: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  reminderDate: string | null;
  reminderTime: string;
  recurrence: 'ONE_TIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  createdById: string;
  lastNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Recurrence config
  repeatInterval: number;
  endType: string;
  endDate: string | null;
  endAfterOccurrences: number | null;
  completedOccurrences: number;
  weeklyDays: string | null;
  monthlyPattern: string | null;
  monthlyDayOfMonth: number | null;
  monthlyWeekPosition: string | null;
  monthlyWeekDay: number | null;
  // Relations
  assignees: ReminderAssignee[];
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  branch?: {
    id: string;
    name: string;
  } | null;
}

export interface AssignableUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export interface CreateReminderPayload {
  title: string;
  description?: string;
  category?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  reminderDate?: string;
  reminderTime: string;
  recurrence?: 'ONE_TIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  assigneeIds: string[];
  branchId?: string;
  // Recurrence config
  repeatInterval?: number;
  endType?: 'ON_DATE' | 'AFTER' | 'NEVER';
  endDate?: string;
  endAfterOccurrences?: number;
  weeklyDays?: number[];
  monthlyPattern?: 'DAY_OF_MONTH' | 'POSITIONAL_WEEKDAY';
  monthlyDayOfMonth?: number;
  monthlyWeekPosition?: 'FIRST' | 'SECOND' | 'THIRD' | 'FOURTH' | 'LAST';
  monthlyWeekDay?: number;
}

export interface UpdateReminderPayload {
  title?: string;
  description?: string;
  category?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  reminderDate?: string;
  reminderTime?: string;
  recurrence?: 'ONE_TIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  assigneeIds?: string[];
  branchId?: string;
  // Recurrence config
  repeatInterval?: number;
  endType?: 'ON_DATE' | 'AFTER' | 'NEVER';
  endDate?: string;
  endAfterOccurrences?: number;
  weeklyDays?: number[];
  monthlyPattern?: 'DAY_OF_MONTH' | 'POSITIONAL_WEEKDAY';
  monthlyDayOfMonth?: number;
  monthlyWeekPosition?: 'FIRST' | 'SECOND' | 'THIRD' | 'FOURTH' | 'LAST';
  monthlyWeekDay?: number;
}

export const reminderService = {
  async getAll(params?: {
    search?: string;
    priority?: string;
    status?: string;
    category?: string;
    recurrence?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<ReminderItem[]> {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.set('search', params.search);
    if (params?.priority) queryParams.set('priority', params.priority);
    if (params?.status) queryParams.set('status', params.status);
    if (params?.category) queryParams.set('category', params.category);
    if (params?.recurrence) queryParams.set('recurrence', params.recurrence);
    if (params?.dateFrom) queryParams.set('dateFrom', params.dateFrom);
    if (params?.dateTo) queryParams.set('dateTo', params.dateTo);
    const qs = queryParams.toString();
    const { data } = await api.get<ReminderItem[]>(`/reminders${qs ? `?${qs}` : ''}`);
    return data;
  },

  async getById(id: string): Promise<ReminderItem> {
    const { data } = await api.get<ReminderItem>(`/reminders/${id}`);
    return data;
  },

  async create(payload: CreateReminderPayload): Promise<ReminderItem> {
    const { data } = await api.post<ReminderItem>('/reminders', payload);
    return data;
  },

  async update(id: string, payload: UpdateReminderPayload): Promise<ReminderItem> {
    const { data } = await api.patch<ReminderItem>(`/reminders/${id}`, payload);
    return data;
  },

  async updateStatus(id: string, status: 'PENDING' | 'COMPLETED' | 'CANCELLED'): Promise<ReminderItem> {
    const { data } = await api.patch<ReminderItem>(`/reminders/${id}/status`, { status });
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/reminders/${id}`);
  },

  async getAssignableUsers(branchId?: string): Promise<AssignableUser[]> {
    const qs = branchId ? `?branchId=${branchId}` : '';
    const { data } = await api.get<AssignableUser[]>(`/reminders/assignable-users${qs}`);
    return data;
  },
};
