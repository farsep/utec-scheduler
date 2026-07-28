import { parseExcelFile, type ExcelParseResult } from './excelParser';

export async function loadDefaultSampleData(): Promise<ExcelParseResult> {
  try {
    const excelResp = await fetch('/samples/Consulta_Horario.xlsx');
    if (!excelResp.ok) throw new Error('Failed to load sample Excel file');
    const excelBuffer = await excelResp.arrayBuffer();
    return parseExcelFile(excelBuffer);
  } catch (err) {
    console.error('Error loading sample Excel data:', err);
    return {
      courses: [],
      metadata: {}
    };
  }
}
