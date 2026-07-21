import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Plus, Edit2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { WorkOrderNoteItem } from '../services/work-order.service';

interface NoteHistoryThreadProps {
  notesList: WorkOrderNoteItem[];
  currentUserId: string;
  userRole: string;
  onAddNote: (content: string) => Promise<void>;
  onUpdateNote: (noteId: string, content: string) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
}

export const NoteHistoryThread: React.FC<NoteHistoryThreadProps> = ({
  notesList,
  currentUserId,
  userRole,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
}) => {
  const { t, i18n } = useTranslation();
  const [newNoteContent, setNewNoteContent] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const handleAdd = async () => {
    if (!newNoteContent.trim()) return;
    try {
      setAdding(true);
      await onAddNote(newNoteContent.trim());
      setNewNoteContent('');
    } catch (e) {
      toast.error(t('workOrders.failedAddNote', { defaultValue: 'Failed to add note' }));
    } finally {
      setAdding(false);
    }
  };

  const handleStartEdit = (note: WorkOrderNoteItem) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
  };

  const handleSaveEdit = async (noteId: string) => {
    if (!editContent.trim()) return;
    try {
      setSavingNote(true);
      await onUpdateNote(noteId, editContent.trim());
      setEditingNoteId(null);
    } catch (e) {
      toast.error(t('workOrders.failedUpdateNote', { defaultValue: 'Failed to update note' }));
    } finally {
      setSavingNote(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    try {
      await onDeleteNote(noteId);
    } catch (e) {
      toast.error(t('workOrders.failedDeleteNote', { defaultValue: 'Failed to delete note' }));
    }
  };

  return (
    <div className="notes-history-thread" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
      <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 0 }}>
        <MessageSquare size={16} />
        {t('workOrders.notesHistory', { defaultValue: 'Notes History' })}
      </label>

      {/* Note List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
        {notesList.length === 0 ? (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
            {t('workOrders.noNotes', { defaultValue: 'No notes recorded yet.' })}
          </p>
        ) : (
          notesList.map((note) => {
            const authorName = note.author
              ? `${note.author.firstName} ${note.author.lastName}`
              : t('common.unknownUser', { defaultValue: 'Unknown User' });
            const authorRole = note.author?.role || '';
            const canEdit =
              userRole === 'ADMIN' ||
              userRole === 'OWNER' ||
              userRole === 'SUPER_ADMIN' ||
              (userRole === 'TECHNICIAN' && note.authorId === currentUserId);

            return (
              <div
                key={note.id}
                style={{
                  padding: '0.625rem 0.875rem',
                  borderRadius: 'var(--radius-sm, 6px)',
                  backgroundColor: 'var(--bg-muted, #F9FAFB)',
                  border: '1px solid var(--border, #E5E7EB)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                      {authorName}
                    </span>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        backgroundColor: authorRole === 'TECHNICIAN' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        color: authorRole === 'TECHNICIAN' ? '#8B5CF6' : '#3B82F6',
                      }}
                    >
                      {authorRole}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {new Date(note.createdAt).toLocaleString(
                      i18n.language?.startsWith('es') ? 'es-MX' : 'en-US',
                      { dateStyle: 'short', timeStyle: 'short' }
                    )}
                  </span>
                </div>

                {editingNoteId === note.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <textarea
                      className="form-input"
                      style={{ minHeight: '50px', fontSize: '0.8125rem' }}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn btn--sm btn--secondary"
                        onClick={() => setEditingNoteId(null)}
                        disabled={savingNote}
                      >
                        {t('workOrders.cancelEdit', { defaultValue: 'Cancel' })}
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm btn--primary"
                        onClick={() => handleSaveEdit(note.id)}
                        disabled={savingNote}
                      >
                        {t('workOrders.saveNote', { defaultValue: 'Save Note' })}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap' }}>
                      {note.content}
                    </p>
                    {canEdit && (
                      <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                        <button
                          type="button"
                          className="btn-icon"
                          style={{ padding: '2px 4px', fontSize: '0.75rem', cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text-muted)' }}
                          onClick={() => handleStartEdit(note)}
                          title={t('workOrders.editNote', { defaultValue: 'Edit Note' })}
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          style={{ padding: '2px 4px', fontSize: '0.75rem', cursor: 'pointer', background: 'none', border: 'none', color: '#EF4444' }}
                          onClick={() => handleDelete(note.id)}
                          title={t('workOrders.deleteNote', { defaultValue: 'Delete Note' })}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add New Note Input */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
        <input
          type="text"
          className="form-input"
          style={{ flex: 1, fontSize: '0.8125rem' }}
          placeholder={t('workOrders.addNotePlaceholder', { defaultValue: 'Type a note...' })}
          value={newNoteContent}
          onChange={(e) => setNewNoteContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={handleAdd}
          disabled={adding || !newNoteContent.trim()}
        >
          <Plus size={14} />
          <span>{t('workOrders.addNote', { defaultValue: 'Add Note' })}</span>
        </button>
      </div>
    </div>
  );
};
