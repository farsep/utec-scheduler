import fs from 'fs';
import { extractTextFromPDF } from './pdfParserLocal';

async function test() {
  try {
    const data = fs.readFileSync('CoursesLists/consolidado de matricula 2026-2 copy.pdf');
    const { sortedItems, courseAnchors } = await extractTextFromPDF(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
    
    const anchor = courseAnchors.find(a => a.code === 'CC1103');
    if (!anchor) return console.log("Not found anchor");

    const blockItems = sortedItems.filter(it => 
      it.page === anchor.page &&
      it.y <= anchor.topY + 15 && it.y > anchor.topY - 45
    );
    console.log("Blocks for CC1103:");
    blockItems.forEach(it => console.log(`x: ${Math.round(it.x)}, y: ${Math.round(it.y)}, str: ${it.str}`));
  } catch(e) {
    console.error(e);
  }
}
test();
