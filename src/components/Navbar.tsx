import React from 'react';
import { Calendar, GitBranch, Upload, Trash2, Building2, GraduationCap, Award, BookOpen } from 'lucide-react';
import type { MetadataInfo } from '../types/schedule';
import { MobileBottomNav } from './MobileBottomNav';

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
    <>
      <header className={`app-header ${coursesCount === 0 ? 'app-header--empty' : ''}`}>
      <div className="classroom-brand-section">
        <a href="/" className="brand-title brand-title--link" title="MatrícuLAB - Armador de Horarios">
          <div className="brand-logo">
            <Calendar size={20} />
          </div>
          <div>
            <span>Matrícu<strong style={{ color: 'var(--accent-primary)' }}>LAB</strong></span>
            <span className="brand-badge">UTEC</span>
          </div>
        </a>

        <nav className="nav-switch-tabs">
          <a href="/" className="nav-tab-item nav-tab-item--active" title="Armador de Horarios">
            <Calendar size={15} />
            <span>Horarios</span>
          </a>
          <a href="/malla" className="nav-tab-item" title="Malla Curricular & Grafo de Prerrequisitos">
            <GitBranch size={15} />
            <span>Malla</span>
          </a>
          <a href="/cursos" className="nav-tab-item" title="Catálogo de Cursos Ofertados">
            <BookOpen size={15} />
            <span>Cursos</span>
          </a>
          <a href="/aulas" className="nav-tab-item" title="Buscador de Aulas Libres">
            <Building2 size={15} />
            <span>Aulas Libres</span>
          </a>
          <a href="/profesores" className="nav-tab-item" title="Directorio de Docentes">
            <GraduationCap size={16} />
            <span>Docentes</span>
          </a>
          <a href="/mentores" className="nav-tab-item" title="Mentores Académicos">
            <Award size={16} />
            <span>Mentores</span>
          </a>
        </nav>
      </div>

      {coursesCount > 0 && (
        <div className="meta-info-strip">
          <div className="meta-chip">
            <span className="meta-label-full" style={{ color: 'var(--text-muted)' }}>Cursos:</span>
            <span className="meta-chip-val" style={{ color: 'var(--accent-primary)' }}>{coursesCount}</span>
            {eligibleCount > 0 && (
              <span className="glass-pill" style={{ color: '#093B29', background: '#DCEEE6', borderColor: '#0D7A4E', borderRadius: '0px' }}>
                {eligibleCount} Hab.
              </span>
            )}
          </div>
        </div>
      )}

      <div className="navbar-actions">
        {coursesCount > 0 && (
          <button
            className="btn btn-secondary"
            onClick={onClearAllData}
            title="Borrar todos los datos cargados de archivos"
            style={{ color: '#7A1C15', borderColor: '#B8332A', background: '#F7E4E2', borderRadius: '0px' }}
          >
            <Trash2 size={15} />
            <span>Vaciar Datos</span>
          </button>
        )}

        <button className="btn btn-secondary" onClick={onLoadSample} title="Cargar datos de ejemplo (UTEC)">
          <BookOpen size={15} color="#B85D00" />
          <span>Cargar Ejemplo</span>
        </button>

        <button className="btn btn-primary" onClick={onOpenUpload}>
          <Upload size={16} />
          <span>Subir Archivos</span>
        </button>
      </div>
    </header>
    <MobileBottomNav activeTab="horarios" />
  </>
  );
};
