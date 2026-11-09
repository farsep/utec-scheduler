import React, { useState, memo } from 'react';
import type { DayOfWeek } from '../../types/schedule';
import type { ProfessorInfo } from '../../types/professor';
import { ALL_DAYS, resolveCanonicalRoom } from '../../utils/classroomUtils';
import { evaluateProfessorLiveStatus } from '../../utils/professorUtils';
import { getGraftonPigment } from '../../utils/graftonPigments';
import { BroadcastIcon } from '../common/BroadcastIcon';
import {
  Mail,
  Copy,
  Check,
  Clock,
  MapPin,
  ChevronRight,
} from 'lucide-react';

interface ProfessorCardProps {
  professor: ProfessorInfo;
  nowDay: DayOfWeek;
  nowMinutes: number;
  onOpenDetail: (prof: ProfessorInfo) => void;
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
        <div className="prof-card-avatar">
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
      <div
        className={`prof-card-status-row ${
          isTeachingNow && currentSession
            ? 'prof-card-status-row--live'
            : nextSession
            ? 'prof-card-status-row--next'
            : 'prof-card-status-row--idle'
        }`}
      >
        {isTeachingNow && currentSession ? (
          <div className="prof-status-live-beacon">
            <div className="live-text-group">
              <span className="inline-flex items-center gap-1 font-bold">
                <BroadcastIcon className="w-3.5 h-3.5 shrink-0 text-[#0D7A4E]" /> Dictando ahora:
              </span>
              <span>
                <a
                  href={`/cursos?curso=${currentSession.courseCode}`}
                  onClick={e => e.stopPropagation()}
                  className="prof-entity-link"
                >
                  {currentSession.courseCode}
                </a>{' '}
                en{' '}
                <a
                  href={`/aulas?aula=${resolveCanonicalRoom(currentSession.roomCode).code}`}
                  onClick={e => e.stopPropagation()}
                  className="prof-entity-link"
                >
                  {resolveCanonicalRoom(currentSession.roomCode).code}
                </a>{' '}
                ({currentSession.startTime} - {currentSession.endTime})
              </span>
            </div>
          </div>
        ) : nextSession ? (
          <div className="prof-status-next">
            <Clock size={13} />
            <span>
              Próxima clase: <strong>{nextSession.day} {nextSession.startTime}</strong> en{' '}
              <a
                href={`/aulas?aula=${resolveCanonicalRoom(nextSession.roomCode).code}`}
                onClick={e => e.stopPropagation()}
                className="prof-entity-link"
              >
                {resolveCanonicalRoom(nextSession.roomCode).code}
              </a>
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

      {/* 4-Column Swiss Orthogonal Metric Grid */}
      <div className="prof-card-kpis">
        <div className="prof-kpi-item" title="Horas semanales de clase">
          <span className="prof-kpi-val prof-kpi-val--hours">{professor.totalHoursPerWeek}h</span>
          <span className="prof-kpi-label">SEMANALES</span>
        </div>

        <div className="prof-kpi-item" title="Cursos distintos que dicta">
          <span className="prof-kpi-val">{professor.uniqueCoursesCount}</span>
          <span className="prof-kpi-label">CURSOS</span>
        </div>

        <div className="prof-kpi-item" title="Secciones a cargo">
          <span className="prof-kpi-val">{professor.uniqueSectionsCount}</span>
          <span className="prof-kpi-label">SECCIONES</span>
        </div>

        <div className="prof-kpi-item" title="Aulas donde dicta">
          <span className="prof-kpi-val">{professor.uniqueRooms.length}</span>
          <span className="prof-kpi-label">AULAS</span>
        </div>
      </div>

      {/* Days of Week Mini Matrix */}
      <div className="prof-card-days-row">
        <span className="prof-card-section-label">DÍAS:</span>
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

      {/* Courses Tags Preview — Always CODE · Full Course Name */}
      <div className="prof-card-courses-row">
        <span className="prof-card-section-label">CURSOS:</span>
        <div className="prof-courses-chips">
          {professor.courses.slice(0, 3).map(course => {
            const pigment = getGraftonPigment(course.code);
            return (
              <a
                key={course.code}
                href={`/cursos?curso=${course.code}`}
                onClick={e => e.stopPropagation()}
                className="prof-course-tag prof-course-tag--link"
                style={{
                  borderLeftColor: pigment.bar,
                }}
                title={`${course.code} · ${course.name} (${course.sectionsCount} secciones, ${course.totalWeeklyHours}h/sem)`}
              >
                <strong className="prof-course-tag-code">{course.code}</strong>
                <span className="prof-course-tag-sep">·</span>
                <span className="prof-course-tag-name">{course.name}</span>
              </a>
            );
          })}
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
          <span className="prof-card-section-label">AULAS:</span>
          <div className="prof-rooms-chips">
            {professor.uniqueRooms.slice(0, 5).map(room => {
              const canonical = resolveCanonicalRoom(room);
              return (
                <a
                  key={room}
                  href={`/aulas?aula=${canonical.code}`}
                  onClick={e => e.stopPropagation()}
                  className="prof-room-tag prof-room-tag--link"
                  title={`Ver disponibilidad de ${canonical.displayName}`}
                >
                  <MapPin size={10} />
                  <span>{canonical.code}</span>
                </a>
              );
            })}
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
