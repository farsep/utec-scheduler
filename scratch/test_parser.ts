import fs from 'fs';
import { parsePDFFile } from './pdfParserLocal';

async function test() {
  try {
    console.log("Testing consolidado_horario_april_rueda.pdf...");
    const data1 = fs.readFileSync('CoursesLists/consolidado_horario_april_rueda.pdf');
    const res1 = await parsePDFFile(data1.buffer.slice(data1.byteOffset, data1.byteOffset + data1.byteLength) as ArrayBuffer);
    console.log("Metadata:", res1.metadata); console.log("Extracted courses for Horario:", res1.courses.map(c => c.name));
    console.log("Sessions for Algebra:", JSON.stringify(res1.courses.find(c => c.code === "CC1103")?.sections[0]?.sessions, null, 2));
    
    console.log("\nTesting consolidado de matricula 2026-2 copy.pdf...");
    const data2 = fs.readFileSync('CoursesLists/consolidado de matricula 2026-2 copy.pdf');
    const res2 = await parsePDFFile(data2.buffer.slice(data2.byteOffset, data2.byteOffset + data2.byteLength) as ArrayBuffer);
    console.log("Metadata Matricula:", res2.metadata);
    console.log("Extracted courses for Matricula:", JSON.stringify(res2.courses, null, 2));
  } catch (e) {
    console.error("ERROR CAUGHT:");
    console.error(e);
  }
}
test();
