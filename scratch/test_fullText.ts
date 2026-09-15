import fs from 'fs';
import { parsePDFFile } from '../src/utils/pdfParser';

async function test() {
  const data = fs.readFileSync('CoursesLists/consolidado de matricula 2026-2 copy.pdf');
  const res = await parsePDFFile(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
  console.log(res.extractedText);
}
test();
