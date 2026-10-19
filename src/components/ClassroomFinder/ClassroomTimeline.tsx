import React from 'react';
import type { ClassroomAvailability, OccupiedBlock, FreeBlock } from '../../types/classroom';
import { UNIVERSITY_START_MINUTES, UNIVERSITY_END_MINUTES } from '../../utils/classroomUtils';

interface ClassroomTimelineProps {
  availability: ClassroomAvailability;
  nowMinutes?: number;
  isToday?: boolean;
  selectedRange?: { startMinutes: number; endMinutes: number } | null;
}

export const ClassroomTimeline: React.FC<ClassroomTimelineProps> = ({
  availability,
  nowMinutes,
  isToday,
  selectedRange
}) => {
  const totalRange = UNIVERSITY_END_MINUTES - UNIVERSITY_START_MINUTES; // 900 minutes

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
      {/* Timeline track container */}
      <div className="classroom-timeline-track" title="Línea de tiempo 07:00 a 22:00">
        {/* Free blocks (Green tint) */}
        {availability.freeBlocksToday.map((block, idx) => {
          const left = getPercent(block.startMinutes);
          const width = getWidthPercent(block.startMinutes, block.endMinutes);
          return (
            <div
              key={`free-${idx}`}
              className="timeline-block timeline-block--free"
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`Libre: ${block.startTime} - ${block.endTime} (${block.durationMinutes} min)`}
            />
          );
        })}

        {/* Occupied blocks (Crimson / Violet blocks) */}
        {availability.occupiedBlocksToday.map((block, idx) => {
          const left = getPercent(block.startMinutes);
          const width = getWidthPercent(block.startMinutes, block.endMinutes);
          return (
            <div
              key={`occ-${idx}`}
              className="timeline-block timeline-block--occupied"
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`En clase: ${block.session.courseCode} - ${block.session.courseName} (${block.startTime} - ${block.endTime}) • ${block.session.professor || 'Docente'}`}
            >
              {width > 12 && (
                <span className="timeline-block-label">
                  {block.session.courseCode}
                </span>
              )}
            </div>
          );
        })}

        {/* Highlighted Search Window (Cyan border glow if custom search active) */}
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

        {/* Current Time Needle (if today and within 07:00 - 22:00) */}
        {isToday && nowMinutes !== undefined && nowMinutes >= UNIVERSITY_START_MINUTES && nowMinutes <= UNIVERSITY_END_MINUTES && (
          <div
            className="timeline-now-marker"
            style={{ left: `${getPercent(nowMinutes)}%` }}
            title="Hora actual"
          >
            <div className="timeline-now-dot" />
            <div className="timeline-now-line" />
          </div>
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
};
