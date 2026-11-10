import React, { useMemo } from 'react';
import type { ClassroomAvailability } from '../../types/classroom';
import { UNIVERSITY_START_MINUTES, UNIVERSITY_END_MINUTES } from '../../utils/classroomUtils';

interface ClassroomTimelineProps {
  availability: ClassroomAvailability;
  nowMinutes?: number;
  isToday?: boolean;
  selectedRange?: { startMinutes: number; endMinutes: number } | null;
}

const SWISS_HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21] as const;

interface TimelineRun {
  status: 'free' | 'occupied';
  startHour: number;
  endHour: number;
  spanHours: number;
  courseCode?: string;
  courseName?: string;
  startTime?: string;
  endTime?: string;
}

export const ClassroomTimeline: React.FC<ClassroomTimelineProps> = React.memo(({
  availability,
  nowMinutes,
  isToday,
  selectedRange
}) => {
  const totalRange = UNIVERSITY_END_MINUTES - UNIVERSITY_START_MINUTES; // 900 minutes (07:00 to 22:00)

  const getPercent = (minutes: number) => {
    const clamped = Math.max(UNIVERSITY_START_MINUTES, Math.min(UNIVERSITY_END_MINUTES, minutes));
    return ((clamped - UNIVERSITY_START_MINUTES) / totalRange) * 100;
  };

  const getWidthPercent = (startMins: number, endMins: number) => {
    const start = Math.max(UNIVERSITY_START_MINUTES, startMins);
    const end = Math.min(UNIVERSITY_END_MINUTES, endMins);
    return Math.max(0, ((end - start) / totalRange) * 100);
  };

  // Group consecutive hours of the same course/state into merged runs
  const runs = useMemo(() => {
    const result: TimelineRun[] = [];
    let currentRun: TimelineRun | null = null;

    for (const hour of SWISS_HOURS) {
      const slotStart = hour * 60;
      const slotEnd = (hour + 1) * 60;
      const occupiedBlock = availability.occupiedBlocksToday.find(
        b => Math.max(b.startMinutes, slotStart) < Math.min(b.endMinutes, slotEnd)
      );

      const status = occupiedBlock ? 'occupied' : 'free';
      const courseCode = occupiedBlock?.session.courseCode;
      const courseName = occupiedBlock?.session.courseName;
      const startTime = occupiedBlock?.startTime;
      const endTime = occupiedBlock?.endTime;

      if (!currentRun) {
        currentRun = {
          status,
          startHour: hour,
          endHour: hour + 1,
          spanHours: 1,
          courseCode,
          courseName,
          startTime,
          endTime
        };
      } else if (
        currentRun.status === status &&
        (status === 'free' || currentRun.courseCode === courseCode)
      ) {
        currentRun.endHour = hour + 1;
        currentRun.spanHours += 1;
        if (endTime) currentRun.endTime = endTime;
      } else {
        result.push(currentRun);
        currentRun = {
          status,
          startHour: hour,
          endHour: hour + 1,
          spanHours: 1,
          courseCode,
          courseName,
          startTime,
          endTime
        };
      }
    }
    if (currentRun) result.push(currentRun);
    return result;
  }, [availability.occupiedBlocksToday]);

  return (
    <div className="classroom-timeline-wrap">
      {/* 15-Segment Merged-Run Swiss Hourly Strip (07:00 to 22:00) */}
      <div className="classroom-timeline-track swiss-hourly-strip" title="Línea de tiempo 07:00 a 22:00 (15 horas)">
        {runs.map((run) => {
          const startStr = `${String(run.startHour).padStart(2, '0')}:00`;
          const endStr = `${String(run.endHour).padStart(2, '0')}:00`;
          const runLabel = `${startStr}–${endStr}`;

          if (run.status === 'occupied' && run.courseCode) {
            return (
              <div
                key={`occ-${run.startHour}-${run.courseCode}`}
                className={`swiss-hour-cell swiss-hour-cell--occupied ${
                  run.spanHours === 1 ? 'swiss-hour-cell--span1' : ''
                }`}
                style={{ gridColumn: `span ${run.spanHours}` }}
                title={`${runLabel} · Ocupada: ${run.courseCode} · ${run.courseName || ''} (${run.startTime || startStr} - ${run.endTime || endStr})`}
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.href = `/cursos?curso=${encodeURIComponent(run.courseCode!)}`;
                }}
              >
                <span
                  className={`swiss-hour-cell-code ${
                    run.spanHours === 1 ? 'swiss-hour-cell-code--short' : ''
                  }`}
                >
                  {run.courseCode}
                </span>
              </div>
            );
          }

          // Render free slots hour-by-hour so each hour has its dashed tick divider
          const freeHours: React.ReactNode[] = [];
          for (let h = run.startHour; h < run.endHour; h++) {
            const hStart = `${String(h).padStart(2, '0')}:00`;
            const hEnd = `${String(h + 1).padStart(2, '0')}:00`;
            freeHours.push(
              <div
                key={`free-${h}`}
                className="swiss-hour-cell swiss-hour-cell--free"
                style={{ gridColumn: 'span 1' }}
                title={`${hStart}–${hEnd} · Libre`}
              />
            );
          }
          return freeHours;
        })}

        {/* Highlighted Search Window (if custom search active) */}
        {selectedRange && (
          <div
            className="timeline-search-window"
            style={{
              left: `${getPercent(selectedRange.startMinutes)}%`,
              width: `${getWidthPercent(selectedRange.startMinutes, selectedRange.endMinutes)}%`
            }}
            title="Horario de tu búsqueda"
          />
        )}

        {/* Current Time Needle (Sharp 2px solid #D9381E vertical needle with 6x6px square cap) */}
        {isToday && nowMinutes !== undefined && nowMinutes >= UNIVERSITY_START_MINUTES && nowMinutes <= UNIVERSITY_END_MINUTES && (
          <div
            className="timeline-now-marker"
            style={{ left: `${getPercent(nowMinutes)}%` }}
            title="Hora actual"
          />
        )}
      </div>

      {/* Axis markers */}
      <div className="classroom-timeline-axis">
        <span>07:00</span>
        <span>10:00</span>
        <span>13:00</span>
        <span>16:00</span>
        <span>19:00</span>
        <span>22:00</span>
      </div>
    </div>
  );
});

ClassroomTimeline.displayName = 'ClassroomTimeline';
