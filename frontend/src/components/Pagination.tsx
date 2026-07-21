import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PaginationProps {
  currentPage: number; // 0-indexed
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalItems, pageSize, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);

  const { t } = useTranslation();

  if (totalItems === 0) return null;

  const startItem = currentPage * pageSize + 1;
  const endItem = Math.min((currentPage + 1) * pageSize, totalItems);

  // Generate page numbers with ellipses
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 0; i < totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(0);

      let start = Math.max(1, currentPage - 1);
      let end = Math.min(totalPages - 2, currentPage + 1);

      if (currentPage <= 2) {
        end = 3;
      } else if (currentPage >= totalPages - 3) {
        start = totalPages - 4;
      }

      if (start > 1) {
        pages.push('ellipsis-left');
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages - 2) {
        pages.push('ellipsis-right');
      }

      pages.push(totalPages - 1);
    }

    return pages;
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        padding: '1.25rem 1.5rem',
        backgroundColor: 'var(--bg-surface)',
        borderTop: '1px solid var(--border)',
        borderBottomLeftRadius: 'var(--radius-xl)',
        borderBottomRightRadius: 'var(--radius-xl)',
        gap: '1rem',
      }}
    >
      {/* Entries Info */}
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', justifySelf: 'start' }}>
        {t('pagination.showing')} <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{startItem}</span> {t('pagination.to')}{' '}
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{endItem}</span> {t('pagination.of')}{' '}
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{totalItems}</span> {t('pagination.entries')}
      </div>

      {/* Navigation Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', justifySelf: 'center' }}>
        {/* Previous Button */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            backgroundColor: 'transparent',
            color: currentPage === 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
            cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
            opacity: currentPage === 0 ? 0.4 : 1,
            transition: 'all 0.2s',
          }}
          className="pagination-btn"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Page Numbers */}
        {getPageNumbers().map((page, index) => {
          if (typeof page === 'string') {
            return (
              <span
                key={`ellipsis-${index}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  fontSize: '0.8125rem',
                  color: 'var(--text-muted)',
                }}
              >
                &bull;&bull;&bull;
              </span>
            );
          }

          const isActive = currentPage === page;

          return (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                fontSize: '0.8125rem',
                fontWeight: isActive ? 700 : 500,
                border: isActive ? '1px solid var(--accent-primary)' : '1px solid transparent',
                backgroundColor: isActive ? 'var(--accent-primary-glow)' : 'transparent',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              className={`pagination-num-btn ${isActive ? 'active' : ''}`}
            >
              {page + 1}
            </button>
          );
        })}

        {/* Next Button */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages - 1}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            backgroundColor: 'transparent',
            color: currentPage === totalPages - 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
            cursor: currentPage === totalPages - 1 ? 'not-allowed' : 'pointer',
            opacity: currentPage === totalPages - 1 ? 0.4 : 1,
            transition: 'all 0.2s',
          }}
          className="pagination-btn"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Right spacer for centering balance */}
      <div style={{ justifySelf: 'end' }} />
    </div>
  );
}
