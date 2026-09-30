import fs from 'fs';
import { parsePDFFile } from '../src/utils/pdfParser';

async function main() {
  const files = [
    'CoursesLists/cursos_habilitados.pdf',
    'CoursesLists/cursos habilitados keith salas.pdf',
    'CoursesLists/consolidado_horario_april_rueda.pdf'
  ];

  for (const f of files) {
    if (!fs.existsSync(f)) {
      console.log(`Skipping missing file: ${f}`);
      continue;
    }
    console.log(`\nTesting file: ${f}`);
    try {
      const buffer = fs.readFileSync(f);
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      const result = await parsePDFFile(arrayBuffer);
      console.log(`✅ Success! Found ${result.courses.length} courses.`);
      console.log(`  Document Type: ${result.metadata.documentType}`);
      if (result.courses.length > 0) {
        console.log(`  Sample course: ${result.courses[0].code} - ${result.courses[0].name}`);
        console.log(`  Professor: ${result.courses[0].sections[0].professors}`);
      }
    } catch (err) {
      console.error(`❌ Error parsing ${f}:`, err);
    }
  }
}

main();
