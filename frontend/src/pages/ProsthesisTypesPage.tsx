import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Plus,
  Search,
  X,
  AlertCircle,
  Loader2,
  ArrowUpDown,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { prosthesisTypeService, type ProsthesisTypeListItem, type CreateProsthesisTypePayload } from '../services';

export function ProsthesisTypesPage() {
  const [types, setTypes] = useState<ProsthesisTypeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedType, setSelectedType] = useState<ProsthesisTypeListItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'createdAt'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<ProsthesisTypeListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const [form, setForm] = useState<CreateProsthesisTypePayload>({
    name: '',
    description: '',
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CreateProsthesisTypePayload, string>>>({});

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await prosthesisTypeService.getAll();
      setTypes(data);
    } catch (err) {
      toast.error('Failed to load prosthesis types');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Filtering & Sorting ────────────────────────────

  const filtered = types
    .filter((t) => {
      if (search) {
        const q = search.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'name') return mul * a.name.localeCompare(b.name);
      return mul * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });

  // ─── Form Handling ──────────────────────────────────

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof CreateProsthesisTypePayload, string>> = {};
    if (!form.name.trim()) {
      errors.name = 'Prosthesis name is required';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateOpen = () => {
    setForm({
      name: '',
      description: '',
    });
    setFormErrors({});
    setShowCreateModal(true);
  };

  const handleEditOpen = (item: ProsthesisTypeListItem) => {
    setSelectedType(item);
    setForm({
      name: item.name,
      description: item.description || '',
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSaving(true);
      await prosthesisTypeService.create(form);
      toast.success('Prosthesis type created successfully!');
      setShowCreateModal(false);
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to create prosthesis type';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !validateForm()) return;

    try {
      setSaving(true);
      await prosthesisTypeService.update(selectedType.id, form);
      toast.success('Prosthesis type updated successfully!');
      setShowEditModal(false);
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to update prosthesis type';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof CreateProsthesisTypePayload, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const toggleSort = (field: 'name' | 'createdAt') => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const confirmDelete = (item: ProsthesisTypeListItem) => {
    setTypeToDelete(item);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!typeToDelete) return;
    try {
      setDeleting(true);
      await prosthesisTypeService.delete(typeToDelete.id);
      toast.success('Prosthesis type deleted successfully');
      setDeleteModalOpen(false);
      setTypeToDelete(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete prosthesis type');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="admins-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-header__title">Prosthesis Types</h1>
          <p className="page-header__subtitle">Manage dental laboratory work types and catalog items</p>
        </div>
        <button
          id="btn-add-prosthesis-type"
          className="btn btn--primary"
          onClick={handleCreateOpen}
        >
          <Plus size={18} />
          <span>Add Prosthesis Type</span>
        </button>
      </div>

      {/* Stats */}
      <div className="tenants-page__stats">
        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--primary">
            <Sparkles size={24} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{types.length}</span>
            <span className="stat-card__label">Total Registered Types</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="table-toolbar" style={{ gap: '1rem' }}>
        <div className="search-input-wrap">
          <Search size={16} className="search-input__icon" />
          <input
            id="input-prosthesis-search"
            type="text"
            className="form-input search-input"
            placeholder="Search prosthesis types..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-input__clear" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="table-loading">
          <Loader2 size={32} className="spinner" />
          <span>Loading prosthesis types...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon" style={{ backgroundColor: 'var(--accent-primary-light)' }}>
            <Sparkles size={48} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <h3 className="empty-state__title">
            {types.length === 0 ? 'No prosthesis types registered' : 'No matching records'}
          </h3>
          <p className="empty-state__text">
            {types.length === 0
              ? 'Add prosthesis types to define work items and build custom manufacturing workflow sequences.'
              : 'Try adjusting your search or filter criteria.'}
          </p>
          {types.length === 0 && (
            <button
              className="btn btn--primary"
              onClick={handleCreateOpen}
            >
              <Plus size={18} />
              <span>Add Prosthesis Type</span>
            </button>
          )}
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table" id="prosthesis-table">
            <thead>
              <tr>
                <th>
                  <button className="th-sort" onClick={() => toggleSort('name')}>
                    Prosthesis Name
                    <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>Description</th>
                <th>
                  <button className="th-sort" onClick={() => toggleSort('createdAt')}>
                    Created On
                    <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="cell-primary">
                      <div className="cell-avatar" style={{ background: 'linear-gradient(135deg, #E0C3FC, #8EC5FC)' }}>
                        {item.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="cell-primary__name">{item.name}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    {item.description ? (
                      <span className="cell-date" style={{ maxWidth: '350px', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.4' }}>
                        {item.description}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    <span className="cell-date">
                      {new Date(item.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn-action"
                        onClick={() => handleEditOpen(item)}
                        title="Edit Type"
                      >
                        <span>Edit</span>
                      </button>
                      <button
                        className="btn-action btn-action--danger"
                        onClick={() => confirmDelete(item)}
                        title="Delete Type"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">Add Prosthesis Type</h2>
                <p className="modal__subtitle">Register a new work type for the laboratory catalog</p>
              </div>
              <button
                className="modal__close"
                onClick={() => !saving && setShowCreateModal(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form className="modal__body" onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label" htmlFor="input-prosthesis-name">
                  Prosthesis Name *
                </label>
                <input
                  id="input-prosthesis-name"
                  className={`form-input ${formErrors.name ? 'form-input--error' : ''}`}
                  type="text"
                  placeholder="e.g., Zirconia Crown"
                  value={form.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  disabled={saving}
                  autoFocus
                />
                {formErrors.name && (
                  <span className="form-error">
                    <AlertCircle size={12} /> {formErrors.name}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="input-prosthesis-desc">
                  Description
                </label>
                <textarea
                  id="input-prosthesis-desc"
                  className="form-input"
                  style={{ minHeight: '80px', fontFamily: 'inherit', padding: '10px 14px' }}
                  placeholder="e.g., Premium custom zirconia crown for molar restoration."
                  value={form.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="modal__footer">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowCreateModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-prosthesis"
                  type="submit"
                  className="btn btn--primary"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="spinner" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Add Prosthesis Type</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedType && (
        <div className="modal-overlay" onClick={() => !saving && setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">Edit Prosthesis Type</h2>
                <p className="modal__subtitle">Update catalog details for <strong>{selectedType.name}</strong></p>
              </div>
              <button
                className="modal__close"
                onClick={() => !saving && setShowEditModal(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form className="modal__body" onSubmit={handleUpdate}>
              <div className="form-group">
                <label className="form-label" htmlFor="input-edit-prosthesis-name">
                  Prosthesis Name *
                </label>
                <input
                  id="input-edit-prosthesis-name"
                  className={`form-input ${formErrors.name ? 'form-input--error' : ''}`}
                  type="text"
                  value={form.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  disabled={saving}
                  autoFocus
                />
                {formErrors.name && (
                  <span className="form-error">
                    <AlertCircle size={12} /> {formErrors.name}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="input-edit-prosthesis-desc">
                  Description
                </label>
                <textarea
                  id="input-edit-prosthesis-desc"
                  className="form-input"
                  style={{ minHeight: '80px', fontFamily: 'inherit', padding: '10px 14px' }}
                  value={form.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="modal__footer">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowEditModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-edit-prosthesis"
                  type="submit"
                  className="btn btn--primary"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="spinner" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Update Prosthesis Type</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && typeToDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">Delete Prosthesis Type</h2>
              </div>
              <button
                className="modal__close"
                onClick={() => !deleting && setDeleteModalOpen(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="modal__body" style={{ padding: '1rem 1.75rem' }}>
              <p style={{ margin: 0, color: 'var(--text-body)' }}>
                Are you sure you want to delete <strong>{typeToDelete.name}</strong>? This action will permanently remove this work type and any associated processes.
              </p>
            </div>

            <div className="modal__footer" style={{ padding: '1rem 1.75rem' }}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
              >
                Cancel
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
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Delete Permanently</span>
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
