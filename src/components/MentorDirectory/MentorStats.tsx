import React from 'react';
import { Award, BookOpen, Building2, Video, Radio } from 'lucide-react';

interface MentorStatsProps {
  totalMentors: number;
  totalCourses: number;
  presencialSessionsCount: number;
  virtualSessionsCount: number;
  liveNowCount: number;
  onFilterModality?: (modality: 'ALL' | 'Presencial' | 'Virtual') => void;
  onFilterLiveNow?: () => void;
  activeModality?: 'ALL' | 'Presencial' | 'Virtual';
  isLiveOnly?: boolean;
}

export const MentorStats: React.FC<MentorStatsProps> = ({
  totalMentors,
  totalCourses,
  presencialSessionsCount,
  virtualSessionsCount,
  liveNowCount,
  onFilterModality,
  onFilterLiveNow,
  activeModality = 'ALL',
  isLiveOnly = false
}) => {
  return (
    <div className="mentor-stats-grid">
      {/* 1. Total Mentors */}
      <div className="prof-kpi-card glass-card">
        <div className="kpi-icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
          <Award size={20} />
        </div>
        <div className="kpi-body">
          <span className="kpi-value">{totalMentors}</span>
          <span className="kpi-label">Mentores Activos</span>
        </div>
      </div>

      {/* 2. Total Courses */}
      <div className="prof-kpi-card glass-card">
        <div className="kpi-icon-wrap" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
          <BookOpen size={20} />
        </div>
        <div className="kpi-body">
          <span className="kpi-value">{totalCourses}</span>
          <span className="kpi-label">Cursos con Mentoría</span>
        </div>
      </div>

      {/* 3. Presencial Sessions */}
      <div
        className={`prof-kpi-card glass-card kpi-clickable ${activeModality === 'Presencial' ? 'kpi-active' : ''}`}
        onClick={() => onFilterModality?.(activeModality === 'Presencial' ? 'ALL' : 'Presencial')}
        role="button"
        tabIndex={0}
        title="Filtrar mentorías presenciales en campus UTEC"
      >
        <div className="kpi-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
          <Building2 size={20} />
        </div>
        <div className="kpi-body">
          <span className="kpi-value">{presencialSessionsCount}</span>
          <span className="kpi-label">Presenciales en Campus</span>
        </div>
      </div>

      {/* 4. Virtual Sessions */}
      <div
        className={`prof-kpi-card glass-card kpi-clickable ${activeModality === 'Virtual' ? 'kpi-active' : ''}`}
        onClick={() => onFilterModality?.(activeModality === 'Virtual' ? 'ALL' : 'Virtual')}
        role="button"
        tabIndex={0}
        title="Filtrar mentorías virtuales"
      >
        <div className="kpi-icon-wrap" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>
          <Video size={20} />
        </div>
        <div className="kpi-body">
          <span className="kpi-value">{virtualSessionsCount}</span>
          <span className="kpi-label">Virtuales (Meet/Zoom)</span>
        </div>
      </div>

      {/* 5. Live Now (Beacon) */}
      <div
        className={`prof-kpi-card glass-card kpi-clickable ${isLiveOnly ? 'kpi-active' : ''} ${liveNowCount > 0 ? 'kpi-live-highlight' : ''}`}
        onClick={() => onFilterLiveNow?.()}
        role="button"
        tabIndex={0}
        title="Ver mentores en sesión ahora mismo"
      >
        <div className="kpi-icon-wrap" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
          <Radio size={20} className={liveNowCount > 0 ? 'beacon-spin' : ''} />
        </div>
        <div className="kpi-body">
          <div className="kpi-live-row">
            <span className="kpi-value">{liveNowCount}</span>
            {liveNowCount > 0 && <span className="live-pulse-dot" />}
          </div>
          <span className="kpi-label">{liveNowCount > 0 ? 'En mentoría ahora' : 'En vivo (0 ahora)'}</span>
        </div>
      </div>
    </div>
  );
};
