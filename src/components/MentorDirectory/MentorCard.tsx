import React, { useState } from 'react';
import type { DayOfWeek } from '../../types/schedule';
import type { MentorInfo } from '../../types/mentor';
import { evaluateMentorLiveStatus } from '../../utils/mentorUtils';
import { getGraftonPigment } from '../../utils/graftonPigments';
import { resolveCanonicalRoom } from '../../utils/classroomUtils';
import {
  Clock,
  Building2,
  Video,
  Copy,
  Check,
  ChevronRight,
  Mail,
} from 'lucide-react';

export interface ActiveUserBlock {
  courseCode: string;
  courseName: string;
  day: DayOfWeek;
  startMinutes: number;
  endMinutes: number;
}

interface MentorCardProps {
  mentor: MentorInfo;
  currentDay: DayOfWeek;
  currentMinutes: number;
  userScheduleBlocks?: ActiveUserBlock[];
  onSelect: (mentor: MentorInfo) => void;
}

export const MentorCard: React.FC<MentorCardProps> = ({
  mentor,
  currentDay,
  currentMinutes,
  userScheduleBlocks = [],
  onSelect,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  const liveStatus = evaluateMentorLiveStatus(mentor, currentDay, currentMinutes);
  const isPresencial = mentor.modalities.includes('Presencial');
  const pigment = getGraftonPigment(mentor.courses[0]?.code || mentor.departmentCode);

  const handleCopyEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!mentor.email) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(mentor.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleMailClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <article
      className={`professor-card mentor-card glass-card ${liveStatus.isMentoringNow ? 'professor-card--teaching-now mentor-card--live' : ''}`}
      onClick={() => onSelect(mentor)}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(mentor);
        }
      }}
      aria-label={`Ver asesorías del mentor ${mentor.name}`}
    >
      {/* Top Header */}
      <div className="prof-card-header">
        <div className="prof-card-avatar">
          <span>{mentor.initials}</span>
        </div>

        <div className="prof-card-identity">
          <div className="prof-card-dept-tag">
            <span>{mentor.departmentName}</span>
          </div>
          <h3 className="prof-card-name" title={mentor.name}>
            {mentor.name}
          </h3>
        </div>

        <div className="mentor-header-status">
          <span
            className={`mentor-modality-pill ${isPresencial ? 'modality-presencial' : 'modality-virtual'}`}
          >
            {isPresencial ? <Building2 size={12} /> : <Video size={12} />}
            <span>{mentor.modalities.join(' / ')}</span>
          </span>
        </div>
      </div>

      {/* Course Specialty Badges: ALWAYS CODE · FULL COURSE NAME */}
      <div className="mentor-courses-strip">
        {mentor.courses.map(course => {
          const coursePigment = getGraftonPigment(course.code);
          return (
            <a
              key={course.code}
              href={`/cursos?curso=${course.code}`}
              onClick={e => e.stopPropagation()}
              className="mentor-course-badge course-entity-link"
              style={{ borderLeftColor: coursePigment.bar }}
              title={`Ver curso ${course.code}`}
            >
              <span className="mentor-course-code">{course.code}</span>
              <span className="mentor-course-sep">·</span>
              <span className="mentor-course-name">{course.name}</span>
            </a>
          );
        })}
      </div>

      {/* Live Status Row */}
      <div
        className={`prof-card-status-row ${
          liveStatus.isMentoringNow && liveStatus.activeSession
            ? 'prof-card-status-row--live'
            : liveStatus.nextSession
            ? 'prof-card-status-row--next'
            : 'prof-card-status-row--idle'
        }`}
      >
        {liveStatus.isMentoringNow && liveStatus.activeSession ? (
          <div className="prof-status-live-beacon">
            <div className="live-text-group">
              <strong>● En mentoría ahora:</strong>
              <span>
                {liveStatus.activeSession.courseCode} · {liveStatus.activeSession.courseName} (
                {liveStatus.activeSession.timeDisplay})
              </span>
            </div>
          </div>
        ) : liveStatus.nextSession ? (
          <div className="prof-status-next">
            <Clock size={13} />
            <span>
              Próxima asesoría: <strong>{liveStatus.nextSession.day} {liveStatus.nextSession.timeDisplay}</strong>
            </span>
          </div>
        ) : (
          <div className="prof-status-idle">
            <span>
              {mentor.totalSessions} sesión{mentor.totalSessions > 1 ? 'es' : ''} semanal
              {mentor.totalSessions > 1 ? 'es' : ''}
            </span>
          </div>
        )}
      </div>

      {/* 4-Column Swiss Orthogonal Metric Grid */}
      <div className="prof-card-kpis">
        <div className="prof-kpi-item" title="Sesiones de asesoría por semana">
          <span className="prof-kpi-val prof-kpi-val--hours">{mentor.totalSessions}</span>
          <span className="prof-kpi-label">SESIONES</span>
        </div>

        <div className="prof-kpi-item" title="Cursos que asesora">
          <span className="prof-kpi-val">{mentor.courses.length}</span>
          <span className="prof-kpi-label">CURSOS</span>
        </div>

        <div className="prof-kpi-item" title="Días de atención">
          <span className="prof-kpi-val">{mentor.daysTaught.length}</span>
          <span className="prof-kpi-label">DÍAS</span>
        </div>

        <div className="prof-kpi-item" title="Modalidades disponibles">
          <span className="prof-kpi-val">{mentor.modalities.length}</span>
          <span className="prof-kpi-label">MODALIDAD</span>
        </div>
      </div>

      {/* Sessions Schedule & Live Clash Detection Chips (04_Grafton_Mentors_Rooms_Figma.svg) */}
      <div className="mentor-sessions-list">
        {mentor.sessions.map(session => {
          const clashingBlock = userScheduleBlocks.find(
            ub =>
              ub.day === session.day &&
              Math.max(ub.startMinutes, session.startMinutes) <
                Math.min(ub.endMinutes, session.endMinutes)
          );
          const hasClash = Boolean(clashingBlock);

          return (
            <div
              key={session.id}
              className={`mentor-session-chip ${hasClash ? 'session-clash' : 'session-compatible'}`}
            >
              <div className="session-chip-time">
                <span className="session-day-name">{session.day}</span>
                <span className="session-hours">{session.timeDisplay}</span>
                <span className="session-room-inline">
                  ·{' '}
                  {session.modality === 'Presencial' ? (
                    <a
                      href={`/aulas?aula=${resolveCanonicalRoom(session.primaryRoom).code}`}
                      onClick={e => e.stopPropagation()}
                      className="room-entity-link"
                      title={`Ver disponibilidad de ${resolveCanonicalRoom(session.primaryRoom).displayName}`}
                    >
                      {resolveCanonicalRoom(session.primaryRoom).code}
                    </a>
                  ) : (
                    'Virtual'
                  )}
                </span>
              </div>

              <div className="session-chip-clash-badge">
                {hasClash && clashingBlock ? (
                  <span
                    className="clash-pill clash-pill--warn"
                    title={`Cruza con ${clashingBlock.courseCode} · ${clashingBlock.courseName}`}
                  >
                    Cruza {clashingBlock.courseCode}
                  </span>
                ) : (
                  <span className="clash-pill clash-pill--ok">● Libre</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Email Row */}
      {mentor.email && (
        <div className="prof-card-email-row" onClick={e => e.stopPropagation()}>
          <a
            href={`mailto:${mentor.email}`}
            className="prof-email-link"
            onClick={handleMailClick}
            title={`Enviar correo institucional a ${mentor.email}`}
          >
            <Mail size={13} />
            <span className="prof-email-text">{mentor.email}</span>
          </a>

          <button
            type="button"
            className={`prof-email-copy-btn ${copied ? 'prof-email-copy-btn--copied' : ''}`}
            onClick={handleCopyEmail}
            title={copied ? '¡Copiado!' : 'Copiar correo institucional'}
            aria-label="Copiar correo electrónico"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>
        </div>
      )}

      {/* Card Footer */}
      <div className="prof-card-footer mentor-card-footer">
        <span className="mentor-dept-tag">
          {mentor.courses.length} asignatura{mentor.courses.length > 1 ? 's' : ''}
        </span>

        <button
          type="button"
          className="prof-view-btn mentor-view-btn"
          onClick={e => {
            e.stopPropagation();
            onSelect(mentor);
          }}
        >
          <span>Ver detalle</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </article>
  );
};
