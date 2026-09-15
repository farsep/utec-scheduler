import fs from 'fs';
import * as xlsx from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Load window for browser-like env
globalThis.window = {};

async function parsePDF(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const numPages = pdf.numPages;
  const allItems = [];
  let fullText = "";
  
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    content.items.forEach(item => {
       allItems.push({
         str: item.str,
         x: item.transform[4],
         y: item.transform[5],
         page: i
       });
       fullText += item.str + " ";
    });
  }
  
  const { parseConsolidadoPDF } = await import('./src/utils/pdfParser.ts');
  return parseConsolidadoPDF(allItems, fullText, {});
}

async function parseExcel(excelPath) {
  const workbook = xlsx.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  
  const { parseExcelSchedule } = await import('./src/utils/excelParser.ts');
  return parseExcelSchedule(rawData);
}

async function run() {
  console.log("Parsing PDF...");
  const pdfResult = await parsePDF('CoursesLists/cursos_habilitados.pdf');
  console.log("Parsing Excel...");
  const excelResult = await parseExcel('CoursesLists/Consulta_Horario-202520128.xlsx');
  
  const pdfCourses = new Set(pdfResult.courses.map(c => c.code));
  const excelCourses = new Set(excelResult.courses.map(c => c.code));
  
  console.log(`PDF unique courses: ${pdfCourses.size}`);
  console.log(`Excel unique courses: ${excelCourses.size}`);
  
  let matchCount = 0;
  for (const c of excelCourses) {
    if (pdfCourses.has(c)) {
       matchCount++;
       // Compare sections and sessions count
       const eCourse = excelResult.courses.find(x => x.code === c);
       const pCourse = pdfResult.courses.find(x => x.code === c);
       
       if (eCourse.rawSessions.length !== pCourse.rawSessions.length) {
         console.log(`Course ${c}: PDF has ${pCourse.rawSessions.length} sessions, Excel has ${eCourse.rawSessions.length} sessions.`);
       }
    } else {
       console.log(`Course ${c} missing in PDF`);
    }
  }
  
  console.log(`Matches: ${matchCount}`);
}

run().catch(console.error);
