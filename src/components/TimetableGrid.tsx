import React, { useState, useMemo } from 'react';
import { formatLocation, DAY_NAMES, DAYS } from '../utils/scheduleUtils';
import {
  getGraftonPigment,
  isLaboratorySession,
  getGraftonBlockBackground,
} from '../utils/graftonPigments';
import type { Course, DayOfWeek, Conflict } from '../types/schedule';
import { X, AlertTriangle } from 'lucide-react';
import { DynamicSessionBadge } from './common/DynamicSessionBadge';

interface TimetableGridProps {
  courses: Course[];
  selectedSections: Record<string, string>;
  conflicts: Conflict[];
  draggedSection: { courseCode: string; sectionNumber: string } | null;
  onSelectSection: (courseCode: string, sectionNumber: string) => void;
  onRemoveSection: (courseCode: string) => void;
  compressView?: boolean;
  readOnly?: boolean;
}

const DAY_SHORT_LABELS: Record<DayOfWeek, string> = {
  Lun: 'Lun',
  Mar: 'Mar',
  Mie: 'Mié',
  Jue: 'Jue',
  Vie: 'Vie',
  Sab: 'Sáb',
};

const formatSessionTypeLabel = (session: string) => {
  if (!session) return 'Teoría';
  if (/LABORATORIO|LAB/i.test(session)) return 'Lab';
  if (/TALLER/i.test(session)) return 'Taller';
  if (/SEMINARIO|SEM/i.test(session)) return 'Seminario';
  if (/PR[AÁ]CTICA|PRA/i.test(session)) return 'Práctica';
  return 'Teoría';
};

const formatMicroSessionType = (sessionGroup: string, sectionNumber: string) => {
  const s = sessionGroup || '';
  let prefix = 'TEO';
  if (/LABORATORIO|LAB/i.test(s)) prefix = 'LAB';
  else if (/TALLER|TAL/i.test(s)) prefix = 'TAL';
  else if (/SEMINARIO|SEM/i.test(s)) prefix = 'SEM';
  else if (/PR[AÁ]CTICA|PRA/i.test(s)) prefix = 'PRA';

  const groupNum = s.match(/(\d+)\s*$/)?.[1];
  const secNum = (sectionNumber || '').match(/\d+/)?.[0];
  const num = groupNum || secNum || '1';
  return `${prefix} ${num}`;
};

const formatCompactRoom = (loc: string) => {
  const formatted = (formatLocation(loc) || loc || '').trim();
  if (!formatted) return 'AULA';
  if (/virtual|zoom|meet/i.test(formatted)) return 'VIR';
  if (/magna/i.test(formatted)) return 'MAG';
  if (/auditorio/i.test(formatted)) return 'AUD';
  if (/futsal/i.test(formatted)) return 'FUT';
  const mesasMatch = formatted.match(/mesas?\s*-?\s*(\d{2,4}[A-Z]?)/i);
  if (mesasMatch) return `M${mesasMatch[1].toUpperCase()}`;
  const roomMatch = formatted.match(/([ABLM]\s?-?\s?\d{3,4}[A-Z]?)/i);
  if (roomMatch) return roomMatch[1].replace(/[\s-]+/g, '').toUpperCase();
  const labMatch = formatted.match(/lab(?:oratorio)?\.?\s*-?\s*([A-Z]?\d{2,4}[A-Z]?)/i);
  if (labMatch) {
    const val = labMatch[1].toUpperCase();
    return val.startsWith('L') ? val : `L${val}`;
  }
  const aulaMatch = formatted.match(/aula\s*-?\s*([A-Z]?\d{2,4}[A-Z]?)/i);
  if (aulaMatch) {
    const val = aulaMatch[1].toUpperCase();
    return /^[A-Z]/.test(val) ? val : `A${val}`;
  }
  const firstToken = formatted.split(/\s+/)[0] || formatted;
  return firstToken.length > 5 ? firstToken.slice(0, 5).toUpperCase() : firstToken.toUpperCase();
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
    readOnly = false,
  }) => {
    const [dragOverDay, setDragOverDay] = useState<DayOfWeek | null>(null);
    const [mobileDayFilter, setMobileDayFilter] = useState<'ALL' | DayOfWeek>('ALL');
    const [inspectedBlockKey, setInspectedBlockKey] = useState<string | null>(null);

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
    const activeGridDays = mobileDayFilter === 'ALL' ? DAYS : [mobileDayFilter];
    const totalWeekHours = useMemo(() => {
      return Object.values(dayHoursMap).reduce((a, b) => a + b, 0);
    }, [dayHoursMap]);

    const inspectedBlock = useMemo(() => {
      if (!inspectedBlockKey) return null;
      return (
        scheduledBlocks.find(
          b => `${b.course.code}-${b.sectionNumber}-${b.day}-${b.startMinutes}` === inspectedBlockKey
        ) || null
      );
    }, [inspectedBlockKey, scheduledBlocks]);

    return (
      <div className="timetable-grid-wrapper">
        {/* Grafton Swiss Precision Segmented Control (Semana | Lunes | Martes... | Sábado) */}
        <div className={`timetable-controls-bar ${mobileDayFilter !== 'ALL' ? 'is-day-zoomed' : ''}`}>
          <div className="timetable-day-segmented-control" role="tablist" aria-label="Vista del Horario">
            <button
              type="button"
              role="tab"
              aria-selected={mobileDayFilter === 'ALL'}
              className={`timetable-day-segment-btn ${mobileDayFilter === 'ALL' ? 'is-active' : ''}`}
              onClick={() => setMobileDayFilter('ALL')}
            >
              <span>Semana</span>
              <span className="timetable-day-hours-badge">{totalWeekHours}h</span>
            </button>
            {DAYS.map(day => {
              const hrs = dayHoursMap[day] || 0;
              const isSelected = mobileDayFilter === day;
              const hasClasses = hrs > 0;
              return (
                <button
                  key={day}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`timetable-day-segment-btn ${isSelected ? 'is-active' : ''} ${!hasClasses ? 'is-dimmed' : ''}`}
                  onClick={() => {
                    setMobileDayFilter(day);
                    setInspectedBlockKey(null);
                  }}
                  title={`${day}: ${hrs} horas de clase programadas`}
                >
                  <span>{DAY_NAMES[day]}</span>
                  {hasClasses && <span className="timetable-day-hours-badge">{hrs}h</span>}
                </button>
              );
            })}
          </div>

          {/* Quick reset to weekly view button if zoomed into a single day */}
          {mobileDayFilter !== 'ALL' && (
            <button
              type="button"
              className="timetable-reset-week-btn"
              onClick={() => setMobileDayFilter('ALL')}
              title="Restablecer vista a toda la semana"
            >
              ← Volver a vista semanal
            </button>
          )}
        </div>

        {/* Header Days Row */}
        <div
          className={`timetable-header ${mobileDayFilter !== 'ALL' ? 'is-day-zoomed' : ''}`}
        >
          <div className="time-col-header">HORA</div>
          {activeGridDays.map(day => {
            const hrs = dayHoursMap[day] || 0;
            return (
              <div key={day} className="day-col-header">
                {mobileDayFilter === 'ALL' ? (
                  <>
                    <span className="day-col-label-short">{DAY_SHORT_LABELS[day]}</span>
                    <span className="day-col-label-full">{DAY_NAMES[day]}</span>
                  </>
                ) : (
                  <span>{DAY_NAMES[day]}</span>
                )}
                {hrs > 0 && (
                  <span className={`day-col-hours ${mobileDayFilter === 'ALL' ? 'day-col-hours--week' : ''}`}>
                    ({hrs}h)
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile Tap-to-Inspect Swiss Course Inspector Strip (< 640px Week View) */}
        {mobileDayFilter === 'ALL' && inspectedBlock && (
          <div
            data-testid="mobile-course-inspector-strip"
            className="mobile-course-inspector-strip"
            style={{
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              padding: '7px 10px',
              backgroundColor: '#18181A',
              color: '#F2F0EC',
              borderBottom: '1.5px solid #18181A',
              borderLeft: '4px solid #00779E',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10.5px',
              lineHeight: 1.3,
              borderRadius: '0px',
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <span style={{ fontWeight: 700, color: '#38BDF8' }}>[{inspectedBlock.course.code}]</span>{' '}
              <span style={{ fontWeight: 600, color: '#F2F0EC' }}>{inspectedBlock.course.name}</span>
              <span style={{ color: '#C6C3BB' }}>
                {' · '}
                {DAY_SHORT_LABELS[inspectedBlock.day]} {inspectedBlock.startTime}–
                {inspectedBlock.endTime} ·{' '}
                {formatMicroSessionType(inspectedBlock.sessionGroup, inspectedBlock.sectionNumber)} ·
                Aula {formatCompactRoom(inspectedBlock.location)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => {
                    onRemoveSection(inspectedBlock.course.code);
                    setInspectedBlockKey(null);
                  }}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#B8332A',
                    color: '#FFFFFF',
                    border: '1px solid rgba(242, 240, 236, 0.45)',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    borderRadius: '0px',
                    cursor: 'pointer',
                  }}
                >
                  Quitar ×
                </button>
              )}
              <button
                type="button"
                onClick={() => setInspectedBlockKey(null)}
                aria-label="Cerrar inspector de curso"
                style={{
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#2C2C30',
                  color: '#F2F0EC',
                  border: '1px solid #52514E',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '0px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>
          </div>
        )}

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

            {/* Day Columns Canvas */}
            <div
              className="days-canvas-grid"
              style={mobileDayFilter !== 'ALL' ? { gridTemplateColumns: '1fr' } : undefined}
            >
              {activeGridDays.map(day => {
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
                      const canonicalRoom = compactRoom === 'MAG' ? 'MAG · Aula Magna' : compactRoom;
                      const sessionKind = formatSessionTypeLabel(block.sessionGroup);
                      const microType = formatMicroSessionType(
                        block.sessionGroup,
                        block.sectionNumber
                      );
                      const blockUniqueKey = `${block.course.code}-${block.sectionNumber}-${block.day}-${block.startMinutes}`;
                      const isInspected = inspectedBlockKey === blockUniqueKey;

                      return (
                        <div
                          key={`${block.course.code}-${block.sectionNumber}-${idx}`}
                          onClick={() => {
                            if (mobileDayFilter === 'ALL') {
                              setInspectedBlockKey(prev =>
                                prev === blockUniqueKey ? null : blockUniqueKey
                              );
                            }
                          }}
                          className={`group schedule-block ${mobileDayFilter === 'ALL' ? 'schedule-block--week-view' : 'schedule-block--day-view'} ${isLab ? 'schedule-block--lab' : 'schedule-block--teo'} ${block.hasConflict ? 'has-conflict' : ''} ${durationMinutes <= 60 ? 'short-block' : ''} ${isInspected ? 'is-inspected' : ''}`}
                          style={{
                            top: `${topPercent}%`,
                            height: `calc(${heightPercent}% - 2px)`,
                            marginTop: '1px',
                            background: blockBg,
                            border: `1px solid ${borderColor}`,
                            borderLeft: `4px solid ${barColor}`,
                            color: textColor,
                            outline: isInspected ? '2px solid #00779E' : undefined,
                          }}
                          title={`${block.course.code} · ${block.course.name}\nSección ${block.sectionNumber} (${block.sessionGroup})\n${block.startTime} – ${block.endTime} · Aula: ${formatLocation(block.location)}\nDocente: ${block.professor}`}
                        >
                          {/* Mobile Week View (< 640px): Strict 3-Line Swiss Micro-Ticket */}
                          {mobileDayFilter === 'ALL' && (
                            <div className="mobile-micro-ticket">
                              <span
                                className="micro-ticket-code"
                                style={{ color: block.hasConflict ? '#520D17' : '#141416' }}
                              >
                                {block.course.code}
                              </span>
                              <span
                                className="micro-ticket-type"
                                style={{ color: block.hasConflict ? '#A82032' : '#005A78' }}
                              >
                                {microType}
                              </span>
                              <span
                                className="micro-ticket-room"
                                style={{ color: block.hasConflict ? '#520D17' : '#141416' }}
                              >
                                {compactRoom}
                              </span>
                              {!readOnly && (
                                <button
                                  type="button"
                                  className="micro-ticket-remove-btn"
                                  onClick={e => {
                                    e.stopPropagation();
                                    onRemoveSection(block.course.code);
                                    setInspectedBlockKey(null);
                                  }}
                                  aria-label={`Quitar ${block.course.name}`}
                                  title="Quitar asignatura"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          )}

                          {/* Desktop & Mobile Day View: Full Course Ticket */}
                          <div
                            className={`block-desktop-content ${
                              mobileDayFilter === 'ALL' ? 'is-week-view' : 'is-day-view'
                            }`}
                          >
                            <div className="block-top-row">
                              <span className="block-room-pill" title={formatLocation(block.location)}>
                                {canonicalRoom}
                              </span>
                              {!readOnly && (
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
                              )}
                            </div>

                            <div className="block-course-title">{block.course.name}</div>

                            {durationMinutes > 60 && (
                              <div className="block-meta-mono flex items-center gap-1">
                                <span>{block.course.code}</span>
                                <span>·</span>
                                <DynamicSessionBadge type={sessionKind} />
                              </div>
                            )}

                            <div className="block-time-mono">
                              {durationMinutes <= 60 ? `${block.course.code} · ` : ''}
                              {block.startTime}–{block.endTime}
                            </div>
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
