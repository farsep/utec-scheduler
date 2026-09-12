import { readFileSync } from 'fs';
import { parsePDFFile } from './src/utils/pdfParser.ts';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
(globalThis as any).pdfjsLib = pdfjsLib;
async function test() {
  const buf = readFileSync('CoursesLists/cursos_habilitados.pdf');
  await parsePDFFile(buf.buffer);
}
test().catch(console.error);
