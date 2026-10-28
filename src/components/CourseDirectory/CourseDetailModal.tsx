import React, { useState } from 'react';
import type { DayOfWeek } from '../../types/schedule';
import type { CourseExtendedInfo, CourseExtendedSection, CourseExtendedSession } from '../../types/courseDirectory';
import { ALL_DAYS, DAY_LABELS } from '../../utils/classroomUtils';
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
  Users,
  GraduationCap,
  Layers,
  Sparkles,
  ExternalLink,
  Download,
  CheckCircle2,
  AlertCircle,
  Radio,
  BookOpen
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

  const visibleSections = selectedSectionNumber === 'ALL'
    ? course.extendedSections
    : course.extendedSections.filter(s => s.sectionNumber === selectedSectionNumber);

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

  return (
    <div className="course-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="course-modal-dialog glass-card" onClick={e => e.stopPropagation()}>
        {/* Modal Top Bar */}
        <div className="course-modal-header">
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
              {course.credits && <span className="course-modal-credits-badge">{course.credits} Créditos</span>}
              {course.plan && <span className="course-modal-plan-badge">Malla {course.plan}</span>}
            </div>

            <h2 className="course-modal-title">{course.name}</h2>
          </div>

          <button
            type="button"
            className="course-modal-close-btn"
            onClick={onClose}
            title="Cerrar detalles"
          >
            <X size={20} />
          </button>
        </div>

        {/* Visitor Command Strip / Actions (Only on sections tab to give timetable maximum screen space) */}
        {activeTab === 'sections' && (
          <div className="course-modal-visitor-banner">
            <div className="visitor-banner-content">
              <div className="visitor-banner-icon">
                <Star size={20} className={isVisitor ? 'star-filled-gold' : ''} />
              </div>
              <div>
                <h4 className="visitor-banner-title">
                  {isVisitor ? 'Curso guardado en tu lista de Oyente' : '¿Deseas asistir como visitante / oyente?'}
                </h4>
                <p className="visitor-banner-desc">
                  {isVisitor
                    ? 'Tienes este curso registrado para consultar aulas, horarios y exportar a tu calendario.'
                    : 'Puedes ingresar a las clases presenciales o sincrónicas para aprender y enriquecer tu formación académica.'}
                </p>
              </div>
            </div>

            <div className="visitor-banner-actions">
              <button
                type="button"
                className={`btn ${isVisitor ? 'btn-secondary visitor-btn--active' : 'btn-primary'}`}
                onClick={() => onToggleVisitor(course)}
              >
                <Star size={15} className={isVisitor ? 'star-filled-gold' : ''} />
                <span>{isVisitor ? 'Guardado como Visitante' : 'Marcar como Visitante'}</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsEmailModalOpen(true)}
                title="Generar correo respetuoso para solicitar permiso al docente"
              >
                <Mail size={15} />
                <span>Pedir Permiso al Docente</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleDownloadIcs}
                title="Descargar eventos de clase (.ics) para Apple Calendar o Outlook"
              >
                <Download size={15} />
                <span>Exportar .ICS</span>
              </button>
            </div>
          </div>
        )}

        {/* Navigation Tabs (Secciones vs Horario Semanal) */}
        <div className="course-modal-nav-tabs">
          <button
            type="button"
            className={`course-modal-tab-btn ${activeTab === 'sections' ? 'course-modal-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('sections')}
          >
            <Layers size={15} />
            <span>Secciones y Aulas ({course.totalSectionsCount})</span>
          </button>
          <button
            type="button"
            className={`course-modal-tab-btn ${activeTab === 'timetable' ? 'course-modal-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('timetable')}
          >
            <Calendar size={15} />
            <span>Malla Horaria Semanal</span>
          </button>

          {/* Section Filter Dropdown using CustomSelect (for sections list view) */}
          {activeTab === 'sections' && (
            <div className="course-modal-sec-filter-wrap">
              <CustomSelect
                value={selectedSectionNumber}
                onChange={val => setSelectedSectionNumber(String(val))}
                options={[
                  { value: 'ALL', label: `Todas las secciones (${course.totalSectionsCount})` },
                  ...course.extendedSections.map(sec => ({
                    value: sec.sectionNumber,
                    label: `Sección ${sec.sectionNumber}`,
                    badge: `${sec.totalWeeklyHours} h/sem`
                  }))
                ]}
                size="sm"
                ariaLabel="Filtrar por sección"
              />
            </div>
          )}
        </div>

        {/* Modal Main Content */}
        <div className={`course-modal-body ${activeTab === 'timetable' ? 'course-modal-body--timetable' : ''}`}>
          {activeTab === 'sections' ? (
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
                            {sess.professor && !/docente\s*utec/i.test(sess.professor) ? (
                              <a
                                href={`/profesores?search=${encodeURIComponent(sess.professor)}`}
                                className="session-prof-link"
                                title="Ver perfil del docente en el Directorio"
                              >
                                {sess.professor}
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

        {/* Modal Footer with quick etiquette guidance */}
        <div className="course-modal-footer">
          <div className="modal-footer-etiquette">
            <Sparkles size={14} className="text-accent-amber" />
            <span>
              <strong>Consejo para Oyentes:</strong> Consulta primero con el profesor titular. La mayoría de docentes en UTEC aceptan visitantes con gusto cuando hay espacio.
            </span>
          </div>

          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>

      {/* Embedded Visitor Email Modal */}
      {isEmailModalOpen && (
        <VisitorEmailModal
          course={course}
          selectedSectionNumber={selectedSectionNumber === 'ALL' ? '1' : selectedSectionNumber}
          onClose={() => setIsEmailModalOpen(false)}
        />
      )}
    </div>
  );
};
