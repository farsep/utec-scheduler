import React, { useState, useEffect, useRef } from 'react';
import type { DayOfWeek } from '../../types/schedule';
import type { CourseExtendedInfo } from '../../types/courseDirectory';
import { DAY_LABELS } from '../../utils/classroomUtils';
import { formatProfessorName } from '../../utils/professorUtils';
import {
  generateIcsForVisitorSessions,
  generateGoogleCalendarUrlForSession
} from '../../utils/courseDirectoryUtils';
import { VisitorEmailModal } from './VisitorEmailModal';
import { CourseTimetable } from './CourseTimetable';
import { CustomSelect } from '../common/CustomSelect';
import {
  X,
  Star,
  Mail,
  Calendar,
  Clock,
  MapPin,
  GraduationCap,
  Layers,
  Sparkles,
  ExternalLink,
  Download,
  Radio
} from 'lucide-react';

interface CourseDetailModalProps {
  course: CourseExtendedInfo;
  isVisitor: boolean;
  onToggleVisitor: (course: CourseExtendedInfo) => void;
  onClose: () => void;
  nowDay: DayOfWeek;
  nowMinutes: number;
}

export const CourseDetailModal: React.FC<CourseDetailModalProps> = ({
  course,
  isVisitor,
  onToggleVisitor,
  onClose,
  nowDay,
  nowMinutes
}) => {
  const [selectedSectionNumber, setSelectedSectionNumber] = useState<string>('ALL');
  const [isEmailModalOpen, setIsEmailModalOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'sections' | 'timetable'>('sections');

  const modalRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  const isClosing = useRef<boolean>(false);
  const rafId = useRef<number | null>(null);

  const visibleSections = selectedSectionNumber === 'ALL'
    ? course.extendedSections
    : course.extendedSections.filter(s => s.sectionNumber === selectedSectionNumber);

  // Smooth exit animation matching ProfessorDetailModal & ClassroomDetailModal
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

  // Lock body scroll so Safari / mobile browser never scrolls background page
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isEmailModalOpen) {
        triggerClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEmailModalOpen]);

  // Mobile swipe-to-dismiss gesture on header/drag-zone
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      if (
        e.target instanceof Element &&
        (e.target.closest('button') || e.target.closest('a') || e.target.closest('input'))
      ) {
        return;
      }
      if (bodyScrollRef.current && bodyScrollRef.current.scrollTop > 5) {
        return;
      }
      touchStartY.current = e.touches[0].clientY;
      isDragging.current = true;
      if (modalRef.current) modalRef.current.style.transition = 'none';
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current || isClosing.current) return;
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

    if (deltaY > 95) {
      triggerClose();
    } else if (modalRef.current) {
      modalRef.current.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
      modalRef.current.style.transform = 'translate3d(0, 0, 0)';
    }
  };

  // Download ICS for visitor sessions
  const handleDownloadIcs = () => {
    const icsContent = generateIcsForVisitorSessions(course, selectedSectionNumber);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `UTEC-Oyente-${course.code}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const sectionSelectOptions = [
    { value: 'ALL', label: `Todas las secciones (${course.totalSectionsCount})` },
    ...course.extendedSections.map(sec => ({
      value: sec.sectionNumber,
      label: `Sección ${sec.sectionNumber}`,
      badge: `${sec.totalWeeklyHours} h/sem`
    }))
  ];

  return (
    <div
      ref={overlayRef}
      className="course-modal-backdrop"
      onClick={triggerClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={modalRef}
        className="course-modal-dialog glass-card"
        onClick={e => e.stopPropagation()}
      >
        {/* Mobile Swipe Grab Handle */}
        <div
          className="mobile-sheet-drag-zone course-sheet-drag-zone"
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

        {/* Modal Top Header */}
        <div
          className="course-modal-header"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="course-modal-header-info">
            <div className="course-modal-badges-row">
              <span
                className="course-modal-code-badge"
                style={{
                  backgroundColor: `${course.departmentColor}25`,
                  color: course.departmentColor,
                  borderColor: `${course.departmentColor}50`
                }}
              >
                {course.code}
              </span>
              <span className="course-modal-dept-badge">{course.departmentLabel}</span>
              {course.credits && (
                <span className="course-modal-credits-badge">{course.credits} Cr.</span>
              )}
              {course.plan && (
                <span className="course-modal-plan-badge">Malla {course.plan}</span>
              )}
            </div>

            <h2 className="course-modal-title">{course.name}</h2>
          </div>

          <div className="course-modal-header-actions">
            {/* Quick Visitor Star Toggle in Header (always accessible even in Timetable view) */}
            <button
              type="button"
              className={`course-modal-star-btn ${isVisitor ? 'course-modal-star-btn--active' : ''}`}
              onClick={() => onToggleVisitor(course)}
              title={isVisitor ? 'Guardado en tu lista de Oyente' : 'Guardar como curso Visitante / Oyente'}
              aria-label={isVisitor ? 'Quitar de Oyente' : 'Guardar como Oyente'}
            >
              <Star size={17} className={isVisitor ? 'star-filled-gold' : ''} />
            </button>

            <button
              type="button"
              className="course-modal-close-btn"
              onClick={triggerClose}
              title="Cerrar detalles (Esc)"
              aria-label="Cerrar detalles"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        {/* Compact Navigation Tabs (Secciones vs Malla Horaria Semanal) */}
        <div className="course-modal-nav-tabs">
          <div className="course-modal-tabs-group">
            <button
              type="button"
              className={`course-modal-tab-btn ${activeTab === 'sections' ? 'course-modal-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('sections')}
            >
              <Layers size={15} />
              <span className="tab-text-desktop">Secciones y Aulas ({course.totalSectionsCount})</span>
              <span className="tab-text-mobile">Secciones ({course.totalSectionsCount})</span>
            </button>
            <button
              type="button"
              className={`course-modal-tab-btn ${activeTab === 'timetable' ? 'course-modal-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('timetable')}
            >
              <Calendar size={15} />
              <span className="tab-text-desktop">Malla Horaria Semanal</span>
              <span className="tab-text-mobile">Malla Horaria</span>
            </button>
          </div>

          {/* Desktop/Tablet inline section filter when on sections tab and >1 section */}
          {activeTab === 'sections' && course.totalSectionsCount > 1 && (
            <div className="course-modal-sec-filter-wrap">
              <CustomSelect
                value={selectedSectionNumber}
                onChange={val => setSelectedSectionNumber(String(val))}
                options={sectionSelectOptions}
                size="sm"
                align="right"
                ariaLabel="Filtrar por sección"
              />
            </div>
          )}
        </div>

        {/* Modal Main Scrollable Content Area */}
        <div
          ref={bodyScrollRef}
          className={`course-modal-body ${activeTab === 'timetable' ? 'course-modal-body--timetable' : ''}`}
        >
          {activeTab === 'sections' ? (
            <div className="course-sections-tab-content">
              {/* Visitor Command Banner (Now inside scrollable body so it never blocks vertical navigation on mobile!) */}
              <div className="course-modal-visitor-banner">
                <div className="visitor-banner-content">
                  <div className="visitor-banner-icon">
                    <Star size={18} className={isVisitor ? 'star-filled-gold' : ''} />
                  </div>
                  <div className="visitor-banner-text">
                    <h4 className="visitor-banner-title">
                      {isVisitor
                        ? 'Curso guardado en tu lista de Oyente'
                        : '¿Deseas asistir como visitante / oyente?'}
                    </h4>
                    <p className="visitor-banner-desc">
                      {isVisitor
                        ? 'Consulta aulas, horarios o exporta las sesiones a tu calendario.'
                        : 'Ingresa a clases presenciales o sincrónicas para enriquecer tu formación.'}
                    </p>
                  </div>
                </div>

                <div className="visitor-banner-actions">
                  <button
                    type="button"
                    className={`btn visitor-action-btn visitor-action-btn--primary ${isVisitor ? 'btn-secondary visitor-btn--active' : 'btn-primary'}`}
                    onClick={() => onToggleVisitor(course)}
                  >
                    <Star size={14} className={isVisitor ? 'star-filled-gold' : ''} />
                    <span>{isVisitor ? 'Guardado como Visitante' : 'Marcar como Visitante'}</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary visitor-action-btn"
                    onClick={() => setIsEmailModalOpen(true)}
                    title="Generar correo respetuoso para solicitar permiso al docente"
                  >
                    <Mail size={14} />
                    <span>Pedir Permiso</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary visitor-action-btn"
                    onClick={handleDownloadIcs}
                    title="Descargar eventos de clase (.ics) para Apple Calendar o Outlook"
                  >
                    <Download size={14} />
                    <span>Exportar .ICS</span>
                  </button>
                </div>
              </div>

              {/* Mobile Section Filter Bar (shown inside scroll flow when >1 section) */}
              {course.totalSectionsCount > 1 && (
                <div className="course-mobile-sec-filter">
                  <CustomSelect
                    value={selectedSectionNumber}
                    onChange={val => setSelectedSectionNumber(String(val))}
                    options={sectionSelectOptions}
                    size="sm"
                    ariaLabel="Filtrar por sección"
                  />
                </div>
              )}

              {/* Sections List */}
              <div className="course-sections-list">
                {visibleSections.map(sec => (
                  <div key={sec.sectionNumber} className="course-section-card glass-card">
                    <div className="course-section-header">
                      <div className="section-title-wrap">
                        <h3 className="section-title">Sección {sec.sectionNumber}</h3>
                        <span className="section-hours-badge">
                          <Clock size={12} /> {sec.totalWeeklyHours} h/sem
                        </span>
                        {sec.daysTaught.length > 0 && (
                          <span className="section-days-badge">
                            <Calendar size={12} /> {sec.daysTaught.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Sessions in this section */}
                    <div className="course-sessions-grid">
                      {sec.sessions.map((sess, idx) => {
                        const isLiveNow =
                          sess.day === nowDay &&
                          nowMinutes >= sess.startMinutes &&
                          nowMinutes < sess.endMinutes;

                        const gcalUrl = generateGoogleCalendarUrlForSession(
                          sess,
                          course.name,
                          course.code,
                          sec.sectionNumber
                        );

                        const formattedProf =
                          sess.professor && !/docente\s*utec/i.test(sess.professor)
                            ? formatProfessorName(sess.professor).displayName
                            : null;

                        return (
                          <div
                            key={sess.id || idx}
                            className={`course-session-pill glass-card ${isLiveNow ? 'course-session-pill--live' : ''}`}
                          >
                            <div className="session-pill-top">
                              <span className="session-group-tag">
                                {sess.sessionGroup} ({sess.sessionType})
                              </span>
                              <span
                                className={`session-modality-badge ${sess.modality === 'Presencial' ? 'modality--presencial' : 'modality--virtual'}`}
                              >
                                {sess.modality}
                              </span>
                              {isLiveNow && (
                                <span className="session-live-pulse-badge">
                                  <Radio size={11} className="live-spin" /> EN CLASE AHORA
                                </span>
                              )}
                            </div>

                            <div className="session-pill-time-row">
                              <Clock size={14} className="text-accent" />
                              <span className="session-day-name">{DAY_LABELS[sess.day]}</span>
                              <span className="session-hours">
                                {sess.startTime} - {sess.endTime}
                              </span>
                            </div>

                            <div className="session-pill-location-row">
                              <MapPin size={14} className="text-emerald" />
                              <a
                                href={`/aulas?search=${encodeURIComponent(sess.roomCode || sess.roomDisplayName)}`}
                                className="session-room-link"
                                title="Ver ocupación y mapa de este aula en Buscador de Aulas"
                              >
                                {sess.roomDisplayName}
                                <ExternalLink size={11} className="inline-ext-icon" />
                              </a>
                              {sess.floor > 1 && (
                                <span className="session-floor-tag">Piso {sess.floor}</span>
                              )}
                            </div>

                            <div className="session-pill-prof-row">
                              <GraduationCap size={14} className="text-purple" />
                              {formattedProf ? (
                                <a
                                  href={`/profesores?search=${encodeURIComponent(sess.professor)}`}
                                  className="session-prof-link"
                                  title="Ver perfil del docente en el Directorio"
                                >
                                  {formattedProf}
                                </a>
                              ) : (
                                <span className="session-prof-unassigned">Docente UTEC</span>
                              )}
                            </div>

                            {/* Quick Add to Google Calendar Action */}
                            <div className="session-pill-actions">
                              <a
                                href={gcalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="session-gcal-link"
                                title="Agendar sesión como oyente en tu Google Calendar"
                              >
                                <Calendar size={12} />
                                <span>Agregar a Google Calendar</span>
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <CourseTimetable
              course={course}
              nowDay={nowDay}
              nowMinutes={nowMinutes}
              selectedSectionNumber={selectedSectionNumber}
              onSelectSectionNumber={setSelectedSectionNumber}
            />
          )}
        </div>

        {/* Modal Footer (Desktop/Tablet etiquette guidance; hidden on mobile so 100% of height goes to content) */}
        <div className="course-modal-footer">
          <div className="modal-footer-etiquette">
            <Sparkles size={14} className="text-accent-amber" />
            <span>
              <strong>Consejo para Oyentes:</strong> Consulta primero con el profesor titular. La mayoría de docentes en UTEC aceptan visitantes con gusto cuando hay espacio.
            </span>
          </div>

          <button type="button" className="btn btn-secondary" onClick={triggerClose}>
            Cerrar
          </button>
        </div>
      </div>

      {/* Embedded Visitor Email Modal */}
      {isEmailModalOpen && (
        <VisitorEmailModal
          course={course}
          selectedSectionNumber={selectedSectionNumber === 'ALL' ? course.extendedSections[0]?.sectionNumber || '1' : selectedSectionNumber}
          onClose={() => setIsEmailModalOpen(false)}
        />
      )}
    </div>
  );
};
