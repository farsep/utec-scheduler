import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function test() {
  const data = new Uint8Array(fs.readFileSync('CoursesLists/cursos_habilitados.pdf'));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const numPages = pdf.numPages;
  
  const allItems = [];
  let fullText = "";
  
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    content.items.forEach(item => {
       allItems.push({
         str: item.str,
         x: item.transform[4],
         y: item.transform[5],
         page: i
       });
       fullText += item.str + " ";
    });
  }
  
  // Find all items around Y of DS3021
  // Just dump items for one row
  const rowItems = allItems.filter(it => it.page === 1 && it.y > 600 && it.y < 700);
  rowItems.sort((a,b) => b.y !== a.y ? b.y - a.y : a.x - b.x);
  
  let currentY = -1;
  let line = "";
  for(const it of rowItems) {
     if(Math.abs(it.y - currentY) > 5) {
        console.log(line);
        line = "";
        currentY = it.y;
     }
     line += `[x:${it.x.toFixed(1)} ${it.str}] `;
  }
  console.log(line);
}

test().catch(console.error);
