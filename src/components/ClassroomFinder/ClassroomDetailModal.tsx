import React, { useState, useEffect, useRef } from 'react';
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

  const modalRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  const currentTranslateY = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  const isClosing = useRef<boolean>(false);
  const rafId = useRef<number | null>(null);
  const hapticTriggered = useRef<boolean>(false);

  // Tactile haptic feedback for supported mobile devices
  const triggerHaptic = (duration = 10) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(duration);
      } catch {
        // Safe fallback
      }
    }
  };

  // Smooth unified exit animation for desktop, tablet, and mobile
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

  // Gesture handling for native-app mobile swipe-down to close (120 FPS RAF loop)
  const startDrag = (clientY: number, target?: EventTarget | null) => {
    if (isClosing.current) return;
    if (target instanceof Element && (target.closest('button') || target.closest('a'))) {
      return;
    }
    touchStartY.current = clientY;
    touchStartTime.current = Date.now();
    isDragging.current = true;
    currentTranslateY.current = 0;
    hapticTriggered.current = false;

    if (modalRef.current) {
      modalRef.current.style.transition = 'none';
      modalRef.current.style.willChange = 'transform';
    }
    if (overlayRef.current) {
      overlayRef.current.style.transition = 'none';
      overlayRef.current.style.willChange = 'opacity';
    }
  };

  const updateDrag = (clientY: number) => {
    if (!isDragging.current || isClosing.current) return;
    const deltaY = clientY - touchStartY.current;

    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      if (deltaY > 0) {
        currentTranslateY.current = deltaY;
        if (modalRef.current) {
          modalRef.current.style.transform = `translate3d(0, ${deltaY}px, 0)`;
        }
        if (overlayRef.current) {
          const progress = Math.min(1, deltaY / 320);
          overlayRef.current.style.opacity = `${Math.max(0.2, 1 - progress * 0.7)}`;
        }
        // Haptic feedback once upon reaching dismissal threshold
        if (deltaY > 85 && !hapticTriggered.current) {
          hapticTriggered.current = true;
          triggerHaptic(12);
        } else if (deltaY <= 85 && hapticTriggered.current) {
          hapticTriggered.current = false;
        }
      } else {
        // Gentle rubber-band resistance when pulling up
        const damped = deltaY * 0.15;
        currentTranslateY.current = damped;
        if (modalRef.current) {
          modalRef.current.style.transform = `translate3d(0, ${damped}px, 0)`;
        }
      }
    });
  };

  const endDrag = () => {
    if (!isDragging.current || isClosing.current) return;
    isDragging.current = false;
    if (rafId.current) cancelAnimationFrame(rafId.current);

    const deltaY = currentTranslateY.current;
    const elapsed = Date.now() - touchStartTime.current;
    const velocity = deltaY / (elapsed || 1); // px per ms

    // Thresholds: dragged down more than 85px OR flicked fast downwards (velocity > 0.35 and moved > 25px)
    const shouldClose = deltaY > 85 || (velocity > 0.35 && deltaY > 25);

    if (shouldClose) {
      triggerHaptic(14);
      triggerClose();
    } else {
      hapticTriggered.current = false;
      // Snap back to open position with an iOS spring-like curve
      if (modalRef.current) {
        modalRef.current.style.transition = 'transform 0.26s cubic-bezier(0.175, 0.885, 0.32, 1.15)';
        modalRef.current.style.transform = 'translate3d(0, 0, 0)';
      }
      if (overlayRef.current) {
        overlayRef.current.style.transition = 'opacity 0.2s ease-out';
        overlayRef.current.style.opacity = '1';
      }
      currentTranslateY.current = 0;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      startDrag(e.touches[0].clientY, e.target);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      updateDrag(e.touches[0].clientY);
    }
  };

  const handleTouchEnd = () => {
    endDrag();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;

    startDrag(e.clientY, e.target);

    const onMouseMove = (moveEvt: MouseEvent) => {
      updateDrag(moveEvt.clientY);
    };

    const onMouseUp = () => {
      endDrag();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Lock body scroll and listen for Escape key to close
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

  return (
    <div
      ref={overlayRef}
      className="classroom-modal-overlay"
      onClick={triggerClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={modalRef}
        className="classroom-modal glass-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Bottom Sheet Grab Indicator with Generous Hit Target */}
        <div
          className="mobile-sheet-drag-zone"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseDown={handleMouseDown}
          role="button"
          tabIndex={0}
          aria-label="Deslizar hacia abajo para cerrar"
        >
          <div className="mobile-sheet-drag-handle" aria-hidden="true" />
        </div>

        {/* Modal Header (Also Swipeable) */}
        <div
          className="classroom-modal-header"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseDown={handleMouseDown}
        >
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

          <button className="modal-close-btn" onClick={triggerClose} title="Cerrar modal (Esc)">
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
                  triggerHaptic(6);
                  setActiveTabDay(day);
                  setSelectedSession(null);
                }}
              >
                <span className="modal-day-label-full">{DAY_LABELS[day]}</span>
                <span className="modal-day-label-short">{day}</span>
                <span className="modal-day-count-badge">
                  <span className="count-full">{count} {count === 1 ? 'clase' : 'clases'}</span>
                  <span className="count-short">{count}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Day Agenda View */}
        <div className={`classroom-day-agenda-container ${selectedSession ? 'has-inspector' : ''}`}>
          <div key={activeTabDay} className="agenda-column-sessions">
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
                        onClick={() => {
                          triggerHaptic(6);
                          setSelectedSession(session);
                        }}
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
                          {session.professor && (
                            <div className="agenda-occ-meta">
                              <span className="agenda-prof">
                                <User size={13} />
                                <span>{session.professor}</span>
                              </span>
                            </div>
                          )}
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
                  title="Cerrar panel"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="inspector-body">
                <div className="inspector-course-id">
                  <span className="course-code-pill">{selectedSession.courseCode}</span>
                  <span className="group-pill">{selectedSession.sessionGroup}</span>
                  <span className="group-pill">Sec. {selectedSession.sectionNumber}</span>
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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
