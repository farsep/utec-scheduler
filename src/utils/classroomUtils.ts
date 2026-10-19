import type { Course, DayOfWeek } from '../types/schedule';
import type {
  ClassroomInfo,
  ClassroomSession,
  RoomType,
  FreeBlock,
  OccupiedBlock,
  ClassroomAvailability,
  ClassroomFilterState,
  LiveStatus
} from '../types/classroom';
import { timeToMinutes, minutesToTime, parseHorarioString } from './scheduleUtils';

export const UNIVERSITY_START_MINUTES = 420;  // 07:00
export const UNIVERSITY_END_MINUTES = 1320;   // 22:00

export const ALL_DAYS: DayOfWeek[] = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  Lun: 'Lunes',
  Mar: 'Martes',
  Mie: 'Miércoles',
  Jue: 'Jueves',
  Vie: 'Viernes',
  Sab: 'Sábado'
};

export const ROOM_TYPE_LABELS: Record<RoomType, { label: string; short: string; color: string; iconName: string }> = {
  aula: { label: 'Aulas Estándar', short: 'Aula', color: '#3b82f6', iconName: 'GraduationCap' },
  laboratorio: { label: 'Laboratorios', short: 'Lab', color: '#8b5cf6', iconName: 'Laptop' },
  mesas: { label: 'Mesas / Multiuso', short: 'Mesa', color: '#10b981', iconName: 'Users' },
  auditorio: { label: 'Auditorios / Magna', short: 'Auditorio', color: '#f59e0b', iconName: 'Building' },
  otro: { label: 'Otros Espacios', short: 'Espacio', color: '#94a3b8', iconName: 'MapPin' }
};

/**
 * Normalizes and extracts room code, type, floor and display name
 */
export function parseLocationInfo(rawLoc?: string): { code: string; displayName: string; type: RoomType; floor: number } | null {
  if (!rawLoc) return null;
  const clean = rawLoc
    .replace(/UTEC[\s-]*/gi, '')
    .replace(/[\s-]*\bBA\b[\s-]*/gi, ' ')
    .replace(/^-+|-+$/g, '')
    .trim();

  if (!clean || clean.toLowerCase().includes('virtual')) return null;

  let type: RoomType = 'otro';
  let floor = 1;
  let code = clean.toUpperCase();
  let displayName = clean;

  const match = clean.match(/^([ALM])(\d{3,4})$/i);
  if (match) {
    const letter = match[1].toUpperCase();
    const num = match[2];

    if (letter === 'A') {
      type = 'aula';
      displayName = `Aula ${num}`;
    } else if (letter === 'L') {
      type = 'laboratorio';
      displayName = `Laboratorio ${num}`;
    } else if (letter === 'M') {
      type = 'mesas';
      displayName = `Mesas ${num}`;
    }

    if (num.length === 4) {
      floor = parseInt(num.substring(0, 2), 10);
    } else {
      floor = parseInt(num.substring(0, 1), 10);
    }
    code = `${letter}${num}`;
  } else if (/auditorio/i.test(clean)) {
    type = 'auditorio';
    floor = 1;
    code = 'AUDITORIO';
    displayName = 'Auditorio Principal';
  } else if (/aulamagna/i.test(clean)) {
    type = 'auditorio';
    floor = 1;
    code = 'AULAMAGNA';
    displayName = 'Aula Magna';
  }

  return { code, displayName, type, floor };
}

/**
 * Extracts and groups all classrooms and their scheduled sessions from parsed Courses array
 */
export function extractClassroomsFromCourses(courses: Course[]): ClassroomInfo[] {
  const roomMap = new Map<string, ClassroomInfo>();

  for (const course of courses) {
    for (const section of course.sections) {
      for (const session of section.sessions) {
        if (!session.location || !session.day) continue;
        const parsed = parseLocationInfo(session.location);
        if (!parsed) continue;

        if (!roomMap.has(parsed.code)) {
          roomMap.set(parsed.code, {
            id: parsed.code,
            code: parsed.code,
            rawLocation: session.location,
            displayName: parsed.displayName,
            type: parsed.type,
            floor: parsed.floor,
            sessionsByDay: {
              Lun: [],
              Mar: [],
              Mie: [],
              Jue: [],
              Vie: [],
              Sab: []
            }
          });
        }

        const room = roomMap.get(parsed.code)!;
        const targetDaySessions = room.sessionsByDay[session.day];
        if (targetDaySessions) {
          targetDaySessions.push({
            courseCode: course.code,
            courseName: course.name,
            sectionNumber: section.sectionNumber,
            sessionGroup: session.sessionGroup,
            day: session.day,
            startTime: session.startTime,
            endTime: session.endTime,
            startMinutes: session.startMinutes,
            endMinutes: session.endMinutes,
            professor: session.professor,
            email: session.email,
            vacancies: session.vacancies,
            enrolled: session.enrolled
          });
        }
      }
    }
  }

  // Sort sessions within each room/day by start time
  const rooms = Array.from(roomMap.values());
  for (const room of rooms) {
    for (const day of ALL_DAYS) {
      room.sessionsByDay[day].sort((a, b) => a.startMinutes - b.startMinutes);
    }
  }

  // Sort classrooms by floor ascending, then alphabetically by code
  rooms.sort((a, b) => {
    if (a.floor !== b.floor) return a.floor - b.floor;
    return a.code.localeCompare(b.code);
  });

  return rooms;
}

/**
 * Merges overlapping/adjacent sessions and computes free time blocks between 07:00 and 22:00
 */
export function calculateFreeBlocks(sessions: ClassroomSession[]): {
  freeBlocks: FreeBlock[];
  occupiedBlocks: OccupiedBlock[];
  totalFreeMinutes: number;
  totalOccupiedMinutes: number;
} {
  const occupiedBlocks: OccupiedBlock[] = sessions.map(s => ({
    startMinutes: s.startMinutes,
    endMinutes: s.endMinutes,
    startTime: s.startTime,
    endTime: s.endTime,
    durationMinutes: s.endMinutes - s.startMinutes,
    session: s
  }));

  // Merge occupied intervals to handle any overlap
  const intervals = sessions.map(s => ({
    start: Math.max(UNIVERSITY_START_MINUTES, s.startMinutes),
    end: Math.min(UNIVERSITY_END_MINUTES, s.endMinutes)
  })).sort((a, b) => a.start - b.start);

  const mergedOccupied: { start: number; end: number }[] = [];
  for (const item of intervals) {
    if (mergedOccupied.length === 0) {
      mergedOccupied.push({ ...item });
    } else {
      const last = mergedOccupied[mergedOccupied.length - 1];
      if (item.start <= last.end) {
        last.end = Math.max(last.end, item.end);
      } else {
        mergedOccupied.push({ ...item });
      }
    }
  }

  // Calculate inverted free intervals
  const freeBlocks: FreeBlock[] = [];
  let currentPointer = UNIVERSITY_START_MINUTES;

  for (const occ of mergedOccupied) {
    if (occ.start > currentPointer) {
      freeBlocks.push({
        startMinutes: currentPointer,
        endMinutes: occ.start,
        startTime: minutesToTime(currentPointer),
        endTime: minutesToTime(occ.start),
        durationMinutes: occ.start - currentPointer
      });
    }
    currentPointer = Math.max(currentPointer, occ.end);
  }

  if (currentPointer < UNIVERSITY_END_MINUTES) {
    freeBlocks.push({
      startMinutes: currentPointer,
      endMinutes: UNIVERSITY_END_MINUTES,
      startTime: minutesToTime(currentPointer),
      endTime: minutesToTime(UNIVERSITY_END_MINUTES),
      durationMinutes: UNIVERSITY_END_MINUTES - currentPointer
    });
  }

  const totalFreeMinutes = freeBlocks.reduce((acc, b) => acc + b.durationMinutes, 0);
  const totalUniversityMinutes = UNIVERSITY_END_MINUTES - UNIVERSITY_START_MINUTES; // 900 minutes (15 hours)
  const totalOccupiedMinutes = totalUniversityMinutes - totalFreeMinutes;

  return { freeBlocks, occupiedBlocks, totalFreeMinutes, totalOccupiedMinutes };
}

/**
 * Returns current local day in Peru (or browser) and current minutes from 00:00
 */
export function getCurrentDayAndMinutes(): { day: DayOfWeek; minutes: number; timeStr: string } {
  const now = new Date();
  const dayIndex = now.getDay(); // 0 is Sunday, 1 is Monday, ... 6 is Saturday
  const dayMap: Record<number, DayOfWeek> = {
    1: 'Lun',
    2: 'Mar',
    3: 'Mie',
    4: 'Jue',
    5: 'Vie',
    6: 'Sab'
  };
  const day = dayMap[dayIndex] || 'Lun'; // Fallback to Monday on Sunday
  const minutes = now.getHours() * 60 + now.getMinutes();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return { day, minutes, timeStr };
}

/**
 * Evaluates whether a classroom is free and calculates its real-time or custom time availability
 */
export function evaluateClassroom(
  classroom: ClassroomInfo,
  filter: ClassroomFilterState,
  nowMinutes: number
): ClassroomAvailability {
  const sessions = classroom.sessionsByDay[filter.selectedDay] || [];
  const { freeBlocks, occupiedBlocks, totalFreeMinutes, totalOccupiedMinutes } = calculateFreeBlocks(sessions);
  const totalPossibleMinutes = UNIVERSITY_END_MINUTES - UNIVERSITY_START_MINUTES;
  const occupancyPercentage = Math.round((totalOccupiedMinutes / totalPossibleMinutes) * 100);

  // Find active session right now
  const currentSession = sessions.find(s => nowMinutes >= s.startMinutes && nowMinutes < s.endMinutes);
  
  // Find next upcoming session after current time
  const nextSession = sessions.find(s => s.startMinutes > nowMinutes);

  let liveStatus: LiveStatus = 'free_now';
  let minutesUntilNextSession: number | undefined;
  let minutesUntilCurrentSessionEnds: number | undefined;

  if (nowMinutes >= UNIVERSITY_END_MINUTES || nowMinutes < UNIVERSITY_START_MINUTES) {
    liveStatus = 'closed';
  } else if (currentSession) {
    liveStatus = 'occupied_now';
    minutesUntilCurrentSessionEnds = currentSession.endMinutes - nowMinutes;
  } else {
    liveStatus = 'free_now';
    if (nextSession) {
      minutesUntilNextSession = nextSession.startMinutes - nowMinutes;
    } else {
      minutesUntilNextSession = UNIVERSITY_END_MINUTES - nowMinutes;
    }
  }

  // Check search criteria
  let isAvailableForSearch = false;

  if (filter.mode === 'live_now') {
    if (liveStatus === 'free_now') {
      const freeRemaining = minutesUntilNextSession ?? (UNIVERSITY_END_MINUTES - nowMinutes);
      isAvailableForSearch = freeRemaining >= filter.minFreeHours * 60;
    } else {
      isAvailableForSearch = false;
    }
  } else {
    // Custom time range: check if the interval [filter.startMinutes, filter.endMinutes] has ZERO overlapping sessions
    const hasOverlap = sessions.some(s => {
      return Math.max(s.startMinutes, filter.startMinutes) < Math.min(s.endMinutes, filter.endMinutes);
    });

    const requestedDuration = filter.endMinutes - filter.startMinutes;
    const meetsMinHours = requestedDuration >= filter.minFreeHours * 60;

    isAvailableForSearch = !hasOverlap && meetsMinHours;
  }

  return {
    classroom,
    isAvailableForSearch,
    liveStatus,
    currentSession,
    nextSession,
    minutesUntilNextSession,
    minutesUntilCurrentSessionEnds,
    freeBlocksToday: freeBlocks,
    occupiedBlocksToday: occupiedBlocks,
    totalFreeMinutesToday: totalFreeMinutes,
    totalOccupiedMinutesToday: totalOccupiedMinutes,
    occupancyPercentage
  };
}

/**
 * Formats duration in friendly Spanish string (e.g. "2h 15m" or "45 min")
 */
export function formatDurationHuman(minutes: number): string {
  if (minutes <= 0) return '0 min';
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;

  if (hours === 0) return `${remainingMins} min`;
  if (remainingMins === 0) return `${hours}h`;
  return `${hours}h ${remainingMins}m`;
}
