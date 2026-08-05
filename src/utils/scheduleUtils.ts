import type { Course, Section, DayOfWeek, Session, SessionType, Conflict } from '../types/schedule';

export const DAYS: DayOfWeek[] = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

export const DAY_NAMES: Record<DayOfWeek, string> = {
  Lun: 'Lunes',
  Mar: 'Martes',
  Mie: 'Miércoles',
  Jue: 'Jueves',
  Vie: 'Viernes',
  Sab: 'Sábado'
};

export const COLOR_PALETTES = [
  { bg: '#3b82f6', border: '#1d4ed8', text: '#ffffff', gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }, // Vibrant Blue
  { bg: '#10b981', border: '#047857', text: '#ffffff', gradient: 'linear-gradient(135deg, #10b981 0%, #047857 100%)' }, // Emerald
  { bg: '#8b5cf6', border: '#6d28d9', text: '#ffffff', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }, // Purple
  { bg: '#f59e0b', border: '#b45309', text: '#ffffff', gradient: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)' }, // Amber
  { bg: '#ec4899', border: '#be185d', text: '#ffffff', gradient: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)' }, // Pink
  { bg: '#06b6d4', border: '#0e7490', text: '#ffffff', gradient: 'linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)' }, // Cyan
  { bg: '#6366f1', border: '#4338ca', text: '#ffffff', gradient: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)' }, // Indigo
  { bg: '#14b8a6', border: '#0f766e', text: '#ffffff', gradient: 'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)' }, // Teal
  { bg: '#f97316', border: '#c2410c', text: '#ffffff', gradient: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)' }, // Orange
  { bg: '#a855f7', border: '#7e22ce', text: '#ffffff', gradient: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)' }, // Violet
  { bg: '#ef4444', border: '#b91c1c', text: '#ffffff', gradient: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' }, // Rose
  { bg: '#84cc16', border: '#4d7c0f', text: '#ffffff', gradient: 'linear-gradient(135deg, #84cc16 0%, #4d7c0f 100%)' }, // Lime
];

/**
 * Normalizes string removing accents, diacritics, and converting to lower case for search
 */
export function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export const PREFIX_COLORS: Record<string, string> = {
  CS: '#3b82f6', // Computer Science - Blue
  CC: '#06b6d4', // Ciencias de la Computación - Cyan
  HH: '#ec4899', // Humanidades - Pink
  GH: '#f43f5e', // Gestión y Humanidades - Rose
  MA: '#8b5cf6', // Matemáticas - Purple
  PI: '#f59e0b', // Proyectos de Ingeniería - Amber
  IN: '#10b981', // Ingeniería Industrial - Emerald
  ME: '#ef4444', // Mecatrónica/Mecánica - Red
  AM: '#84cc16', // Ambiental - Lime
  EL: '#6366f1', // Electrónica - Indigo
  SI: '#0e7490', // Sistemas - Dark Cyan
  CB: '#14b8a6', // Ciencias Básicas - Teal
  EN: '#f97316', // Energía - Orange
  IE: '#4f46e5', // Ingeniería Electrónica - Deep Indigo
  DB: '#a855f7', // Data & Business - Violet
  AD: '#d97706', // Administración - Warm Amber
  FI: '#3b82f6', // Física - Blue
  QU: '#10b981'  // Química - Green
};

export function getCoursePrefix(courseCode: string): string {
  if (!courseCode) return '';
  const match = courseCode.trim().match(/^([A-Za-z]+)/);
  return match ? match[1].toUpperCase() : courseCode.trim().toUpperCase();
}

/**
 * Returns a consistent distinct color configuration for a given course based on its code prefix (CS, CC, HH, etc.).
 */
export function getCourseColorByPrefix(courseCode: string): string {
  const prefix = getCoursePrefix(courseCode);
  if (PREFIX_COLORS[prefix]) {
    return PREFIX_COLORS[prefix];
  }
  let hash = 0;
  for (let i = 0; i < prefix.length; i++) {
    hash = prefix.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLOR_PALETTES.length;
  return COLOR_PALETTES[index].bg;
}

/**
 * Returns a distinct color configuration for each individual course code (CS1102 vs CS2101).
 */
export function getCourseColorByCode(courseCode: string): string {
  let hash = 0;
  for (let i = 0; i < courseCode.length; i++) {
    hash = courseCode.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLOR_PALETTES.length;
  return COLOR_PALETTES[index].bg;
}

export function getCourseColor(courseCode: string, mode: 'prefix' | 'course' = 'prefix'): string {
  return mode === 'course' ? getCourseColorByCode(courseCode) : getCourseColorByPrefix(courseCode);
}

export function getCourseGradient(courseCode: string): string {
  const color = getCourseColor(courseCode);
  return `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`;
}

/**
 * Strips "UTEC-BA" prefix and cleans classroom location strings.
 */
export function formatLocation(loc?: string): string {
  if (!loc) return '';
  let clean = loc.replace(/UTEC-BA\s*/gi, '').replace(/^-+|-+$/g, '').trim();
  return clean;
}

/**
 * Safely parses Spanish day strings (e.g. "Miércoles", "Sábado", "Lun", "Mié", "Sáb") into DayOfWeek enum.
 */
export function parseDayOfWeek(raw: string): DayOfWeek {
  if (!raw) return 'Lun';
  const clean = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (clean.startsWith('mar')) return 'Mar';
  if (clean.startsWith('mie')) return 'Mie';
  if (clean.startsWith('jue')) return 'Jue';
  if (clean.startsWith('vie')) return 'Vie';
  if (clean.startsWith('sab')) return 'Sab';
  if (clean.startsWith('dom')) return 'Dom' as DayOfWeek;
  return 'Lun';
}

/**
 * Parses time string like "Mar. 15:00 - 17:00" or "Lun. 08:00 - 10:00"
 */
export function parseHorarioString(horarioStr: string): { day: DayOfWeek; startTime: string; endTime: string; startMinutes: number; endMinutes: number } | null {
  if (!horarioStr) return null;
  
  const match = horarioStr.trim().match(/(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo|Lun|Mar|Mié|Mie|Jue|Vie|Sáb|Sab|Dom)\.?\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/i);
  if (!match) return null;

  const day = parseDayOfWeek(match[1]);

  const startTime = match[2].padStart(5, '0');
  const endTime = match[3].padStart(5, '0');

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  return { day, startTime, endTime, startMinutes, endMinutes };
}

export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function parseSessionType(groupStr: string): SessionType {
  const upper = groupStr.toUpperCase();
  if (upper.includes('TEORÍA') || upper.includes('TEORIA')) return 'Teoría';
  if (upper.includes('LABORATORIO') || upper.includes('LAB')) return 'Laboratorio';
  if (upper.includes('PRÁCTICA') || upper.includes('PRACTICA')) return 'Práctica';
  if (upper.includes('TALLER')) return 'Taller';
  return 'Otro';
}

/**
 * Detect conflicts between selected sections
 */
export function detectConflicts(courses: Course[], selectedSections: Record<string, string>): Conflict[] {
  const conflicts: Conflict[] = [];
  const activeSessions: { course: Course; sectionNumber: string; session: Session }[] = [];

  Object.entries(selectedSections).forEach(([courseCode, secNum]) => {
    const course = courses.find(c => c.code === courseCode);
    if (!course) return;
    const section = course.sections.find(s => s.sectionNumber === secNum);
    if (!section) return;

    section.sessions.forEach(sess => {
      activeSessions.push({ course, sectionNumber: secNum, session: sess });
    });
  });

  for (let i = 0; i < activeSessions.length; i++) {
    for (let j = i + 1; j < activeSessions.length; j++) {
      const item1 = activeSessions[i];
      const item2 = activeSessions[j];

      if (item1.course.code !== item2.course.code) {
        if (item1.session.day === item2.session.day) {
          const overlapStart = Math.max(item1.session.startMinutes, item2.session.startMinutes);
          const overlapEnd = Math.min(item1.session.endMinutes, item2.session.endMinutes);

          if (overlapStart < overlapEnd) {
            conflicts.push({
              id: `${item1.course.code}-${item1.session.id}_${item2.course.code}-${item2.session.id}`,
              course1Code: item1.course.code,
              course1Name: item1.course.name,
              section1Number: item1.sectionNumber,
              session1Group: item1.session.sessionGroup,
              course2Code: item2.course.code,
              course2Name: item2.course.name,
              section2Number: item2.sectionNumber,
              session2Group: item2.session.sessionGroup,
              day: item1.session.day,
              startTime: minutesToTime(overlapStart),
              endTime: minutesToTime(overlapEnd)
            });
          }
        }
      }
    }
  }

  return conflicts;
}

export function calculateTotalHours(courses: Course[], selectedSections: Record<string, string>): number {
  let totalMinutes = 0;
  Object.entries(selectedSections).forEach(([courseCode, secNum]) => {
    const course = courses.find(c => c.code === courseCode);
    if (!course) return;
    const section = course.sections.find(s => s.sectionNumber === secNum);
    if (!section) return;

    section.sessions.forEach(s => {
      totalMinutes += (s.endMinutes - s.startMinutes);
    });
  });
  return Math.round((totalMinutes / 60) * 10) / 10;
}

/**
 * Matches a main section number and optional subgroup label (e.g. "3", "Lab. 31") to the exact sectionNumber in a course's sections array (e.g. "3 (LABORATORIO 31)").
 */
export function matchSectionNumber(sections: Section[], mainSecNum: string, groupStr?: string): string {
  if (!sections || sections.length === 0) {
    return groupStr ? `${mainSecNum} (${groupStr})` : mainSecNum;
  }

  // 1. Exact match
  const targetLabel = groupStr ? `${mainSecNum} (${groupStr})` : mainSecNum;
  const exact = sections.find(s => s.sectionNumber === targetLabel);
  if (exact) return exact.sectionNumber;

  if (!groupStr || groupStr === '-' || groupStr === mainSecNum) {
    const mainOnly = sections.find(s => s.sectionNumber === mainSecNum || s.sectionNumber.split(' (')[0] === mainSecNum);
    if (mainOnly) return mainOnly.sectionNumber;
  }

  // 2. Fuzzy match on subgroup digits (e.g. "31" in "Lab. 31" matching "3 (LABORATORIO 31)")
  const cleanGroup = groupStr ? groupStr.replace(/^(?:Lab\.|Prac\.|Tall\.)\s*/i, '').trim() : '';
  const groupNumMatch = cleanGroup.match(/\d+/);
  const groupNum = groupNumMatch ? groupNumMatch[0] : cleanGroup;

  if (groupNum) {
    const fuzzy = sections.find(s => {
      const sMain = s.sectionNumber.split(' (')[0];
      if (sMain !== mainSecNum) return false;
      const sParen = s.sectionNumber.match(/\((.*?)\)/);
      if (!sParen) return false;
      const parenContent = sParen[1].toUpperCase();
      return parenContent.includes(groupNum) || (groupStr && parenContent.includes(groupStr.toUpperCase()));
    });
    if (fuzzy) return fuzzy.sectionNumber;
  }

  // 3. Fallback to main section number match
  const fallback = sections.find(s => s.sectionNumber.split(' (')[0] === mainSecNum);
  return fallback ? fallback.sectionNumber : targetLabel;
}
