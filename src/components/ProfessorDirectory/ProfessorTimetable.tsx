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
        <div className="prof-timetable-body">
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
              const daySessions = professor.sessionsByDay[day] || [];
              const isToday = nowDay === day;

              return (
                <div
                  key={day}
                  className={`prof-timetable-day-column ${isToday ? 'prof-timetable-day-column--today' : ''}`}
                >
                  {daySessions.map(session => {
                    const top = ((session.startMinutes - minMinutes) / totalMinutes) * 100;
                    const height = ((session.endMinutes - session.startMinutes) / totalMinutes) * 100;
                    const isSelected = selectedSession?.id === session.id;
                    const isLive =
                      isToday &&
                      nowMinutes !== undefined &&
                      nowMinutes >= session.startMinutes &&
                      nowMinutes < session.endMinutes;

                    return (
                      <div
                        key={session.id}
                        className={`prof-session-block ${isSelected ? 'prof-session-block--selected' : ''} ${isLive ? 'prof-session-block--live' : ''}`}
                        style={{
                          top: `${top}%`,
                          height: `${Math.max(height, 4)}%`,
                          borderLeftColor: session.courseColor || '#3b82f6',
                          backgroundColor: `${session.courseColor || '#3b82f6'}1a`
                        }}
                        onClick={() => onSelectSession(isSelected ? null : session)}
                        title={`${session.courseCode}: ${session.courseName} (${session.sessionGroup})`}
                      >
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

                        <div className="prof-session-name" title={session.courseName}>
                          {session.courseName}
                        </div>

                        <div className="prof-session-footer">
                          <span className="prof-session-group-tag">
                            {session.sessionGroup}
                          </span>

                          <span className="prof-session-room-tag">
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
