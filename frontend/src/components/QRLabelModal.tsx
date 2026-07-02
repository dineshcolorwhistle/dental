import { QRCodeSVG } from 'qrcode.react';
import { X } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface QRLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: {
    folioNumber: string;
    patient: string;
    doctor?: { name: string } | null;
    qrToken: string;
  } | null;
}

export function QRLabelModal({ isOpen, onClose, workOrder }: QRLabelModalProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen) {
      // Add a class to body when open for custom styles
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

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal"
        style={{ maxWidth: '420px', width: '90%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal__header" style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
          <h3 className="modal__title" style={{ margin: 0 }}>{t('workOrders.printQR')}</h3>
          <button
            className="modal__close"
            onClick={onClose}
            aria-label={t('common.close')}
            style={{ top: '1.25rem', right: '1.25rem' }}
          >
            <X size={18} />
          </button>
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
              color: '#000000', // Always black text for printing
              fontFamily: 'system-ui, -apple-system, sans-serif',
              textAlign: 'center',
            }}
          >
            {/* Header Folio */}
            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                letterSpacing: '0.03em',
                marginBottom: '1rem',
                borderBottom: '1px dashed #cccccc',
                width: '100%',
                paddingBottom: '0.5rem',
              }}
            >
              WO #{workOrder.folioNumber}
            </div>

            {/* General Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#666666', fontWeight: 500 }}>{t('workOrders.patientName')}</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#000000' }}>{workOrder.patient}</div>
            </div>

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

        {/* Modal Footer / Print Action */}
        <div
          className="modal__footer"
          style={{
            padding: '1rem 1.25rem',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
          }}
        >
          <button className="btn btn--outline" onClick={onClose}>
            {t('common.cancel')}
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
