import React, { useMemo } from 'react';
import type { DayOfWeek } from '../../types/schedule';
import type { ProfessorInfo, ProfessorSession } from '../../types/professor';
import { ALL_DAYS, DAY_LABELS } from '../../utils/classroomUtils';
import { minutesToTime } from '../../utils/scheduleUtils';
import { MapPin, Clock, Users, Laptop, Building, GraduationCap, CheckCircle } from 'lucide-react';

interface ProfessorTimetableProps {
  professor: ProfessorInfo;
  selectedSession: ProfessorSession | null;
  onSelectSession: (session: ProfessorSession | null) => void;
  nowDay?: DayOfWeek;
  nowMinutes?: number;
}

function abbreviateSessionGroup(group: string): string {
  if (!group) return '';
  return group
    .replace(/LABORATORIO/gi, 'LAB')
    .replace(/PRÁCTICA/gi, 'PRÁC')
    .replace(/PRACTICA/gi, 'PRÁC')
    .replace(/TEORÍA/gi, 'TEO')
    .replace(/TEORIA/gi, 'TEO');
}

interface AutoAdvanceCarouselProps {
  children: React.ReactNode;
  className?: string;
  extraPadding?: number;
}

/**
 * Auto-advancing Carousel Ticker for compact session blocks:
 * When content overflows its container, it smoothly advances to reveal what was
 * initially clipped, rests so the user can read the full info, and glides back.
 */
const AutoAdvanceCarousel: React.FC<AutoAdvanceCarouselProps> = ({
  children,
  className = '',
  extraPadding = 8
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = React.useState(false);
  const [scrollDistance, setScrollDistance] = React.useState(0);

  React.useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && trackRef.current) {
        const overflow = trackRef.current.scrollWidth - containerRef.current.clientWidth;
        if (overflow > 1) {
          setIsOverflowing(true);
          setScrollDistance(Math.ceil(overflow) + extraPadding);
        } else {
          setIsOverflowing(false);
          setScrollDistance(0);
        }
      }
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(checkOverflow);
      ro.observe(containerRef.current);
      if (trackRef.current) {
        ro.observe(trackRef.current);
      }
    }

    return () => {
      window.removeEventListener('resize', checkOverflow);
      ro?.disconnect();
    };
  }, [children, extraPadding]);

  return (
    <div
      ref={containerRef}
      className={`prof-carousel-container ${isOverflowing ? 'is-overflowing' : ''} ${className}`}
    >
      <div
        ref={trackRef}
        className={`prof-carousel-track ${isOverflowing ? 'is-overflowing' : ''}`}
        style={
          isOverflowing
            ? ({ '--scroll-distance': `-${scrollDistance}px` } as React.CSSProperties)
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
};

interface PositionedSession {
  session: ProfessorSession;
  colIndex: number;
  totalCols: number;
}

/**
 * Computes non-overlapping horizontal column layouts for events that share the same timeslot
 * (e.g. alternating Semana A / Semana B sessions) so they are placed side-by-side instead of stacking.
 */
function computeSessionLayouts(sessions: ProfessorSession[]): PositionedSession[] {
  if (sessions.length === 0) return [];

  const sorted = [...sessions].sort(
    (a, b) => a.startMinutes - b.startMinutes || (b.endMinutes - b.startMinutes) - (a.endMinutes - a.startMinutes)
  );

  const clusters: ProfessorSession[][] = [];
  let currentCluster: ProfessorSession[] = [];
  let clusterEnd = -1;

  for (const session of sorted) {
    if (currentCluster.length === 0 || session.startMinutes < clusterEnd) {
      currentCluster.push(session);
      clusterEnd = Math.max(clusterEnd, session.endMinutes);
    } else {
      clusters.push(currentCluster);
      currentCluster = [session];
      clusterEnd = session.endMinutes;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const result: PositionedSession[] = [];

  for (const cluster of clusters) {
    const columns: ProfessorSession[][] = [];
    for (const session of cluster) {
      let placed = false;
      for (let i = 0; i < columns.length; i++) {
        const lastInCol = columns[i][columns[i].length - 1];
        if (lastInCol.endMinutes <= session.startMinutes) {
          columns[i].push(session);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([session]);
      }
    }

    const totalCols = columns.length;
    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
      for (const session of columns[colIndex]) {
        result.push({
          session,
          colIndex,
          totalCols
        });
      }
    }
  }

  return result;
}

export const ProfessorTimetable: React.FC<ProfessorTimetableProps> = ({
  professor,
  selectedSession,
  onSelectSession,
  nowDay,
  nowMinutes
}) => {
  // Determine timetable bounds (start from at most 07:00 or earliest class, end at at least 21:00 or latest class)
  const { minHour, maxHour, totalHours } = useMemo(() => {
    let minH = 7;
    let maxH = 22;

    if (professor.sessions.length > 0) {
      const earliestHour = Math.floor(professor.earliestStartMinutes / 60);
      const latestHour = Math.ceil(professor.latestEndMinutes / 60);
      minH = Math.max(7, Math.min(earliestHour, 8));
      maxH = Math.min(22, Math.max(latestHour, 19));
    }

    return {
      minHour: minH,
      maxHour: maxH,
      totalHours: maxH - minH
    };
  }, [professor]);

  const minMinutes = minHour * 60;
  const totalMinutes = totalHours * 60;

  // Generate hourly time marks for the axis
  const timeMarks = useMemo(() => {
    const marks: { hour: number; label: string; topPercent: number }[] = [];
    for (let h = minHour; h <= maxHour; h++) {
      marks.push({
        hour: h,
        label: `${String(h).padStart(2, '0')}:00`,
        topPercent: ((h * 60 - minMinutes) / totalMinutes) * 100
      });
    }
    return marks;
  }, [minHour, maxHour, minMinutes, totalMinutes]);

  // Check if now indicator should be displayed
  const showNowIndicator = useMemo(() => {
    if (!nowDay || nowMinutes === undefined) return false;
    return nowMinutes >= minMinutes && nowMinutes <= minMinutes + totalMinutes;
  }, [nowDay, nowMinutes, minMinutes, totalMinutes]);

  const nowTopPercent = useMemo(() => {
    if (!nowMinutes) return 0;
    return ((nowMinutes - minMinutes) / totalMinutes) * 100;
  }, [nowMinutes, minMinutes, totalMinutes]);

  // Dynamic slot height per hour: 60px per hour guarantees comfortable breathing room without needing vertical expansion
  const slotHeightPerHour = 60;
  const gridHeight = Math.max(620, totalHours * slotHeightPerHour);

  return (
    <div className="prof-timetable-wrap">
      {/* Visual Timetable Grid */}
      <div className="prof-timetable-container">
        {/* Header Days Row */}
        <div className="prof-timetable-header">
          <div className="prof-timetable-time-corner">
            <Clock size={14} />
            <span>Hora</span>
          </div>

          <div className="prof-timetable-days-grid">
            {ALL_DAYS.map(day => {
              const daySessionsCount = (professor.sessionsByDay[day] || []).length;
              const isToday = nowDay === day;
              const isBusiest = professor.busiestDay === day && daySessionsCount > 0;

              return (
                <div
                  key={day}
                  className={`prof-timetable-day-col-header ${isToday ? 'prof-timetable-day-col-header--today' : ''}`}
                >
                  <div className="prof-day-name-row">
                    <span className="prof-day-abbr">{day}</span>
                    <span className="prof-day-full">{DAY_LABELS[day]}</span>
                  </div>
                  <div className="prof-day-meta-row">
                    {daySessionsCount > 0 ? (
                      <span className={`prof-day-badge ${isBusiest ? 'prof-day-badge--busiest' : ''}`}>
                        {daySessionsCount} {daySessionsCount === 1 ? 'clase' : 'clases'}
                      </span>
                    ) : (
                      <span className="prof-day-badge prof-day-badge--empty">Libre</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Timetable Body (Time Ruler + 6 Day Columns) */}
        <div className="prof-timetable-body" style={{ height: `${gridHeight}px` }}>
          {/* Left Time Axis */}
          <div className="prof-timetable-time-axis">
            {timeMarks.map(mark => (
              <div
                key={mark.hour}
                className="prof-time-mark"
                style={{ top: `${mark.topPercent}%` }}
              >
                <span>{mark.label}</span>
              </div>
            ))}
          </div>

          {/* 6 Days Grid Columns */}
          <div className="prof-timetable-columns-container">
            {/* Horizontal Grid lines across columns */}
            {timeMarks.map(mark => (
              <div
                key={`grid-${mark.hour}`}
                className="prof-grid-hour-line"
                style={{ top: `${mark.topPercent}%` }}
              />
            ))}

            {/* Live horizontal line if today */}
            {showNowIndicator && (
              <div
                className="prof-timetable-now-line"
                style={{ top: `${nowTopPercent}%` }}
                title={`Hora actual: ${minutesToTime(nowMinutes || 0)}`}
              >
                <span className="prof-now-line-pill">Ahora {minutesToTime(nowMinutes || 0)}</span>
              </div>
            )}

            {/* 6 Columns */}
            {ALL_DAYS.map(day => {
              const rawSessions = professor.sessionsByDay[day] || [];
              // Prevent duplicate overlapping sessions on the same timeslot
              const seenSlot = new Set<string>();
              const uniqueSessions = rawSessions.filter(s => {
                const slotKey = `${s.courseCode}-${s.sessionGroup}-${s.startMinutes}-${s.endMinutes}`;
                if (seenSlot.has(slotKey)) return false;
                seenSlot.add(slotKey);
                return true;
              });
              const positionedSessions = computeSessionLayouts(uniqueSessions);
              const isToday = nowDay === day;

              return (
                <div
                  key={day}
                  className={`prof-timetable-day-column ${isToday ? 'prof-timetable-day-column--today' : ''}`}
                >
                  {positionedSessions.map(({ session, colIndex, totalCols }) => {
                    const top = ((session.startMinutes - minMinutes) / totalMinutes) * 100;
                    const height = ((session.endMinutes - session.startMinutes) / totalMinutes) * 100;
                    const isSelected = selectedSession?.id === session.id;
                    const isLive =
                      isToday &&
                      nowMinutes !== undefined &&
                      nowMinutes >= session.startMinutes &&
                      nowMinutes < session.endMinutes;

                    const durationMinutes = session.endMinutes - session.startMinutes;
                    const isShortBlock = durationMinutes <= 75; // 1-hour or 75-min short session
                    const isLongBlock = durationMinutes >= 150; // 2.5h, 3h, 4h+ long session
                    const isNarrowBlock = totalCols > 1;

                    const colWidthPercent = 100 / totalCols;
                    const leftPercent = colIndex * colWidthPercent;

                    return (
                      <div
                        key={session.id}
                        className={`prof-session-block ${isShortBlock ? 'prof-session-block--short' : ''} ${isLongBlock ? 'prof-session-block--long' : ''} ${isNarrowBlock ? 'prof-session-block--narrow' : ''} ${isSelected ? 'prof-session-block--selected' : ''} ${isLive ? 'prof-session-block--live' : ''}`}
                        style={{
                          top: `${top}%`,
                          height: `calc(${height}% - 2px)`,
                          left: totalCols > 1 ? `calc(${leftPercent}% + 2px)` : '3px',
                          width: totalCols > 1 ? `calc(${colWidthPercent}% - 4px)` : 'calc(100% - 6px)',
                          right: 'auto',
                          borderLeftColor: session.courseColor || '#3b82f6',
                          background: `linear-gradient(135deg, ${session.courseColor || '#3b82f6'}26 0%, #0d1527 100%)`
                        }}
                        onClick={() => onSelectSession(isSelected ? null : session)}
                        title={`${session.courseCode}: ${session.courseName}\n${session.sessionGroup}\n${session.startTime} - ${session.endTime}\nAula: ${session.roomDisplayName}`}
                      >
                        {isShortBlock ? (
                          /* Compact 2-row layout with AutoAdvanceCarousel ticker: strictly bounded within 1 hour, auto-advances overflowing info */
                          <div className="prof-session-short-inner">
                            <div className="prof-session-short-row-top">
                              <span
                                className="prof-session-code"
                                style={{ color: session.courseColor || '#60a5fa' }}
                              >
                                {session.courseCode}
                              </span>
                              <AutoAdvanceCarousel className="prof-session-short-title-wrap">
                                <span className="prof-session-short-title" title={session.courseName}>
                                  {session.courseName}
                                </span>
                              </AutoAdvanceCarousel>
                            </div>

                            <div className="prof-session-short-row-bottom">
                              <AutoAdvanceCarousel className="prof-session-short-bottom-wrap">
                                <div className="prof-session-short-bottom-content">
                                  <span className="prof-session-short-time">
                                    {session.startTime} - {session.endTime}
                                  </span>
                                  <span className="prof-session-group-tag" title={session.sessionGroup}>
                                    {abbreviateSessionGroup(session.sessionGroup)}
                                  </span>
                                  <span className="prof-session-room-tag" title={session.roomDisplayName}>
                                    <MapPin size={9} />
                                    {session.roomCode}
                                  </span>
                                  {isLive && (
                                    <span className="prof-session-live-beacon">
                                      VIVO
                                    </span>
                                  )}
                                </div>
                              </AutoAdvanceCarousel>
                            </div>
                          </div>
                        ) : (
                          /* Structured cohesive layout for 2h - 4h+ sessions */
                          <div className="prof-session-block-inner">
                            <div className="prof-session-block-header">
                              <span
                                className="prof-session-code"
                                style={{ color: session.courseColor || '#60a5fa' }}
                              >
                                {session.courseCode}
                              </span>
                              <span className="prof-session-time">
                                {session.startTime} - {session.endTime}
                              </span>
                            </div>

                            <div className={`prof-session-name ${isLongBlock ? 'prof-session-name--long' : ''}`} title={session.courseName}>
                              {session.courseName}
                            </div>

                            {isLongBlock && (
                              <div className="prof-session-long-badge-row">
                                <span className="prof-session-duration-tag">
                                  {session.durationHours}h de clase
                                </span>
                                {session.modality && (
                                  <span className="prof-session-modality-tag">
                                    {session.modality}
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="prof-session-footer">
                              <span className="prof-session-group-tag" title={session.sessionGroup}>
                                {isNarrowBlock ? abbreviateSessionGroup(session.sessionGroup) : session.sessionGroup}
                              </span>

                              <span className="prof-session-room-tag" title={session.roomDisplayName}>
                                <MapPin size={11} />
                                {session.roomCode}
                              </span>

                              {isLive && (
                                <span className="prof-session-live-beacon">
                                  EN VIVO
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
