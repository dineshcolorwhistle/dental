import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Loader2,
  Smile,
  Activity,
  Layers,
  Eraser,
  Save,
  Check,
  Info,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  odontogramService,
  type ToothPart,
  type OdontogramTeethData,
  type TeethModel,
  type OdontogramTreatmentItem,
  type OdontogramDiagnosticItem,
  type AppliedFinding,
} from '../services';
import { ToothSvg, getSurfaceDisplayName } from './ToothSvg';
import { useAppDate } from '../hooks';

interface WorkOrderOdontogramModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrderId: string | null;
  workOrderFolio?: string;
  patientName?: string | null;
  doctorName?: string | null;
  branchName?: string | null;
  onSaved?: () => void;
}

type ViewMode = 'ADULT' | 'CHILD' | 'BOTH';

const ADULT_UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const ADULT_UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const CHILD_UPPER_RIGHT = [55, 54, 53, 52, 51];
const CHILD_UPPER_LEFT = [61, 62, 63, 64, 65];

const CHILD_LOWER_RIGHT = [85, 84, 83, 82, 81];
const CHILD_LOWER_LEFT = [71, 72, 73, 74, 75];
const ADULT_LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const ADULT_LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];

interface SelectedTool {
  itemId: string;
  itemType: 'DIAGNOSTIC' | 'TREATMENT';
  name: string;
  color: string;
  appliesToWholeTooth: boolean;
}

export const WorkOrderOdontogramModal: React.FC<WorkOrderOdontogramModalProps> = ({
  isOpen,
  onClose,
  workOrderId,
  workOrderFolio,
  patientName,
  doctorName,
  branchName,
  onSaved,
}) => {
  const { t, i18n } = useTranslation();
  const { formatDateTime } = useAppDate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Settings & Work Order data
  const [defaultTeethModel, setDefaultTeethModel] = useState<TeethModel>('ADULT');
  const [viewMode, setViewMode] = useState<ViewMode>('ADULT');
  const [teethData, setTeethData] = useState<OdontogramTeethData>({});
  const [notes, setNotes] = useState('');
  const [treatments, setTreatments] = useState<OdontogramTreatmentItem[]>([]);
  const [diagnostics, setDiagnostics] = useState<OdontogramDiagnosticItem[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  // Selected tool
  const [selectedTool, setSelectedTool] = useState<SelectedTool | null>(null);
  const [isEraserActive, setIsEraserActive] = useState(false);

  // Hover state
  const [hoveredToothInfo, setHoveredToothInfo] = useState<{
    toothNumber: number;
    part: ToothPart | null;
  } | null>(null);

  // Load odontogram data for work order
  const loadData = useCallback(async () => {
    if (!workOrderId) return;
    try {
      setLoading(true);
      const res = await odontogramService.getWorkOrderOdontogram(workOrderId);

      setDefaultTeethModel(res.defaultTeethModel || 'ADULT');
      setViewMode(res.teethModel || res.defaultTeethModel || 'ADULT');
      setTeethData(res.teethData || {});
      setNotes(res.notes || '');
      setTreatments(res.treatments || []);
      setDiagnostics(res.diagnostics || []);
      setLastUpdatedAt(res.updatedAt);

      // Preselect first diagnostic if available
      if (res.diagnostics && res.diagnostics.length > 0) {
        const first = res.diagnostics[0];
        setSelectedTool({
          itemId: first.id,
          itemType: 'DIAGNOSTIC',
          name: first.name,
          color: first.color,
          appliesToWholeTooth: first.appliesToWholeTooth,
        });
        setIsEraserActive(false);
      } else if (res.treatments && res.treatments.length > 0) {
        const first = res.treatments[0];
        setSelectedTool({
          itemId: first.id,
          itemType: 'TREATMENT',
          name: first.name,
          color: first.color,
          appliesToWholeTooth: first.appliesToWholeTooth,
        });
        setIsEraserActive(false);
      }
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          t('odontogram.loadFailed', { defaultValue: 'Failed to load odontogram' })
      );
    } finally {
      setLoading(false);
    }
  }, [workOrderId, t]);

  useEffect(() => {
    if (isOpen && workOrderId) {
      loadData();
    }
  }, [isOpen, workOrderId, loadData]);

  // Handle surface or whole tooth click
  const handlePartClick = (toothNumber: number, part: ToothPart) => {
    const key = String(toothNumber);

    if (isEraserActive) {
      setTeethData((prev: OdontogramTeethData) => {
        const currentTooth = { ...(prev[key] || {}) };
        if (part === 'whole') {
          // Erase whole tooth entirely
          const next = { ...prev };
          delete next[key];
          return next;
        } else {
          // Erase single part
          delete currentTooth[part];
          if (Object.keys(currentTooth).length === 0) {
            const next = { ...prev };
            delete next[key];
            return next;
          }
          return { ...prev, [key]: currentTooth };
        }
      });
      return;
    }

    if (!selectedTool) {
      toast(t('odontogram.selectToolFirst', { defaultValue: 'Please select a diagnostic or treatment first' }), {
        icon: '👆',
      });
      return;
    }

    const finding: AppliedFinding = {
      itemId: selectedTool.itemId,
      itemType: selectedTool.itemType,
      name: selectedTool.name,
      color: selectedTool.color,
      appliesToWholeTooth: selectedTool.appliesToWholeTooth,
      appliedAt: new Date().toISOString(),
    };

    setTeethData((prev: OdontogramTeethData) => {
      const currentTooth = { ...(prev[key] || {}) };

      if (selectedTool.appliesToWholeTooth || part === 'whole') {
        // Apply to whole tooth + all 7 surfaces
        return {
          ...prev,
          [key]: {
            whole: finding,
            center: finding,
            top: finding,
            upper_inner: finding,
            right: finding,
            lower_inner: finding,
            bottom: finding,
            left: finding,
          },
        };
      } else {
        // Individual surface application
        // If tooth had a whole-tooth tag, remove the whole-tooth flag so individual parts can differ
        delete currentTooth.whole;
        return {
          ...prev,
          [key]: {
            ...currentTooth,
            [part]: finding,
          },
        };
      }
    });
  };

  // Select diagnostic or treatment tool
  const handleSelectTool = (
    item: OdontogramDiagnosticItem | OdontogramTreatmentItem,
    type: 'DIAGNOSTIC' | 'TREATMENT'
  ) => {
    setIsEraserActive(false);
    setSelectedTool({
      itemId: item.id,
      itemType: type,
      name: item.name,
      color: item.color,
      appliesToWholeTooth: item.appliesToWholeTooth,
    });
  };

  // Toggle Eraser tool
  const handleToggleEraser = () => {
    setIsEraserActive((prev) => !prev);
    if (!isEraserActive) {
      setSelectedTool(null);
    }
  };

  // Clear all charted teeth
  const handleClearAll = () => {
    if (Object.keys(teethData).length === 0) return;
    if (window.confirm(t('odontogram.confirmClearAll', { defaultValue: 'Are you sure you want to clear all markings on this odontogram?' }))) {
      setTeethData({});
    }
  };

  // Save changes
  const handleSave = async () => {
    if (!workOrderId) return;
    try {
      setSaving(true);
      await odontogramService.saveWorkOrderOdontogram(workOrderId, {
        teethModel: viewMode === 'BOTH' ? defaultTeethModel : viewMode,
        teethData,
        notes,
      });
      toast.success(t('odontogram.saveSuccess', { defaultValue: 'Odontogram saved successfully' }));
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          t('odontogram.saveFailed', { defaultValue: 'Failed to save odontogram' })
      );
    } finally {
      setSaving(false);
    }
  };

  // Charted teeth count
  const chartedTeethCount = useMemo(() => {
    return Object.keys(teethData).filter((k) => Object.keys(teethData[k] || {}).length > 0).length;
  }, [teethData]);

  // List of all applied findings for summary panel
  const findingsList = useMemo(() => {
    const list: Array<{
      toothNumber: string;
      part: ToothPart;
      finding: AppliedFinding;
    }> = [];

    Object.entries(teethData).forEach(([toothNumber, parts]) => {
      if (!parts) return;
      if (parts.whole) {
        list.push({ toothNumber, part: 'whole', finding: parts.whole });
      } else {
        Object.entries(parts).forEach(([part, finding]) => {
          if (finding) {
            list.push({ toothNumber, part: part as ToothPart, finding });
          }
        });
      }
    });

    return list;
  }, [teethData]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '1180px',
          width: '96vw',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div className="modal__header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-primary)',
                }}
              >
                <Smile size={20} />
              </div>
              <h2 className="modal__title" style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {t('odontogram.modalTitle', { defaultValue: 'Work Order Odontogram' })}
                {workOrderFolio && (
                  <span style={{ marginLeft: '0.5rem', color: 'var(--accent-primary)', fontSize: '1.125rem' }}>
                    #{workOrderFolio}
                  </span>
                )}
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.375rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {patientName && (
                <span>
                  <strong>{t('workOrders.patient', { defaultValue: 'Patient' })}:</strong> {patientName}
                </span>
              )}
              {doctorName && (
                <span>
                  <strong>{t('workOrders.doctor', { defaultValue: 'Doctor' })}:</strong> {doctorName}
                </span>
              )}
              {branchName && (
                <span className="badge badge--neutral" style={{ fontSize: '0.75rem' }}>
                  {branchName}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Model View Selector */}
            <div
              style={{
                display: 'inline-flex',
                backgroundColor: 'var(--bg-overlay)',
                padding: '3px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('ADULT')}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: viewMode === 'ADULT' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'ADULT' ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                {t('odontogram.modelAdult', { defaultValue: 'Adult (32)' })}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('CHILD')}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: viewMode === 'CHILD' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'CHILD' ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                {t('odontogram.modelChild', { defaultValue: 'Child (20)' })}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('BOTH')}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: viewMode === 'BOTH' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'BOTH' ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                {t('odontogram.modelBoth', { defaultValue: 'Complete (52)' })}
              </button>
            </div>

            <button
              type="button"
              className="modal__close"
              onClick={onClose}
              disabled={saving}
              title={t('common.close', { defaultValue: 'Close' })}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div
          className="modal__body"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem' }}>
              <Loader2 size={36} className="spinner" style={{ color: 'var(--accent-primary)' }} />
            </div>
          ) : (
            <>
              {/* TOP SECTION: Diagnostics & Treatments Palette */}
              <div
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.875rem',
                }}
              >
                {/* 1. Diagnostics (Displayed at the top as requested) */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-heading)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <Activity size={14} style={{ color: '#EF4444' }} />
                      <span>{t('odontogramSettings.tabs.diagnostics', { defaultValue: 'Diagnostics' })}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        ({diagnostics.length})
                      </span>
                    </div>

                    {/* Eraser Tool */}
                    <button
                      type="button"
                      onClick={handleToggleEraser}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        padding: '3px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: 'var(--radius-sm)',
                        border: isEraserActive ? '1.5px solid #EF4444' : '1px solid var(--border)',
                        backgroundColor: isEraserActive ? '#FEF2F2' : 'var(--bg-overlay)',
                        color: isEraserActive ? '#DC2626' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      title={t('odontogram.eraserHelp', { defaultValue: 'Click to activate eraser tool. Then click any tooth surface to remove its marking.' })}
                    >
                      <Eraser size={13} />
                      <span>{t('odontogram.eraser', { defaultValue: 'Eraser Tool' })}</span>
                    </button>
                  </div>

                  {diagnostics.length === 0 ? (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.25rem 0' }}>
                      {t('odontogram.noDiagnosticsConfigured', { defaultValue: 'No diagnostics configured. Configure them in Odontogram Settings.' })}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {diagnostics.map((d) => {
                        const isSelected = !isEraserActive && selectedTool?.itemId === d.id && selectedTool?.itemType === 'DIAGNOSTIC';
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => handleSelectTool(d, 'DIAGNOSTIC')}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '5px 11px',
                              borderRadius: 'var(--radius-md)',
                              border: isSelected ? `2px solid ${d.color}` : '1px solid var(--border)',
                              backgroundColor: isSelected ? `${d.color}15` : 'var(--bg-card)',
                              color: 'var(--text-primary)',
                              fontSize: '0.8125rem',
                              fontWeight: isSelected ? 700 : 500,
                              cursor: 'pointer',
                              boxShadow: isSelected ? `0 0 0 1px ${d.color}` : 'none',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <span
                              style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                backgroundColor: d.color,
                                flexShrink: 0,
                              }}
                            />
                            <span>{d.name}</span>
                            {d.appliesToWholeTooth && (
                              <span
                                style={{
                                  fontSize: '0.6875rem',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  backgroundColor: 'rgba(0,0,0,0.06)',
                                  color: 'var(--text-muted)',
                                }}
                                title={t('odontogramSettings.diagnosticsTab.wholeToothBadge')}
                              >
                                {t('odontogram.wholeBadge', { defaultValue: 'Whole' })}
                              </span>
                            )}
                            {isSelected && <Check size={13} style={{ color: d.color }} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. Treatments */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-heading)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                    <Layers size={14} style={{ color: 'var(--accent-primary)' }} />
                    <span>{t('odontogramSettings.tabs.treatments', { defaultValue: 'Treatments' })}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                      ({treatments.length})
                    </span>
                  </div>

                  {treatments.length === 0 ? (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.25rem 0' }}>
                      {t('odontogram.noTreatmentsConfigured', { defaultValue: 'No treatments configured. Configure them in Odontogram Settings.' })}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {treatments.map((tr) => {
                        const isSelected = !isEraserActive && selectedTool?.itemId === tr.id && selectedTool?.itemType === 'TREATMENT';
                        return (
                          <button
                            key={tr.id}
                            type="button"
                            onClick={() => handleSelectTool(tr, 'TREATMENT')}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '5px 11px',
                              borderRadius: 'var(--radius-md)',
                              border: isSelected ? `2px solid ${tr.color}` : '1px solid var(--border)',
                              backgroundColor: isSelected ? `${tr.color}15` : 'var(--bg-card)',
                              color: 'var(--text-primary)',
                              fontSize: '0.8125rem',
                              fontWeight: isSelected ? 700 : 500,
                              cursor: 'pointer',
                              boxShadow: isSelected ? `0 0 0 1px ${tr.color}` : 'none',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <span
                              style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                backgroundColor: tr.color,
                                flexShrink: 0,
                              }}
                            />
                            <span>{tr.name}</span>
                            {tr.appliesToWholeTooth && (
                              <span
                                style={{
                                  fontSize: '0.6875rem',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  backgroundColor: 'rgba(0,0,0,0.06)',
                                  color: 'var(--text-muted)',
                                }}
                                title={t('odontogramSettings.treatmentsTab.wholeToothBadge')}
                              >
                                {t('odontogram.wholeBadge', { defaultValue: 'Whole' })}
                              </span>
                            )}
                            {isSelected && <Check size={13} style={{ color: tr.color }} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Active Tool Feedback Strip */}
                <div
                  style={{
                    backgroundColor: isEraserActive
                      ? '#FEF2F2'
                      : selectedTool
                      ? `${selectedTool.color}12`
                      : 'var(--bg-overlay)',
                    border: `1px solid ${
                      isEraserActive
                        ? '#FECACA'
                        : selectedTool
                        ? `${selectedTool.color}40`
                        : 'var(--border)'
                    }`,
                    borderRadius: 'var(--radius-md)',
                    padding: '0.5rem 0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.8125rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isEraserActive ? (
                      <>
                        <Eraser size={15} style={{ color: '#DC2626' }} />
                        <span style={{ fontWeight: 600, color: '#DC2626' }}>
                          {t('odontogram.eraserModeActive', { defaultValue: 'Eraser Mode Active: Click any tooth surface to clear it, or tooth number/bar to clear whole tooth.' })}
                        </span>
                      </>
                    ) : selectedTool ? (
                      <>
                        <span
                          style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: selectedTool.color,
                          }}
                        />
                        <span>
                          <strong>{t('odontogram.activeTool', { defaultValue: 'Active Tool' })}:</strong>{' '}
                          <span style={{ color: 'var(--text-heading)', fontWeight: 700 }}>{selectedTool.name}</span>
                          {' '}({selectedTool.itemType === 'DIAGNOSTIC' ? t('odontogramSettings.tabs.diagnostics') : t('odontogramSettings.tabs.treatments')})
                          {selectedTool.appliesToWholeTooth && (
                            <span style={{ color: 'var(--text-muted)', marginLeft: '0.375rem' }}>
                              — {t('odontogram.willApplyWholeTooth', { defaultValue: 'Applies to whole tooth' })}
                            </span>
                          )}
                        </span>
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>
                        {t('odontogram.selectItemInstruction', { defaultValue: 'Select a diagnostic or treatment above, then click any tooth part to apply.' })}
                      </span>
                    )}
                  </div>

                  {hoveredToothInfo && hoveredToothInfo.part && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                      <Info size={14} />
                      <span>
                        {t('odontogram.tooth', { defaultValue: 'Tooth' })} {hoveredToothInfo.toothNumber} —{' '}
                        {getSurfaceDisplayName(hoveredToothInfo.toothNumber, hoveredToothInfo.part, i18n.language)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* CENTER SECTION: Odontogram Chart (Matching Reference Image) */}
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.25rem 1rem',
                  overflowX: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                {/* ─── UPPER ARCH (Maxillary) ─── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {/* Adult Upper Teeth (18–11 | 21–28) */}
                  {(viewMode === 'ADULT' || viewMode === 'BOTH') && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      {/* Q1: 18 - 11 */}
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end', flex: 1, paddingRight: '0.75rem' }}>
                        {ADULT_UPPER_RIGHT.map((num) => (
                          <ToothSvg
                            key={num}
                            toothNumber={num}
                            partsMap={teethData[String(num)]}
                            onSelectPart={handlePartClick}
                            onHoverPart={(tNum, part) => setHoveredToothInfo(part ? { toothNumber: tNum, part } : null)}
                            disabled={saving}
                          />
                        ))}
                      </div>

                      {/* Quadrant Vertical Midline */}
                      <div style={{ width: '2px', height: '54px', backgroundColor: '#94A3B8' }} />

                      {/* Q2: 21 - 28 */}
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-start', flex: 1, paddingLeft: '0.75rem' }}>
                        {ADULT_UPPER_LEFT.map((num) => (
                          <ToothSvg
                            key={num}
                            toothNumber={num}
                            partsMap={teethData[String(num)]}
                            onSelectPart={handlePartClick}
                            onHoverPart={(tNum, part) => setHoveredToothInfo(part ? { toothNumber: tNum, part } : null)}
                            disabled={saving}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Child Upper Teeth (55–51 | 61–65) */}
                  {(viewMode === 'CHILD' || viewMode === 'BOTH') && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      {/* Q5: 55 - 51 */}
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end', flex: 1, paddingRight: '0.75rem' }}>
                        {CHILD_UPPER_RIGHT.map((num) => (
                          <ToothSvg
                            key={num}
                            toothNumber={num}
                            partsMap={teethData[String(num)]}
                            onSelectPart={handlePartClick}
                            onHoverPart={(tNum, part) => setHoveredToothInfo(part ? { toothNumber: tNum, part } : null)}
                            disabled={saving}
                          />
                        ))}
                      </div>

                      {/* Quadrant Vertical Midline */}
                      <div style={{ width: '2px', height: '54px', backgroundColor: '#94A3B8' }} />

                      {/* Q6: 61 - 65 */}
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-start', flex: 1, paddingLeft: '0.75rem' }}>
                        {CHILD_UPPER_LEFT.map((num) => (
                          <ToothSvg
                            key={num}
                            toothNumber={num}
                            partsMap={teethData[String(num)]}
                            onSelectPart={handlePartClick}
                            onHoverPart={(tNum, part) => setHoveredToothInfo(part ? { toothNumber: tNum, part } : null)}
                            disabled={saving}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ─── CROSSHAIR DIVIDING LINE (Occlusal Midplane) ─── */}
                <div style={{ position: 'relative', height: '2px', backgroundColor: '#94A3B8', margin: '0.25rem 0' }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: '#FFFFFF',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      color: '#64748B',
                      letterSpacing: '0.05em',
                    }}
                  >
                    MIDLINE
                  </div>
                </div>

                {/* ─── LOWER ARCH (Mandibular) ─── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {/* Child Lower Teeth (85–81 | 71–75) */}
                  {(viewMode === 'CHILD' || viewMode === 'BOTH') && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      {/* Q8: 85 - 81 */}
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end', flex: 1, paddingRight: '0.75rem' }}>
                        {CHILD_LOWER_RIGHT.map((num) => (
                          <ToothSvg
                            key={num}
                            toothNumber={num}
                            partsMap={teethData[String(num)]}
                            onSelectPart={handlePartClick}
                            onHoverPart={(tNum, part) => setHoveredToothInfo(part ? { toothNumber: tNum, part } : null)}
                            disabled={saving}
                          />
                        ))}
                      </div>

                      {/* Quadrant Vertical Midline */}
                      <div style={{ width: '2px', height: '54px', backgroundColor: '#94A3B8' }} />

                      {/* Q7: 71 - 75 */}
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-start', flex: 1, paddingLeft: '0.75rem' }}>
                        {CHILD_LOWER_LEFT.map((num) => (
                          <ToothSvg
                            key={num}
                            toothNumber={num}
                            partsMap={teethData[String(num)]}
                            onSelectPart={handlePartClick}
                            onHoverPart={(tNum, part) => setHoveredToothInfo(part ? { toothNumber: tNum, part } : null)}
                            disabled={saving}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Adult Lower Teeth (48–41 | 31–38) */}
                  {(viewMode === 'ADULT' || viewMode === 'BOTH') && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      {/* Q4: 48 - 41 */}
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end', flex: 1, paddingRight: '0.75rem' }}>
                        {ADULT_LOWER_RIGHT.map((num) => (
                          <ToothSvg
                            key={num}
                            toothNumber={num}
                            partsMap={teethData[String(num)]}
                            onSelectPart={handlePartClick}
                            onHoverPart={(tNum, part) => setHoveredToothInfo(part ? { toothNumber: tNum, part } : null)}
                            disabled={saving}
                          />
                        ))}
                      </div>

                      {/* Quadrant Vertical Midline */}
                      <div style={{ width: '2px', height: '54px', backgroundColor: '#94A3B8' }} />

                      {/* Q3: 31 - 38 */}
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-start', flex: 1, paddingLeft: '0.75rem' }}>
                        {ADULT_LOWER_LEFT.map((num) => (
                          <ToothSvg
                            key={num}
                            toothNumber={num}
                            partsMap={teethData[String(num)]}
                            onSelectPart={handlePartClick}
                            onHoverPart={(tNum, part) => setHoveredToothInfo(part ? { toothNumber: tNum, part } : null)}
                            disabled={saving}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* BOTTOM SECTION: Findings Summary & Notes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
                {/* Findings Summary Chips */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '0.875rem 1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                      {t('odontogram.appliedFindings', { defaultValue: 'Applied Findings & Markings' })} ({findingsList.length})
                    </span>
                    {findingsList.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAll}
                        style={{
                          fontSize: '0.75rem',
                          color: '#EF4444',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Trash2 size={12} />
                        <span>{t('odontogram.clearAll', { defaultValue: 'Clear All' })}</span>
                      </button>
                    )}
                  </div>

                  {findingsList.length === 0 ? (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                      {t('odontogram.noMarkingsYet', { defaultValue: 'No markings applied yet. Click any tooth surface above to add diagnostics or treatments.' })}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', maxHeight: '110px', overflowY: 'auto' }}>
                      {findingsList.map((item, idx) => (
                        <div
                          key={`${item.toothNumber}-${item.part}-${idx}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: `${item.finding.color}18`,
                            border: `1px solid ${item.finding.color}40`,
                            fontSize: '0.75rem',
                          }}
                        >
                          <span
                            style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              backgroundColor: item.finding.color,
                            }}
                          />
                          <span style={{ fontWeight: 700, color: 'var(--text-heading)' }}>
                            T{item.toothNumber}
                          </span>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            [{getSurfaceDisplayName(Number(item.toothNumber), item.part, i18n.language)}]:
                          </span>
                          <span style={{ fontWeight: 600 }}>{item.finding.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              // Erase this item
                              setTeethData((prev) => {
                                const current = { ...(prev[item.toothNumber] || {}) };
                                delete current[item.part];
                                if (Object.keys(current).length === 0) {
                                  const next = { ...prev };
                                  delete next[item.toothNumber];
                                  return next;
                                }
                                return { ...prev, [item.toothNumber]: current };
                              });
                            }}
                            style={{
                              border: 'none',
                              background: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '0 2px',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            title={t('common.delete', { defaultValue: 'Remove' })}
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes Input */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '0.875rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <label
                    htmlFor="odontogramNotes"
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      color: 'var(--text-heading)',
                      marginBottom: '0.375rem',
                      display: 'block',
                    }}
                  >
                    {t('odontogram.clinicalNotes', { defaultValue: 'Odontogram / Clinical Notes' })}
                  </label>
                  <textarea
                    id="odontogramNotes"
                    className="form-input"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('odontogram.notesPlaceholder', {
                      defaultValue: 'Optional notes regarding teeth condition, prosthetic specifications, or clinical findings...',
                    })}
                    style={{
                      flex: 1,
                      resize: 'none',
                      fontSize: '0.8125rem',
                      padding: '0.5rem',
                    }}
                  />
                  {lastUpdatedAt && (
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
                      {t('odontogram.lastUpdated', { defaultValue: 'Last saved' })}: {formatDateTime(lastUpdatedAt)}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal__footer" style={{ justifyContent: 'space-between', padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            <span>
              <strong>{chartedTeethCount}</strong> {t('odontogram.teethMarked', { defaultValue: 'teeth marked' })}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={onClose}
              disabled={saving}
            >
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </button>

            <button
              type="button"
              className="btn btn--primary"
              onClick={handleSave}
              disabled={saving || loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="spinner" />
                  <span>{t('common.saving', { defaultValue: 'Saving...' })}</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>{t('odontogram.saveOdontogram', { defaultValue: 'Save Odontogram' })}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

