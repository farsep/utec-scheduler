import React, { useState } from 'react';
import { formatLocation, getCourseGradient, DAY_NAMES, DAYS } from '../utils/scheduleUtils';
import type { Course, DayOfWeek, Conflict, Session } from '../types/schedule';
import { Trash2, AlertTriangle, Sparkles, MapPin } from 'lucide-react';

interface TimetableGridProps {
  courses: Course[];
  selectedSections: Record<string, string>;
  conflicts: Conflict[];
  draggedSection: { courseCode: string; sectionNumber: string } | null;
  onSelectSection: (courseCode: string, sectionNumber: string) => void;
  onRemoveSection: (courseCode: string) => void;
}

const abbreviateSession = (session: string) => {
  if (!session) return '';
  return session
    .replace(/LABORATORIO/i, 'LAB')
    .replace(/TEORÍA/i, 'TEO')
    .replace(/TEORIA/i, 'TEO')
    .replace(/SEMINARIO/i, 'SEM');
};

const MarqueeText: React.FC<{ text: string }> = ({ text }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = React.useState(false);

  React.useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        setIsOverflowing(textRef.current.scrollWidth > containerRef.current.clientWidth);
      }
    };
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [text]);

  return (
    <div 
      className="marquee-film-container" 
      ref={containerRef} 
      style={{ width: 'auto', flex: 1, minWidth: 0, paddingBottom: '2px' }}
    >
      <div 
        className={`marquee-film-text ${isOverflowing ? 'is-overflowing' : ''}`} 
        ref={textRef}
        style={{ lineHeight: '1.2' }}
      >
        {text}
      </div>
    </div>
  );
};

export const TimetableGrid: React.FC<TimetableGridProps> = ({
  courses,
  selectedSections,
  conflicts,
  draggedSection,
  onSelectSection,
  onRemoveSection
}) => {
  const [dragOverDay, setDragOverDay] = useState<DayOfWeek | null>(null);

  // 1. First, build the scheduledBlocks array so we can calculate dynamic bounds
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

  // 2. Calculate dynamic START_HOUR and END_HOUR based on content
  let dynamicStartHour = 7;
  let dynamicEndHour = 22;

  if (scheduledBlocks.length > 0) {
    const earliestMin = Math.min(...scheduledBlocks.map(b => b.startMinutes));
    const latestMin = Math.max(...scheduledBlocks.map(b => b.endMinutes));
    // Pad by 1 hour, clamped between 7:00 and 23:00
    dynamicStartHour = Math.max(7, Math.floor(earliestMin / 60));
    dynamicEndHour = Math.min(23, Math.ceil(latestMin / 60));
  }

  const TOTAL_MINUTES = (dynamicEndHour - dynamicStartHour) * 60;

  // Generate hour labels
  const hours = [];
  for (let h = dynamicStartHour; h < dynamicEndHour; h++) {
    hours.push(`${h.toString().padStart(2, '0')}:00`);
  }

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
      <div className="timetable-body timetable-scroll" style={{ display: 'block', overflowY: 'auto', height: '100%', minHeight: '300px' }}>
        <div style={{ position: 'relative', height: `${hours.length * 52}px`, display: 'grid', gridTemplateColumns: '60px 1fr' }}>
          
          {/* Time labels column */}
          <div className="time-labels-column">
            {hours.map(hour => (
              <div key={hour} className="time-label-slot" style={{ height: '52px' }}>
                {hour}
              </div>
            ))}
          </div>

          {/* 6 Day Columns Canvas */}
          <div className="days-canvas-grid" style={{ height: '100%' }}>
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
                  const topPercent = ((block.startMinutes - dynamicStartHour * 60) / TOTAL_MINUTES) * 100;
                  const heightPercent = Math.max(((block.endMinutes - block.startMinutes) / TOTAL_MINUTES) * 100, 3.8);
                  const gradient = getCourseGradient(block.course.code);

                  const durationMinutes = block.endMinutes - block.startMinutes;

                  return (
                    <div
                      key={idx}
                      className={`schedule-block ${block.hasConflict ? 'has-conflict' : ''} ${durationMinutes <= 60 ? 'short-block' : ''}`}
                      style={{
                        top: `${topPercent}%`,
                        height: `${heightPercent}%`,
                        background: gradient,
                      }}
                      title={`${block.course.code} ${block.course.name}\nSec ${block.sectionNumber} - ${block.sessionGroup}\n${block.startTime} - ${block.endTime}\nAula: ${formatLocation(block.location)}\nDocente: ${block.professor}`}
                    >
                      <div className="block-course-code" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '4px', overflow: 'hidden' }}>
                        <MarqueeText text={block.course.name} />
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onRemoveSection(block.course.code);
                          }}
                          style={{ background: 'transparent', border: 'none', color: 'white', opacity: 0.85, cursor: 'pointer', flexShrink: 0, padding: 0 }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {/* Course Code and Section - Multi-line enabled and vertically centered */}
                      {durationMinutes > 60 && (
                        <div style={{ fontSize: '0.7rem', opacity: 0.9, lineHeight: 1.2, margin: 'auto 0', flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
                          <span>{block.course.code} (Sec {block.sectionNumber})</span>
                        </div>
                      )}

                      <div className="block-footer" style={{ alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0, letterSpacing: '0.5px' }}>
                          {abbreviateSession(block.sessionGroup)}
                        </span>
                        <span style={{ fontSize: '0.65rem', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                          <MapPin size={10} />
                          {formatLocation(block.location) || `${block.startTime}-${block.endTime}`}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* GHOST SHADOW PREVIEW BLOCKS FOR DRAGGED SECTION */}
                {dayGhostBlocks.map((ghost, gIdx) => {
                  const topPercent = ((ghost.startMinutes - dynamicStartHour * 60) / TOTAL_MINUTES) * 100;
                  const heightPercent = Math.max(((ghost.endMinutes - ghost.startMinutes) / TOTAL_MINUTES) * 100, 3.8);

                  const durationMinutes = ghost.endMinutes - ghost.startMinutes;

                  return (
                    <div
                      key={`ghost-${gIdx}`}
                      className={`schedule-ghost-block ${ghost.hasGhostConflict ? 'ghost-conflict' : ''}`}
                      style={{
                        top: `${topPercent}%`,
                        height: `${heightPercent}%`,
                      }}
                    >
                      <div className="block-course-code" style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', overflow: 'hidden' }}>
                        <Sparkles size={12} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <MarqueeText text={`PREVIA: ${ghost.courseName}`} />
                        {ghost.hasGhostConflict && (
                          <span style={{ color: '#ef4444', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                            <AlertTriangle size={12} /> CRUCE
                          </span>
                        )}
                      </div>

                      {/* Course Code and Section - Multi-line enabled and vertically centered */}
                      {durationMinutes > 60 && (
                        <div style={{ fontSize: '0.7rem', opacity: 0.9, lineHeight: 1.2, margin: 'auto 0', flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
                          <span>{ghost.courseCode}</span>
                        </div>
                      )}

                      <div className="block-footer" style={{ alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0, letterSpacing: '0.5px' }}>
                          {abbreviateSession(ghost.sessionGroup)}
                        </span>
                        <span style={{ fontSize: '0.65rem', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                          <MapPin size={10} />
                          {formatLocation(ghost.location) || `${ghost.startTime}-${ghost.endTime}`}
                        </span>
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
