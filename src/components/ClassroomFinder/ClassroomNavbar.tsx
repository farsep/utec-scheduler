import React from 'react';
import { Calendar, Building2, GraduationCap, Award, BookOpen } from 'lucide-react';
import { MobileBottomNav } from '../MobileBottomNav';

interface ClassroomNavbarProps {
  totalRooms: number;
  availableRooms: number;
}

export const ClassroomNavbar: React.FC<ClassroomNavbarProps> = ({
  totalRooms,
  availableRooms
}) => {
  return (
    <>
      <header className="app-header classroom-navbar">
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
            <a href="/cursos" className="nav-tab-item" title="Catálogo de Cursos Ofertados">
              <BookOpen size={15} />
              <span>Cursos</span>
            </a>
            <a href="/aulas" className="nav-tab-item nav-tab-item--active" title="Buscador de Aulas Libres">
              <Building2 size={15} />
              <span>Aulas Libres</span>
              <span className="nav-live-dot" />
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

        {/* Meta Stats Badge (Classroom Availability Summary) */}
        <div className="classroom-navbar-meta">
          <div className="meta-chip">
            <span style={{ color: 'var(--text-muted)' }}>Espacios UTEC:</span>
            <span className="meta-chip-val" style={{ color: 'var(--accent-primary)' }}>{totalRooms}</span>
            {availableRooms > 0 && (
              <span className="glass-pill" style={{ color: 'var(--accent-emerald)', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                {availableRooms} Libres
              </span>
            )}
          </div>
        </div>
      </header>
      <MobileBottomNav activeTab="aulas" />
    </>
  );
};
