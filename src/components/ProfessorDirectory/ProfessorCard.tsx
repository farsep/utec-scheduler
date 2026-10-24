import React, { useState, memo } from 'react';
import type { DayOfWeek } from '../../types/schedule';
import type { ProfessorInfo } from '../../types/professor';
import { ALL_DAYS } from '../../utils/classroomUtils';
import { evaluateProfessorLiveStatus } from '../../utils/professorUtils';
import {
  Mail,
  Copy,
  Check,
  Clock,
  BookOpen,
  MapPin,
  ChevronRight,
  Sparkles,
  Radio
} from 'lucide-react';

interface ProfessorCardProps {
  professor: ProfessorInfo;
  nowDay: DayOfWeek;
  nowMinutes: number;
  onOpenDetail: (prof: ProfessorInfo) => void;
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

export const ProfessorCard: React.FC<ProfessorCardProps> = memo(({
  professor,
  nowDay,
  nowMinutes,
  onOpenDetail
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  const { isTeachingNow, currentSession, nextSession } = evaluateProfessorLiveStatus(
    professor,
    nowDay,
    nowMinutes
  );

  const avatarGradient = getAvatarGradient(professor.displayName);

  const handleCopyEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!professor.email) return;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(professor.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleMailClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <article
      className={`professor-card glass-card ${isTeachingNow ? 'professor-card--teaching-now' : ''}`}
      onClick={() => onOpenDetail(professor)}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDetail(professor);
        }
      }}
      aria-label={`Ver detalles del docente ${professor.displayName}`}
    >
      {/* Top Header Row: Avatar, Names, Department badge */}
      <div className="prof-card-header">
        <div className="prof-card-avatar" style={{ background: avatarGradient }}>
          <span>{professor.initials}</span>
        </div>

        <div className="prof-card-identity">
          <div className="prof-card-dept-tag">
            <span>{professor.departmentLabel}</span>
          </div>
          <h3 className="prof-card-name" title={professor.displayName}>
            {professor.displayName}
          </h3>
          <span className="prof-card-academic-name" title={professor.lastNameFirst}>
            {professor.lastNameFirst}
          </span>
        </div>
      </div>

      {/* Live Status Banner or Next Class Indicator */}
      <div className="prof-card-status-row">
        {isTeachingNow && currentSession ? (
          <div className="prof-status-live-beacon">
            <span className="live-dot-ping" />
            <span className="live-dot" />
            <div className="live-text-group">
              <strong>Dictando ahora:</strong>
              <span>
                {currentSession.courseCode} en {currentSession.roomCode} ({currentSession.startTime} - {currentSession.endTime})
              </span>
            </div>
          </div>
        ) : nextSession ? (
          <div className="prof-status-next">
            <Clock size={13} className="text-muted" />
            <span>
              Próxima: <strong>{nextSession.day} {nextSession.startTime}</strong> en {nextSession.roomCode}
            </span>
          </div>
        ) : (
          <div className="prof-status-idle">
            <span>Sin clases registradas hoy</span>
          </div>
        )}
      </div>

      {/* Email Row with 1-click Copy and Mailto */}
      {professor.email && (
        <div className="prof-card-email-row" onClick={e => e.stopPropagation()}>
          <a
            href={`mailto:${professor.email}`}
            className="prof-email-link"
            onClick={handleMailClick}
            title={`Enviar correo a ${professor.email}`}
          >
            <Mail size={14} />
            <span className="prof-email-text">{professor.email}</span>
          </a>

          <button
            type="button"
            className={`prof-email-copy-btn ${copied ? 'prof-email-copy-btn--copied' : ''}`}
            onClick={handleCopyEmail}
            title={copied ? '¡Copiado!' : 'Copiar correo'}
            aria-label="Copiar correo electrónico"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>
        </div>
      )}

      {/* KPI Stats Highlights Bar */}
      <div className="prof-card-kpis">
        <div className="prof-kpi-item" title="Horas semanales de clase">
          <span className="prof-kpi-val text-accent">{professor.totalHoursPerWeek}h</span>
          <span className="prof-kpi-label">Semanales</span>
        </div>

        <div className="prof-kpi-item" title="Cursos distintos que dicta">
          <span className="prof-kpi-val text-emerald">{professor.uniqueCoursesCount}</span>
          <span className="prof-kpi-label">Cursos</span>
        </div>

        <div className="prof-kpi-item" title="Secciones a cargo">
          <span className="prof-kpi-val text-purple">{professor.uniqueSectionsCount}</span>
          <span className="prof-kpi-label">Secciones</span>
        </div>

        <div className="prof-kpi-item" title="Aulas donde dicta">
          <span className="prof-kpi-val text-amber">{professor.uniqueRooms.length}</span>
          <span className="prof-kpi-label">Aulas</span>
        </div>
      </div>

      {/* Days of Week Mini Matrix */}
      <div className="prof-card-days-row">
        <span className="prof-card-section-label">Días:</span>
        <div className="prof-days-chips">
          {ALL_DAYS.map(day => {
            const hasClass = professor.daysTaught.includes(day);
            const isToday = nowDay === day;
            const isCurrentClassDay = isTeachingNow && nowDay === day;

            return (
              <span
                key={day}
                className={`prof-day-chip ${hasClass ? 'prof-day-chip--active' : ''} ${isToday ? 'prof-day-chip--today' : ''} ${isCurrentClassDay ? 'prof-day-chip--live' : ''}`}
                title={hasClass ? `${professor.displayName} dicta los ${day}` : `Sin clases el ${day}`}
              >
                {day}
              </span>
            );
          })}
        </div>
      </div>

      {/* Courses Tags Preview */}
      <div className="prof-card-courses-row">
        <span className="prof-card-section-label">Cursos:</span>
        <div className="prof-courses-chips">
          {professor.courses.slice(0, 3).map(course => (
            <span
              key={course.code}
              className="prof-course-tag"
              style={{
                borderColor: `${course.color}40`,
                backgroundColor: `${course.color}14`,
                color: course.color
              }}
              title={`${course.code}: ${course.name} (${course.sectionsCount} secciones, ${course.totalWeeklyHours}h/sem)`}
            >
              <strong>{course.code}</strong> {course.name}
            </span>
          ))}
          {professor.courses.length > 3 && (
            <span className="prof-course-tag prof-course-tag--more">
              +{professor.courses.length - 3} más
            </span>
          )}
        </div>
      </div>

      {/* Classrooms Tags Preview */}
      {professor.uniqueRooms.length > 0 && (
        <div className="prof-card-rooms-row">
          <span className="prof-card-section-label">Aulas:</span>
          <div className="prof-rooms-chips">
            {professor.uniqueRooms.slice(0, 5).map(room => (
              <span key={room} className="prof-room-tag">
                <MapPin size={10} />
                {room}
              </span>
            ))}
            {professor.uniqueRooms.length > 5 && (
              <span className="prof-room-tag prof-room-tag--more">
                +{professor.uniqueRooms.length - 5}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Footer CTA Button */}
      <div className="prof-card-footer">
        <span className="prof-view-detail-btn">
          <span>Ver Horario Completo</span>
          <ChevronRight size={15} />
        </span>
      </div>
    </article>
  );
});

ProfessorCard.displayName = 'ProfessorCard';
