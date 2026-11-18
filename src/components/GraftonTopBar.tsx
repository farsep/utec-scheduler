import React from 'react';
import { Menu, Download, Upload, Search } from 'lucide-react';
import type { TabKey } from './AppShell';
import { SwissTooltip } from './common/SwissTooltip';

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
    <header className="grafton-topbar" data-active-module={activeTab}>
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
            <span>Cursos</span>
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
          data-nav-module="schedule"
          className={`grafton-nav-btn ${activeTab === 'schedule' ? 'is-active' : ''}`}
          onClick={() => onSwitchTab('schedule')}
        >
          Horario
        </button>

        <button
          type="button"
          data-nav-module="malla"
          className={`grafton-nav-btn ${activeTab === 'malla' ? 'is-active' : ''}`}
          onClick={() => onSwitchTab('malla')}
        >
          Malla & 16 Carreras
        </button>

        <button
          type="button"
          data-nav-module="courses"
          className={`grafton-nav-btn ${activeTab === 'courses' ? 'is-active' : ''}`}
          onClick={() => onSwitchTab('courses')}
        >
          Cursos
        </button>

        <button
          type="button"
          data-nav-module="mentors"
          className={`grafton-nav-btn ${activeTab === 'mentors' ? 'is-active' : ''}`}
          onClick={() => onSwitchTab('mentors')}
        >
          Mentores
        </button>

        <button
          type="button"
          data-nav-module="classrooms"
          className={`grafton-nav-btn ${activeTab === 'classrooms' ? 'is-active' : ''}`}
          onClick={() => onSwitchTab('classrooms')}
        >
          Aulas Libres
        </button>

        <button
          type="button"
          data-nav-module="professors"
          className={`grafton-nav-btn ${activeTab === 'professors' ? 'is-active' : ''}`}
          onClick={() => onSwitchTab('professors')}
        >
          Docentes
        </button>

        <SwissTooltip content="Subir tu Excel de Consulta_Horario o PDF de Carga Hábil" placement="bottom">
          <button
            type="button"
            className="grafton-nav-btn grafton-nav-btn--import"
            onClick={onOpenUploadModal}
          >
            <Upload size={13} />
            <span>Importar Oferta</span>
          </button>
        </SwissTooltip>
      </nav>

      {/* Right: Universal Command Palette Trigger & Export Button */}
      <div className="grafton-topbar__actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <SwissTooltip content="Abrir buscador global de cursos, docentes, aulas y acciones (⌘K / Ctrl+K)" placement="bottom">
          <button
            type="button"
            data-testid="cmdk-trigger-btn"
            onClick={() => window.dispatchEvent(new CustomEvent('matriculab:open-cmdk'))}
            className="grafton-cmdk-trigger"
          >
            <Search size={13} className="grafton-cmdk-trigger__icon" />
            <span className="grafton-cmdk-trigger__label">⌘K Buscar</span>
          </button>
        </SwissTooltip>

        <SwissTooltip content="Exportar tu horario actual en imagen PNG, calendario .ics o Google Calendar" placement="bottom">
          <button
            type="button"
            className="grafton-export-btn"
            onClick={onOpenExportModal}
          >
            <Download size={14} />
            <span>Exportar</span>
          </button>
        </SwissTooltip>
      </div>
    </header>
  );
};

