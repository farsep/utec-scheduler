import React, { useState } from 'react';
import type { DayOfWeek } from '../../types/schedule';
import type { MentorInfo, MentorSession } from '../../types/mentor';
import { evaluateMentorLiveStatus } from '../../utils/mentorUtils';
import {
  Clock,
  Building2,
  Video,
  Copy,
  Check,
  Calendar,
  ChevronRight,
  Mail,
  Award
} from 'lucide-react';

interface MentorCardProps {
  mentor: MentorInfo;
  currentDay: DayOfWeek;
  currentMinutes: number;
  onSelect: (mentor: MentorInfo) => void;
}

function getAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash % 360);
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 70%, 52%) 0%, hsl(${h2}, 75%, 42%) 100%)`;
}

export const MentorCard: React.FC<MentorCardProps> = ({
  mentor,
  currentDay,
  currentMinutes,
  onSelect
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  const liveStatus = evaluateMentorLiveStatus(mentor, currentDay, currentMinutes);
  const isPresencial = mentor.modalities.includes('Presencial');
  const avatarGradient = getAvatarGradient(mentor.name);

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
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(mentor);
        }
      }}
      aria-label={`Ver asesorías del mentor ${mentor.name}`}
    >
      {/* Top Header: Avatar, Name, Department & Modality tag */}
      <div className="prof-card-header">
        <div className="prof-card-avatar" style={{ background: avatarGradient }}>
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

        {/* Modality tag on top-right */}
        <div className="mentor-header-status">
          <span className={`mentor-modality-pill ${isPresencial ? 'modality-presencial' : 'modality-virtual'}`}>
            {isPresencial ? <Building2 size={12} /> : <Video size={12} />}
            <span>{mentor.modalities.join(' / ')}</span>
          </span>
        </div>
      </div>

      {/* Live Status Row or Next Session */}
      <div className="prof-card-status-row">
        {liveStatus.isMentoringNow && liveStatus.activeSession ? (
          <div className="prof-status-live-beacon">
            <span className="live-dot-ping" />
            <span className="live-dot" />
            <div className="live-text-group">
              <strong>En mentoría ahora:</strong>
              <span>
                {liveStatus.activeSession.courseCode} • {liveStatus.activeSession.modality === 'Presencial' ? liveStatus.activeSession.primaryRoom : 'Virtual'} ({liveStatus.activeSession.timeDisplay})
              </span>
            </div>
          </div>
        ) : liveStatus.hasSessionToday && liveStatus.nextSession ? (
          <div className="prof-status-next">
            <Clock size={13} className="text-muted" />
            <span>
              Hoy: <strong>{liveStatus.nextSession.timeDisplay}</strong> ({liveStatus.nextSession.courseCode})
            </span>
          </div>
        ) : liveStatus.nextSession ? (
          <div className="prof-status-next">
            <Clock size={13} className="text-muted" />
            <span>
              Próxima: <strong>{liveStatus.nextSession.day} {liveStatus.nextSession.timeDisplay}</strong> ({liveStatus.nextSession.courseCode})
            </span>
          </div>
        ) : (
          <div className="prof-status-idle">
            <span>{mentor.totalSessions} sesión{mentor.totalSessions > 1 ? 'es' : ''} semanal{mentor.totalSessions > 1 ? 'es' : ''}</span>
          </div>
        )}
      </div>

      {/* Email Row with 1-click Copy and Mailto */}
      {mentor.email && (
        <div className="prof-card-email-row" onClick={(e) => e.stopPropagation()}>
          <a
            href={`mailto:${mentor.email}`}
            className="prof-email-link"
            onClick={handleMailClick}
            title={`Enviar correo institucional a ${mentor.email}`}
          >
            <Mail size={14} />
            <span className="prof-email-text">{mentor.email}</span>
          </a>

          <button
            type="button"
            className={`prof-email-copy-btn ${copied ? 'prof-email-copy-btn--copied' : ''}`}
            onClick={handleCopyEmail}
            title={copied ? '¡Copiado!' : 'Copiar correo institucional'}
            aria-label="Copiar correo electrónico"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>
        </div>
      )}

      {/* Course Badges Strip */}
      <div className="mentor-courses-strip">
        {mentor.courses.map((course) => (
          <span
            key={course.code}
            className="mentor-course-badge"
            style={{
              borderColor: `${course.color}55`,
              background: `${course.color}15`,
              color: '#f8fafc'
            }}
          >
            <span className="mentor-course-code" style={{ color: course.color }}>
              {course.code}
            </span>
            <span className="mentor-course-name">{course.name}</span>
          </span>
        ))}
      </div>

      {/* Sessions Schedule & Location Chips */}
      <div className="mentor-sessions-list">
        {mentor.sessions.map((session) => {
          const isToday = session.day === currentDay;
          const isLive =
            isToday &&
            currentMinutes >= session.startMinutes &&
            currentMinutes < session.endMinutes;

          return (
            <div
              key={session.id}
              className={`mentor-session-chip ${isLive ? 'session-live' : isToday ? 'session-today' : ''}`}
            >
              <div className="session-chip-time">
                <Clock size={13} className="session-clock-icon" />
                <span className="session-day-name">{session.dayName}</span>
                <span className="session-hours">{session.timeDisplay}</span>
                <span className="session-duration">({session.durationHours}h)</span>
              </div>

              <div className="session-chip-location">
                {session.modality === 'Presencial' ? (
                  <span className="session-room-pill" title={`Aula asignada: ${session.primaryRoom}`}>
                    <Building2 size={12} />
                    <span>{session.primaryRoom}</span>
                  </span>
                ) : (
                  <span className="session-virtual-pill" title="Sesión virtual vía Google Meet / Zoom">
                    <Video size={12} />
                    <span>Virtual</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Card Footer */}
      <div className="prof-card-footer mentor-card-footer">
        <span className="mentor-dept-tag">
          {mentor.courses.length} curso{mentor.courses.length > 1 ? 's' : ''} a cargo
        </span>

        <button
          type="button"
          className="prof-view-btn mentor-view-btn"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(mentor);
          }}
        >
          <span>Ver horarios y aulas</span>
          <ChevronRight size={15} />
        </button>
      </div>
    </article>
  );
};
