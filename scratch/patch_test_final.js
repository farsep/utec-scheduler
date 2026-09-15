const fs = require('fs');
let code = fs.readFileSync('scratch/test_parser.ts', 'utf-8');
code = code.replace(/console\.log\("Extracted courses for Horario:.*?\);/s, 'console.log("Extracted courses:", res1.courses.map(c => ({ name: c.name, credits: c.credits }))); console.log("Calculated Metadata Credits:", res1.metadata.academicCredits);');
fs.writeFileSync('scratch/test_parser.ts', code);
