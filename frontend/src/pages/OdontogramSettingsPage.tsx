import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Smile,
  Search,
  Plus,
  Trash2,
  Pencil,
  Building2,
  AlertCircle,
  Loader2,
  Save,
  Check,
  X,
  Layers,
  Activity,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  odontogramService,
  branchService,
  type TeethModel,
  type OdontogramTreatmentItem,
  type OdontogramDiagnosticItem,
  type BranchListItem,
  type CreateOdontogramTreatmentPayload,
  type CreateOdontogramDiagnosticPayload,
} from '../services';
import { useAuth } from '../context';
import { Pagination } from '../components';

type ActiveTab = 'DEFAULT' | 'TREATMENTS' | 'DIAGNOSTICS';

const COLOR_PRESETS = [
  '#3B82F6', // Dental Blue
  '#10B981', // Mint Emerald
  '#EF4444', // Caries Red
  '#F59E0B', // Amber Gold
  '#8B5CF6', // Amalgam Purple
  '#EC4899', // Gingival Pink
  '#06B6D4', // Sky Cyan
  '#14B8A6', // Soft Teal
  '#6366F1', // Royal Indigo
  '#F97316', // Coral Orange
];

export function OdontogramSettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const isAdmin = user?.role === 'ADMIN';
  const isOwner = user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN';
  const canAddEdit = isAdmin || user?.role === 'SUPER_ADMIN';
  const canDelete = isOwner;

  const [activeTab, setActiveTab] = useState<ActiveTab>('DEFAULT');
  const [loading, setLoading] = useState(true);

  // Branches for Owner filter
  const [branches, setBranches] = useState<BranchListItem[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');

  // Tab 1: Default Teeth Model
  const [defaultTeethModel, setDefaultTeethModel] = useState<TeethModel>('ADULT');
  const [savingConfig, setSavingConfig] = useState(false);

  // Tab 2: Treatments
  const [treatments, setTreatments] = useState<OdontogramTreatmentItem[]>([]);
  const [treatmentSearch, setTreatmentSearch] = useState('');
  const [treatmentPage, setTreatmentPage] = useState(0);
  const [showCreateTreatmentModal, setShowCreateTreatmentModal] = useState(false);
  const [showEditTreatmentModal, setShowEditTreatmentModal] = useState(false);
  const [selectedTreatment, setSelectedTreatment] = useState<OdontogramTreatmentItem | null>(null);
  const [treatmentForm, setTreatmentForm] = useState<CreateOdontogramTreatmentPayload>({
    name: '',
    description: '',
    color: '#3B82F6',
    appliesToWholeTooth: false,
    branchId: '',
  });
  const [savingTreatment, setSavingTreatment] = useState(false);
  const [showDeleteTreatmentModal, setShowDeleteTreatmentModal] = useState(false);
  const [treatmentToDelete, setTreatmentToDelete] = useState<OdontogramTreatmentItem | null>(null);
  const [deletingTreatment, setDeletingTreatment] = useState(false);

  // Tab 3: Diagnostics
  const [diagnostics, setDiagnostics] = useState<OdontogramDiagnosticItem[]>([]);
  const [diagnosticSearch, setDiagnosticSearch] = useState('');
  const [diagnosticPage, setDiagnosticPage] = useState(0);
  const [showCreateDiagnosticModal, setShowCreateDiagnosticModal] = useState(false);
  const [showEditDiagnosticModal, setShowEditDiagnosticModal] = useState(false);
  const [selectedDiagnostic, setSelectedDiagnostic] = useState<OdontogramDiagnosticItem | null>(null);
  const [diagnosticForm, setDiagnosticForm] = useState<CreateOdontogramDiagnosticPayload>({
    name: '',
    description: '',
    color: '#EF4444',
    appliesToWholeTooth: false,
    branchId: '',
  });
  const [savingDiagnostic, setSavingDiagnostic] = useState(false);
  const [showDeleteDiagnosticModal, setShowDeleteDiagnosticModal] = useState(false);
  const [diagnosticToDelete, setDiagnosticToDelete] = useState<OdontogramDiagnosticItem | null>(null);
  const [deletingDiagnostic, setDeletingDiagnostic] = useState(false);

  const PAGE_SIZE = 10;

  // Active branch context
  const branchContext = useMemo(() => {
    if (isAdmin) return user?.branchId || undefined;
    return selectedBranch !== 'ALL' ? selectedBranch : undefined;
  }, [isAdmin, user?.branchId, selectedBranch]);

  // Load branches (for owner/super-admin)
  useEffect(() => {
    if (isOwner) {
      branchService.getAll().then((data) => {
        const activeList = data.filter((b) => b.isActive);
        setBranches(activeList);
      }).catch((err) => {
        console.error('Failed to load branches', err);
      });
    }
  }, [isOwner]);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [configData, treatmentsData, diagnosticsData] = await Promise.all([
        odontogramService.getConfig(branchContext),
        odontogramService.getTreatments(branchContext),
        odontogramService.getDiagnostics(branchContext),
      ]);

      setDefaultTeethModel(configData.defaultTeethModel || 'ADULT');
      setTreatments(treatmentsData);
      setDiagnostics(diagnosticsData);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          t('odontogramSettings.failedLoad', { defaultValue: 'Failed to load odontogram settings' })
      );
    } finally {
      setLoading(false);
    }
  }, [branchContext, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset pagination on search
  useEffect(() => {
    setTreatmentPage(0);
  }, [treatmentSearch, selectedBranch]);

  useEffect(() => {
    setDiagnosticPage(0);
  }, [diagnosticSearch, selectedBranch]);

  // ─── Tab 1: Default Teeth Model Actions ─────────────────
  const handleSaveDefaultModel = async () => {
    if (!canAddEdit) return;
    try {
      setSavingConfig(true);
      await odontogramService.updateConfig({
        defaultTeethModel,
        branchId: branchContext,
      });
      toast.success(t('odontogramSettings.defaultTab.saveSuccess', { defaultValue: 'Default model updated successfully' }));
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          t('odontogramSettings.defaultTab.saveFailed', { defaultValue: 'Failed to update default teeth model' })
      );
    } finally {
      setSavingConfig(false);
    }
  };

  // ─── Tab 2: Treatments Actions ──────────────────────────
  const openCreateTreatment = () => {
    setTreatmentForm({
      name: '',
      description: '',
      color: '#3B82F6',
      appliesToWholeTooth: false,
      branchId: isAdmin ? user?.branchId || '' : selectedBranch !== 'ALL' ? selectedBranch : branches[0]?.id || '',
    });
    setShowCreateTreatmentModal(true);
  };

  const openEditTreatment = (item: OdontogramTreatmentItem) => {
    setSelectedTreatment(item);
    setTreatmentForm({
      name: item.name,
      description: item.description || '',
      color: item.color,
      appliesToWholeTooth: item.appliesToWholeTooth,
      branchId: item.branchId || '',
    });
    setShowEditTreatmentModal(true);
  };

  const handleCreateTreatment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!treatmentForm.name.trim()) {
      toast.error(t('validation.fieldRequired'));
      return;
    }
    try {
      setSavingTreatment(true);
      await odontogramService.createTreatment(treatmentForm);
      toast.success(t('odontogramSettings.treatmentsTab.createSuccess'));
      setShowCreateTreatmentModal(false);
      await fetchData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || t('odontogramSettings.treatmentsTab.createFailed');
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSavingTreatment(false);
    }
  };

  const handleUpdateTreatment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTreatment || !treatmentForm.name.trim()) {
      toast.error(t('validation.fieldRequired'));
      return;
    }
    try {
      setSavingTreatment(true);
      await odontogramService.updateTreatment(selectedTreatment.id, {
        name: treatmentForm.name,
        description: treatmentForm.description,
        color: treatmentForm.color,
        appliesToWholeTooth: treatmentForm.appliesToWholeTooth,
      });
      toast.success(t('odontogramSettings.treatmentsTab.updateSuccess'));
      setShowEditTreatmentModal(false);
      await fetchData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || t('odontogramSettings.treatmentsTab.updateFailed');
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSavingTreatment(false);
    }
  };

  const handleDeleteTreatment = async () => {
    if (!treatmentToDelete) return;
    try {
      setDeletingTreatment(true);
      await odontogramService.deleteTreatment(treatmentToDelete.id);
      toast.success(t('odontogramSettings.treatmentsTab.deleteSuccess'));
      setShowDeleteTreatmentModal(false);
      setTreatmentToDelete(null);
      await fetchData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || t('odontogramSettings.treatmentsTab.deleteFailed');
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setDeletingTreatment(false);
    }
  };

  // ─── Tab 3: Diagnostics Actions ─────────────────────────
  const openCreateDiagnostic = () => {
    setDiagnosticForm({
      name: '',
      description: '',
      color: '#EF4444',
      appliesToWholeTooth: false,
      branchId: isAdmin ? user?.branchId || '' : selectedBranch !== 'ALL' ? selectedBranch : branches[0]?.id || '',
    });
    setShowCreateDiagnosticModal(true);
  };

  const openEditDiagnostic = (item: OdontogramDiagnosticItem) => {
    setSelectedDiagnostic(item);
    setDiagnosticForm({
      name: item.name,
      description: item.description || '',
      color: item.color,
      appliesToWholeTooth: item.appliesToWholeTooth,
      branchId: item.branchId || '',
    });
    setShowEditDiagnosticModal(true);
  };

  const handleCreateDiagnostic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diagnosticForm.name.trim()) {
      toast.error(t('validation.fieldRequired'));
      return;
    }
    try {
      setSavingDiagnostic(true);
      await odontogramService.createDiagnostic(diagnosticForm);
      toast.success(t('odontogramSettings.diagnosticsTab.createSuccess'));
      setShowCreateDiagnosticModal(false);
      await fetchData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || t('odontogramSettings.diagnosticsTab.createFailed');
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSavingDiagnostic(false);
    }
  };

  const handleUpdateDiagnostic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDiagnostic || !diagnosticForm.name.trim()) {
      toast.error(t('validation.fieldRequired'));
      return;
    }
    try {
      setSavingDiagnostic(true);
      await odontogramService.updateDiagnostic(selectedDiagnostic.id, {
        name: diagnosticForm.name,
        description: diagnosticForm.description,
        color: diagnosticForm.color,
        appliesToWholeTooth: diagnosticForm.appliesToWholeTooth,
      });
      toast.success(t('odontogramSettings.diagnosticsTab.updateSuccess'));
      setShowEditDiagnosticModal(false);
      await fetchData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || t('odontogramSettings.diagnosticsTab.updateFailed');
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSavingDiagnostic(false);
    }
  };

  const handleDeleteDiagnostic = async () => {
    if (!diagnosticToDelete) return;
    try {
      setDeletingDiagnostic(true);
      await odontogramService.deleteDiagnostic(diagnosticToDelete.id);
      toast.success(t('odontogramSettings.diagnosticsTab.deleteSuccess'));
      setShowDeleteDiagnosticModal(false);
      setDiagnosticToDelete(null);
      await fetchData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || t('odontogramSettings.diagnosticsTab.deleteFailed');
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setDeletingDiagnostic(false);
    }
  };

  // ─── Filtered Data ──────────────────────────────────────
  const filteredTreatments = useMemo(() => {
    return treatments.filter((tItem) => {
      if (treatmentSearch.trim()) {
        const q = treatmentSearch.toLowerCase();
        return (
          tItem.name.toLowerCase().includes(q) ||
          (tItem.description && tItem.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [treatments, treatmentSearch]);

  const paginatedTreatments = useMemo(() => {
    return filteredTreatments.slice(treatmentPage * PAGE_SIZE, (treatmentPage + 1) * PAGE_SIZE);
  }, [filteredTreatments, treatmentPage]);

  const filteredDiagnostics = useMemo(() => {
    return diagnostics.filter((dItem) => {
      if (diagnosticSearch.trim()) {
        const q = diagnosticSearch.toLowerCase();
        return (
          dItem.name.toLowerCase().includes(q) ||
          (dItem.description && dItem.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [diagnostics, diagnosticSearch]);

  const paginatedDiagnostics = useMemo(() => {
    return filteredDiagnostics.slice(diagnosticPage * PAGE_SIZE, (diagnosticPage + 1) * PAGE_SIZE);
  }, [filteredDiagnostics, diagnosticPage]);

  return (
    <div className="fade-in" style={{ paddingBottom: '2.5rem' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <Smile size={28} style={{ color: 'var(--accent-primary)' }} />
            <span>{t('odontogramSettings.title')}</span>
          </h1>
          <p className="page-header__subtitle">
            {t('odontogramSettings.subtitle')}
          </p>
        </div>

        {/* Branch Context Display / Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {isAdmin && user?.branchName && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.45rem 0.875rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              <Building2 size={16} style={{ color: 'var(--accent-primary)' }} />
              <span>{user.branchName}</span>
            </div>
          )}

          {isOwner && branches.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building2 size={16} style={{ color: 'var(--text-muted)' }} />
              <select
                className="form-input"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                style={{
                  minWidth: '180px',
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                }}
              >
                <option value="ALL">{t('odontogramSettings.allBranches', { defaultValue: 'All Branches' })}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Role Notice Banner for Owner */}
      {!isAdmin && isOwner && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1rem',
            marginBottom: '1.5rem',
            color: 'var(--text-primary)',
            fontSize: '0.8438rem',
          }}
        >
          <Info size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
          <span>{t('odontogramSettings.treatmentsTab.ownerOnlyDelete')}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '0.75rem',
          marginBottom: '1.5rem',
          overflowX: 'auto',
        }}
      >
        <button
          type="button"
          className={`btn ${activeTab === 'DEFAULT' ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => setActiveTab('DEFAULT')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
        >
          <Smile size={16} />
          <span>{t('odontogramSettings.tabs.default')}</span>
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'TREATMENTS' ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => setActiveTab('TREATMENTS')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
        >
          <Layers size={16} />
          <span>{t('odontogramSettings.tabs.treatments')}</span>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: '100px',
              backgroundColor: activeTab === 'TREATMENTS' ? 'rgba(255, 255, 255, 0.25)' : 'var(--bg-overlay)',
              color: activeTab === 'TREATMENTS' ? '#fff' : 'var(--text-muted)',
            }}
          >
            {treatments.length}
          </span>
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'DIAGNOSTICS' ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => setActiveTab('DIAGNOSTICS')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
        >
          <Activity size={16} />
          <span>{t('odontogramSettings.tabs.diagnostics')}</span>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: '100px',
              backgroundColor: activeTab === 'DIAGNOSTICS' ? 'rgba(255, 255, 255, 0.25)' : 'var(--bg-overlay)',
              color: activeTab === 'DIAGNOSTICS' ? '#fff' : 'var(--text-muted)',
            }}
          >
            {diagnostics.length}
          </span>
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem' }}>
          <Loader2 size={36} className="spinner" style={{ color: 'var(--accent-primary)' }} />
        </div>
      ) : (
        <>
          {/* ═════════════════════════════════════════════════ */}
          {/* TAB 1: DEFAULT TEETH MODEL                        */}
          {/* ═════════════════════════════════════════════════ */}
          {activeTab === 'DEFAULT' && (
            <div className="card" style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '2rem', maxWidth: '820px' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.375rem 0', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                  {t('odontogramSettings.defaultTab.title')}
                </h3>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {t('odontogramSettings.defaultTab.subtitle')}
                </p>
              </div>

              {!canAddEdit && (
                <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', backgroundColor: 'var(--bg-overlay)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '0.8438rem', color: 'var(--text-muted)' }}>
                  {t('odontogramSettings.defaultTab.ownerNotice')}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                {/* Adult Model Card */}
                <div
                  onClick={() => canAddEdit && setDefaultTeethModel('ADULT')}
                  style={{
                    border: `2px solid ${defaultTeethModel === 'ADULT' ? 'var(--accent-primary)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.5rem',
                    backgroundColor: defaultTeethModel === 'ADULT' ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-surface)',
                    cursor: canAddEdit ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                    boxShadow: defaultTeethModel === 'ADULT' ? '0 4px 16px rgba(59, 130, 246, 0.12)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                        <Smile size={24} />
                      </div>
                      {defaultTeethModel === 'ADULT' && (
                        <span className="badge badge--info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                          <Check size={12} />
                          {t('odontogramSettings.defaultTab.currentlySelected')}
                        </span>
                      )}
                    </div>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                      {t('odontogramSettings.defaultTab.adultTitle')}
                    </h4>
                    <p style={{ margin: '0 0 1rem 0', fontSize: '0.8438rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      {t('odontogramSettings.defaultTab.adultDescription')}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 500, padding: '3px 8px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-overlay)', color: 'var(--text-secondary)' }}>
                      Quadrants 1 - 4
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 500, padding: '3px 8px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-overlay)', color: 'var(--text-secondary)' }}>
                      Teeth 11 - 48 (32 Teeth)
                    </span>
                  </div>
                </div>

                {/* Child Model Card */}
                <div
                  onClick={() => canAddEdit && setDefaultTeethModel('CHILD')}
                  style={{
                    border: `2px solid ${defaultTeethModel === 'CHILD' ? 'var(--accent-primary)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.5rem',
                    backgroundColor: defaultTeethModel === 'CHILD' ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-surface)',
                    cursor: canAddEdit ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                    boxShadow: defaultTeethModel === 'CHILD' ? '0 4px 16px rgba(59, 130, 246, 0.12)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                        <Smile size={24} />
                      </div>
                      {defaultTeethModel === 'CHILD' && (
                        <span className="badge badge--info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                          <Check size={12} />
                          {t('odontogramSettings.defaultTab.currentlySelected')}
                        </span>
                      )}
                    </div>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                      {t('odontogramSettings.defaultTab.childTitle')}
                    </h4>
                    <p style={{ margin: '0 0 1rem 0', fontSize: '0.8438rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      {t('odontogramSettings.defaultTab.childDescription')}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 500, padding: '3px 8px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-overlay)', color: 'var(--text-secondary)' }}>
                      Quadrants 5 - 8
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 500, padding: '3px 8px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-overlay)', color: 'var(--text-secondary)' }}>
                      Teeth 51 - 85 (20 Teeth)
                    </span>
                  </div>
                </div>
              </div>

              {canAddEdit && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={handleSaveDefaultModel}
                    disabled={savingConfig}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
                  >
                    {savingConfig ? (
                      <>
                        <Loader2 size={16} className="spinner" />
                        <span>{t('odontogramSettings.defaultTab.saving')}</span>
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        <span>{t('odontogramSettings.defaultTab.saveButton')}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ═════════════════════════════════════════════════ */}
          {/* TAB 2: ODONTOGRAM TREATMENT                       */}
          {/* ═════════════════════════════════════════════════ */}
          {activeTab === 'TREATMENTS' && (
            <div>
              {/* Search and Action Bar */}
              <div className="table-toolbar">
                <div className="search-input-wrap">
                  <Search size={16} className="search-input__icon" />
                  <input
                    type="text"
                    className="form-input search-input"
                    placeholder={t('odontogramSettings.treatmentsTab.searchPlaceholder')}
                    value={treatmentSearch}
                    onChange={(e) => setTreatmentSearch(e.target.value)}
                  />
                  {treatmentSearch && (
                    <button
                      type="button"
                      className="search-input__clear"
                      onClick={() => setTreatmentSearch('')}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div style={{ marginLeft: 'auto' }}>
                  {canAddEdit && (
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={openCreateTreatment}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
                    >
                      <Plus size={16} />
                      <span>{t('odontogramSettings.treatmentsTab.addTreatment')}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Treatments List Table */}
              {filteredTreatments.length === 0 ? (
                <div className="card" style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '3.5rem 2rem', textAlign: 'center' }}>
                  <Layers size={44} style={{ color: 'var(--text-muted)', opacity: 0.4, margin: '0 auto 1rem auto' }} />
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-heading)' }}>
                    {t('odontogramSettings.treatmentsTab.emptyTitle')}
                  </h4>
                  <p style={{ margin: '0 auto', fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '440px' }}>
                    {t('odontogramSettings.treatmentsTab.emptySubtitle')}
                  </p>
                </div>
              ) : (
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '130px' }}>{t('odontogramSettings.treatmentsTab.color')}</th>
                        <th>{t('odontogramSettings.treatmentsTab.name')}</th>
                        <th>{t('odontogramSettings.treatmentsTab.description')}</th>
                        <th style={{ width: '190px' }}>{t('odontogramSettings.treatmentsTab.appliesTo')}</th>
                        {isOwner && <th style={{ width: '140px' }}>{t('odontogramSettings.treatmentsTab.branch')}</th>}
                        <th style={{ width: '110px', textAlign: 'right' }}>{t('odontogramSettings.treatmentsTab.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedTreatments.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                              <span
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  backgroundColor: item.color,
                                  boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
                                  flexShrink: 0,
                                }}
                              />
                              <code style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                {item.color.toUpperCase()}
                              </code>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>
                              {item.name}
                            </span>
                          </td>
                          <td>
                            <span style={{ color: 'var(--text-secondary)' }}>
                              {item.description || '—'}
                            </span>
                          </td>
                          <td>
                            {item.appliesToWholeTooth ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '4px 9px',
                                  borderRadius: '100px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                  color: '#10B981',
                                }}
                              >
                                <ShieldCheck size={13} />
                                {t('odontogramSettings.treatmentsTab.wholeToothBadge')}
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '4px 9px',
                                  borderRadius: '100px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  backgroundColor: 'var(--bg-overlay)',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                {t('odontogramSettings.treatmentsTab.surfaceBadge')}
                              </span>
                            )}
                          </td>
                          {isOwner && (
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                              {item.branch?.name || '—'}
                            </td>
                          )}
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', justifyContent: 'flex-end' }}>
                              {canAddEdit && (
                                <button
                                  type="button"
                                  className="btn-action"
                                  onClick={() => openEditTreatment(item)}
                                  title={t('common.edit')}
                                >
                                  <Pencil size={14} />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  className="btn-action btn-action--danger"
                                  onClick={() => {
                                    setTreatmentToDelete(item);
                                    setShowDeleteTreatmentModal(true);
                                  }}
                                  title={t('common.delete')}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pagination
                    currentPage={treatmentPage}
                    totalItems={filteredTreatments.length}
                    pageSize={PAGE_SIZE}
                    onPageChange={setTreatmentPage}
                  />
                </div>
              )}
            </div>
          )}

          {/* ═════════════════════════════════════════════════ */}
          {/* TAB 3: ODONTOGRAM DIAGNOSTICS                     */}
          {/* ═════════════════════════════════════════════════ */}
          {activeTab === 'DIAGNOSTICS' && (
            <div>
              {/* Search and Action Bar */}
              <div className="table-toolbar">
                <div className="search-input-wrap">
                  <Search size={16} className="search-input__icon" />
                  <input
                    type="text"
                    className="form-input search-input"
                    placeholder={t('odontogramSettings.diagnosticsTab.searchPlaceholder')}
                    value={diagnosticSearch}
                    onChange={(e) => setDiagnosticSearch(e.target.value)}
                  />
                  {diagnosticSearch && (
                    <button
                      type="button"
                      className="search-input__clear"
                      onClick={() => setDiagnosticSearch('')}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div style={{ marginLeft: 'auto' }}>
                  {canAddEdit && (
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={openCreateDiagnostic}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
                    >
                      <Plus size={16} />
                      <span>{t('odontogramSettings.diagnosticsTab.addDiagnostic')}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Diagnostics List Table */}
              {filteredDiagnostics.length === 0 ? (
                <div className="card" style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '3.5rem 2rem', textAlign: 'center' }}>
                  <Activity size={44} style={{ color: 'var(--text-muted)', opacity: 0.4, margin: '0 auto 1rem auto' }} />
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-heading)' }}>
                    {t('odontogramSettings.diagnosticsTab.emptyTitle')}
                  </h4>
                  <p style={{ margin: '0 auto', fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '440px' }}>
                    {t('odontogramSettings.diagnosticsTab.emptySubtitle')}
                  </p>
                </div>
              ) : (
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '130px' }}>{t('odontogramSettings.diagnosticsTab.color')}</th>
                        <th>{t('odontogramSettings.diagnosticsTab.name')}</th>
                        <th>{t('odontogramSettings.diagnosticsTab.description')}</th>
                        <th style={{ width: '190px' }}>{t('odontogramSettings.diagnosticsTab.appliesTo')}</th>
                        {isOwner && <th style={{ width: '140px' }}>{t('odontogramSettings.diagnosticsTab.branch')}</th>}
                        <th style={{ width: '110px', textAlign: 'right' }}>{t('odontogramSettings.diagnosticsTab.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedDiagnostics.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                              <span
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  backgroundColor: item.color,
                                  boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
                                  flexShrink: 0,
                                }}
                              />
                              <code style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                {item.color.toUpperCase()}
                              </code>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>
                              {item.name}
                            </span>
                          </td>
                          <td>
                            <span style={{ color: 'var(--text-secondary)' }}>
                              {item.description || '—'}
                            </span>
                          </td>
                          <td>
                            {item.appliesToWholeTooth ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '4px 9px',
                                  borderRadius: '100px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                  color: '#10B981',
                                }}
                              >
                                <ShieldCheck size={13} />
                                {t('odontogramSettings.diagnosticsTab.wholeToothBadge')}
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '4px 9px',
                                  borderRadius: '100px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  backgroundColor: 'var(--bg-overlay)',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                {t('odontogramSettings.diagnosticsTab.surfaceBadge')}
                              </span>
                            )}
                          </td>
                          {isOwner && (
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                              {item.branch?.name || '—'}
                            </td>
                          )}
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', justifyContent: 'flex-end' }}>
                              {canAddEdit && (
                                <button
                                  type="button"
                                  className="btn-action"
                                  onClick={() => openEditDiagnostic(item)}
                                  title={t('common.edit')}
                                >
                                  <Pencil size={14} />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  className="btn-action btn-action--danger"
                                  onClick={() => {
                                    setDiagnosticToDelete(item);
                                    setShowDeleteDiagnosticModal(true);
                                  }}
                                  title={t('common.delete')}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pagination
                    currentPage={diagnosticPage}
                    totalItems={filteredDiagnostics.length}
                    pageSize={PAGE_SIZE}
                    onPageChange={setDiagnosticPage}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═════════════════════════════════════════════════════ */}
      {/* MODAL: ADD / EDIT TREATMENT                           */}
      {/* ═════════════════════════════════════════════════════ */}
      {(showCreateTreatmentModal || showEditTreatmentModal) && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!savingTreatment) {
              setShowCreateTreatmentModal(false);
              setShowEditTreatmentModal(false);
            }
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">
                  {showCreateTreatmentModal
                    ? t('odontogramSettings.treatmentsTab.addModalTitle')
                    : t('odontogramSettings.treatmentsTab.editModalTitle')}
                </h2>
                <p className="modal__subtitle">
                  {showCreateTreatmentModal
                    ? t('odontogramSettings.treatmentsTab.subtitle')
                    : selectedTreatment?.name}
                </p>
              </div>
              <button
                type="button"
                className="modal__close"
                onClick={() => {
                  setShowCreateTreatmentModal(false);
                  setShowEditTreatmentModal(false);
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={showCreateTreatmentModal ? handleCreateTreatment : handleUpdateTreatment}>
              <div className="modal__body">
                {/* Branch Selection (for Owner in Create Mode) */}
                {showCreateTreatmentModal && isOwner && branches.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">
                      {t('odontogramSettings.treatmentsTab.branch')} <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <select
                      className="form-input"
                      value={treatmentForm.branchId}
                      onChange={(e) => setTreatmentForm({ ...treatmentForm, branchId: e.target.value })}
                      required
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Name */}
                <div className="form-group">
                  <label className="form-label">
                    {t('odontogramSettings.treatmentsTab.name')} <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={t('odontogramSettings.treatmentsTab.namePlaceholder')}
                    value={treatmentForm.name}
                    onChange={(e) => setTreatmentForm({ ...treatmentForm, name: e.target.value })}
                    required
                  />
                </div>

                {/* Description */}
                <div className="form-group">
                  <label className="form-label">
                    {t('odontogramSettings.treatmentsTab.description')}
                  </label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder={t('odontogramSettings.treatmentsTab.descPlaceholder')}
                    value={treatmentForm.description || ''}
                    onChange={(e) => setTreatmentForm({ ...treatmentForm, description: e.target.value })}
                    style={{ resize: 'vertical', minHeight: '76px' }}
                  />
                </div>

                {/* Color Picker with modern styling */}
                <div className="form-group">
                  <label className="form-label">
                    {t('odontogramSettings.treatmentsTab.color')} <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.5rem 0.75rem',
                      background: 'var(--bg-overlay)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    {/* Color Swatch Trigger */}
                    <div style={{ position: 'relative', width: '32px', height: '32px', flexShrink: 0 }}>
                      <input
                        type="color"
                        value={treatmentForm.color}
                        onChange={(e) => setTreatmentForm({ ...treatmentForm, color: e.target.value.toUpperCase() })}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          opacity: 0,
                          width: '100%',
                          height: '100%',
                          cursor: 'pointer',
                        }}
                      />
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: treatmentForm.color,
                          border: '2px solid var(--border)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          pointerEvents: 'none',
                        }}
                      />
                    </div>

                    {/* Hex Text Input */}
                    <div style={{ flex: 1 }}>
                      <input
                        type="text"
                        className="form-input"
                        value={treatmentForm.color}
                        onChange={(e) => {
                          let val = e.target.value;
                          if (!val.startsWith('#') && val.length > 0) val = '#' + val;
                          setTreatmentForm({ ...treatmentForm, color: val.toUpperCase() });
                        }}
                        placeholder="#3B82F6"
                        pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                        maxLength={7}
                        required
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          letterSpacing: '0.05em',
                          padding: '0.45rem 0.75rem',
                        }}
                      />
                    </div>
                  </div>

                  {/* Preset Swatches Palette */}
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.375rem', fontWeight: 500 }}>
                      {t('common.selectOption', { defaultValue: 'Quick Presets' })}:
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {COLOR_PRESETS.map((color) => {
                        const isSelected = treatmentForm.color.toUpperCase() === color.toUpperCase();
                        return (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setTreatmentForm({ ...treatmentForm, color })}
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '50%',
                              backgroundColor: color,
                              border: isSelected ? '2px solid var(--text-heading)' : '1px solid rgba(0,0,0,0.15)',
                              cursor: 'pointer',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transform: isSelected ? 'scale(1.15)' : 'none',
                              boxShadow: isSelected ? `0 0 0 2px var(--bg-surface), 0 0 0 4px ${color}` : 'none',
                              transition: 'all 0.15s ease',
                            }}
                            title={color}
                          >
                            {isSelected && <Check size={13} style={{ color: '#fff', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))' }} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Applies to Whole Tooth */}
                <div
                  onClick={() => setTreatmentForm({ ...treatmentForm, appliesToWholeTooth: !treatmentForm.appliesToWholeTooth })}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.875rem',
                    padding: '0.875rem 1rem',
                    backgroundColor: treatmentForm.appliesToWholeTooth ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-overlay)',
                    border: `1.5px solid ${treatmentForm.appliesToWholeTooth ? 'var(--accent-primary)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="checkbox"
                    id="treatmentAppliesWhole"
                    checked={treatmentForm.appliesToWholeTooth}
                    onChange={(e) => setTreatmentForm({ ...treatmentForm, appliesToWholeTooth: e.target.checked })}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      marginTop: '0.125rem',
                      width: '18px',
                      height: '18px',
                      accentColor: 'var(--accent-primary)',
                      cursor: 'pointer',
                      borderRadius: '4px',
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, display: 'block', color: 'var(--text-heading)', fontSize: '0.875rem' }}>
                      {t('odontogramSettings.treatmentsTab.appliesToWholeTooth')}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7813rem', display: 'block', marginTop: '0.25rem', lineHeight: 1.45 }}>
                      {t('odontogramSettings.treatmentsTab.appliesHelp')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="modal__footer" style={{ padding: '1rem 1.75rem' }}>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    setShowCreateTreatmentModal(false);
                    setShowEditTreatmentModal(false);
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={savingTreatment}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
                >
                  {savingTreatment ? <Loader2 size={16} className="spinner" /> : <Save size={16} />}
                  <span>{showCreateTreatmentModal ? t('common.create') : t('common.saveChanges')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════ */}
      {/* MODAL: ADD / EDIT DIAGNOSTIC                          */}
      {/* ═════════════════════════════════════════════════════ */}
      {(showCreateDiagnosticModal || showEditDiagnosticModal) && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!savingDiagnostic) {
              setShowCreateDiagnosticModal(false);
              setShowEditDiagnosticModal(false);
            }
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">
                  {showCreateDiagnosticModal
                    ? t('odontogramSettings.diagnosticsTab.addModalTitle')
                    : t('odontogramSettings.diagnosticsTab.editModalTitle')}
                </h2>
                <p className="modal__subtitle">
                  {showCreateDiagnosticModal
                    ? t('odontogramSettings.diagnosticsTab.subtitle')
                    : selectedDiagnostic?.name}
                </p>
              </div>
              <button
                type="button"
                className="modal__close"
                onClick={() => {
                  setShowCreateDiagnosticModal(false);
                  setShowEditDiagnosticModal(false);
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={showCreateDiagnosticModal ? handleCreateDiagnostic : handleUpdateDiagnostic}>
              <div className="modal__body">
                {/* Branch Selection (for Owner in Create Mode) */}
                {showCreateDiagnosticModal && isOwner && branches.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">
                      {t('odontogramSettings.diagnosticsTab.branch')} <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <select
                      className="form-input"
                      value={diagnosticForm.branchId}
                      onChange={(e) => setDiagnosticForm({ ...diagnosticForm, branchId: e.target.value })}
                      required
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Name */}
                <div className="form-group">
                  <label className="form-label">
                    {t('odontogramSettings.diagnosticsTab.name')} <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={t('odontogramSettings.diagnosticsTab.namePlaceholder')}
                    value={diagnosticForm.name}
                    onChange={(e) => setDiagnosticForm({ ...diagnosticForm, name: e.target.value })}
                    required
                  />
                </div>

                {/* Description */}
                <div className="form-group">
                  <label className="form-label">
                    {t('odontogramSettings.diagnosticsTab.description')}
                  </label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder={t('odontogramSettings.diagnosticsTab.descPlaceholder')}
                    value={diagnosticForm.description || ''}
                    onChange={(e) => setDiagnosticForm({ ...diagnosticForm, description: e.target.value })}
                    style={{ resize: 'vertical', minHeight: '76px' }}
                  />
                </div>

                {/* Color Picker with modern styling */}
                <div className="form-group">
                  <label className="form-label">
                    {t('odontogramSettings.diagnosticsTab.color')} <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.5rem 0.75rem',
                      background: 'var(--bg-overlay)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    {/* Color Swatch Trigger */}
                    <div style={{ position: 'relative', width: '32px', height: '32px', flexShrink: 0 }}>
                      <input
                        type="color"
                        value={diagnosticForm.color}
                        onChange={(e) => setDiagnosticForm({ ...diagnosticForm, color: e.target.value.toUpperCase() })}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          opacity: 0,
                          width: '100%',
                          height: '100%',
                          cursor: 'pointer',
                        }}
                      />
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: diagnosticForm.color,
                          border: '2px solid var(--border)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          pointerEvents: 'none',
                        }}
                      />
                    </div>

                    {/* Hex Text Input */}
                    <div style={{ flex: 1 }}>
                      <input
                        type="text"
                        className="form-input"
                        value={diagnosticForm.color}
                        onChange={(e) => {
                          let val = e.target.value;
                          if (!val.startsWith('#') && val.length > 0) val = '#' + val;
                          setDiagnosticForm({ ...diagnosticForm, color: val.toUpperCase() });
                        }}
                        placeholder="#EF4444"
                        pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                        maxLength={7}
                        required
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          letterSpacing: '0.05em',
                          padding: '0.45rem 0.75rem',
                        }}
                      />
                    </div>
                  </div>

                  {/* Preset Swatches Palette */}
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.375rem', fontWeight: 500 }}>
                      {t('common.selectOption', { defaultValue: 'Quick Presets' })}:
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {COLOR_PRESETS.map((color) => {
                        const isSelected = diagnosticForm.color.toUpperCase() === color.toUpperCase();
                        return (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setDiagnosticForm({ ...diagnosticForm, color })}
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '50%',
                              backgroundColor: color,
                              border: isSelected ? '2px solid var(--text-heading)' : '1px solid rgba(0,0,0,0.15)',
                              cursor: 'pointer',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transform: isSelected ? 'scale(1.15)' : 'none',
                              boxShadow: isSelected ? `0 0 0 2px var(--bg-surface), 0 0 0 4px ${color}` : 'none',
                              transition: 'all 0.15s ease',
                            }}
                            title={color}
                          >
                            {isSelected && <Check size={13} style={{ color: '#fff', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))' }} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Applies to Whole Tooth */}
                <div
                  onClick={() => setDiagnosticForm({ ...diagnosticForm, appliesToWholeTooth: !diagnosticForm.appliesToWholeTooth })}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.875rem',
                    padding: '0.875rem 1rem',
                    backgroundColor: diagnosticForm.appliesToWholeTooth ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-overlay)',
                    border: `1.5px solid ${diagnosticForm.appliesToWholeTooth ? 'var(--accent-primary)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="checkbox"
                    id="diagnosticAppliesWhole"
                    checked={diagnosticForm.appliesToWholeTooth}
                    onChange={(e) => setDiagnosticForm({ ...diagnosticForm, appliesToWholeTooth: e.target.checked })}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      marginTop: '0.125rem',
                      width: '18px',
                      height: '18px',
                      accentColor: 'var(--accent-primary)',
                      cursor: 'pointer',
                      borderRadius: '4px',
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, display: 'block', color: 'var(--text-heading)', fontSize: '0.875rem' }}>
                      {t('odontogramSettings.diagnosticsTab.appliesToWholeTooth')}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7813rem', display: 'block', marginTop: '0.25rem', lineHeight: 1.45 }}>
                      {t('odontogramSettings.diagnosticsTab.appliesHelp')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="modal__footer" style={{ padding: '1rem 1.75rem' }}>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    setShowCreateDiagnosticModal(false);
                    setShowEditDiagnosticModal(false);
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={savingDiagnostic}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
                >
                  {savingDiagnostic ? <Loader2 size={16} className="spinner" /> : <Save size={16} />}
                  <span>{showCreateDiagnosticModal ? t('common.create') : t('common.saveChanges')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════ */}
      {/* MODAL: DELETE CONFIRMATION (TREATMENT / DIAGNOSTIC)   */}
      {/* ═════════════════════════════════════════════════════ */}
      {showDeleteTreatmentModal && treatmentToDelete && (
        <div className="modal-overlay" onClick={() => !deletingTreatment && setShowDeleteTreatmentModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal__header">
              <h2 className="modal__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)' }}>
                <AlertCircle size={20} />
                <span>{t('odontogramSettings.treatmentsTab.deleteModalTitle')}</span>
              </h2>
              <button type="button" className="modal__close" onClick={() => setShowDeleteTreatmentModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal__body">
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {t('odontogramSettings.treatmentsTab.deleteConfirm', { name: treatmentToDelete.name })}
              </p>
            </div>
            <div className="modal__footer" style={{ padding: '1rem 1.75rem' }}>
              <button type="button" className="btn btn--ghost" onClick={() => setShowDeleteTreatmentModal(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={handleDeleteTreatment}
                disabled={deletingTreatment}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
              >
                {deletingTreatment ? <Loader2 size={16} className="spinner" /> : <Trash2 size={16} />}
                <span>{t('common.delete')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteDiagnosticModal && diagnosticToDelete && (
        <div className="modal-overlay" onClick={() => !deletingDiagnostic && setShowDeleteDiagnosticModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal__header">
              <h2 className="modal__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)' }}>
                <AlertCircle size={20} />
                <span>{t('odontogramSettings.diagnosticsTab.deleteModalTitle')}</span>
              </h2>
              <button type="button" className="modal__close" onClick={() => setShowDeleteDiagnosticModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal__body">
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {t('odontogramSettings.diagnosticsTab.deleteConfirm', { name: diagnosticToDelete.name })}
              </p>
            </div>
            <div className="modal__footer" style={{ padding: '1rem 1.75rem' }}>
              <button type="button" className="btn btn--ghost" onClick={() => setShowDeleteDiagnosticModal(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={handleDeleteDiagnostic}
                disabled={deletingDiagnostic}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
              >
                {deletingDiagnostic ? <Loader2 size={16} className="spinner" /> : <Trash2 size={16} />}
                <span>{t('common.delete')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default OdontogramSettingsPage;
