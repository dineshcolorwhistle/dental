import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  X,
  AlertCircle,
  Loader2,
  Trash2,
  Pencil,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  paymentMethodService,
  type PaymentMethodItem,
  type CreatePaymentMethodPayload,
} from '../services';
import { useAuth } from '../context';
import { useAppDate } from '../hooks';
import { Pagination } from '../components';

export function PaymentMethodsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { formatDate } = useAppDate();

  const isAdmin = user?.role === 'ADMIN';
  const isOwner = user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN';
  const canManage = isAdmin || isOwner;

  const [methods, setMethods] = useState<PaymentMethodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 10;

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [methodToDelete, setMethodToDelete] = useState<PaymentMethodItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form State
  const [form, setForm] = useState<CreatePaymentMethodPayload>({
    name: '',
    description: '',
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState<{ name?: string }>({});

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await paymentMethodService.getAll(false);
      setMethods(data);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          t('paymentMethods.failedLoad', { defaultValue: 'Failed to load payment methods' }),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setCurrentPage(0);
  }, [search, statusFilter]);

  // Filtered methods
  const filtered = useMemo(() => {
    return methods.filter((m) => {
      if (statusFilter === 'ACTIVE' && !m.isActive) return false;
      if (statusFilter === 'INACTIVE' && m.isActive) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          (m.description && m.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [methods, statusFilter, search]);

  const paginated = useMemo(() => {
    return filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  }, [filtered, currentPage]);

  const stats = useMemo(() => {
    return {
      total: methods.length,
      active: methods.filter((m) => m.isActive).length,
      inactive: methods.filter((m) => !m.isActive).length,
    };
  }, [methods]);

  // Form Handlers
  const handleOpenCreate = () => {
    setForm({ name: '', description: '', isActive: true });
    setFormErrors({});
    setShowCreateModal(true);
  };

  const handleOpenEdit = (method: PaymentMethodItem) => {
    setSelectedMethod(method);
    setForm({
      name: method.name,
      description: method.description || '',
      isActive: method.isActive,
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const validateForm = () => {
    const errors: { name?: string } = {};
    if (!form.name.trim()) {
      errors.name = t('validation.fieldRequired', { defaultValue: 'Name is required' });
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSaving(true);
      await paymentMethodService.create({
        name: form.name.trim(),
        description: form.description?.trim() || undefined,
        isActive: form.isActive,
      });
      toast.success(
        t('paymentMethods.createSuccess', { defaultValue: 'Payment method created successfully' }),
      );
      setShowCreateModal(false);
      await fetchData();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          t('paymentMethods.failedCreate', { defaultValue: 'Failed to create payment method' }),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMethod || !validateForm()) return;

    try {
      setSaving(true);
      await paymentMethodService.update(selectedMethod.id, {
        name: form.name.trim(),
        description: form.description?.trim() || undefined,
        isActive: form.isActive,
      });
      toast.success(
        t('paymentMethods.updateSuccess', { defaultValue: 'Payment method updated successfully' }),
      );
      setShowEditModal(false);
      setSelectedMethod(null);
      await fetchData();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          t('paymentMethods.failedUpdate', { defaultValue: 'Failed to update payment method' }),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (method: PaymentMethodItem) => {
    if (!canManage) return;
    try {
      const updated = await paymentMethodService.update(method.id, {
        isActive: !method.isActive,
      });
      setMethods((prev) => prev.map((m) => (m.id === method.id ? updated : m)));
      toast.success(
        updated.isActive
          ? t('paymentMethods.activated', { defaultValue: 'Payment method activated' })
          : t('paymentMethods.deactivated', { defaultValue: 'Payment method deactivated' }),
      );
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          t('paymentMethods.failedStatusUpdate', { defaultValue: 'Failed to update status' }),
      );
    }
  };

  const handleDelete = async () => {
    if (!methodToDelete) return;
    try {
      setDeleting(true);
      await paymentMethodService.delete(methodToDelete.id);
      toast.success(
        t('paymentMethods.deleteSuccess', { defaultValue: 'Payment method deleted successfully' }),
      );
      setDeleteModalOpen(false);
      setMethodToDelete(null);
      await fetchData();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          t('paymentMethods.failedDelete', { defaultValue: 'Failed to delete payment method' }),
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page-container" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary, #3B82F6)'
            }}>
              <CreditCard size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-heading, #1E293B)', margin: 0 }}>
                {t('paymentMethods.title', { defaultValue: 'Payment Methods' })}
              </h1>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted, #64748B)' }}>
                {t('paymentMethods.subtitle', { defaultValue: 'Manage payment methods available for work order payments and invoices.' })}
              </p>
            </div>
          </div>
        </div>

        {canManage && (
          <button
            id="btn-add-payment-method"
            type="button"
            className="btn btn--primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            onClick={handleOpenCreate}
          >
            <Plus size={18} />
            <span>{t('paymentMethods.addMethod', { defaultValue: 'Add Payment Method' })}</span>
          </button>
        )}
      </div>

      {/* Metrics Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.75rem'
      }}>
        <div style={{
          backgroundColor: 'var(--bg-surface, #FFFFFF)',
          border: '1px solid var(--border, #E2E8F0)',
          borderRadius: '12px',
          padding: '1.25rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase' }}>
            {t('common.total', { defaultValue: 'Total Methods' })}
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-heading, #1E293B)', marginTop: '0.25rem' }}>
            {stats.total}
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-surface, #FFFFFF)',
          border: '1px solid var(--border, #E2E8F0)',
          borderRadius: '12px',
          padding: '1.25rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase' }}>
            {t('common.active', { defaultValue: 'Active' })}
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--success, #10B981)', marginTop: '0.25rem' }}>
            {stats.active}
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-surface, #FFFFFF)',
          border: '1px solid var(--border, #E2E8F0)',
          borderRadius: '12px',
          padding: '1.25rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase' }}>
            {t('common.inactive', { defaultValue: 'Inactive' })}
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-muted, #64748B)', marginTop: '0.25rem' }}>
            {stats.inactive}
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '260px', maxWidth: '420px' }}>
          <div className="search-input-wrapper" style={{ position: 'relative', width: '100%' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              placeholder={t('paymentMethods.searchPlaceholder', { defaultValue: 'Search by method name or description...' })}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.25rem', height: '40px' }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              className={`btn btn--sm ${statusFilter === filter ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => setStatusFilter(filter)}
              style={{ fontWeight: 600 }}
            >
              {filter === 'ALL'
                ? t('common.all', { defaultValue: 'All' })
                : filter === 'ACTIVE'
                ? t('common.active', { defaultValue: 'Active' })
                : t('common.inactive', { defaultValue: 'Inactive' })}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{
        backgroundColor: 'var(--bg-surface, #FFFFFF)',
        border: '1px solid var(--border, #E2E8F0)',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)'
      }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 1rem', gap: '0.75rem' }}>
            <Loader2 size={36} className="spinner" style={{ color: 'var(--accent-primary, #3B82F6)' }} />
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {t('common.loading', { defaultValue: 'Loading payment methods...' })}
            </span>
          </div>
        ) : paginated.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <CreditCard size={42} style={{ color: 'var(--text-muted)', opacity: 0.4, marginBottom: '0.75rem' }} />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)' }}>
              {t('paymentMethods.noMethodsFound', { defaultValue: 'No payment methods found' })}
            </h3>
            <p style={{ margin: '0.25rem 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {search || statusFilter !== 'ALL'
                ? t('common.noMatchingResults', { defaultValue: 'Try adjusting your search or filters' })
                : t('paymentMethods.emptyHint', { defaultValue: 'Get started by creating your first payment method.' })}
            </p>
            {canManage && (
              <button type="button" className="btn btn--outline btn--sm" onClick={handleOpenCreate}>
                <Plus size={14} />
                <span>{t('paymentMethods.addMethod', { defaultValue: 'Add Payment Method' })}</span>
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-muted, #F8FAFC)', borderBottom: '1px solid var(--border, #E2E8F0)' }}>
                  <th style={{ padding: '0.875rem 1.25rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    {t('paymentMethods.methodName', { defaultValue: 'Payment Method' })}
                  </th>
                  <th style={{ padding: '0.875rem 1.25rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    {t('common.description', { defaultValue: 'Description' })}
                  </th>
                  <th style={{ padding: '0.875rem 1.25rem', fontWeight: 700, color: 'var(--text-muted)', width: '140px' }}>
                    {t('common.status', { defaultValue: 'Status' })}
                  </th>
                  <th style={{ padding: '0.875rem 1.25rem', fontWeight: 700, color: 'var(--text-muted)', width: '160px' }}>
                    {t('common.created', { defaultValue: 'Created' })}
                  </th>
                  {canManage && (
                    <th style={{ padding: '0.875rem 1.25rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right', width: '120px' }}>
                      {t('common.actions', { defaultValue: 'Actions' })}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {paginated.map((method) => (
                  <tr
                    key={method.id}
                    style={{
                      borderBottom: '1px solid var(--border, #E2E8F0)',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.02)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          backgroundColor: method.isActive ? 'rgba(59, 130, 246, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: method.isActive ? 'var(--accent-primary, #3B82F6)' : 'var(--text-muted)',
                          flexShrink: 0
                        }}>
                          <CreditCard size={16} />
                        </div>
                        <span>{method.name}</span>
                      </div>
                    </td>

                    <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)' }}>
                      {method.description || (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8125rem' }}>
                          {t('common.noDescription', { defaultValue: 'No description' })}
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '1rem 1.25rem' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(method)}
                        disabled={!canManage}
                        title={canManage ? t('paymentMethods.clickToToggle', { defaultValue: 'Click to toggle status' }) : undefined}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          padding: '3px 10px',
                          borderRadius: '100px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: canManage ? 'pointer' : 'default',
                          border: 'none',
                          backgroundColor: method.isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                          color: method.isActive ? 'var(--success, #10B981)' : 'var(--text-muted, #64748B)',
                          transition: 'opacity 0.15s ease'
                        }}
                      >
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: method.isActive ? 'var(--success, #10B981)' : 'var(--text-muted, #64748B)'
                        }} />
                        {method.isActive ? t('common.active', { defaultValue: 'Active' }) : t('common.inactive', { defaultValue: 'Inactive' })}
                      </button>
                    </td>

                    <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                      {formatDate(method.createdAt, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>

                    {canManage && (
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            style={{ padding: '6px', borderRadius: '6px' }}
                            onClick={() => handleOpenEdit(method)}
                            title={t('common.edit')}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            style={{ padding: '6px', borderRadius: '6px', color: '#EF4444' }}
                            onClick={() => {
                              setMethodToDelete(method);
                              setDeleteModalOpen(true);
                            }}
                            title={t('common.delete')}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > PAGE_SIZE && (
          <div style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
            <Pagination
              currentPage={currentPage}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowCreateModal(false)}>
          <div className="modal modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">{t('paymentMethods.addTitle', { defaultValue: 'Add Payment Method' })}</h2>
                <p className="modal__subtitle">{t('paymentMethods.addSubtitle', { defaultValue: 'Create a payment method option for work order invoices.' })}</p>
              </div>
              <button
                className="modal__close"
                onClick={() => !saving && setShowCreateModal(false)}
                disabled={saving}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="pm-name">
                    {t('paymentMethods.name', { defaultValue: 'Payment Method Name' })} *
                  </label>
                  <input
                    id="pm-name"
                    type="text"
                    className={`form-input ${formErrors.name ? 'form-input--error' : ''}`}
                    placeholder={t('paymentMethods.namePlaceholder', { defaultValue: 'e.g., Credit Card, Wire Transfer, Cash' })}
                    value={form.name}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, name: e.target.value }));
                      if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    disabled={saving}
                    autoFocus
                  />
                  {formErrors.name && (
                    <span className="form-error"><AlertCircle size={12} /> {formErrors.name}</span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="pm-desc">
                    {t('common.description', { defaultValue: 'Description / Instructions' })}
                  </label>
                  <textarea
                    id="pm-desc"
                    className="form-input"
                    rows={3}
                    placeholder={t('paymentMethods.descPlaceholder', { defaultValue: 'Optional notes or account details for this method...' })}
                    value={form.description || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    disabled={saving}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                      disabled={saving}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary, #3B82F6)' }}
                    />
                    <span style={{ fontWeight: 600 }}>{t('paymentMethods.isActiveLabel', { defaultValue: 'Active (available for selection)' })}</span>
                  </label>
                </div>
              </div>

              <div className="modal__footer" style={{ borderTop: '1px solid var(--border)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowCreateModal(false)}
                  disabled={saving}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={saving}
                >
                  {saving ? (
                    <><Loader2 size={16} className="spinner" /> <span>{t('common.saving')}</span></>
                  ) : (
                    <span>{t('common.create')}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedMethod && (
        <div className="modal-overlay" onClick={() => !saving && setShowEditModal(false)}>
          <div className="modal modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">{t('paymentMethods.editTitle', { defaultValue: 'Edit Payment Method' })}</h2>
                <p className="modal__subtitle">{t('paymentMethods.editSubtitle', { name: selectedMethod.name, defaultValue: `Update ${selectedMethod.name}` })}</p>
              </div>
              <button
                className="modal__close"
                onClick={() => !saving && setShowEditModal(false)}
                disabled={saving}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-pm-name">
                    {t('paymentMethods.name', { defaultValue: 'Payment Method Name' })} *
                  </label>
                  <input
                    id="edit-pm-name"
                    type="text"
                    className={`form-input ${formErrors.name ? 'form-input--error' : ''}`}
                    value={form.name}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, name: e.target.value }));
                      if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    disabled={saving}
                    autoFocus
                  />
                  {formErrors.name && (
                    <span className="form-error"><AlertCircle size={12} /> {formErrors.name}</span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-pm-desc">
                    {t('common.description', { defaultValue: 'Description / Instructions' })}
                  </label>
                  <textarea
                    id="edit-pm-desc"
                    className="form-input"
                    rows={3}
                    value={form.description || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    disabled={saving}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                      disabled={saving}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary, #3B82F6)' }}
                    />
                    <span style={{ fontWeight: 600 }}>{t('paymentMethods.isActiveLabel', { defaultValue: 'Active (available for selection)' })}</span>
                  </label>
                </div>
              </div>

              <div className="modal__footer" style={{ borderTop: '1px solid var(--border)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowEditModal(false)}
                  disabled={saving}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={saving}
                >
                  {saving ? (
                    <><Loader2 size={16} className="spinner" /> <span>{t('common.saving')}</span></>
                  ) : (
                    <span>{t('common.save')}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && methodToDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteModalOpen(false)}>
          <div className="modal modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title" style={{ color: '#EF4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={20} />
                <span>{t('paymentMethods.deleteTitle', { defaultValue: 'Delete Payment Method' })}</span>
              </h2>
              <button
                className="modal__close"
                onClick={() => !deleting && setDeleteModalOpen(false)}
                disabled={deleting}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal__body">
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                {t('paymentMethods.deleteConfirm', {
                  name: methodToDelete.name,
                  defaultValue: `Are you sure you want to delete payment method "${methodToDelete.name}"? This action cannot be undone.`,
                })}
              </p>
            </div>
            <div className="modal__footer" style={{ borderTop: '1px solid var(--border)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={handleDelete}
                disabled={deleting}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
              >
                {deleting ? (
                  <><Loader2 size={16} className="spinner" /> <span>{t('common.deleting')}</span></>
                ) : (
                  <span>{t('common.delete')}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
