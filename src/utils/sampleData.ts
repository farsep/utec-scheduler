import { parseExcelFile, type ExcelParseResult } from './excelParser';
import { parsePDFFile } from './pdfParser';

export async function loadDefaultSampleData(): Promise<ExcelParseResult> {
  try {
    const excelResp = await fetch('/samples/Consulta_Horario.xlsx');
    if (!excelResp.ok) throw new Error('Failed to load sample Excel file');
    const excelBuffer = await excelResp.arrayBuffer();
    const excelData = parseExcelFile(excelBuffer);

    try {
      const pdfResp = await fetch('/samples/cursos_habilitados.pdf');
      if (pdfResp.ok) {
        const pdfBuffer = await pdfResp.arrayBuffer();
        const pdfData = await parsePDFFile(pdfBuffer);

        // Mark eligible courses in Excel data
        excelData.courses.forEach(course => {
          if (pdfData.eligibleCourseCodes.has(course.code)) {
            course.isEligible = true;
            const extra = pdfData.eligibleCoursesMap.get(course.code);
            if (extra) {
              course.courseType = extra.type;
              course.plan = extra.plan;
            }
          } else {
            course.isEligible = false;
          }
        });
      }
    } catch (e) {
      console.warn('Could not parse default PDF sample:', e);
    }

    return excelData;
  } catch (err) {
    console.error('Error loading sample data:', err);
    return {
      courses: [],
      metadata: {}
    };
  }
}
