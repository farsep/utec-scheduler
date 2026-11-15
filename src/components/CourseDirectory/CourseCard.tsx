import React, { memo, useRef, useState } from 'react';
import type { DayOfWeek } from '../../types/schedule';
import type { CourseExtendedInfo } from '../../types/courseDirectory';
import { ALL_DAYS, DAY_LABELS, resolveCanonicalRoom } from '../../utils/classroomUtils';
import { evaluateCourseLiveStatus } from '../../utils/courseDirectoryUtils';
import { getFacultyPolychrome } from '../../utils/scheduleUtils';
import { BroadcastIcon } from '../common/BroadcastIcon';
import {
  BookOpen,
  Star,
  Clock,
  MapPin,
  ChevronRight,
  Radio,
  Layers,
  GraduationCap,
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
  const facultyColors = getFacultyPolychrome(course.code || course.departmentLabel);

  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStateRef = useRef<{
    startX: number;
    startY: number;
    locked: 'none' | 'h' | 'v';
    lastDeltaX: number;
    didSwipe: boolean;
  }>({ startX: 0, startY: 0, locked: 'none', lastDeltaX: 0, didSwipe: false });

  const handleCardTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    if (typeof window === 'undefined' || window.innerWidth >= 768 || e.touches.length !== 1) return;
    touchStateRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      locked: 'none',
      lastDeltaX: 0,
      didSwipe: false,
    };
  };

  const handleCardTouchMove = (e: React.TouchEvent<HTMLElement>) => {
    if (typeof window === 'undefined' || window.innerWidth >= 768 || e.touches.length !== 1) return;
    const st = touchStateRef.current;
    if (st.locked === 'v') return;

    const deltaX = e.touches[0].clientX - st.startX;
    const deltaY = e.touches[0].clientY - st.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (st.locked === 'none') {
      if (absY > 10 && absX <= absY * 1.35) {
        st.locked = 'v';
        return;
      }
      if (absX > absY * 1.35 && absX > 10) {
        st.locked = 'h';
        st.didSwipe = true;
        setIsSwiping(true);
      } else if (Math.hypot(absX, absY) > 16) {
        st.locked = 'v';
        return;
      }
    }

    if (st.locked === 'h') {
      e.stopPropagation();
      const clampedX = Math.max(-110, Math.min(110, deltaX));
      st.lastDeltaX = clampedX;
      setSwipeX(clampedX);
    }
  };

  const handleCardTouchEnd = (e: React.TouchEvent<HTMLElement>) => {
    const st = touchStateRef.current;
    if (st.locked !== 'h') {
      st.locked = 'none';
      return;
    }
    e.stopPropagation();
    const finalX = st.lastDeltaX;
    st.locked = 'none';
    setIsSwiping(false);
    setSwipeX(0);

    if (finalX > 68) {
      const synthEvt = {
        stopPropagation: () => {},
        preventDefault: () => {},
      } as unknown as React.MouseEvent;
      onToggleVisitor(course, synthEvt);
    } else if (finalX < -68) {
      onOpenDetail(course);
    }

    window.setTimeout(() => {
      st.didSwipe = false;
    }, 120);
  };

  return (
    <div className="course-card-swipe-container relative overflow-hidden" data-no-page-swipe="true">
      {/* Orthogonal Swipe Action Trays (< 768px) */}
      <div
        className="course-swipe-tray-left md:hidden absolute inset-y-0 left-0 w-32 flex items-center justify-start px-4 bg-[#F5E8D3] border-r-2 border-[#B85D00] text-[#6E3600] font-mono text-[10px] font-bold uppercase tracking-wider select-none pointer-events-none"
        style={{ opacity: swipeX > 6 ? Math.min(1, swipeX / 68) : 0 }}
        aria-hidden="true"
      >
        ★ OYENTE
      </div>
      <div
        className="course-swipe-tray-right md:hidden absolute inset-y-0 right-0 w-32 flex items-center justify-end px-4 bg-[#E0EBF5] border-l-2 border-[#00668C] text-[#004D6B] font-mono text-[10px] font-bold uppercase tracking-wider select-none pointer-events-none"
        style={{ opacity: swipeX < -6 ? Math.min(1, Math.abs(swipeX) / 68) : 0 }}
        aria-hidden="true"
      >
        HORARIO →
      </div>

      <article
        className={`course-card glass-card ${isCurrentlyLive ? 'course-card--live' : ''} ${isVisitor ? 'course-card--visitor' : ''}`}
        style={{
          ['--faculty-accent' as string]: facultyColors.accent,
          ['--faculty-bg' as string]: facultyColors.bg,
          ['--faculty-text' as string]: facultyColors.text,
          transform: swipeX !== 0 ? `translate3d(${swipeX}px, 0, 0)` : undefined,
          transition: isSwiping ? 'none' : 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)',
          position: 'relative',
          zIndex: 1,
        }}
        onTouchStart={handleCardTouchStart}
        onTouchMove={handleCardTouchMove}
        onTouchEnd={handleCardTouchEnd}
        onTouchCancel={() => {
          touchStateRef.current.locked = 'none';
          setIsSwiping(false);
          setSwipeX(0);
        }}
        onClick={() => {
          if (touchStateRef.current.didSwipe) return;
          onOpenDetail(course);
        }}
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
        <div className="course-card-avatar">
          <span>{monogram}</span>
        </div>

        <div className="course-card-identity">
          <div className="course-card-badge-row">
            <span className="course-card-code-badge">
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
      <div
        className={`course-card-status-row ${
          isCurrentlyLive && liveSession
            ? 'course-card-status-row--live'
            : nextSession
            ? 'course-card-status-row--next'
            : 'course-card-status-row--idle'
        }`}
      >
        {isCurrentlyLive && liveSession ? (
          <div className="course-status-live-beacon">
            <div className="live-text-group">
              <span className="inline-flex items-center gap-1 font-bold">
                <BroadcastIcon className="w-3.5 h-3.5 shrink-0 text-[#0D7A4E]" /> En clase ahora:
              </span>
              <span>
                Sec. {liveSession.sectionNumber} en{' '}
                <a
                  href={`/aulas?aula=${resolveCanonicalRoom(liveSession.room).code}`}
                  onClick={e => e.stopPropagation()}
                  className="room-entity-link"
                >
                  {liveSession.room}
                </a>{' '}
                ({liveSession.startTime} - {liveSession.endTime})
              </span>
            </div>
          </div>
        ) : nextSession ? (
          <div className="course-status-next">
            <Clock size={13} />
            <span>
              Próxima sesión:{' '}
              <strong>
                {DAY_LABELS[nextSession.day]} {nextSession.startTime} - {nextSession.endTime}
              </strong>{' '}
              en{' '}
              <a
                href={`/aulas?aula=${resolveCanonicalRoom(nextSession.room).code}`}
                onClick={e => e.stopPropagation()}
                className="room-entity-link"
              >
                {nextSession.room}
              </a>{' '}
              (Sec. {nextSession.sectionNumber})
            </span>
          </div>
        ) : (
          <div className="course-status-idle">
            <span>Sin sesiones registradas esta semana</span>
          </div>
        )}
      </div>

      {/* 4-column Swiss Orthogonal KPI Metric Grid */}
      <div className="course-card-kpis">
        <div className="course-kpi-item" title="Horas de clase por semana">
          <span className="course-kpi-val course-kpi-val--hours">{course.totalWeeklyHours}h</span>
          <span className="course-kpi-label">SEMANALES</span>
        </div>

        <div className="course-kpi-item" title="Secciones aperturadas">
          <span className="course-kpi-val">{course.totalSectionsCount}</span>
          <span className="course-kpi-label">SECCIONES</span>
        </div>

        <div className="course-kpi-item" title="Docentes a cargo del curso">
          <span className="course-kpi-val">{course.uniqueProfessors.length}</span>
          <span className="course-kpi-label">DOCENTES</span>
        </div>

        <div className="course-kpi-item" title="Aulas asignadas en campus">
          <span className="course-kpi-val">{course.uniqueRooms.length}</span>
          <span className="course-kpi-label">AULAS</span>
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
              <a
                key={idx}
                href={`/profesores?profesor=${encodeURIComponent(prof.name)}`}
                onClick={e => e.stopPropagation()}
                className="course-prof-tag course-prof-tag--link prof-entity-link"
                title={`Ver perfil y horario de ${prof.name}`}
              >
                <GraduationCap size={11} />
                <span>{prof.name}</span>
              </a>
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
            {course.uniqueRooms.slice(0, 4).map(room => {
              const canonical = resolveCanonicalRoom(room);
              return (
                <a
                  key={room}
                  href={`/aulas?aula=${canonical.code}`}
                  onClick={e => e.stopPropagation()}
                  className="course-room-tag course-room-tag--link room-entity-link"
                  title={`Ver disponibilidad de ${canonical.displayName}`}
                >
                  <MapPin size={10} />
                  <span>{canonical.code}</span>
                </a>
              );
            })}
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
              <Star size={12} fill="#B85D00" stroke="#B85D00" />
              <span>En tu lista de Oyente</span>
            </span>
          ) : (
            <span className="course-footer-visitor-status">
              <Star size={12} stroke="#5A5852" fill="none" />
              <span>Oyente disponible</span>
            </span>
          )}
        </div>

        <button
          type="button"
          className="btn-view-schedule course-view-detail-btn"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail(course);
          }}
        >
          <span>Ver Horario</span>
          <ChevronRight size={14} />
        </button>
      </div>
      </article>
    </div>
  );
});

CourseCard.displayName = 'CourseCard';
