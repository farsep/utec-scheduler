import fs from 'fs';
import path from 'path';
import { parseExcelFile } from '../src/utils/excelParser';
import { processRawCoursesIntoDirectory, mutuallyEnrichCoursesWithScrapedData } from '../src/utils/courseDirectoryUtils';
import { extractProfessorsFromCourses } from '../src/utils/professorUtils';

async function main() {
  console.log('Building pre-compiled courses and professors catalog...');
  const excelPath = path.join(process.cwd(), 'public/samples/Consulta_Horario.xlsx');
  const buffer = fs.readFileSync(excelPath);
  
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const parseResult = parseExcelFile(arrayBuffer);
  console.log(`Parsed ${parseResult.courses.length} courses from Excel.`);

  let enrichedCourses = parseResult.courses;
  const intranetPath = path.join(process.cwd(), 'public/data/classrooms_intranet.json');
  if (fs.existsSync(intranetPath)) {
    const liveData = JSON.parse(fs.readFileSync(intranetPath, 'utf-8'));
    if (Array.isArray(liveData.classrooms) && liveData.classrooms.length > 0) {
      enrichedCourses = mutuallyEnrichCoursesWithScrapedData(parseResult.courses, liveData.classrooms);
      console.log('Enriched with classrooms intranet data.');
    }
  }

  // 1. Pre-processed Course Directory Info
  const coursesDirectory = processRawCoursesIntoDirectory(enrichedCourses);
  const outCoursesPath = path.join(process.cwd(), 'public/data/courses_catalog.json');
  fs.writeFileSync(outCoursesPath, JSON.stringify(coursesDirectory));
  console.log(`Wrote ${coursesDirectory.length} courses to ${outCoursesPath} (${(fs.statSync(outCoursesPath).size / 1024).toFixed(1)} KB)`);

  // 2. Pre-processed Professors Directory Info
  const professorsDirectory = extractProfessorsFromCourses(enrichedCourses);
  const outProfessorsPath = path.join(process.cwd(), 'public/data/professors_catalog.json');
  fs.writeFileSync(outProfessorsPath, JSON.stringify(professorsDirectory));
  console.log(`Wrote ${professorsDirectory.length} professors to ${outProfessorsPath} (${(fs.statSync(outProfessorsPath).size / 1024).toFixed(1)} KB)`);

  // 3. Raw Enriched Courses (for ScheduleApp sample data)
  const outEnrichedPath = path.join(process.cwd(), 'public/data/enriched_courses.json');
  fs.writeFileSync(outEnrichedPath, JSON.stringify({ courses: enrichedCourses, metadata: parseResult.metadata }));
  console.log(`Wrote enriched courses sample to ${outEnrichedPath} (${(fs.statSync(outEnrichedPath).size / 1024).toFixed(1)} KB)`);
}

main().catch(console.error);
