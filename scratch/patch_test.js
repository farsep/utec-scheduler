const fs = require('fs');
let code = fs.readFileSync('scratch/test_parser.ts', 'utf-8');
code = code.replace(/console\.log\("Extracted courses for Matricula/g, 'console.log("Metadata:", res2.metadata); console.log("Extracted courses for Matricula');
fs.writeFileSync('scratch/test_parser.ts', code);
