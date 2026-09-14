import { readFileSync } from 'fs';
const content = readFileSync('src/utils/scheduleWorker.ts', 'utf8');
console.log(content.includes('console.log("Input to Rust:", finalCourseSet);'));
