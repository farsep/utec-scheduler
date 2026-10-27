import React, { memo } from 'react';
import type { DayOfWeek } from '../../types/schedule';
import type { CourseExtendedInfo } from '../../types/courseDirectory';
import { ALL_DAYS, DAY_LABELS } from '../../utils/classroomUtils';
import { evaluateCourseLiveStatus } from '../../utils/courseDirectoryUtils';
import {
  BookOpen,
  Star,
  Clock,
  MapPin,
  ChevronRight,
  Radio,
  Layers,
  GraduationCap,
  Sparkles,
  Laptop
} from 'lucide-react';

interface CourseCardProps {
  course: CourseExtendedInfo;
  nowDay: DayOfWeek;
  nowMinutes: number;
  isVisitor: boolean;
  onToggleVisitor: (course: CourseExtendedInfo, e: React.MouseEvent) => void;
  onOpenDetail: (course: CourseExtendedInfo) => void;
}

/**
 * Derives a vibrant two-color gradient based on the course code or department
 */
function getCourseAvatarGradient(code: string, deptColor?: string): string {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = code.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash % 360);
  const h2 = (h1 + 45) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 70%, 48%) 0%, hsl(${h2}, 80%, 38%) 100%)`;
}

/**
 * Extracts a concise 2-3 char monogram from the course code (e.g. "CC" from "CC1103", "AD" from "AD2008")
 */
function getCourseMonogram(code: string): string {
  const lettersMatch = code.match(/^[A-Za-z]+/);
  if (lettersMatch && lettersMatch[0].length >= 2) {
    return lettersMatch[0].slice(0, 3).toUpperCase();
  }
  return code.slice(0, 2).toUpperCase();
}

export const CourseCard: React.FC<CourseCardProps> = memo(({
  course,
  nowDay,
  nowMinutes,
  isVisitor,
  onToggleVisitor,
  onOpenDetail
}) => {
  const { isCurrentlyLive, liveSession, nextSession } = evaluateCourseLiveStatus(
    course,
    nowDay,
    nowMinutes
  );

  const monogram = getCourseMonogram(course.code);
  const avatarGradient = getCourseAvatarGradient(course.code, course.departmentColor);

  return (
    <article
      className={`course-card glass-card ${isCurrentlyLive ? 'course-card--live' : ''} ${isVisitor ? 'course-card--visitor' : ''}`}
      onClick={() => onOpenDetail(course)}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDetail(course);
        }
      }}
      aria-label={`Ver detalles del curso ${course.code} - ${course.name}`}
    >
      {/* Top Header: Avatar Monogram, Department, Code, Credits, Bookmark Star */}
      <div className="course-card-header">
        <div className="course-card-avatar" style={{ background: avatarGradient }}>
          <span>{monogram}</span>
        </div>

        <div className="course-card-identity">
          <div className="course-card-badge-row">
            <span
              className="course-card-code-badge"
              style={{
                borderColor: `${course.departmentColor}45`,
                backgroundColor: `${course.departmentColor}18`,
                color: course.departmentColor
              }}
            >
              {course.code}
            </span>

            <span className="course-card-dept-tag" title={course.departmentLabel}>
              {course.departmentLabel}
            </span>

            {course.credits && (
              <span className="course-card-credits-tag">
                {course.credits} Cr.
              </span>
            )}
          </div>

          <h3 className="course-card-name" title={course.name}>
            {course.name}
          </h3>
        </div>

        {/* Quick Visitor Bookmark Star Button */}
        <button
          type="button"
          className={`course-card-bookmark-btn ${isVisitor ? 'course-card-bookmark-btn--active' : ''}`}
          onClick={e => onToggleVisitor(course, e)}
          title={isVisitor ? 'Quitar de mis cursos de oyente' : 'Guardar en mis cursos de oyente'}
          aria-label={isVisitor ? 'Quitar de oyente' : 'Marcar como oyente'}
        >
          <Star size={16} className={isVisitor ? 'star-filled-gold' : ''} />
        </button>
      </div>

      {/* Live Status Banner or Next Class Indicator */}
      <div className="course-card-status-row">
        {isCurrentlyLive && liveSession ? (
          <div className="course-status-live-beacon">
            <span className="live-dot-ping" />
            <span className="live-dot" />
            <div className="live-text-group">
              <strong>En clase ahora:</strong>
              <span>
                Sec. {liveSession.sectionNumber} en {liveSession.room} ({liveSession.startTime} - {liveSession.endTime})
              </span>
            </div>
          </div>
        ) : nextSession ? (
          <div className="course-status-next">
            <Clock size={13} className="text-muted" />
            <span>
              Próxima sesión:{' '}
              <strong>
                {DAY_LABELS[nextSession.day]} {nextSession.startTime} - {nextSession.endTime}
              </strong>{' '}
              en {nextSession.room} (Sec. {nextSession.sectionNumber})
            </span>
          </div>
        ) : (
          <div className="course-status-idle">
            <span>Sin sesiones registradas esta semana</span>
          </div>
        )}
      </div>

      {/* 4-column KPI Stats Highlights Bar */}
      <div className="course-card-kpis">
        <div className="course-kpi-item" title="Horas de clase por semana">
          <span className="course-kpi-val text-accent">{course.totalWeeklyHours}h</span>
          <span className="course-kpi-label">Semanales</span>
        </div>

        <div className="course-kpi-item" title="Secciones aperturadas">
          <span className="course-kpi-val text-emerald">{course.totalSectionsCount}</span>
          <span className="course-kpi-label">Secciones</span>
        </div>

        <div className="course-kpi-item" title="Docentes a cargo del curso">
          <span className="course-kpi-val text-purple">{course.uniqueProfessors.length}</span>
          <span className="course-kpi-label">Docentes</span>
        </div>

        <div className="course-kpi-item" title="Aulas asignadas en campus">
          <span className="course-kpi-val text-amber">{course.uniqueRooms.length}</span>
          <span className="course-kpi-label">Aulas</span>
        </div>
      </div>

      {/* Days of Week Mini Matrix */}
      <div className="course-card-days-row">
        <span className="course-card-section-label">Días:</span>
        <div className="course-days-chips">
          {ALL_DAYS.map(day => {
            const hasClass = course.daysTaught.includes(day);
            const isToday = nowDay === day;
            const isCurrentClassDay = isCurrentlyLive && nowDay === day;

            return (
              <span
                key={day}
                className={`course-day-chip ${hasClass ? 'course-day-chip--active' : ''} ${isToday ? 'course-day-chip--today' : ''} ${isCurrentClassDay ? 'course-day-chip--live' : ''}`}
                title={hasClass ? `${course.code} se dicta los ${DAY_LABELS[day]}` : `Sin clases el ${DAY_LABELS[day]}`}
              >
                {day}
              </span>
            );
          })}
        </div>
      </div>

      {/* Sections & Modalities Chips Preview */}
      <div className="course-card-sections-row">
        <span className="course-card-section-label">Secciones:</span>
        <div className="course-sections-chips">
          {course.extendedSections.slice(0, 3).map(sec => {
            const modLabel = sec.modalities.length > 0 ? sec.modalities.join(', ') : 'Presencial';
            const isPresencial = sec.modalities.includes('Presencial') || sec.modalities.length === 0;

            return (
              <span
                key={sec.sectionNumber}
                className={`course-sec-tag ${isPresencial ? 'course-sec-tag--presencial' : 'course-sec-tag--virtual'}`}
                title={`Sección ${sec.sectionNumber} (${modLabel}) - ${sec.totalWeeklyHours}h/sem`}
              >
                Sec. {sec.sectionNumber} {modLabel ? `• ${modLabel}` : ''}
              </span>
            );
          })}
          {course.extendedSections.length > 3 && (
            <span className="course-sec-tag course-sec-tag--more">
              +{course.extendedSections.length - 3} más
            </span>
          )}
        </div>
      </div>

      {/* Professors Preview Chips */}
      {course.uniqueProfessors.length > 0 && (
        <div className="course-card-profs-row">
          <span className="course-card-section-label">Docentes:</span>
          <div className="course-profs-chips">
            {course.uniqueProfessors.slice(0, 2).map((prof, idx) => (
              <span key={idx} className="course-prof-tag" title={prof.name}>
                <GraduationCap size={11} />
                <span>{prof.name}</span>
              </span>
            ))}
            {course.uniqueProfessors.length > 2 && (
              <span className="course-prof-tag course-prof-tag--more">
                +{course.uniqueProfessors.length - 2}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Classrooms Preview Chips */}
      {course.uniqueRooms.length > 0 && (
        <div className="course-card-rooms-row">
          <span className="course-card-section-label">Aulas:</span>
          <div className="course-rooms-chips">
            {course.uniqueRooms.slice(0, 4).map(room => (
              <span key={room} className="course-room-tag" title={`Aula ${room}`}>
                <MapPin size={10} />
                <span>{room}</span>
              </span>
            ))}
            {course.uniqueRooms.length > 4 && (
              <span className="course-room-tag course-room-tag--more">
                +{course.uniqueRooms.length - 4}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Footer CTA */}
      <div className="course-card-footer">
        <div className="course-card-footer-left">
          {isVisitor ? (
            <span className="course-footer-visitor-status course-footer-visitor-status--active">
              <Star size={12} className="star-filled-gold" />
              <span>En tu lista de Oyente</span>
            </span>
          ) : (
            <span className="course-footer-visitor-status">
              <Sparkles size={12} className="text-accent" />
              <span>Oyente disponible</span>
            </span>
          )}
        </div>

        <span className="course-view-detail-btn">
          <span>Ver Horarios y Aulas</span>
          <ChevronRight size={15} />
        </span>
      </div>
    </article>
  );
});

CourseCard.displayName = 'CourseCard';
