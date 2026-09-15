const xlsx = require('xlsx');
const wb = xlsx.readFile('./CoursesLists/Consulta_Horario-202520128.xlsx');
const sheet = wb.Sheets[wb.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

// Find header row
let headerIdx = data.findIndex(row => row.includes('Código Curso'));
if (headerIdx === -1) headerIdx = 0;
const headers = data[headerIdx];

const quimica = data.slice(headerIdx + 1).filter(r => r[headers.indexOf('Código Curso')] === 'CC1141');

console.log("Seccion | Sesión Grupo | Vacantes");
console.log("---------------------------------");
quimica.forEach(r => {
  console.log(`${r[headers.indexOf('Sección')]}       | ${r[headers.indexOf('Sesión Grupo')]}   | ${r[headers.indexOf('Vacantes')]}`);
});
