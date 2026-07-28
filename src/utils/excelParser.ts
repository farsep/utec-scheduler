import * as XLSX from 'xlsx';
import type { Course, Section, Session, MetadataInfo } from '../types/schedule';
import { parseHorarioString, parseSessionType, getCourseColor } from './scheduleUtils';

export interface ExcelParseResult {
  courses: Course[];
  metadata: MetadataInfo;
}

export function parseExcelFile(arrayBuffer: ArrayBuffer): ExcelParseResult {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  const metadata: MetadataInfo = {};
  const coursesMap = new Map<string, Course>();

  // Extract Metadata from top rows if present
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    const label = String(row[0] || '').trim().toLowerCase();
    const val = String(row[1] || '').trim();

    if (label.includes('alumno')) metadata.studentName = val;
    else if (label.includes('programa')) metadata.program = val;
    else if (label.includes('carrera')) metadata.major = val;
    else if (label.includes('periodo')) metadata.semester = val;
    else if (label.includes('turno')) metadata.registrationTime = val;
  }

  // Find header row (contains "Código" or "Curso")
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const rowStr = (rows[i] || []).join(' ').toLowerCase();
    if (rowStr.includes('código') || rowStr.includes('codigo') || (rowStr.includes('curso') && rowStr.includes('sección'))) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = 7; // Default row index 8 (0-indexed 7)
  }

  const headers = (rows[headerRowIndex] || []).map((h: any) => String(h || '').trim().toLowerCase());
  
  // Column Index mapping
  const colMap = {
    code: headers.findIndex(h => h.includes('código') || h.includes('codigo')),
    name: headers.findIndex(h => h === 'curso' || h.includes('nombre')),
    section: headers.findIndex(h => h.includes('sección') || h.includes('seccion') || h.includes('grupo')),
    sessionGroup: headers.findIndex(h => h.includes('sesión') || h.includes('sesion')),
    modality: headers.findIndex(h => h.includes('modalidad')),
    schedule: headers.findIndex(h => h.includes('horario')),
    frequency: headers.findIndex(h => h.includes('frecuencia')),
    location: headers.findIndex(h => h.includes('ubicación') || h.includes('ubicacion') || h.includes('aula')),
    vacancies: headers.findIndex(h => h.includes('vacantes')),
    enrolled: headers.findIndex(h => h.includes('matriculados')),
    professor: headers.findIndex(h => h.includes('docente') || h.includes('profesor')),
    email: headers.findIndex(h => h.includes('correo'))
  };

  // Fallbacks if header mapping fails
  if (colMap.code === -1) colMap.code = 0;
  if (colMap.name === -1) colMap.name = 1;
  if (colMap.section === -1) colMap.section = 2;
  if (colMap.sessionGroup === -1) colMap.sessionGroup = 3;
  if (colMap.modality === -1) colMap.modality = 4;
  if (colMap.schedule === -1) colMap.schedule = 5;
  if (colMap.frequency === -1) colMap.frequency = 6;
  if (colMap.location === -1) colMap.location = 7;
  if (colMap.vacancies === -1) colMap.vacancies = 8;
  if (colMap.enrolled === -1) colMap.enrolled = 9;
  if (colMap.professor === -1) colMap.professor = 10;
  if (colMap.email === -1) colMap.email = 11;

  // Process data rows
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const code = String(row[colMap.code] || '').trim();
    const name = String(row[colMap.name] || '').trim();
    if (!code || !name) continue;

    const sectionNum = String(row[colMap.section] || '1').trim();
    const sessionGroup = String(row[colMap.sessionGroup] || 'TEORÍA 1').trim();
    const modality = String(row[colMap.modality] || 'Presencial').trim();
    const scheduleStr = String(row[colMap.schedule] || '').trim();
    const frequency = String(row[colMap.frequency] || 'Semana General').trim();
    const location = String(row[colMap.location] || '').trim();
    const vacancies = parseInt(String(row[colMap.vacancies] || '0'), 10) || 0;
    const enrolled = parseInt(String(row[colMap.enrolled] || '0'), 10) || 0;
    const professor = String(row[colMap.professor] || '').trim();
    const email = String(row[colMap.email] || '').trim();

    const parsedTime = parseHorarioString(scheduleStr);
    if (!parsedTime) continue; // Skip rows without valid time format

    // Create or get course
    if (!coursesMap.has(code)) {
      coursesMap.set(code, {
        code,
        name,
        sections: [],
        color: getCourseColor(code),
        credits: deriveCredits(code, name)
      });
    }
    const course = coursesMap.get(code)!;

    // Create or get section
    let section = course.sections.find(s => s.sectionNumber === sectionNum);
    if (!section) {
      section = {
        sectionNumber: sectionNum,
        sessions: [],
        vacancies,
        enrolled,
        professors: []
      };
      course.sections.push(section);
    }

    if (professor && !section.professors.includes(professor)) {
      section.professors.push(professor);
    }

    const session: Session = {
      id: `${code}-${sectionNum}-${sessionGroup}-${parsedTime.day}-${parsedTime.startTime}`,
      sessionGroup,
      sessionType: parseSessionType(sessionGroup),
      modality,
      day: parsedTime.day,
      startTime: parsedTime.startTime,
      endTime: parsedTime.endTime,
      startMinutes: parsedTime.startMinutes,
      endMinutes: parsedTime.endMinutes,
      frequency,
      location,
      vacancies,
      enrolled,
      professor,
      email
    };

    section.sessions.push(session);
  }

  // Sort sections by number
  coursesMap.forEach(course => {
    course.sections.sort((a, b) => parseInt(a.sectionNumber) - parseInt(b.sectionNumber));
  });

  return {
    courses: Array.from(coursesMap.values()),
    metadata
  };
}

function deriveCredits(code: string, name: string): number {
  if (code.startsWith('CC') || code.startsWith('CS') || code.startsWith('MA')) return 4;
  if (code.startsWith('HH') || code.startsWith('AD') || code.startsWith('PI')) return 3;
  return 3;
}
