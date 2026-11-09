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

export interface CanonicalRoomResult {
  code: string;
  displayName: string;
  type: RoomType;
  floor: number;
}

export const CANONICAL_ROOMS_DATA: CanonicalRoomResult[] = [
  { code: 'A1001', displayName: 'Aula 1001', type: 'aula', floor: 10 },
  { code: 'A1002', displayName: 'Aula 1002', type: 'aula', floor: 10 },
  { code: 'A1003', displayName: 'Aula 1003', type: 'aula', floor: 10 },
  { code: 'A201', displayName: 'Aula 201', type: 'aula', floor: 2 },
  { code: 'A202', displayName: 'Aula 202', type: 'aula', floor: 2 },
  { code: 'A301', displayName: 'Aula 301', type: 'aula', floor: 3 },
  { code: 'A302', displayName: 'Aula 302', type: 'aula', floor: 3 },
  { code: 'A303', displayName: 'Aula 303', type: 'aula', floor: 3 },
  { code: 'A304', displayName: 'Aula 304', type: 'aula', floor: 3 },
  { code: 'A401', displayName: 'Aula 401', type: 'aula', floor: 4 },
  { code: 'A402', displayName: 'Aula 402', type: 'aula', floor: 4 },
  { code: 'A403', displayName: 'Aula 403', type: 'aula', floor: 4 },
  { code: 'A404', displayName: 'Aula 404', type: 'aula', floor: 4 },
  { code: 'A501', displayName: 'Aula 501', type: 'aula', floor: 5 },
  { code: 'A502', displayName: 'Aula 502', type: 'aula', floor: 5 },
  { code: 'A601', displayName: 'Aula 601', type: 'aula', floor: 6 },
  { code: 'A602', displayName: 'Aula 602', type: 'aula', floor: 6 },
  { code: 'A701', displayName: 'Aula 701', type: 'aula', floor: 7 },
  { code: 'A702', displayName: 'Aula 702', type: 'aula', floor: 7 },
  { code: 'A703', displayName: 'Aula 703', type: 'aula', floor: 7 },
  { code: 'A704', displayName: 'Aula 704', type: 'aula', floor: 7 },
  { code: 'A705', displayName: 'Aula 705', type: 'aula', floor: 7 },
  { code: 'A706', displayName: 'Aula 706', type: 'aula', floor: 7 },
  { code: 'A707', displayName: 'Aula 707', type: 'aula', floor: 7 },
  { code: 'A708', displayName: 'Aula 708', type: 'aula', floor: 7 },
  { code: 'A801', displayName: 'Aula 801', type: 'aula', floor: 8 },
  { code: 'A802', displayName: 'Aula 802', type: 'aula', floor: 8 },
  { code: 'A803', displayName: 'Aula 803', type: 'aula', floor: 8 },
  { code: 'A804', displayName: 'Aula 804', type: 'aula', floor: 8 },
  { code: 'A901', displayName: 'Aula 901', type: 'aula', floor: 9 },
  { code: 'A902', displayName: 'Aula 902', type: 'aula', floor: 9 },
  { code: 'A903', displayName: 'Aula 903', type: 'aula', floor: 9 },
  { code: 'A904', displayName: 'Aula 904', type: 'aula', floor: 9 },
  { code: 'A905', displayName: 'Aula 905', type: 'aula', floor: 9 },
  { code: 'A906', displayName: 'Aula 906', type: 'aula', floor: 9 },
  { code: 'A907', displayName: 'Aula 907', type: 'aula', floor: 9 },
  { code: 'A908', displayName: 'Aula 908', type: 'aula', floor: 9 },
  { code: 'AUDITORIO', displayName: 'Auditorio Principal', type: 'auditorio', floor: 1 },
  { code: 'AULAMAGNA', displayName: 'Aula Magna', type: 'auditorio', floor: 1 },
  { code: 'FUTSAL', displayName: 'Futsal', type: 'otro', floor: 1 },
  { code: 'L021', displayName: 'Laboratorio 021', type: 'laboratorio', floor: 1 },
  { code: 'L022', displayName: 'Laboratorio 022', type: 'laboratorio', floor: 1 },
  { code: 'L101', displayName: 'Laboratorio 101', type: 'laboratorio', floor: 1 },
  { code: 'L102', displayName: 'Laboratorio 102', type: 'laboratorio', floor: 1 },
  { code: 'L104', displayName: 'Laboratorio 104', type: 'laboratorio', floor: 1 },
  { code: 'L105', displayName: 'Laboratorio 105', type: 'laboratorio', floor: 1 },
  { code: 'L106', displayName: 'Laboratorio 106', type: 'laboratorio', floor: 1 },
  { code: 'L107', displayName: 'Laboratorio 107', type: 'laboratorio', floor: 1 },
  { code: 'L108', displayName: 'Laboratorio 108', type: 'laboratorio', floor: 1 },
  { code: 'L201', displayName: 'Laboratorio 201', type: 'laboratorio', floor: 2 },
  { code: 'L202', displayName: 'Laboratorio 202', type: 'laboratorio', floor: 2 },
  { code: 'L204', displayName: 'Laboratorio 204', type: 'laboratorio', floor: 2 },
  { code: 'L205', displayName: 'Laboratorio 205', type: 'laboratorio', floor: 2 },
  { code: 'L206', displayName: 'Laboratorio 206', type: 'laboratorio', floor: 2 },
  { code: 'L207', displayName: 'Laboratorio 207', type: 'laboratorio', floor: 2 },
  { code: 'L208', displayName: 'Laboratorio 208', type: 'laboratorio', floor: 2 },
  { code: 'L209', displayName: 'Laboratorio 209', type: 'laboratorio', floor: 2 },
  { code: 'L210', displayName: 'Laboratorio 210', type: 'laboratorio', floor: 2 },
  { code: 'L211', displayName: 'Laboratorio 211', type: 'laboratorio', floor: 2 },
  { code: 'L212', displayName: 'Laboratorio 212', type: 'laboratorio', floor: 2 },
  { code: 'L402', displayName: 'Laboratorio 402', type: 'laboratorio', floor: 4 },
  { code: 'L403', displayName: 'Laboratorio 403', type: 'laboratorio', floor: 4 },
  { code: 'L404', displayName: 'Laboratorio 404', type: 'laboratorio', floor: 4 },
  { code: 'L405', displayName: 'Laboratorio 405', type: 'laboratorio', floor: 4 },
  { code: 'L406', displayName: 'Laboratorio 406', type: 'laboratorio', floor: 4 },
  { code: 'L407', displayName: 'Laboratorio 407', type: 'laboratorio', floor: 4 },
  { code: 'L408', displayName: 'Laboratorio 408', type: 'laboratorio', floor: 4 },
  { code: 'L409', displayName: 'Laboratorio 409', type: 'laboratorio', floor: 4 },
  { code: 'L410', displayName: 'Laboratorio 410', type: 'laboratorio', floor: 4 },
  { code: 'L412', displayName: 'Laboratorio 412', type: 'laboratorio', floor: 4 },
  { code: 'L413', displayName: 'Laboratorio 413', type: 'laboratorio', floor: 4 },
  { code: 'L414', displayName: 'Laboratorio 414', type: 'laboratorio', floor: 4 },
  { code: 'L415', displayName: 'Laboratorio 415', type: 'laboratorio', floor: 4 },
  { code: 'L416', displayName: 'Laboratorio 416', type: 'laboratorio', floor: 4 },
  { code: 'L417', displayName: 'Laboratorio 417', type: 'laboratorio', floor: 4 },
  { code: 'L418', displayName: 'Laboratorio 418', type: 'laboratorio', floor: 4 },
  { code: 'L419', displayName: 'Laboratorio 419', type: 'laboratorio', floor: 4 },
  { code: 'L420', displayName: 'Laboratorio 420', type: 'laboratorio', floor: 4 },
  { code: 'L501', displayName: 'Laboratorio 501', type: 'laboratorio', floor: 5 },
  { code: 'L502', displayName: 'Laboratorio 502', type: 'laboratorio', floor: 5 },
  { code: 'L503', displayName: 'Laboratorio 503', type: 'laboratorio', floor: 5 },
  { code: 'L504', displayName: 'Laboratorio 504', type: 'laboratorio', floor: 5 },
  { code: 'L505', displayName: 'Laboratorio 505', type: 'laboratorio', floor: 5 },
  { code: 'L506', displayName: 'Laboratorio 506', type: 'laboratorio', floor: 5 },
  { code: 'L507', displayName: 'Laboratorio 507', type: 'laboratorio', floor: 5 },
  { code: 'L508', displayName: 'Laboratorio 508', type: 'laboratorio', floor: 5 },
  { code: 'L601', displayName: 'Laboratorio 601', type: 'laboratorio', floor: 6 },
  { code: 'M1001', displayName: 'Mesas 1001', type: 'mesas', floor: 10 },
  { code: 'M301', displayName: 'Mesas 301', type: 'mesas', floor: 3 },
  { code: 'M401', displayName: 'Mesas 401', type: 'mesas', floor: 4 },
  { code: 'M601', displayName: 'Mesas 601', type: 'mesas', floor: 6 },
  { code: 'M602', displayName: 'Mesas 602', type: 'mesas', floor: 6 },
  { code: 'M603', displayName: 'Mesas 603', type: 'mesas', floor: 6 },
  { code: 'M604', displayName: 'Mesas 604', type: 'mesas', floor: 6 },
  { code: 'M801', displayName: 'Mesas 801', type: 'mesas', floor: 8 },
  { code: 'M802', displayName: 'Mesas 802', type: 'mesas', floor: 8 },
  { code: 'M803', displayName: 'Mesas 803', type: 'mesas', floor: 8 },
  { code: 'M804', displayName: 'Mesas 804', type: 'mesas', floor: 8 },
  { code: 'S111', displayName: 'S111', type: 'otro', floor: 1 },
];

const CANONICAL_ROOMS_MAP = new Map<string, CanonicalRoomResult>();
CANONICAL_ROOMS_DATA.forEach(r => {
  CANONICAL_ROOMS_MAP.set(r.code.toUpperCase(), r);
  CANONICAL_ROOMS_MAP.set(r.displayName.replace(/\s+/g, '').toUpperCase(), r);
  CANONICAL_ROOMS_MAP.set(r.displayName.toUpperCase(), r);
});

/**
 * Strict canonical room resolver that guarantees zero string mutation.
 * Normalizes M301, Mesas 301, A201, L106 to their authoritative UTEC metadata.
 */
export function resolveCanonicalRoom(
  input?: string | { code?: string; codigo?: string; name?: string; displayName?: string } | null
): CanonicalRoomResult {
  if (!input) {
    return { code: 'UTEC', displayName: 'Campus UTEC', type: 'otro', floor: 1 };
  }

  let raw = '';
  if (typeof input === 'object') {
    raw = input.codigo || input.code || input.displayName || input.name || '';
  } else {
    raw = String(input);
  }

  raw = raw.trim();
  if (!raw) {
    return { code: 'UTEC', displayName: 'Campus UTEC', type: 'otro', floor: 1 };
  }

  // Strip accidental 'A' prefixed before 'M' (Mesas) or 'L' (Laboratorio), e.g. AM301 -> M301
  if (/^A(M\d{3,4}|L\d{3,4})$/i.test(raw)) {
    raw = raw.substring(1);
  }

  const cleanNoSpaces = raw.replace(/\s+/g, '').toUpperCase();
  if (CANONICAL_ROOMS_MAP.has(cleanNoSpaces)) {
    return CANONICAL_ROOMS_MAP.get(cleanNoSpaces)!;
  }
  if (CANONICAL_ROOMS_MAP.has(raw.toUpperCase())) {
    return CANONICAL_ROOMS_MAP.get(raw.toUpperCase())!;
  }

  // Dynamic fallback via parseLocationInfo
  const parsed = parseLocationInfo(raw);
  if (parsed) {
    const parsedKey = parsed.code.toUpperCase();
    if (CANONICAL_ROOMS_MAP.has(parsedKey)) {
      return CANONICAL_ROOMS_MAP.get(parsedKey)!;
    }
    return parsed;
  }

  return {
    code: raw.toUpperCase(),
    displayName: raw,
    type: 'otro',
    floor: 1
  };
}

/**
 * Normalizes and extracts room code, type, floor and display name
 */
export function parseLocationInfo(rawLoc?: string): { code: string; displayName: string; type: RoomType; floor: number } | null {
  if (!rawLoc) return null;
  let clean = rawLoc
    .replace(/UTEC[\s-]*/gi, '')
    .replace(/[\s-]*\bBA\b[\s-]*/gi, ' ')
    .replace(/^-+|-+$/g, '')
    .trim();

  // Strip accidental 'A' prefixed before 'M' (Mesas) or 'L' (Laboratorio), e.g. AM301 -> M301
  clean = clean.replace(/^A(?=[ML]\d{3,4})/i, '');

  if (!clean || clean.toLowerCase().includes('virtual')) return null;

  // Specific auditorium / common spaces checks
  if (/auditorio/i.test(clean)) {
    return { code: 'AUDITORIO', displayName: 'Auditorio Principal', type: 'auditorio', floor: 1 };
  }
  if (/aula\s*magna/i.test(clean) || /aulamagna/i.test(clean)) {
    return { code: 'AULAMAGNA', displayName: 'Aula Magna', type: 'auditorio', floor: 1 };
  }
  if (/futsal/i.test(clean)) {
    return { code: 'FUTSAL', displayName: 'Futsal', type: 'otro', floor: 1 };
  }
  if (/^S\s*111$/i.test(clean)) {
    return { code: 'S111', displayName: 'S111', type: 'otro', floor: 1 };
  }

  // Matches compact codes or full names:
  // - "A1003", "A 1003", "AULA 1003", "Aula 1003"
  // - "L414", "L 414", "LAB 414", "LABORATORIO 414", "Laboratorio 414"
  // - "M603", "M 603", "MESAS 603", "MESA 603", "Mesas 1001"
  const match = clean.match(/^(?:(AULA|A)|(LAB(?:ORATORIO)?|L)|(MESAS?|M))\s*(\d{3,4})$/i);
  if (match) {
    const isAula = Boolean(match[1]);
    const isLab = Boolean(match[2]);
    const isMesas = Boolean(match[3]);
    const num = match[4];

    let type: RoomType = 'otro';
    let displayName = '';
    let letter = 'A';

    if (isAula) {
      type = 'aula';
      displayName = `Aula ${num}`;
      letter = 'A';
    } else if (isLab) {
      type = 'laboratorio';
      displayName = `Laboratorio ${num}`;
      letter = 'L';
    } else if (isMesas) {
      type = 'mesas';
      displayName = `Mesas ${num}`;
      letter = 'M';
    }

    let floor = 1;
    if (num.length === 4) {
      floor = parseInt(num.substring(0, 2), 10);
    } else {
      const f = parseInt(num.substring(0, 1), 10);
      floor = f === 0 ? 1 : f;
    }

    const code = `${letter}${num}`;
    return { code, displayName, type, floor };
  }

  // Fallback: If it's a 3-4 digit number like "1003" or "202"
  const numOnlyMatch = clean.match(/^(\d{3,4})$/);
  if (numOnlyMatch) {
    const num = numOnlyMatch[1];
    let floor = 1;
    if (num.length === 4) {
      floor = parseInt(num.substring(0, 2), 10);
    } else {
      const f = parseInt(num.substring(0, 1), 10);
      floor = f === 0 ? 1 : f;
    }
    return { code: `A${num}`, displayName: `Aula ${num}`, type: 'aula', floor };
  }

  return { code: clean.toUpperCase(), displayName: clean, type: 'otro', floor: 1 };
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
