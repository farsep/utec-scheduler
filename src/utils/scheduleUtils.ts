import type { Course, DayOfWeek, Session, SessionType, Conflict } from '../types/schedule';

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

/**
 * Returns a consistent distinct color configuration for a given string (e.g. course code).
 */
export function getCourseColor(courseCode: string): string {
  let hash = 0;
  for (let i = 0; i < courseCode.length; i++) {
    hash = courseCode.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLOR_PALETTES.length;
  return COLOR_PALETTES[index].bg;
}

export function getCourseGradient(courseCode: string): string {
  let hash = 0;
  for (let i = 0; i < courseCode.length; i++) {
    hash = courseCode.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLOR_PALETTES.length;
  return COLOR_PALETTES[index].gradient;
}

/**
 * Parses time string like "Mar. 15:00 - 17:00" or "Lun. 08:00 - 10:00"
 */
export function parseHorarioString(horarioStr: string): { day: DayOfWeek; startTime: string; endTime: string; startMinutes: number; endMinutes: number } | null {
  if (!horarioStr) return null;
  
  const match = horarioStr.trim().match(/(Lun|Mar|Mie|Jue|Vie|Sab|Dom)\.?\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/i);
  if (!match) return null;

  let rawDay = match[1].substring(0, 3);
  rawDay = rawDay.charAt(0).toUpperCase() + rawDay.slice(1).toLowerCase();
  
  let day: DayOfWeek = 'Lun';
  if (rawDay.startsWith('Mar')) day = 'Mar';
  else if (rawDay.startsWith('Mie')) day = 'Mie';
  else if (rawDay.startsWith('Jue')) day = 'Jue';
  else if (rawDay.startsWith('Vie')) day = 'Vie';
  else if (rawDay.startsWith('Sab')) day = 'Sab';
  else day = 'Lun';

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

export function calculateTotalCredits(courses: Course[], selectedSections: Record<string, string>): number {
  let totalCredits = 0;
  Object.keys(selectedSections).forEach(courseCode => {
    const course = courses.find(c => c.code === courseCode);
    if (course) {
      totalCredits += (course.credits || 3);
    }
  });
  return totalCredits;
}
