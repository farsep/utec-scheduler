import React, { useState } from 'react';
import { DAYS, DAY_NAMES, getCourseGradient } from '../utils/scheduleUtils';
import type { Course, DayOfWeek, Conflict } from '../types/schedule';
import { Trash2, Plus, Sparkles } from 'lucide-react';

interface TimetableGridProps {
  courses: Course[];
  selectedSections: Record<string, string>;
  conflicts: Conflict[];
  onSelectSection: (courseCode: string, sectionNumber: string) => void;
  onRemoveSection: (courseCode: string) => void;
}

const START_HOUR = 7; // 07:00
const END_HOUR = 22; // 22:00
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60; // 15 hours = 900 minutes

export const TimetableGrid: React.FC<TimetableGridProps> = ({
  courses,
  selectedSections,
  conflicts,
  onSelectSection,
  onRemoveSection
}) => {
  const [dragOverDay, setDragOverDay] = useState<DayOfWeek | null>(null);

  // Generate hour labels (07:00, 08:00, ..., 21:00)
  const hours = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    hours.push(`${h.toString().padStart(2, '0')}:00`);
  }

  // Find all active sessions to place on canvas
  const scheduledBlocks: {
    course: Course;
    sectionNumber: string;
    sessionGroup: string;
    modality: string;
    day: DayOfWeek;
    startTime: string;
    endTime: string;
    startMinutes: number;
    endMinutes: number;
    location: string;
    professor: string;
    hasConflict: boolean;
  }[] = [];

  Object.entries(selectedSections).forEach(([courseCode, secNum]) => {
    const course = courses.find(c => c.code === courseCode);
    if (!course) return;
    const section = course.sections.find(s => s.sectionNumber === secNum);
    if (!section) return;

    section.sessions.forEach(sess => {
      // Check if this session is involved in a conflict
      const hasConflict = conflicts.some(c =>
        (c.course1Code === course.code && c.section1Number === secNum && c.day === sess.day) ||
        (c.course2Code === course.code && c.section2Number === secNum && c.day === sess.day)
      );

      scheduledBlocks.push({
        course,
        sectionNumber: secNum,
        sessionGroup: sess.sessionGroup,
        modality: sess.modality,
        day: sess.day,
        startTime: sess.startTime,
        endTime: sess.endTime,
        startMinutes: sess.startMinutes,
        endMinutes: sess.endMinutes,
        location: sess.location,
        professor: sess.professor,
        hasConflict
      });
    });
  });

  const handleDragOver = (e: React.DragEvent, day: DayOfWeek) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (dragOverDay !== day) setDragOverDay(day);
  };

  const handleDrop = (e: React.DragEvent, day: DayOfWeek) => {
    e.preventDefault();
    setDragOverDay(null);
    try {
      const rawData = e.dataTransfer.getData('text/plain');
      if (rawData) {
        const { courseCode, sectionNumber } = JSON.parse(rawData);
        onSelectSection(courseCode, sectionNumber);
      }
    } catch (err) {
      console.error('Failed to parse drag data:', err);
    }
  };

  return (
    <div className="timetable-grid-wrapper">
      {/* Header Days Row */}
      <div className="timetable-header">
        <div className="time-col-header">Hora</div>
        {DAYS.map(day => (
          <div key={day} className="day-col-header">
            {DAY_NAMES[day]}
          </div>
        ))}
      </div>

      {/* Grid Canvas Body */}
      <div className="timetable-body timetable-scroll">
        {/* Time labels column */}
        <div className="time-labels-column">
          {hours.map(hour => (
            <div key={hour} className="time-label-slot">
              {hour}
            </div>
          ))}
        </div>

        {/* 6 Day Columns Canvas */}
        <div className="days-canvas-grid">
          {DAYS.map(day => {
            const dayBlocks = scheduledBlocks.filter(b => b.day === day);

            return (
              <div
                key={day}
                className={`day-column-canvas ${dragOverDay === day ? 'drag-over' : ''}`}
                onDragOver={e => handleDragOver(e, day)}
                onDragLeave={() => setDragOverDay(null)}
                onDrop={e => handleDrop(e, day)}
              >
                {/* Drag-over overlay feedback */}
                {dragOverDay === day && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(59, 130, 246, 0.15)',
                      border: '2px dashed var(--accent-primary)',
                      borderRadius: '8px',
                      zIndex: 30,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-primary)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      pointerEvents: 'none'
                    }}
                  >
                    + Soltar para agregar
                  </div>
                )}

                {dayBlocks.map((block, idx) => {
                  const topPercent = ((block.startMinutes - START_HOUR * 60) / TOTAL_MINUTES) * 100;
                  const heightPercent = Math.max(((block.endMinutes - block.startMinutes) / TOTAL_MINUTES) * 100, 3.5);
                  const gradient = getCourseGradient(block.course.code);

                  return (
                    <div
                      key={idx}
                      className={`schedule-block ${block.hasConflict ? 'has-conflict' : ''}`}
                      style={{
                        top: `${topPercent}%`,
                        height: `${heightPercent}%`,
                        background: gradient,
                      }}
                      title={`${block.course.code} ${block.course.name}\nSec ${block.sectionNumber} - ${block.sessionGroup}\n${block.startTime} - ${block.endTime}\nAula: ${block.location}`}
                    >
                      <div className="block-course-code">
                        <span>{block.course.code} (Sec {block.sectionNumber})</span>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onRemoveSection(block.course.code);
                          }}
                          style={{ background: 'transparent', border: 'none', color: 'white', opacity: 0.85, cursor: 'pointer' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      <div className="block-course-name">{block.course.name}</div>

                      <div className="block-footer">
                        <span style={{ fontWeight: 700 }}>{block.sessionGroup}</span>
                        <span>{block.startTime}-{block.endTime}</span>
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
  );
};
