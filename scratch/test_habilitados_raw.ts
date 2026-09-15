import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist';

async function test() {
  const data = new Uint8Array(fs.readFileSync('CoursesLists/cursos_habilitados.pdf'));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  content.items.forEach(item => {
    if ('str' in item && item.transform[4] > 280 && item.transform[4] < 450) {
       console.log(item.str, item.transform[4].toFixed(2), item.transform[5].toFixed(2));
    }
  });
}
test();
