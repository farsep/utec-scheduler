import React, { useState, useEffect, useRef } from 'react';
import type { DayOfWeek } from '../../types/schedule';
import type { ProfessorInfo, ProfessorSession } from '../../types/professor';
import { ALL_DAYS, DAY_LABELS } from '../../utils/classroomUtils';
import { evaluateProfessorLiveStatus } from '../../utils/professorUtils';
import { ProfessorTimetable } from './ProfessorTimetable';
import {
  X,
  Mail,
  Copy,
  Check,
  Calendar,
  Clock,
  BookOpen,
  MapPin,
  Users,
  GraduationCap,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';

interface ProfessorDetailModalProps {
  professor: ProfessorInfo | null;
  onClose: () => void;
  nowDay: DayOfWeek;
  nowMinutes: number;
}

type ModalTab = 'horario' | 'cursos' | 'aulas';

function getAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash % 360);
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 70%, 52%) 0%, hsl(${h2}, 75%, 42%) 100%)`;
}

export const ProfessorDetailModal: React.FC<ProfessorDetailModalProps> = ({
  professor,
  onClose,
  nowDay,
  nowMinutes
}) => {
  if (!professor) return null;

  const [activeTab, setActiveTab] = useState<ModalTab>('horario');
  const [selectedSession, setSelectedSession] = useState<ProfessorSession | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<boolean>(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  const isClosing = useRef<boolean>(false);
  const rafId = useRef<number | null>(null);

  const { isTeachingNow, currentSession, nextSession } = evaluateProfessorLiveStatus(
    professor,
    nowDay,
    nowMinutes
  );

  const avatarGradient = getAvatarGradient(professor.displayName);

  // Smooth exit animation
  const triggerClose = () => {
    if (isClosing.current) return;
    isClosing.current = true;

    const isMobileSheet = typeof window !== 'undefined' && window.innerWidth <= 768;

    if (modalRef.current) {
      if (isMobileSheet) {
        modalRef.current.style.transition = 'transform 0.24s cubic-bezier(0.32, 1, 0.23, 1)';
        modalRef.current.style.transform = 'translate3d(0, 100%, 0)';
      } else {
        modalRef.current.style.transition = 'transform 0.18s cubic-bezier(0.4, 0, 1, 1), opacity 0.18s ease-in';
        modalRef.current.style.transform = 'scale(0.96) translate3d(0, 12px, 0)';
        modalRef.current.style.opacity = '0';
      }
    }
    if (overlayRef.current) {
      overlayRef.current.style.transition = 'opacity 0.2s ease-out';
      overlayRef.current.style.opacity = '0';
    }

    setTimeout(() => {
      onClose();
    }, 200);
  };

  // Lock body scroll and handle Escape key
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') triggerClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Smooth scroll inspector into view when a session is clicked
  useEffect(() => {
    if (selectedSession && inspectorRef.current) {
      inspectorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedSession]);

  // Mobile swipe-to-dismiss gesture handling
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      if (e.target instanceof Element && (e.target.closest('button') || e.target.closest('a') || e.target.closest('input'))) {
        return;
      }
      // If modal is scrolled down, allow normal scrolling instead of dragging sheet
      if (modalRef.current && modalRef.current.scrollTop > 5) {
        return;
      }
      touchStartY.current = e.touches[0].clientY;
      isDragging.current = true;
      if (modalRef.current) modalRef.current.style.transition = 'none';
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current || isClosing.current) return;
    if (modalRef.current && modalRef.current.scrollTop > 5) {
      isDragging.current = false;
      return;
    }
    const deltaY = e.touches[0].clientY - touchStartY.current;

    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      if (deltaY > 0 && modalRef.current) {
        modalRef.current.style.transform = `translate3d(0, ${deltaY}px, 0)`;
      }
    });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging.current || isClosing.current) return;
    isDragging.current = false;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    if (deltaY > 100) {
      triggerClose();
    } else if (modalRef.current) {
      modalRef.current.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
      modalRef.current.style.transform = 'translate3d(0, 0, 0)';
    }
  };

  const handleCopyEmail = () => {
    if (!professor.email) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(professor.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="classroom-modal-overlay prof-modal-overlay"
      onClick={triggerClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={modalRef}
        className="classroom-modal prof-modal glass-card"
        onClick={e => e.stopPropagation()}
      >
        {/* Mobile Swipe Grab Handle */}
        <div
          className="mobile-sheet-drag-zone"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          role="button"
          tabIndex={0}
          aria-label="Deslizar hacia abajo para cerrar"
        >
          <div className="mobile-sheet-drag-handle" aria-hidden="true" />
        </div>

        {/* Modal Header */}
        <div
          className="prof-modal-header"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="prof-modal-profile-group">
            <div className="prof-modal-avatar" style={{ background: avatarGradient }}>
              <span>{professor.initials}</span>
            </div>

            <div className="prof-modal-name-group">
              <div className="prof-modal-tag-row">
                <span className="prof-dept-badge">{professor.departmentLabel}</span>
                {isTeachingNow && (
                  <span className="prof-live-badge">
                    <span className="live-dot" /> EN CLASE AHORA
                  </span>
                )}
              </div>

              <h2 className="prof-modal-title">{professor.displayName}</h2>
              <span className="prof-modal-subname">{professor.lastNameFirst}</span>

              {/* Email & Actions */}
              {professor.email && (
                <div className="prof-modal-email-row">
                  <a
                    href={`mailto:${professor.email}`}
                    className="prof-modal-email-link"
                    title={`Enviar correo electrónico a ${professor.email}`}
                  >
                    <Mail size={15} />
                    <span>{professor.email}</span>
                  </a>

                  <button
                    type="button"
                    className={`prof-modal-copy-btn ${copiedEmail ? 'prof-modal-copy-btn--copied' : ''}`}
                    onClick={handleCopyEmail}
                    title="Copiar correo"
                  >
                    {copiedEmail ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedEmail ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={triggerClose}
            title="Cerrar modal (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Live / Next Class Banner */}
        {isTeachingNow && currentSession ? (
          <div className="prof-modal-live-banner">
            <span className="live-beacon-dot" />
            <div>
              <strong>Dictando en este momento:</strong> {currentSession.courseCode} - {currentSession.courseName} en{' '}
              <a
                href={`/aulas`}
                className="prof-room-link"
                title="Ver aula en buscador de aulas"
              >
                {currentSession.roomCode}
              </a>{' '}
              ({currentSession.startTime} a {currentSession.endTime})
            </div>
          </div>
        ) : nextSession ? (
          <div className="prof-modal-next-banner">
            <Clock size={15} />
            <div>
              <strong>Próxima clase:</strong> {nextSession.day} {nextSession.startTime} - {nextSession.endTime} ({nextSession.courseCode}) en {nextSession.roomCode}
            </div>
          </div>
        ) : null}

        {/* KPI Stats Highlights Bar */}
        <div className="classroom-modal-kpis prof-modal-kpis">
          <div className="modal-kpi-card">
            <span className="kpi-card-label">
              <span className="kpi-label-full">Horas Semanales</span>
              <span className="kpi-label-short">Horas / Sem</span>
            </span>
            <span className="kpi-card-value text-accent">{professor.totalHoursPerWeek} hrs</span>
          </div>

          <div className="modal-kpi-card">
            <span className="kpi-card-label">
              <span className="kpi-label-full">Cursos Distintos</span>
              <span className="kpi-label-short">Cursos</span>
            </span>
            <span className="kpi-card-value text-emerald">{professor.uniqueCoursesCount}</span>
          </div>

          <div className="modal-kpi-card">
            <span className="kpi-card-label">
              <span className="kpi-label-full">Secciones a Cargo</span>
              <span className="kpi-label-short">Secciones</span>
            </span>
            <span className="kpi-card-value text-purple">{professor.uniqueSectionsCount}</span>
          </div>

          <div className="modal-kpi-card">
            <span className="kpi-card-label">
              <span className="kpi-label-full">Aulas Asignadas</span>
              <span className="kpi-label-short">Aulas</span>
            </span>
            <span className="kpi-card-value text-amber">{professor.uniqueRooms.length}</span>
          </div>
        </div>

        {/* Modal View Selector Tabs */}
        <div className="prof-modal-nav-tabs">
          <button
            type="button"
            className={`prof-modal-tab-btn ${activeTab === 'horario' ? 'prof-modal-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('horario')}
          >
            <Calendar size={15} />
            <span className="tab-label-full">Horario Semanal ({professor.totalSessionsCount} clases)</span>
            <span className="tab-label-short">Horario ({professor.totalSessionsCount})</span>
          </button>

          <button
            type="button"
            className={`prof-modal-tab-btn ${activeTab === 'cursos' ? 'prof-modal-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('cursos')}
          >
            <BookOpen size={15} />
            <span className="tab-label-full">Cursos ({professor.uniqueCoursesCount}) • Secciones ({professor.uniqueSectionsCount})</span>
            <span className="tab-label-short">Cursos ({professor.uniqueCoursesCount})</span>
          </button>

          <button
            type="button"
            className={`prof-modal-tab-btn ${activeTab === 'aulas' ? 'prof-modal-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('aulas')}
          >
            <MapPin size={15} />
            <span className="tab-label-full">Aulas Utilizadas ({professor.uniqueRooms.length})</span>
            <span className="tab-label-short">Aulas ({professor.uniqueRooms.length})</span>
          </button>
        </div>

        {/* Modal Tab Content Area */}
        <div className="prof-modal-content-body">
          {/* TAB 1: Weekly Timetable Calendar */}
          {activeTab === 'horario' && (
            <div className="prof-tab-pane prof-tab-pane--timetable">
              <ProfessorTimetable
                professor={professor}
                selectedSession={selectedSession}
                onSelectSession={setSelectedSession}
                nowDay={nowDay}
                nowMinutes={nowMinutes}
              />

              {/* Inspector card if a session is clicked */}
              {selectedSession && (
                <div ref={inspectorRef} className="prof-session-inspector glass-card">
                  <div className="prof-inspector-header">
                    <div className="prof-inspector-title-row">
                      <span
                        className="prof-inspector-badge"
                        style={{
                          backgroundColor: `${selectedSession.courseColor}22`,
                          color: selectedSession.courseColor,
                          borderColor: `${selectedSession.courseColor}44`
                        }}
                      >
                        {selectedSession.courseCode}
                      </span>
                      <h4>{selectedSession.courseName}</h4>
                    </div>

                    <button
                      type="button"
                      className="prof-inspector-close-btn"
                      onClick={() => setSelectedSession(null)}
                      title="Cerrar detalle"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="prof-inspector-grid">
                    <div className="prof-inspector-item">
                      <Clock size={14} className="text-muted" />
                      <span>
                        <strong>Día y Horario:</strong> {DAY_LABELS[selectedSession.day]}{' '}
                        {selectedSession.startTime} - {selectedSession.endTime} ({selectedSession.durationHours}h)
                      </span>
                    </div>

                    <div className="prof-inspector-item">
                      <MapPin size={14} className="text-muted" />
                      <span>
                        <strong>Ubicación:</strong> {selectedSession.roomDisplayName} (Piso {selectedSession.floor})
                      </span>
                    </div>

                    <div className="prof-inspector-item">
                      <Users size={14} className="text-muted" />
                      <span>
                        <strong>Sección:</strong> {selectedSession.sectionNumber} • {selectedSession.sessionGroup}
                      </span>
                    </div>

                    <div className="prof-inspector-item">
                      <Info size={14} className="text-muted" />
                      <span>
                        <strong>Modalidad:</strong> {selectedSession.modality} • {selectedSession.frequency}
                      </span>
                    </div>

                    <div className="prof-inspector-item">
                      <Users size={14} className="text-muted" />
                      <span>
                        <strong>Matriculados:</strong> {selectedSession.enrolled} de {selectedSession.vacancies} vacantes
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Courses & Sections Breakdown */}
          {activeTab === 'cursos' && (
            <div className="prof-tab-pane prof-tab-pane--courses">
              <div className="prof-courses-list">
                {professor.courses.map(course => (
                  <div key={course.code} className="prof-course-detail-card glass-card">
                    {/* Course Header Banner */}
                    <div className="prof-course-detail-header">
                      <div className="prof-course-header-left">
                        <span
                          className="prof-course-code-pill"
                          style={{
                            backgroundColor: `${course.color}22`,
                            color: course.color,
                            borderColor: `${course.color}55`
                          }}
                        >
                          {course.code}
                        </span>
                        <div className="prof-course-title-col">
                          <h4 className="prof-course-name">{course.name}</h4>
                          <span className="prof-course-meta-sub">
                            {course.sectionsCount} {course.sectionsCount === 1 ? 'sección a cargo' : 'secciones a cargo'}
                            {course.sections.length > 0 && ` (Sección ${course.sections.join(', ')})`}
                          </span>
                        </div>
                      </div>

                      <div className="prof-course-header-right">
                        <span className="prof-course-hours-badge">
                          {course.totalWeeklyHours}h semanales
                        </span>
                      </div>
                    </div>

                    {/* Section Groups Cards (Treatment validated with Timetable app) */}
                    <div className="prof-course-sections-grid">
                      {course.sectionGroups && course.sectionGroups.length > 0 ? (
                        course.sectionGroups.map(sec => (
                          <div key={sec.sectionNumber} className="prof-section-card">
                            <div className="prof-section-card-header">
                              <div className="prof-section-title-group">
                                <span className="prof-section-badge">Sección {sec.sectionNumber}</span>
                                <span className="prof-section-modality-badge">{sec.modalities.join(', ')}</span>
                              </div>
                              <div className="prof-section-meta-group">
                                <span className="prof-section-enrolled">
                                  ({sec.enrolled}/{sec.vacancies} matriculados)
                                </span>
                                <span className="prof-section-hours">{sec.totalWeeklyHours}h semanales</span>
                              </div>
                            </div>

                            <div className="prof-section-sessions-list">
                              {sec.sessions.map(sess => (
                                <div key={sess.id} className="prof-section-session-item">
                                  <div className="prof-sess-type-col">
                                    <span className={`prof-sess-badge-group prof-sess-badge-group--${sess.sessionType.toLowerCase()}`}>
                                      {sess.sessionGroup}
                                    </span>
                                  </div>

                                  <div className="prof-sess-col-time">
                                    <Calendar size={13} className="text-muted" />
                                    <span>{DAY_LABELS[sess.day]}</span>
                                    <strong>{sess.startTime} - {sess.endTime}</strong>
                                  </div>

                                  <div className="prof-sess-col-room">
                                    <MapPin size={13} className="text-muted" />
                                    <span className="prof-sess-room-code">{sess.roomCode}</span>
                                    <span className="prof-sess-floor">P{sess.floor}</span>
                                  </div>

                                  <div className="prof-sess-col-enrolled">
                                    <Users size={13} className="text-muted" />
                                    <span>{sess.enrolled}/{sess.vacancies} alum.</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        /* Fallback if sectionGroups not populated */
                        <div className="prof-course-sessions-table">
                          {professor.sessions.filter(s => s.courseCode === course.code).map(sess => (
                            <div key={sess.id} className="prof-course-session-row">
                              <div className="prof-sess-col-group">
                                <span className="prof-sess-badge-group">{sess.sessionGroup}</span>
                                <span className="prof-sess-sec">Sec. {sess.sectionNumber}</span>
                              </div>
                              <div className="prof-sess-col-time">
                                <Calendar size={13} className="text-muted" />
                                <span>{DAY_LABELS[sess.day]}</span>
                                <strong>{sess.startTime} - {sess.endTime}</strong>
                              </div>
                              <div className="prof-sess-col-room">
                                <MapPin size={13} className="text-muted" />
                                <span>{sess.roomCode}</span>
                                <span className="prof-sess-floor">P{sess.floor}</span>
                              </div>
                              <div className="prof-sess-col-enrolled">
                                <Users size={13} className="text-muted" />
                                <span>{sess.enrolled}/{sess.vacancies} alum.</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Classrooms used */}
          {activeTab === 'aulas' && (
            <div className="prof-tab-pane prof-tab-pane--rooms">
              <div className="prof-rooms-grid">
                {professor.uniqueRooms.map(roomCode => {
                  const roomSessions = professor.sessions.filter(s => s.roomCode === roomCode);
                  const firstSess = roomSessions[0];
                  const floor = firstSess?.floor || 1;
                  const roomName = firstSess?.roomDisplayName || roomCode;

                  return (
                    <div key={roomCode} className="prof-room-detail-card glass-card">
                      <div className="prof-room-card-top">
                        <div className="prof-room-icon-wrap">
                          <MapPin size={20} />
                        </div>
                        <div>
                          <h4 className="prof-room-title">{roomName}</h4>
                          <span className="prof-room-code-badge">Código: {roomCode} • Piso {floor}</span>
                        </div>
                      </div>

                      <div className="prof-room-card-sessions">
                        <span className="prof-room-sessions-label">Clases en este espacio:</span>
                        <div className="prof-room-sessions-list">
                          {roomSessions.map(s => (
                            <div key={s.id} className="prof-room-mini-session">
                              <strong>{DAY_LABELS[s.day]} {s.startTime} - {s.endTime}</strong>
                              <span>{s.courseCode} ({s.sessionGroup})</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <a
                        href="/aulas"
                        className="prof-room-explore-link"
                        title="Ver disponibilidad de esta aula"
                      >
                        <span>Ver en Aulas Libres</span>
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
