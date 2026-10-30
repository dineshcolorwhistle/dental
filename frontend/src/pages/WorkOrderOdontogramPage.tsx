import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Activity,
  Layers,
  Eraser,
  Save,
  Check,
  Trash2,
  Loader2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../context';
import { useAppDate } from '../hooks';
import {
  odontogramService,
  type ToothPart,
  type OdontogramTeethData,
  type ToothPartsMap,
  type TeethModel,
  type OdontogramTreatmentItem,
  type OdontogramDiagnosticItem,
  type AppliedFinding,
} from '../services';
import { ToothSvg, getSurfaceDisplayName } from '../components/ToothSvg';
import { ToothIcon } from '../components';

type ViewMode = 'ADULT' | 'CHILD' | 'BOTH';
type ActiveTab = 'DIAGNOSTICS' | 'TREATMENT_PLAN';

const ADULT_UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const ADULT_UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const CHILD_UPPER_RIGHT = [55, 54, 53, 52, 51];
const CHILD_UPPER_LEFT = [61, 62, 63, 64, 65];

const CHILD_LOWER_RIGHT = [85, 84, 83, 82, 81];
const CHILD_LOWER_LEFT = [71, 72, 73, 74, 75];
const ADULT_LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const ADULT_LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];

interface TreatmentFindingItem {
  toothNumber: number;
  part: ToothPart;
  finding: AppliedFinding;
  zone: 'POSTERIOR' | 'ANTERIOR';
  quadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4';
}

/**
 * Determine FDI anatomical zone (Anterior / Posterior) and Quadrant (Q1 - Q4)
 */
function getToothZoneAndQuadrant(toothNumber: number): {
  zone: 'POSTERIOR' | 'ANTERIOR';
  quadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4';
} {
  const toothStr = String(toothNumber);
  const qDigit = parseInt(toothStr[0], 10);
  const posDigit = parseInt(toothStr[1], 10);

  // Position 1, 2, 3: Incisors and Canines = ANTERIOR
  // Position 4, 5, 6, 7, 8: Premolars and Molars = POSTERIOR
  const zone = posDigit >= 1 && posDigit <= 3 ? 'ANTERIOR' : 'POSTERIOR';

  // FDI Quadrants:
  // 1 (Adult Upper Right) & 5 (Child Upper Right) -> Q1
  // 2 (Adult Upper Left)  & 6 (Child Upper Left)  -> Q2
  // 3 (Adult Lower Left)  & 7 (Child Lower Left)  -> Q3
  // 4 (Adult Lower Right) & 8 (Child Lower Right) -> Q4
  let quadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4' = 'Q1';
  if (qDigit === 1 || qDigit === 5) quadrant = 'Q1';
  else if (qDigit === 2 || qDigit === 6) quadrant = 'Q2';
  else if (qDigit === 3 || qDigit === 7) quadrant = 'Q3';
  else if (qDigit === 4 || qDigit === 8) quadrant = 'Q4';

  return { zone, quadrant };
}

export const WorkOrderOdontogramPage: React.FC = () => {
  const { id: workOrderId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const { formatDateTime } = useAppDate();

  // Guard: Owner and Admin only
  useEffect(() => {
    if (user && user.role !== 'OWNER' && user.role !== 'ADMIN') {
      toast.error(t('common.unauthorized', { defaultValue: 'Unauthorized access' }));
      navigate('/work-orders');
    }
  }, [user, navigate, t]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Work order metadata
  const [workOrderInfo, setWorkOrderInfo] = useState<{
    id: string;
    folioNumber: string;
    patient: string | null;
    doctor: { id: string; name: string } | null;
    branch: { id: string; name: string; code: string } | null;
  } | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<ActiveTab>('DIAGNOSTICS');

  // Settings & Work Order data
  const [defaultTeethModel, setDefaultTeethModel] = useState<TeethModel>('ADULT');
  const [viewMode, setViewMode] = useState<ViewMode>('ADULT');

  // Separate teeth data for each tab
  const [diagnosticTeethData, setDiagnosticTeethData] = useState<OdontogramTeethData>({});
  const [treatmentTeethData, setTreatmentTeethData] = useState<OdontogramTeethData>({});

  const [notes, setNotes] = useState('');
  const [treatments, setTreatments] = useState<OdontogramTreatmentItem[]>([]);
  const [diagnostics, setDiagnostics] = useState<OdontogramDiagnosticItem[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  // Selected tool states per tab
  const [selectedDiagnosticTool, setSelectedDiagnosticTool] = useState<OdontogramDiagnosticItem | null>(null);
  const [isDiagnosticEraserActive, setIsDiagnosticEraserActive] = useState(false);

  const [selectedTreatmentTool, setSelectedTreatmentTool] = useState<OdontogramTreatmentItem | null>(null);
  const [isTreatmentEraserActive, setIsTreatmentEraserActive] = useState(false);

  // Hover state with element bounding rect for floating tooltip
  const [hoveredToothInfo, setHoveredToothInfo] = useState<{
    toothNumber: number;
    part: ToothPart;
    rect?: DOMRect;
  } | null>(null);

  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleHoverPart = useCallback((toothNumber: number, part: ToothPart | null, rect?: DOMRect) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    if (!part) {
      // 60ms debounce to prevent blinking when moving between sections or across tooth boundaries
      hoverTimeoutRef.current = setTimeout(() => {
        setHoveredToothInfo(null);
      }, 60);
    } else {
      setHoveredToothInfo({ toothNumber, part, rect });
    }
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Load odontogram data for work order
  const loadData = useCallback(async () => {
    if (!workOrderId) return;
    try {
      setLoading(true);
      setHasError(false);
      const res = await odontogramService.getWorkOrderOdontogram(workOrderId);

      setWorkOrderInfo(res.workOrder);
      setDefaultTeethModel(res.defaultTeethModel || 'ADULT');
      setViewMode(res.teethModel || res.defaultTeethModel || 'ADULT');
      setNotes(res.notes || '');
      setTreatments(res.treatments || []);
      setDiagnostics(res.diagnostics || []);
      setLastUpdatedAt(res.updatedAt);

      // Parse and separate teeth data
      const raw = (res.teethData || {}) as Record<string, any>;
      if (raw.diagnostics || raw.treatments) {
        setDiagnosticTeethData((raw.diagnostics || {}) as OdontogramTeethData);
        setTreatmentTeethData((raw.treatments || {}) as OdontogramTeethData);
      } else {
        // Backwards compatibility for legacy flat records
        const dData: OdontogramTeethData = {};
        const tData: OdontogramTeethData = {};

        Object.entries(raw).forEach(([tNum, parts]) => {
          if (!parts || typeof parts !== 'object') return;
          Object.entries(parts as ToothPartsMap).forEach(([p, finding]) => {
            if (!finding) return;
            if (finding.itemType === 'TREATMENT') {
              if (!tData[tNum]) tData[tNum] = {};
              tData[tNum][p as ToothPart] = finding;
            } else {
              if (!dData[tNum]) dData[tNum] = {};
              dData[tNum][p as ToothPart] = finding;
            }
          });
        });

        setDiagnosticTeethData(dData);
        setTreatmentTeethData(tData);
      }

      // Preselect default tools
      if (res.diagnostics && res.diagnostics.length > 0) {
        setSelectedDiagnosticTool(res.diagnostics[0]);
        setIsDiagnosticEraserActive(false);
      }
      if (res.treatments && res.treatments.length > 0) {
        setSelectedTreatmentTool(res.treatments[0]);
        setIsTreatmentEraserActive(false);
      }
    } catch (err: any) {
      setHasError(true);
      toast.error(
        err?.response?.data?.message ||
          t('odontogram.loadFailed', { defaultValue: 'Failed to load odontogram data' })
      );
    } finally {
      setLoading(false);
    }
  }, [workOrderId, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Click Handlers for Diagnostics ─────────────────────
  const handleDiagnosticPartClick = (toothNumber: number, part: ToothPart) => {
    const key = String(toothNumber);

    if (isDiagnosticEraserActive) {
      setDiagnosticTeethData((prev) => {
        const currentTooth = { ...(prev[key] || {}) };
        if (part === 'whole') {
          const next = { ...prev };
          delete next[key];
          return next;
        } else {
          delete currentTooth[part];
          delete currentTooth.whole;
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

    if (!selectedDiagnosticTool) {
      toast(t('odontogram.selectToolFirst', { defaultValue: 'Please select a diagnostic first' }), {
        icon: 'ℹ️',
      });
      return;
    }

    const finding: AppliedFinding = {
      itemId: selectedDiagnosticTool.id,
      itemType: 'DIAGNOSTIC',
      name: selectedDiagnosticTool.name,
      color: selectedDiagnosticTool.color,
      appliesToWholeTooth: selectedDiagnosticTool.appliesToWholeTooth,
      appliedAt: new Date().toISOString(),
    };

    setDiagnosticTeethData((prev) => {
      const currentTooth = { ...(prev[key] || {}) };

      if (selectedDiagnosticTool.appliesToWholeTooth || part === 'whole') {
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

  const handleRemoveDiagnosticPart = (toothNumber: number, part: ToothPart) => {
    const key = String(toothNumber);
    setDiagnosticTeethData((prev) => {
      const current = { ...(prev[key] || {}) };
      delete current[part];
      if (part === 'whole') {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      if (Object.keys(current).length === 0) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: current };
    });
  };

  const handleClearAllDiagnostics = () => {
    if (Object.keys(diagnosticTeethData).length === 0) return;
    if (window.confirm(t('odontogram.confirmClearAll', { defaultValue: 'Are you sure you want to clear all markings on this odontogram?' }))) {
      setDiagnosticTeethData({});
    }
  };

  // ─── Click Handlers for Treatments ──────────────────────
  const handleTreatmentPartClick = (toothNumber: number, part: ToothPart) => {
    const key = String(toothNumber);

    if (isTreatmentEraserActive) {
      setTreatmentTeethData((prev) => {
        const currentTooth = { ...(prev[key] || {}) };
        if (part === 'whole') {
          const next = { ...prev };
          delete next[key];
          return next;
        } else {
          delete currentTooth[part];
          delete currentTooth.whole;
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

    if (!selectedTreatmentTool) {
      toast(t('odontogram.selectToolFirst', { defaultValue: 'Please select a treatment first' }), {
        icon: 'ℹ️',
      });
      return;
    }

    const finding: AppliedFinding = {
      itemId: selectedTreatmentTool.id,
      itemType: 'TREATMENT',
      name: selectedTreatmentTool.name,
      color: selectedTreatmentTool.color,
      appliesToWholeTooth: selectedTreatmentTool.appliesToWholeTooth,
      appliedAt: new Date().toISOString(),
    };

    setTreatmentTeethData((prev) => {
      const currentTooth = { ...(prev[key] || {}) };

      if (selectedTreatmentTool.appliesToWholeTooth || part === 'whole') {
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

  const handleRemoveTreatmentPart = (toothNumber: number, part: ToothPart) => {
    const key = String(toothNumber);
    setTreatmentTeethData((prev) => {
      const current = { ...(prev[key] || {}) };
      delete current[part];
      if (part === 'whole') {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      if (Object.keys(current).length === 0) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: current };
    });
  };

  const handleClearAllTreatments = () => {
    if (Object.keys(treatmentTeethData).length === 0) return;
    if (window.confirm(t('odontogram.confirmClearAll', { defaultValue: 'Are you sure you want to clear all markings on this odontogram?' }))) {
      setTreatmentTeethData({});
    }
  };

  // ─── Save ───────────────────────────────────────────────
  const handleSave = async () => {
    if (!workOrderId) return;
    try {
      setSaving(true);
      const teethDataPayload = {
        diagnostics: diagnosticTeethData,
        treatments: treatmentTeethData,
        ...diagnosticTeethData,
        ...treatmentTeethData,
      };

      await odontogramService.saveWorkOrderOdontogram(workOrderId, {
        teethModel: viewMode === 'BOTH' ? defaultTeethModel : viewMode,
        teethData: teethDataPayload,
        notes,
      });

      setLastUpdatedAt(new Date().toISOString());
      toast.success(t('odontogram.saveSuccess', { defaultValue: 'Odontogram saved successfully' }));
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          t('odontogram.saveFailed', { defaultValue: 'Failed to save odontogram' })
      );
    } finally {
      setSaving(false);
    }
  };

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!saving && !loading) {
          handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saving, loading, handleSave]);

  // ─── Findings Lists & Counts ─────────────────────────────
  const diagnosticFindingsList = useMemo(() => {
    const list: Array<{
      toothNumber: string;
      part: ToothPart;
      finding: AppliedFinding;
    }> = [];

    Object.entries(diagnosticTeethData).forEach(([toothNumber, parts]) => {
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
  }, [diagnosticTeethData]);

  const treatmentFindingsList = useMemo(() => {
    const list: TreatmentFindingItem[] = [];
    Object.entries(treatmentTeethData).forEach(([toothStr, parts]) => {
      if (!parts) return;
      const toothNum = parseInt(toothStr, 10);
      const { zone, quadrant } = getToothZoneAndQuadrant(toothNum);

      if (parts.whole) {
        list.push({ toothNumber: toothNum, part: 'whole', finding: parts.whole, zone, quadrant });
      } else {
        Object.entries(parts).forEach(([part, finding]) => {
          if (finding) {
            list.push({ toothNumber: toothNum, part: part as ToothPart, finding, zone, quadrant });
          }
        });
      }
    });
    return list;
  }, [treatmentTeethData]);

  const diagnosticTeethCount = useMemo(() => {
    return Object.keys(diagnosticTeethData).filter((k) => Object.keys(diagnosticTeethData[k] || {}).length > 0).length;
  }, [diagnosticTeethData]);

  const treatmentTeethCount = useMemo(() => {
    return Object.keys(treatmentTeethData).filter((k) => Object.keys(treatmentTeethData[k] || {}).length > 0).length;
  }, [treatmentTeethData]);

  // ─── Render Reusable Teeth Chart ─────────────────────────
  const renderTeethChart = (
    currentData: OdontogramTeethData,
    onPartClick: (tNum: number, part: ToothPart) => void
  ) => {
    return (
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem 1.5rem',
          overflowX: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: 'var(--shadow-sm)',
          width: '100%',
        }}
      >
        <div style={{ display: 'inline-flex', flexDirection: 'column', minWidth: '920px', width: '100%', maxWidth: '1080px' }}>
          {/* UPPER ARCH (Maxillary) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Adult Upper Teeth (18–11 | 21–28) */}
            {(viewMode === 'ADULT' || viewMode === 'BOTH') && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.45rem', justifyContent: 'flex-end', flex: 1, paddingRight: '1rem' }}>
                  {ADULT_UPPER_RIGHT.map((num) => (
                    <ToothSvg
                      key={num}
                      toothNumber={num}
                      partsMap={currentData[String(num)]}
                      onSelectPart={onPartClick}
                      onHoverPart={handleHoverPart}
                      disabled={saving}
                      size="lg"
                    />
                  ))}
                </div>

                <div style={{ width: '2px', height: '68px', backgroundColor: '#CBD5E1' }} />

                <div style={{ display: 'flex', gap: '0.45rem', justifyContent: 'flex-start', flex: 1, paddingLeft: '1rem' }}>
                  {ADULT_UPPER_LEFT.map((num) => (
                    <ToothSvg
                      key={num}
                      toothNumber={num}
                      partsMap={currentData[String(num)]}
                      onSelectPart={onPartClick}
                      onHoverPart={handleHoverPart}
                      disabled={saving}
                      size="lg"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Child Upper Teeth (55–51 | 61–65) */}
            {(viewMode === 'CHILD' || viewMode === 'BOTH') && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.45rem', justifyContent: 'flex-end', flex: 1, paddingRight: '1rem' }}>
                  {CHILD_UPPER_RIGHT.map((num) => (
                    <ToothSvg
                      key={num}
                      toothNumber={num}
                      partsMap={currentData[String(num)]}
                      onSelectPart={onPartClick}
                      onHoverPart={handleHoverPart}
                      disabled={saving}
                      size="lg"
                    />
                  ))}
                </div>

                <div style={{ width: '2px', height: '68px', backgroundColor: '#CBD5E1' }} />

                <div style={{ display: 'flex', gap: '0.45rem', justifyContent: 'flex-start', flex: 1, paddingLeft: '1rem' }}>
                  {CHILD_UPPER_LEFT.map((num) => (
                    <ToothSvg
                      key={num}
                      toothNumber={num}
                      partsMap={currentData[String(num)]}
                      onSelectPart={onPartClick}
                      onHoverPart={handleHoverPart}
                      disabled={saving}
                      size="lg"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* DENTAL CROSSHAIR (Horizontal Dividing Line) */}
          <div style={{ width: '100%', height: '2px', backgroundColor: '#CBD5E1', margin: '0.75rem 0' }} />

          {/* LOWER ARCH (Mandibular) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Child Lower Teeth (85–81 | 71–75) */}
            {(viewMode === 'CHILD' || viewMode === 'BOTH') && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.45rem', justifyContent: 'flex-end', flex: 1, paddingRight: '1rem' }}>
                  {CHILD_LOWER_RIGHT.map((num) => (
                    <ToothSvg
                      key={num}
                      toothNumber={num}
                      partsMap={currentData[String(num)]}
                      onSelectPart={onPartClick}
                      onHoverPart={handleHoverPart}
                      disabled={saving}
                      size="lg"
                    />
                  ))}
                </div>

                <div style={{ width: '2px', height: '68px', backgroundColor: '#CBD5E1' }} />

                <div style={{ display: 'flex', gap: '0.45rem', justifyContent: 'flex-start', flex: 1, paddingLeft: '1rem' }}>
                  {CHILD_LOWER_LEFT.map((num) => (
                    <ToothSvg
                      key={num}
                      toothNumber={num}
                      partsMap={currentData[String(num)]}
                      onSelectPart={onPartClick}
                      onHoverPart={handleHoverPart}
                      disabled={saving}
                      size="lg"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Adult Lower Teeth (48–41 | 31–38) */}
            {(viewMode === 'ADULT' || viewMode === 'BOTH') && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.45rem', justifyContent: 'flex-end', flex: 1, paddingRight: '1rem' }}>
                  {ADULT_LOWER_RIGHT.map((num) => (
                    <ToothSvg
                      key={num}
                      toothNumber={num}
                      partsMap={currentData[String(num)]}
                      onSelectPart={onPartClick}
                      onHoverPart={handleHoverPart}
                      disabled={saving}
                      size="lg"
                    />
                  ))}
                </div>

                <div style={{ width: '2px', height: '68px', backgroundColor: '#CBD5E1' }} />

                <div style={{ display: 'flex', gap: '0.45rem', justifyContent: 'flex-start', flex: 1, paddingLeft: '1rem' }}>
                  {ADULT_LOWER_LEFT.map((num) => (
                    <ToothSvg
                      key={num}
                      toothNumber={num}
                      partsMap={currentData[String(num)]}
                      onSelectPart={onPartClick}
                      onHoverPart={handleHoverPart}
                      disabled={saving}
                      size="lg"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── Render Treatment Quadrant Box ───────────────────────
  const renderQuadrantBox = (
    zone: 'POSTERIOR' | 'ANTERIOR',
    quadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4',
    accentBorderColor?: string
  ) => {
    const items = treatmentFindingsList.filter(
      (item) => item.zone === zone && item.quadrant === quadrant
    );

    return (
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderLeft: accentBorderColor ? `3.5px solid ${accentBorderColor}` : '1px solid #E2E8F0',
          borderRadius: '8px',
          padding: '0.75rem 0.875rem',
          minHeight: '130px',
          maxHeight: '170px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              color: '#334155',
              backgroundColor: '#F1F5F9',
              borderRadius: '4px',
              padding: '2px 8px',
              letterSpacing: '0.03em',
            }}
          >
            {quadrant}
          </span>
          {items.length > 0 && (
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
          {items.length === 0 ? (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 'auto 0' }}>
              —
            </span>
          ) : (
            items.map((item, idx) => (
              <div
                key={`${item.toothNumber}-${item.part}-${idx}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 6px',
                  borderRadius: '4px',
                  backgroundColor: `${item.finding.color}15`,
                  border: `1px solid ${item.finding.color}40`,
                  fontSize: '0.75rem',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '2px',
                    backgroundColor: item.finding.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 700, color: 'var(--text-heading)' }}>
                  T{item.toothNumber}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.6875rem', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.finding.name} ({item.part === 'whole' ? t('odontogram.wholeBadge', { defaultValue: 'Whole' }) : getSurfaceDisplayName(item.toothNumber, item.part, i18n.language)})
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveTreatmentPart(item.toothNumber, item.part)}
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
                  <XIcon size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
        <Loader2 size={40} className="spinner" style={{ color: 'var(--accent-primary)' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          {t('common.loading', { defaultValue: 'Loading odontogram...' })}
        </p>
      </div>
    );
  }

  if (hasError || !workOrderInfo) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
        <AlertCircle size={44} style={{ color: 'var(--danger)' }} />
        <h3 style={{ margin: 0, color: 'var(--text-heading)' }}>
          {t('odontogram.loadFailed', { defaultValue: 'Failed to load odontogram' })}
        </h3>
        <button
          className="btn btn--outline"
          onClick={() => navigate('/work-orders')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}
        >
          <ArrowLeft size={16} />
          <span>{t('workOrders.backToWorkOrders', { defaultValue: 'Back to Work Orders' })}</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      {/* ─── 1. TOP BREADCRUMB & BACK ACTION ──────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => navigate('/work-orders')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={16} />
          <span>{t('workOrders.backToWorkOrders', { defaultValue: 'Back to Work Orders' })}</span>
        </button>

        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => navigate(`/work-orders/${workOrderId}`)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)' }}
        >
          <span>{t('workOrders.viewWorkOrder', { defaultValue: 'View Work Order Details' })}</span>
          <ExternalLink size={14} />
        </button>
      </div>

      {/* ─── 2. PAGE HEADER ─────────────────────────────────── */}
      <div
        className="page-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.25rem',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem 1.5rem',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
              flexShrink: 0,
            }}
          >
            <ToothIcon size={26} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.375rem', fontWeight: 800, margin: 0, color: 'var(--text-heading)' }}>
                {t('odontogram.modalTitle', { defaultValue: 'Work Order Odontogram' })}
              </h1>
              <span
                style={{
                  fontSize: '1.125rem',
                  fontWeight: 800,
                  color: 'var(--accent-primary)',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  padding: '2px 10px',
                  borderRadius: '6px',
                }}
              >
                #{workOrderInfo.folioNumber}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginTop: '0.375rem', fontSize: '0.8438rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
              {workOrderInfo.patient && (
                <span>
                  <strong style={{ color: 'var(--text-heading)' }}>{t('workOrders.patient', { defaultValue: 'Patient' })}:</strong>{' '}
                  {workOrderInfo.patient}
                </span>
              )}
              {workOrderInfo.doctor && (
                <span>
                  <strong style={{ color: 'var(--text-heading)' }}>{t('workOrders.doctor', { defaultValue: 'Doctor' })}:</strong>{' '}
                  {workOrderInfo.doctor.name}
                </span>
              )}
              {workOrderInfo.branch && (
                <span className="badge badge--neutral" style={{ fontSize: '0.75rem' }}>
                  {workOrderInfo.branch.name}
                </span>
              )}
              {lastUpdatedAt && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {t('odontogram.lastUpdated', { defaultValue: 'Last saved' })}: {formatDateTime(lastUpdatedAt)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Teeth Model View Selector */}
          <div
            style={{
              display: 'inline-flex',
              backgroundColor: 'var(--bg-overlay)',
              padding: '4px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('ADULT')}
              style={{
                padding: '6px 12px',
                fontSize: '0.8125rem',
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
                padding: '6px 12px',
                fontSize: '0.8125rem',
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
                padding: '6px 12px',
                fontSize: '0.8125rem',
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

          {/* Save Odontogram Button */}
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleSave}
            disabled={saving || loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem' }}
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

      {/* ─── 3. TAB NAVIGATION ──────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '2px solid var(--border)',
          paddingBottom: '0',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('DIAGNOSTICS')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.625rem',
            fontWeight: 700,
            fontSize: '0.9375rem',
            border: 'none',
            borderBottom: activeTab === 'DIAGNOSTICS' ? '3px solid var(--accent-primary)' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'DIAGNOSTICS' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            padding: '0.75rem 1.25rem',
            cursor: 'pointer',
            marginBottom: '-2px',
            transition: 'all 0.15s ease',
          }}
        >
          <Activity size={18} />
          <span>{t('odontogramSettings.tabs.diagnostics', { defaultValue: 'Diagnostics' })}</span>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '100px',
              backgroundColor: activeTab === 'DIAGNOSTICS' ? 'var(--accent-primary)' : 'var(--bg-overlay)',
              color: activeTab === 'DIAGNOSTICS' ? '#fff' : 'var(--text-muted)',
            }}
          >
            {diagnosticTeethCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('TREATMENT_PLAN')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.625rem',
            fontWeight: 700,
            fontSize: '0.9375rem',
            border: 'none',
            borderBottom: activeTab === 'TREATMENT_PLAN' ? '3px solid var(--accent-primary)' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'TREATMENT_PLAN' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            padding: '0.75rem 1.25rem',
            cursor: 'pointer',
            marginBottom: '-2px',
            transition: 'all 0.15s ease',
          }}
        >
          <Layers size={18} />
          <span>{t('odontogram.treatmentPlan', { defaultValue: 'Treatment Plan' })}</span>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '100px',
              backgroundColor: activeTab === 'TREATMENT_PLAN' ? 'var(--accent-primary)' : 'var(--bg-overlay)',
              color: activeTab === 'TREATMENT_PLAN' ? '#fff' : 'var(--text-muted)',
            }}
          >
            {treatmentTeethCount}
          </span>
        </button>
      </div>

      {/* ─── 4. MAIN WORKSPACE CONTENT ─────────────────────── */}
      {activeTab === 'DIAGNOSTICS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Diagnostic Palette Bar */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.125rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <p style={{ margin: 0, fontSize: '0.8438rem', color: 'var(--text-secondary)' }}>
              {t('odontogram.diagnosticsInstruction', {
                defaultValue: 'Click a tooth block to mark its condition (Healthy, Damaged, Filling, Missing, Crown, or Implant). Filling and Crown apply to the whole tooth.',
              })}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              {/* Clear Button */}
              <button
                type="button"
                onClick={() => {
                  setIsDiagnosticEraserActive(true);
                  setSelectedDiagnosticTool(null);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: isDiagnosticEraserActive ? '1.5px solid #EF4444' : '1px solid var(--border)',
                  backgroundColor: isDiagnosticEraserActive ? '#FEF2F2' : 'var(--bg-card)',
                  color: isDiagnosticEraserActive ? '#DC2626' : 'var(--text-primary)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: isDiagnosticEraserActive ? '0 0 0 1px #EF4444' : 'none',
                  transition: 'all 0.15s ease',
                }}
                title={t('odontogram.eraserHelp')}
              >
                <Eraser size={14} style={{ color: isDiagnosticEraserActive ? '#DC2626' : 'var(--text-muted)' }} />
                <span>{t('odontogram.clear', { defaultValue: 'Clear' })}</span>
              </button>

              {/* Diagnostic Tools */}
              {diagnostics.length === 0 ? (
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {t('odontogram.noDiagnosticsConfigured')}
                </span>
              ) : (
                diagnostics.map((d) => {
                  const isSelected = !isDiagnosticEraserActive && selectedDiagnosticTool?.id === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setIsDiagnosticEraserActive(false);
                        setSelectedDiagnosticTool(d);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '6px 14px',
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
                          width: '12px',
                          height: '12px',
                          borderRadius: '3px',
                          backgroundColor: d.color,
                          boxShadow: '0 0 0 1px rgba(0,0,0,0.1)',
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
                        >
                          {t('odontogram.wholeBadge', { defaultValue: 'Whole' })}
                        </span>
                      )}
                      {isSelected && <Check size={14} style={{ color: d.color }} />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Full-width Diagnostics Teeth Chart */}
          {renderTeethChart(diagnosticTeethData, handleDiagnosticPartClick)}

          {/* Bottom Grid: Findings Summary & Clinical Notes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
            {/* Findings List Card */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.125rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                  {t('odontogram.appliedFindings', { defaultValue: 'Applied Findings & Markings' })} ({diagnosticFindingsList.length})
                </span>
                {diagnosticFindingsList.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllDiagnostics}
                    style={{
                      fontSize: '0.75rem',
                      color: '#EF4444',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 600,
                    }}
                  >
                    <Trash2 size={13} />
                    <span>{t('odontogram.clearAll', { defaultValue: 'Clear All' })}</span>
                  </button>
                )}
              </div>

              {diagnosticFindingsList.length === 0 ? (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem 0' }}>
                  {t('odontogram.noMarkingsYet')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                  {diagnosticFindingsList.map((item, idx) => (
                    <div
                      key={`${item.toothNumber}-${item.part}-${idx}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        backgroundColor: `${item.finding.color}15`,
                        border: `1px solid ${item.finding.color}40`,
                        fontSize: '0.7813rem',
                      }}
                    >
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '2px',
                          backgroundColor: item.finding.color,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontWeight: 700, color: 'var(--text-heading)' }}>
                        T{item.toothNumber}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.7188rem' }}>
                        [{item.part === 'whole' ? t('odontogram.wholeBadge') : getSurfaceDisplayName(Number(item.toothNumber), item.part, i18n.language)}]:
                      </span>
                      <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>
                        {item.finding.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDiagnosticPart(Number(item.toothNumber), item.part)}
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
                        <XIcon size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Clinical Notes Card */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.125rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <label
                htmlFor="odontogramNotesDiagnostics"
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  color: 'var(--text-heading)',
                  marginBottom: '0.5rem',
                  display: 'block',
                }}
              >
                {t('odontogram.clinicalNotes', { defaultValue: 'Odontogram / Clinical Notes' })}
              </label>
              <textarea
                id="odontogramNotesDiagnostics"
                className="form-input"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('odontogram.notesPlaceholder', {
                  defaultValue: 'Optional notes regarding teeth condition, prosthetic specifications, or clinical findings...',
                })}
                style={{
                  flex: 1,
                  resize: 'vertical',
                  fontSize: '0.8438rem',
                  padding: '0.625rem',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: TREATMENT PLAN ──────────────────────────── */}
      {activeTab === 'TREATMENT_PLAN' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Instructional Banner & Treatment Palette */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.125rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <p style={{ margin: 0, fontSize: '0.8438rem', color: 'var(--text-secondary)' }}>
              {t('odontogram.treatmentInstruction', {
                defaultValue: 'Click a tooth block to add clinical treatments. The treatment color is applied to the selected block. Saved treatments appear in ZONA POSTERIOR or ZONA ANTERIOR.',
              })}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              {/* Clear Button */}
              <button
                type="button"
                onClick={() => {
                  setIsTreatmentEraserActive(true);
                  setSelectedTreatmentTool(null);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: isTreatmentEraserActive ? '1.5px solid #EF4444' : '1px solid var(--border)',
                  backgroundColor: isTreatmentEraserActive ? '#FEF2F2' : 'var(--bg-card)',
                  color: isTreatmentEraserActive ? '#DC2626' : 'var(--text-primary)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: isTreatmentEraserActive ? '0 0 0 1px #EF4444' : 'none',
                  transition: 'all 0.15s ease',
                }}
                title={t('odontogram.eraserHelp')}
              >
                <Eraser size={14} style={{ color: isTreatmentEraserActive ? '#DC2626' : 'var(--text-muted)' }} />
                <span>{t('odontogram.clear', { defaultValue: 'Clear' })}</span>
              </button>

              {/* Treatment Palette Items */}
              {treatments.length === 0 ? (
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {t('odontogram.noTreatmentsConfigured')}
                </span>
              ) : (
                treatments.map((tr) => {
                  const isSelected = !isTreatmentEraserActive && selectedTreatmentTool?.id === tr.id;
                  return (
                    <button
                      key={tr.id}
                      type="button"
                      onClick={() => {
                        setIsTreatmentEraserActive(false);
                        setSelectedTreatmentTool(tr);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '6px 14px',
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
                          width: '12px',
                          height: '12px',
                          borderRadius: '3px',
                          backgroundColor: tr.color,
                          boxShadow: '0 0 0 1px rgba(0,0,0,0.1)',
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
                        >
                          {t('odontogram.wholeBadge', { defaultValue: 'Whole' })}
                        </span>
                      )}
                      {isSelected && <Check size={14} style={{ color: tr.color }} />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Full Treatment Teeth Chart — Fully unclipped and visible! */}
          {renderTeethChart(treatmentTeethData, handleTreatmentPartClick)}

          {/* ─── 8 SEPARATE QUADRANTS: ZONA POSTERIOR & ZONA ANTERIOR ─── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {/* LEFT CONTAINER: ZONA POSTERIOR */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 800,
                  color: '#C2410C',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>{t('odontogram.posteriorZone', { defaultValue: 'ZONA POSTERIOR' })}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Q1 · Q2 · Q3 · Q4
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {renderQuadrantBox('POSTERIOR', 'Q1')}
                {renderQuadrantBox('POSTERIOR', 'Q2', '#2563EB')}
                {renderQuadrantBox('POSTERIOR', 'Q3')}
                {renderQuadrantBox('POSTERIOR', 'Q4', '#2563EB')}
              </div>
            </div>

            {/* RIGHT CONTAINER: ZONA ANTERIOR */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 800,
                  color: '#C2410C',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>{t('odontogram.anteriorZone', { defaultValue: 'ZONA ANTERIOR' })}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Q1 · Q2 · Q3 · Q4
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {renderQuadrantBox('ANTERIOR', 'Q1')}
                {renderQuadrantBox('ANTERIOR', 'Q2', '#DB2777')}
                {renderQuadrantBox('ANTERIOR', 'Q3')}
                {renderQuadrantBox('ANTERIOR', 'Q4', '#DB2777')}
              </div>
            </div>
          </div>

          {/* Notes Card for Treatment Plan */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.125rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label
                htmlFor="odontogramNotesTreatments"
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  color: 'var(--text-heading)',
                  margin: 0,
                }}
              >
                {t('odontogram.clinicalNotes', { defaultValue: 'Odontogram / Clinical Notes' })}
              </label>
              {treatmentFindingsList.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllTreatments}
                  style={{
                    fontSize: '0.75rem',
                    color: '#EF4444',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 600,
                  }}
                >
                  <Trash2 size={13} />
                  <span>{t('odontogram.clearAll', { defaultValue: 'Clear All Treatments' })}</span>
                </button>
              )}
            </div>
            <textarea
              id="odontogramNotesTreatments"
              className="form-input"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('odontogram.notesPlaceholder', {
                defaultValue: 'Optional notes regarding teeth condition, prosthetic specifications, or clinical findings...',
              })}
              style={{
                flex: 1,
                resize: 'vertical',
                fontSize: '0.8438rem',
                padding: '0.625rem',
              }}
            />
          </div>
        </div>
      )}

      {/* ─── 5. BOTTOM ACTION BAR ──────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem 1.5rem',
          boxShadow: 'var(--shadow-sm)',
          marginTop: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          <span>
            <strong style={{ color: 'var(--text-heading)', fontSize: '1rem' }}>
              {activeTab === 'DIAGNOSTICS' ? diagnosticTeethCount : treatmentTeethCount}
            </strong>{' '}
            {t('odontogram.teethMarked', { defaultValue: 'teeth marked' })}
          </span>
          <span style={{ color: 'var(--border)' }}>•</span>
          <span style={{ fontSize: '0.7813rem' }}>
            {t('odontogram.shortcutHint', { defaultValue: 'Tip: Press Ctrl+S to quickly save' })}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => navigate('/work-orders')}
            disabled={saving}
          >
            {t('common.cancel', { defaultValue: 'Back to Work Orders' })}
          </button>

          <button
            type="button"
            className="btn btn--primary"
            onClick={handleSave}
            disabled={saving || loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', minWidth: '160px', justifyContent: 'center' }}
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

      {/* ─── 6. FLOATING DENTAL TOOLTIP (Matching Sidebar Menu Style) ─── */}
      {hoveredToothInfo && hoveredToothInfo.rect && typeof document !== 'undefined' && createPortal(
        (() => {
          const { toothNumber, part, rect } = hoveredToothInfo;
          const isAbove = rect.top > 70;
          const topPos = isAbove ? rect.top - 8 : rect.bottom + 8;
          const leftPos = Math.max(90, Math.min(window.innerWidth - 90, rect.left + rect.width / 2));
          const surfaceName = getSurfaceDisplayName(toothNumber, part, i18n.language);

          const activeData = activeTab === 'DIAGNOSTICS' ? diagnosticTeethData : treatmentTeethData;
          const toothMap = activeData[String(toothNumber)];
          const finding = toothMap
            ? (part === 'whole' ? toothMap.whole : (toothMap[part] || toothMap.whole))
            : undefined;

          return (
            <div
              style={{
                position: 'fixed',
                top: `${topPos}px`,
                left: `${leftPos}px`,
                transform: isAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
                backgroundColor: '#0F172A',
                color: '#F8FAFC',
                padding: '0.375rem 0.6875rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.35), 0 4px 6px -4px rgba(0, 0, 0, 0.35)',
                zIndex: 99999,
                border: '1px solid rgba(255, 255, 255, 0.12)',
                pointerEvents: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                lineHeight: 1.3,
                transition: 'top 0.08s ease, left 0.08s ease',
              }}
            >
              <span style={{ color: '#93C5FD', fontWeight: 800 }}>
                {t('odontogram.tooth', { defaultValue: 'Tooth' })} {toothNumber}
              </span>
              <span style={{ color: 'rgba(255, 255, 255, 0.35)' }}>•</span>
              <span style={{ color: '#F1F5F9', fontWeight: 500 }}>
                {surfaceName}
              </span>
              {finding && (
                <>
                  <span style={{ color: 'rgba(255, 255, 255, 0.35)' }}>•</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#FFFFFF', fontWeight: 700 }}>
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '2px',
                        backgroundColor: finding.color,
                        boxShadow: '0 0 0 1px rgba(255,255,255,0.4)',
                        display: 'inline-block',
                      }}
                    />
                    {finding.name}
                  </span>
                </>
              )}
              {/* Pointer Arrow */}
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  ...(isAbove
                    ? {
                        bottom: '-5px',
                        borderLeft: '5px solid transparent',
                        borderRight: '5px solid transparent',
                        borderTop: '5px solid #0F172A',
                      }
                    : {
                        top: '-5px',
                        borderLeft: '5px solid transparent',
                        borderRight: '5px solid transparent',
                        borderBottom: '5px solid #0F172A',
                      }),
                  width: 0,
                  height: 0,
                }}
              />
            </div>
          );
        })(),
        document.body
      )}
    </div>
  );
};

// Internal icon helper
function XIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}

