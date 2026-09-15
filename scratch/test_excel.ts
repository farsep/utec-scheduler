import fs from 'fs';
import { parseExcelFile } from '../src/utils/excelParser';

async function test() {
  const data = fs.readFileSync('CoursesLists/Consulta_Horario-202520128.xlsx');
  const res = await parseExcelFile(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
  res.courses.forEach(c => {
      if (['CC1103', 'HH5101'].includes(c.code)) {
          console.log(`- ${c.code} (${c.name}):`);
          c.sections.forEach(s => {
              console.log(`  * Sec ${s.sectionNumber}`);
              s.sessions.forEach(sess => console.log(`    - ${sess.sessionGroup}`));
          });
      }
  });
}
test();
