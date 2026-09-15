import fs from 'fs';
import { parsePDFFile } from '../src/utils/pdfParser';

async function test() {
  const data = fs.readFileSync('CoursesLists/cursos_habilitados.pdf');
  const res = await parsePDFFile(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
  
  console.log('metadata:', res.metadata);
}
test();
