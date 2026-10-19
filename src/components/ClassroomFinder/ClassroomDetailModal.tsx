import React, { useState } from 'react';
import type { ClassroomInfo, ClassroomSession } from '../../types/classroom';
import type { DayOfWeek } from '../../types/schedule';
import { ALL_DAYS, DAY_LABELS, ROOM_TYPE_LABELS, calculateFreeBlocks, formatDurationHuman } from '../../utils/classroomUtils';
import {
  X,
  GraduationCap,
  Laptop,
  Users,
  Building,
  Calendar,
  Clock,
  User,
  Mail,
  Users2,
  BookOpen,
  Info
} from 'lucide-react';

interface ClassroomDetailModalProps {
  classroom: ClassroomInfo | null;
  onClose: () => void;
  systemDay?: DayOfWeek;
}

export const ClassroomDetailModal: React.FC<ClassroomDetailModalProps> = ({
  classroom,
  onClose,
  systemDay = 'Lun'
}) => {
  if (!classroom) return null;

  const [activeTabDay, setActiveTabDay] = useState<DayOfWeek>(systemDay);
  const [selectedSession, setSelectedSession] = useState<ClassroomSession | null>(null);

  const typeMeta = ROOM_TYPE_LABELS[classroom.type] || ROOM_TYPE_LABELS.otro;

  // Calculate weekly stats
  let totalWeekSessions = 0;
  let totalOccupiedHours = 0;
  ALL_DAYS.forEach(day => {
    const daySessions = classroom.sessionsByDay[day] || [];
    totalWeekSessions += daySessions.length;
    daySessions.forEach(s => {
      totalOccupiedHours += (s.endMinutes - s.startMinutes) / 60;
    });
  });

  const activeDaySessions = classroom.sessionsByDay[activeTabDay] || [];
  const { freeBlocks, occupiedBlocks, totalFreeMinutes } = calculateFreeBlocks(activeDaySessions);

  // Time slots for timetable matrix (07:00 to 21:00, hourly)
  const hours = Array.from({ length: 15 }, (_, i) => 7 + i); // 7 to 21

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content classroom-modal glass-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="classroom-modal-header">
          <div className="classroom-modal-title-group">
            <div className="classroom-type-icon classroom-type-icon--large" style={{ color: typeMeta.color, background: `${typeMeta.color}20` }}>
              {classroom.type === 'laboratorio' ? <Laptop size={24} /> :
               classroom.type === 'mesas' ? <Users size={24} /> :
               classroom.type === 'auditorio' ? <Building size={24} /> :
               <GraduationCap size={24} />}
            </div>
            <div>
              <div className="classroom-modal-badge-row">
                <span className="classroom-badge-code">{classroom.code}</span>
                <span className="classroom-badge-floor">Piso {classroom.floor}</span>
                <span className="classroom-badge-type" style={{ color: typeMeta.color }}>{typeMeta.label}</span>
              </div>
              <h2 className="classroom-modal-title">{classroom.displayName}</h2>
            </div>
          </div>

          <button className="modal-close-btn" onClick={onClose} title="Cerrar modal">
            <X size={20} />
          </button>
        </div>

        {/* Modal KPI Highlights */}
        <div className="classroom-modal-kpis">
          <div className="modal-kpi-card">
            <span className="kpi-card-label">Sesiones Semanales</span>
            <span className="kpi-card-value">{totalWeekSessions} clases</span>
          </div>
          <div className="modal-kpi-card">
            <span className="kpi-card-label">Horas Semanales en Uso</span>
            <span className="kpi-card-value text-accent">{totalOccupiedHours.toFixed(1)} hrs</span>
          </div>
          <div className="modal-kpi-card">
            <span className="kpi-card-label">Tiempo Libre en {activeTabDay}</span>
            <span className="kpi-card-value text-emerald">{formatDurationHuman(totalFreeMinutes)}</span>
          </div>
        </div>

        {/* Day Selector Tabs */}
        <div className="classroom-modal-day-tabs">
          {ALL_DAYS.map(day => {
            const count = (classroom.sessionsByDay[day] || []).length;
            const isSelected = activeTabDay === day;
            return (
              <button
                key={day}
                type="button"
                className={`modal-day-tab ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  setActiveTabDay(day);
                  setSelectedSession(null);
                }}
              >
                <span>{DAY_LABELS[day]}</span>
                <span className="modal-day-count-badge">{count} {count === 1 ? 'clase' : 'clases'}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Day Agenda View */}
        <div className="classroom-day-agenda-container">
          <div className="agenda-column-sessions">
            <h4 className="agenda-column-title">
              <Calendar size={16} />
              <span>Cronograma de {DAY_LABELS[activeTabDay]}</span>
            </h4>

            {activeDaySessions.length === 0 ? (
              <div className="empty-day-banner">
                <span className="empty-day-emoji">🎉</span>
                <h4>¡Aula totalmente desocupada este día!</h4>
                <p>No hay clases registradas para el {DAY_LABELS[activeTabDay]} de 07:00 a 22:00.</p>
              </div>
            ) : (
              <div className="agenda-timeline-list">
                {/* Interleaved occupied and free blocks */}
                {(() => {
                  // Combine and sort by startMinutes
                  const events: Array<{ type: 'free' | 'occupied'; start: number; end: number; item: any }> = [
                    ...freeBlocks.map(f => ({ type: 'free' as const, start: f.startMinutes, end: f.endMinutes, item: f })),
                    ...occupiedBlocks.map(o => ({ type: 'occupied' as const, start: o.startMinutes, end: o.endMinutes, item: o.session }))
                  ].sort((a, b) => a.start - b.start);

                  return events.map((ev, idx) => {
                    if (ev.type === 'free') {
                      return (
                        <div key={`agenda-free-${idx}`} className="agenda-item agenda-item--free">
                          <div className="agenda-time-column">
                            <span className="time-start">{ev.item.startTime}</span>
                            <span className="time-bar time-bar--free" />
                            <span className="time-end">{ev.item.endTime}</span>
                          </div>
                          <div className="agenda-card agenda-card--free">
                            <div className="agenda-free-header">
                              <span className="badge-free-pill">Libre</span>
                              <span className="free-duration-text">{formatDurationHuman(ev.item.durationMinutes)} disponibles</span>
                            </div>
                            <span className="agenda-free-sub">Espacio desocupado para estudio o reuniones</span>
                          </div>
                        </div>
                      );
                    }

                    const session: ClassroomSession = ev.item;
                    const isSelected = selectedSession?.courseCode === session.courseCode && selectedSession?.startTime === session.startTime;

                    return (
                      <div
                        key={`agenda-occ-${idx}`}
                        className={`agenda-item agenda-item--occupied ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedSession(session)}
                      >
                        <div className="agenda-time-column">
                          <span className="time-start">{session.startTime}</span>
                          <span className="time-bar time-bar--occupied" />
                          <span className="time-end">{session.endTime}</span>
                        </div>
                        <div className="agenda-card agenda-card--occupied">
                          <div className="agenda-occ-header">
                            <span className="agenda-course-code">{session.courseCode}</span>
                            <span className="agenda-session-group">{session.sessionGroup}</span>
                            <span className="agenda-sec-num">Sec. {session.sectionNumber}</span>
                          </div>
                          <h5 className="agenda-course-name">{session.courseName}</h5>
                          <div className="agenda-occ-meta">
                            {session.professor && (
                              <span className="agenda-prof">
                                <User size={13} />
                                <span>{session.professor}</span>
                              </span>
                            )}
                            <span className="agenda-enrolled">
                              <Users2 size={13} />
                              <span>{session.enrolled} matriculados</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>

          {/* Side inspection card if session is selected */}
          {selectedSession && (
            <div className="agenda-session-inspector glass-card">
              <div className="inspector-header">
                <Info size={16} className="text-accent" />
                <span>Detalle de la Clase</span>
                <button
                  type="button"
                  className="inspector-close-btn"
                  onClick={() => setSelectedSession(null)}
                >
                  <X size={14} />
                </button>
              </div>

              <div className="inspector-body">
                <div className="inspector-course-id">
                  <span className="course-code-pill">{selectedSession.courseCode}</span>
                  <span className="group-pill">{selectedSession.sessionGroup}</span>
                </div>
                <h4 className="inspector-course-name">{selectedSession.courseName}</h4>

                <div className="inspector-detail-row">
                  <Clock size={15} />
                  <span>{selectedSession.startTime} - {selectedSession.endTime} ({DAY_LABELS[selectedSession.day]})</span>
                </div>

                <div className="inspector-detail-row">
                  <User size={15} />
                  <span>{selectedSession.professor || 'Docente no asignado'}</span>
                </div>

                {selectedSession.email && (
                  <div className="inspector-detail-row">
                    <Mail size={15} />
                    <a href={`mailto:${selectedSession.email}`} className="email-link">
                      {selectedSession.email}
                    </a>
                  </div>
                )}

                <div className="inspector-detail-row">
                  <Users2 size={15} />
                  <span>{selectedSession.enrolled} matriculados ({selectedSession.vacancies} vacantes)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
