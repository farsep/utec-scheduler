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

export const CONTRAST_COURSE_COLORS = [
  '#2563eb', // 0: Vivid Royal Blue
  '#dc2626', // 1: Crimson Red
  '#059669', // 2: Emerald Green
  '#d97706', // 3: Golden Amber
  '#7c3aed', // 4: Rich Purple
  '#ea580c', // 5: Vibrant Tangerine
  '#0891b2', // 6: Deep Cyan / Ocean
  '#db2777', // 7: Hot Pink
  '#65a30d', // 8: Vivid Lime
  '#4f46e5', // 9: Electric Indigo
  '#c026d3', // 10: Bright Magenta
  '#0d9488', // 11: Dark Teal
  '#b45309', // 12: Warm Bronze
  '#9333ea', // 13: Violet Orchid
  '#e11d48', // 14: Deep Rose
  '#0284c7', // 15: Sky Blue
  '#16a34a', // 16: Spring Green
  '#ca8a04', // 17: Rich Ochre
  '#475569', // 18: Slate Steel
  '#be123c', // 19: Ruby Wine
];

export const COLOR_PALETTES = CONTRAST_COURSE_COLORS.map(color => ({
  bg: color,
  border: `${color}cc`,
  text: '#ffffff',
  gradient: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`
}));

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
  CS: '#2563eb', // Computer Science - Electric Blue
  CC: '#0284c7', // Ciencias de la Computación - Vivid Cyan
  MA: '#7c3aed', // Matemáticas - Rich Purple
  HH: '#db2777', // Humanidades - Hot Pink
  GH: '#e11d48', // Gestión y Humanidades - Deep Rose
  PI: '#d97706', // Proyectos de Ingeniería - Golden Amber
  IN: '#059669', // Ingeniería Industrial - Emerald Green
  ME: '#dc2626', // Mecatrónica / Mecánica - Crimson Red
  AM: '#65a30d', // Ambiental - Vivid Lime
  EL: '#4f46e5', // Electrónica - Electric Indigo
  SI: '#0d9488', // Sistemas - Dark Teal
  CB: '#0891b2', // Ciencias Básicas - Ocean Cyan
  EN: '#ea580c', // Energía - Tangerine Orange
  IE: '#1e40af', // Ing. Electrónica e Informática - Deep Navy Blue
  DB: '#9333ea', // Data & Business - Violet Orchid
  AD: '#b45309', // Administración - Warm Bronze
  FI: '#06b6d4', // Física - Bright Cyan
  QU: '#16a34a', // Química - Spring Jade Green
  BIO: '#c026d3', // Bioingeniería - Bright Magenta
  BI: '#c026d3', // Bioingeniería
  CIV: '#c2410c', // Ingeniería Civil - Terracotta
  CI: '#c2410c', // Civil
  MIN: '#475569', // Minería - Slate
  MI: '#475569', // Minería
  ID: '#be123c', // Idiomas / Inglés - Ruby
  PR: '#ca8a04', // Prácticas Preprofesionales - Ochre
};

export function getCoursePrefix(courseCode: string): string {
  if (!courseCode) return '';
  const match = courseCode.trim().match(/^([A-Za-z]+)/);
  return match ? match[1].toUpperCase() : courseCode.trim().toUpperCase();
}

/**
 * Returns a consistent distinct color configuration for a given course based on its code prefix (CS, CC, HH, etc.).
 * Guarantees contrasting colors between distinct prefix groups.
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
  const index = Math.abs(hash) % CONTRAST_COURSE_COLORS.length;
  return CONTRAST_COURSE_COLORS[index];
}

/**
 * Returns a distinct high-contrast color for an individual course code.
 */
export function getCourseColorByCode(courseCode: string): string {
  let hash = 0;
  for (let i = 0; i < courseCode.length; i++) {
    hash = courseCode.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % CONTRAST_COURSE_COLORS.length;
  return CONTRAST_COURSE_COLORS[index];
}

/**
 * Returns course color either grouped by prefix or individually per course with high contrast.
 * When courseIndex is provided in 'course' mode, it maps to zero-collision contrasting hues.
 */
export function getCourseColor(
  courseCode: string,
  mode: 'prefix' | 'course' = 'prefix',
  courseIndex?: number
): string {
  if (mode === 'course') {
    if (typeof courseIndex === 'number' && courseIndex >= 0) {
      return CONTRAST_COURSE_COLORS[courseIndex % CONTRAST_COURSE_COLORS.length];
    }
    return getCourseColorByCode(courseCode);
  }
  return getCourseColorByPrefix(courseCode);
}

export function getCourseGradient(courseCode: string, mode: 'prefix' | 'course' = 'prefix', courseIndex?: number): string {
  const color = getCourseColor(courseCode, mode, courseIndex);
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
