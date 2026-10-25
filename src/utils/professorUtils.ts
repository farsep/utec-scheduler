import type { Course, DayOfWeek, SessionType } from '../types/schedule';
import type {
  ProfessorInfo,
  ProfessorSession,
  ProfessorCourseSummary,
  ProfessorFilterState
} from '../types/professor';
import { parseLocationInfo, ALL_DAYS } from './classroomUtils';
import { parseSessionType, getCourseColor } from './scheduleUtils';

export const DEPARTMENT_CONFIG: Record<string, { label: string; color: string }> = {
  CS: { label: 'Ciencia de la Computación', color: '#3b82f6' },
  CC: { label: 'Computación y Sistemas', color: '#6366f1' },
  DS: { label: 'Ciencia de Datos', color: '#8b5cf6' },
  PI: { label: 'Ingeniería Industrial', color: '#f59e0b' },
  ME: { label: 'Mecatrónica / Mecánica', color: '#06b6d4' },
  BI: { label: 'Bioingeniería', color: '#10b981' },
  HH: { label: 'Humanidades y Artes', color: '#ec4899' },
  MA: { label: 'Matemáticas', color: '#3b82f6' },
  QU: { label: 'Química', color: '#14b8a6' },
  FIS: { label: 'Física', color: '#8b5cf6' },
  AM: { label: 'Ing. Ambiental', color: '#22c55e' },
  ET: { label: 'Ing. Electrónica', color: '#eab308' },
  AD: { label: 'Administración y Negocios', color: '#f97316' },
  EN: { label: 'Ing. de la Energía', color: '#ef4444' },
  OTRO: { label: 'Interdisciplinario', color: '#64748b' }
};

/**
 * Returns department identifier and metadata from course code
 */
export function getDepartmentFromCourseCode(courseCode: string): { code: string; label: string; color: string } {
  if (!courseCode) return { code: 'OTRO', ...DEPARTMENT_CONFIG.OTRO };

  const prefixMatch = courseCode.match(/^([A-Za-z]+)/);
  if (!prefixMatch) return { code: 'OTRO', ...DEPARTMENT_CONFIG.OTRO };

  const prefix = prefixMatch[1].toUpperCase();
  if (DEPARTMENT_CONFIG[prefix]) {
    return { code: prefix, ...DEPARTMENT_CONFIG[prefix] };
  }

  // Check 2-letter fallback if prefix is 3+ letters (e.g. FIS -> FIS, COM -> CS)
  const twoLetter = prefix.slice(0, 2);
  if (DEPARTMENT_CONFIG[twoLetter]) {
    return { code: twoLetter, ...DEPARTMENT_CONFIG[twoLetter] };
  }

  return { code: 'OTRO', ...DEPARTMENT_CONFIG.OTRO };
}

/**
 * Cleanly formats and normalizes academic professor names
 */
export function formatProfessorName(raw: string): {
  displayName: string;
  lastNameFirst: string;
  initials: string;
} {
  if (!raw) return { displayName: 'Docente Sin Nombre', lastNameFirst: 'Docente', initials: 'D' };

  const cleaned = raw.replace(/\s+/g, ' ').trim();

  // Helper to capitalize words while handling small connectors (de, del, la, van, etc.)
  const toTitleCase = (str: string) => {
    const minorWords = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'di', 'van', 'von']);
    return str
      .toLowerCase()
      .split(' ')
      .map((word, idx) => {
        if (idx > 0 && minorWords.has(word)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  };

  if (cleaned.includes(',')) {
    const [rawLast, rawFirst] = cleaned.split(',').map(s => s.trim());
    const displayFirst = toTitleCase(rawFirst || '');
    const displayLast = toTitleCase(rawLast || '');
    const displayName = (displayFirst + ' ' + displayLast).trim();
    const lastNameFirst = (displayLast + ', ' + displayFirst).trim();

    // Initials: First letter of first name + First letter of last name
    const firstInitial = (rawFirst || '').trim().charAt(0).toUpperCase();
    const lastInitial = (rawLast || '').trim().charAt(0).toUpperCase();
    const initials = (firstInitial + lastInitial) || 'P';

    return { displayName, lastNameFirst, initials };
  } else {
    const parts = cleaned.split(' ').filter(Boolean);
    const displayName = toTitleCase(cleaned);
    let initials = 'P';
    if (parts.length >= 2) {
      initials = (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    } else if (parts.length === 1) {
      initials = parts[0].slice(0, 2).toUpperCase();
    }
    return {
      displayName,
      lastNameFirst: displayName,
      initials
    };
  }
}

/**
 * Extracts and compiles comprehensive Professor directory from raw parsed Courses array
 */
export function extractProfessorsFromCourses(courses: Course[]): ProfessorInfo[] {
  interface ProfAccumulator {
    rawName: string;
    email: string;
    sessionKeys: Set<string>;
    sessions: ProfessorSession[];
    courseCodes: Set<string>;
    rooms: Set<string>;
  }

  const profMap = new Map<string, ProfAccumulator>();

  for (const course of courses) {
    const courseColor = course.color || getCourseColor(course.code);

    for (const section of course.sections) {
      for (const session of section.sessions) {
        const rawProf = (session.professor || '').trim();
        if (!rawProf || rawProf.toLowerCase() === 'docente' || rawProf === '-') continue;

        const profKey = rawProf.toLowerCase();
        if (!profMap.has(profKey)) {
          profMap.set(profKey, {
            rawName: rawProf,
            email: session.email || '',
            sessionKeys: new Set(),
            sessions: [],
            courseCodes: new Set(),
            rooms: new Set()
          });
        }

        const profAcc = profMap.get(profKey)!;
        if (!profAcc.email && session.email) {
          profAcc.email = session.email;
        }

        // Deduplication key to prevent repeated sessions from student sub-group variants
        const dedupeKey = `${course.code}-${session.sessionGroup}-${session.day}-${session.startMinutes}-${session.endMinutes}`;
        if (profAcc.sessionKeys.has(dedupeKey)) continue;
        profAcc.sessionKeys.add(dedupeKey);

        const durationHours = Math.max(0.5, (session.endMinutes - session.startMinutes) / 60);
        const parsedLoc = parseLocationInfo(session.location);
        const roomCode = parsedLoc ? parsedLoc.code : (session.location || 'Virtual');
        const roomDisplayName = parsedLoc ? parsedLoc.displayName : (session.location || 'Aula Asignada');
        const floor = parsedLoc ? parsedLoc.floor : 1;

        profAcc.courseCodes.add(course.code);
        if (roomCode && roomCode !== 'Virtual') profAcc.rooms.add(roomCode);

        profAcc.sessions.push({
          id: `${course.code}-${session.sessionGroup}-${session.day}-${session.startMinutes}`,
          courseCode: course.code,
          courseName: course.name,
          courseColor,
          sectionNumber: section.sectionNumber,
          sessionGroup: session.sessionGroup,
          sessionType: parseSessionType(session.sessionGroup),
          day: session.day,
          startTime: session.startTime,
          endTime: session.endTime,
          startMinutes: session.startMinutes,
          endMinutes: session.endMinutes,
          durationHours,
          frequency: session.frequency || 'Semana General',
          rawLocation: session.location,
          roomCode,
          roomDisplayName,
          floor,
          modality: session.modality || 'Presencial',
          vacancies: session.vacancies || 0,
          enrolled: session.enrolled || 0
        });
      }
    }
  }

  // Compile final ProfessorInfo list
  const professors: ProfessorInfo[] = [];

  profMap.forEach((acc, key) => {
    const { displayName, lastNameFirst, initials } = formatProfessorName(acc.rawName);

    // Group sessions by day & sort chronologically
    const sessionsByDay: Record<DayOfWeek, ProfessorSession[]> = {
      Lun: [],
      Mar: [],
      Mie: [],
      Jue: [],
      Vie: [],
      Sab: []
    };

    let totalHours = 0;
    let totalVacancies = 0;
    let totalEnrolled = 0;
    let earliestStart = 1440;
    let latestEnd = 0;

    const dayHoursMap: Partial<Record<DayOfWeek, number>> = {};

    acc.sessions.forEach(sess => {
      if (sessionsByDay[sess.day]) {
        sessionsByDay[sess.day].push(sess);
        totalHours += sess.durationHours;
        totalVacancies += sess.vacancies;
        totalEnrolled += sess.enrolled;

        earliestStart = Math.min(earliestStart, sess.startMinutes);
        latestEnd = Math.max(latestEnd, sess.endMinutes);

        dayHoursMap[sess.day] = (dayHoursMap[sess.day] || 0) + sess.durationHours;
      }
    });

    ALL_DAYS.forEach(day => {
      sessionsByDay[day].sort((a, b) => a.startMinutes - b.startMinutes);
    });

    // Determine busiest day
    let busiestDay: DayOfWeek | null = null;
    let maxDayHours = 0;
    ALL_DAYS.forEach(day => {
      const h = dayHoursMap[day] || 0;
      if (h > maxDayHours) {
        maxDayHours = h;
        busiestDay = day;
      }
    });

    const daysTaught = ALL_DAYS.filter(d => sessionsByDay[d].length > 0);

    // Compile courses summaries
    const courseMap = new Map<string, ProfessorCourseSummary>();
    acc.sessions.forEach(sess => {
      if (!courseMap.has(sess.courseCode)) {
        courseMap.set(sess.courseCode, {
          code: sess.courseCode,
          name: sess.courseName,
          color: sess.courseColor,
          sectionsCount: 0,
          sections: [],
          totalWeeklyHours: 0,
          roomCodes: []
        });
      }
      const cSummary = courseMap.get(sess.courseCode)!;
      cSummary.totalWeeklyHours += sess.durationHours;
      if (!cSummary.sections.includes(sess.sectionNumber)) {
        cSummary.sections.push(sess.sectionNumber);
        cSummary.sectionsCount++;
      }
      if (sess.roomCode && !cSummary.roomCodes.includes(sess.roomCode)) {
        cSummary.roomCodes.push(sess.roomCode);
      }
    });

    const coursesSummaryList = Array.from(courseMap.values()).sort((a, b) => b.totalWeeklyHours - a.totalWeeklyHours);

    // Department inference from primary course
    const primaryCourseCode = coursesSummaryList[0]?.code || '';
    const deptInfo = getDepartmentFromCourseCode(primaryCourseCode);

    const uniqueSectionsCount = new Set(acc.sessions.map(s => `${s.courseCode}-${s.sectionNumber}`)).size;

    professors.push({
      id: key.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
      rawName: acc.rawName,
      displayName,
      lastNameFirst,
      initials,
      email: acc.email,
      department: deptInfo.code,
      departmentLabel: deptInfo.label,
      sessions: acc.sessions,
      sessionsByDay,
      courses: coursesSummaryList,
      totalHoursPerWeek: Math.round(totalHours * 10) / 10,
      totalSessionsCount: acc.sessions.length,
      uniqueCoursesCount: coursesSummaryList.length,
      uniqueSectionsCount,
      uniqueRooms: Array.from(acc.rooms).sort(),
      daysTaught,
      busiestDay,
      totalVacancies,
      totalEnrolled,
      earliestStartMinutes: earliestStart === 1440 ? 420 : earliestStart,
      latestEndMinutes: latestEnd === 0 ? 1320 : latestEnd
    });
  });

  // Sort alphabetically by displayName ascending by default
  professors.sort((a, b) => a.displayName.localeCompare(b.displayName));

  return professors;
}

/**
 * Real-time live status evaluation for a professor
 */
export function evaluateProfessorLiveStatus(
  prof: ProfessorInfo,
  nowDay: DayOfWeek,
  nowMinutes: number
): {
  isTeachingNow: boolean;
  currentSession?: ProfessorSession;
  nextSession?: ProfessorSession;
  minutesUntilNext?: number;
} {
  const todaySessions = prof.sessionsByDay[nowDay] || [];

  // Check if currently teaching
  const currentSession = todaySessions.find(
    s => nowMinutes >= s.startMinutes && nowMinutes < s.endMinutes
  );

  if (currentSession) {
    return {
      isTeachingNow: true,
      currentSession
    };
  }

  // Look for next class today
  const nextToday = todaySessions.find(s => s.startMinutes > nowMinutes);
  if (nextToday) {
    return {
      isTeachingNow: false,
      nextSession: nextToday,
      minutesUntilNext: nextToday.startMinutes - nowMinutes
    };
  }

  // Otherwise find next class in upcoming days
  const currentDayIndex = ALL_DAYS.indexOf(nowDay);
  for (let offset = 1; offset < ALL_DAYS.length; offset++) {
    const nextDay = ALL_DAYS[(currentDayIndex + offset) % ALL_DAYS.length];
    const sessions = prof.sessionsByDay[nextDay] || [];
    if (sessions.length > 0) {
      return {
        isTeachingNow: false,
        nextSession: sessions[0]
      };
    }
  }

  return { isTeachingNow: false };
}

/**
 * Filter and sort professors according to search query, day, department and live flags
 */
export function filterAndSortProfessors(
  professors: ProfessorInfo[],
  filter: ProfessorFilterState,
  nowDay: DayOfWeek,
  nowMinutes: number
): ProfessorInfo[] {
  const query = filter.searchQuery.trim().toLowerCase();

  return professors
    .filter(prof => {
      // 1. Text search across name, academic name, email, course codes, course names, rooms
      if (query) {
        const matchesName =
          prof.displayName.toLowerCase().includes(query) ||
          prof.lastNameFirst.toLowerCase().includes(query) ||
          prof.rawName.toLowerCase().includes(query);

        const matchesEmail = prof.email.toLowerCase().includes(query);

        const matchesCourse = prof.courses.some(
          c => c.code.toLowerCase().includes(query) || c.name.toLowerCase().includes(query)
        );

        const matchesRoom = prof.uniqueRooms.some(r => r.toLowerCase().includes(query));

        if (!matchesName && !matchesEmail && !matchesCourse && !matchesRoom) {
          return false;
        }
      }

      // 2. Day filter
      if (filter.selectedDay !== 'ALL') {
        if (!prof.daysTaught.includes(filter.selectedDay)) {
          return false;
        }
      }

      // 3. Department filter
      if (filter.selectedDepartment !== 'ALL') {
        if (prof.department !== filter.selectedDepartment) {
          return false;
        }
      }

      // 4. Modality filter
      if (filter.selectedModality !== 'ALL') {
        const hasModality = prof.sessions.some(s =>
          filter.selectedModality === 'Presencial'
            ? s.modality.toLowerCase().includes('presencial')
            : !s.modality.toLowerCase().includes('presencial')
        );
        if (!hasModality) return false;
      }

      // 5. Live now filter
      if (filter.onlyLiveNow) {
        const { isTeachingNow } = evaluateProfessorLiveStatus(prof, nowDay, nowMinutes);
        if (!isTeachingNow) return false;
      }

      // 6. Only today filter
      if (filter.onlyToday) {
        if (!prof.daysTaught.includes(nowDay)) return false;
      }

      return true;
    })
    .sort((a, b) => {
      switch (filter.sortBy) {
        case 'name_desc':
          return b.displayName.localeCompare(a.displayName);
        case 'hours_desc':
          return b.totalHoursPerWeek - a.totalHoursPerWeek || a.displayName.localeCompare(b.displayName);
        case 'courses_desc':
          return b.uniqueCoursesCount - a.uniqueCoursesCount || a.displayName.localeCompare(b.displayName);
        case 'sessions_desc':
          return b.totalSessionsCount - a.totalSessionsCount || a.displayName.localeCompare(b.displayName);
        case 'students_desc':
          return b.totalEnrolled - a.totalEnrolled || b.totalVacancies - a.totalVacancies;
        case 'name_asc':
        default:
          return a.displayName.localeCompare(b.displayName);
      }
    });
}
