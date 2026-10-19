import React, { useRef } from 'react';
import { Calendar, Upload, Sparkles, Building2, Clock, CheckCircle2, RefreshCw } from 'lucide-react';

interface ClassroomNavbarProps {
  totalRooms: number;
  availableRooms: number;
  onUploadExcel: (file: File) => void;
  onReloadSample: () => void;
  isLoading: boolean;
}

export const ClassroomNavbar: React.FC<ClassroomNavbarProps> = ({
  totalRooms,
  availableRooms,
  onUploadExcel,
  onReloadSample,
  isLoading
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadExcel(file);
      e.target.value = '';
    }
  };

  return (
    <header className="app-header classroom-navbar">
      {/* Brand & Page Links */}
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

        {/* Global Navigation Pills */}
        <nav className="nav-switch-tabs">
          <a href="/" className="nav-tab-item">
            <Calendar size={15} />
            <span>Horarios</span>
          </a>
          <a href="/aulas" className="nav-tab-item nav-tab-item--active">
            <Building2 size={15} />
            <span>Aulas Libres</span>
            <span className="nav-live-dot" />
          </a>
        </nav>
      </div>

      {/* Meta Stats Strip */}
      <div className="meta-info-strip">
        <div className="meta-chip">
          <span style={{ color: 'var(--text-muted)' }}>Aulas UTEC:</span>
          <span className="meta-chip-val" style={{ color: 'var(--accent-primary)' }}>{totalRooms}</span>
          {availableRooms > 0 && (
            <span className="glass-pill" style={{ color: 'var(--accent-emerald)', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
              {availableRooms} Libres
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="navbar-actions">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
        />

        <button
          className="btn btn-secondary"
          onClick={onReloadSample}
          disabled={isLoading}
          title="Recargar datos de Consulta Horario UTEC"
        >
          {isLoading ? (
            <RefreshCw size={15} className="spin-animation" />
          ) : (
            <Sparkles size={15} color="var(--accent-amber)" />
          )}
          <span>{isLoading ? 'Cargando...' : 'Recargar Ejemplo'}</span>
        </button>

        <button
          className="btn btn-primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          title="Subir archivo Consulta_Horario.xlsx personalizado"
        >
          <Upload size={16} />
          <span>Subir Excel</span>
        </button>
      </div>
    </header>
  );
};
