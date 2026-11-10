import React from 'react';
import type { ClassroomAvailability, ClassroomFilterState } from '../../types/classroom';
import { ClassroomTimeline } from './ClassroomTimeline';
import { ROOM_TYPE_LABELS, formatDurationHuman } from '../../utils/classroomUtils';
import {
  Clock,
  ChevronRight,
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

export function formatRoomMonogram(code: string): string {
  const norm = (code || '').toUpperCase().trim();
  if (norm === 'AULAMAGNA' || norm.includes('MAGNA')) return 'MAG';
  if (norm === 'FUTSAL' || norm.includes('FUTSAL')) return 'FUT';
  if (norm === 'AUDITORIO' || norm.includes('AUDITORIO')) return 'AUD';
  if (norm.length <= 4) return norm;
  if (norm.length === 5) return norm;
  return norm.slice(0, 4);
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
  const monogram = formatRoomMonogram(classroom.code);

  const isLiveMode = filter.mode === 'live_now';
  const isFreeBanner = isLiveMode ? liveStatus === 'free_now' : isAvailableForSearch;
  const isBusyBanner = isLiveMode ? liveStatus === 'occupied_now' : !isAvailableForSearch;

  return (
    <div
      id={`room-card-${classroom.code}`}
      className={`classroom-card ${isAvailableForSearch ? 'classroom-card--available' : 'classroom-card--busy'}`}
      onClick={() => onOpenDetail(classroom)}
    >
      {/* Top Header */}
      <div className="classroom-card-header">
        <div className="classroom-card-title-group">
          <div
            className={`classroom-type-icon classroom-code-monogram ${
              monogram.length >= 5 ? 'classroom-code-monogram--5char' : ''
            }`}
          >
            <span>{monogram}</span>
          </div>
          <div>
            <h3 className="classroom-card-name">{classroom.displayName}</h3>
            <div className="classroom-card-meta">
              <span className="classroom-badge-floor">Piso {classroom.floor}</span>
              <span className="classroom-badge-type">
                {classroom.type === 'auditorio'
                  ? 'Auditorio'
                  : classroom.type === 'laboratorio'
                  ? 'Laboratorio'
                  : classroom.type === 'aula'
                  ? 'Aula'
                  : typeMeta.short}
              </span>
            </div>
          </div>
        </div>

        {/* Status Pill Badge */}
        <div className="classroom-card-status">
          {isLiveMode ? (
            liveStatus === 'free_now' ? (
              <span className="room-status-badge room-status-badge--free">
                <span>● Libre Ahora</span>
              </span>
            ) : liveStatus === 'occupied_now' ? (
              <span className="room-status-badge room-status-badge--occupied">
                <span>■ En Clase</span>
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

      {/* Primary Availability Info Box — Single Clean Structural Banner (NO double border) */}
      <div
        className={`classroom-info-banner ${
          isFreeBanner
            ? 'classroom-info-banner--free'
            : isBusyBanner
            ? 'classroom-info-banner--busy'
            : 'classroom-info-banner--neutral'
        }`}
      >
        {isLiveMode ? (
          liveStatus === 'free_now' ? (
            <div className="info-banner-content">
              <div className="info-primary">
                <span>
                  <strong>Libre por {formatDurationHuman(minutesUntilNextSession ?? 0)}</strong>
                  {nextSession ? ` (hasta las ${nextSession.startTime})` : ' (hasta el cierre 22:00)'}
                </span>
              </div>
              {nextSession && (
                <div className="info-sub">
                  Próxima clase:{' '}
                  <a
                    href={`/cursos?curso=${nextSession.courseCode}`}
                    onClick={e => e.stopPropagation()}
                    className="highlight-text course-entity-link"
                    title={`Ver curso ${nextSession.courseCode}`}
                  >
                    {nextSession.courseCode} · {nextSession.courseName}
                  </a>
                </div>
              )}
            </div>
          ) : liveStatus === 'occupied_now' ? (
            <div className="info-banner-content">
              <div className="info-primary">
                <span>
                  <strong>Se libera a las {currentSession?.endTime}</strong>
                  {minutesUntilCurrentSessionEnds !== undefined && ` (en ${formatDurationHuman(minutesUntilCurrentSessionEnds)})`}
                </span>
              </div>
              {currentSession && (
                <div className="info-sub">
                  Clase actual:{' '}
                  <a
                    href={`/cursos?curso=${currentSession.courseCode}`}
                    onClick={e => e.stopPropagation()}
                    className="highlight-text course-entity-link"
                    title={`Ver curso ${currentSession.courseCode}`}
                  >
                    {currentSession.courseCode} · {currentSession.courseName}
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="info-banner-content">
              <span>Campus fuera del horario de clases (07:00 - 22:00)</span>
            </div>
          )
        ) : (
          <div className="info-banner-content">
            <div className="info-primary">
              {isAvailableForSearch ? (
                <span><strong>Totalmente libre</strong> en tu horario ({filter.startTime} - {filter.endTime})</span>
              ) : (
                <span><strong>Tiene clases</strong> durante el bloque seleccionado</span>
              )}
            </div>
            {nextSession && isAvailableForSearch && (
              <div className="info-sub">
                Próxima sesión en este día: <span className="highlight-text">{nextSession.courseCode} · {nextSession.courseName}</span> a las {nextSession.startTime}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mini Visual Timeline */}
      <div className="classroom-card-timeline-section">
        <div className="timeline-header-label">
          <span>Ocupación de {filter.selectedDay}:</span>
          <span
            className={`occupancy-pill ${
              occupancyPercentage === 0
                ? 'occupancy-pill--zero'
                : occupancyPercentage >= 70
                ? 'occupancy-pill--high'
                : 'occupancy-pill--medium'
            }`}
          >
            {occupancyPercentage}% ocupado
          </span>
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
