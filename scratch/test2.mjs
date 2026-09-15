import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function test() {
  const data = new Uint8Array(fs.readFileSync('CoursesLists/cursos_habilitados.pdf'));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const numPages = pdf.numPages;
  
  let allLines = [];
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    
    // Sort items roughly by Y then X
    const items = content.items.sort((a,b) => b.transform[5] !== a.transform[5] ? b.transform[5] - a.transform[5] : a.transform[4] - b.transform[4]);
    
    let currentY = -1;
    let line = "";
    for(const it of items) {
       if(Math.abs(it.transform[5] - currentY) > 5) {
          if (line.includes("CC1103")) {
             allLines.push(line);
          } else if (allLines.length > 0 && allLines.length < 10) {
             // print the next few lines after CC1103
             allLines.push(line);
          }
          if (allLines.length >= 10) break;
          line = "";
          currentY = it.transform[5];
       }
       line += ` ${it.str}`;
    }
    if (allLines.length >= 10) break;
  }
  
  allLines.forEach(l => console.log(l));
}

test().catch(console.error);
