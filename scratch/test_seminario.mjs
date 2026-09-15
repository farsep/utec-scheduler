import * as xlsx from 'xlsx';

const workbook = xlsx.readFile('public/samples/Consulta_Horario.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(sheet);

let found = false;
for (const row of data) {
  for (const key of Object.keys(row)) {
    const val = String(row[key]).toLowerCase();
    if (val.includes('seminario')) {
      console.log('Found seminario:', row);
      found = true;
    }
  }
}

if (!found) {
  console.log('No seminario found in Excel file.');
}
