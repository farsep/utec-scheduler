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
  CourseExtendedSession
} from '../../types/courseDirectory';
import { ALL_DAYS, DAY_LABELS } from '../../utils/classroomUtils';
import { formatProfessorName } from '../../utils/professorUtils';
import { CustomSelect, type SelectOption } from '../common/CustomSelect';
import {
  generateGoogleCalendarUrlForSession,
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
  mergedSections?: string[];
  overflowItems?: TimetableSessionItem[];
  sectionColor: string;
  session: CourseExtendedSession;
}

export interface PositionedSession {
  item: TimetableSessionItem;
  colIndex: number;
  totalCols: number;
}

/**
 * Formats verbose section names like "1 (TEORÍA 11)" -> "Sec. 1 • T11"
 */
export function formatShortSectionLabel(secNum: string): string {
  const trimmed = secNum.trim();
  const match = trimmed.match(/^(\d+)\s*\((.+)\)$/);
  if (!match) {
    return `Sec. ${trimmed}`;
  }
  const baseSec = match[1];
  const inner = match[2].trim();
  const shortInner = inner
    .replace(/TEOR[IÍ]A\s*/i, 'T')
    .replace(/LABORATORIO\s*/i, 'L')
    .replace(/PR[AÁ]CTICA\s*/i, 'P')
    .replace(/TALLER\s*/i, 'TA');
  return `Sec. ${baseSec} • ${shortInner}`;
}

function abbreviateSessionType(type: string): string {
  if (/teor/i.test(type)) return 'TEO';
  if (/lab/i.test(type)) return 'LAB';
  if (/pr[aá]c/i.test(type)) return 'PRÁC';
  return type.slice(0, 4).toUpperCase();
}

/**
 * Computes non-overlapping horizontal layouts for sessions occurring on the same day and time.
 * Caps maximum parallel columns per time cluster at MAX_COLS = 3 so mobile/tablet blocks
 * are never crushed into unreadable slivers when viewing all sections.
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

  const MAX_COLS = 3;
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

    if (columns.length <= MAX_COLS) {
      const totalCols = columns.length;
      for (let colIndex = 0; colIndex < columns.length; colIndex++) {
        for (const item of columns[colIndex]) {
          result.push({ item, colIndex, totalCols });
        }
      }
    } else {
      // Columns 0 and 1 render normally; columns 2..N-1 are merged into column 2 per overlapping time window
      for (let colIndex = 0; colIndex < MAX_COLS - 1; colIndex++) {
        for (const item of columns[colIndex]) {
          result.push({ item, colIndex, totalCols: MAX_COLS });
        }
      }
      const tailItems = columns
        .slice(MAX_COLS - 1)
        .flat()
        .sort(
          (a, b) =>
            a.session.startMinutes - b.session.startMinutes ||
            b.session.endMinutes - a.session.endMinutes
        );

      const subGroups: TimetableSessionItem[][] = [];
      let currGroup: TimetableSessionItem[] = [];
      let currEnd = -1;

      for (const tItem of tailItems) {
        if (currGroup.length === 0 || tItem.session.startMinutes < currEnd) {
          currGroup.push(tItem);
          currEnd = Math.max(currEnd, tItem.session.endMinutes);
        } else {
          subGroups.push(currGroup);
          currGroup = [tItem];
          currEnd = tItem.session.endMinutes;
        }
      }
      if (currGroup.length > 0) {
        subGroups.push(currGroup);
      }

      for (const grp of subGroups) {
        const primary = grp[0];
        result.push({
          item: {
            ...primary,
            overflowItems: grp.length > 1 ? grp : undefined
          },
          colIndex: MAX_COLS - 1,
          totalCols: MAX_COLS
        });
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
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 700 : false
  );
  const daysScrollRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setIsMobileViewport(window.innerWidth <= 700);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Flatten all sessions across visible sections and merge identical shared lectures when viewing 'ALL'
  const allSessionItems = useMemo<TimetableSessionItem[]>(() => {
    const sectionsToInclude = selectedSectionNumber === 'ALL'
      ? course.extendedSections
      : course.extendedSections.filter(s => s.sectionNumber === selectedSectionNumber);

    const rawItems: TimetableSessionItem[] = [];
    sectionsToInclude.forEach(sec => {
      const palette = getSectionColor(sec.sectionNumber);
      sec.sessions.forEach(sess => {
        rawItems.push({
          id: `${sec.sectionNumber}-${sess.id || sess.sessionGroup}-${sess.day}-${sess.startMinutes}`,
          sectionNumber: sec.sectionNumber,
          sectionColor: palette.border,
          session: sess
        });
      });
    });

    if (selectedSectionNumber !== 'ALL') {
      return rawItems;
    }

    // Deduplicate identical shared sessions (e.g. TEORÍA 1 shared by sub-sections 1.11-1.14)
    const mergedMap = new Map<string, TimetableSessionItem>();
    for (const item of rawItems) {
      const s = item.session;
      const key = `${s.day}|${s.startMinutes}|${s.endMinutes}|${s.sessionGroup}|${s.roomDisplayName}|${s.professor}`;
      const existing = mergedMap.get(key);
      if (existing) {
        const list = existing.mergedSections || [existing.sectionNumber];
        if (!list.includes(item.sectionNumber)) {
          list.push(item.sectionNumber);
        }
        existing.mergedSections = list;
      } else {
        mergedMap.set(key, {
          ...item,
          mergedSections: [item.sectionNumber]
        });
      }
    }

    return Array.from(mergedMap.values());
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

  // Default to full 6-day week (false) across Desktop, Tablet, and Mobile so the student always
  // sees the complete Lunes-Sábado calendar grid by default. Users can still toggle Zoom if desired.
  const [filterOnlyActiveDays, setFilterOnlyActiveDays] = useState<boolean>(false);

  // Full academic day (07:00 - 22:00) vs compact hour range toggle
  const [compactHours, setCompactHours] = useState<boolean>(false);

  const daysToRender = useMemo<DayOfWeek[]>(() => {
    if (filterOnlyActiveDays && activeDaysWithClasses.length > 0 && activeDaysWithClasses.length < 6) {
      return activeDaysWithClasses;
    }
    return ALL_DAYS;
  }, [filterOnlyActiveDays, activeDaysWithClasses]);

  // Determine hour bounds: Full Academic Day (07:00 - 21:00/22:00) by default so the full grid is visible
  const { minHour, maxHour, totalHours } = useMemo(() => {
    let minH = 7;
    let maxH = 22;

    if (allSessionItems.length > 0) {
      const earliestStart = Math.min(...allSessionItems.map(i => i.session.startMinutes));
      const latestEnd = Math.max(...allSessionItems.map(i => i.session.endMinutes));
      const earliestH = Math.floor(earliestStart / 60);
      const latestH = Math.ceil(latestEnd / 60);

      if (compactHours) {
        minH = Math.max(7, earliestH);
        maxH = Math.min(22, Math.max(minH + 5, latestH + 1));
      } else {
        minH = Math.min(7, earliestH);
        maxH = Math.max(21, Math.min(22, latestH + 1));
      }
    }

    return {
      minHour: minH,
      maxHour: maxH,
      totalHours: Math.max(5, maxH - minH)
    };
  }, [allSessionItems, compactHours]);

  const minMinutes = minHour * 60;
  const totalMinutes = totalHours * 60;

  // Hourly time marks
  const timeMarks = useMemo(() => {
    const marks: { hour: number; label: string; shortLabel: string; topPercent: number }[] = [];
    for (let h = minHour; h <= maxHour; h++) {
      marks.push({
        hour: h,
        label: `${String(h).padStart(2, '0')}:00`,
        shortLabel: `${String(h).padStart(2, '0')}h`,
        topPercent: ((h * 60 - minMinutes) / totalMinutes) * 100
      });
    }
    return marks;
  }, [minHour, maxHour, minMinutes, totalMinutes]);

  // Now indicator
  const showNowIndicator = nowMinutes >= minMinutes && nowMinutes <= minMinutes + totalMinutes;
  const nowTopPercent = ((nowMinutes - minMinutes) / totalMinutes) * 100;

  // Adaptive row height so the full 07:00-21:00 grid fits 100% on screen without scrolling
  const slotHeightPerHour = isMobileViewport
    ? (compactHours ? 42 : 27)
    : (compactHours ? 46 : 31);
  const gridHeight = Math.max(isMobileViewport ? 220 : 320, totalHours * slotHeightPerHour);

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

  // Compute max parallel columns per day and overall
  const maxColsByDay = useMemo<Record<DayOfWeek, number>>(() => {
    const map: Record<DayOfWeek, number> = { Lun: 0, Mar: 0, Mie: 0, Jue: 0, Vie: 0, Sab: 0 };
    ALL_DAYS.forEach(d => {
      const pos = positionedByDay[d] || [];
      if (pos.length === 0) {
        map[d] = 0;
      } else {
        map[d] = Math.max(1, ...pos.map(p => p.totalCols));
      }
    });
    return map;
  }, [positionedByDay]);

  const maxColsInAnyDay = useMemo(() => {
    return Math.max(1, ...daysToRender.map(d => maxColsByDay[d] || 1));
  }, [daysToRender, maxColsByDay]);

  // Smart Proportional Elastic Grid Template Columns:
  // When showing all 6 days (Lun-Sab), empty days ('Libre') take a slimmer proportional track
  // while active days expand automatically based on how many parallel sections they hold.
  // This guarantees all 6 days fit 100% of the width with ZERO horizontal scroll!
  const gridTemplateColumns = useMemo(() => {
    if (!filterOnlyActiveDays && daysToRender.length === 6) {
      return daysToRender
        .map(d => {
          const cols = maxColsByDay[d];
          if (cols === 0) {
            return isMobileViewport ? 'minmax(28px, 0.42fr)' : 'minmax(68px, 0.72fr)';
          }
          if (cols === 1) {
            return isMobileViewport ? 'minmax(54px, 1.35fr)' : 'minmax(112px, 1.35fr)';
          }
          if (cols === 2) {
            return isMobileViewport ? 'minmax(68px, 1.65fr)' : 'minmax(140px, 1.65fr)';
          }
          return isMobileViewport ? 'minmax(78px, 1.9fr)' : 'minmax(168px, 1.95fr)';
        })
        .join(' ');
    }

    // Zoomed / Active-Days-Only mode
    if (daysToRender.length === 1) return 'minmax(100%, 1fr)';
    if (daysToRender.length === 2) {
      return maxColsInAnyDay >= 3 ? 'repeat(2, minmax(165px, 1fr))' : 'repeat(2, minmax(130px, 1fr))';
    }
    const minW = maxColsInAnyDay === 1 ? '108px' : maxColsInAnyDay === 2 ? '150px' : '195px';
    return `repeat(${daysToRender.length}, minmax(${minW}, 1fr))`;
  }, [filterOnlyActiveDays, daysToRender, maxColsByDay, isMobileViewport, maxColsInAnyDay]);

  const isFullWeekElastic = !filterOnlyActiveDays && daysToRender.length === 6;

  // Section dropdown options for quick filtering on mobile/tablet
  const sectionSelectOptions = useMemo<SelectOption[]>(() => [
    {
      value: 'ALL',
      label: `Todas las secciones (${course.totalSectionsCount})`
    },
    ...course.extendedSections.map(s => ({
      value: s.sectionNumber,
      label: formatShortSectionLabel(s.sectionNumber),
      badge: `${s.sessions.length}h`,
      badgeColor: getSectionColor(s.sectionNumber).border
    }))
  ], [course]);

  // Scroll day column into view when clicking day jump pill
  const handleScrollToDay = (day: DayOfWeek) => {
    if (!daysScrollRef.current) return;
    const colEl = daysScrollRef.current.querySelector(`[data-day-col="${day}"]`) as HTMLElement | null;
    if (colEl) {
      colEl.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    }
  };

  // Scroll inspector into view when selecting a session
  useEffect(() => {
    if (selectedSessionItem && inspectorRef.current) {
      inspectorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedSessionItem]);

  return (
    <div className="prof-timetable-wrap course-timetable-wrap">
      {/* Compact Toolbar: Section Filter + Full Week / Zoom Toggle + View Switcher */}
      <div className="course-timetable-toolbar">
        <div className="course-timetable-top-bar">
          <div className="course-timetable-filters-left">
            {course.extendedSections.length > 1 && (!isMobileViewport || course.extendedSections.length > 6) && (
              <CustomSelect
                value={selectedSectionNumber}
                onChange={val => onSelectSectionNumber?.(val)}
                options={sectionSelectOptions}
                icon={<Layers size={13} />}
                size="sm"
                className="course-timetable-sec-dropdown"
                ariaLabel="Filtrar sección en horario"
              />
            )}

            {viewMode === 'matriz' && activeDaysWithClasses.length < 6 && (
              <button
                type="button"
                className={`prof-day-jump-pill course-days-filter-pill ${!filterOnlyActiveDays ? 'prof-day-jump-pill--active' : ''}`}
                onClick={() => setFilterOnlyActiveDays(prev => !prev)}
                title={!filterOnlyActiveDays ? 'Hacer zoom solo a los días con clases' : 'Ver semana completa (Lunes a Sábado)'}
              >
                <Calendar size={12} />
                <span>
                  {!filterOnlyActiveDays
                    ? (isMobileViewport ? '6 Días' : '6 días (Lun–Sab)')
                    : (isMobileViewport ? `Zoom (${activeDaysWithClasses.length}d)` : `Solo activos (${activeDaysWithClasses.length}d)`)}
                </span>
              </button>
            )}

            {viewMode === 'matriz' && (
              <button
                type="button"
                className={`prof-day-jump-pill course-days-filter-pill ${!compactHours ? 'prof-day-jump-pill--active' : ''}`}
                onClick={() => setCompactHours(prev => !prev)}
                title={!compactHours ? 'Compactar a solo horas con clase' : 'Mostrar jornada completa (07:00 - 22:00)'}
              >
                <Clock size={12} />
                <span>{!compactHours ? '07–22h' : (isMobileViewport ? 'Zoom h' : 'Horas activas')}</span>
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

        {/* Single-Line Horizontal Scrollable Section Pills (Never wraps into multiple vertical rows) */}
        {course.extendedSections.length > 1 && (
          <div className="course-sec-pills-strip" role="tablist" aria-label="Secciones del curso">
            <button
              type="button"
              className={`prof-day-jump-pill ${selectedSectionNumber === 'ALL' ? 'prof-day-jump-pill--active' : ''}`}
              onClick={() => onSelectSectionNumber?.('ALL')}
            >
              <Layers size={12} />
              <span>Todas ({course.totalSectionsCount})</span>
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
                  <span>{formatShortSectionLabel(sec.sectionNumber)}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Quick Day Jump Bar only when horizontal scroll is active in Zoom mode */}
        {viewMode === 'matriz' && filterOnlyActiveDays && daysToRender.length > 2 && isMobileViewport && (
          <div className="course-day-jump-bar">
            <span className="course-day-jump-label">Ir al día:</span>
            <div className="course-day-jump-chips">
              {daysToRender.map(day => {
                const count = (sessionsByDay[day] || []).length;
                return (
                  <button
                    key={day}
                    type="button"
                    className={`course-day-jump-chip ${nowDay === day ? 'course-day-jump-chip--today' : ''}`}
                    onClick={() => handleScrollToDay(day)}
                  >
                    <span>{day}</span>
                    {count > 0 && <span className="course-day-jump-count">{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {viewMode === 'matriz' ? (
        /* ================= Matriz Semanal ================= */
        <div className="prof-timetable-container course-timetable-container">
          {/* Left Time Axis Column */}
          <div className="prof-timetable-time-col">
            <div className="prof-timetable-time-corner">
              <Clock size={11} />
              <span>Hora</span>
            </div>
            <div className="prof-timetable-time-axis" style={{ height: gridHeight }}>
              {timeMarks.map(mark => (
                <div
                  key={mark.hour}
                  className="prof-time-mark"
                  style={{ top: `${mark.topPercent}%` }}
                >
                  <span className="time-mark-desktop">{mark.label}</span>
                  <span className="time-mark-mobile">{mark.shortLabel}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Days Grid (100% full width on Desktop/Tablet & Mobile 6D Elastic Mode) */}
          <div className="prof-timetable-days-scroll-wrapper" ref={daysScrollRef}>
            <div
              className="prof-timetable-days-content"
              data-cols={daysToRender.length}
              data-elastic={isFullWeekElastic ? 'true' : 'false'}
            >
              {/* Header Row: Days */}
              <div
                className="prof-timetable-days-header-row"
                style={{
                  gridTemplateColumns
                }}
              >
                {daysToRender.map(day => {
                  const daySessions = sessionsByDay[day] || [];
                  const isToday = nowDay === day;
                  const isEmptyDay = daySessions.length === 0;

                  return (
                    <div
                      key={day}
                      data-day-col={day}
                      className={`prof-timetable-day-col-header ${isToday ? 'prof-timetable-day-col-header--today' : ''} ${isEmptyDay ? 'prof-timetable-day-col-header--empty' : ''}`}
                      onClick={() => {
                        if (daySessions.length > 0) {
                          setAgendaDay(day);
                          setViewMode('agenda');
                        }
                      }}
                    >
                      <div className="prof-day-name-row">
                        <span className="prof-day-abbr">{day}</span>
                        <span className="prof-day-full">{DAY_LABELS[day]}</span>
                      </div>
                      <span
                        className={`prof-day-badge ${isEmptyDay ? 'prof-day-badge--empty' : ''}`}
                      >
                        {daySessions.length > 0 ? (
                          isMobileViewport && isFullWeekElastic
                            ? `${daySessions.length}`
                            : `${daySessions.length} ${daySessions.length === 1 ? 'clase' : 'clases'}`
                        ) : (
                          isMobileViewport && isFullWeekElastic ? '—' : 'Libre'
                        )}
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
                  gridTemplateColumns
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
                  const isEmptyDay = (sessionsByDay[day] || []).length === 0;

                  return (
                    <div
                      key={day}
                      className={`prof-timetable-day-column ${isToday ? 'prof-timetable-day-column--today' : ''} ${isEmptyDay ? 'prof-timetable-day-column--empty' : ''}`}
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

                        const mergedCount = item.mergedSections?.length || 1;
                        const overflowCount = item.overflowItems ? item.overflowItems.length - 1 : 0;
                        const baseShortSec = mergedCount > 1
                          ? `Sec. ${item.sectionNumber.split(' ')[0]} (${mergedCount} grp)`
                          : formatShortSectionLabel(item.sectionNumber);

                        const shortSecLabel =
                          isMobileViewport && (isFullWeekElastic || totalCols >= 2)
                            ? baseShortSec.replace(/^Sec\.\s*/, 'S').replace(/\s*•\s*/, '•')
                            : baseShortSec;

                        const shortProf = s.professor && !/docente\s*utec/i.test(s.professor)
                          ? formatProfessorName(s.professor).shortName
                          : null;

                        return (
                          <div
                            key={item.id}
                            className={`prof-session-card course-session-card ${isLiveNow ? 'prof-session-card--live' : ''} ${isSelected ? 'prof-session-card--selected' : ''} ${totalCols >= 2 || (isMobileViewport && isFullWeekElastic) ? 'course-session-card--compact' : ''}`}
                            style={{
                              top: `${top}%`,
                              height: `${height}%`,
                              left: `${left}%`,
                              width: `${width}%`,
                              borderLeftColor: palette.border,
                              background: palette.bg
                            }}
                            onClick={() => setSelectedSessionItem(isSelected ? null : item)}
                          >
                            <div className="course-card-block-top">
                              <span
                                className="course-card-block-sec"
                                style={{ color: palette.text }}
                              >
                                {shortSecLabel}
                              </span>
                              {overflowCount > 0 ? (
                                <span className="course-card-overflow-badge">
                                  +{overflowCount}
                                </span>
                              ) : totalCols === 1 ? (
                                <span className="course-card-block-type">
                                  {abbreviateSessionType(s.sessionType)}
                                </span>
                              ) : null}
                            </div>

                            <div className="course-card-block-time">
                              {isMobileViewport && totalCols >= 2
                                ? `${s.startTime.slice(0, 2)}-${s.endTime.slice(0, 2)}h`
                                : `${s.startTime} - ${s.endTime}`}
                            </div>

                            <div className="course-card-block-room">
                              <MapPin size={9} />
                              <span>{s.roomDisplayName.replace(/^Aula\s+/i, 'A')}</span>
                            </div>

                            {shortProf && (!isMobileViewport || totalCols === 1) && (
                              <div className="course-card-block-prof">
                                {shortProf}
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
          <div className="course-sec-pills-strip mb-2">
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
                          {formatShortSectionLabel(item.sectionNumber)}
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
                            {formatProfessorName(s.professor).displayName}
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
        <div ref={inspectorRef} className="prof-session-inspector glass-card animate-fadeIn">
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
                {formatShortSectionLabel(selectedSessionItem.sectionNumber)}
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

          {/* If this block has merged sections or overflow items, show quick chips */}
          {selectedSessionItem.mergedSections && selectedSessionItem.mergedSections.length > 1 && (
            <div className="inspector-merged-info">
              <span>Clase compartida por {selectedSessionItem.mergedSections.length} sub-secciones:</span>
              <div className="inspector-overflow-chips">
                {selectedSessionItem.mergedSections.map(secNum => (
                  <button
                    key={secNum}
                    type="button"
                    className="inspector-overflow-chip"
                    onClick={() => onSelectSectionNumber?.(secNum)}
                  >
                    {formatShortSectionLabel(secNum)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedSessionItem.overflowItems && selectedSessionItem.overflowItems.length > 1 && (
            <div className="inspector-merged-info">
              <span>Secciones en este horario ({selectedSessionItem.overflowItems.length}):</span>
              <div className="inspector-overflow-chips">
                {selectedSessionItem.overflowItems.map(ov => (
                  <button
                    key={ov.id}
                    type="button"
                    className={`inspector-overflow-chip ${ov.id === selectedSessionItem.id ? 'active' : ''}`}
                    onClick={() => setSelectedSessionItem({ ...ov, overflowItems: selectedSessionItem.overflowItems })}
                  >
                    {formatShortSectionLabel(ov.sectionNumber)}
                  </button>
                ))}
              </div>
            </div>
          )}

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
              <span>
                {selectedSessionItem.session.professor && !/docente\s*utec/i.test(selectedSessionItem.session.professor)
                  ? formatProfessorName(selectedSessionItem.session.professor).displayName
                  : 'Docente UTEC'}
              </span>
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
              <span>Agendar en Google Calendar</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
