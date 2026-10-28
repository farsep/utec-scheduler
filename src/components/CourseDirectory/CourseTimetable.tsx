import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Clock,
  MapPin,
  Calendar,
  GraduationCap,
  LayoutGrid,
  List,
  Radio,
  ExternalLink,
  Layers
} from 'lucide-react';
import type { DayOfWeek } from '../../types/schedule';
import type {
  CourseExtendedInfo,
  CourseExtendedSection,
  CourseExtendedSession
} from '../../types/courseDirectory';
import { ALL_DAYS, DAY_LABELS } from '../../utils/classroomUtils';
import {
  generateGoogleCalendarUrlForSession,
  SECTION_PALETTES,
  getSectionColor
} from '../../utils/courseDirectoryUtils';

export interface CourseTimetableProps {
  course: CourseExtendedInfo;
  nowDay?: DayOfWeek;
  nowMinutes?: number;
  selectedSectionNumber?: string;
  onSelectSectionNumber?: (sectionNumber: string) => void;
}

export interface TimetableSessionItem {
  id: string;
  sectionNumber: string;
  sectionColor: string;
  session: CourseExtendedSession;
}

export interface PositionedSession {
  item: TimetableSessionItem;
  colIndex: number;
  totalCols: number;
}

/**
 * Computes non-overlapping horizontal layouts for sessions occurring on the same day and time
 */
function computeCourseSessionLayouts(items: TimetableSessionItem[]): PositionedSession[] {
  if (items.length === 0) return [];

  const sorted = [...items].sort(
    (a, b) =>
      a.session.startMinutes - b.session.startMinutes ||
      b.session.endMinutes - a.session.endMinutes
  );

  const clusters: TimetableSessionItem[][] = [];
  let currentCluster: TimetableSessionItem[] = [];
  let clusterEnd = -1;

  for (const item of sorted) {
    if (currentCluster.length === 0 || item.session.startMinutes < clusterEnd) {
      currentCluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.session.endMinutes);
    } else {
      clusters.push(currentCluster);
      currentCluster = [item];
      clusterEnd = item.session.endMinutes;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const result: PositionedSession[] = [];

  for (const cluster of clusters) {
    const columns: TimetableSessionItem[][] = [];
    for (const item of cluster) {
      let placed = false;
      for (let i = 0; i < columns.length; i++) {
        const lastInCol = columns[i][columns[i].length - 1];
        if (lastInCol.session.endMinutes <= item.session.startMinutes) {
          columns[i].push(item);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([item]);
      }
    }

    const totalCols = columns.length;
    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
      for (const item of columns[colIndex]) {
        result.push({ item, colIndex, totalCols });
      }
    }
  }

  return result;
}

export const CourseTimetable: React.FC<CourseTimetableProps> = ({
  course,
  nowDay = 'Lun',
  nowMinutes = 600,
  selectedSectionNumber = 'ALL',
  onSelectSectionNumber
}) => {
  const [viewMode, setViewMode] = useState<'matriz' | 'agenda'>('matriz');
  const [selectedSessionItem, setSelectedSessionItem] = useState<TimetableSessionItem | null>(null);

  // Flatten all sessions across visible sections
  const allSessionItems = useMemo<TimetableSessionItem[]>(() => {
    const sectionsToInclude = selectedSectionNumber === 'ALL'
      ? course.extendedSections
      : course.extendedSections.filter(s => s.sectionNumber === selectedSectionNumber);

    const items: TimetableSessionItem[] = [];
    sectionsToInclude.forEach(sec => {
      const palette = getSectionColor(sec.sectionNumber);
      sec.sessions.forEach(sess => {
        items.push({
          id: `${sec.sectionNumber}-${sess.id || sess.sessionGroup}-${sess.day}-${sess.startMinutes}`,
          sectionNumber: sec.sectionNumber,
          sectionColor: palette.border,
          session: sess
        });
      });
    });
    return items;
  }, [course, selectedSectionNumber]);

  // Group session items by Day
  const sessionsByDay = useMemo<Record<DayOfWeek, TimetableSessionItem[]>>(() => {
    const map: Record<DayOfWeek, TimetableSessionItem[]> = {
      Lun: [],
      Mar: [],
      Mie: [],
      Jue: [],
      Vie: [],
      Sab: []
    };
    allSessionItems.forEach(item => {
      if (map[item.session.day]) {
        map[item.session.day].push(item);
      }
    });
    return map;
  }, [allSessionItems]);

  // Active days that actually have classes in this course
  const activeDaysWithClasses = useMemo<DayOfWeek[]>(() => {
    const days = ALL_DAYS.filter(d => (sessionsByDay[d] || []).length > 0);
    return days.length > 0 ? days : ALL_DAYS;
  }, [sessionsByDay]);

  const defaultAgendaDay = useMemo<DayOfWeek>(() => {
    if (nowDay && activeDaysWithClasses.includes(nowDay)) return nowDay;
    return activeDaysWithClasses[0] || 'Lun';
  }, [nowDay, activeDaysWithClasses]);

  const [agendaDay, setAgendaDay] = useState<DayOfWeek>(defaultAgendaDay);

  // Default to showing only active days if course has classes on fewer than 6 days
  const [filterOnlyActiveDays, setFilterOnlyActiveDays] = useState<boolean>(true);

  const daysToRender = useMemo<DayOfWeek[]>(() => {
    if (filterOnlyActiveDays && activeDaysWithClasses.length > 0 && activeDaysWithClasses.length < 6) {
      return activeDaysWithClasses;
    }
    return ALL_DAYS;
  }, [filterOnlyActiveDays, activeDaysWithClasses]);

  // Determine dynamic bounds
  const { minHour, maxHour, totalHours } = useMemo(() => {
    let minH = 7;
    let maxH = 22;

    if (allSessionItems.length > 0) {
      const earliestStart = Math.min(...allSessionItems.map(i => i.session.startMinutes));
      const latestEnd = Math.max(...allSessionItems.map(i => i.session.endMinutes));
      const earliestH = Math.floor(earliestStart / 60);
      const latestH = Math.ceil(latestEnd / 60);
      minH = Math.max(7, Math.min(earliestH, 8));
      maxH = Math.min(22, Math.max(latestH, 18));
    }

    return {
      minHour: minH,
      maxHour: maxH,
      totalHours: Math.max(8, maxH - minH)
    };
  }, [allSessionItems]);

  const minMinutes = minHour * 60;
  const totalMinutes = totalHours * 60;

  // Hourly time marks
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

  // Now indicator
  const showNowIndicator = nowMinutes >= minMinutes && nowMinutes <= minMinutes + totalMinutes;
  const nowTopPercent = ((nowMinutes - minMinutes) / totalMinutes) * 100;

  const slotHeightPerHour = 56;
  const gridHeight = Math.max(520, totalHours * slotHeightPerHour);

  // Positioned sessions per day
  const positionedByDay = useMemo<Record<DayOfWeek, PositionedSession[]>>(() => {
    const res: Record<DayOfWeek, PositionedSession[]> = {
      Lun: [],
      Mar: [],
      Mie: [],
      Jue: [],
      Vie: [],
      Sab: []
    };
    ALL_DAYS.forEach(day => {
      res[day] = computeCourseSessionLayouts(sessionsByDay[day]);
    });
    return res;
  }, [sessionsByDay]);

  return (
    <div className="prof-timetable-wrap course-timetable-wrap">
      {/* Top Toolbar: Section Filter Pills & View Mode Switcher */}
      <div className="prof-timetable-controls-bar">
        {/* Section Quick Pills */}
        <div className="prof-day-jump-pills course-sec-pills-bar">
          <button
            type="button"
            className={`prof-day-jump-pill ${selectedSectionNumber === 'ALL' ? 'prof-day-jump-pill--active' : ''}`}
            onClick={() => onSelectSectionNumber?.('ALL')}
          >
            <Layers size={13} />
            <span>Todas las Secciones ({course.totalSectionsCount})</span>
          </button>

          {course.extendedSections.map(sec => {
            const isSelected = selectedSectionNumber === sec.sectionNumber;
            const palette = getSectionColor(sec.sectionNumber);

            return (
              <button
                key={sec.sectionNumber}
                type="button"
                className={`prof-day-jump-pill ${isSelected ? 'prof-day-jump-pill--active' : ''}`}
                onClick={() => onSelectSectionNumber?.(isSelected ? 'ALL' : sec.sectionNumber)}
                style={
                  isSelected
                    ? { backgroundColor: palette.border, borderColor: palette.border }
                    : undefined
                }
              >
                <span
                  className="sec-dot-inline"
                  style={{ backgroundColor: palette.border }}
                />
                <span>Sec. {sec.sectionNumber}</span>
                <span className="pill-day-count">{sec.sessions.length} clases</span>
              </button>
            );
          })}
          {/* Active Days Toggle (Filters out empty days so columns are spacious) */}
          {activeDaysWithClasses.length < 6 && (
            <button
              type="button"
              className={`prof-day-jump-pill ${filterOnlyActiveDays ? 'prof-day-jump-pill--active' : ''}`}
              onClick={() => setFilterOnlyActiveDays(prev => !prev)}
              title={filterOnlyActiveDays ? 'Ver semana completa (6 días)' : 'Ver solo días con clases'}
            >
              <Calendar size={13} />
              <span>{filterOnlyActiveDays ? `Días de clase (${activeDaysWithClasses.length})` : 'Toda la semana'}</span>
            </button>
          )}
        </div>

        {/* View Mode Toggle: Matriz Semanal vs Agenda */}
        <div className="prof-view-mode-toggle">
          <button
            type="button"
            className={`prof-view-toggle-btn ${viewMode === 'matriz' ? 'active' : ''}`}
            onClick={() => setViewMode('matriz')}
            title="Ver horario en matriz semanal completa"
          >
            <LayoutGrid size={13} />
            <span>Matriz</span>
          </button>
          <button
            type="button"
            className={`prof-view-toggle-btn ${viewMode === 'agenda' ? 'active' : ''}`}
            onClick={() => setViewMode('agenda')}
            title="Ver horario ordenado por días en lista tipo agenda"
          >
            <List size={13} />
            <span>Agenda</span>
          </button>
        </div>
      </div>

      {/* Touch swipe hint when horizontal overflow exists */}
      {viewMode === 'matriz' && daysToRender.length > 2 && (
        <div className="timetable-swipe-hint">
          <span>👉 Desliza horizontalmente para navegar entre los {daysToRender.length} días</span>
        </div>
      )}

      {viewMode === 'matriz' ? (
        /* ================= Matriz Semanal ================= */
        <div className="prof-timetable-container course-timetable-container">
          {/* Left Time Axis Column */}
          <div className="prof-timetable-time-col">
            <div className="prof-timetable-time-corner">
              <Clock size={13} />
              <span>Hora</span>
            </div>
            <div className="prof-timetable-time-axis" style={{ height: gridHeight }}>
              {timeMarks.map(mark => (
                <div
                  key={mark.hour}
                  className="prof-time-mark"
                  style={{ top: `${mark.topPercent}%` }}
                >
                  {mark.label}
                </div>
              ))}
            </div>
          </div>

          {/* Right Scrollable Days Grid */}
          <div className="prof-timetable-days-scroll-wrapper">
            <div
              className="prof-timetable-days-content"
              data-cols={daysToRender.length}
            >
              {/* Header Row: Days */}
              <div
                className="prof-timetable-days-header-row"
                style={{
                  gridTemplateColumns: `repeat(${daysToRender.length}, minmax(130px, 1fr))`
                }}
              >
                {daysToRender.map(day => {
                  const daySessions = sessionsByDay[day] || [];
                  const isToday = nowDay === day;

                  return (
                    <div
                      key={day}
                      className={`prof-timetable-day-col-header ${isToday ? 'prof-timetable-day-col-header--today' : ''}`}
                      onClick={() => {
                        setAgendaDay(day);
                        setViewMode('agenda');
                      }}
                      title={`Ver agenda del ${DAY_LABELS[day]}`}
                    >
                      <div className="prof-day-name-row">
                        <span className="prof-day-abbr">{day}</span>
                        <span className="prof-day-full">{DAY_LABELS[day].slice(0, 3)}</span>
                      </div>
                      <span
                        className={`prof-day-badge ${daySessions.length === 0 ? 'prof-day-badge--empty' : ''}`}
                      >
                        {daySessions.length > 0 ? `${daySessions.length} clases` : 'Libre'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Columns Container */}
              <div
                className="prof-timetable-columns-container"
                style={{
                  height: gridHeight,
                  gridTemplateColumns: `repeat(${daysToRender.length}, minmax(130px, 1fr))`
                }}
              >
                {/* Horizontal Hour Lines */}
                {timeMarks.map(mark => (
                  <div
                    key={mark.hour}
                    className="prof-grid-hour-line"
                    style={{ top: `${mark.topPercent}%` }}
                  />
                ))}

                {/* Now Indicator Line */}
                {showNowIndicator && (
                  <div
                    className="prof-timetable-now-line"
                    style={{ top: `${nowTopPercent}%` }}
                  >
                    <span className="prof-now-line-pill">Ahora</span>
                  </div>
                )}

                {/* Day Columns */}
                {daysToRender.map(day => {
                  const positioned = positionedByDay[day];
                  const isToday = nowDay === day;

                  return (
                    <div
                      key={day}
                      className={`prof-timetable-day-column ${isToday ? 'prof-timetable-day-column--today' : ''}`}
                    >
                      {positioned.map(({ item, colIndex, totalCols }) => {
                        const s = item.session;
                        const top = ((s.startMinutes - minMinutes) / totalMinutes) * 100;
                        const height = ((s.endMinutes - s.startMinutes) / totalMinutes) * 100;
                        const width = 100 / totalCols;
                        const left = colIndex * width;

                        const isLiveNow =
                          day === nowDay &&
                          nowMinutes >= s.startMinutes &&
                          nowMinutes < s.endMinutes;

                        const isSelected = selectedSessionItem?.id === item.id;
                        const palette = getSectionColor(item.sectionNumber);

                        return (
                          <div
                            key={item.id}
                            className={`prof-session-card course-session-card ${isLiveNow ? 'prof-session-card--live' : ''} ${isSelected ? 'prof-session-card--selected' : ''}`}
                            style={{
                              top: `${top}%`,
                              height: `${height}%`,
                              left: `${left}%`,
                              width: `${width}%`,
                              borderLeftColor: palette.border,
                              background: palette.bg
                            }}
                            onClick={() => setSelectedSessionItem(isSelected ? null : item)}
                            title={`Sec. ${item.sectionNumber} • ${s.sessionGroup}\n${s.startTime} - ${s.endTime}\n${s.roomDisplayName}\nProf. ${s.professor || 'Docente UTEC'}`}
                          >
                            <div className="course-card-block-top">
                              <span
                                className="course-card-block-sec"
                                style={{ color: palette.text }}
                              >
                                Sec. {item.sectionNumber}
                              </span>
                              <span className="course-card-block-type">
                                {s.sessionType}
                              </span>
                            </div>

                            <div className="course-card-block-time">
                              {s.startTime} - {s.endTime}
                            </div>

                            <div className="course-card-block-room" title={s.roomDisplayName}>
                              <MapPin size={10} />
                              <span>{s.roomDisplayName}</span>
                            </div>

                            {s.professor && !/docente\s*utec/i.test(s.professor) && (
                              <div className="course-card-block-prof" title={s.professor}>
                                {s.professor}
                              </div>
                            )}

                            {isLiveNow && (
                              <span className="block-live-tag">
                                <Radio size={9} className="live-spin" /> EN VIVO
                              </span>
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
      ) : (
        /* ================= Vista Agenda Diaria ================= */
        <div className="course-agenda-view glass-card">
          {/* Day Tabs */}
          <div className="prof-day-jump-pills mb-3">
            {ALL_DAYS.map(day => {
              const count = (sessionsByDay[day] || []).length;
              const isSelected = agendaDay === day;
              const isToday = nowDay === day;

              return (
                <button
                  key={day}
                  type="button"
                  className={`prof-day-jump-pill ${isSelected ? 'prof-day-jump-pill--active' : ''} ${isToday ? 'prof-day-jump-pill--today' : ''}`}
                  onClick={() => setAgendaDay(day)}
                >
                  <span>{DAY_LABELS[day]}</span>
                  <span className="pill-day-count">{count}</span>
                  {isToday && <span className="today-dot" />}
                </button>
              );
            })}
          </div>

          {/* Agenda List for Selected Day */}
          <div className="agenda-sessions-list">
            {(sessionsByDay[agendaDay] || []).length === 0 ? (
              <div className="agenda-empty-state">
                <Calendar size={32} className="text-muted" />
                <p>No hay clases programadas los {DAY_LABELS[agendaDay]}</p>
              </div>
            ) : (
              (sessionsByDay[agendaDay] || []).map(item => {
                const s = item.session;
                const palette = getSectionColor(item.sectionNumber);
                const isLiveNow =
                  agendaDay === nowDay &&
                  nowMinutes >= s.startMinutes &&
                  nowMinutes < s.endMinutes;

                const gcalUrl = generateGoogleCalendarUrlForSession(
                  s,
                  course.name,
                  course.code,
                  item.sectionNumber
                );

                return (
                  <div
                    key={item.id}
                    className={`agenda-session-card glass-card ${isLiveNow ? 'agenda-session-card--live' : ''}`}
                    style={{ borderLeftColor: palette.border }}
                  >
                    <div className="agenda-card-header">
                      <div className="agenda-card-title-group">
                        <span
                          className="agenda-sec-tag"
                          style={{
                            backgroundColor: palette.bg,
                            color: palette.text,
                            borderColor: palette.border
                          }}
                        >
                          Sección {item.sectionNumber}
                        </span>
                        <span className="agenda-group-tag">
                          {s.sessionGroup} ({s.sessionType})
                        </span>
                        <span
                          className={`session-modality-badge ${s.modality === 'Presencial' ? 'modality--presencial' : 'modality--virtual'}`}
                        >
                          {s.modality}
                        </span>
                        {isLiveNow && (
                          <span className="agenda-live-badge">
                            <Radio size={11} className="live-spin" /> EN CLASE AHORA
                          </span>
                        )}
                      </div>

                      <a
                        href={gcalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="agenda-gcal-btn"
                        title="Agendar en Google Calendar como oyente"
                      >
                        <Calendar size={13} />
                        <span>Agendar Oyente</span>
                      </a>
                    </div>

                    <div className="agenda-card-body-grid">
                      <div className="agenda-info-item">
                        <Clock size={14} className="text-accent" />
                        <span>
                          {s.startTime} - {s.endTime} ({s.durationHours} hrs)
                        </span>
                      </div>

                      <div className="agenda-info-item">
                        <MapPin size={14} className="text-emerald" />
                        <a
                          href={`/aulas?search=${encodeURIComponent(s.roomCode || s.roomDisplayName)}`}
                          className="session-room-link"
                          title="Ver ocupación y mapa en Buscador de Aulas"
                        >
                          {s.roomDisplayName}
                          <ExternalLink size={11} />
                        </a>
                        {s.floor > 1 && (
                          <span className="session-floor-tag">Piso {s.floor}</span>
                        )}
                      </div>

                      <div className="agenda-info-item">
                        <GraduationCap size={14} className="text-purple" />
                        {s.professor && !/docente\s*utec/i.test(s.professor) ? (
                          <a
                            href={`/profesores?search=${encodeURIComponent(s.professor)}`}
                            className="session-prof-link"
                            title="Ver perfil del docente"
                          >
                            {s.professor}
                          </a>
                        ) : (
                          <span className="session-prof-unassigned">Docente UTEC</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Selected Session Inspector Drawer/Card */}
      {selectedSessionItem && (
        <div className="prof-session-inspector glass-card animate-fadeIn">
          <div className="inspector-header">
            <div className="inspector-title-group">
              <span
                className="inspector-sec-badge"
                style={{
                  backgroundColor: getSectionColor(selectedSessionItem.sectionNumber).bg,
                  color: getSectionColor(selectedSessionItem.sectionNumber).text,
                  borderColor: getSectionColor(selectedSessionItem.sectionNumber).border
                }}
              >
                Sección {selectedSessionItem.sectionNumber}
              </span>
              <h4 className="inspector-title">
                {selectedSessionItem.session.sessionGroup} ({selectedSessionItem.session.sessionType})
              </h4>
            </div>
            <button
              type="button"
              className="inspector-close-btn"
              onClick={() => setSelectedSessionItem(null)}
              title="Cerrar inspector"
            >
              ✕
            </button>
          </div>

          <div className="inspector-grid">
            <div className="inspector-item">
              <Clock size={14} className="text-accent" />
              <span>
                <strong>{DAY_LABELS[selectedSessionItem.session.day]}</strong> {selectedSessionItem.session.startTime} - {selectedSessionItem.session.endTime}
              </span>
            </div>

            <div className="inspector-item">
              <MapPin size={14} className="text-emerald" />
              <a
                href={`/aulas?search=${encodeURIComponent(selectedSessionItem.session.roomCode || selectedSessionItem.session.roomDisplayName)}`}
                className="session-room-link"
              >
                {selectedSessionItem.session.roomDisplayName}
                <ExternalLink size={11} />
              </a>
              {selectedSessionItem.session.floor > 1 && (
                <span className="session-floor-tag">Piso {selectedSessionItem.session.floor}</span>
              )}
            </div>

            <div className="inspector-item">
              <GraduationCap size={14} className="text-purple" />
              <span>{selectedSessionItem.session.professor || 'Docente UTEC'}</span>
            </div>
          </div>

          <div className="inspector-actions">
            <a
              href={generateGoogleCalendarUrlForSession(
                selectedSessionItem.session,
                course.name,
                course.code,
                selectedSessionItem.sectionNumber
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              <Calendar size={13} />
              <span>Agendar esta clase en Google Calendar</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
