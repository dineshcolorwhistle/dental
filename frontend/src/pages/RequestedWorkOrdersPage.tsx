import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  X,
  AlertCircle,
  Loader2,
  Eye,
  CircleDot,
  Clock,
  PlayCircle,
  ShieldCheck,
  CheckCircle2,
  PlusCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAuth, useSocket } from '../context';
import {
  technicianPortalService,
  doctorService,
  prosthesisTypeService,
  workOrderService,
  type TechnicianWorkOrderListItem,
  type DoctorListItem,
  type ProsthesisTypeListItem,
} from '../services';
import { Pagination, SearchableSelect, ViewWorkOrderModal } from '../components';

const PAGE_SIZE = 10;

// Localized status configs matching other parts of the application
const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  CREATED: { color: '#6B7280', bg: '#F3F4F6', icon: <CircleDot size={12} /> },
  ASSIGNED: { color: '#3B82F6', bg: '#EFF6FF', icon: <Clock size={12} /> },
  IN_PROGRESS: { color: '#F59E0B', bg: '#FFFBEB', icon: <PlayCircle size={12} /> },
  INTERNAL_VERIFICATION: { color: '#8B5CF6', bg: '#F5F3FF', icon: <ShieldCheck size={12} /> },
  EXTERNAL_VERIFICATION: { color: '#6366F1', bg: '#EEF2FF', icon: <ShieldCheck size={12} /> },
  COMPLETED: { color: '#10B981', bg: '#ECFDF5', icon: <CheckCircle2 size={12} /> },
  FAILED: { color: '#EF4444', bg: '#FEF2F2', icon: <AlertCircle size={12} /> },
  CANCELLED: { color: '#F97316', bg: '#FFF3E0', icon: <X size={12} /> },
};

export function RequestedWorkOrdersPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  // State lists
  const [workOrders, setWorkOrders] = useState<TechnicianWorkOrderListItem[]>([]);
  const [doctors, setDoctors] = useState<DoctorListItem[]>([]);
  const [prosthesisTypes, setProsthesisTypes] = useState<ProsthesisTypeListItem[]>([]);

  // Page level states
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(0);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedWOId, setSelectedWOId] = useState<string | null>(null);

  // Create Form State
  const [saving, setSaving] = useState(false);
  const [generatedFolio, setGeneratedFolio] = useState('');
  const [form, setForm] = useState({
    doctorId: '',
    patient: '',
    boxNumber: '',
    prosthesisTypeId: '',
    specification: '',
    color: 'A1',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Fetch technician requested work orders
  const fetchWorkOrders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await technicianPortalService.getCreatedWorkOrders();
      setWorkOrders(data);
    } catch {
      toast.error(t('workOrder.failedRetrieveWorkOrders', { defaultValue: 'Failed to retrieve work orders' }));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Load reference data for creation form
  const loadReferenceData = useCallback(async () => {
    try {
      const branchScope = user?.branchId || undefined;
      const [doctorData, ptData] = await Promise.all([
        doctorService.getAll(branchScope),
        prosthesisTypeService.getAll(),
      ]);
      setDoctors(doctorData.filter((d) => d.isActive));
      setProsthesisTypes(ptData);
    } catch (err) {
      toast.error(t('common.failedLoadReference', { defaultValue: 'Failed to load reference data' }));
    }
  }, [user?.branchId, t]);

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  // Socket updates
  useEffect(() => {
    if (!socket) return;

    const handleSocketUpdate = () => {
      fetchWorkOrders();
    };

    socket.on('work_order_created', handleSocketUpdate);
    socket.on('work_order_updated', handleSocketUpdate);

    return () => {
      socket.off('work_order_created', handleSocketUpdate);
      socket.off('work_order_updated', handleSocketUpdate);
    };
  }, [socket, fetchWorkOrders]);

  useEffect(() => {
    if (isConnected) {
      fetchWorkOrders();
    }
  }, [isConnected, fetchWorkOrders]);

  // Load next folio number when opening modal
  const fetchNextFolio = async () => {
    if (!user?.branchId) return;
    try {
      const res = await workOrderService.getNextFolioNumber(user.branchId);
      if (res && res.folioNumber) {
        setGeneratedFolio(res.folioNumber);
      }
    } catch (err) {
      console.error('Failed to generate next folio number', err);
    }
  };

  const handleCreateOpen = async () => {
    setForm({
      doctorId: '',
      patient: '',
      boxNumber: '',
      prosthesisTypeId: '',
      specification: '',
      color: 'A1',
      notes: '',
    });
    setFormErrors({});
    setGeneratedFolio('');
    setShowCreateModal(true);
    await loadReferenceData();
    await fetchNextFolio();
  };

  const handleInputChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.doctorId) errors.doctorId = t('requestedWorkOrders.validationDoctorRequired', { defaultValue: 'Doctor is required' });
    if (!form.patient.trim()) errors.patient = t('requestedWorkOrders.validationPatientRequired', { defaultValue: 'Patient name is required' });
    if (!form.prosthesisTypeId) errors.prosthesisTypeId = t('requestedWorkOrders.validationProsthesisTypeRequired', { defaultValue: 'Prosthesis type is required' });
    if (!form.color.trim()) errors.color = t('requestedWorkOrders.validationColorRequired', { defaultValue: 'Color is required' });
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSaving(true);
      const payload = {
        doctorId: form.doctorId,
        patient: form.patient.trim(),
        boxNumber: form.boxNumber.trim() || undefined,
        prosthesisTypeId: form.prosthesisTypeId,
        specification: form.specification.trim() || undefined,
        color: form.color.trim(),
        notes: form.notes.trim() || undefined,
      };

      await technicianPortalService.createWorkOrder(payload);
      toast.success(t('requestedWorkOrders.createSuccess', { defaultValue: 'Work order request created successfully!' }));
      setShowCreateModal(false);
      fetchWorkOrders();
    } catch (err: any) {
      const msg = err?.response?.data?.message || t('requestedWorkOrders.failedCreate', { defaultValue: 'Failed to create work order request' });
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSaving(false);
    }
  };

  // Filter & Search
  const filtered = workOrders.filter((wo) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        wo.folioNumber.toLowerCase().includes(q) ||
        wo.patient.toLowerCase().includes(q) ||
        (wo.doctor?.name && wo.doctor.name.toLowerCase().includes(q)) ||
        (wo.prosthesisType?.name && wo.prosthesisType.name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const paginated = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  return (
    <div className="admins-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-header__title">{t('requestedWorkOrders.title', { defaultValue: 'Requested Work Orders' })}</h1>
          <p className="page-header__subtitle">{t('requestedWorkOrders.subtitle', { defaultValue: 'Create and track your work order requests for review' })}</p>
        </div>
        <button
          id="btn-tech-create-wo"
          className="btn btn--primary"
          onClick={handleCreateOpen}
        >
          <Plus size={18} />
          <span>{t('requestedWorkOrders.createNew', { defaultValue: 'Create Work Order' })}</span>
        </button>
      </div>

      {/* Search Filter */}
      <div className="table-toolbar" style={{ gap: '1rem' }}>
        <div className="search-input-wrap">
          <Search size={16} className="search-input__icon" />
          <input
            id="input-wo-search"
            type="text"
            className="form-input search-input"
            placeholder={t('workOrders.searchPlaceholder', { defaultValue: 'Search by folio, patient, doctor...' })}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(0);
            }}
          />
          {searchQuery && (
            <button className="search-input__clear" onClick={() => setSearchQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Grid / Table Listing */}
      {loading ? (
        <div className="table-loading">
          <Loader2 size={32} className="spinner" />
          <span>{t('workOrders.loading', { defaultValue: 'Loading work orders...' })}</span>
        </div>
      ) : paginated.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon" style={{ backgroundColor: 'var(--accent-primary-light)' }}>
            <PlusCircle size={48} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <h3 className="empty-state__title">
            {t('workOrders.noWorkOrders', { defaultValue: 'No work orders found' })}
          </h3>
          <p className="empty-state__text">
            {t('workOrders.createDesc', { defaultValue: 'Create your first work order to start managing lab workflows.' })}
          </p>
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table" id="requested-work-orders-table">
            <thead>
              <tr>
                <th>{t('workOrders.folioNumber', { defaultValue: 'Folio #' })}</th>
                <th>{t('workOrders.patient', { defaultValue: 'Patient' })}</th>
                <th>{t('workOrders.doctor', { defaultValue: 'Doctor' })}</th>
                <th>{t('workOrders.prosthesisType', { defaultValue: 'Prosthesis Type' })}</th>
                <th>{t('workOrders.color', { defaultValue: 'Color' })}</th>
                <th>{t('workOrders.status', { defaultValue: 'Status' })}</th>
                <th>{t('workOrders.createdAt', { defaultValue: 'Created At' })}</th>
                <th style={{ textAlign: 'right' }}>{t('common.actions', { defaultValue: 'Actions' })}</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((wo) => {
                const statusInfo = STATUS_CONFIG[wo.status] || { color: '#6B7280', bg: '#F3F4F6', icon: <CircleDot size={12} /> };
                return (
                  <tr key={wo.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{wo.folioNumber}</td>
                    <td>{wo.patient}</td>
                    <td>{wo.doctor?.name}</td>
                    <td>{wo.prosthesisType?.name}</td>
                    <td><span className="badge badge--neutral">{wo.color}</span></td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          color: statusInfo.color,
                          backgroundColor: statusInfo.bg,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {statusInfo.icon}
                        <span>{t(`enums.workOrderStatus.${wo.status}`)}</span>
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {new Date(wo.createdAt).toLocaleDateString(
                        i18n.language?.startsWith('es') ? 'es-MX' : 'en-US',
                        { day: 'numeric', month: 'short', year: 'numeric' }
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn-action"
                        onClick={() => setSelectedWOId(wo.id)}
                        title={t('workOrders.viewOrder', { defaultValue: 'View Order' })}
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination
            currentPage={currentPage}
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Creation Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowCreateModal(false)}>
          <div className="modal modal--xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">{t('requestedWorkOrders.popupTitle', { defaultValue: 'New Work Order Request' })}</h2>
                <p className="modal__subtitle">{t('requestedWorkOrders.popupSubtitle', { defaultValue: 'Submit basic details for review by Lab Admin' })}</p>
              </div>
              <button
                className="modal__close"
                onClick={() => !saving && setShowCreateModal(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal__body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                
                {/* Row 1: Doctor + Patient */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="select-wo-doctor">{t('workOrders.doctor', { defaultValue: 'Doctor' })} *</label>
                    <SearchableSelect
                      id="select-wo-doctor"
                      options={doctors.map((d) => ({
                        value: d.id,
                        label: `${d.name}${d.clinicName ? ` — ${d.clinicName}` : ''}`,
                      }))}
                      value={form.doctorId}
                      onChange={(val) => handleInputChange('doctorId', val)}
                      disabled={saving}
                      placeholder={t('doctors.selectDoctor', { defaultValue: 'Select a doctor' })}
                      error={!!formErrors.doctorId}
                    />
                    {formErrors.doctorId && (
                      <span className="form-error"><AlertCircle size={12} /> {formErrors.doctorId}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="input-wo-patient">{t('workOrders.patient', { defaultValue: 'Patient' })} *</label>
                    <input
                      id="input-wo-patient"
                      className={`form-input ${formErrors.patient ? 'form-input--error' : ''}`}
                      type="text"
                      placeholder={t('workOrders.patientPlaceholder', { defaultValue: 'e.g., John Doe' })}
                      value={form.patient}
                      onChange={(e) => handleInputChange('patient', e.target.value)}
                      disabled={saving}
                    />
                    {formErrors.patient && (
                      <span className="form-error"><AlertCircle size={12} /> {formErrors.patient}</span>
                    )}
                  </div>
                </div>

                {/* Row 2: Folio Number + Box Number */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="input-wo-folio">{t('workOrders.folioNumber', { defaultValue: 'Folio Number' })}</label>
                    <input
                      id="input-wo-folio"
                      className="form-input"
                      type="text"
                      value={generatedFolio || t('workOrders.generating', { defaultValue: 'Generating...' })}
                      disabled
                      style={{ backgroundColor: 'var(--bg-muted, #F3F4F6)', cursor: 'not-allowed', fontStyle: 'italic', fontWeight: 600 }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="input-wo-box">{t('workOrders.boxNumber', { defaultValue: 'Box Number' })}</label>
                    <input
                      id="input-wo-box"
                      className="form-input"
                      type="text"
                      placeholder={t('workOrders.boxNumberPlaceholder', { defaultValue: 'e.g., BOX-42' })}
                      value={form.boxNumber}
                      onChange={(e) => handleInputChange('boxNumber', e.target.value)}
                      disabled={saving}
                    />
                  </div>
                </div>

                {/* Prosthesis Type */}
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" htmlFor="select-wo-prosthesis">{t('workOrders.prosthesisType', { defaultValue: 'Prosthesis Type' })} *</label>
                  <SearchableSelect
                    id="select-wo-prosthesis"
                    options={prosthesisTypes.map((pt) => ({
                      value: pt.id,
                      label: pt.name,
                    }))}
                    value={form.prosthesisTypeId}
                    onChange={(val) => handleInputChange('prosthesisTypeId', val)}
                    disabled={saving}
                    placeholder={t('workOrders.selectProsthesisType', { defaultValue: 'Select prosthesis type' })}
                    error={!!formErrors.prosthesisTypeId}
                  />
                  {formErrors.prosthesisTypeId && (
                    <span className="form-error"><AlertCircle size={12} /> {formErrors.prosthesisTypeId}</span>
                  )}
                </div>

                {/* Specification */}
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" htmlFor="input-wo-spec">{t('workOrders.specification', { defaultValue: 'Specification' })}</label>
                  <textarea
                    id="input-wo-spec"
                    className="form-input"
                    style={{ minHeight: '60px', fontFamily: 'inherit', padding: '10px 14px' }}
                    placeholder={t('workOrders.specificationPlaceholder', { defaultValue: 'Color, shade, units, material details...' })}
                    value={form.specification}
                    onChange={(e) => handleInputChange('specification', e.target.value)}
                    disabled={saving}
                  />
                </div>

                {/* Color */}
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" htmlFor="input-wo-color">{t('workOrders.color', { defaultValue: 'Color' })} *</label>
                  <input
                    id="input-wo-color"
                    className={`form-input ${formErrors.color ? 'form-input--error' : ''}`}
                    type="text"
                    placeholder={t('workOrders.colorPlaceholder', { defaultValue: 'e.g., A1, A2, B1...' })}
                    value={form.color}
                    onChange={(e) => handleInputChange('color', e.target.value)}
                    disabled={saving}
                  />
                  {formErrors.color && (
                    <span className="form-error"><AlertCircle size={12} /> {formErrors.color}</span>
                  )}
                </div>

                {/* Notes */}
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" htmlFor="input-wo-notes">{t('workOrders.notes', { defaultValue: 'Notes' })}</label>
                  <textarea
                    id="input-wo-notes"
                    className="form-input"
                    style={{ minHeight: '60px', fontFamily: 'inherit', padding: '10px 14px' }}
                    placeholder={t('workOrders.notesPlaceholder', { defaultValue: 'Additional notes or instructions...' })}
                    value={form.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    disabled={saving}
                  />
                </div>

              </div>

              <div className="modal__footer" style={{ borderTop: '1px solid var(--border)', padding: '1rem 1.75rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowCreateModal(false)}
                  disabled={saving}
                >
                  {t('common.cancel', { defaultValue: 'Cancel' })}
                </button>
                <button
                  id="btn-tech-wo-submit"
                  type="submit"
                  className="btn btn--primary"
                  disabled={saving}
                >
                  {saving ? (
                    <><Loader2 size={16} className="spinner" /><span>{t('common.saving', { defaultValue: 'Saving...' })}</span></>
                  ) : (
                    <span>{t('common.create', { defaultValue: 'Create' })}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details View Modal */}
      {selectedWOId && (
        <ViewWorkOrderModal
          isOpen={!!selectedWOId}
          onClose={() => setSelectedWOId(null)}
          workOrderId={selectedWOId}
        />
      )}
    </div>
  );
}
