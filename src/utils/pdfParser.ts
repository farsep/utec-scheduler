import * as pdfjsLib from 'pdfjs-dist';
import type { Course, Section, Session, MetadataInfo, DayOfWeek } from '../types/schedule';
import { parseSessionType, getCourseColor, timeToMinutes, formatLocation, parseDayOfWeek } from './scheduleUtils';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '4.0.379'}/build/pdf.worker.min.mjs`;
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

function parseConsolidadoPDF(allItems: PDFTextItem[], fullText: string, metadata: MetadataInfo): PDFParseResult {
  metadata.isConsolidado = true;
  const sortedItems = [...allItems].sort((a, b) => (b.page !== a.page ? a.page - b.page : b.y !== a.y ? b.y - a.y : a.x - b.x));

  // Determine layout: check header x position of Sección or document title
  const isHorarioLayout = /consolidado\s+de\s+horario/i.test(fullText) || sortedItems.some(it => (it.str === 'Sección' || it.str === 'SECCIÓN') && it.x > 500);

  // Find course code anchors at x ~ 72 (65 <= x <= 95)
  const courseAnchors: { code: string; page: number; topY: number }[] = [];

  sortedItems.forEach((item) => {
    if (item.x >= 65 && item.x <= 95 && /^[A-Z]{2,4}\d{2}$/.test(item.str)) {
      let fullCode = item.str;
      const suffixItem = sortedItems.find(it => it.page === item.page && it.x >= 65 && it.x <= 95 && /^\d{2}$/.test(it.str) && item.y - it.y > 0 && item.y - it.y <= 16.0);
      if (suffixItem) {
        fullCode = item.str + suffixItem.str;
      }
      courseAnchors.push({ code: fullCode, page: item.page, topY: item.y });
    } else if (item.x >= 65 && item.x <= 95 && /^[A-Z]{2,4}\d{4}$/.test(item.str)) {
      courseAnchors.push({ code: item.str, page: item.page, topY: item.y });
    }
  });

  const eligibleCourseCodes = new Set<string>();
  const eligibleCoursesMap = new Map<string, { type: string; plan?: string }>();
  const enrolledSections: Record<string, string> = {};

  interface CourseBuildData {
    code: string;
    name: string;
    sectionNum: string;
    subGroup: string;
    secLabel: string;
    professor: string;
    page: number;
    topY: number;
    sessions: Session[];
  }

  const coursesMap = new Map<string, CourseBuildData>();

  courseAnchors.forEach((anchor, idx) => {
    const nextAnchor = courseAnchors.find((na, nidx) => nidx > idx && na.page === anchor.page);
    const bottomY = nextAnchor ? nextAnchor.topY : -9999;

    const blockItems = sortedItems.filter(it => it.page === anchor.page && it.y <= anchor.topY + 15.0 && it.y > bottomY + 5.0);

    const nameMaxX = isHorarioLayout ? 225 : 260;
    const nameItems = blockItems
      .filter(it => it.x >= 100 && it.x < nameMaxX)
      .map(it => it.str)
      .filter(s => !/^(?:Obligatorio|Electivo)$/i.test(s));
    const courseName = nameItems.join(' ').replace(/^(?:[0-9]|-)\s*/, '').trim() || `Curso ${anchor.code}`;

    let professor = 'Por asignar';
    if (isHorarioLayout) {
      const profItems = blockItems.filter(it => it.x >= 250 && it.x < 380).map(it => it.str);
      if (profItems.length > 0) {
        professor = profItems.join(' ').replace(/,$/, '').trim();
      }
    }

    let sectionNum = '1';
    let subGroup = '';

    if (isHorarioLayout) {
      const secItems = blockItems.filter(it => it.x >= 530 && it.x < 585).map(it => it.str);
      const secMatch = secItems.join(' ').match(/\d+/);
      sectionNum = secMatch ? secMatch[0] : '1';

      const subItems = blockItems.filter(it => it.x >= 585 && it.x < 620).map(it => it.str).join(' ');
      const subMatch = subItems.match(/(?:Lab\.|Prac\.|Tall\.)\s*\d+|\b\d{2}\b/i);
      if (subMatch) {
        const matchedStr = subMatch[0];
        subGroup = /^\d{2}$/.test(matchedStr) ? `Lab. ${matchedStr}` : matchedStr;
      }
    } else {
      const secItems = blockItems.filter(it => it.x >= 430 && it.x < 480).map(it => it.str);
      const secMatch = secItems.join(' ').match(/\d+/);
      sectionNum = secMatch ? secMatch[0] : '1';

      const subItems = blockItems.filter(it => it.x >= 480 && it.x < 580).map(it => it.str).join(' ');
      const subMatch = subItems.match(/(?:Lab\.|Prac\.|Tall\.)\s*\d+|\b\d{2}\b/i);
      if (subMatch) {
        const matchedStr = subMatch[0];
        subGroup = /^\d{2}$/.test(matchedStr) ? `Lab. ${matchedStr}` : matchedStr;
      }
    }

    const secLabel = subGroup ? `${sectionNum} (${subGroup})` : sectionNum;
    enrolledSections[anchor.code] = secLabel;
    eligibleCourseCodes.add(anchor.code);
    eligibleCoursesMap.set(anchor.code, { type: 'Obligatorio' });

    coursesMap.set(anchor.code, {
      code: anchor.code,
      name: courseName,
      sectionNum,
      subGroup,
      secLabel,
      professor,
      page: anchor.page,
      topY: anchor.topY,
      sessions: []
    });
  });

  // Sort anchors per page strictly descending by Y coordinate
  courseAnchors.sort((a, b) => (b.page !== a.page ? a.page - b.page : b.topY - a.topY));

  // Extract sessions per page
  const pageNumbers = Array.from(new Set(sortedItems.map(it => it.page)));

  pageNumbers.forEach(pageNum => {
    const pageAnchors = courseAnchors.filter(ca => ca.page === pageNum);
    if (pageAnchors.length === 0) return;

    const schedItems = sortedItems.filter(it => it.page === pageNum && it.x >= 600);

    const sessionEntries: { tokens: string[]; startY: number }[] = [];
    let currentEntry: { tokens: string[]; startY: number } | null = null;

    schedItems.forEach(it => {
      if (it.str === 'Semana' || it.str.startsWith('Semana')) {
        if (currentEntry) sessionEntries.push(currentEntry);
        currentEntry = { tokens: [it.str], startY: it.y };
      } else if (currentEntry) {
        if (currentEntry.startY - it.y <= 30.0) {
          currentEntry.tokens.push(it.str);
        } else {
          sessionEntries.push(currentEntry);
          currentEntry = { tokens: [it.str], startY: it.y };
        }
      }
    });
    if (currentEntry) sessionEntries.push(currentEntry);

    sessionEntries.forEach(se => {
      const fullStr = se.tokens.join(' ');
      const sessMatch = fullStr.match(/Semana\s+General\s+(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo|Lun\.?|Mar\.?|Mié\.?|Jue\.?|Vie\.?|Sáb\.?)\s+(Teoría|Laboratorio|Práctica|Taller|Teoria)\s*(Virtual)?\s*:?\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*(.*)/i);
      if (sessMatch) {
        let matchedAnchor: { code: string; page: number; topY: number } | undefined;

        if (isHorarioLayout) {
          // In Consolidado de Horario, each course anchor is at the top of its row block.
          // A session belongs to an anchor if it lies within the row's vertical bounds.
          matchedAnchor = pageAnchors.find((anchor, idx) => {
            const nextAnchor = pageAnchors.find((na, nidx) => nidx > idx);
            const topBound = anchor.topY + 15.0;
            const bottomBound = nextAnchor ? nextAnchor.topY + 2.0 : -99999;
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
          const cData = coursesMap.get(matchedAnchor.code);
          if (cData) {
            const day = parseDayOfWeek(sessMatch[1]);

            const groupType = sessMatch[2];
            const isVirtual = Boolean(sessMatch[3]) || /virtual/i.test(sessMatch[6] || '');
            const startTime = sessMatch[4].padStart(5, '0');
            const endTime = sessMatch[5].padStart(5, '0');
            const rawLoc = sessMatch[6] ? sessMatch[6].replace(/\s*\b\d+$/, '').trim() : (isVirtual ? 'Virtual' : '');
            const location = formatLocation(rawLoc);

            const startMinutes = timeToMinutes(startTime);
            const endMinutes = timeToMinutes(endTime);

            cData.sessions.push({
              id: `${cData.code}-${cData.sectionNum}-${groupType}-${day}-${startTime}-${cData.sessions.length}`,
              sessionGroup: groupType.toUpperCase(),
              sessionType: parseSessionType(groupType),
              modality: isVirtual ? 'Sincronico' : 'Presencial',
              day,
              startTime,
              endTime,
              startMinutes,
              endMinutes,
              frequency: 'Semana General',
              location: location || (isVirtual ? 'Virtual' : 'Por asignar'),
              vacancies: 30,
              enrolled: 0,
              professor: cData.professor || 'Por asignar',
              email: ''
            });
          }
        }
      }
    });
  });

  const finalCourses: Course[] = Array.from(coursesMap.values()).map(cData => ({
    code: cData.code,
    name: cData.name,
    sections: [
      {
        sectionNumber: cData.secLabel,
        sessions: cData.sessions,
        vacancies: 30,
        enrolled: 0,
        professors: [cData.professor || 'Por asignar']
      }
    ],
    color: getCourseColor(cData.code),
    isEligible: true,
    courseType: 'Obligatorio'
  }));

  return {
    courses: finalCourses,
    eligibleCourseCodes,
    eligibleCoursesMap,
    extractedText: fullText,
    metadata,
    isConsolidado: true,
    enrolledSections
  };
}

export async function parsePDFFile(arrayBuffer: ArrayBuffer): Promise<PDFParseResult> {
  let pdfDoc;
  try {
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    pdfDoc = await loadingTask.promise;
  } catch (err) {
    console.error('Error loading PDF document with worker, trying fallback:', err);
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer), isEvalSupported: false } as any);
    pdfDoc = await loadingTask.promise;
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

  if (/consolidado\s+de\s+(?:matr[íi]cula|horario)/i.test(fullText)) {
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
