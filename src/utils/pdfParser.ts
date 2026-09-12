import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
import type { Course, Section, Session, MetadataInfo, DayOfWeek } from '../types/schedule';
import { parseSessionType, getCourseColor, timeToMinutes, formatLocation, parseDayOfWeek } from './scheduleUtils';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

export interface PDFParseResult {
  courses: Course[];
  eligibleCourseCodes: Set<string>;
  eligibleCoursesMap: Map<string, { type: 'Obligatorio' | 'Electivo' | string; plan?: string }>;
  extractedText: string;
  metadata: MetadataInfo;
  isConsolidado?: boolean;
  enrolledSections?: Record<string, string>;
}

interface PDFTextItem {
  str: string;
  x: number;
  y: number;
  page: number;
}

const FOOTER_DISCLAIMER_REGEX = /(?:desapruebe|reglamento\s+acad[eé]mico|separado\s+de\s+manera\s+definitiva|volver\s+a\s+postular|art\.\s*\d+\.?\d*|no\s+podr[aá]\s+matricularse)/i;

function groupRowItems(items: PDFTextItem[], tolerance: number = 10.0): { items: PDFTextItem[]; startY: number }[] {
  const sorted = [...items].sort((a, b) => b.y !== a.y ? b.y - a.y : a.x - b.x);
  const rows: { items: PDFTextItem[]; startY: number }[] = [];
  sorted.forEach(it => {
    const existing = rows.find(r => Math.abs(r.startY - it.y) <= tolerance);
    if (existing) {
      existing.items.push(it);
    } else {
      rows.push({ items: [it], startY: it.y });
    }
  });
  rows.forEach(r => r.items.sort((a, b) => a.x - b.x));
  return rows;
}

function parseConsolidadoPDF(allItems: PDFTextItem[], fullText: string, metadata: any): PDFParseResult {
  metadata.isConsolidado = true;
  const sortedItems = [...allItems].sort((a, b) => (b.page !== a.page ? a.page - b.page : b.y !== a.y ? b.y - a.y : a.x - b.x));

  const isHorarioLayout = /consolidado\s+de\s+horario|horario\s+carga\s+h[áa]bil/i.test(fullText) || sortedItems.some(it => (it.str === 'Sección' || it.str === 'SECCIÓN') && it.x > 500);
  const isCargaHabil = /horario\s+carga\s+h[áa]bil/i.test(fullText);

  interface CourseAnchor {
    code: string;
    page: number;
    topY: number;
    sectionNum?: string;
    subGroup?: string;
    professor?: string;
    courseName?: string;
  }
  const courseAnchors: CourseAnchor[] = [];

  sortedItems.forEach((item) => {
    const isAnchorX = isCargaHabil ? (item.x >= 40 && item.x <= 75) : (item.x >= 65 && item.x <= 95);
    if (isAnchorX && /^[A-Z]{2,4}\d{2}$/.test(item.str)) {
      let fullCode = item.str;
      const suffixItem = sortedItems.find(it => it.page === item.page && isAnchorX && /^\d{2}$/.test(it.str) && item.y - it.y > 0 && item.y - it.y <= 16.0);
      if (suffixItem) {
        fullCode = item.str + suffixItem.str;
      }
      courseAnchors.push({ code: fullCode, page: item.page, topY: item.y });
    } else if (isAnchorX && /^[A-Z]{2,4}\d{4}$/.test(item.str)) {
      courseAnchors.push({ code: item.str, page: item.page, topY: item.y });
    }
  });

  const eligibleCourseCodes = new Set<string>();
  const eligibleCoursesMap = new Map<string, { type: string; plan?: string }>();
  const enrolledSections: Record<string, string> = {};

  interface RawSession {
    sectionNum: string;
    sessionGroup: string;
    modality: string;
    parsedTime: { day: any; startTime: string; endTime: string; startMinutes: number; endMinutes: number; };
    frequency: string;
    location: string;
    vacancies: number;
    enrolled: number;
    professor: string;
    email: string;
  }

  interface RawCourse {
    code: string;
    name: string;
    color: string;
    isEligible: boolean;
    courseType: string;
    rawSessions: RawSession[];
  }

  const coursesMap = new Map<string, RawCourse>();

  courseAnchors.forEach((anchor, idx) => {
    const nextAnchor = courseAnchors.find((na, nidx) => nidx > idx && na.page === anchor.page);

    const pageFooterItems = sortedItems.filter(it => it.page === anchor.page && (
      FOOTER_DISCLAIMER_REGEX.test(it.str) ||
      (it.y < 60 && /^\d+$/.test(it.str))
    ));
    const pageFooterY = pageFooterItems.length > 0 ? Math.max(...pageFooterItems.map(it => it.y)) : -9999;

    const bottomY = nextAnchor ? nextAnchor.topY : (pageFooterY > -9999 ? pageFooterY : anchor.topY - 120.0);

    const blockItems = sortedItems.filter(it =>
      it.page === anchor.page &&
      it.y <= anchor.topY + 15.0 &&
      it.y > bottomY + 2.0 &&
      (pageFooterY === -9999 || it.y > pageFooterY + 2.0) &&
      !FOOTER_DISCLAIMER_REGEX.test(it.str)
    );

    const nameMinX = isCargaHabil ? 70 : 100;
    const nameMaxX = isHorarioLayout ? (isCargaHabil ? 170 : 225) : 260;
    const nameItems = blockItems
      .filter(it => it.x >= nameMinX && it.x < nameMaxX && it.y >= anchor.topY - 45.0)
      .map(it => it.str)
      .filter(s => !/^(?:Obligatorio|Electivo)$/i.test(s) && !FOOTER_DISCLAIMER_REGEX.test(s));
    
    let courseName = nameItems.join(' ')
      .replace(/^(?:[0-9]|-)\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();

    const profMinX = isCargaHabil ? 170 : 250;
    const profMaxX = isCargaHabil ? 245 : 380;
    const profItems = blockItems
      .filter(it => it.x >= profMinX && it.x < profMaxX && it.y >= anchor.topY - 45.0)
      .map(it => it.str)
      .filter(s => !FOOTER_DISCLAIMER_REGEX.test(s));
    let professor = profItems.join(' ').replace(/\s+/g, ' ').trim();

    let sectionNum = '1';
    let subGroup = '';

    if (isHorarioLayout) {
      const secMinX = isCargaHabil ? 390 : 530;
      const secMaxX = isCargaHabil ? 435 : 585;
      const secItems = blockItems
        .filter(it => it.x >= secMinX && it.x < secMaxX && it.y >= anchor.topY - 45.0)
        .map(it => it.str)
        .filter(s => !FOOTER_DISCLAIMER_REGEX.test(s));
      const secMatch = secItems.join(' ').match(/\d+/);
      sectionNum = secMatch ? secMatch[0] : '1';

      const subMinX = isCargaHabil ? 435 : 585;
      const subMaxX = isCargaHabil ? 505 : 620;
      const subItems = blockItems
        .filter(it => it.x >= subMinX && it.x < subMaxX && it.y >= anchor.topY - 45.0)
        .map(it => it.str)
        .filter(s => !FOOTER_DISCLAIMER_REGEX.test(s))
        .join(' ');
      
      if (isCargaHabil) {
        subGroup = subItems.trim();
      } else {
        const subMatch = subItems.match(/(?:Lab\w*|Pr[aá]c\w*|Tall\w*)\.?\s*\d+|\b\d{2}\b/i);
        if (subMatch) {
          const matchedStr = subMatch[0];
          subGroup = /^\d{2}$/.test(matchedStr) ? `Lab. ${matchedStr}` : matchedStr;
        }
      }
    } else {
      const secItems = blockItems
        .filter(it => it.x >= 430 && it.x < 480 && it.y >= anchor.topY - 45.0)
        .map(it => it.str)
        .filter(s => !FOOTER_DISCLAIMER_REGEX.test(s));
      const secMatch = secItems.join(' ').match(/\d+/);
      sectionNum = secMatch ? secMatch[0] : '1';

      const subItems = blockItems
        .filter(it => it.x >= 480 && it.x < 580 && it.y >= anchor.topY - 45.0)
        .map(it => it.str)
        .filter(s => !FOOTER_DISCLAIMER_REGEX.test(s))
        .join(' ');
      
      if (isCargaHabil) {
        subGroup = subItems.trim();
      } else {
        const subMatch = subItems.match(/(?:Lab\w*|Pr[aá]c\w*|Tall\w*)\.?\s*\d+|\b\d{2}\b/i);
        if (subMatch) {
          const matchedStr = subMatch[0];
          subGroup = /^\d{2}$/.test(matchedStr) ? `Lab. ${matchedStr}` : matchedStr;
        }
      }
    }

    anchor.sectionNum = sectionNum;
    anchor.subGroup = subGroup;
    anchor.professor = professor;
    anchor.courseName = courseName;

    const secLabel = subGroup ? `${sectionNum} (${subGroup})` : sectionNum;
    enrolledSections[anchor.code] = secLabel;
    eligibleCourseCodes.add(anchor.code);
    eligibleCoursesMap.set(anchor.code, { type: 'Obligatorio' });

    let course = coursesMap.get(anchor.code);
    if (!course) {
      course = {
        code: anchor.code,
        name: courseName,
        rawSessions: [],
        color: getCourseColor(anchor.code),
        isEligible: true,
        courseType: 'Obligatorio'
      };
      coursesMap.set(anchor.code, course);
    }
  });

  courseAnchors.sort((a, b) => (b.page !== a.page ? a.page - b.page : b.topY - a.topY));

  const pageNumbers = Array.from(new Set(sortedItems.map(it => it.page)));

  pageNumbers.forEach(pageNum => {
    const pageAnchors = courseAnchors.filter(ca => ca.page === pageNum);
    if (pageAnchors.length === 0) return;

    const pageFooterItems = sortedItems.filter(it => it.page === pageNum && (
      FOOTER_DISCLAIMER_REGEX.test(it.str) ||
      (it.y < 60 && /^\d+$/.test(it.str))
    ));
    const pageFooterY = pageFooterItems.length > 0 ? Math.max(...pageFooterItems.map(it => it.y)) : -9999;

    const schedMinX = isCargaHabil ? 435 : 600;
    const schedItems = sortedItems.filter(it =>
      it.page === pageNum &&
      it.x >= schedMinX &&
      it.y > (pageFooterY > -9999 ? pageFooterY + 2.0 : -99999) &&
      !FOOTER_DISCLAIMER_REGEX.test(it.str)
    );

    const groupedSched = groupRowItems(schedItems, 10.0);

    groupedSched.forEach((se) => {
      const fullStr = se.items.map(it => it.str).join(' ').trim();

      const match = fullStr.match(/(Teor[íi]a|Lab\w*|Pr[aá]c\w*|Tall\w*)\s*(Virtual)?\s*\d*\s*(Lun\w*|Mar\w*|Mi[eé]\w*|Jue\w*|Vie\w*|S[aá]b\w*|Dom\w*)\.?\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*(?:Semana\s+General)?\s*(.*)/i);

      if (match) {
        const groupTypeStr = match[1];
        const isVirtualStr = match[2];
        const dayStr = match[3];
        const startTimeStr = match[4];
        const endTimeStr = match[5];
        let locationStr = match[6];
        let isValid = true;

        if (isHorarioLayout && se.items.length >= 2) {
          const expectedLocationItem = se.items[se.items.length - 1];
          if (expectedLocationItem && expectedLocationItem.x < 700) {
            isValid = false;
          }
        }

        if (!isValid && isCargaHabil) {
          locationStr = match[6];
          isValid = true;
        }

        if (isValid) {
          let matchedAnchor: CourseAnchor | undefined;

          if (isHorarioLayout) {
            matchedAnchor = pageAnchors.find((anchor, idx) => {
              const nextAnchor = pageAnchors.find((na, nidx) => nidx > idx);
              const topBound = anchor.topY + 15.0;
              const bottomBound = nextAnchor ? nextAnchor.topY + 2.0 : (pageFooterY > -9999 ? pageFooterY : -99999);
              return se.startY <= topBound && se.startY > bottomBound;
            });
          } else {
            let closestAnchor = pageAnchors[0];
            let minDiff = Math.abs(se.startY - pageAnchors[0].topY);

            pageAnchors.forEach(pa => {
              const diff = Math.abs(se.startY - pa.topY);
              if (diff < minDiff) {
                minDiff = diff;
                closestAnchor = pa;
              }
            });
            matchedAnchor = closestAnchor;
          }

          if (matchedAnchor) {
            const course = coursesMap.get(matchedAnchor.code);
            if (course) {
              const day = parseDayOfWeek(dayStr);
              const groupType = groupTypeStr;
              const isVirtual = Boolean(isVirtualStr) || /virtual/i.test(locationStr || '');
              let rawLocation = (locationStr || '').trim();
              if (isCargaHabil) rawLocation = rawLocation.replace(/\s*\d+\s*\d+$/, '');
              if (isVirtual && !rawLocation) rawLocation = 'Virtual';
              const location = formatLocation(rawLocation);

              const startTime = startTimeStr.padStart(5, '0');
              const endTime = endTimeStr.padStart(5, '0');
              const startMinutes = timeToMinutes(startTime);
              const endMinutes = timeToMinutes(endTime);

              const sessionGroupStr = isCargaHabil ? (matchedAnchor.subGroup || groupType.toUpperCase()) : groupType.toUpperCase();

              course.rawSessions.push({
                sectionNum: matchedAnchor.sectionNum || '1',
                sessionGroup: sessionGroupStr,
                modality: isVirtual ? 'Sincronico' : 'Presencial',
                parsedTime: { day, startTime, endTime, startMinutes, endMinutes },
                frequency: 'Semana General',
                location: location || (isVirtual ? 'Virtual' : 'Por asignar'),
                vacancies: 30,
                enrolled: 0,
                professor: matchedAnchor.professor || 'Por asignar',
                email: ''
              });
            }
          }
        }
      }
    });
  });

  const finalCourses: Course[] = [];

  coursesMap.forEach(({ code, name, color, isEligible, courseType, rawSessions }) => {
    const sectionGroups = new Map<string, RawSession[]>();
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

      const baseGroupNames = allGroupNames.filter(g => new RegExp(`\\s${mainSecNum}$`).test(g));
      const subGroupNames = allGroupNames.filter(g => !new RegExp(`\\s${mainSecNum}$`).test(g));

      if (subGroupNames.length > 1 || (subGroupNames.length > 0 && baseGroupNames.length > 0)) {
        const baseRows = sRows.filter(r => baseGroupNames.includes(r.sessionGroup));

        subGroupNames.forEach((sgName) => {
          const matchingSubRows = sRows.filter(r => r.sessionGroup === sgName);
          const variantSecNum = `${mainSecNum} (${sgName})`;
          const combinedSessions: Session[] = [];
          const professors: string[] = [];

          baseRows.forEach(bRow => {
            combinedSessions.push({
              id: `${code}-${variantSecNum}-${bRow.sessionGroup}-${bRow.parsedTime.day}-${bRow.parsedTime.startTime}`,
              sessionGroup: bRow.sessionGroup.toUpperCase(),
              sessionType: parseSessionType(bRow.sessionGroup),
              modality: bRow.modality,
              day: bRow.parsedTime.day,
              startTime: bRow.parsedTime.startTime,
              endTime: bRow.parsedTime.endTime,
              startMinutes: bRow.parsedTime.startMinutes,
              endMinutes: bRow.parsedTime.endMinutes,
              frequency: bRow.frequency,
              location: bRow.location,
              vacancies: bRow.vacancies,
              enrolled: bRow.enrolled,
              professor: bRow.professor,
              email: bRow.email
            });
            if (bRow.professor && bRow.professor !== 'Por asignar' && !professors.includes(bRow.professor)) {
              professors.push(bRow.professor);
            }
          });

          matchingSubRows.forEach(sRow => {
            combinedSessions.push({
              id: `${code}-${variantSecNum}-${sRow.sessionGroup}-${sRow.parsedTime.day}-${sRow.parsedTime.startTime}`,
              sessionGroup: sRow.sessionGroup.toUpperCase(),
              sessionType: parseSessionType(sRow.sessionGroup),
              modality: sRow.modality,
              day: sRow.parsedTime.day,
              startTime: sRow.parsedTime.startTime,
              endTime: sRow.parsedTime.endTime,
              startMinutes: sRow.parsedTime.startMinutes,
              endMinutes: sRow.parsedTime.endMinutes,
              frequency: sRow.frequency,
              location: sRow.location,
              vacancies: sRow.vacancies,
              enrolled: sRow.enrolled,
              professor: sRow.professor,
              email: sRow.email
            });
            if (sRow.professor && sRow.professor !== 'Por asignar' && !professors.includes(sRow.professor)) {
              professors.push(sRow.professor);
            }
          });

          finalSections.push({
            sectionNumber: variantSecNum,
            sessions: combinedSessions,
            vacancies: 30,
            enrolled: 0,
            professors
          });
        });
      } else {
        const sessions: Session[] = [];
        const professors: string[] = [];

        sRows.forEach(row => {
          sessions.push({
            id: `${code}-${mainSecNum}-${row.sessionGroup}-${row.parsedTime.day}-${row.parsedTime.startTime}`,
            sessionGroup: row.sessionGroup.toUpperCase(),
            sessionType: parseSessionType(row.sessionGroup),
            modality: row.modality,
            day: row.parsedTime.day,
            startTime: row.parsedTime.startTime,
            endTime: row.parsedTime.endTime,
            startMinutes: row.parsedTime.startMinutes,
            endMinutes: row.parsedTime.endMinutes,
            frequency: row.frequency,
            location: row.location,
            vacancies: row.vacancies,
            enrolled: row.enrolled,
            professor: row.professor,
            email: row.email
          });
          if (row.professor && row.professor !== 'Por asignar' && !professors.includes(row.professor)) {
            professors.push(row.professor);
          }
        });

        finalSections.push({
          sectionNumber: mainSecNum,
          sessions,
          vacancies: 30,
          enrolled: 0,
          professors
        });
      }
    });

    finalCourses.push({
      code,
      name,
      sections: finalSections,
      color,
      isEligible,
      courseType
    });
  });

  return {
    courses: finalCourses,
    eligibleCourseCodes,
    eligibleCoursesMap,
    extractedText: fullText,
    metadata,
    isConsolidado: !isCargaHabil,
    enrolledSections: !isCargaHabil ? enrolledSections : undefined
  };
}

export async function parsePDFFile(arrayBuffer: ArrayBuffer): Promise<PDFParseResult> {
  let pdfDoc;
  // Clone ArrayBuffer so worker transfer does not detach original memory on retry
  const primaryData = new Uint8Array(arrayBuffer.slice(0));

  const getDocumentFn = (pdfjsLib as any).getDocument || (pdfjsLib as any).default?.getDocument;

  try {
    const loadingTask = getDocumentFn({
      data: primaryData,
      useSystemFonts: true,
      isEvalSupported: false,
      cMapPacked: true
    } as any);
    pdfDoc = await loadingTask.promise;
  } catch (err) {
    console.warn('Primary PDF worker loading encountered issue, trying fallback in-memory parser:', err);
    try {
      const fallbackData = new Uint8Array(arrayBuffer.slice(0));
      const fallbackTask = getDocumentFn({
        data: fallbackData,
        disableWorker: true,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
        cMapPacked: true
      } as any);
      pdfDoc = await fallbackTask.promise;
    } catch (fallbackErr) {
      console.error('All PDF parsing strategies failed:', fallbackErr);
      throw fallbackErr;
    }
  }

  const allItems: PDFTextItem[] = [];
  const metadata: MetadataInfo = {};
  let fullText = '';

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const rotation = (page as any).rotate || 0;

    const pageItems: PDFTextItem[] = [];
    textContent.items.forEach((item: any) => {
      const str = (item.str || '').trim();
      if (!str) return;
      const transform = item.transform || [1, 0, 0, 1, 0, 0];
      const rawX = transform[4];
      const rawY = transform[5];

      let x = rawX;
      let y = rawY;
      if (rotation === 90) {
        x = rawY;
        y = -rawX;
      } else if (rotation === 270) {
        x = -rawY;
        y = rawX;
      } else if (rotation === 180) {
        x = -rawX;
        y = -rawY;
      }

      const ptItem = { str, x, y, page: pageNum };
      allItems.push(ptItem);
      pageItems.push(ptItem);
    });

    // Reconstruct page text with newlines when Y-coordinate changes
    const pageSorted = [...pageItems].sort((a, b) => b.y !== a.y ? b.y - a.y : a.x - b.x);
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

  // Extract Clean Metadata header fields
  const studentMatch = fullText.match(/Alumno\s*:\s*(.+?)(?=\s*(?:Programa|Carrera|Malla|Periodo|Turno|Código|Nivel|$|\n))/i);
  if (studentMatch) {
    const fullStudentStr = studentMatch[1].replace(/\s+/g, ' ').trim();
    if (fullStudentStr.includes(' - ')) {
      const parts = fullStudentStr.split(' - ');
      metadata.studentCode = parts[0].trim();
      metadata.studentName = parts.slice(1).join(' - ').trim();
    } else {
      metadata.studentName = fullStudentStr;
    }
  }

  const programMatch = fullText.match(/Programa\s*:\s*(.+?)(?=\s*(?:Carrera|Malla|Periodo|Turno|Código|Nivel|$|\n))/i);
  if (programMatch) metadata.program = programMatch[1].replace(/\s+/g, ' ').trim();

  const majorMatch = fullText.match(/Carrera\s*:\s*(.+?)(?=\s*(?:Malla|Periodo|Turno|Código|Nivel|$|\n))/i);
  if (majorMatch) {
    const fullCarStr = majorMatch[1].replace(/\s+/g, ' ').trim();
    if (fullCarStr.includes(' - ')) {
      const parts = fullCarStr.split(' - ');
      metadata.major = parts[0].trim();
      metadata.malla = parts[1].trim();
    } else {
      metadata.major = fullCarStr;
    }
  }

  const mallaMatch = fullText.match(/Malla\s*:\s*(.+?)(?=\s*(?:Periodo|Turno|Código|Nivel|$|\n))/i);
  if (mallaMatch) metadata.malla = mallaMatch[1].replace(/\s+/g, ' ').trim();

  const semesterMatch = fullText.match(/Periodo\s*:\s*(.+?)(?=\s*(?:Turno|Código|Créditos|Nivel|$|\n))/i);
  if (semesterMatch) metadata.semester = semesterMatch[1].replace(/\s+/g, ' ').trim();

  const regMatch = fullText.match(/Turno\s*(?:de\s*Matrícula)?\s*:\s*(.+?)(?=\s*(?:Código|$|\n))/i);
  if (regMatch) metadata.registrationTime = regMatch[1].replace(/\s+/g, ' ').trim();

  // Handle Date/Time in Consolidado de Horario
  const fechaMatch = fullText.match(/Fecha\s*:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  const horaMatch = fullText.match(/Hora\s*:\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/i);
  if (fechaMatch && horaMatch && !metadata.registrationTime) {
    metadata.registrationTime = `${fechaMatch[1]} ${horaMatch[1]}`;
  }

  const isConsolidadoHorario = /consolidado\s+de\s+horario|horario\s+carga\s+h[áa]bil/i.test(fullText);
  const isConsolidadoMatricula = /consolidado\s+de\s+matr[íi]cula/i.test(fullText);

  if (isConsolidadoHorario) {
    metadata.documentType = /horario\s+carga\s+h[áa]bil/i.test(fullText) ? 'Horario Carga Hábil' : 'Consolidado de Horario';
  } else if (isConsolidadoMatricula) {
    metadata.documentType = 'Consolidado de Matrícula';
  } else {
    metadata.documentType = 'Cursos Habilitados';
  }

  if (isConsolidadoHorario || isConsolidadoMatricula) {
    const page1Items = allItems.filter(it => it.page === 1);
    const sortedP1 = [...page1Items].sort((a, b) => b.y !== a.y ? b.y - a.y : a.x - b.x);

    const progLabel = sortedP1.find(it => it.str.includes('Programa:'));
    const carLabel = sortedP1.find(it => it.str.includes('Carrera:'));
    const alumLabel = sortedP1.find(it => it.str.includes('Alumno:'));
    const fecLabel = sortedP1.find(it => it.str.includes('Fecha de Matrícula:'));
    const perLabel = sortedP1.find(it => it.str.includes('Periodo:'));
    const credLabel = sortedP1.find(it => it.str.includes('Créditos'));
    const nivLabel = sortedP1.find(it => it.str.includes('Nivel:'));

    if (progLabel && !metadata.program) {
      const pItems = sortedP1.filter(it => it.x >= 200 && it.x < 500 && it.y <= progLabel.y + 2 && it.y >= (carLabel ? carLabel.y + 2 : progLabel.y - 20));
      const val = pItems.map(i => i.str).join(' ').trim();
      if (val) metadata.program = val;
    }

    if (perLabel && !metadata.semester) {
      const pItems = sortedP1.filter(it => it.x >= 600 && it.y <= perLabel.y + 2 && it.y >= (credLabel ? credLabel.y + 2 : perLabel.y - 20));
      const val = pItems.map(i => i.str).join(' ').trim();
      if (val) metadata.semester = val;
    }

    if (carLabel && !metadata.major) {
      const cItems = sortedP1.filter(it => it.x >= 200 && it.x < 500 && it.y <= carLabel.y + 2 && it.y >= (alumLabel ? alumLabel.y + 2 : carLabel.y - 20));
      const fullCarStr = cItems.map(i => i.str).join(' ').trim();
      if (fullCarStr.includes(' - ')) {
        const parts = fullCarStr.split(' - ');
        metadata.major = parts[0].trim();
        metadata.malla = parts[1].trim();
      } else if (fullCarStr) {
        metadata.major = fullCarStr;
      }
    }

    if (credLabel) {
      const cItems = sortedP1.filter(it => it.x >= 600 && it.y <= credLabel.y + 2 && it.y >= (nivLabel ? nivLabel.y + 2 : credLabel.y - 20));
      const val = cItems.map(i => i.str).join(' ').trim();
      if (val) metadata.academicCredits = val;
    }

    if (alumLabel && !metadata.studentName) {
      const minY = fecLabel ? fecLabel.y + 1.0 : alumLabel.y - 35.0;
      const maxY = alumLabel.y + 2.0;
      const aItems = sortedP1.filter(it => it.x >= 100 && it.x < 500 && it.y <= maxY && it.y >= minY);
      const fullStudentStr = aItems.map(i => i.str).join(' ').replace(/^Alumno:\s*/i, '').trim();
      if (fullStudentStr.includes(' - ')) {
        const parts = fullStudentStr.split(' - ');
        metadata.studentCode = parts[0].trim();
        metadata.studentName = parts.slice(1).join(' - ').trim();
      } else if (fullStudentStr) {
        metadata.studentName = fullStudentStr;
      }
    }

    if (nivLabel) {
      const nItems = sortedP1.filter(it => it.x >= 600 && it.y <= nivLabel.y + 2 && it.y >= nivLabel.y - 20);
      const rawNiv = nItems.map(i => i.str).join(' ').trim();
      if (rawNiv) metadata.level = rawNiv.replace(/Fecha.*/i, '').trim();
    }

    if (fecLabel && !metadata.registrationTime) {
      const fItems = sortedP1.filter(it => it.x >= 200 && it.x < 500 && it.y <= fecLabel.y + 2 && it.y >= fecLabel.y - 20);
      const val = fItems.map(i => i.str).join(' ').trim();
      if (val) metadata.registrationTime = val;
    }

    return parseConsolidadoPDF(allItems, fullText, metadata);
  }

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
      .filter(s => s && !/^(?:AND|CD|MALLA)-\d{4}/i.test(s) && !FOOTER_DISCLAIMER_REGEX.test(s));

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
      const timeMatch = scheduleText.match(/(Lun\w*|Mar\w*|Mi[eé]\w*|Jue\w*|Vie\w*|S[aá]b\w*|Dom\w*)\.?\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/i);
      if (!timeMatch) return;

      const day = parseDayOfWeek(timeMatch[1]);

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
      const groupMatch = groupText.match(/(?:Teor[íi]a|Lab\w*|Pr[aá]c\w*|Tall\w*|Seminario|Clase|Sesión)[^\d]*\d+/i);
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
