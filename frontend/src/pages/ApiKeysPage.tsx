import { useState, useEffect, useCallback } from 'react';
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Shield,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { apiKeyService, type ApiKeyItem } from '../services';

export function ApiKeysPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const canDelete = user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN';

  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<ApiKeyItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [revealedKeyId, setRevealedKeyId] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiKeyService.getAll();
      setApiKeys(data);
    } catch {
      toast.error(t('apiKeys.fetchError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    try {
      setSaving(true);
      const created = await apiKeyService.create({ name: newKeyName.trim() });
      toast.success(t('apiKeys.createSuccess'));
      setApiKeys((prev) => [created, ...prev.filter((k) => k.id !== created.id && !k.isActive), ...prev.filter((k) => k.id !== created.id && k.isActive)]);
      // Re-fetch to get correct active/inactive state
      await fetchKeys();
      setShowCreateModal(false);
      setNewKeyName('');
      // Auto-reveal the new key so the user can copy it
      setRevealedKeyId(created.id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('apiKeys.createError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOpen = (key: ApiKeyItem) => {
    setKeyToDelete(key);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!keyToDelete) return;
    try {
      setDeleting(true);
      await apiKeyService.delete(keyToDelete.id);
      toast.success(t('apiKeys.deleteSuccess'));
      setApiKeys((prev) => prev.filter((k) => k.id !== keyToDelete.id));
      setShowDeleteModal(false);
      setKeyToDelete(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('apiKeys.deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyKey = async (key: string, id: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKeyId(id);
      toast.success(t('apiKeys.keyCopied'));
      setTimeout(() => setCopiedKeyId(null), 2000);
    } catch {
      toast.error(t('apiKeys.copyError'));
    }
  };

  const maskKey = (key: string) => {
    if (key.length <= 12) return '•'.repeat(key.length);
    return key.slice(0, 8) + '•'.repeat(key.length - 12) + key.slice(-4);
  };

  const activeKey = apiKeys.find((k) => k.isActive);
  const inactiveKeys = apiKeys.filter((k) => !k.isActive);

  return (
    <div className="admins-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-header__title">{t('apiKeys.title')}</h1>
          <p className="page-header__subtitle">{t('apiKeys.subtitle')}</p>
        </div>
        <button
          id="btn-generate-api-key"
          className="btn btn--primary"
          onClick={() => { setNewKeyName(''); setShowCreateModal(true); }}
        >
          <Plus size={18} />
          <span>{t('apiKeys.generateKey')}</span>
        </button>
      </div>

      {/* Info Banner */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '1rem 1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'flex-start',
      }}>
        <Shield size={20} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-body)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text-primary)' }}>{t('apiKeys.infoTitle')}</strong>
          <br />
          {t('apiKeys.infoDescription')}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
          <Loader2 size={32} className="spinner" style={{ color: 'var(--accent-primary)' }} />
        </div>
      )}

      {/* No Keys State */}
      {!loading && apiKeys.length === 0 && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '3rem 2rem',
          textAlign: 'center',
        }}>
          <Key size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
          <h3 style={{ color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>{t('apiKeys.noKeys')}</h3>
          <p style={{ color: 'var(--text-muted)', margin: '0 0 1.5rem', fontSize: '0.875rem' }}>
            {t('apiKeys.noKeysDescription')}
          </p>
          <button
            className="btn btn--primary"
            onClick={() => { setNewKeyName(''); setShowCreateModal(true); }}
          >
            <Plus size={18} />
            <span>{t('apiKeys.generateKey')}</span>
          </button>
        </div>
      )}

      {/* Active Key Card */}
      {!loading && activeKey && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--success)',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--success), #34D399)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Key size={20} style={{ color: '#fff' }} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>{activeKey.name}</h3>
                <span style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: 'var(--success)',
                  marginTop: '4px',
                }}>
                  {t('common.active')}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn--ghost"
                style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                onClick={() => setRevealedKeyId(revealedKeyId === activeKey.id ? null : activeKey.id)}
                title={revealedKeyId === activeKey.id ? t('apiKeys.hideKey') : t('apiKeys.showKey')}
              >
                {revealedKeyId === activeKey.id ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                className="btn btn--ghost"
                style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                onClick={() => handleCopyKey(activeKey.key, activeKey.id)}
                title={t('apiKeys.copyKey')}
              >
                {copiedKeyId === activeKey.id ? <Check size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
              </button>
              {canDelete && (
                <button
                  className="btn btn--ghost"
                  style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem', color: 'var(--danger)' }}
                  onClick={() => handleDeleteOpen(activeKey)}
                  title={t('common.delete')}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Key Value */}
          <div style={{
            background: 'var(--bg-elevated)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            fontFamily: 'monospace',
            fontSize: '0.8125rem',
            color: 'var(--text-primary)',
            wordBreak: 'break-all',
            border: '1px solid var(--border)',
          }}>
            {revealedKeyId === activeKey.id ? activeKey.key : maskKey(activeKey.key)}
          </div>

          {/* Created Date */}
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {t('apiKeys.createdOn')}{' '}
            {new Date(activeKey.createdAt).toLocaleDateString(
              i18n.language?.startsWith('es') ? 'es-MX' : 'en-US',
              { day: 'numeric', month: 'long', year: 'numeric' },
            )}
          </p>
        </div>
      )}

      {/* Inactive Keys */}
      {!loading && inactiveKeys.length > 0 && (
        <div>
          <h3 style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 600 }}>
            {t('apiKeys.previousKeys')} ({inactiveKeys.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {inactiveKeys.map((k) => (
              <div
                key={k.id}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '1rem 1.25rem',
                  opacity: 0.7,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Key size={18} style={{ color: 'var(--text-muted)' }} />
                  <div>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>{k.name}</span>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: 'var(--danger)',
                      marginLeft: '0.5rem',
                    }}>
                      {t('common.inactive')}
                    </span>
                    <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {t('apiKeys.createdOn')}{' '}
                      {new Date(k.createdAt).toLocaleDateString(
                        i18n.language?.startsWith('es') ? 'es-MX' : 'en-US',
                        { day: 'numeric', month: 'long', year: 'numeric' },
                      )}
                    </p>
                  </div>
                </div>
                {canDelete && (
                  <button
                    className="btn btn--ghost"
                    style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem', color: 'var(--danger)' }}
                    onClick={() => handleDeleteOpen(k)}
                    title={t('common.delete')}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">{t('apiKeys.generateKey')}</h2>
                <p className="modal__subtitle">{t('apiKeys.generateKeySubtitle')}</p>
              </div>
              <button
                className="modal__close"
                onClick={() => !saving && setShowCreateModal(false)}
                aria-label={t('common.close')}
              >
                <X size={20} />
              </button>
            </div>

            <form className="modal__body" onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label" htmlFor="input-api-key-name">
                  {t('apiKeys.keyName')} *
                </label>
                <input
                  id="input-api-key-name"
                  type="text"
                  className="form-input"
                  placeholder={t('apiKeys.keyNamePlaceholder')}
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  required
                  maxLength={100}
                  autoFocus
                />
              </div>

              {/* Warning about replacing active key */}
              {activeKey && (
                <div style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'flex-start',
                  marginTop: '0.5rem',
                }}>
                  <AlertTriangle size={18} style={{ color: '#F59E0B', flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-body)', lineHeight: 1.5 }}>
                    {t('apiKeys.replaceWarning')}
                  </span>
                </div>
              )}

              <div className="modal__footer">
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
                  disabled={saving || !newKeyName.trim()}
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="spinner" />
                      <span>{t('common.creating')}</span>
                    </>
                  ) : (
                    <>
                      <Key size={16} />
                      <span>{t('apiKeys.generateKey')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && keyToDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setShowDeleteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">{t('common.delete')}</h2>
              </div>
              <button
                className="modal__close"
                onClick={() => !deleting && setShowDeleteModal(false)}
                aria-label={t('common.close')}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal__body" style={{ padding: '1rem 1.75rem' }}>
              <p style={{ margin: 0, color: 'var(--text-body)' }}>
                {t('apiKeys.deleteConfirm', { name: keyToDelete.name })}
              </p>
            </div>

            <div className="modal__footer" style={{ padding: '1rem 1.75rem' }}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                style={{ backgroundColor: 'var(--danger)' }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <Loader2 size={16} className="spinner" />
                    <span>{t('common.saving')}</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>{t('common.delete')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
