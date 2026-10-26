import fs from 'fs';
import path from 'path';
import { parseExcelFile } from '../src/utils/excelParser';
import type { ClassroomInfo, ClassroomSession } from '../src/types/classroom';

function formatNaturalName(rawName: string): string {
  if (!rawName) return '';
  const parts = rawName.split(',');
  if (parts.length === 2) {
    const lastnames = parts[0].trim();
    const firstnames = parts[1].trim();
    return `${firstnames} ${lastnames}`.replace(/\s+/g, ' ');
  }
  return rawName.trim();
}

function cleanStr(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

const STOP_WORDS = new Set(['de', 'los', 'del', 'la', 'las', 'el', 'san', 'santa']);

export function areNamesCompatible(intranetName: string, excelNaturalName: string): boolean {
  if (!intranetName || !excelNaturalName) return false;
  const cInt = cleanStr(formatNaturalName(intranetName));
  const cExc = cleanStr(formatNaturalName(excelNaturalName));
  if (cInt === cExc) return true;

  const intWords = cInt.split(/\s+/).filter(w => w.length > 1 && !STOP_WORDS.has(w));
  const excWords = cExc.split(/\s+/).filter(w => w.length > 1 && !STOP_WORDS.has(w));

  if (intWords.length === 0 || excWords.length === 0) return false;

  // In Spanish names, the last word of intranetName is the primary surname (e.g. "Sanchez", "Hoyos", "Torres")
  const surname = intWords[intWords.length - 1];
  const surnameMatches = excWords.some(ew => ew === surname || ew.startsWith(surname) || surname.startsWith(ew));
  if (!surnameMatches) {
    return false; // The surname MUST match
  }

  // If there are given names, at least one given name must also match
  if (intWords.length >= 2) {
    const givenNames = intWords.slice(0, -1);
    const givenMatches = givenNames.some(gw =>
      excWords.some(ew => ew === gw || ew.startsWith(gw) || gw.startsWith(ew))
    );
    return givenMatches;
  }

  return true;
}

interface ProfEnrichment {
  raw: string; // e.g. "Sanchez Perez, Luz de los Angeles"
  natural: string; // e.g. "Luz de los Angeles Sanchez Perez"
  email: string;
  vacancies: number;
  enrolled: number;
}

export function buildExcelLookup(excelPath: string) {
  const excelBuffer = fs.readFileSync(excelPath);
  const parsed = parseExcelFile(excelBuffer.buffer);

  const csdMap = new Map<string, ProfEnrichment>();
  const csMap = new Map<string, ProfEnrichment>();
  const courseProfsMap = new Map<string, ProfEnrichment[]>();
  const uniqueProfs: ProfEnrichment[] = [];
  const seenProfs = new Set<string>();

  for (const c of parsed.courses) {
    for (const s of c.sections) {
      const secNorm = String(parseInt(s.sectionNumber, 10) || s.sectionNumber).trim();
      for (const sess of s.sessions) {
        if (!sess.professor) continue;
        const natural = formatNaturalName(sess.professor);
        const item: ProfEnrichment = {
          raw: sess.professor.trim(),
          natural,
          email: sess.email || '',
          vacancies: sess.vacancies || 0,
          enrolled: sess.enrolled || 0
        };

        const csdKey = `${c.code.toUpperCase()}::${secNorm}::${sess.day}`;
        if (!csdMap.has(csdKey)) csdMap.set(csdKey, item);

        const csKey = `${c.code.toUpperCase()}::${secNorm}`;
        if (!csMap.has(csKey)) csMap.set(csKey, item);

        if (!courseProfsMap.has(c.code.toUpperCase())) {
          courseProfsMap.set(c.code.toUpperCase(), []);
        }
        courseProfsMap.get(c.code.toUpperCase())!.push(item);

        if (!seenProfs.has(natural)) {
          seenProfs.add(natural);
          uniqueProfs.push(item);
        }
      }
    }
  }

  function findBestMatch(sess: ClassroomSession, day: string): ProfEnrichment | null {
    const p = (sess.professor || '').trim();
    const isGeneric = !p || /docente/i.test(p) || /reserva/i.test(p);
    const secNorm = String(parseInt(sess.sectionNumber, 10) || sess.sectionNumber).trim();
    const csdKey = `${sess.courseCode.toUpperCase()}::${secNorm}::${day}`;
    const csKey = `${sess.courseCode.toUpperCase()}::${secNorm}`;

    // 1. Exact Course + Section + Day
    if (csdMap.has(csdKey)) {
      const candidate = csdMap.get(csdKey)!;
      if (isGeneric || areNamesCompatible(p, candidate.natural)) {
        return candidate;
      }
    }

    // 2. Exact Course + Section
    if (csMap.has(csKey)) {
      const candidate = csMap.get(csKey)!;
      if (isGeneric || areNamesCompatible(p, candidate.natural)) {
        return candidate;
      }
    }

    // 3. Same Course, other sections (compatible name)
    if (courseProfsMap.has(sess.courseCode.toUpperCase())) {
      const candidates = courseProfsMap.get(sess.courseCode.toUpperCase())!;
      const match = candidates.find(c => areNamesCompatible(p, c.natural));
      if (match) return match;
    }

    // 4. Global search across all professors in Excel
    if (!isGeneric) {
      const globalMatches = uniqueProfs.filter(c => areNamesCompatible(p, c.natural));
      if (globalMatches.length > 0) {
        return globalMatches[0];
      }
    }

    return null;
  }

  return { findBestMatch, uniqueProfsCount: uniqueProfs.length };
}

export function enrichClassroomsFile(jsonPath: string, excelPath: string) {
  console.log(`📖 Leyendo datos de intranet desde: ${jsonPath}`);
  console.log(`📊 Leyendo catálogo de horarios desde: ${excelPath}`);

  const rawJson = fs.readFileSync(jsonPath, 'utf-8');
  const data = JSON.parse(rawJson);
  const lookup = buildExcelLookup(excelPath);

  console.log(`👨‍🏫 Profesores únicos indexados del Excel: ${lookup.uniqueProfsCount}`);

  let totalAcademic = 0;
  let enrichedProfCount = 0;
  let enrichedEmailCount = 0;
  const sampleLog: string[] = [];

  for (const room of (data.classrooms as ClassroomInfo[])) {
    for (const day of ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'] as const) {
      for (const sess of room.sessionsByDay[day] || []) {
        if (sess.courseCode === 'RESERVA' || sess.courseCode === 'ACTIVIDAD') continue;
        totalAcademic++;

        const match = lookup.findBestMatch(sess, day);
        if (match) {
          const oldProf = sess.professor;
          const targetProf = match.raw; // Preserve "Apellidos, Nombres" format with comma
          if (oldProf !== targetProf) {
            sess.professor = targetProf;
            enrichedProfCount++;
            if (sampleLog.length < 25) {
              sampleLog.push(`  • [${sess.courseCode}] "${oldProf}" ➔ "${targetProf}" (${match.email || 'sin correo'})`);
            }
          }

          if (match.email && !sess.email) {
            sess.email = match.email;
            enrichedEmailCount++;
          }
          if (match.vacancies && !sess.vacancies) sess.vacancies = match.vacancies;
          if (match.enrolled && !sess.enrolled) sess.enrolled = match.enrolled;
        }
      }
    }
  }

  data.updatedAt = new Date().toISOString();
  data.enrichedWithExcel = true;

  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf-8');

  console.log(`\n✅ Enriquecimiento completado exitosamente:`);
  console.log(`   - Sesiones académicas analizadas: ${totalAcademic}`);
  console.log(`   - Nombres de profesores completados: ${enrichedProfCount}`);
  console.log(`   - Correos institucionales agregados: ${enrichedEmailCount}`);
  console.log(`\n🔍 Muestra de enriquecimientos aplicados:\n${sampleLog.join('\n')}\n`);
}

// CLI Execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const jsonPath = path.resolve(process.cwd(), 'public/data/classrooms_intranet.json');
  const excelPath = path.resolve(process.cwd(), 'public/samples/Consulta_Horario.xlsx');
  enrichClassroomsFile(jsonPath, excelPath);
}
