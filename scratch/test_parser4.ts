import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

async function dump() {
  const data = fs.readFileSync('CoursesLists/consolidado de matricula 2026-2 copy.pdf');
  const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise;
  const page = await pdfDoc.getPage(1);
  const textContent = await page.getTextContent();
  const items = textContent.items.map(it => ({
    str: (it as any).str,
    x: Math.round((it as any).transform[4]),
    y: Math.round((it as any).transform[5])
  }));
  fs.writeFileSync('scratch/dump.json', JSON.stringify(items, null, 2));
}
dump();
