import fs from 'fs';
import { parsePDFFile } from '../src/utils/pdfParser';

async function test() {
  const data = fs.readFileSync('CoursesLists/cursos_habilitados.pdf');
  const res = await parsePDFFile(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
  
  const electivos = res.courses.filter(c => c.courseType === 'Electivo');
  const obligatorios = res.courses.filter(c => c.courseType === 'Obligatorio');
  console.log(`Electivos: ${electivos.length}, Obligatorios: ${obligatorios.length}`);
}
test();
