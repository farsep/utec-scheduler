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
  const coursesMap = new Map<string, { code: string; name: string; rawSessions: any[] }>();

  // Extract Metadata from top rows
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

  // Header row detection
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const rowStr = (rows[i] || []).join(' ').toLowerCase();
    if (rowStr.includes('código') || rowStr.includes('codigo') || (rowStr.includes('curso') && rowStr.includes('sección'))) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) headerRowIndex = 7;

  const headers = (rows[headerRowIndex] || []).map((h: any) => String(h || '').trim().toLowerCase());

  const colMap = {
    code: headers.findIndex(h => h.includes('código') || h.includes('codigo')),
    name: headers.findIndex(h => h === 'curso' || h.includes('nombre')),
    section: headers.findIndex(h => h.includes('sección') || h.includes('seccion')),
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
    if (!parsedTime) continue;

    if (!coursesMap.has(code)) {
      coursesMap.set(code, { code, name, rawSessions: [] });
    }

    coursesMap.get(code)!.rawSessions.push({
      sectionNum,
      sessionGroup,
      modality,
      parsedTime,
      frequency,
      location,
      vacancies,
      enrolled,
      professor,
      email
    });
  }

  const finalCourses: Course[] = [];

  coursesMap.forEach(({ code, name, rawSessions }) => {
    const sectionGroups = new Map<string, any[]>();
    rawSessions.forEach(rs => {
      if (!sectionGroups.has(rs.sectionNum)) sectionGroups.set(rs.sectionNum, []);
      sectionGroups.get(rs.sectionNum)!.push(rs);
    });

    const finalSections: Section[] = [];

    sectionGroups.forEach((sRows, mainSecNum) => {
      const isSubgroup = (groupName: string) => {
        const numMatch = groupName.match(/\d+/);
        if (!numMatch) return false;
        const num = parseInt(numMatch[0], 10);
        return num >= 10 && !groupName.endsWith(` ${mainSecNum}`);
      };

      const subgroupRows = sRows.filter(r => isSubgroup(r.sessionGroup));
      const baseRows = sRows.filter(r => !isSubgroup(r.sessionGroup));

      // Extract DISTINCT subgroup names
      const distinctSubgroups: string[] = [];
      subgroupRows.forEach(r => {
        if (!distinctSubgroups.includes(r.sessionGroup)) {
          distinctSubgroups.push(r.sessionGroup);
        }
      });

      // Split into variants ONLY if there are 2 or more DISTINCT subgroup names (e.g. CC1103: Lab 11, Lab 12...)
      if (distinctSubgroups.length > 1) {
        distinctSubgroups.forEach((sgName) => {
          const matchingSubRows = subgroupRows.filter(r => r.sessionGroup === sgName);
          const variantSecNum = `${mainSecNum} (${sgName})`;
          const combinedSessions: Session[] = [];
          const professors: string[] = [];

          baseRows.forEach(bRow => {
            combinedSessions.push({
              id: `${code}-${variantSecNum}-${bRow.sessionGroup}-${bRow.parsedTime.day}-${bRow.parsedTime.startTime}`,
              sessionGroup: bRow.sessionGroup,
              sessionType: parseSessionType(bRow.sessionGroup),
              modality: bRow.modality,
              day: bRow.parsedTime.day,
              startTime: bRow.parsedTime.startTime,
              endTime: bRow.parsedTime.endTime,
              startMinutes: bRow.parsedTime.startMinutes,
              endMinutes: bRow.parsedTime.endMinutes,
              frequency: bRow.frequency,
              location: bRow.location,
              vacancies: matchingSubRows[0]?.vacancies || bRow.vacancies,
              enrolled: matchingSubRows[0]?.enrolled || bRow.enrolled,
              professor: bRow.professor,
              email: bRow.email
            });
            if (bRow.professor && !professors.includes(bRow.professor)) professors.push(bRow.professor);
          });

          matchingSubRows.forEach((subRow, subIdx) => {
            combinedSessions.push({
              id: `${code}-${variantSecNum}-${subRow.sessionGroup}-${subRow.parsedTime.day}-${subRow.parsedTime.startTime}-${subIdx}`,
              sessionGroup: subRow.sessionGroup,
              sessionType: parseSessionType(subRow.sessionGroup),
              modality: subRow.modality,
              day: subRow.parsedTime.day,
              startTime: subRow.parsedTime.startTime,
              endTime: subRow.parsedTime.endTime,
              startMinutes: subRow.parsedTime.startMinutes,
              endMinutes: subRow.parsedTime.endMinutes,
              frequency: subRow.frequency,
              location: subRow.location,
              vacancies: subRow.vacancies,
              enrolled: subRow.enrolled,
              professor: subRow.professor,
              email: subRow.email
            });
            if (subRow.professor && !professors.includes(subRow.professor)) professors.push(subRow.professor);
          });

          finalSections.push({
            sectionNumber: variantSecNum,
            sessions: combinedSessions,
            vacancies: matchingSubRows[0]?.vacancies || sRows[0]?.vacancies || 0,
            enrolled: matchingSubRows[0]?.enrolled || sRows[0]?.enrolled || 0,
            professors
          });
        });
      } else {
        // Single section (e.g. CS6006): keep all base + subgroup sessions together in 1 section!
        const combinedSessions: Session[] = sRows.map((r, idx) => ({
          id: `${code}-${mainSecNum}-${r.sessionGroup}-${r.parsedTime.day}-${r.parsedTime.startTime}-${idx}`,
          sessionGroup: r.sessionGroup,
          sessionType: parseSessionType(r.sessionGroup),
          modality: r.modality,
          day: r.parsedTime.day,
          startTime: r.parsedTime.startTime,
          endTime: r.parsedTime.endTime,
          startMinutes: r.parsedTime.startMinutes,
          endMinutes: r.parsedTime.endMinutes,
          frequency: r.frequency,
          location: r.location,
          vacancies: r.vacancies,
          enrolled: r.enrolled,
          professor: r.professor,
          email: r.email
        }));

        const professors: string[] = [];
        sRows.forEach(r => {
          if (r.professor && !professors.includes(r.professor)) professors.push(r.professor);
        });

        finalSections.push({
          sectionNumber: mainSecNum,
          sessions: combinedSessions,
          vacancies: sRows[0]?.vacancies || 0,
          enrolled: sRows[0]?.enrolled || 0,
          professors
        });
      }
    });

    finalCourses.push({
      code,
      name,
      sections: finalSections,
      color: getCourseColor(code),
      credits: deriveCredits(code, name)
    });
  });

  return {
    courses: finalCourses,
    metadata
  };
}

function deriveCredits(code: string, name: string): number {
  if (code.startsWith('CC') || code.startsWith('CS') || code.startsWith('MA')) return 4;
  if (code.startsWith('HH') || code.startsWith('AD') || code.startsWith('PI')) return 3;
  return 3;
}
