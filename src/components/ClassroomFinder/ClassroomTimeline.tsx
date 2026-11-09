import React from 'react';
import type { ClassroomAvailability } from '../../types/classroom';
import { UNIVERSITY_START_MINUTES, UNIVERSITY_END_MINUTES } from '../../utils/classroomUtils';

interface ClassroomTimelineProps {
  availability: ClassroomAvailability;
  nowMinutes?: number;
  isToday?: boolean;
  selectedRange?: { startMinutes: number; endMinutes: number } | null;
}

const SWISS_HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21] as const;

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

  return (
    <div className="classroom-timeline-wrap">
      {/* 15-Segment Discrete Swiss Hourly Strip (07:00 to 22:00) */}
      <div className="classroom-timeline-track swiss-hourly-strip" title="Línea de tiempo 07:00 a 22:00 (15 bloques de 1h)">
        {SWISS_HOURS.map((hour) => {
          const slotStart = hour * 60;
          const slotEnd = (hour + 1) * 60;
          const hourLabel = `${String(hour).padStart(2, '0')}:00–${String(hour + 1).padStart(2, '0')}:00`;

          const occupiedBlock = availability.occupiedBlocksToday.find(
            b => Math.max(b.startMinutes, slotStart) < Math.min(b.endMinutes, slotEnd)
          );

          if (occupiedBlock) {
            const prevSlotStart = (hour - 1) * 60;
            const prevSlotEnd = hour * 60;
            const isFirstHourOfBlock = !availability.occupiedBlocksToday.some(
              b => b.session.courseCode === occupiedBlock.session.courseCode &&
                   Math.max(b.startMinutes, prevSlotStart) < Math.min(b.endMinutes, prevSlotEnd)
            );

            return (
              <div
                key={hour}
                className="swiss-hour-cell swiss-hour-cell--occupied"
                title={`${hourLabel} · Ocupada: ${occupiedBlock.session.courseCode} · ${occupiedBlock.session.courseName} (${occupiedBlock.startTime} - ${occupiedBlock.endTime})`}
              >
                {isFirstHourOfBlock && (
                  <span className="swiss-hour-cell-code">
                    {occupiedBlock.session.courseCode}
                  </span>
                )}
              </div>
            );
          }

          return (
            <div
              key={hour}
              className="swiss-hour-cell swiss-hour-cell--free"
              title={`${hourLabel} · Libre`}
            />
          );
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

        {/* Current Time Needle (Sharp 2px solid #18181A vertical needle) */}
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
