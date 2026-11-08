import React from 'react';
import { Menu, Download, Upload } from 'lucide-react';
import type { TabKey } from './AppShell';

interface GraftonTopBarProps {
  activeTab: TabKey;
  onSwitchTab: (tab: TabKey) => void;
  onToggleMobileSidebar: () => void;
  onOpenUploadModal: () => void;
  onOpenExportModal: () => void;
}

export const GraftonTopBar: React.FC<GraftonTopBarProps> = ({
  activeTab,
  onSwitchTab,
  onToggleMobileSidebar,
  onOpenUploadModal,
  onOpenExportModal,
}) => {
  return (
    <header className="grafton-topbar">
      {/* Left: Mobile Drawer Toggle (<1024px) + Brand */}
      <div className="grafton-topbar__brand-wrap">
        {activeTab === 'schedule' && (
          <button
            id="mobile-sidebar-btn"
            type="button"
            className="grafton-mobile-drawer-btn"
            onClick={onToggleMobileSidebar}
            aria-label="Abrir panel de Cursos"
          >
            <Menu size={15} />
            <span>☰ Cursos</span>
          </button>
        )}

        <button
          type="button"
          className="grafton-brand"
          onClick={() => onSwitchTab('schedule')}
          title="MatricuLAB · UTEC 2026-2"
        >
          <span className="grafton-brand__mark" aria-hidden="true" />
          <span className="grafton-brand__title">MatricuLAB</span>
          <span className="grafton-brand__badge">UTEC · 2026-2</span>
        </button>
      </div>

      {/* Center: Horizontally Scrollable Segmented View Switcher */}
      <nav className="grafton-topbar__switcher no-scrollbar" aria-label="Vistas principales">
        <button
          type="button"
          className={`grafton-nav-btn ${activeTab === 'schedule' ? 'is-active' : ''}`}
          onClick={() => onSwitchTab('schedule')}
        >
          Horario
        </button>

        <button
          type="button"
          className={`grafton-nav-btn ${activeTab === 'courses' ? 'is-active' : ''}`}
          onClick={() => onSwitchTab('courses')}
        >
          Malla & 16 Carreras
        </button>

        <button
          type="button"
          className={`grafton-nav-btn ${activeTab === 'mentors' ? 'is-active' : ''}`}
          onClick={() => onSwitchTab('mentors')}
        >
          Mentores
        </button>

        <button
          type="button"
          className={`grafton-nav-btn ${activeTab === 'classrooms' ? 'is-active' : ''}`}
          onClick={() => onSwitchTab('classrooms')}
        >
          Aulas Libres
        </button>

        <button
          type="button"
          className={`grafton-nav-btn ${activeTab === 'professors' ? 'is-active' : ''}`}
          onClick={() => onSwitchTab('professors')}
        >
          Docentes
        </button>

        <button
          type="button"
          className="grafton-nav-btn grafton-nav-btn--import"
          onClick={onOpenUploadModal}
        >
          <Upload size={13} />
          <span>Importar Oferta</span>
        </button>
      </nav>

      {/* Right: Export Button */}
      <div className="grafton-topbar__actions">
        <button
          type="button"
          className="grafton-export-btn"
          onClick={onOpenExportModal}
          title="Exportar horario actual (.ics, PNG o Google Calendar)"
        >
          <Download size={14} />
          <span>Exportar</span>
        </button>
      </div>
    </header>
  );
};

