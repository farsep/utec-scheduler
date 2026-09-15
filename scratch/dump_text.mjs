import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function test() {
  const data = new Uint8Array(fs.readFileSync('CoursesLists/cursos_habilitados.pdf'));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let txt = '';
    content.items.forEach(item => {
      if ('str' in item) txt += item.str + ' ';
    });
    console.log(txt.toLowerCase().includes('electi'));
  }
}
test();
