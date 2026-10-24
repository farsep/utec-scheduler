import React from 'react';
import type { ClassroomAvailability, ClassroomFilterState } from '../../types/classroom';
import { ClassroomTimeline } from './ClassroomTimeline';
import { ROOM_TYPE_LABELS, formatDurationHuman } from '../../utils/classroomUtils';
import {
  GraduationCap,
  Laptop,
  Users,
  Building,
  MapPin,
  Clock,
  Calendar,
  ChevronRight,
  User,
  Sparkles,
  CheckCircle2,
  XCircle
} from 'lucide-react';

interface ClassroomCardProps {
  availability: ClassroomAvailability;
  filter: ClassroomFilterState;
  nowMinutes: number;
  isToday: boolean;
  onOpenDetail: (classroom: ClassroomAvailability['classroom']) => void;
}

export const ClassroomCard: React.FC<ClassroomCardProps> = React.memo(({
  availability,
  filter,
  nowMinutes,
  isToday,
  onOpenDetail
}) => {
  const { classroom, liveStatus, currentSession, nextSession, minutesUntilNextSession, minutesUntilCurrentSessionEnds, isAvailableForSearch, occupancyPercentage } = availability;
  const typeMeta = ROOM_TYPE_LABELS[classroom.type] || ROOM_TYPE_LABELS.otro;

  const renderTypeIcon = () => {
    switch (classroom.type) {
      case 'laboratorio':
        return <Laptop size={18} />;
      case 'mesas':
        return <Users size={18} />;
      case 'auditorio':
        return <Building size={18} />;
      case 'aula':
      default:
        return <GraduationCap size={18} />;
    }
  };

  const isLiveMode = filter.mode === 'live_now';

  return (
    <div
      className={`classroom-card ${isAvailableForSearch ? 'classroom-card--available' : 'classroom-card--busy'}`}
      onClick={() => onOpenDetail(classroom)}
    >
      {/* Top Header */}
      <div className="classroom-card-header">
        <div className="classroom-card-title-group">
          <div className="classroom-type-icon" style={{ color: typeMeta.color, background: `${typeMeta.color}15` }}>
            {renderTypeIcon()}
          </div>
          <div>
            <h3 className="classroom-card-name">{classroom.displayName}</h3>
            <div className="classroom-card-meta">
              <span className="classroom-badge-code">{classroom.code}</span>
              <span className="classroom-badge-floor">Piso {classroom.floor}</span>
              <span className="classroom-badge-type" style={{ color: typeMeta.color }}>{typeMeta.short}</span>
            </div>
          </div>
        </div>

        {/* Status Pill Badge */}
        <div className="classroom-card-status">
          {isLiveMode ? (
            liveStatus === 'free_now' ? (
              <span className="room-status-badge room-status-badge--free">
                <span className="status-dot-pulse" />
                <span>Libre Ahora</span>
              </span>
            ) : liveStatus === 'occupied_now' ? (
              <span className="room-status-badge room-status-badge--occupied">
                <span className="status-dot status-dot--red" />
                <span>En Clase</span>
              </span>
            ) : (
              <span className="room-status-badge room-status-badge--closed">
                <span>Cerrado</span>
              </span>
            )
          ) : (
            isAvailableForSearch ? (
              <span className="room-status-badge room-status-badge--free">
                <CheckCircle2 size={13} />
                <span>Disponible</span>
              </span>
            ) : (
              <span className="room-status-badge room-status-badge--occupied">
                <XCircle size={13} />
                <span>Ocupada</span>
              </span>
            )
          )}
        </div>
      </div>

      {/* Primary Availability Info Box */}
      <div className="classroom-info-banner">
        {isLiveMode ? (
          liveStatus === 'free_now' ? (
            <div className="info-banner-content info-banner-content--free">
              <div className="info-primary">
                <Sparkles size={16} className="text-emerald" />
                <span>
                  <strong>Libre por {formatDurationHuman(minutesUntilNextSession ?? 0)}</strong>
                  {nextSession ? ` (hasta las ${nextSession.startTime})` : ' (hasta el cierre 22:00)'}
                </span>
              </div>
              {nextSession && (
                <div className="info-sub">
                  Próxima clase: <span className="highlight-text">{nextSession.courseCode} - {nextSession.courseName}</span>
                </div>
              )}
            </div>
          ) : liveStatus === 'occupied_now' ? (
            <div className="info-banner-content info-banner-content--busy">
              <div className="info-primary">
                <Clock size={16} className="text-rose" />
                <span>
                  <strong>Se libera a las {currentSession?.endTime}</strong>
                  {minutesUntilCurrentSessionEnds !== undefined && ` (en ${formatDurationHuman(minutesUntilCurrentSessionEnds)})`}
                </span>
              </div>
              {currentSession && (
                <div className="info-sub">
                  Clase actual: <span className="highlight-text">{currentSession.courseCode} - {currentSession.courseName}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="info-banner-content info-banner-content--neutral">
              <span>Campus fuera del horario de clases (07:00 - 22:00)</span>
            </div>
          )
        ) : (
          <div className={`info-banner-content ${isAvailableForSearch ? 'info-banner-content--free' : 'info-banner-content--busy'}`}>
            <div className="info-primary">
              {isAvailableForSearch ? (
                <>
                  <CheckCircle2 size={16} className="text-emerald" />
                  <span><strong>Totalmente libre</strong> en tu horario ({filter.startTime} - {filter.endTime})</span>
                </>
              ) : (
                <>
                  <XCircle size={16} className="text-rose" />
                  <span><strong>Tiene clases</strong> durante el bloque seleccionado</span>
                </>
              )}
            </div>
            {nextSession && isAvailableForSearch && (
              <div className="info-sub">
                Próxima sesión en este día: {nextSession.courseCode} a las {nextSession.startTime}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mini Visual Timeline */}
      <div className="classroom-card-timeline-section">
        <div className="timeline-header-label">
          <span>Ocupación de {filter.selectedDay}:</span>
          <span className="occupancy-pill">{occupancyPercentage}% ocupado</span>
        </div>
        <ClassroomTimeline
          availability={availability}
          nowMinutes={nowMinutes}
          isToday={isToday}
          selectedRange={!isLiveMode ? { startMinutes: filter.startMinutes, endMinutes: filter.endMinutes } : null}
        />
      </div>

      {/* Footer Info & Action */}
      <div className="classroom-card-footer">
        <div className="card-footer-stats">
          <div className="stat-pill">
            <Clock size={12} />
            <span>{formatDurationHuman(availability.totalFreeMinutesToday)} libres hoy</span>
          </div>
        </div>

        <button
          className="btn-view-schedule"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail(classroom);
          }}
        >
          <span>Ver Horario</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
});

ClassroomCard.displayName = 'ClassroomCard';
