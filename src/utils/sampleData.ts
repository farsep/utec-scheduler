import { parseExcelFile, type ExcelParseResult } from './excelParser';

export async function loadDefaultSampleData(): Promise<ExcelParseResult> {
  try {
    const excelResp = await fetch('/samples/Consulta_Horario.xlsx');
    if (!excelResp.ok) throw new Error('Failed to load sample Excel file');
    const excelBuffer = await excelResp.arrayBuffer();
    const result = parseExcelFile(excelBuffer);
    return {
      ...result,
      metadata: {
        ...result.metadata,
        studentName: 'Farid Espinoza',
        major: 'Ciencia de Datos',
        program: 'Pregrado',
        malla: 'CD-2021-1',
        semester: '2026 - 2',
        registrationTime: '31/07/2026 03:00 pm'
      }
    };
  } catch (err) {
    console.error('Error loading sample Excel data:', err);
    return {
      courses: [],
      metadata: {
        studentName: 'Farid Espinoza',
        major: 'Ciencia de Datos',
        program: 'Pregrado',
        malla: 'CD-2021-1',
        semester: '2026 - 2',
        registrationTime: '31/07/2026 03:00 pm'
      }
    };
  }
}
