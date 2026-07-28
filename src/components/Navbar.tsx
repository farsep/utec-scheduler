import React from 'react';
import { Calendar, Upload, Download, Sparkles, User, BookOpen } from 'lucide-react';
import type { MetadataInfo } from '../types/schedule';

interface NavbarProps {
  metadata: MetadataInfo;
  onOpenUpload: () => void;
  onLoadSample: () => void;
  isSampleLoaded: boolean;
  coursesCount: number;
  eligibleCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  metadata,
  onOpenUpload,
  onLoadSample,
  isSampleLoaded,
  coursesCount,
  eligibleCount
}) => {
  return (
    <header className="app-header">
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
            <span className="glass-pill" style={{ color: 'var(--accent-emerald)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
              {eligibleCount} Habilitados
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button className="btn btn-secondary" onClick={onLoadSample} title="Cargar horario predeterminado">
          <Sparkles size={16} color="var(--accent-amber)" />
          <span>Datos Ejemplo</span>
        </button>

        <button className="btn btn-primary" onClick={onOpenUpload}>
          <Upload size={16} />
          <span>Subir Excel / PDF</span>
        </button>
      </div>
    </header>
  );
};
