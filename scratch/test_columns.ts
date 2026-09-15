import fs from 'fs';
import { parsePDFFile } from './pdfParserLocal';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

async function test() {
  const data1 = fs.readFileSync('CoursesLists/consolidado_horario_april_rueda.pdf');
  const pdfDoc = await pdfjsLib.getDocument({
    data: new Uint8Array(data1),
    useSystemFonts: true,
    isEvalSupported: false,
    cMapPacked: true
  }).promise;
  const page = await pdfDoc.getPage(1);
  const textContent = await page.getTextContent();
  const items = textContent.items.map(it => {
      const transform = it.transform || [1,0,0,1,0,0];
      return { str: it.str, x: transform[4], y: transform[5] };
  });
  
  // Find "Álgebra Lineal"
  const alg = items.find(i => i.str.includes("Lineal"));
  if (alg) {
    console.log("Álgebra Lineal is at Y:", alg.y);
    const rowItems = items.filter(i => Math.abs(i.y - alg.y) < 15).sort((a,b) => a.x - b.x);
    console.log("Row items:");
    rowItems.forEach(r => console.log(`X: ${r.x.toFixed(2)} - Str: '${r.str}'`));
  }
}
test().catch(console.error);
