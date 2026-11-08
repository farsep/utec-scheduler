import React, { useState } from 'react';
import { formatLocation, DAY_NAMES, DAYS } from '../utils/scheduleUtils';
import {
  getGraftonPigment,
  isLaboratorySession,
  getGraftonBlockBackground,
} from '../utils/graftonPigments';
import type { Course, DayOfWeek, Conflict } from '../types/schedule';
import { X, AlertTriangle } from 'lucide-react';

interface TimetableGridProps {
  courses: Course[];
  selectedSections: Record<string, string>;
  conflicts: Conflict[];
  draggedSection: { courseCode: string; sectionNumber: string } | null;
  onSelectSection: (courseCode: string, sectionNumber: string) => void;
  onRemoveSection: (courseCode: string) => void;
  compressView?: boolean;
}

const formatSessionTypeLabel = (session: string) => {
  if (!session) return 'Teoría';
  if (/LABORATORIO|LAB/i.test(session)) return 'Lab';
  if (/TALLER/i.test(session)) return 'Taller';
  if (/SEMINARIO|SEM/i.test(session)) return 'Seminario';
  return 'Teoría';
};

const formatCompactRoom = (loc: string) => {
  const formatted = formatLocation(loc);
  if (!formatted) return 'Aula';
  if (/virtual|zoom|meet/i.test(formatted)) return 'Virtual';
  const roomMatch = formatted.match(/([ABLM]\s?-?\s?\d{3,4}[A-Z]?)/i);
  if (roomMatch) return roomMatch[1].replace(/\s+/g, '').toUpperCase();
  return formatted.length > 10 ? formatted.slice(0, 10) : formatted;
};

export const TimetableGrid: React.FC<TimetableGridProps> = React.memo(
  ({
    courses,
    selectedSections,
    conflicts,
    draggedSection,
    onSelectSection,
    onRemoveSection,
    compressView = false,
  }) => {
    const [dragOverDay, setDragOverDay] = useState<DayOfWeek | null>(null);

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
        const hasConflict = conflicts.some(
          c =>
            (c.course1Code === course.code &&
              c.section1Number === secNum &&
              c.day === sess.day) ||
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
          hasConflict,
        });
      });
    });

    let dynamicStartHour = 7;
    let dynamicEndHour = 22;

    if (compressView && scheduledBlocks.length > 0) {
      const earliestMin = Math.min(...scheduledBlocks.map(b => b.startMinutes));
      const latestMin = Math.max(...scheduledBlocks.map(b => b.endMinutes));
      dynamicStartHour = Math.max(7, Math.floor(earliestMin / 60));
      dynamicEndHour = Math.min(23, Math.ceil(latestMin / 60) + 1);
    }

    const TOTAL_MINUTES = (dynamicEndHour - dynamicStartHour) * 60;

    const hours: string[] = [];
    for (let h = dynamicStartHour; h < dynamicEndHour; h++) {
      hours.push(`${h.toString().padStart(2, '0')}:00`);
    }

    // Per-day total hours for architectural header labels ("Lunes (4h)")
    const dayHoursMap: Record<string, number> = {};
    for (const day of DAYS) {
      const mins = scheduledBlocks
        .filter(b => b.day === day)
        .reduce((acc, b) => acc + Math.max(0, b.endMinutes - b.startMinutes), 0);
      dayHoursMap[day] = Math.round((mins / 60) * 10) / 10;
    }

    // Ghost Shadow Preview blocks if draggedSection / hovered section is active
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
      if (dCourse && selectedSections[dCourse.code] !== draggedSection.sectionNumber) {
        const dSection = dCourse.sections.find(
          s => s.sectionNumber === draggedSection.sectionNumber
        );
        if (dSection) {
          dSection.sessions.forEach(sess => {
            const hasGhostConflict = scheduledBlocks.some(
              sb =>
                sb.course.code !== dCourse.code &&
                sb.day === sess.day &&
                Math.max(sb.startMinutes, sess.startMinutes) <
                  Math.min(sb.endMinutes, sess.endMinutes)
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
              hasGhostConflict,
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

    const handleDrop = (e: React.DragEvent) => {
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

    const SLOT_HEIGHT = 54;

    return (
      <div className="timetable-grid-wrapper">
        {/* Header Days Row */}
        <div className="timetable-header">
          <div className="time-col-header">HORA</div>
          {DAYS.map(day => {
            const hrs = dayHoursMap[day] || 0;
            return (
              <div key={day} className="day-col-header">
                <span>{DAY_NAMES[day]}</span>
                {hrs > 0 && <span className="day-col-hours">({hrs}h)</span>}
              </div>
            );
          })}
        </div>

        {/* Grid Canvas Body */}
        <div id="timetable-grid-body" className="timetable-body timetable-scroll">
          <div
            className="timetable-canvas-inner"
            style={{ height: `${hours.length * SLOT_HEIGHT}px` }}
          >
            {/* Time labels column */}
            <div className="time-labels-column">
              {hours.map(hour => (
                <div key={hour} className="time-label-slot" style={{ height: `${SLOT_HEIGHT}px` }}>
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
                    onDrop={handleDrop}
                  >
                    {/* Active Scheduled Blocks */}
                    {dayBlocks.map((block, idx) => {
                      const topPercent =
                        ((block.startMinutes - dynamicStartHour * 60) / TOTAL_MINUTES) * 100;
                      const heightPercent = Math.max(
                        ((block.endMinutes - block.startMinutes) / TOTAL_MINUTES) * 100,
                        4.0
                      );
                      const pigment = getGraftonPigment(block.course.code);
                      const isLab = isLaboratorySession(block.sessionGroup);
                      const blockBg = block.hasConflict
                        ? '#F4E0E2'
                        : getGraftonBlockBackground(pigment, isLab);
                      const barColor = block.hasConflict ? '#A82032' : pigment.bar;
                      const borderColor = block.hasConflict ? '#A82032' : pigment.border;
                      const textColor = block.hasConflict ? '#520D17' : pigment.text;
                      const durationMinutes = block.endMinutes - block.startMinutes;
                      const compactRoom = formatCompactRoom(block.location);
                      const sessionKind = formatSessionTypeLabel(block.sessionGroup);

                      return (
                        <div
                          key={`${block.course.code}-${block.sectionNumber}-${idx}`}
                          className={`schedule-block ${isLab ? 'schedule-block--lab' : 'schedule-block--teo'} ${block.hasConflict ? 'has-conflict' : ''} ${durationMinutes <= 60 ? 'short-block' : ''}`}
                          style={{
                            top: `${topPercent}%`,
                            height: `calc(${heightPercent}% - 2px)`,
                            marginTop: '1px',
                            background: blockBg,
                            border: `1px solid ${borderColor}`,
                            borderLeft: `4px solid ${barColor}`,
                            color: textColor,
                          }}
                          title={`${block.course.code} · ${block.course.name}\nSección ${block.sectionNumber} (${block.sessionGroup})\n${block.startTime} – ${block.endTime} · Aula: ${formatLocation(block.location)}\nDocente: ${block.professor}`}
                        >
                          <div className="block-top-row">
                            <span className="block-room-pill">{compactRoom}</span>
                            <button
                              type="button"
                              className="block-remove-btn"
                              onClick={e => {
                                e.stopPropagation();
                                onRemoveSection(block.course.code);
                              }}
                              aria-label={`Quitar ${block.course.name}`}
                              title="Quitar asignatura"
                            >
                              <X size={12} />
                            </button>
                          </div>

                          <div className="block-course-title">{block.course.name}</div>

                          {durationMinutes > 60 && (
                            <div className="block-meta-mono">
                              {block.course.code} · {sessionKind}
                            </div>
                          )}

                          <div className="block-time-mono">
                            {durationMinutes <= 60 ? `${block.course.code} · ` : ''}
                            {block.startTime}–{block.endTime}
                          </div>
                        </div>
                      );
                    })}

                    {/* Ghost Diff Preview Blocks */}
                    {dayGhostBlocks.map((ghost, gIdx) => {
                      const topPercent =
                        ((ghost.startMinutes - dynamicStartHour * 60) / TOTAL_MINUTES) * 100;
                      const heightPercent = Math.max(
                        ((ghost.endMinutes - ghost.startMinutes) / TOTAL_MINUTES) * 100,
                        4.0
                      );

                      return (
                        <div
                          key={`ghost-${gIdx}`}
                          className={`schedule-ghost-block ${ghost.hasGhostConflict ? 'ghost-conflict' : ''}`}
                          style={{
                            top: `${topPercent}%`,
                            height: `calc(${heightPercent}% - 2px)`,
                            marginTop: '1px',
                          }}
                        >
                          <div className="ghost-header">
                            <span>Ghost: {ghost.courseName}</span>
                            {ghost.hasGhostConflict && (
                              <span className="ghost-conflict-tag">
                                <AlertTriangle size={11} /> CRUCE
                              </span>
                            )}
                          </div>
                          <div className="ghost-meta">
                            {ghost.courseCode} · Sec {ghost.sectionNumber.split(' ')[0]} ·{' '}
                            {ghost.startTime}–{ghost.endTime}
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
  }
);

TimetableGrid.displayName = 'TimetableGrid';
