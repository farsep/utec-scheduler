const fs = require('fs');
let code = fs.readFileSync('scratch/pdfParserLocal.ts', 'utf-8');
code = code.replace(/matchedAnchor = pageAnchors\.find\(\(anchor, idx\) => \{([\s\S]*?)return se\.startY <= topBound && se\.startY > bottomBound;\n\s*\}\);/,
`matchedAnchor = pageAnchors.find((anchor, idx) => {
  $1
  const matches = se.startY <= topBound && se.startY > bottomBound;
  console.log("Checking anchor:", anchor.code, "topY:", anchor.topY, "se.startY:", se.startY, "topBound:", topBound, "bottomBound:", bottomBound, "matches:", matches);
  return matches;
});
if (matchedAnchor) console.log("Matched anchor:", matchedAnchor.code);
else console.log("NO ANCHOR MATCHED FOR", se.startY);
`);
fs.writeFileSync('scratch/pdfParserLocal.ts', code);
