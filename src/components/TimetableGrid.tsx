import React, { useState } from 'react';
import { DAYS, DAY_NAMES, getCourseGradient } from '../utils/scheduleUtils';
import type { Course, DayOfWeek, Conflict, Session } from '../types/schedule';
import { Trash2, AlertTriangle, Sparkles, MapPin, User } from 'lucide-react';

interface TimetableGridProps {
  courses: Course[];
  selectedSections: Record<string, string>;
  conflicts: Conflict[];
  draggedSection: { courseCode: string; sectionNumber: string } | null;
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
  draggedSection,
  onSelectSection,
  onRemoveSection
}) => {
  const [dragOverDay, setDragOverDay] = useState<DayOfWeek | null>(null);

  // Generate hour labels (07:00, 08:00, ..., 21:00)
  const hours = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    hours.push(`${h.toString().padStart(2, '0')}:00`);
  }

  // Find all active scheduled sessions
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

  // Calculate Ghost Shadow Preview blocks if draggedSection is active
  const ghostBlocks: {
    courseCode: string;
    courseName: string;
    sectionNumber: string;
    sessionGroup: string;
    day: DayOfWeek;
    startTime: string;
    endTime: string;
    startMinutes: number;
    endMinutes: number;
    location: string;
    hasGhostConflict: boolean;
  }[] = [];

  if (draggedSection) {
    const dCourse = courses.find(c => c.code === draggedSection.courseCode);
    if (dCourse) {
      const dSection = dCourse.sections.find(s => s.sectionNumber === draggedSection.sectionNumber);
      if (dSection) {
        dSection.sessions.forEach(sess => {
          const hasGhostConflict = scheduledBlocks.some(sb =>
            sb.course.code !== dCourse.code &&
            sb.day === sess.day &&
            Math.max(sb.startMinutes, sess.startMinutes) < Math.min(sb.endMinutes, sess.endMinutes)
          );

          ghostBlocks.push({
            courseCode: dCourse.code,
            courseName: dCourse.name,
            sectionNumber: draggedSection.sectionNumber,
            sessionGroup: sess.sessionGroup,
            day: sess.day,
            startTime: sess.startTime,
            endTime: sess.endTime,
            startMinutes: sess.startMinutes,
            endMinutes: sess.endMinutes,
            location: sess.location,
            hasGhostConflict
          });
        });
      }
    }
  }

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
            const dayGhostBlocks = ghostBlocks.filter(g => g.day === day);

            return (
              <div
                key={day}
                className={`day-column-canvas ${dragOverDay === day ? 'drag-over' : ''}`}
                onDragOver={e => handleDragOver(e, day)}
                onDragLeave={() => setDragOverDay(null)}
                onDrop={e => handleDrop(e, day)}
              >
                {/* Active Scheduled Blocks */}
                {dayBlocks.map((block, idx) => {
                  const topPercent = ((block.startMinutes - START_HOUR * 60) / TOTAL_MINUTES) * 100;
                  const heightPercent = Math.max(((block.endMinutes - block.startMinutes) / TOTAL_MINUTES) * 100, 3.8);
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
                      title={`${block.course.code} ${block.course.name}\nSec ${block.sectionNumber} - ${block.sessionGroup}\n${block.startTime} - ${block.endTime}\nAula: ${block.location}\nDocente: ${block.professor}`}
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

                      {/* Continuous Film Ticker Marquee Effect on Hover */}
                      <div className="marquee-film-container">
                        <div className="marquee-film-text">
                          {block.course.name}
                        </div>
                      </div>

                      <div className="block-footer">
                        <span style={{ fontWeight: 700 }}>{block.sessionGroup}</span>
                        <span style={{ fontSize: '0.65rem' }}>{block.location || `${block.startTime}-${block.endTime}`}</span>
                      </div>
                    </div>
                  );
                })}

                {/* GHOST SHADOW PREVIEW BLOCKS FOR DRAGGED SECTION */}
                {dayGhostBlocks.map((ghost, gIdx) => {
                  const topPercent = ((ghost.startMinutes - START_HOUR * 60) / TOTAL_MINUTES) * 100;
                  const heightPercent = Math.max(((ghost.endMinutes - ghost.startMinutes) / TOTAL_MINUTES) * 100, 3.8);

                  return (
                    <div
                      key={`ghost-${gIdx}`}
                      className={`schedule-ghost-block ${ghost.hasGhostConflict ? 'ghost-conflict' : ''}`}
                      style={{
                        top: `${topPercent}%`,
                        height: `${heightPercent}%`,
                      }}
                    >
                      <div className="block-course-code">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Sparkles size={12} />
                          PREVIA: {ghost.courseCode}
                        </span>
                        {ghost.hasGhostConflict && (
                          <span style={{ color: '#ef4444', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <AlertTriangle size={12} /> CRUCE
                          </span>
                        )}
                      </div>

                      <div className="marquee-film-container">
                        <div className="marquee-film-text">
                          {ghost.courseName}
                        </div>
                      </div>

                      <div className="block-footer">
                        <span style={{ fontWeight: 700 }}>{ghost.sessionGroup}</span>
                        <span>{ghost.startTime}-{ghost.endTime}</span>
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
