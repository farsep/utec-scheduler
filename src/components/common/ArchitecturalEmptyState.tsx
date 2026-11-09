import React from 'react';
import { RotateCcw } from 'lucide-react';

export interface ArchitecturalEmptyStateProps {
  icon?: React.ReactNode;
  eyebrow?: string;
  title: string;
  description: React.ReactNode;
  query?: string;
  onReset?: () => void;
  resetLabel?: string;
  className?: string;
}

export const ArchitecturalEmptyState: React.FC<ArchitecturalEmptyStateProps> = ({
  icon,
  eyebrow = '0 RESULTADOS ENCONTRADOS',
  title,
  description,
  query,
  onReset,
  resetLabel = 'Restablecer Filtros',
  className = ''
}) => {
  return (
    <div
      className="grafton-empty-card-wrapper"
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '16px 0',
        margin: '0 auto'
      }}
    >
      <div
        className={`grafton-empty-card prof-empty-state no-rooms-card ${className}`}
        style={{
          margin: '0 auto',
          maxWidth: '600px',
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        {icon && (
          <div className="grafton-empty-icon-box empty-icon-wrap no-rooms-icon-wrap">
            {icon}
          </div>
        )}
        <span className="grafton-empty-eyebrow">
          {eyebrow}
        </span>
        <h3 className="grafton-empty-title empty-title">{title}</h3>
        <p className="grafton-empty-desc empty-desc">
          {description}
          {query ? (
            <>
              {' '}
              <span className="grafton-empty-query-pill">"{query}"</span>
            </>
          ) : null}
        </p>
        {onReset && (
          <button
            type="button"
            className="grafton-empty-reset-btn empty-reset-btn"
            onClick={onReset}
          >
            <RotateCcw size={13} className="mr-1.5 inline" />
            {resetLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export default ArchitecturalEmptyState;
