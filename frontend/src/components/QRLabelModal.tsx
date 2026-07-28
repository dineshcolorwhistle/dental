import { QRCodeSVG } from 'qrcode.react';
import { X, Printer, Download } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context';

interface QRLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: {
    folioNumber: string;
    boxNumber?: string | null;
    patient?: string | null;
    doctor?: { name: string } | null;
    qrToken: string;
  } | null;
}

export function QRLabelModal({ isOpen, onClose, workOrder }: QRLabelModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('qr-modal-open');
    } else {
      document.body.classList.remove('qr-modal-open');
    }
    return () => {
      document.body.classList.remove('qr-modal-open');
    };
  }, [isOpen]);

  if (!isOpen || !workOrder) return null;

  const qrValue = `${window.location.origin}/qr/${workOrder.qrToken}`;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const labelContainer = document.getElementById('printable-qr-label');
    const svgElement = labelContainer?.querySelector('svg');
    if (!svgElement || !workOrder) return;

    // Convert SVG to data URL
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const hasBox = Boolean(workOrder.boxNumber);
      const canvasWidth = 400;
      const canvasHeight = hasBox ? 440 : 410;
      const scale = 2;

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth * scale;
      canvas.height = canvasHeight * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.scale(scale, scale);

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Outer border
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(12, 12, canvasWidth - 24, canvasHeight - 24);

      // Title - Line 1: WO Folio
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`WO #${workOrder.folioNumber}`, canvasWidth / 2, 48);

      let currentY = 48;

      // Line 2: Box Number (if present)
      if (hasBox) {
        currentY += 28;
        ctx.fillStyle = '#D97706';
        ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
        const boxText = `(${t('workOrders.boxNumber', { defaultValue: 'Box' })}: ${workOrder.boxNumber})`;
        ctx.fillText(boxText, canvasWidth / 2, currentY);
      }

      // Divider line
      currentY += 16;
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(30, currentY);
      ctx.lineTo(canvasWidth - 30, currentY);
      ctx.stroke();

      // Doctor Info
      currentY += 26;
      ctx.fillStyle = '#666666';
      ctx.font = '500 14px system-ui, -apple-system, sans-serif';
      ctx.fillText(t('doctors.doctorName'), canvasWidth / 2, currentY);

      currentY += 22;
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
      ctx.fillText(workOrder.doctor?.name || '—', canvasWidth / 2, currentY);

      // QR Image container & graphic
      currentY += 18;
      const qrBoxSize = 210;
      const qrBoxX = (canvasWidth - qrBoxSize) / 2;

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(qrBoxX, currentY, qrBoxSize, qrBoxSize);
      ctx.drawImage(img, qrBoxX + 10, currentY + 10, qrBoxSize - 20, qrBoxSize - 20);

      URL.revokeObjectURL(url);

      // Trigger PNG download
      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `WO-${workOrder.folioNumber}-QR.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };
    img.src = url;
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal"
        style={{ maxWidth: '420px', width: '90%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className="modal__header"
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3 className="modal__title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
            {t('workOrders.qrCode')}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isAdmin && (
              <>
                {/* Professional Download Icon Button */}
                <button
                  type="button"
                  className="modal__icon-btn"
                  onClick={handleDownload}
                  data-tooltip-bottom={t('workOrders.downloadQR', { defaultValue: 'Download PNG' })}
                  aria-label={t('workOrders.downloadQR', { defaultValue: 'Download PNG' })}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    padding: '0',
                    borderRadius: '8px',
                    border: '1px solid var(--border, #e2e8f0)',
                    backgroundColor: 'var(--bg-surface, #ffffff)',
                    color: 'var(--text-secondary, #475569)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--primary-light, #f0f9ff)';
                    e.currentTarget.style.color = 'var(--primary, #0284c7)';
                    e.currentTarget.style.borderColor = 'var(--primary, #0284c7)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface, #ffffff)';
                    e.currentTarget.style.color = 'var(--text-secondary, #475569)';
                    e.currentTarget.style.borderColor = 'var(--border, #e2e8f0)';
                  }}
                >
                  <Download size={18} />
                </button>

                {/* Professional Print Icon Button */}
                <button
                  type="button"
                  className="modal__icon-btn"
                  onClick={handlePrint}
                  data-tooltip-bottom={t('workOrders.printQR', { defaultValue: 'Print QR Label' })}
                  aria-label={t('workOrders.printQR', { defaultValue: 'Print QR Label' })}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    padding: '0',
                    borderRadius: '8px',
                    border: '1px solid var(--border, #e2e8f0)',
                    backgroundColor: 'var(--bg-surface, #ffffff)',
                    color: 'var(--text-secondary, #475569)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--primary-light, #f0f9ff)';
                    e.currentTarget.style.color = 'var(--primary, #0284c7)';
                    e.currentTarget.style.borderColor = 'var(--primary, #0284c7)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface, #ffffff)';
                    e.currentTarget.style.color = 'var(--text-secondary, #475569)';
                    e.currentTarget.style.borderColor = 'var(--border, #e2e8f0)';
                  }}
                >
                  <Printer size={18} />
                </button>
              </>
            )}

            {/* Modal Close Button */}
            <button
              type="button"
              className="modal__close"
              onClick={onClose}
              data-tooltip-bottom={t('common.close')}
              aria-label={t('common.close')}
              style={{
                position: 'static',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                padding: '0',
                borderRadius: '8px',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body / Label Preview */}
        <div
          className="modal__body"
          style={{
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            backgroundColor: 'var(--bg-overlay, #f8fafc)',
            gap: '1.5rem',
          }}
        >
          {/* Printable Label Wrapper */}
          <div
            id="printable-qr-label"
            className="printable-label"
            style={{
              width: '100%',
              maxWidth: '280px',
              backgroundColor: '#ffffff',
              border: '2px solid #000000',
              borderRadius: '8px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              boxShadow: 'var(--shadow-md)',
              color: '#000000',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              textAlign: 'center',
            }}
          >
            {/* Header Folio & Box Number (Two line layout) */}
            <div
              style={{
                width: '100%',
                marginBottom: '1rem',
                borderBottom: '1px dashed #cccccc',
                paddingBottom: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <div
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 800,
                  letterSpacing: '0.03em',
                  color: '#000000',
                }}
              >
                WO #{workOrder.folioNumber}
              </div>
              {workOrder.boxNumber && (
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#D97706' }}>
                  ({t('workOrders.boxNumber', { defaultValue: 'Box' })}: {workOrder.boxNumber})
                </div>
              )}
            </div>

            {/* Doctor Info (Patient Name Removed) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#666666', fontWeight: 500 }}>{t('doctors.doctorName')}</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#000000' }}>
                {workOrder.doctor?.name || '—'}
              </div>
            </div>

            {/* QR Code Graphic */}
            <div
              style={{
                padding: '0.75rem',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                display: 'inline-flex',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              <QRCodeSVG value={qrValue} size={150} level="H" includeMargin={true} />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className="modal__footer"
          style={{
            padding: '0.875rem 1.25rem',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}
        >
          <button className="btn btn--outline" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>

      {/* Global CSS Injector for Printing */}
      <style>{`
        @media print {
          /* Hide everything in the body except the printable label */
          body * {
            visibility: hidden;
          }
          #printable-qr-label, #printable-qr-label * {
            visibility: visible;
          }
          #printable-qr-label {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            box-shadow: none !important;
            border: 2px solid #000000 !important;
            width: 3.5in !important;
            height: auto !important;
            padding: 0.25in !important;
            margin: 0 !important;
          }
          /* Hide headers/footers default browser margins */
          @page {
            size: auto;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}
