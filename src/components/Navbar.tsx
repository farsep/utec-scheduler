import React from 'react';
import { Calendar, Upload, Sparkles, User, BookOpen, Trash2, RefreshCw } from 'lucide-react';
import type { MetadataInfo } from '../types/schedule';

interface NavbarProps {
  metadata: MetadataInfo;
  onOpenUpload: () => void;
  onLoadSample: () => void;
  onClearAllData: () => void;
  coursesCount: number;
  eligibleCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  metadata,
  onOpenUpload,
  onLoadSample,
  onClearAllData,
  coursesCount,
  eligibleCount
}) => {
  return (
    <header className={`app-header ${coursesCount === 0 ? 'app-header--empty' : ''}`}>
      <div className="brand-title">
        <div className="brand-logo">
          <Calendar size={20} />
        </div>
        <div>
          <span>Matrícu<strong style={{ color: 'var(--accent-primary)' }}>LAB</strong></span>
          <span className="brand-badge">Astro + TS</span>
        </div>
      </div>

      <div className="meta-info-strip">
        {metadata.studentName && (
          <div className="meta-chip">
            <User size={14} color="var(--accent-primary)" />
            <span>Alumno:</span>
            <span className="meta-chip-val">{metadata.studentName}</span>
          </div>
        )}
        {metadata.major && (
          <div className="meta-chip">
            <BookOpen size={14} color="var(--accent-emerald)" />
            <span>Carrera:</span>
            <span className="meta-chip-val">{metadata.major} ({metadata.semester || '2026-2'})</span>
          </div>
        )}

        <div className="meta-chip">
          <span style={{ color: 'var(--text-muted)' }}>Cursos Cargados:</span>
          <span className="meta-chip-val" style={{ color: 'var(--accent-primary)' }}>{coursesCount}</span>
          {eligibleCount > 0 && (
            <span className="glass-pill" style={{ color: 'var(--accent-emerald)', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
              {eligibleCount} Habilitados
            </span>
          )}
        </div>
      </div>

      <div className="navbar-actions">
        {coursesCount > 0 && (
          <button
            className="btn btn-secondary"
            onClick={onClearAllData}
            title="Borrar todos los datos cargados de archivos"
            style={{ color: '#fca5a5', borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.1)' }}
          >
            <Trash2 size={15} />
            <span>Vaciar Datos</span>
          </button>
        )}

        <button className="btn btn-secondary" onClick={onLoadSample} title="Cargar datos de ejemplo (UTEC)">
          <Sparkles size={15} color="var(--accent-amber)" />
          <span>Cargar Ejemplo</span>
        </button>

        <button className="btn btn-primary" onClick={onOpenUpload}>
          <Upload size={16} />
          <span>Subir Archivos</span>
        </button>
      </div>
    </header>
  );
};
