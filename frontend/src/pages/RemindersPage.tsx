import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  Plus,
  Search,
  List,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Trash2,
  Edit3,
  Eye,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
  User,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import {
  reminderService,
  type ReminderItem,
  type AssignableUser,
  type CreateReminderPayload,
  type UpdateReminderPayload,
} from '../services';
import { useAuth } from '../context';
import { Pagination, SearchableSelect } from '../components';
import toast from 'react-hot-toast';

type ViewMode = 'list' | 'calendar';
type CalendarViewMode = 'month' | 'week' | 'day';
type StatusFilter = 'ALL' | 'PENDING' | 'COMPLETED' | 'CANCELLED';
type PriorityFilter = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW';

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  LOW: { color: '#059669', bg: 'rgba(16, 185, 129, 0.08)', border: '#A7F3D0' },
  MEDIUM: { color: '#D97706', bg: 'rgba(245, 158, 11, 0.08)', border: '#FDE68A' },
  HIGH: { color: '#DC2626', bg: 'rgba(239, 68, 68, 0.08)', border: '#FECACA' },
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  PENDING: { color: '#D97706', bg: 'rgba(245, 158, 11, 0.08)', border: '#FDE68A', icon: <Clock size={12} /> },
  COMPLETED: { color: '#059669', bg: 'rgba(16, 185, 129, 0.08)', border: '#A7F3D0', icon: <CheckCircle2 size={12} /> },
  CANCELLED: { color: '#DC2626', bg: 'rgba(239, 68, 68, 0.08)', border: '#FECACA', icon: <XCircle size={12} /> },
};

const getLocalDateKey = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTodayDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface ReminderFormState {
  title: string;
  description: string;
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  reminderDate: string;
  reminderTime: string;
  recurrence: 'ONE_TIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  assigneeIds: string[];
}

const INITIAL_FORM: ReminderFormState = {
  title: '',
  description: '',
  category: '',
  priority: 'MEDIUM',
  reminderDate: getTodayDateString(),
  reminderTime: '09:00',
  recurrence: 'ONE_TIME',
  assigneeIds: [],
};

export function RemindersPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const isAdmin = user?.role === 'ADMIN';
  const isOwner = user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN';
  const canCreate = isAdmin;
  const canEdit = isAdmin;
  const canDelete = isOwner;

  // Data
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Views & Pagination
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [calendarViewMode, setCalendarViewMode] = useState<CalendarViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 10;

  // Sorting
  const [sortField, setSortField] = useState<'title' | 'reminderDate' | 'priority' | 'status' | 'createdAt'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState<PriorityFilter>('ALL');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('ALL');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState<ReminderItem | null>(null);
  const [deletingReminder, setDeletingReminder] = useState<ReminderItem | null>(null);
  const [viewingReminder, setViewingReminder] = useState<ReminderItem | null>(null);

  // Day View Modal for Calendar
  const [dayModal, setDayModal] = useState<{ isOpen: boolean; date: Date | null; reminders: ReminderItem[] }>({
    isOpen: false,
    date: null,
    reminders: [],
  });

  // Form State
  const [form, setForm] = useState<ReminderFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(0);
  }, [searchTerm, filterPriority, filterStatus]);

  // ─── Data Fetching ──────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [remindersData, usersData] = await Promise.all([
        reminderService.getAll(),
        isAdmin ? reminderService.getAssignableUsers() : Promise.resolve([]),
      ]);
      setReminders(remindersData);
      setAssignableUsers(usersData);
    } catch {
      toast.error(t('reminders.loadError', { defaultValue: 'Failed to load reminders' }));
    } finally {
      setLoading(false);
    }
  }, [t, isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Stats Calculation ──────────────────────
  const stats = useMemo(() => {
    return {
      total: reminders.length,
      pending: reminders.filter((r) => r.status === 'PENDING').length,
      completed: reminders.filter((r) => r.status === 'COMPLETED').length,
      highPriority: reminders.filter((r) => r.priority === 'HIGH' && r.status === 'PENDING').length,
    };
  }, [reminders]);

  // ─── Sorting & Filtering ────────────────────
  const filteredReminders = useMemo(() => {
    const priorityWeight: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const statusWeight: Record<string, number> = { PENDING: 1, COMPLETED: 2, CANCELLED: 3 };

    return reminders
      .filter((r) => {
        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          const matchTitle = r.title.toLowerCase().includes(q);
          const matchCategory = r.category?.toLowerCase().includes(q);
          const matchDesc = r.description?.toLowerCase().includes(q);
          if (!matchTitle && !matchCategory && !matchDesc) return false;
        }
        if (filterPriority !== 'ALL' && r.priority !== filterPriority) return false;
        if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;
        return true;
      })
      .sort((a, b) => {
        const mul = sortDir === 'asc' ? 1 : -1;
        if (sortField === 'title') return mul * a.title.localeCompare(b.title);
        if (sortField === 'priority') return mul * (priorityWeight[a.priority] - priorityWeight[b.priority]);
        if (sortField === 'status') return mul * (statusWeight[a.status] - statusWeight[b.status]);
        if (sortField === 'reminderDate') {
          const timeA = a.reminderDate ? new Date(a.reminderDate).getTime() : 0;
          const timeB = b.reminderDate ? new Date(b.reminderDate).getTime() : 0;
          return mul * (timeA - timeB);
        }
        return mul * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      });
  }, [reminders, searchTerm, filterPriority, filterStatus, sortField, sortDir]);

  const paginatedReminders = useMemo(() => {
    return filteredReminders.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  }, [filteredReminders, currentPage]);

  const toggleSort = (field: 'title' | 'reminderDate' | 'priority' | 'status' | 'createdAt') => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // Options for SearchableSelect Assignees
  const assigneeOptions = useMemo(() => {
    return assignableUsers.map((u) => ({
      value: u.id,
      label: `${u.firstName} ${u.lastName} (${u.role})`,
    }));
  }, [assignableUsers]);

  // ─── Calendar Grid Computation ──────────────
  const monthGridDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      days.push({
        date: new Date(current),
        isCurrentMonth: current.getMonth() === month,
      });
      current.setDate(current.getDate() + 1);
    }
    return days;
  }, [currentDate]);

  const weekGridDays = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  const remindersByDate = useMemo(() => {
    const map: Record<string, ReminderItem[]> = {};
    filteredReminders.forEach((r) => {
      if (r.recurrence === 'ONE_TIME' && r.reminderDate) {
        const key = getLocalDateKey(new Date(r.reminderDate));
        if (!map[key]) map[key] = [];
        map[key].push(r);
      } else if (r.recurrence === 'DAILY') {
        monthGridDays.forEach(({ date }) => {
          const key = getLocalDateKey(date);
          if (!map[key]) map[key] = [];
          if (!map[key].some((item) => item.id === r.id)) {
            map[key].push(r);
          }
        });
      } else if (r.recurrence === 'WEEKLY') {
        const createdDate = new Date(r.createdAt);
        const dayOfWeek = createdDate.getDay();
        monthGridDays
          .filter(({ date }) => date.getDay() === dayOfWeek)
          .forEach(({ date }) => {
            const key = getLocalDateKey(date);
            if (!map[key]) map[key] = [];
            if (!map[key].some((item) => item.id === r.id)) {
              map[key].push(r);
            }
          });
      } else if (r.recurrence === 'MONTHLY') {
        const createdDate = new Date(r.createdAt);
        const dayOfMonth = createdDate.getDate();
        monthGridDays
          .filter(({ date }) => date.getDate() === dayOfMonth)
          .forEach(({ date }) => {
            const key = getLocalDateKey(date);
            if (!map[key]) map[key] = [];
            if (!map[key].some((item) => item.id === r.id)) {
              map[key].push(r);
            }
          });
      }
    });
    return map;
  }, [filteredReminders, monthGridDays]);

  // ─── Form Handlers & Validation ──────────────
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const todayStr = getTodayDateString();

    if (!form.title.trim()) {
      errors.title = t('reminders.validation.titleRequired', { defaultValue: 'Title is required' });
    }
    if (!form.reminderTime.trim()) {
      errors.reminderTime = t('reminders.validation.timeRequired', { defaultValue: 'Time is required' });
    }

    if (form.recurrence === 'ONE_TIME') {
      if (!form.reminderDate) {
        errors.reminderDate = t('reminders.validation.dateRequired', { defaultValue: 'Date is required for one-time reminders' });
      } else if (form.reminderDate < todayStr) {
        errors.reminderDate = t('reminders.validation.pastDateNotAllowed', { defaultValue: 'Reminder date cannot be in the past' });
      }
    }

    // MANDATORY ASSIGNEE VALIDATION (MIN 1)
    if (form.assigneeIds.length === 0) {
      errors.assigneeIds = t('reminders.validation.assigneeRequired', { defaultValue: 'At least 1 assignee is required' });
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      const payload: CreateReminderPayload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        category: form.category.trim() || undefined,
        priority: form.priority,
        reminderTime: form.reminderTime.slice(0, 5),
        recurrence: form.recurrence,
        assigneeIds: form.assigneeIds,
      };
      if (form.recurrence === 'ONE_TIME' && form.reminderDate) {
        payload.reminderDate = new Date(form.reminderDate).toISOString();
      }
      await reminderService.create(payload);
      toast.success(t('reminders.createSuccess', { defaultValue: 'Reminder created successfully!' }));
      setShowCreateModal(false);
      setForm(INITIAL_FORM);
      setFormErrors({});
      fetchData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || t('reminders.createError', { defaultValue: 'Failed to create reminder' });
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReminder || !validateForm()) return;

    setSaving(true);
    try {
      const payload: UpdateReminderPayload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        category: form.category.trim() || undefined,
        priority: form.priority,
        reminderTime: form.reminderTime.slice(0, 5),
        recurrence: form.recurrence,
        assigneeIds: form.assigneeIds,
      };
      if (form.recurrence === 'ONE_TIME' && form.reminderDate) {
        payload.reminderDate = new Date(form.reminderDate).toISOString();
      }
      await reminderService.update(editingReminder.id, payload);
      toast.success(t('reminders.updateSuccess', { defaultValue: 'Reminder updated successfully!' }));
      setShowEditModal(false);
      setEditingReminder(null);
      setForm(INITIAL_FORM);
      setFormErrors({});
      fetchData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || t('reminders.updateError', { defaultValue: 'Failed to update reminder' });
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingReminder) return;
    setDeleting(true);
    try {
      await reminderService.delete(deletingReminder.id);
      toast.success(t('reminders.deleteSuccess', { defaultValue: 'Reminder deleted successfully!' }));
      setShowDeleteModal(false);
      setDeletingReminder(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('reminders.deleteError', { defaultValue: 'Failed to delete reminder' }));
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusToggle = async (reminder: ReminderItem) => {
    const newStatus = reminder.status === 'PENDING' ? 'COMPLETED' : 'PENDING';
    try {
      await reminderService.updateStatus(reminder.id, newStatus);
      if (newStatus === 'COMPLETED' && reminder.recurrence !== 'ONE_TIME') {
        toast.success(t('reminders.recurringCompleted', { defaultValue: "Completed today's instance! Advanced to next cycle." }));
      } else {
        toast.success(t('reminders.statusUpdateSuccess', { defaultValue: 'Reminder status updated!' }));
      }
      fetchData();
    } catch {
      toast.error(t('reminders.statusUpdateError', { defaultValue: 'Failed to update status' }));
    }
  };

  const openCreateModal = () => {
    setForm({
      ...INITIAL_FORM,
      reminderDate: getTodayDateString(),
    });
    setFormErrors({});
    setShowCreateModal(true);
  };

  const openEditModal = (reminder: ReminderItem) => {
    setEditingReminder(reminder);
    setForm({
      title: reminder.title,
      description: reminder.description || '',
      category: reminder.category || '',
      priority: reminder.priority,
      reminderDate: reminder.reminderDate
        ? new Date(reminder.reminderDate).toISOString().split('T')[0]
        : getTodayDateString(),
      reminderTime: reminder.reminderTime,
      recurrence: reminder.recurrence,
      assigneeIds: reminder.assignees.map((a) => a.user.id),
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const openViewModal = (reminder: ReminderItem) => {
    setViewingReminder(reminder);
    setShowViewModal(true);
  };

  const openDeleteModal = (reminder: ReminderItem) => {
    setDeletingReminder(reminder);
    setShowDeleteModal(true);
  };

  const removeAssignee = (userId: string) => {
    setForm((prev) => ({
      ...prev,
      assigneeIds: prev.assigneeIds.filter((id) => id !== userId),
    }));
  };

  const addAssignee = (userId: string) => {
    if (!userId || form.assigneeIds.includes(userId)) return;
    setForm((prev) => ({
      ...prev,
      assigneeIds: [...prev.assigneeIds, userId],
    }));
    // Clear assignee validation error if present
    setFormErrors((prev) => ({ ...prev, assigneeIds: '' }));
  };

  // ─── Calendar Navigation ──────────────────
  const navigateCalendar = (dir: number) => {
    const d = new Date(currentDate);
    if (calendarViewMode === 'month') {
      d.setMonth(d.getMonth() + dir);
    } else if (calendarViewMode === 'week') {
      d.setDate(d.getDate() + dir * 7);
    } else {
      d.setDate(d.getDate() + dir);
    }
    setCurrentDate(d);
  };

  const locale = i18n.language?.startsWith('es') ? 'es-MX' : 'en-US';
  const calendarTitle = calendarViewMode === 'day'
    ? currentDate.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
    : currentDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const todayKeyStr = getLocalDateKey(new Date());

  const dayNames = useMemo(() => {
    const date = new Date(2026, 7, 2); // A Sunday
    const names: string[] = [];
    for (let i = 0; i < 7; i++) {
      names.push(date.toLocaleDateString(locale, { weekday: 'short' }));
      date.setDate(date.getDate() + 1);
    }
    return names;
  }, [locale]);

  // Selected assignees objects for rendering badge chips
  const selectedAssignees = useMemo(() => {
    return assignableUsers.filter((u) => form.assigneeIds.includes(u.id));
  }, [assignableUsers, form.assigneeIds]);

  // Options available for search dropdown (excluding already selected)
  const availableAssigneeOptions = useMemo(() => {
    return assigneeOptions.filter((opt) => !form.assigneeIds.includes(opt.value));
  }, [assigneeOptions, form.assigneeIds]);

  // ─── Render Modal Form Fields ─────────────
  const renderFormFields = (onSubmit: (e: React.FormEvent) => void, isEdit: boolean) => (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div className="modal__body" style={{ flex: 1, overflowY: 'auto' }}>
        {/* Row 1: Title + Priority */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="input-reminder-title">
              {t('reminders.fields.title', { defaultValue: 'Title' })} *
            </label>
            <input
              id="input-reminder-title"
              className={`form-input ${formErrors.title ? 'form-input--error' : ''}`}
              type="text"
              placeholder={t('reminders.fields.titlePlaceholder', { defaultValue: 'Enter reminder title' })}
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              disabled={saving}
              autoFocus
            />
            {formErrors.title && (
              <span className="form-error">
                <AlertCircle size={12} /> {formErrors.title}
              </span>
            )}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="select-reminder-priority">
              {t('reminders.fields.priority', { defaultValue: 'Priority' })}
            </label>
            <select
              id="select-reminder-priority"
              className="form-input"
              value={form.priority}
              onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as any }))}
              disabled={saving}
            >
              <option value="LOW">{t('enums.reminderPriority.LOW', { defaultValue: 'Low' })}</option>
              <option value="MEDIUM">{t('enums.reminderPriority.MEDIUM', { defaultValue: 'Medium' })}</option>
              <option value="HIGH">{t('enums.reminderPriority.HIGH', { defaultValue: 'High' })}</option>
            </select>
          </div>
        </div>

        {/* Row 2: Category + Recurrence */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="input-reminder-category">
              {t('reminders.fields.category', { defaultValue: 'Category' })}
            </label>
            <input
              id="input-reminder-category"
              className="form-input"
              type="text"
              placeholder={t('reminders.fields.categoryPlaceholder', { defaultValue: 'e.g. Cleaning, Inventory' })}
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              disabled={saving}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="select-reminder-recurrence">
              {t('reminders.fields.recurrence', { defaultValue: 'Recurrence' })}
            </label>
            <select
              id="select-reminder-recurrence"
              className="form-input"
              value={form.recurrence}
              onChange={(e) => setForm((p) => ({ ...p, recurrence: e.target.value as any }))}
              disabled={saving}
            >
              <option value="ONE_TIME">{t('enums.reminderRecurrence.ONE_TIME', { defaultValue: 'One time (No recurrence)' })}</option>
              <option value="DAILY">{t('enums.reminderRecurrence.DAILY', { defaultValue: 'Daily' })}</option>
              <option value="WEEKLY">{t('enums.reminderRecurrence.WEEKLY', { defaultValue: 'Weekly' })}</option>
              <option value="MONTHLY">{t('enums.reminderRecurrence.MONTHLY', { defaultValue: 'Monthly' })}</option>
            </select>
          </div>
        </div>

        {/* Row 3: Date & Time */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          {form.recurrence === 'ONE_TIME' && (
            <div className="form-group">
              <label className="form-label" htmlFor="input-reminder-date">
                {t('reminders.fields.reminderDate', { defaultValue: 'Reminder Date' })} *
              </label>
              <input
                id="input-reminder-date"
                className={`form-input ${formErrors.reminderDate ? 'form-input--error' : ''}`}
                type="date"
                min={getTodayDateString()}
                value={form.reminderDate}
                onChange={(e) => setForm((p) => ({ ...p, reminderDate: e.target.value }))}
                disabled={saving}
              />
              {formErrors.reminderDate && (
                <span className="form-error">
                  <AlertCircle size={12} /> {formErrors.reminderDate}
                </span>
              )}
            </div>
          )}
          <div className="form-group">
            <label className="form-label" htmlFor="input-reminder-time">
              {t('reminders.fields.reminderTime', { defaultValue: 'Reminder Time' })} *
            </label>
            <input
              id="input-reminder-time"
              className={`form-input ${formErrors.reminderTime ? 'form-input--error' : ''}`}
              type="time"
              value={form.reminderTime}
              onChange={(e) => setForm((p) => ({ ...p, reminderTime: e.target.value }))}
              disabled={saving}
            />
            {formErrors.reminderTime && (
              <span className="form-error">
                <AlertCircle size={12} /> {formErrors.reminderTime}
              </span>
            )}
          </div>
        </div>

        {/* Row 4: Assigned To - Mandatory with min 1 */}
        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label className="form-label" htmlFor="select-reminder-assignees">
            {t('reminders.fields.assignedTo', { defaultValue: 'Assigned To' })} *
          </label>

          {/* Selected Assignees Badges */}
          {selectedAssignees.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
              {selectedAssignees.map((u) => (
                <span
                  key={u.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    color: 'var(--primary, #3B82F6)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                  }}
                >
                  <User size={13} />
                  <span>{u.firstName} {u.lastName} ({u.role})</span>
                  <button
                    type="button"
                    onClick={() => removeAssignee(u.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      color: 'inherit',
                      marginLeft: '2px',
                    }}
                    title={t('common.remove', { defaultValue: 'Remove' })}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Searchable Select Input */}
          <SearchableSelect
            id="select-reminder-assignees"
            options={availableAssigneeOptions}
            value=""
            onChange={addAssignee}
            error={!!formErrors.assigneeIds}
            placeholder={
              availableAssigneeOptions.length === 0 && selectedAssignees.length > 0
                ? t('reminders.fields.allUsersSelected', { defaultValue: 'All users selected' })
                : t('reminders.fields.assignedToPlaceholder', { defaultValue: 'Search and select users to assign...' })
            }
            disabled={saving || availableAssigneeOptions.length === 0}
          />
          {formErrors.assigneeIds && (
            <span className="form-error" style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertCircle size={12} /> {formErrors.assigneeIds}
            </span>
          )}
        </div>

        {/* Row 5: Description */}
        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label className="form-label" htmlFor="input-reminder-desc">
            {t('reminders.fields.description', { defaultValue: 'Description' })}
          </label>
          <textarea
            id="input-reminder-desc"
            className="form-input"
            rows={3}
            placeholder={t('reminders.fields.descriptionPlaceholder', { defaultValue: 'Optional details...' })}
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            disabled={saving}
          />
        </div>
      </div>

      {/* Modal Footer */}
      <div className="modal__footer" style={{ padding: '1rem 1.75rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', backgroundColor: 'var(--bg-surface)', marginTop: 0 }}>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => (isEdit ? setShowEditModal(false) : setShowCreateModal(false))}
          disabled={saving}
        >
          {t('common.cancel', { defaultValue: 'Cancel' })}
        </button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? (
            <>
              <Loader2 size={16} className="spinner" />
              <span>{t('common.saving', { defaultValue: 'Saving...' })}</span>
            </>
          ) : (
            <span>{isEdit ? t('common.saveChanges', { defaultValue: 'Save Changes' }) : t('common.create', { defaultValue: 'Create' })}</span>
          )}
        </button>
      </div>
    </form>
  );

  return (
    <div className="admins-page" style={{ gap: '1.25rem' }}>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__left">
          {viewMode === 'calendar' ? (
            <>
              <h1 className="page-header__title" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <CalendarIcon size={26} style={{ color: 'var(--primary, #3B82F6)' }} />
                {t('reminders.calendarView', { defaultValue: 'Reminders Calendar' })}
              </h1>
              <p className="page-header__subtitle">{t('reminders.calendarSubtitle', { defaultValue: 'Overview of reminders scheduled by date' })}</p>
            </>
          ) : (
            <>
              <h1 className="page-header__title">{t('reminders.title', { defaultValue: 'Reminders' })}</h1>
              <p className="page-header__subtitle">{t('reminders.subtitle', { defaultValue: 'Manage reminders and follow-ups for your team' })}</p>
            </>
          )}
        </div>

        {/* Action Controls & Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {viewMode === 'calendar' ? (
            <>
              {/* List View Toggle Button */}
              <button
                onClick={() => setViewMode('list')}
                className="btn btn-outline"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', height: '38px' }}
              >
                <List size={16} />
                <span>{t('reminders.listView', { defaultValue: 'List View' })}</span>
              </button>

              {/* Today Button */}
              <button
                onClick={() => setCurrentDate(new Date())}
                className="btn btn-outline"
                style={{ height: '38px' }}
              >
                {t('reminders.calendar.today', { defaultValue: 'Today' })}
              </button>

              {/* Month/Week Navigation Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', border: '1px solid var(--border)', borderRadius: '8px', padding: '2px', backgroundColor: 'var(--bg-surface)' }}>
                <button
                  onClick={() => navigateCalendar(-1)}
                  className="btn btn-icon"
                  style={{ padding: '6px', height: '32px', width: '32px' }}
                  title={t('reminders.calendar.previous', { defaultValue: 'Previous' })}
                >
                  <ChevronLeft size={18} />
                </button>

                <span style={{ fontWeight: 600, fontSize: '0.875rem', padding: '0 0.75rem', textTransform: 'capitalize', color: 'var(--text-primary)', minWidth: '130px', textAlign: 'center' }}>
                  {calendarTitle}
                </span>

                <button
                  onClick={() => navigateCalendar(1)}
                  className="btn btn-icon"
                  style={{ padding: '6px', height: '32px', width: '32px' }}
                  title={t('reminders.calendar.next', { defaultValue: 'Next' })}
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Month/Week/Day View Mode Switcher */}
              <div style={{ display: 'flex', gap: '2px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '2px' }}>
                {(['month', 'week', 'day'] as CalendarViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setCalendarViewMode(mode)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.8125rem',
                      fontWeight: calendarViewMode === mode ? 600 : 500,
                      border: 'none',
                      borderRadius: '6px',
                      backgroundColor: calendarViewMode === mode ? 'var(--bg-surface)' : 'transparent',
                      color: calendarViewMode === mode ? 'var(--primary, #3B82F6)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      boxShadow: calendarViewMode === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.15s ease',
                      textTransform: 'capitalize',
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <button
              onClick={() => setViewMode('calendar')}
              className="btn btn-outline"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', height: '38px' }}
            >
              <CalendarIcon size={16} />
              <span>{t('reminders.calendarView', { defaultValue: 'Calendar View' })}</span>
            </button>
          )}

          {canCreate && (
            <button id="btn-add-reminder" className="btn btn--primary" style={{ height: '38px' }} onClick={openCreateModal}>
              <Plus size={18} />
              <span>{t('reminders.createReminder', { defaultValue: 'New Reminder' })}</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards — ONLY shown in List View */}
      {viewMode === 'list' && (
        <div className="tenants-page__stats">
          <div className="stat-card">
            <div className="stat-card__icon stat-card__icon--primary">
              <Bell size={24} />
            </div>
            <div className="stat-card__content">
              <span className="stat-card__value">{stats.total}</span>
              <span className="stat-card__label">{t('common.total', { defaultValue: 'Total Reminders' })}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card__icon" style={{ backgroundColor: '#FFFBEB', color: '#D97706' }}>
              <Clock size={24} />
            </div>
            <div className="stat-card__content">
              <span className="stat-card__value">{stats.pending}</span>
              <span className="stat-card__label">{t('enums.reminderStatus.PENDING', { defaultValue: 'Pending' })}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card__icon stat-card__icon--success">
              <CheckCircle2 size={24} />
            </div>
            <div className="stat-card__content">
              <span className="stat-card__value">{stats.completed}</span>
              <span className="stat-card__label">{t('enums.reminderStatus.COMPLETED', { defaultValue: 'Completed' })}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card__icon" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
              <AlertCircle size={24} />
            </div>
            <div className="stat-card__content">
              <span className="stat-card__value">{stats.highPriority}</span>
              <span className="stat-card__label">{t('enums.reminderPriority.HIGH', { defaultValue: 'High Priority' })}</span>
            </div>
          </div>
        </div>
      )}

      {/* Table & Filter Toolbar */}
      <div className="table-toolbar" style={{ gap: '0.875rem', flexWrap: 'wrap' }}>
        <div className="search-input-wrap" style={{ flex: '1 1 240px', maxWidth: '340px' }}>
          <Search size={16} className="search-input__icon" />
          <input
            id="input-reminder-search"
            type="text"
            className="form-input search-input"
            placeholder={t('reminders.filters.searchPlaceholder', { defaultValue: 'Search by title, category...' })}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="search-input__clear" onClick={() => setSearchTerm('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="table-toolbar__filters" style={{ flexGrow: 1, display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Filter size={15} style={{ color: 'var(--text-secondary)' }} />
            <select
              className="form-input"
              style={{ width: '160px', height: '36px', padding: '0 0.75rem', borderRadius: '8px', fontSize: '0.8125rem' }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
            >
              <option value="ALL">{t('reminders.filters.allStatuses', { defaultValue: 'All Statuses' })}</option>
              <option value="PENDING">{t('enums.reminderStatus.PENDING', { defaultValue: 'Pending' })}</option>
              <option value="COMPLETED">{t('enums.reminderStatus.COMPLETED', { defaultValue: 'Completed' })}</option>
              <option value="CANCELLED">{t('enums.reminderStatus.CANCELLED', { defaultValue: 'Cancelled' })}</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <select
              className="form-input"
              style={{ width: '160px', height: '36px', padding: '0 0.75rem', borderRadius: '8px', fontSize: '0.8125rem' }}
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as PriorityFilter)}
            >
              <option value="ALL">{t('reminders.filters.allPriorities', { defaultValue: 'All Priorities' })}</option>
              <option value="HIGH">{t('enums.reminderPriority.HIGH', { defaultValue: 'High Priority' })}</option>
              <option value="MEDIUM">{t('enums.reminderPriority.MEDIUM', { defaultValue: 'Medium Priority' })}</option>
              <option value="LOW">{t('enums.reminderPriority.LOW', { defaultValue: 'Low Priority' })}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="table-loading">
          <Loader2 size={32} className="spinner" />
          <span>{t('common.loading', { defaultValue: 'Loading reminders...' })}</span>
        </div>
      ) : viewMode === 'list' ? (
        /* ─── LIST VIEW ─── */
        filteredReminders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon" style={{ backgroundColor: 'var(--accent-primary-light)' }}>
              <Bell size={48} style={{ color: 'var(--accent-primary)' }} />
            </div>
            <h3 className="empty-state__title">
              {reminders.length === 0
                ? t('reminders.empty.title', { defaultValue: 'No reminders yet' })
                : t('common.noResults', { defaultValue: 'No matching reminders' })}
            </h3>
            <p className="empty-state__text">
              {reminders.length === 0
                ? t('reminders.empty.description', { defaultValue: 'Create your first reminder to track tasks and follow-ups.' })
                : t('processesPage.adjustFilters', { defaultValue: 'Try adjusting your search or filter criteria.' })}
            </p>
            {reminders.length === 0 && canCreate && (
              <button className="btn btn--primary" onClick={openCreateModal}>
                <Plus size={18} />
                <span>{t('reminders.createReminder', { defaultValue: 'New Reminder' })}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table" id="reminders-table">
              <thead>
                <tr>
                  <th>
                    <button className="th-sort" onClick={() => toggleSort('title')}>
                      {t('reminders.fields.title', { defaultValue: 'Title' })} <ArrowUpDown size={14} />
                    </button>
                  </th>
                  <th>
                    <button className="th-sort" onClick={() => toggleSort('priority')}>
                      {t('reminders.fields.priority', { defaultValue: 'Priority' })} <ArrowUpDown size={14} />
                    </button>
                  </th>
                  <th>
                    <button className="th-sort" onClick={() => toggleSort('reminderDate')}>
                      {t('reminders.fields.reminderDate', { defaultValue: 'Date & Time' })} <ArrowUpDown size={14} />
                    </button>
                  </th>
                  <th>{t('reminders.fields.recurrence', { defaultValue: 'Recurrence' })}</th>
                  <th>{t('reminders.fields.assignedTo', { defaultValue: 'Assigned To' })}</th>
                  <th>
                    <button className="th-sort" onClick={() => toggleSort('status')}>
                      {t('common.status', { defaultValue: 'Status' })} <ArrowUpDown size={14} />
                    </button>
                  </th>
                  <th>{t('common.actions', { defaultValue: 'Actions' })}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReminders.map((r) => {
                  const pConfig = PRIORITY_CONFIG[r.priority] || PRIORITY_CONFIG.MEDIUM;
                  const sConfig = STATUS_CONFIG[r.status] || STATUS_CONFIG.PENDING;
                  const assigneeNamesList = r.assignees
                    .map((a) => `👤 ${a.user.firstName} ${a.user.lastName} (${a.user.role})`)
                    .join('\n');

                  return (
                    <tr key={r.id}>
                      <td>
                        <div className="cell-primary">
                          <div
                            className="cell-avatar"
                            style={{
                              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                              fontSize: '0.6rem',
                            }}
                          >
                            <Bell size={14} />
                          </div>
                          <div>
                            <span
                              className="cell-primary__name"
                              style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--primary, #3B82F6)' }}
                              onClick={() => openViewModal(r)}
                              title={t('reminders.viewDetails', { defaultValue: 'View Details' })}
                            >
                              {r.title}
                            </span>
                            {r.category && (
                              <span
                                style={{
                                  fontSize: '0.6875rem',
                                  fontWeight: 500,
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: 'var(--bg-secondary)',
                                  color: 'var(--text-secondary)',
                                  marginLeft: '8px',
                                }}
                              >
                                {r.category}
                              </span>
                            )}
                            {r.description && (
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                                {r.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: pConfig.color,
                            backgroundColor: pConfig.bg,
                            border: `1px solid ${pConfig.border}`,
                          }}
                        >
                          {t(`enums.reminderPriority.${r.priority}`, { defaultValue: r.priority })}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem' }}>
                          <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                          <span>
                            {r.reminderDate
                              ? new Date(r.reminderDate).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
                              : '—'}
                            {' '}
                            <strong style={{ fontWeight: 600 }}>{r.reminderTime}</strong>
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            fontWeight: 500,
                          }}
                        >
                          <RefreshCw size={12} />
                          {t(`enums.reminderRecurrence.${r.recurrence}`, { defaultValue: r.recurrence })}
                        </span>
                      </td>

                      {/* ASSIGNED TO: COUNT BADGE WITH SIDEBAR STYLED TOOLTIP SHOWING NAMES */}
                      <td>
                        {r.assignees.length === 0 ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                        ) : (
                          <span
                            data-tooltip-top={assigneeNamesList}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 10px',
                              borderRadius: '16px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              backgroundColor: 'rgba(59, 130, 246, 0.1)',
                              color: 'var(--primary, #3B82F6)',
                              border: '1px solid rgba(59, 130, 246, 0.25)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <User size={13} />
                            <span>
                              {r.assignees.length} {r.assignees.length === 1 ? t('reminders.assignedOne', { defaultValue: 'Assigned' }) : t('reminders.assignedMany', { defaultValue: 'Assigned' })}
                            </span>
                          </span>
                        )}
                      </td>

                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: sConfig.color,
                            backgroundColor: sConfig.bg,
                            border: `1px solid ${sConfig.border}`,
                          }}
                        >
                          {sConfig.icon}
                          {t(`enums.reminderStatus.${r.status}`, { defaultValue: r.status })}
                        </span>
                      </td>

                      {/* ACTIONS: VIEW DETAILS (ADMIN & OWNER), COMPLETE, EDIT, DELETE */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            className="btn-action"
                            title={t('reminders.viewDetails', { defaultValue: 'View Details' })}
                            onClick={() => openViewModal(r)}
                          >
                            <Eye size={14} />
                            <span>{t('common.view', { defaultValue: 'View' })}</span>
                          </button>
                          <button
                            className={`btn-action ${r.status === 'COMPLETED' ? 'btn-action--success' : ''}`}
                            title={r.status === 'PENDING' ? t('reminders.actions.markComplete', { defaultValue: 'Mark Complete' }) : t('reminders.actions.markPending', { defaultValue: 'Mark Pending' })}
                            onClick={() => handleStatusToggle(r)}
                          >
                            <CheckCircle2 size={14} />
                            <span>{r.status === 'COMPLETED' ? t('enums.reminderStatus.COMPLETED', { defaultValue: 'Completed' }) : t('common.complete', { defaultValue: 'Complete' })}</span>
                          </button>
                          {canEdit && (
                            <button
                              className="btn-action"
                              title={t('common.edit', { defaultValue: 'Edit' })}
                              onClick={() => openEditModal(r)}
                            >
                              <Edit3 size={14} />
                              <span>{t('common.edit', { defaultValue: 'Edit' })}</span>
                            </button>
                          )}
                          {canDelete && (
                            <button
                              className="btn-action btn-action--danger"
                              title={t('common.delete', { defaultValue: 'Delete' })}
                              onClick={() => openDeleteModal(r)}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination
              currentPage={currentPage}
              totalItems={filteredReminders.length}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
            />
          </div>
        )
      ) : (
        /* ─── CALENDAR VIEW ─── */
        <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          {/* Month Mode View */}
          {calendarViewMode === 'month' && (
            <div>
              {/* Day Headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                {dayNames.map((dName, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '0.625rem',
                      textAlign: 'center',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {dName}
                  </div>
                ))}
              </div>

              {/* Month Grid Cells */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(120px, auto)' }}>
                {monthGridDays.map((cell, idx) => {
                  const dateKey = getLocalDateKey(cell.date);
                  const isToday = dateKey === todayKeyStr;
                  const dayReminders = remindersByDate[dateKey] || [];
                  const displayReminders = dayReminders.slice(0, 3);
                  const extraCount = dayReminders.length - 3;

                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '0.5rem',
                        borderRight: (idx + 1) % 7 === 0 ? 'none' : '1px solid var(--border)',
                        borderBottom: '1px solid var(--border)',
                        backgroundColor: isToday ? 'rgba(59, 130, 246, 0.04)' : cell.isCurrentMonth ? 'var(--bg-surface)' : 'var(--bg-secondary)',
                        opacity: cell.isCurrentMonth ? 1 : 0.45,
                        minHeight: '120px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.375rem',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      {/* Cell Day Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: '0.8125rem',
                            fontWeight: isToday ? 700 : 500,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            backgroundColor: isToday ? 'var(--primary, #3B82F6)' : 'transparent',
                            color: isToday ? '#FFFFFF' : 'var(--text-primary)',
                            boxShadow: isToday ? '0 2px 6px rgba(59,130,246,0.3)' : 'none',
                          }}
                        >
                          {cell.date.getDate()}
                        </span>

                        {dayReminders.length > 0 && (
                          <span
                            onClick={() => setDayModal({ isOpen: true, date: cell.date, reminders: dayReminders })}
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              color: 'var(--primary, #3B82F6)',
                              cursor: 'pointer',
                              padding: '1px 6px',
                              borderRadius: '10px',
                              backgroundColor: 'rgba(59, 130, 246, 0.12)',
                              border: '1px solid rgba(59, 130, 246, 0.2)',
                            }}
                            title={t('reminders.calendar.remindersCount', { count: dayReminders.length })}
                          >
                            {dayReminders.length}
                          </span>
                        )}
                      </div>

                      {/* Reminder Item Chips */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                        {displayReminders.map((rem) => {
                          const pConfig = PRIORITY_CONFIG[rem.priority] || PRIORITY_CONFIG.MEDIUM;
                          const sConfig = STATUS_CONFIG[rem.status] || STATUS_CONFIG.PENDING;
                          return (
                            <div
                              key={rem.id}
                              onClick={() => openViewModal(rem)}
                              style={{
                                padding: '4px 6px',
                                borderRadius: '5px',
                                backgroundColor: pConfig.bg,
                                borderLeft: `3px solid ${pConfig.color}`,
                                borderTop: `1px solid ${pConfig.border}`,
                                borderRight: `1px solid ${pConfig.border}`,
                                borderBottom: `1px solid ${pConfig.border}`,
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                color: 'var(--text-primary)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                                transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 }}>
                                <span style={{ fontSize: '0.75rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                  {rem.title}
                                </span>
                                <span style={{ color: sConfig.color, display: 'flex', alignItems: 'center' }}>
                                  {sConfig.icon}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                                ⏰ {rem.reminderTime}
                              </div>
                            </div>
                          );
                        })}

                        {extraCount > 0 && (
                          <button
                            onClick={() => setDayModal({ isOpen: true, date: cell.date, reminders: dayReminders })}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--primary, #3B82F6)',
                              fontSize: '0.7188rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              textAlign: 'left',
                              padding: '2px 4px',
                            }}
                          >
                            + {extraCount} {t('common.more', { defaultValue: 'more' })}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Week Mode View */}
          {calendarViewMode === 'week' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                {weekGridDays.map((wDate, idx) => {
                  const dateKey = getLocalDateKey(wDate);
                  const isToday = dateKey === todayKeyStr;
                  const dayName = wDate.toLocaleDateString(locale, { weekday: 'short' });

                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '0.75rem',
                        textAlign: 'center',
                        borderRight: idx === 6 ? 'none' : '1px solid var(--border)',
                        backgroundColor: isToday ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                      }}
                    >
                      <div style={{ fontSize: '0.7188rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>{dayName}</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: isToday ? 'var(--primary, #3B82F6)' : 'var(--text-primary)', marginTop: '2px' }}>{wDate.getDate()}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: '400px' }}>
                {weekGridDays.map((wDate, idx) => {
                  const dateKey = getLocalDateKey(wDate);
                  const dayReminders = remindersByDate[dateKey] || [];

                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '0.5rem',
                        borderRight: idx === 6 ? 'none' : '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                      }}
                    >
                      {dayReminders.length === 0 ? (
                        <div style={{ padding: '1.5rem 0.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          —
                        </div>
                      ) : (
                        dayReminders.map((rem) => {
                          const pConfig = PRIORITY_CONFIG[rem.priority] || PRIORITY_CONFIG.MEDIUM;
                          const sConfig = STATUS_CONFIG[rem.status] || STATUS_CONFIG.PENDING;
                          return (
                            <div
                              key={rem.id}
                              onClick={() => openViewModal(rem)}
                              style={{
                                padding: '6px 8px',
                                borderRadius: '6px',
                                backgroundColor: pConfig.bg,
                                borderLeft: `3px solid ${pConfig.color}`,
                                borderTop: `1px solid ${pConfig.border}`,
                                borderRight: `1px solid ${pConfig.border}`,
                                borderBottom: `1px solid ${pConfig.border}`,
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                              }}
                            >
                              <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{rem.title}</span>
                                <span style={{ color: sConfig.color }}>{sConfig.icon}</span>
                              </div>
                              <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                ⏰ {rem.reminderTime}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Day Mode View */}
          {calendarViewMode === 'day' && (
            <div style={{ padding: '1.5rem' }}>
              {(() => {
                const dateKey = getLocalDateKey(currentDate);
                const dayReminders = remindersByDate[dateKey] || [];

                if (dayReminders.length === 0) {
                  return (
                    <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <CalendarIcon size={44} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                      <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 500 }}>
                        {t('reminders.calendar.noReminders', { defaultValue: 'No reminders on this date' })}
                      </p>
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                    {dayReminders.map((rem) => {
                      const pConfig = PRIORITY_CONFIG[rem.priority] || PRIORITY_CONFIG.MEDIUM;
                      const sConfig = STATUS_CONFIG[rem.status] || STATUS_CONFIG.PENDING;
                      return (
                        <div
                          key={rem.id}
                          onClick={() => openViewModal(rem)}
                          style={{
                            padding: '1.125rem',
                            borderRadius: '10px',
                            backgroundColor: pConfig.bg,
                            borderLeft: `5px solid ${pConfig.color}`,
                            borderTop: `1px solid ${pConfig.border}`,
                            borderRight: `1px solid ${pConfig.border}`,
                            borderBottom: `1px solid ${pConfig.border}`,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.625rem',
                            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{rem.title}</span>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: sConfig.color,
                                padding: '3px 9px',
                                borderRadius: '12px',
                                backgroundColor: 'rgba(255,255,255,0.85)',
                              }}
                            >
                              {sConfig.icon}
                              {t(`enums.reminderStatus.${rem.status}`, { defaultValue: rem.status })}
                            </span>
                          </div>

                          {rem.category && (
                            <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                              🏷️ {rem.category}
                            </div>
                          )}

                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            ⏰ <strong>{rem.reminderTime}</strong>
                          </div>

                          {rem.description && (
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                              {rem.description}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ─── CREATE MODAL ─── */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div className="modal__header">
              <h3 className="modal__title">{t('reminders.createReminder', { defaultValue: 'New Reminder' })}</h3>
              <button className="modal__close" onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>
            {renderFormFields(handleCreate, false)}
          </div>
        </div>
      )}

      {/* ─── EDIT MODAL ─── */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div className="modal__header">
              <h3 className="modal__title">{t('reminders.editReminder', { defaultValue: 'Edit Reminder' })}</h3>
              <button className="modal__close" onClick={() => setShowEditModal(false)}>
                <X size={18} />
              </button>
            </div>
            {renderFormFields(handleEdit, true)}
          </div>
        </div>
      )}

      {/* ─── VIEW MODAL (ADMIN & OWNER) ─── */}
      {showViewModal && viewingReminder && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div className="modal__header">
              <h3 className="modal__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Eye size={20} style={{ color: 'var(--primary, #3B82F6)' }} />
                {t('reminders.viewReminder', { defaultValue: 'Reminder Details' })}
              </h3>
              <button className="modal__close" onClick={() => setShowViewModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal__body" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Header Info Banner */}
              <div style={{ padding: '1rem', borderRadius: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {viewingReminder.title}
                  </h4>
                  {viewingReminder.category && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)', display: 'inline-block', marginTop: '4px' }}>
                      🏷️ {viewingReminder.category}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {/* Priority Badge */}
                  <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, color: PRIORITY_CONFIG[viewingReminder.priority]?.color, backgroundColor: PRIORITY_CONFIG[viewingReminder.priority]?.bg, border: `1px solid ${PRIORITY_CONFIG[viewingReminder.priority]?.border}` }}>
                    {t(`enums.reminderPriority.${viewingReminder.priority}`, { defaultValue: viewingReminder.priority })}
                  </span>
                  {/* Status Badge */}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, color: STATUS_CONFIG[viewingReminder.status]?.color, backgroundColor: STATUS_CONFIG[viewingReminder.status]?.bg, border: `1px solid ${STATUS_CONFIG[viewingReminder.status]?.border}` }}>
                    {STATUS_CONFIG[viewingReminder.status]?.icon}
                    {t(`enums.reminderStatus.${viewingReminder.status}`, { defaultValue: viewingReminder.status })}
                  </span>
                </div>
              </div>

              {/* Details Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                    📅 {t('reminders.fields.reminderDate', { defaultValue: 'Reminder Date' })}
                  </span>
                  <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    {viewingReminder.reminderDate ? new Date(viewingReminder.reminderDate).toLocaleDateString(locale, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                  </strong>
                </div>

                <div style={{ padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                    ⏰ {t('reminders.fields.reminderTime', { defaultValue: 'Reminder Time' })}
                  </span>
                  <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    {viewingReminder.reminderTime}
                  </strong>
                </div>

                <div style={{ padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                    🔄 {t('reminders.fields.recurrence', { defaultValue: 'Recurrence' })}
                  </span>
                  <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    {t(`enums.reminderRecurrence.${viewingReminder.recurrence}`, { defaultValue: viewingReminder.recurrence })}
                  </strong>
                </div>

                <div style={{ padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                    🏢 {t('common.branch', { defaultValue: 'Branch' })}
                  </span>
                  <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    {viewingReminder.branch?.name || '—'}
                  </strong>
                </div>

                <div style={{ padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                    👤 {t('reminders.createdBy', { defaultValue: 'Created By' })}
                  </span>
                  <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    {viewingReminder.createdBy ? `${viewingReminder.createdBy.firstName} ${viewingReminder.createdBy.lastName} (${viewingReminder.createdBy.role})` : '—'}
                  </strong>
                </div>

                <div style={{ padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                    ⏰ {t('reminders.lastNotified', { defaultValue: 'Last Notified' })}
                  </span>
                  <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    {viewingReminder.lastNotifiedAt ? new Date(viewingReminder.lastNotifiedAt).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : t('reminders.notNotifiedYet', { defaultValue: 'Not notified yet' })}
                  </strong>
                </div>
              </div>

              {/* Description Section */}
              {viewingReminder.description && (
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    {t('reminders.fields.description', { defaultValue: 'Description' })}
                  </label>
                  <div style={{ padding: '0.875rem', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: '0.875rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {viewingReminder.description}
                  </div>
                </div>
              )}

              {/* Assigned Team Members Section */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <User size={15} />
                  {t('reminders.assignedTeamMembers', { defaultValue: 'Assigned Team Members' })} ({viewingReminder.assignees.length})
                </label>
                {viewingReminder.assignees.length === 0 ? (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>—</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {viewingReminder.assignees.map((a) => (
                      <div
                        key={a.id}
                        style={{
                          padding: '0.625rem 0.875rem',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(59, 130, 246, 0.08)',
                          border: '1px solid rgba(59, 130, 246, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.625rem',
                        }}
                      >
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary, #3B82F6)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8125rem' }}>
                          {a.user.firstName[0]}
                        </div>
                        <div>
                          <strong style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                            {a.user.firstName} {a.user.lastName}
                          </strong>
                          <span style={{ fontSize: '0.7188rem', color: 'var(--text-secondary)' }}>
                            {a.user.email} • {a.user.role}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="modal__footer" style={{ padding: '1rem 1.75rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', backgroundColor: 'var(--bg-surface)', marginTop: 0 }}>
              <button className="btn btn-outline" onClick={() => setShowViewModal(false)}>
                {t('common.close', { defaultValue: 'Close' })}
              </button>
              {canEdit && (
                <button
                  className="btn btn--primary"
                  onClick={() => {
                    setShowViewModal(false);
                    openEditModal(viewingReminder);
                  }}
                >
                  <Edit3 size={15} />
                  <span>{t('common.edit', { defaultValue: 'Edit' })}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE MODAL ─── */}
      {showDeleteModal && deletingReminder && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '440px', display: 'flex', flexDirection: 'column' }}>
            <div className="modal__header">
              <h3 className="modal__title">{t('reminders.confirmDelete.title', { defaultValue: 'Delete Reminder' })}</h3>
              <button className="modal__close" onClick={() => setShowDeleteModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal__body">
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {t('reminders.confirmDelete.message', { defaultValue: 'Are you sure you want to delete this reminder?' })}
              </p>
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px' }}>
                <strong style={{ display: 'block', fontSize: '0.875rem' }}>{deletingReminder.title}</strong>
                {deletingReminder.category && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{deletingReminder.category}</span>
                )}
              </div>
            </div>
            <div className="modal__footer" style={{ padding: '1rem 1.75rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', backgroundColor: 'var(--bg-surface)', marginTop: 0 }}>
              <button className="btn btn-outline" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </button>
              <button className="btn btn--danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? (
                  <>
                    <Loader2 size={16} className="spinner" />
                    <span>{t('common.deleting', { defaultValue: 'Deleting...' })}</span>
                  </>
                ) : (
                  <span>{t('common.delete', { defaultValue: 'Delete' })}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DAY DETAIL MODAL ─── */}
      {dayModal.isOpen && dayModal.date && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '520px', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
            <div className="modal__header">
              <h3 className="modal__title">
                {t('reminders.calendar.titleDate', { defaultValue: 'Reminders for' })} {dayModal.date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
              </h3>
              <button className="modal__close" onClick={() => setDayModal({ isOpen: false, date: null, reminders: [] })}>
                <X size={18} />
              </button>
            </div>
            <div className="modal__body" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {dayModal.reminders.map((rem) => {
                const pConfig = PRIORITY_CONFIG[rem.priority] || PRIORITY_CONFIG.MEDIUM;
                const sConfig = STATUS_CONFIG[rem.status] || STATUS_CONFIG.PENDING;
                return (
                  <div
                    key={rem.id}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderLeft: `4px solid ${pConfig.color}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{rem.title}</div>
                      {rem.category && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{rem.category} • </span>
                      )}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>⏰ {rem.reminderTime}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: sConfig.color }}>
                        {t(`enums.reminderStatus.${rem.status}`, { defaultValue: rem.status })}
                      </span>
                      <button
                        className="btn-icon"
                        onClick={() => {
                          setDayModal({ isOpen: false, date: null, reminders: [] });
                          openViewModal(rem);
                        }}
                        title={t('reminders.viewDetails', { defaultValue: 'View Details' })}
                      >
                        <Eye size={16} />
                      </button>
                      {canEdit && (
                        <button
                          className="btn-icon"
                          onClick={() => {
                            setDayModal({ isOpen: false, date: null, reminders: [] });
                            openEditModal(rem);
                          }}
                        >
                          <Edit3 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="modal__footer" style={{ padding: '1rem 1.75rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', backgroundColor: 'var(--bg-surface)', marginTop: 0 }}>
              <button className="btn btn-outline" onClick={() => setDayModal({ isOpen: false, date: null, reminders: [] })}>
                {t('common.close', { defaultValue: 'Close' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
