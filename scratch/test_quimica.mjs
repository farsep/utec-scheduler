import * as xlsx from 'xlsx';

const workbook = xlsx.readFile('public/samples/Consulta_Horario.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(sheet);

console.log("Looking for Química General (CC1141)...");
const quimica = data.filter(r => r['Código Curso'] === 'CC1141');
quimica.forEach(r => {
  console.log(`Seccion: ${r['Sección']}, Grupo: ${r['Sesión Grupo']}, Vacantes: ${r['Vacantes']}`);
});
