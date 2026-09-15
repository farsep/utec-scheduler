import fs from 'fs';
import { parsePDFFile } from '../src/utils/pdfParser';

async function test() {
  const data = fs.readFileSync('CoursesLists/consolidado de matricula 2026-2 copy.pdf');
  const res = await parsePDFFile(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
  res.courses.forEach(c => {
      if (c.code === 'CS3061') {
          console.log(`- ${c.code} (${c.name}):`);
          c.sections.forEach(s => {
              console.log(`  * Sec ${s.sectionNumber}`);
              s.sessions.forEach(sess => console.log(`    - ${sess.sessionGroup} ${sess.day} ${sess.startTime}-${sess.endTime}`));
          });
      }
  });
}
test();
