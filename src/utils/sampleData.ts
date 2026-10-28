import type { ExcelParseResult } from './excelParser';
import { getSampleScheduleData } from './masterDataLoader';

export async function loadDefaultSampleData(): Promise<ExcelParseResult> {
  try {
    const sample = await getSampleScheduleData();
    return {
      courses: sample.courses,
      metadata: {
        ...sample.metadata,
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
