import * as pdfjsLib from 'pdfjs-dist';
import type { Course, Section, Session, MetadataInfo, DayOfWeek } from '../types/schedule';
import { parseSessionType, getCourseColor, timeToMinutes, formatLocation } from './scheduleUtils';

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

interface PDFTextItem {
  str: string;
  x: number;
  y: number;
  page: number;
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

  const allItems: PDFTextItem[] = [];
  const metadata: MetadataInfo = {};
  let fullText = '';

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    const pageItems: PDFTextItem[] = [];
    textContent.items.forEach((item: any) => {
      const str = (item.str || '').trim();
      if (!str) return;
      const transform = item.transform || [1, 0, 0, 1, 0, 0];
      const x = transform[4];
      const y = transform[5];
      const ptItem = { str, x, y, page: pageNum };
      allItems.push(ptItem);
      pageItems.push(ptItem);
    });

    // Reconstruct page text with newlines when Y-coordinate changes
    const pageSorted = [...pageItems].sort((a, b) => b.y - a.y);
    const lines: string[] = [];
    let currLine: string[] = [];
    let currY: number | null = null;

    pageSorted.forEach(item => {
      if (currY === null || Math.abs(item.y - currY) <= 4.0) {
        currLine.push(item.str);
        if (currY === null) currY = item.y;
      } else {
        lines.push(currLine.join(' '));
        currLine = [item.str];
        currY = item.y;
      }
    });
    if (currLine.length > 0) lines.push(currLine.join(' '));

    fullText += lines.join('\n') + '\n';
  }

  // Extract Clean Metadata header fields appearing before course table
  const studentMatch = fullText.match(/Alumno\s*:\s*(.+?)(?=\s*(?:Programa|Carrera|Malla|Periodo|Turno|Código|$|\n))/i);
  if (studentMatch) metadata.studentName = studentMatch[1].replace(/\s+/g, ' ').trim();

  const programMatch = fullText.match(/Programa\s*:\s*(.+?)(?=\s*(?:Carrera|Malla|Periodo|Turno|Código|$|\n))/i);
  if (programMatch) metadata.program = programMatch[1].replace(/\s+/g, ' ').trim();

  const majorMatch = fullText.match(/Carrera\s*:\s*(.+?)(?=\s*(?:Malla|Periodo|Turno|Código|$|\n))/i);
  if (majorMatch) metadata.major = majorMatch[1].replace(/\s+/g, ' ').trim();

  const mallaMatch = fullText.match(/Malla\s*:\s*(.+?)(?=\s*(?:Periodo|Turno|Código|$|\n))/i);
  if (mallaMatch) metadata.malla = mallaMatch[1].replace(/\s+/g, ' ').trim();

  const semesterMatch = fullText.match(/Periodo\s*:\s*(.+?)(?=\s*(?:Turno|Código|$|\n))/i);
  if (semesterMatch) metadata.semester = semesterMatch[1].replace(/\s+/g, ' ').trim();

  const regMatch = fullText.match(/Turno\s*(?:de\s*Matrícula)?\s*:\s*(.+?)(?=\s*(?:Código|$|\n))/i);
  if (regMatch) metadata.registrationTime = regMatch[1].replace(/\s+/g, ' ').trim();

  const dateMatch = fullText.match(/Fecha\s*:\s*(.+?)(?=\s*(?:Hora|Alumno|Código|$|\n))/i);
  if (dateMatch) metadata.reportDate = dateMatch[1].replace(/\s+/g, ' ').trim();

  const timeMatch = fullText.match(/Hora\s*:\s*(.+?)(?=\s*(?:Alumno|Programa|Código|$|\n))/i);
  if (timeMatch) metadata.reportTime = timeMatch[1].replace(/\s+/g, ' ').trim();

  // Group text items into row blocks based on PDF Y-coordinates
  const sortedItems = [...allItems].sort((a, b) => b.page !== a.page ? a.page - b.page : b.y - a.y);
  
  // Identify course code block bounds
  const rawBlocks: { code: string; items: PDFTextItem[] }[] = [];
  let currentBlock: { code: string; items: PDFTextItem[] } | null = null;

  sortedItems.forEach(item => {
    if (item.x < 90 && /^[A-Z]{2,4}\d{4}$/.test(item.str)) {
      if (currentBlock) rawBlocks.push(currentBlock);
      currentBlock = { code: item.str, items: [item] };
    } else if (currentBlock) {
      currentBlock.items.push(item);
    }
  });
  if (currentBlock) rawBlocks.push(currentBlock);

  // Pass 1: Extract 100% accurate official course names bound strictly to Column 2 (90 <= X < 172)
  const codeNameMap = new Map<string, string>();

  rawBlocks.forEach(({ code, items }) => {
    const nameWords = items
      .filter(i => i.x >= 90 && i.x < 172)
      .map(i => i.str)
      .filter(s => s && !/^(?:AND|CD|MALLA)-\d{4}/i.test(s));

    const uniqueNameWords: string[] = [];
    nameWords.forEach(w => {
      if (!uniqueNameWords.includes(w)) {
        uniqueNameWords.push(w);
      }
    });

    const cName = uniqueNameWords.join(' ').trim();
    if (cName && (!codeNameMap.has(code) || cName.length > codeNameMap.get(code)!.length)) {
      codeNameMap.set(code, cName);
    }
  });

  const eligibleCourseCodes = new Set<string>();
  const eligibleCoursesMap = new Map<string, { type: string; plan?: string }>();
  const rawCoursesMap = new Map<string, { code: string; name: string; courseType: string; plan?: string; rawSessions: any[] }>();

  // Pass 2: Extract section sessions and full multi-line cells strictly from PDF column bounds
  rawBlocks.forEach(({ code, items }) => {
    eligibleCourseCodes.add(code);

    // Find all schedule time items in block (Col 9: 490 <= X < 575) to anchor session rows
    const scheduleItems = items.filter(i => i.x >= 490 && i.x < 575 && /(Lun|Mar|Mie|Jue|Vie|Sab|Dom)\.?\s*\d{1,2}:\d{2}/i.test(i.str));
    
    // Sort schedule items descending by Y
    scheduleItems.sort((a, b) => b.y - a.y);

    scheduleItems.forEach((schItem, sIdx) => {
      const topY = schItem.y + 6.0;
      const bottomY = sIdx + 1 < scheduleItems.length ? scheduleItems[sIdx + 1].y + 6.0 : topY - 32.0;

      // Collect all items belonging to this session row height span across ALL columns
      const rowItems = items.filter(i => i.y > bottomY && i.y <= topY);

      const scheduleText = rowItems.filter(i => i.x >= 490 && i.x < 575).map(i => i.str).join(' ');
      const timeMatch = scheduleText.match(/(Lun|Mar|Mie|Jue|Vie|Sab|Dom)\.?\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/i);
      if (!timeMatch) return;

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

      // Column 3 (172 <= X < 242): Full Multi-Line Professor Name Cell
      const profItems = rowItems.filter(i => i.x >= 172 && i.x < 242).map(i => i.str);
      let professor = 'Por asignar';
      if (profItems.length > 0) {
        const rawProf = profItems.join(' ').replace(/,$/, '').trim();
        if (rawProf && !/^(?:AND|CD|MALLA)-\d{4}/i.test(rawProf)) {
          professor = rawProf;
        }
      }

      // Column 4 (242 <= X < 290): Full Multi-Line Malla / Plan Code Cell
      const mallaText = rowItems.filter(i => i.x >= 242 && i.x < 290).map(i => i.str).join(' ');
      let plan = undefined;
      const planMatch = mallaText.match(/([A-Z]{2,4}-\d{4}-?\s*\d*)/);
      if (planMatch) plan = planMatch[1].replace(/\s+/g, '');

      // Column 5 (290 <= X < 340): Course Type Cell
      const typeText = rowItems.filter(i => i.x >= 290 && i.x < 340).map(i => i.str).join(' ');
      let courseType = 'Obligatorio';
      if (typeText.toLowerCase().includes('electivo')) courseType = 'Electivo';

      eligibleCoursesMap.set(code, { type: courseType, plan });

      // Column 6 (400 <= X < 435): Section Number Cell
      const secText = rowItems.filter(i => i.x >= 400 && i.x < 435).map(i => i.str).join(' ');
      const secMatch = secText.match(/\d+/);
      const sectionNum = secMatch ? secMatch[0] : '1';

      // Column 7 (435 <= X < 490): Full Multi-Line Session Group Cell
      const groupText = rowItems.filter(i => i.x >= 435 && i.x < 490).map(i => i.str).join(' ');
      const groupMatch = groupText.match(/(?:Teoría|Laboratorio|Práctica|Taller|Seminario|Clase|Sesión)[^\d]*\d+/i);
      const sessionGroup = groupMatch ? groupMatch[0] : `TEORÍA ${sectionNum}`;

      // Column 8 (340 <= X < 400): Modality Cell
      const modalityText = rowItems.filter(i => i.x >= 340 && i.x < 400).map(i => i.str).join(' ');
      let modality = 'Presencial';
      if (modalityText.toLowerCase().includes('sincronico') || modalityText.toLowerCase().includes('virtual')) {
        modality = 'Sincronico';
      }

      // Column 9 (640 <= X < 710): Full Multi-Line Location Room Cell
      const locText = rowItems.filter(i => i.x >= 640 && i.x < 710).map(i => i.str).join(' ');
      const locMatch = locText.match(/(UTEC-BA\s+[A-Z0-9]+|UTEC-BA\s+Virtual|Virtual|[A-Z]\d{3,4})/i);
      const rawLoc = locMatch ? locMatch[0] : (locText.replace(/\s+/g, ' ').trim() || (modality === 'Sincronico' ? 'Virtual' : ''));
      const location = formatLocation(rawLoc);

      // Column 10 (710 <= X < 760): Vacancies Cell
      const vacText = rowItems.filter(i => i.x >= 710 && i.x < 760).map(i => i.str).join(' ');
      const vacancies = parseInt(vacText, 10) || 30;

      const name = codeNameMap.get(code) || `Curso ${code}`;

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
    });
  });

  const finalCourses: Course[] = [];

  rawCoursesMap.forEach(({ code, name, courseType, plan, rawSessions }) => {
    const sectionGroups = new Map<string, any[]>();
    rawSessions.forEach(rs => {
      if (!sectionGroups.has(rs.sectionNum)) sectionGroups.set(rs.sectionNum, []);
      sectionGroups.get(rs.sectionNum)!.push(rs);
    });

    const finalSections: Section[] = [];

    sectionGroups.forEach((sRows, mainSecNum) => {
      const allGroupNames: string[] = [];
      sRows.forEach(r => {
        if (!allGroupNames.includes(r.sessionGroup)) {
          allGroupNames.push(r.sessionGroup);
        }
      });

      const baseGroupNames = allGroupNames.filter(g => {
        const lower = g.toLowerCase();
        const nums = g.match(/\d+/g);
        if (!nums) return true;
        const lastNum = parseInt(nums[nums.length - 1], 10);
        return lower.startsWith('teoría') && lastNum === parseInt(mainSecNum, 10);
      });

      const subGroupNames = allGroupNames.filter(g => !baseGroupNames.includes(g));

      if (subGroupNames.length > 1) {
        const baseRows = sRows.filter(r => baseGroupNames.includes(r.sessionGroup));

        subGroupNames.forEach((sgName) => {
          const matchingSubRows = sRows.filter(r => r.sessionGroup === sgName);
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
      plan
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
