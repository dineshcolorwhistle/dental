import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  whatsappTemplateService,
  WhatsAppTemplate,
} from '../services/whatsapp-template.service';

interface SendWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientName: string;
  recipientPhone: string;
  workOrderData?: {
    workOrderId: string;
    folioNumber: string;
    boxNumber?: string | null;
  } | null;
}

export function WhatsAppIcon({
  size = 20,
  className = '',
  style,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12.012 2C6.486 2 2 6.479 2 12c0 2.17.696 4.18 1.88 5.82L2 22l4.33-1.136A9.948 9.948 0 0012.012 22c5.516 0 9.988-4.479 9.988-10S17.528 2 12.012 2zm5.46 12.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347z"
      />
    </svg>
  );
}

export function SendWhatsAppModal({
  isOpen,
  onClose,
  recipientName,
  recipientPhone,
  workOrderData,
}: SendWhatsAppModalProps) {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const interpolateMessage = (tplMessage: string) => {
    if (!tplMessage) return '';
    const folio = workOrderData?.folioNumber || '';
    const box = workOrderData?.boxNumber || 'N/A';
    const link = workOrderData?.workOrderId
      ? `${window.location.origin}/public/work-orders/${workOrderData.workOrderId}`
      : window.location.origin;

    return tplMessage
      .replace(/{doctor_name}/g, recipientName || 'Doctor')
      .replace(/{workorder_number}/g, folio)
      .replace(/{folio_number}/g, folio)
      .replace(/{boxnumber}/g, box)
      .replace(/{verification_link}/g, link);
  };

  useEffect(() => {
    if (!isOpen) return;

    const loadTemplates = async () => {
      setLoading(true);
      try {
        const data = await whatsappTemplateService.getAll();
        const activeTemplates = (Array.isArray(data) ? data : []).filter(
          (t) => t.status === 'ACTIVE'
        );
        setTemplates(activeTemplates);

        if (activeTemplates.length > 0) {
          const firstTpl = activeTemplates[0];
          setSelectedTemplateId(firstTpl.id);
          setCustomMessage(interpolateMessage(firstTpl.message));
        } else {
          setSelectedTemplateId('');
          setCustomMessage('');
        }
      } catch (err) {
        console.error('Failed to load WhatsApp templates', err);
        toast.error(t('whatsappTemplates.loadError'));
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, [isOpen, recipientName, workOrderData]);

  if (!isOpen) return null;

  const handleSelectTemplate = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tplId = e.target.value;
    setSelectedTemplateId(tplId);
    const chosen = templates.find((t) => t.id === tplId);
    if (chosen) {
      setCustomMessage(interpolateMessage(chosen.message));
    }
  };

  const handleSend = () => {
    if (!recipientPhone) {
      toast.error(t('whatsappModal.noPhone', { defaultValue: 'Doctor has no phone number' }));
      return;
    }

    const cleanPhone = recipientPhone.replace(/\D/g, '');
    const encodedText = encodeURIComponent(customMessage);
    const whatsappUrl = `https://api.whatsapp.com/send/?phone=${cleanPhone}&text=${encodedText}`;

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    toast.success(t('whatsappModal.sendSuccess', { defaultValue: 'Opening WhatsApp...' }));
    onClose();
  };

  return (
    <div
      className="modal-overlay animate-fade-in"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="modal-card animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: 'var(--bg-surface, #FFFFFF)',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#25D366',
              }}
            >
              <WhatsAppIcon size={24} />
            </span>
            <h3
              style={{
                margin: 0,
                fontSize: '1.15rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              {t('whatsappModal.title')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="btn btn--ghost"
            style={{
              padding: '6px',
              borderRadius: '8px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Recipient Details */}
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {recipientName || 'Doctor'}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#64748B', marginTop: '2px' }}>
              {recipientPhone || '—'}
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
              <Loader2 className="spinner" size={28} style={{ color: '#25D366' }} />
            </div>
          ) : (
            <>
              {/* Template Select Dropdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  {t('whatsappModal.selectTemplate')}
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={handleSelectTemplate}
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.875rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-input, #FFFFFF)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                >
                  {templates.length === 0 ? (
                    <option value="">{t('whatsappModal.noTemplates')}</option>
                  ) : (
                    templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Message Preview Textarea */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  {t('whatsappModal.messagePreview')}
                </label>
                <textarea
                  rows={5}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.875rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-input, #FFFFFF)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    lineHeight: '1.5',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
                <span
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                    marginTop: '2px',
                  }}
                >
                  {t('whatsappModal.editDisclaimer')}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            backgroundColor: 'var(--bg-surface-secondary, #F8FAFC)',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
          }}
        >
          <button
            type="button"
            className="btn btn--secondary"
            onClick={onClose}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '8px',
              fontWeight: 600,
            }}
          >
            {t('whatsappModal.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !recipientPhone}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '0.5rem 1.25rem',
              borderRadius: '8px',
              backgroundColor: '#10B981',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 600,
              cursor: loading || !recipientPhone ? 'not-allowed' : 'pointer',
              opacity: loading || !recipientPhone ? 0.6 : 1,
              boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)',
            }}
          >
            <WhatsAppIcon size={18} />
            <span>{t('whatsappModal.send')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
