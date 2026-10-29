import React, { useState, useEffect, useRef } from 'react';
import type { DayOfWeek } from '../../types/schedule';
import type { MentorInfo, MentorSession } from '../../types/mentor';
import { evaluateMentorLiveStatus } from '../../utils/mentorUtils';
import {
  X,
  Mail,
  Copy,
  Check,
  Calendar,
  Clock,
  Building2,
  Video,
  Award,
  BookOpen,
  MapPin,
  Sparkles,
  Info
} from 'lucide-react';

interface MentorDetailModalProps {
  mentor: MentorInfo;
  onClose: () => void;
  currentDay: DayOfWeek;
  currentMinutes: number;
}

type ModalTab = 'horario' | 'aulas' | 'info';

const WEEKDAYS: { key: DayOfWeek; name: string }[] = [
  { key: 'Lun', name: 'Lunes' },
  { key: 'Mar', name: 'Martes' },
  { key: 'Mie', name: 'Miércoles' },
  { key: 'Jue', name: 'Jueves' },
  { key: 'Vie', name: 'Viernes' },
  { key: 'Sab', name: 'Sábado' }
];

function getAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash % 360);
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 70%, 52%) 0%, hsl(${h2}, 75%, 42%) 100%)`;
}

export const MentorDetailModal: React.FC<MentorDetailModalProps> = ({
  mentor,
  onClose,
  currentDay,
  currentMinutes
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('horario');
  const [copiedEmail, setCopiedEmail] = useState<boolean>(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  const isClosing = useRef<boolean>(false);
  const rafId = useRef<number | null>(null);

  const liveStatus = evaluateMentorLiveStatus(mentor, currentDay, currentMinutes);
  const isPresencial = mentor.modalities.includes('Presencial');
  const avatarGradient = getAvatarGradient(mentor.name);

  const presencialSessions = mentor.sessions.filter((s) => s.modality === 'Presencial');
  const hasReservations = presencialSessions.some((s) => s.reservations.length > 0);

  // Close smoothly & instantly release scroll lock
  const triggerClose = () => {
    // Immediately unlock body and html scroll
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';

    if (isClosing.current) return;
    isClosing.current = true;

    if (overlayRef.current) overlayRef.current.style.opacity = '0';
    if (modalRef.current) {
      modalRef.current.style.transform = 'translate3d(0, 40px, 0) scale(0.97)';
      modalRef.current.style.opacity = '0';
    }
    setTimeout(() => {
      onClose();
      isClosing.current = false;
    }, 180);
  };

  // Lock body scroll while open and handle Escape key
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') triggerClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalBodyOverflow || '';
      document.documentElement.style.overflow = originalHtmlOverflow || '';
      window.removeEventListener('keydown', handleKeyDown);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [onClose]);

  // Touch Drag for Mobile Sheet
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.innerWidth <= 768) {
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
    if (!mentor.email) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(mentor.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="classroom-modal-overlay prof-modal-overlay mentor-modal-overlay"
      onClick={triggerClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalles de Mentoría: ${mentor.name}`}
    >
      <div
        ref={modalRef}
        className="classroom-modal prof-modal mentor-modal glass-card"
        onClick={(e) => e.stopPropagation()}
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
              <span>{mentor.initials}</span>
            </div>

            <div className="prof-modal-name-group">
              <div className="prof-modal-tag-row">
                <span className="prof-dept-badge">{mentor.departmentName}</span>
                <span className={`mentor-modality-pill ${isPresencial ? 'modality-presencial' : 'modality-virtual'}`}>
                  {isPresencial ? <Building2 size={12} /> : <Video size={12} />}
                  <span>{mentor.modalities.join(' / ')}</span>
                </span>
                {liveStatus.isMentoringNow && (
                  <span className="prof-live-badge live-pulse-pill">
                    <span className="live-dot" /> EN VIVO AHORA
                  </span>
                )}
              </div>

              <h2 className="prof-modal-title">{mentor.name}</h2>
              <span className="mentor-dept-subtitle">
                <Award size={14} style={{ display: 'inline', marginRight: 6, color: 'var(--accent-primary)' }} />
                Mentor Académico UTEC 2026-2
              </span>

              {/* Email & Actions */}
              {mentor.email && (
                <div className="prof-modal-email-row">
                  <a
                    href={`mailto:${mentor.email}`}
                    className="prof-modal-email-link"
                    title={`Enviar correo electrónico a ${mentor.email}`}
                  >
                    <Mail size={15} />
                    <span>{mentor.email}</span>
                  </a>

                  <button
                    type="button"
                    className={`prof-modal-copy-btn ${copiedEmail ? 'prof-modal-copy-btn--copied' : ''}`}
                    onClick={handleCopyEmail}
                    title="Copiar correo"
                  >
                    {copiedEmail ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedEmail ? '¡Copiado!' : 'Copiar'}</span>
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

        {/* Modal Navigation Tabs */}
        <nav className="prof-modal-tabs-nav prof-modal-nav-tabs" aria-label="Navegación del modal de mentor">
          <button
            type="button"
            className={`prof-modal-tab-btn ${activeTab === 'horario' ? 'prof-modal-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('horario')}
          >
            <Calendar size={15} />
            <span className="tab-label-full">Horario Semanal</span>
            <span className="tab-label-short">Horario</span>
          </button>

          <button
            type="button"
            className={`prof-modal-tab-btn ${activeTab === 'aulas' ? 'prof-modal-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('aulas')}
          >
            <MapPin size={15} />
            <span className="tab-label-full">Aulas y Reservas {hasReservations ? '(11 Semanas)' : ''}</span>
            <span className="tab-label-short">Aulas {hasReservations ? '(11s)' : ''}</span>
          </button>

          <button
            type="button"
            className={`prof-modal-tab-btn ${activeTab === 'info' ? 'prof-modal-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            <BookOpen size={15} />
            <span className="tab-label-full">Cursos y Consejos</span>
            <span className="tab-label-short">Cursos</span>
          </button>
        </nav>

        {/* Tab 1: Horario Semanal */}
        {activeTab === 'horario' && (
          <div className="prof-modal-content-body">
            {/* Quick Metrics */}
            <div className="mentor-modal-metrics">
              <div className="metric-box">
                <span className="metric-lbl">Modalidad</span>
                <span className="metric-val">
                  {isPresencial ? (
                    <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Building2 size={15} /> Presencial
                    </span>
                  ) : (
                    <span style={{ color: '#818cf8', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Video size={15} /> Virtual
                    </span>
                  )}
                </span>
              </div>

              <div className="metric-box">
                <span className="metric-lbl">Aula Principal</span>
                <span className="metric-val" style={{ color: 'var(--accent-primary)' }}>
                  {mentor.primaryRoom}
                </span>
              </div>

              <div className="metric-box">
                <span className="metric-lbl">Sesiones por semana</span>
                <span className="metric-val">{mentor.totalSessions} sesión{mentor.totalSessions > 1 ? 'es' : ''}</span>
              </div>

              <div className="metric-box">
                <span className="metric-lbl">Estado Actual</span>
                <span className="metric-val" style={{ color: liveStatus.isMentoringNow ? '#10b981' : '#94a3b8' }}>
                  {liveStatus.statusLabel}
                </span>
              </div>
            </div>

            {/* Weekly Schedule Grid */}
            <div className="mentor-schedule-table-wrap">
              <div className="mentor-schedule-grid">
                {WEEKDAYS.map((day) => {
                  const daySessions = mentor.sessions.filter((s) => s.day === day.key);
                  const isToday = currentDay === day.key;

                  return (
                    <div
                      key={day.key}
                      className={`mentor-day-col ${isToday ? 'is-today-col' : ''} ${daySessions.length > 0 ? 'has-sessions' : 'empty-col'}`}
                    >
                      <div className="mentor-day-col-header">
                        <span className="day-name">{day.name}</span>
                        {isToday && <span className="today-chip">Hoy</span>}
                      </div>

                      <div className="mentor-day-col-body">
                        {daySessions.length === 0 ? (
                          <div className="no-session-slot">—</div>
                        ) : (
                          daySessions.map((session) => (
                            <div
                              key={session.id}
                              className="mentor-session-block"
                              style={{ borderLeftColor: session.courseColor }}
                            >
                              <div className="session-block-course" style={{ color: session.courseColor }}>
                                {session.courseCode}
                              </div>
                              <div className="session-block-name" title={session.courseName}>
                                {session.courseName}
                              </div>
                              <div className="session-block-time">
                                <Clock size={12} />
                                <span>{session.timeDisplay}</span>
                              </div>
                              <div className="session-block-loc">
                                {session.modality === 'Presencial' ? (
                                  <span className="loc-presencial">
                                    <Building2 size={12} /> {session.primaryRoom}
                                  </span>
                                ) : (
                                  <span className="loc-virtual">
                                    <Video size={12} /> Virtual
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Aulas y Reservas Semanales */}
        {activeTab === 'aulas' && (
          <div className="prof-modal-content-body">
            {hasReservations ? (
              <div>
                <div className="section-header-row">
                  <h3 className="section-title">
                    <MapPin size={16} />
                    <span>Programación Oficial de Aulas en Campus UTEC (Ciclo 2026-2)</span>
                  </h3>
                  <span className="reservations-count-pill">11 Semanas Confirmadas</span>
                </div>

                <p className="section-helper-text">
                  A continuación se detalla el aula reservada semana a semana para las sesiones presenciales de este mentor.
                </p>

                {presencialSessions.map((session) => (
                  <div key={session.id} className="mentor-reservations-card">
                    <div className="reservations-card-header">
                      <span className="res-course-tag" style={{ background: `${session.courseColor}22`, color: session.courseColor }}>
                        {session.courseCode}
                      </span>
                      <span className="res-course-name">{session.courseName}</span>
                      <span className="res-time-tag">
                        <Clock size={12} /> {session.dayName} {session.timeDisplay}
                      </span>
                    </div>

                    <div className="reservations-table-wrapper">
                      <table className="reservations-table">
                        <thead>
                          <tr>
                            <th>Semana</th>
                            <th>Fecha</th>
                            <th>Aula Asignada</th>
                            <th>Ubicación / Piso</th>
                          </tr>
                        </thead>
                        <tbody>
                          {session.reservations.map((res) => {
                            const isVirtualNote = res.room.toUpperCase() === 'VIRTUAL';
                            return (
                              <tr key={res.week} className={isVirtualNote ? 'row-virtual-note' : ''}>
                                <td className="res-week-col">
                                  <span className="week-badge">Semana {res.week}</span>
                                </td>
                                <td className="res-date-col">
                                  <strong>{res.dateStr}</strong>
                                </td>
                                <td className="res-room-col">
                                  <span className={`room-tag ${isVirtualNote ? 'room-tag-virtual' : 'room-tag-room'}`}>
                                    {isVirtualNote ? <Video size={12} /> : <Building2 size={12} />}
                                    <span>{res.room}</span>
                                  </span>
                                </td>
                                <td className="res-loc-col">
                                  {res.room.startsWith('S') ? (
                                    <span className="floor-text">Sótano {res.room.slice(1, 2)}</span>
                                  ) : res.room.startsWith('A') || res.room.startsWith('M') ? (
                                    <span className="floor-text">Piso {res.room.replace(/\D/g, '').slice(0, 1) || '—'}</span>
                                  ) : (
                                    <span className="floor-text">Campus UTEC</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ) : isPresencial ? (
              <div className="prof-empty-state" style={{ padding: '30px 20px' }}>
                <Building2 size={36} color="var(--accent-primary)" style={{ margin: '0 auto 12px' }} />
                <h3>Mentoría Presencial en Campus UTEC</h3>
                <p style={{ color: 'var(--text-secondary)', maxWidth: 460, margin: '8px auto' }}>
                  Las sesiones se realizan en <strong>{mentor.primaryRoom}</strong> los días {mentor.sessions.map((s) => `${s.dayName} de ${s.timeDisplay}`).join(', ')}.
                </p>
              </div>
            ) : (
              <div className="prof-empty-state" style={{ padding: '30px 20px' }}>
                <Video size={36} color="#818cf8" style={{ margin: '0 auto 12px' }} />
                <h3>Mentoría 100% Virtual</h3>
                <p style={{ color: 'var(--text-secondary)', maxWidth: 460, margin: '8px auto' }}>
                  Este mentor imparte sus asesorías de forma virtual a través de Google Meet o Zoom. El enlace de conexión se encuentra disponible en el aula virtual Canvas del curso o escribiendo a su correo institucional.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Cursos y Consejos */}
        {activeTab === 'info' && (
          <div className="prof-modal-content-body">
            <h3 className="section-title">
              <BookOpen size={16} />
              <span>Cursos que Asesora</span>
            </h3>

            <div className="mentor-modal-courses-list">
              {mentor.courses.map((course) => (
                <div
                  key={course.code}
                  className="mentor-modal-course-card"
                  style={{ borderLeftColor: course.color }}
                >
                  <div className="course-code-badge" style={{ background: `${course.color}22`, color: course.color }}>
                    {course.code}
                  </div>
                  <div className="course-name-text">{course.name}</div>
                </div>
              ))}
            </div>

            {/* Tips Banner */}
            <div className="mentor-tips-banner glass-card">
              <div className="tips-icon">
                <Sparkles size={20} color="var(--accent-amber)" />
              </div>
              <div className="tips-content">
                <h4>Recomendaciones para tu Mentoría Académica</h4>
                <ul>
                  <li>Identifica previamente las dudas, temas o ejercicios específicos que deseas consultar con tu mentor.</li>
                  <li>Si la asesoría es <strong>Presencial</strong>, dirígete directamente al aula indicada en la pestaña de <em>Aulas y Reservas</em>.</li>
                  <li>Si la asesoría es <strong>Virtual</strong>, conéctate 5 minutos antes con micrófono listo para participar activamente.</li>
                  <li>Las mentorías entre pares son un servicio 100% gratuito brindado por estudiantes destacados de ciclos superiores.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
