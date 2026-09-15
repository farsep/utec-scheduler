const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

async function dump() {
  const data = fs.readFileSync('CoursesLists/consolidado de matricula 2026-2 copy.pdf');
  const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise;
  const items = [];
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    textContent.items.forEach(it => {
        items.push({
            str: it.str,
            x: Math.round(it.transform[4]),
            y: Math.round(it.transform[5]),
            page: pageNum
        });
    });
  }
  fs.writeFileSync('scratch/dump_all.json', JSON.stringify(items, null, 2));
}
dump();
