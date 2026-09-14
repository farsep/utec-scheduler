import { readFileSync } from 'fs';
const file = readFileSync('wasm-engine/src/lib.rs', 'utf8');
console.log(file.match(/pub struct GeneratedScheduleResultRust \{[^}]+\}/)[0]);
