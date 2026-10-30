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
  type ToothPartsMap,
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
  void handleClearAllTreatments;

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
          padding: '1.5rem 1rem',
          overflowX: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'inline-flex', flexDirection: 'column', minWidth: '880px', width: '100%', maxWidth: '1020px' }}>
          {/* UPPER ARCH (Maxillary) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {/* Adult Upper Teeth (18–11 | 21–28) */}
            {(viewMode === 'ADULT' || viewMode === 'BOTH') && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end', flex: 1, paddingRight: '0.875rem' }}>
                  {ADULT_UPPER_RIGHT.map((num) => (
                    <ToothSvg
                      key={num}
                      toothNumber={num}
                      partsMap={currentData[String(num)]}
                      onSelectPart={onPartClick}
                      onHoverPart={(tNum, part) => setHoveredToothInfo(part ? { toothNumber: tNum, part } : null)}
                      disabled={saving}
                      size="lg"
                    />
                  ))}
                </div>

                <div style={{ width: '1.5px', height: '62px', backgroundColor: '#CBD5E1' }} />

                <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-start', flex: 1, paddingLeft: '0.875rem' }}>
                  {ADULT_UPPER_LEFT.map((num) => (
                    <ToothSvg
                      key={num}
                      toothNumber={num}
                      partsMap={currentData[String(num)]}
                      onSelectPart={onPartClick}
                      onHoverPart={(tNum, part) => setHoveredToothInfo(part ? { toothNumber: tNum, part } : null)}
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
                <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end', flex: 1, paddingRight: '0.875rem' }}>
                  {CHILD_UPPER_RIGHT.map((num) => (
                    <ToothSvg
                      key={num}
                      toothNumber={num}
                      partsMap={currentData[String(num)]}
                      onSelectPart={onPartClick}
                      onHoverPart={(tNum, part) => setHoveredToothInfo(part ? { toothNumber: tNum, part } : null)}
                      disabled={saving}
                      size="lg"
                    />
                  ))}
                </div>

                <div style={{ width: '1.5px', height: '62px', backgroundColor: '#CBD5E1' }} />

                <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-start', flex: 1, paddingLeft: '0.875rem' }}>
                  {CHILD_UPPER_LEFT.map((num) => (
                    <ToothSvg
                      key={num}
                      toothNumber={num}
                      partsMap={currentData[String(num)]}
                      onSelectPart={onPartClick}
                      onHoverPart={(tNum, part) => setHoveredToothInfo(part ? { toothNumber: tNum, part } : null)}
                      disabled={saving}
                      size="lg"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* DENTAL CROSSHAIR (Horizontal Dividing Line) */}
          <div style={{ width: '100%', height: '1.5px', backgroundColor: '#CBD5E1', margin: '0.5rem 0' }} />

          {/* LOWER ARCH (Mandibular) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {/* Child Lower Teeth (85–81 | 71–75) */}
            {(viewMode === 'CHILD' || viewMode === 'BOTH') && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end', flex: 1, paddingRight: '0.875rem' }}>
                  {CHILD_LOWER_RIGHT.map((num) => (
                    <ToothSvg
                      key={num}
                      toothNumber={num}
                      partsMap={currentData[String(num)]}
                      onSelectPart={onPartClick}
                      onHoverPart={(tNum, part) => setHoveredToothInfo(part ? { toothNumber: tNum, part } : null)}
                      disabled={saving}
                      size="lg"
                    />
                  ))}
                </div>

                <div style={{ width: '1.5px', height: '62px', backgroundColor: '#CBD5E1' }} />

                <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-start', flex: 1, paddingLeft: '0.875rem' }}>
                  {CHILD_LOWER_LEFT.map((num) => (
                    <ToothSvg
                      key={num}
                      toothNumber={num}
                      partsMap={currentData[String(num)]}
                      onSelectPart={onPartClick}
                      onHoverPart={(tNum, part) => setHoveredToothInfo(part ? { toothNumber: tNum, part } : null)}
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
                <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end', flex: 1, paddingRight: '0.875rem' }}>
                  {ADULT_LOWER_RIGHT.map((num) => (
                    <ToothSvg
                      key={num}
                      toothNumber={num}
                      partsMap={currentData[String(num)]}
                      onSelectPart={onPartClick}
                      onHoverPart={(tNum, part) => setHoveredToothInfo(part ? { toothNumber: tNum, part } : null)}
                      disabled={saving}
                      size="lg"
                    />
                  ))}
                </div>

                <div style={{ width: '1.5px', height: '62px', backgroundColor: '#CBD5E1' }} />

                <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-start', flex: 1, paddingLeft: '0.875rem' }}>
                  {ADULT_LOWER_LEFT.map((num) => (
                    <ToothSvg
                      key={num}
                      toothNumber={num}
                      partsMap={currentData[String(num)]}
                      onSelectPart={onPartClick}
                      onHoverPart={(tNum, part) => setHoveredToothInfo(part ? { toothNumber: tNum, part } : null)}
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
          borderLeft: accentBorderColor ? `3px solid ${accentBorderColor}` : '1px solid #E2E8F0',
          borderRadius: '8px',
          padding: '0.625rem 0.75rem',
          minHeight: '115px',
          maxHeight: '145px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: '#475569',
              backgroundColor: '#F1F5F9',
              borderRadius: '4px',
              padding: '2px 6px',
              letterSpacing: '0.02em',
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          {items.map((item, idx) => (
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
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '1220px',
          width: '96vw',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ─── 1. MODAL HEADER (Kept as requested) ───────────── */}
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

        {/* ─── 2. SEPARATE TABS HEADER ──────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem 0 1.25rem',
            borderBottom: '1px solid var(--border)',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <button
            type="button"
            className={`btn ${activeTab === 'DIAGNOSTICS' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setActiveTab('DIAGNOSTICS')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
              padding: '0.5rem 1rem',
            }}
          >
            <Activity size={16} />
            <span>{t('odontogramSettings.tabs.diagnostics', { defaultValue: 'Diagnostics' })}</span>
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
              {diagnosticTeethCount}
            </span>
          </button>

          <button
            type="button"
            className={`btn ${activeTab === 'TREATMENT_PLAN' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setActiveTab('TREATMENT_PLAN')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
              padding: '0.5rem 1rem',
            }}
          >
            <Layers size={16} />
            <span>{t('odontogram.treatmentPlan', { defaultValue: 'Treatment Plan' })}</span>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: '100px',
                backgroundColor: activeTab === 'TREATMENT_PLAN' ? 'rgba(255, 255, 255, 0.25)' : 'var(--bg-overlay)',
                color: activeTab === 'TREATMENT_PLAN' ? '#fff' : 'var(--text-muted)',
              }}
            >
              {treatmentTeethCount}
            </span>
          </button>
        </div>

        {/* ─── MODAL BODY ───────────────────────────────────── */}
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
              {/* ═════════════════════════════════════════════════ */}
              {/* TAB 1: DIAGNOSTICS TAB (Matches Ref Image 4)      */}
              {/* ═════════════════════════════════════════════════ */}
              {activeTab === 'DIAGNOSTICS' && (
                <>
                  {/* Instructional Banner & Diagnostics Palette */}
                  <div
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {t('odontogram.diagnosticsInstruction', {
                        defaultValue: 'Click a tooth block to mark its condition (Healthy, Damaged, Filling, Missing, Crown, or Implant). Filling and Crown apply to the whole tooth.',
                      })}
                    </p>

                    {/* Palette Bar */}
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
                          padding: '5px 12px',
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

                      {/* Diagnostic Items */}
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
                                padding: '5px 12px',
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
                              {isSelected && <Check size={13} style={{ color: d.color }} />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Diagnostics Teeth Chart (Large) */}
                  {renderTeethChart(diagnosticTeethData, handleDiagnosticPartClick)}

                  {/* Active Tool / Hover Strip */}
                  {hoveredToothInfo && hoveredToothInfo.part && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--accent-primary)', fontWeight: 600, fontSize: '0.8125rem' }}>
                      <Info size={14} />
                      <span>
                        {t('odontogram.tooth', { defaultValue: 'Tooth' })} {hoveredToothInfo.toothNumber} —{' '}
                        {getSurfaceDisplayName(hoveredToothInfo.toothNumber, hoveredToothInfo.part, i18n.language)}
                      </span>
                    </div>
                  )}

                  {/* Bottom: Applied Findings & Clinical Notes */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
                    {/* Findings Summary */}
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
                            }}
                          >
                            <Trash2 size={12} />
                            <span>{t('odontogram.clearAll', { defaultValue: 'Clear All' })}</span>
                          </button>
                        )}
                      </div>

                      {diagnosticFindingsList.length === 0 ? (
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                          {t('odontogram.noMarkingsYet')}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', maxHeight: '115px', overflowY: 'auto' }}>
                          {diagnosticFindingsList.map((item, idx) => (
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
                                  borderRadius: '2px',
                                  backgroundColor: item.finding.color,
                                }}
                              />
                              <span style={{ fontWeight: 700, color: 'var(--text-heading)' }}>
                                T{item.toothNumber}
                              </span>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                [{item.part === 'whole' ? t('odontogram.wholeBadge') : getSurfaceDisplayName(Number(item.toothNumber), item.part, i18n.language)}]:
                              </span>
                              <span style={{ fontWeight: 600 }}>{item.finding.name}</span>
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
                        htmlFor="odontogramNotesDiagnostics"
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
                        id="odontogramNotesDiagnostics"
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

              {/* ═════════════════════════════════════════════════ */}
              {/* TAB 2: TREATMENT PLAN (Matches Ref Images 2 & 3)   */}
              {/* ═════════════════════════════════════════════════ */}
              {activeTab === 'TREATMENT_PLAN' && (
                <>
                  {/* Instructional Banner & Treatment Palette */}
                  <div
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {t('odontogram.treatmentInstruction', {
                        defaultValue: 'Click a tooth block to add clinical treatments. The treatment color is applied to the selected block. Saved treatments appear in ZONA POSTERIOR or ZONA ANTERIOR.',
                      })}
                    </p>

                    {/* Palette Bar */}
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
                          padding: '5px 12px',
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

                      {/* Treatment Items */}
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
                                padding: '5px 12px',
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
                              {isSelected && <Check size={13} style={{ color: tr.color }} />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Treatment Teeth Chart (Large) */}
                  {renderTeethChart(treatmentTeethData, handleTreatmentPartClick)}

                  {/* Active Tool / Hover Strip */}
                  {hoveredToothInfo && hoveredToothInfo.part && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--accent-primary)', fontWeight: 600, fontSize: '0.8125rem' }}>
                      <Info size={14} />
                      <span>
                        {t('odontogram.tooth', { defaultValue: 'Tooth' })} {hoveredToothInfo.toothNumber} —{' '}
                        {getSurfaceDisplayName(hoveredToothInfo.toothNumber, hoveredToothInfo.part, i18n.language)}
                      </span>
                    </div>
                  )}

                  {/* ─── 8 SEPARATE QUADRANTS (Image 2) ─────── */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                      gap: '1.25rem',
                    }}
                  >
                    {/* LEFT CONTAINER: ZONA POSTERIOR */}
                    <div
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '1rem',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.8438rem',
                          fontWeight: 800,
                          color: '#C2410C',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          marginBottom: '0.75rem',
                        }}
                      >
                        {t('odontogram.posteriorZone', { defaultValue: 'ZONA POSTERIOR' })}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
                        {/* Q1 */}
                        {renderQuadrantBox('POSTERIOR', 'Q1')}
                        {/* Q2 (with blue left accent border) */}
                        {renderQuadrantBox('POSTERIOR', 'Q2', '#2563EB')}
                        {/* Q3 */}
                        {renderQuadrantBox('POSTERIOR', 'Q3')}
                        {/* Q4 (with blue left accent border) */}
                        {renderQuadrantBox('POSTERIOR', 'Q4', '#2563EB')}
                      </div>
                    </div>

                    {/* RIGHT CONTAINER: ZONA ANTERIOR */}
                    <div
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '1rem',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.8438rem',
                          fontWeight: 800,
                          color: '#C2410C',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          marginBottom: '0.75rem',
                        }}
                      >
                        {t('odontogram.anteriorZone', { defaultValue: 'ZONA ANTERIOR' })}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
                        {/* Q1 */}
                        {renderQuadrantBox('ANTERIOR', 'Q1')}
                        {/* Q2 (with magenta left accent border) */}
                        {renderQuadrantBox('ANTERIOR', 'Q2', '#DB2777')}
                        {/* Q3 */}
                        {renderQuadrantBox('ANTERIOR', 'Q3')}
                        {/* Q4 (with magenta left accent border) */}
                        {renderQuadrantBox('ANTERIOR', 'Q4', '#DB2777')}
                      </div>
                    </div>
                  </div>

                  {/* Notes Input for Treatment Plan */}
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
                      htmlFor="odontogramNotesTreatments"
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
                      id="odontogramNotesTreatments"
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
                </>
              )}
            </>
          )}
        </div>

        {/* ─── MODAL FOOTER ─────────────────────────────────── */}
        <div className="modal__footer" style={{ justifyContent: 'space-between', padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            <span>
              <strong>{activeTab === 'DIAGNOSTICS' ? diagnosticTeethCount : treatmentTeethCount}</strong>{' '}
              {t('odontogram.teethMarked', { defaultValue: 'teeth marked' })}
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
