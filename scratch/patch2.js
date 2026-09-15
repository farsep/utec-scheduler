const fs = require('fs');
let code = fs.readFileSync('scratch/pdfParserLocal.ts', 'utf-8');
code = code.replace(/if \(isHorarioLayout && se\.items\.length >= 2\) \{/,
`if (isHorarioLayout && se.items.length >= 2) {
          const expectedLocationItem = se.items[se.items.length - 1];
          console.log("expectedLocationItem.str:", expectedLocationItem?.str, "expectedLocationItem.x:", expectedLocationItem?.x, "isValid:", expectedLocationItem && expectedLocationItem.x >= 700);`);
fs.writeFileSync('scratch/pdfParserLocal.ts', code);
