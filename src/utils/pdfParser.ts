import * as pdfjsLib from 'pdfjs-dist';
import type { Course, Section, Session, MetadataInfo, DayOfWeek } from '../types/schedule';
import { parseSessionType, getCourseColor, timeToMinutes } from './scheduleUtils';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '4.0.379'}/build/pdf.worker.min.mjs`;
}

export interface PDFParseResult {
  courses: Course[];
  eligibleCourseCodes: Set<string>;
  eligibleCoursesMap: Map<string, { type: 'Obligatorio' | 'Electivo' | string; plan?: string }>;
  extractedText: string;
  metadata: MetadataInfo;
}

export async function parsePDFFile(arrayBuffer: ArrayBuffer): Promise<PDFParseResult> {
  let pdfDoc;
  try {
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    pdfDoc = await loadingTask.promise;
  } catch (err) {
    console.error('Error loading PDF document with worker, trying fallback:', err);
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer), isEvalSupported: false });
    pdfDoc = await loadingTask.promise;
  }

  let fullText = '';
  const eligibleCourseCodes = new Set<string>();
  const eligibleCoursesMap = new Map<string, { type: string; plan?: string }>();
  const rawCoursesMap = new Map<string, { code: string; name: string; courseType: string; plan?: string; rawSessions: any[] }>();
  const metadata: MetadataInfo = {};

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    
    fullText += pageText + '\n';
  }

  const studentMatch = fullText.match(/Alumno:\s*([^\n\r]+)/i);
  if (studentMatch) metadata.studentName = studentMatch[1].trim();

  const courseCodeRegex = /\b([A-Z]{2,4}\d{4})\b/g;
  let match;
  while ((match = courseCodeRegex.exec(fullText)) !== null) {
    eligibleCourseCodes.add(match[1]);
  }

  const blockRegex = /([A-Z]{2,4}\d{4})\s+(.+?)(?=(?:[A-Z]{2,4}\d{4}|\Z))/gs;
  let blockMatch;

  while ((blockMatch = blockRegex.exec(fullText)) !== null) {
    const code = blockMatch[1];
    const content = blockMatch[2].replace(/\s+/g, ' ').trim();

    const timeMatch = content.match(/(Lun|Mar|Mie|Jue|Vie|Sab|Dom)\.?\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/i);
    if (!timeMatch) continue;

    let rawDay = timeMatch[1].substring(0, 3);
    rawDay = rawDay.charAt(0).toUpperCase() + rawDay.slice(1).toLowerCase();
    let day: DayOfWeek = 'Lun';
    if (rawDay.startsWith('Mar')) day = 'Mar';
    else if (rawDay.startsWith('Mie')) day = 'Mie';
    else if (rawDay.startsWith('Jue')) day = 'Jue';
    else if (rawDay.startsWith('Vie')) day = 'Vie';
    else if (rawDay.startsWith('Sab')) day = 'Sab';
    else day = 'Lun';

    const startTime = timeMatch[2].padStart(5, '0');
    const endTime = timeMatch[3].padStart(5, '0');
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);

    let courseType = 'Obligatorio';
    if (content.toLowerCase().includes('electivo')) courseType = 'Electivo';

    let plan = undefined;
    const planMatch = content.match(/(CD-\d{4}-\d)/);
    if (planMatch) plan = planMatch[1];

    eligibleCoursesMap.set(code, { type: courseType, plan });

    const nameMatch = content.match(/^(.+?)(?=\s+(?:[A-Z][a-z]+|\bCD-\d|\bObligatorio|\bElectivo))/);
    const name = nameMatch ? nameMatch[1].trim() : `Curso ${code}`;

    const groupMatch = content.match(/(\d+)\s+((?:Teoría|Laboratorio|Práctica|Taller)\s+\d+)/i);
    const sectionNum = groupMatch ? groupMatch[1] : '1';
    const sessionGroup = groupMatch ? groupMatch[2] : 'TEORÍA 1';

    let professor = 'Por asignar';
    const profMatch = content.match(/([A-Z][a-záéíóúñ]+(?:\s+[A-Z][a-záéíóúñ]+){1,3},\s+[A-Z][a-záéíóúñ]+(?:\s+[A-Z][a-záéíóúñ]+)*)/);
    if (profMatch) {
      professor = profMatch[1].trim();
    }

    let modality = 'Presencial';
    if (content.toLowerCase().includes('sincronico') || content.toLowerCase().includes('virtual')) {
      modality = 'Sincronico';
    }

    const locMatch = content.match(/(UTEC-BA\s+[A-Z0-9]+|UTEC-BA\s+Virtual|Virtual)/i);
    const location = locMatch ? locMatch[1] : (modality === 'Sincronico' ? 'UTEC-BA Virtual' : 'UTEC-BA');

    let vacancies = 30;
    const vacMatch = content.match(/(\d+)\s+(\d+)\s*$/);
    if (vacMatch) {
      vacancies = parseInt(vacMatch[1], 10) || 30;
    }

    if (!rawCoursesMap.has(code)) {
      rawCoursesMap.set(code, { code, name, courseType, plan, rawSessions: [] });
    }

    rawCoursesMap.get(code)!.rawSessions.push({
      sectionNum,
      sessionGroup,
      modality,
      day,
      startTime,
      endTime,
      startMinutes,
      endMinutes,
      location,
      vacancies,
      professor
    });
  }

  const finalCourses: Course[] = [];

  rawCoursesMap.forEach(({ code, name, courseType, plan, rawSessions }) => {
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

      // Split into variants ONLY if there are 2 or more DISTINCT subgroup names
      if (distinctSubgroups.length > 1) {
        distinctSubgroups.forEach((sgName) => {
          const matchingSubRows = subgroupRows.filter(r => r.sessionGroup === sgName);
          const variantSecNum = `${mainSecNum} (${sgName})`;
          const combinedSessions: Session[] = [];
          const professors: string[] = [];

          baseRows.forEach(bRow => {
            combinedSessions.push({
              id: `${code}-${variantSecNum}-${bRow.sessionGroup}-${bRow.day}-${bRow.startTime}`,
              sessionGroup: bRow.sessionGroup,
              sessionType: parseSessionType(bRow.sessionGroup),
              modality: bRow.modality,
              day: bRow.day,
              startTime: bRow.startTime,
              endTime: bRow.endTime,
              startMinutes: bRow.startMinutes,
              endMinutes: bRow.endMinutes,
              frequency: 'Semana General',
              location: bRow.location,
              vacancies: matchingSubRows[0]?.vacancies || bRow.vacancies,
              enrolled: 0,
              professor: bRow.professor,
              email: ''
            });
            if (bRow.professor && bRow.professor !== 'Por asignar' && !professors.includes(bRow.professor)) {
              professors.push(bRow.professor);
            }
          });

          matchingSubRows.forEach((subRow, subIdx) => {
            combinedSessions.push({
              id: `${code}-${variantSecNum}-${subRow.sessionGroup}-${subRow.day}-${subRow.startTime}-${subIdx}`,
              sessionGroup: subRow.sessionGroup,
              sessionType: parseSessionType(subRow.sessionGroup),
              modality: subRow.modality,
              day: subRow.day,
              startTime: subRow.startTime,
              endTime: subRow.endTime,
              startMinutes: subRow.startMinutes,
              endMinutes: subRow.endMinutes,
              frequency: 'Semana General',
              location: subRow.location,
              vacancies: subRow.vacancies,
              enrolled: 0,
              professor: subRow.professor,
              email: ''
            });
            if (subRow.professor && subRow.professor !== 'Por asignar' && !professors.includes(subRow.professor)) {
              professors.push(subRow.professor);
            }
          });

          finalSections.push({
            sectionNumber: variantSecNum,
            sessions: combinedSessions,
            vacancies: matchingSubRows[0]?.vacancies || sRows[0]?.vacancies || 30,
            enrolled: 0,
            professors
          });
        });
      } else {
        // Single section (e.g. CS6006): keep all base + subgroup sessions together in 1 section!
        const combinedSessions: Session[] = sRows.map((r, idx) => ({
          id: `${code}-${mainSecNum}-${r.sessionGroup}-${r.day}-${r.startTime}-${idx}`,
          sessionGroup: r.sessionGroup,
          sessionType: parseSessionType(r.sessionGroup),
          modality: r.modality,
          day: r.day,
          startTime: r.startTime,
          endTime: r.endTime,
          startMinutes: r.startMinutes,
          endMinutes: r.endMinutes,
          frequency: 'Semana General',
          location: r.location,
          vacancies: r.vacancies,
          enrolled: 0,
          professor: r.professor,
          email: ''
        }));

        const professors: string[] = [];
        sRows.forEach(r => {
          if (r.professor && r.professor !== 'Por asignar' && !professors.includes(r.professor)) {
            professors.push(r.professor);
          }
        });

        finalSections.push({
          sectionNumber: mainSecNum,
          sessions: combinedSessions,
          vacancies: sRows[0]?.vacancies || 30,
          enrolled: 0,
          professors
        });
      }
    });

    finalCourses.push({
      code,
      name,
      sections: finalSections,
      color: getCourseColor(code),
      isEligible: true,
      courseType,
      plan,
      credits: 3
    });
  });

  return {
    courses: finalCourses,
    eligibleCourseCodes,
    eligibleCoursesMap,
    extractedText: fullText,
    metadata
  };
}
