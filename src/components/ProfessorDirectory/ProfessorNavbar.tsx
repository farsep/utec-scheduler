import React from 'react';
import { Calendar, Building2, Users, GraduationCap } from 'lucide-react';

interface ProfessorNavbarProps {
  totalProfessors: number;
  filteredCount: number;
  teachingNowCount: number;
}

export const ProfessorNavbar: React.FC<ProfessorNavbarProps> = ({
  totalProfessors,
  filteredCount,
  teachingNowCount
}) => {
  return (
    <header className="app-header classroom-navbar professor-navbar">
      {/* Brand & Global Mode Switcher Tabs */}
      <div className="classroom-brand-section">
        <a href="/" className="brand-title brand-title--link" title="Ir al Armador de Horarios">
          <div className="brand-logo">
            <Calendar size={20} />
          </div>
          <div>
            <span>Matrícu<strong style={{ color: 'var(--accent-primary)' }}>LAB</strong></span>
            <span className="brand-badge">UTEC</span>
          </div>
        </a>

        {/* Global Navigation Mode Switcher */}
        <nav className="nav-switch-tabs" aria-label="Cambiar modo de la aplicación">
          <a href="/" className="nav-tab-item" title="Ir al Armador de Horarios">
            <Calendar size={15} />
            <span>Horarios</span>
          </a>
          <a href="/aulas" className="nav-tab-item" title="Buscador de Aulas Libres">
            <Building2 size={15} />
            <span>Aulas Libres</span>
          </a>
          <a href="/profesores" className="nav-tab-item nav-tab-item--active" title="Directorio de Docentes">
            <GraduationCap size={16} />
            <span>Docentes</span>
            <span className="nav-live-dot" />
          </a>
        </nav>
      </div>

      {/* Meta Stats Badge (Professor Summary) */}
      <div className="classroom-navbar-meta">
        <div className="meta-chip">
          <span style={{ color: 'var(--text-muted)' }}>Docentes:</span>
          <span className="meta-chip-val" style={{ color: 'var(--accent-primary)' }}>
            {filteredCount === totalProfessors ? totalProfessors : `${filteredCount} de ${totalProfessors}`}
          </span>
          {teachingNowCount > 0 && (
            <span
              className="glass-pill live-pill-pulse"
              style={{ color: 'var(--accent-emerald)', borderColor: 'rgba(16, 185, 129, 0.4)' }}
            >
              <span className="live-pulse-dot-inline" />
              {teachingNowCount} Dictando ahora
            </span>
          )}
        </div>
      </div>
    </header>
  );
};
