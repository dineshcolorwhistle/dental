import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Plus, Save, X, Trash2, Edit2, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  whatsappTemplateService,
  WhatsAppTemplate,
  WhatsAppTemplateStatus,
} from '../services/whatsapp-template.service';

const ALLOWED_PLACEHOLDERS = [
  'doctor_name',
  'workorder_number',
  'folio_number',
  'boxnumber',
  'verification_link',
];

export function WhatsAppTemplatesPage() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form & View State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null); // null = New Template Mode
  const [name, setName] = useState('');
  const [status, setStatus] = useState<WhatsAppTemplateStatus>('ACTIVE');
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await whatsappTemplateService.getAll();
      const templateList = Array.isArray(data) ? data : [];
      setTemplates(templateList);
      if (templateList.length > 0) {
        selectForEdit(templateList[0]);
      } else {
        startCreateNew();
      }
    } catch (err) {
      console.error(err);
      toast.error(t('whatsappTemplates.loadError', { defaultValue: 'Failed to load WhatsApp templates' }));
    } finally {
      setLoading(false);
    }
  };

  const selectForEdit = (tpl: WhatsAppTemplate) => {
    setSelectedTemplateId(tpl.id);
    setName(tpl.name);
    setStatus(tpl.status);
    setMessage(tpl.message);
  };

  const startCreateNew = () => {
    setSelectedTemplateId(null);
    setName('');
    setStatus('ACTIVE');
    setMessage('');
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleInsertPlaceholder = (ph: string) => {
    const token = `{${ph}}`;
    if (!textareaRef.current) {
      setMessage((prev) => prev + token);
      return;
    }
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const newText = message.substring(0, start) + token + message.substring(end);
    setMessage(newText);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + token.length, start + token.length);
      }
    }, 50);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) {
      toast.error(t('validation.required', { defaultValue: 'Please fill in all required fields' }));
      return;
    }

    setSaving(true);
    try {
      if (selectedTemplateId) {
        // Update existing template
        const updated = await whatsappTemplateService.update(selectedTemplateId, {
          name,
          status,
          message,
          placeholders: ALLOWED_PLACEHOLDERS,
        });

        toast.success(t('whatsappTemplates.saveSuccess', { defaultValue: 'WhatsApp template updated successfully!' }));
        setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        selectForEdit(updated);
      } else {
        // Create new template
        const created = await whatsappTemplateService.create({
          name,
          status,
          message,
          placeholders: ALLOWED_PLACEHOLDERS,
        });

        toast.success(t('whatsappTemplates.createSuccess', { defaultValue: 'WhatsApp template created successfully!' }));
        setTemplates((prev) => [...prev, created]);
        selectForEdit(created);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || t('whatsappTemplates.saveError', { defaultValue: 'Failed to save WhatsApp template' }));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(t('common.confirmDelete', { defaultValue: 'Are you sure you want to delete this template?' }))) {
      return;
    }

    setDeletingId(id);
    try {
      await whatsappTemplateService.delete(id);
      toast.success(t('common.deleteSuccess', { defaultValue: 'Deleted successfully' }));
      const remaining = templates.filter((t) => t.id !== id);
      setTemplates(remaining);
      if (remaining.length > 0) {
        selectForEdit(remaining[0]);
      } else {
        startCreateNew();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || t('common.error', { defaultValue: 'Action failed' }));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '350px' }}>
        <RefreshCw size={24} className="spin-icon" style={{ color: 'var(--primary, #3B82F6)' }} />
        <span style={{ marginLeft: '10px', color: 'var(--text-secondary)' }}>{t('common.loading')}</span>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={24} style={{ color: '#25D366' }} />
            {t('whatsappTemplates.title')}
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {t('whatsappTemplates.subtitle')}
          </p>
        </div>

        <button
          type="button"
          onClick={startCreateNew}
          style={{
            padding: '0.625rem 1.25rem',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: 'var(--primary, #3B82F6)',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
          }}
        >
          <Plus size={18} />
          {t('whatsappTemplates.createTemplate', { defaultValue: 'Create New Template' })}
        </button>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: templates.length > 0 ? '300px 1fr' : '1fr', gap: '1.5rem' }}>
        {/* Sidebar Template List */}
        {templates.length > 0 && (
          <div
            style={{
              backgroundColor: 'var(--card-bg, #ffffff)',
              borderRadius: '12px',
              border: '1px solid var(--border, #e5e7eb)',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              height: 'fit-content',
            }}
          >
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('whatsappTemplates.title')} ({templates.length})
            </h3>

            {templates.map((tpl) => {
              const isSelected = selectedTemplateId === tpl.id;
              return (
                <div
                  key={tpl.id}
                  onClick={() => selectForEdit(tpl)}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'var(--primary-light, #EEF2FF)' : 'transparent',
                    border: isSelected ? '1px solid var(--primary, #4F46E5)' : '1px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: isSelected ? 'var(--primary, #4F46E5)' : 'var(--text-main)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginRight: '6px' }}>
                      {tpl.name}
                    </span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '10px',
                        backgroundColor: tpl.status === 'ACTIVE' ? '#DEF7EC' : '#FDE8E8',
                        color: tpl.status === 'ACTIVE' ? '#03543F' : '#9B1C1C',
                      }}
                    >
                      {t(`whatsappTemplates.${tpl.status === 'ACTIVE' ? 'active' : 'inactive'}`)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                      {tpl.message}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(tpl.id, e)}
                      disabled={deletingId === tpl.id}
                      title={t('common.delete')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#EF4444',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        opacity: deletingId === tpl.id ? 0.5 : 0.8,
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Edit / Create Form Card */}
        <div
          style={{
            backgroundColor: 'var(--card-bg, #ffffff)',
            borderRadius: '12px',
            border: '1px solid var(--border, #e5e7eb)',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          {/* Form Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border, #e5e7eb)' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {selectedTemplateId ? <Edit2 size={18} /> : <Plus size={18} />}
              {selectedTemplateId ? t('whatsappTemplates.editTemplate') : t('whatsappTemplates.createTemplate')}
            </h2>
            {selectedTemplateId && (
              <button
                type="button"
                onClick={startCreateNew}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary, #4F46E5)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Plus size={14} />
                {t('whatsappTemplates.createTemplate')}
              </button>
            )}
          </div>

          <form onSubmit={handleSave}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '1rem', marginBottom: '1.25rem' }}>
              {/* Template Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  {t('whatsappTemplates.templateName')} <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. External Verification Reminder"
                  required
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border, #D1D5DB)',
                    backgroundColor: 'var(--bg-main, #ffffff)',
                    fontSize: '0.875rem',
                    color: 'var(--text-main)',
                  }}
                />
              </div>

              {/* Status */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  {t('whatsappTemplates.status')} <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as WhatsAppTemplateStatus)}
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border, #D1D5DB)',
                    backgroundColor: 'var(--bg-main, #ffffff)',
                    fontSize: '0.875rem',
                    color: 'var(--text-main)',
                  }}
                >
                  <option value="ACTIVE">{t('whatsappTemplates.active')}</option>
                  <option value="INACTIVE">{t('whatsappTemplates.inactive')}</option>
                </select>
              </div>
            </div>

            {/* Message Textarea */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                {t('whatsappTemplates.message')} <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                required
                placeholder="Hello {doctor_name}, work order #{workorder_number} (Folio: {folio_number}, Box: {boxnumber}) requires verification..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border, #D1D5DB)',
                  backgroundColor: 'var(--bg-main, #ffffff)',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  color: 'var(--text-main)',
                  lineHeight: '1.5',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Placeholders Toolbar */}
            <div style={{ marginBottom: '1.75rem', backgroundColor: 'var(--bg-subtle, #F9FAFB)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border, #F3F4F6)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                {t('whatsappTemplates.placeholdersLabel')} <span style={{ fontWeight: 400, fontStyle: 'italic' }}>({t('whatsappTemplates.insertPlaceholderHint')})</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {ALLOWED_PLACEHOLDERS.map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => handleInsertPlaceholder(ph)}
                    style={{
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      padding: '5px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--card-bg, #ffffff)',
                      border: '1px solid var(--border, #D1D5DB)',
                      color: 'var(--primary, #4F46E5)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary, #4F46E5)';
                      e.currentTarget.style.backgroundColor = 'var(--primary-light, #EEF2FF)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border, #D1D5DB)';
                      e.currentTarget.style.backgroundColor = 'var(--card-bg, #ffffff)';
                    }}
                  >
                    {`{${ph}}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Form Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => {
                  if (templates.length > 0 && selectedTemplateId) {
                    const current = templates.find((t) => t.id === selectedTemplateId);
                    if (current) selectForEdit(current);
                  } else {
                    startCreateNew();
                  }
                }}
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border, #D1D5DB)',
                  backgroundColor: '#EF4444',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <X size={16} />
                {t('whatsappTemplates.cancel')}
              </button>

              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'var(--primary, #3B82F6)',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: saving ? 0.7 : 1,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                }}
              >
                {saving ? (
                  <RefreshCw size={16} className="spin-icon" />
                ) : (
                  <Save size={16} />
                )}
                {selectedTemplateId
                  ? t('whatsappTemplates.updateTemplate')
                  : t('whatsappTemplates.createTemplate')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
