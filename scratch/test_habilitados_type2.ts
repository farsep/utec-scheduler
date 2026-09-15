import fs from 'fs';
import { parsePDFFile } from '../src/utils/pdfParser';

async function test() {
  const data = fs.readFileSync('CoursesLists/cursos_habilitados.pdf');
  const res = await parsePDFFile(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
  
  const electivos = res.courses.filter(c => c.courseType === 'Electivo');
  console.log('Electivos:', electivos.length);
  if (electivos.length > 0) {
     console.log(electivos.map(c => c.code));
  }
}
test();
