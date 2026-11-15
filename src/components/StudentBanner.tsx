import React, { useState } from 'react';
import { User, GraduationCap, Award, Calendar, Clock } from 'lucide-react';
import type { MetadataInfo } from '../types/schedule';

interface StudentBannerProps {
  metadata: MetadataInfo;
}

export const StudentBanner: React.FC<StudentBannerProps> = ({ metadata }) => {
  const [mobileExpanded, setMobileExpanded] = useState(false);

  if (!metadata.studentName && !metadata.major && !metadata.program) return null;

  const isConsolidado = Boolean(metadata.isConsolidado);
  const isHorario = metadata.documentType === 'Consolidado de Horario';
  const compactName = metadata.studentName || 'Estudiante UTEC';
  const compactMajor = metadata.major || metadata.program || 'UTEC';
  const compactSemester = metadata.semester ? ` (${metadata.semester})` : '';

  return (
    <div className="student-metadata-banner-container">
      {/* Mobile (< 768px): Collapsible 1-line compact Swiss student strip */}
      <div
        className="student-mobile-summary-bar"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '10.5px',
          color: '#141416',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            minWidth: 0,
            flex: 1,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
        >
          <User size={12} style={{ flexShrink: 0, color: '#005A8C' }} />
          <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {compactName}
          </span>
          <span style={{ color: '#4A4946', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            · {compactMajor}
            {compactSemester}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileExpanded(prev => !prev)}
          aria-expanded={mobileExpanded}
          style={{
            flexShrink: 0,
            padding: '2px 8px',
            backgroundColor: '#FAF9F5',
            color: '#141416',
            border: '1px solid #18181A',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            borderRadius: '0px',
            cursor: 'pointer',
          }}
        >
          {mobileExpanded ? '▴ Ficha' : '▾ Ficha'}
        </button>
      </div>

      <div
        className={`student-metadata-scroll ${
          mobileExpanded ? 'is-expanded-mobile' : 'is-collapsed-mobile'
        }`}
      >
      {metadata.documentType && metadata.documentType !== 'Horario Carga Hábil' && (
        <div
          className="student-meta-item"
          style={{ background: '#E0EBF5', borderColor: '#00668C' }}
        >
          <Calendar size={13} color="#005A8C" />
          <span className="student-meta-value" style={{ color: '#0A2E46', fontWeight: 700 }}>
            {metadata.documentType}
          </span>
        </div>
      )}

      <div className="student-meta-item student-name">
        <User size={15} color="var(--accent-primary)" />
        <span className="student-meta-label">Alumno:</span>
        <span className="student-meta-value">
          {isConsolidado && metadata.studentCode
            ? `${metadata.studentCode} - ${metadata.studentName}`
            : (metadata.studentName || 'Estudiante UTEC')}
        </span>
      </div>

      {metadata.program && (
        <div className="student-meta-item">
          <span className="student-meta-label">Programa:</span>
          <span className="student-meta-value">{metadata.program}</span>
        </div>
      )}

      {metadata.major && (
        <div className="student-meta-item">
          <GraduationCap size={15} color="var(--accent-emerald)" />
          <span className="student-meta-label">Carrera:</span>
          <span className="student-meta-value">{metadata.major}</span>
        </div>
      )}

      {metadata.malla && (
        <div className="student-meta-item">
          <Award size={15} color="var(--accent-purple)" />
          <span className="student-meta-label">Malla:</span>
          <span className="student-meta-value">{metadata.malla}</span>
        </div>
      )}

      {metadata.semester && (
        <div className="student-meta-item">
          <Calendar size={15} color="var(--accent-amber)" />
          <span className="student-meta-label">Periodo:</span>
          <span className="student-meta-value">{metadata.semester}</span>
        </div>
      )}

      {isConsolidado && metadata.academicCredits && (
        <div className="student-meta-item">
          <span className="student-meta-label">Créditos:</span>
          <span className="student-meta-value">{metadata.academicCredits}</span>
        </div>
      )}

      {isConsolidado && metadata.level && (
        <div className="student-meta-item">
          <span className="student-meta-label">Nivel:</span>
          <span className="student-meta-value">{metadata.level}</span>
        </div>
      )}

      {metadata.registrationTime && (
        <div className="student-meta-item registration-turn">
          <Clock size={15} color="#f43f5e" />
          <span className="student-meta-label">
            {isHorario ? 'Fecha y Hora:' : (isConsolidado ? 'Fecha de Matrícula:' : 'Turno de Matrícula:')}
          </span>
          <span className="student-meta-value highlight-turn">{metadata.registrationTime}</span>
        </div>
      )}
      </div>
    </div>
  );
};
