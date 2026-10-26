import * as XLSX from 'xlsx';
import * as fs from 'fs';
import path from 'path';
import type { DayOfWeek } from '../src/types/schedule';
import type { MentorInfo, MentorSession, MentorReservation } from '../src/types/mentor';

const filePath = path.resolve('CoursesLists/HORARIOS MENTORES ACADÉMICOS 2026-2.xlsx');
const buf = fs.readFileSync(filePath);
const workbook = XLSX.read(buf, { type: 'buffer' });

const s1 = workbook.Sheets['DISPONIBILIDAD HORARIA'];
const rows1 = XLSX.utils.sheet_to_json(s1, { range: 3 }) as any[];

const s2 = workbook.Sheets['AULAS MENTORÍAS PRESENCIALES'];
const rows2 = XLSX.utils.sheet_to_json(s2, { range: 1 }) as any[];

function normalize(s: string) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function getInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'M';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const COURSE_CODE_MAP: Record<string, { code: string; cleanName: string }> = {
  'analisis de senales y sistemas para bioingenieria': { code: 'EL3016', cleanName: 'Análisis de Señales y Sistemas para Bioingeniería' },
  'analisis estructural': { code: 'CI3014', cleanName: 'Análisis Estructural' },
  'calculo de una variable': { code: 'CC1101', cleanName: 'Cálculo de una Variable' },
  'circuitos electricos y electronicos 1': { code: 'EL2011', cleanName: 'Circuitos Eléctricos y Electrónicos 1' },
  'circuitos electricos y electronicos i': { code: 'EL2011', cleanName: 'Circuitos Eléctricos y Electrónicos 1' },
  'cloud computing': { code: 'CS2032', cleanName: 'Cloud Computing' },
  'control automatico': { code: 'EL3012', cleanName: 'Control Automático' },
  'desarrollo basado en plataformas': { code: 'CS2031', cleanName: 'Desarrollo Basado en Plataformas' },
  'estadistica aplicada': { code: 'IN2005', cleanName: 'Estadística Aplicada' },
  'fundamentos de robotica': { code: 'MT4001', cleanName: 'Fundamentos de Robótica' },
  'control de sistemas no lineales': { code: 'EL5312', cleanName: 'Control de Sistemas No Lineales' },
  'fundamentos del calculo': { code: 'CC6101', cleanName: 'Fundamentos del Cálculo' },
  'ingenieria de mantenimiento': { code: 'ME3017', cleanName: 'Ingeniería de Mantenimiento' },
  'introduccion a ciencia de datos': { code: 'DS6001', cleanName: 'Introducción a Ciencia de Datos' },
  'quimica avanzada': { code: 'IQ6002', cleanName: 'Química Avanzada' },
  'quimica general': { code: 'CC1141', cleanName: 'Química General' },
  'introduccion a la mecanica': { code: 'CC6201', cleanName: 'Introducción a la Mecánica' },
  'sensores y actuadores': { code: 'MT3001', cleanName: 'Sensores y Actuadores' },
  'teoria de la computacion': { code: 'CS2024', cleanName: 'Teoría de la Computación' },
  'termodinamica': { code: 'CC2121', cleanName: 'Termodinámica' },
  'programacion i': { code: 'CS6002', cleanName: 'Programación I' },
  'programacion 1': { code: 'CS6002', cleanName: 'Programación I' },
  'programacion ii': { code: 'CS6003', cleanName: 'Programación II' },
  'programacion 2': { code: 'CS6003', cleanName: 'Programación II' },
  'investigacion de operaciones ii: modelos probabilisticos': { code: 'IN3011', cleanName: 'Investigación de Operaciones II: Modelos Probabilísticos' },
  'redes industriales': { code: 'EL4301', cleanName: 'Redes Industriales' },
  'circuitos digitales': { code: 'EL2013', cleanName: 'Circuitos Digitales' },
  'computacion grafica': { code: 'CS4016', cleanName: 'Computación Gráfica' }
};

const PREFIX_COLORS: Record<string, string> = {
  CS: '#2563eb', // Computer Science
  CC: '#0284c7', // Ciencias Básicas
  EL: '#ea580c', // Electrónica
  ME: '#059669', // Mecánica
  IQ: '#dc2626', // Química
  IN: '#d97706', // Industrial
  DS: '#0891b2', // Data Science
  CI: '#4f46e5', // Civil
  MT: '#c026d3'  // Mecatrónica
};

const DEPARTMENT_NAMES: Record<string, string> = {
  CS: 'Ciencia de la Computación',
  CC: 'Ciencias Básicas y Matemáticas',
  EL: 'Ingeniería Electrónica',
  CI: 'Ingeniería Civil',
  IN: 'Ingeniería Industrial',
  ME: 'Ingeniería Mecánica',
  MT: 'Ingeniería Mecatrónica',
  DS: 'Ciencia de Datos',
  IQ: 'Ingeniería Química'
};

const DAY_MAP: Record<string, DayOfWeek> = {
  lunes: 'Lun',
  martes: 'Mar',
  miercoles: 'Mie',
  miércoles: 'Mie',
  jueves: 'Jue',
  viernes: 'Vie',
  sabado: 'Sab',
  sábado: 'Sab'
};

const DAY_NAMES: Record<DayOfWeek, string> = {
  Lun: 'Lunes',
  Mar: 'Martes',
  Mie: 'Miércoles',
  Jue: 'Jueves',
  Vie: 'Viernes',
  Sab: 'Sábado'
};

export function parseTimeRange(timeStr: any, fallbackStr?: string): { startTime: string; endTime: string; startMinutes: number; endMinutes: number } | null {
  if (typeof timeStr === 'number' || !timeStr || String(timeStr).trim().length === 0) {
    if (fallbackStr) return parseTimeRange(fallbackStr);
    return null;
  }
  let s = String(timeStr).toLowerCase().replace(/\s+/g, ' ').trim();
  s = s.replace(/a\.m\./g, 'am').replace(/p\.m\./g, 'pm');
  s = s.replace(/\ba\b/g, '-').replace(/\bal\b/g, '-');
  
  const match = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!match) {
    if (fallbackStr && fallbackStr !== timeStr) return parseTimeRange(fallbackStr);
    return null;
  }
  
  let h1 = parseInt(match[1], 10);
  let m1 = match[2] ? parseInt(match[2], 10) : 0;
  let ampm1 = match[3];
  let h2 = parseInt(match[4], 10);
  let m2 = match[5] ? parseInt(match[5], 10) : 0;
  let ampm2 = match[6];
  
  if (h2 >= 13) {
    // 24h format
  } else {
    if (!ampm2) ampm2 = 'pm';
    if (!ampm1) {
      if (ampm2 === 'pm') {
        if (h1 >= 8 && h1 <= 11 && h2 <= 2) {
          ampm1 = 'am';
        } else {
          ampm1 = 'pm';
        }
      } else {
        ampm1 = ampm2;
      }
    }
    if (ampm1 === 'pm' && h1 < 12) h1 += 12;
    if (ampm1 === 'am' && h1 === 12) h1 = 0;
    if (ampm2 === 'pm' && h2 < 12) h2 += 12;
    if (ampm2 === 'am' && h2 === 12) h2 = 0;
  }
  
  if (h1 === 10 && h2 === 0) h2 = 12; // 10 am a 12 am typo
  
  const startMin = h1 * 60 + m1;
  const endMin = h2 * 60 + m2;
  const fmt = (h: number, m: number) => String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  
  return {
    startTime: fmt(h1, m1),
    endTime: fmt(h2, m2),
    startMinutes: startMin,
    endMinutes: endMin
  };
}

// Process Sheet 2 presencial reservations
interface PresencialDetail {
  day: string;
  time: string;
  reservations: MentorReservation[];
  uniqueRooms: string[];
  primaryRoom: string;
}

const presencialMap = new Map<string, PresencialDetail>();
rows2.forEach((r: any) => {
  const name = r['NOMBRE'];
  if (!name) return;
  const course = r['CURSO'];
  const day = r['DÍA'];
  const time = r['HORARIO'];

  const keys = Object.keys(r);
  const roomKeys = keys.filter(k => k.toLowerCase().includes('aula'));
  const dateKeys = keys.filter(k => k.toLowerCase().includes('fecha'));

  const reservations: MentorReservation[] = [];
  dateKeys.forEach((dk, i) => {
    const rk = roomKeys[i];
    const rawDate = r[dk];
    const room = r[rk];
    if (room && rawDate) {
      let dateStr = '';
      if (typeof rawDate === 'number') {
        const utcDays = Math.floor(rawDate - 25569);
        const dateInfo = new Date(utcDays * 86400 * 1000);
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];
        dateStr = `${dateInfo.getUTCDate()} ${months[dateInfo.getUTCMonth()]}`;
      } else {
        dateStr = String(rawDate);
      }
      reservations.push({
        week: i + 1,
        dateStr,
        room: String(room).trim()
      });
    }
  });

  const physicalRooms = reservations.map(res => res.room).filter(rm => rm && rm.toUpperCase() !== 'VIRTUAL');
  const uniqueRooms = Array.from(new Set(physicalRooms));
  const primaryRoom = uniqueRooms[0] || (reservations[0]?.room) || 'Aula UTEC';

  // Map by normalized name and course code
  const normCourse = normalize(course);
  const courseMeta = COURSE_CODE_MAP[normCourse] || { code: 'UTEC', cleanName: course };
  const keyWithCode = `${normalize(name)}_${courseMeta.code}`;
  const keyWithName = normalize(name);

  const detail: PresencialDetail = {
    day,
    time,
    reservations,
    uniqueRooms,
    primaryRoom
  };

  presencialMap.set(keyWithCode, detail);
  // Also store by name if not already set or Daniel Rodriguez
  if (!presencialMap.has(keyWithName)) {
    presencialMap.set(keyWithName, detail);
  }
});

const allSessions: MentorSession[] = [];
const mentorsMap = new Map<string, MentorInfo>();

rows1.forEach((r) => {
  const rawName = r['NOMBRE Y APELLIDOS'];
  const rawEmail = r['CORREO'];
  const rawCourse = r['CURSO'];
  const rawDay = r['DIA'];
  const rawTime = r['HORA'];
  const rawModality = r['MODALIDAD'];

  if (!rawName || !rawCourse) return;

  const name = String(rawName).trim();
  const email = String(rawEmail || '').trim().toLowerCase();
  const modality: 'Presencial' | 'Virtual' = String(rawModality || '').toLowerCase().includes('presencial') ? 'Presencial' : 'Virtual';

  const mentorId = normalize(name).replace(/\s+/g, '_');

  const courseParts = String(rawCourse).includes('|') ? String(rawCourse).split('|').map(s => s.trim()) : [String(rawCourse).trim()];
  const dayParts = String(rawDay).includes(',') ? String(rawDay).split(',').map(s => s.trim()) : [String(rawDay).trim()];
  const timeParts = String(rawTime).includes('|') ? String(rawTime).split('|').map(s => s.trim()) : [String(rawTime).trim()];

  courseParts.forEach((cp, subIdx) => {
    const normCourse = normalize(cp);
    const courseMeta = COURSE_CODE_MAP[normCourse] || { code: 'UTEC', cleanName: cp };
    const dp = dayParts[subIdx] || dayParts[0] || '';
    const normDay = normalize(dp);
    const day = DAY_MAP[normDay] || 'Lun';

    let tp = timeParts[subIdx] || timeParts[0] || '';

    // Check presencial map
    const pKeyWithCode = `${normalize(name)}_${courseMeta.code}`;
    let presMatch = presencialMap.get(pKeyWithCode) || presencialMap.get(normalize(name));

    let timeParsed = parseTimeRange(tp, presMatch?.time);
    if (!timeParsed) {
      console.warn(`Fallback time for ${name} - ${cp}`);
      timeParsed = { startTime: '15:00', endTime: '17:00', startMinutes: 900, endMinutes: 1020 };
    }

    let classroom = 'Virtual (Google Meet / Zoom)';
    let allRooms: string[] = [];
    let reservations: MentorReservation[] = [];

    if (modality === 'Presencial') {
      if (presMatch) {
        classroom = presMatch.primaryRoom;
        allRooms = presMatch.uniqueRooms;
        reservations = presMatch.reservations;
      } else {
        classroom = 'Campus UTEC';
        allRooms = ['Campus UTEC'];
      }
    }

    const deptCode = courseMeta.code.slice(0, 2).toUpperCase();
    const deptName = DEPARTMENT_NAMES[deptCode] || 'Ingeniería';
    const courseColor = PREFIX_COLORS[deptCode] || '#2563eb';
    const sessionId = `${mentorId}_${courseMeta.code.toLowerCase()}_${day.toLowerCase()}_${timeParsed.startTime.replace(':', '')}`;

    const session: MentorSession = {
      id: sessionId,
      mentorId,
      mentorName: name,
      mentorEmail: email,
      courseCode: courseMeta.code,
      courseName: courseMeta.cleanName,
      courseColor,
      departmentCode: deptCode,
      departmentName: deptName,
      day,
      dayName: DAY_NAMES[day],
      startTime: timeParsed.startTime,
      endTime: timeParsed.endTime,
      startMinutes: timeParsed.startMinutes,
      endMinutes: timeParsed.endMinutes,
      timeDisplay: `${timeParsed.startTime} - ${timeParsed.endTime}`,
      durationHours: Math.round(((timeParsed.endMinutes - timeParsed.startMinutes) / 60) * 10) / 10,
      modality,
      primaryRoom: classroom,
      allRooms,
      reservations
    };

    allSessions.push(session);

    // Group into MentorInfo
    if (!mentorsMap.has(mentorId)) {
      mentorsMap.set(mentorId, {
        id: mentorId,
        name,
        initials: getInitials(name),
        email,
        departmentCode: deptCode,
        departmentName: deptName,
        sessions: [],
        courses: [],
        daysTaught: [],
        modalities: [],
        totalSessions: 0,
        primaryCourse: courseMeta.cleanName,
        primaryRoom: classroom
      });
    }

    const mentor = mentorsMap.get(mentorId)!;
    mentor.sessions.push(session);
    mentor.totalSessions++;
    if (!mentor.courses.some(c => c.code === courseMeta.code)) {
      mentor.courses.push({
        code: courseMeta.code,
        name: courseMeta.cleanName,
        color: courseColor
      });
    }
    if (!mentor.daysTaught.includes(day)) {
      mentor.daysTaught.push(day);
    }
    if (!mentor.modalities.includes(modality)) {
      mentor.modalities.push(modality);
    }
    if (modality === 'Presencial' && classroom !== 'Campus UTEC') {
      mentor.primaryRoom = classroom;
    }
  });
});

const mentorsList = Array.from(mentorsMap.values());

// Sort mentors alphabetically by name
mentorsList.sort((a, b) => a.name.localeCompare(b.name));

console.log(`Successfully generated ${mentorsList.length} mentors and ${allSessions.length} sessions.`);

// Write mentorsData.ts
const tsContent = `// Auto-generated mentor data from HORARIOS MENTORES ACADÉMICOS 2026-2.xlsx
import type { MentorInfo, MentorSession } from '../types/mentor';

export const MENTORS_DATA: MentorInfo[] = ${JSON.stringify(mentorsList, null, 2)};

export const MENTOR_SESSIONS_DATA: MentorSession[] = ${JSON.stringify(allSessions, null, 2)};
`;

fs.writeFileSync('src/data/mentorsData.ts', tsContent, 'utf8');
console.log('Saved src/data/mentorsData.ts');

// Write public/data/mentores_academicos.json
const jsonContent = JSON.stringify({
  mentors: mentorsList,
  sessions: allSessions,
  generatedAt: new Date().toISOString()
}, null, 2);

fs.writeFileSync('public/data/mentores_academicos.json', jsonContent, 'utf8');
console.log('Saved public/data/mentores_academicos.json');
