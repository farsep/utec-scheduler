import fs from 'fs';
import path from 'path';
import type { DayOfWeek } from '../src/types/schedule';
import type { ClassroomInfo, ClassroomSession, RoomType } from '../src/types/classroom';
import { parseLocationInfo, ALL_DAYS } from '../src/utils/classroomUtils';
import { buildExcelLookup } from './enrichClassrooms';

const DEFAULT_AUTH_TOKEN = 'eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJhcm5pZS5lc3Bpbm96YUB1dGVjLmVkdS5wZSIsImF1ZGllbmNlIjoidW5kZXRlcm1pbmVkIiwiY3JlYXRlZCI6MTc5NDcxMTUzMTg4NCwiZXhwIjoxNzk0NzI1OTMxfQ.LqEkWRZ9p9Ze5_mbuGrgWGUm7KsnCLtCcWQqzxHL0dj0-g6jruieEGuQgXv6lRC8FiG4sMvJ1CpC3LJbCbYzOA';
const DEFAULT_COOKIE = '_ga=GA1.1.1021582725.1785947268; _ga_JRHSMRCLBN=GS2.1.s1786982430$o3$g1$t1786982599$j39$l0$h1951572987; _ga_ZETLJNDYCS=GS2.1.s1793149972$o2$g1$t1793149972$j60$l0$h0; sessionId=s%3AVmNE1XcUP1AoTUVTwP8d9E5X44voQ6oR.uFApMIAAGhvXwgBSJl5DSgQh2sdXHBuAe48%2BgBLBFUs';

interface RawAula {
  codAula: number;
  nomAliasAula: string;
}

interface RawEvent {
  title: string;
  start: string; // "26/10/2026 08:30"
  end: string;   // "26/10/2026 09:30"
}

interface SemesterEvent extends ClassroomSession {
  date: string; // "26/10/2026"
  isRecurrentClass: boolean; // meets regularly in semester
  isSporadicReservation: boolean; // one-off booking
}

function parseEventTitle(title: string): {
  courseCode: string;
  courseName: string;
  sectionNumber: string;
  sessionGroup: string;
  professor: string;
} {
  const clean = (title || '').trim();

  // Pattern: COURSE_CODE-Course Name - Sec.X - TEO/LAB - Grupo Y - Docente\tProfessor Name
  const match = clean.match(/^([A-Z0-9]{4,8})\s*-\s*(.*?)\s*-\s*Sec\.?\s*([0-9A-Za-z]+)(?:\s*-\s*([A-Za-z]+))?(?:\s*-\s*Grupo\s*([0-9A-Za-z]+))?(?:\s*-\s*Docente\s*[\t:]?\s*(.*))?$/i);
  if (match) {
    return {
      courseCode: match[1].toUpperCase(),
      courseName: match[2].trim(),
      sectionNumber: match[3],
      sessionGroup: match[5] || '1',
      professor: (match[6] || '').trim() || 'Docente UTEC'
    };
  }

  // Reservation / event
  const reservationName = clean.replace(/^:/, '').trim();
  const isGeneric = /^RESERVAD[OA]/i.test(reservationName);

  return {
    courseCode: isGeneric ? 'RESERVA' : 'ACTIVIDAD',
    courseName: reservationName || 'Espacio Reservado',
    sectionNumber: '-',
    sessionGroup: '-',
    professor: isGeneric ? 'Reserva Institucional' : reservationName
  };
}

function parseDateTimeString(dateTimeStr: string): { dateStr: string; dayOfWeek: DayOfWeek; timeStr: string; minutes: number } | null {
  const parts = dateTimeStr.trim().split(' ');
  if (parts.length < 2) return null;

  const [datePart, timePart] = parts;
  const [d, m, y] = datePart.split('/').map(Number);
  if (!d || !m || !y) return null;

  const dateObj = new Date(y, m - 1, d);
  const dayIdx = dateObj.getDay();
  const dayMap: Record<number, DayOfWeek | null> = {
    1: 'Lun',
    2: 'Mar',
    3: 'Mie',
    4: 'Jue',
    5: 'Vie',
    6: 'Sab',
    0: null
  };

  const dayOfWeek = dayMap[dayIdx];
  if (!dayOfWeek) return null;

  const [h, min] = timePart.split(':').map(Number);
  const minutes = (h || 0) * 60 + (min || 0);

  return { dateStr: datePart, dayOfWeek, timeStr: timePart, minutes };
}

async function fetchCatalog(token: string): Promise<RawAula[]> {
  const res = await fetch('https://api.utec.edu.pe/reserva-api/filtro/aula/reservable?codsede=2', {
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': token
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error al obtener catálogo de aulas (HTTP ${res.status}): ${text}`);
  }

  const json = await res.json();
  return json.content || [];
}

async function fetchRoomEvents(codAula: number, startDate: string, endDate: string, token: string, cookie: string): Promise<RawEvent[]> {
  const res = await fetch('https://reserva-intranet.utec.edu.pe/events/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': token,
      'Cookie': cookie
    },
    body: JSON.stringify({
      codAula,
      fechaInicial: startDate,
      fechaFinal: endDate
    })
  });

  if (!res.ok) {
    console.warn(`[WARN] Aula ${codAula} respondió con HTTP ${res.status}`);
    return [];
  }

  const json = await res.json();
  return json.content || [];
}

export async function runSemesterScraper() {
  console.log('🚀 Iniciando scraper del semestre completo (16 semanas) en UTEC...');
  const token = process.env.UTEC_AUTH_TOKEN || DEFAULT_AUTH_TOKEN;
  const cookie = process.env.UTEC_SESSION_ID || DEFAULT_COOKIE;
  
  // 16 weeks of semester (August 1 to December 31)
  const startDate = '01/08/2026';
  const endDate = '31/12/2026';
  const concurrency = 6;

  console.log(`📅 Rango de fechas: ${startDate} al ${endDate} (Ciclo 2026-2)`);
  console.log(`⚡ Concurrencia: ${concurrency} peticiones paralelas`);

  console.log('📡 Consultando catálogo de espacios...');
  const rawCatalog = await fetchCatalog(token);

  // Exclude E study rooms, -A sub-rooms, and L203E
  const isExcluded = (name: string) => {
    const clean = name.trim().toUpperCase();
    return clean.startsWith('E') || clean.endsWith('-A') || clean.endsWith('_A') || clean.startsWith('L203') || clean === 'L203E';
  };

  const catalog = rawCatalog.filter((item: RawAula) => !isExcluded(item.nomAliasAula));
  console.log(`✅ Catálogo filtrado: ${catalog.length} aulas válidas (${rawCatalog.length - catalog.length} excluidas).`);

  // Load Excel lookup to enrich professors with 'Apellidos, Nombres' format and emails
  const excelPath = path.resolve(process.cwd(), 'public/samples/Consulta_Horario.xlsx');
  const excelLookup = fs.existsSync(excelPath) ? buildExcelLookup(excelPath) : null;
  if (excelLookup) {
    console.log(`👨‍🏫 Motor de enriquecimiento activo: ${excelLookup.uniqueProfsCount} docentes indexados de Excel.`);
  }

  const roomResults = new Map<string, {
    classroom: ClassroomInfo;
    allSemesterEvents: SemesterEvent[];
    recurrentSessions: ClassroomSession[];
  }>();

  for (const item of catalog) {
    const parsedLoc = parseLocationInfo(item.nomAliasAula);
    const roomCode = parsedLoc?.code || item.nomAliasAula.toUpperCase();
    const displayName = parsedLoc?.displayName || item.nomAliasAula;
    const type: RoomType = parsedLoc?.type || 'otro';
    const floor = parsedLoc?.floor || 1;

    roomResults.set(roomCode, {
      classroom: {
        id: roomCode,
        code: roomCode,
        rawLocation: item.nomAliasAula,
        displayName,
        type,
        floor,
        sessionsByDay: { Lun: [], Mar: [], Mie: [], Jue: [], Vie: [], Sab: [] }
      },
      allSemesterEvents: [],
      recurrentSessions: []
    });
  }

  console.log(`⏳ Descargando cronograma semestral para las ${catalog.length} aulas...`);
  let completed = 0;
  let totalRawEvents = 0;

  for (let i = 0; i < catalog.length; i += concurrency) {
    const chunk = catalog.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (aula) => {
        try {
          const events = await fetchRoomEvents(aula.codAula, startDate, endDate, token, cookie);
          totalRawEvents += events.length;

          const parsedLoc = parseLocationInfo(aula.nomAliasAula);
          const roomCode = parsedLoc?.code || aula.nomAliasAula.toUpperCase();
          const target = roomResults.get(roomCode);

          if (target) {
            for (const ev of events) {
              const startParsed = parseDateTimeString(ev.start);
              const endParsed = parseDateTimeString(ev.end);
              if (!startParsed || !endParsed) continue;

              const titleDetails = parseEventTitle(ev.title);

              const session: SemesterEvent = {
                courseCode: titleDetails.courseCode,
                courseName: titleDetails.courseName,
                sectionNumber: titleDetails.sectionNumber,
                sessionGroup: titleDetails.sessionGroup,
                day: startParsed.dayOfWeek,
                startTime: startParsed.timeStr,
                endTime: endParsed.timeStr,
                startMinutes: startParsed.minutes,
                endMinutes: endParsed.minutes,
                professor: titleDetails.professor,
                email: '',
                vacancies: 0,
                enrolled: 0,
                date: startParsed.dateStr,
                isRecurrentClass: false,
                isSporadicReservation: false
              };

              // Enrich with Excel if available
              if (excelLookup && session.courseCode !== 'RESERVA' && session.courseCode !== 'ACTIVIDAD') {
                const match = excelLookup.findBestMatch(session, startParsed.dayOfWeek);
                if (match) {
                  session.professor = match.raw; // Apellidos, Nombres
                  session.email = match.email || '';
                  session.vacancies = match.vacancies || 0;
                  session.enrolled = match.enrolled || 0;
                }
              }

              target.allSemesterEvents.push(session);
            }
          }
        } catch (err: any) {
          console.error(`❌ Error en aula ${aula.nomAliasAula}:`, err.message);
        } finally {
          completed++;
        }
      })
    );

    const percent = Math.round((completed / catalog.length) * 100);
    process.stdout.write(`\r[Progreso: ${percent}%] ${completed}/${catalog.length} aulas descargadas...`);
  }

  console.log('\n✨ Descarga semestral completada.');
  console.log(`📊 Total de eventos en el semestre (16 semanas): ${totalRawEvents}`);

  if (totalRawEvents === 0) {
    console.error('⚠️ Se obtuvieron 0 eventos. Por favor verifica que la sesión no haya caducado.');
    return;
  }

  // -------------------------------------------------------------
  // ANALIZAR RECURRENCIA Y CONSERVAR TODAS LAS FECHAS EXACTAS
  // -------------------------------------------------------------
  console.log('🔍 Analizando recurrencia y fechas exactas por aula...');

  const parseDateKey = (ddmmyyyy: string) => {
    const [d, m, y] = ddmmyyyy.split('/');
    return `${y || ''}${m || ''}${d || ''}`;
  };

  const finalClassroomsList: ClassroomInfo[] = [];
  let totalRecurringSessions = 0;
  let totalSporadicSessions = 0;

  for (const [, entry] of roomResults.entries()) {
    const { classroom, allSemesterEvents } = entry;

    // Group events by: day + startMinutes + endMinutes + courseCode + courseName
    // Keeping courseName in the key ensures distinct events at the same hour on different dates are not merged.
    const occurrenceMap = new Map<string, { sample: SemesterEvent; dateSet: Set<string> }>();

    for (const ev of allSemesterEvents) {
      const key = `${ev.day}::${ev.startMinutes}::${ev.endMinutes}::${ev.courseCode}::${ev.courseName}`;
      if (!occurrenceMap.has(key)) {
        occurrenceMap.set(key, { sample: ev, dateSet: new Set<string>() });
      }
      const record = occurrenceMap.get(key)!;
      record.dateSet.add(ev.date);
    }

    for (const [, record] of occurrenceMap.entries()) {
      const uniqueDates = Array.from(record.dateSet).sort((a, b) =>
        parseDateKey(a).localeCompare(parseDateKey(b))
      );
      if (uniqueDates.length === 0) continue;

      const isAcademicCourse = record.sample.courseCode !== 'RESERVA' && record.sample.courseCode !== 'ACTIVIDAD';
      const isRecurring = uniqueDates.length >= 4 || (isAcademicCourse && uniqueDates.length >= 2);

      if (isRecurring) totalRecurringSessions++;
      else totalSporadicSessions++;

      const cleanSession: ClassroomSession = {
        courseCode: record.sample.courseCode,
        courseName: record.sample.courseName,
        sectionNumber: record.sample.sectionNumber,
        sessionGroup: record.sample.sessionGroup,
        day: record.sample.day,
        startTime: record.sample.startTime,
        endTime: record.sample.endTime,
        startMinutes: record.sample.startMinutes,
        endMinutes: record.sample.endMinutes,
        professor: record.sample.professor,
        email: record.sample.email,
        vacancies: record.sample.vacancies,
        enrolled: record.sample.enrolled,
        dates: uniqueDates,
        occurrencesCount: uniqueDates.length,
        isRecurring
      };
      classroom.sessionsByDay[record.sample.day].push(cleanSession);
    }

    // Sort by startMinutes, then chronologically by first date
    for (const day of ALL_DAYS) {
      classroom.sessionsByDay[day].sort((a, b) => {
        if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
        return parseDateKey(a.dates?.[0] || '').localeCompare(parseDateKey(b.dates?.[0] || ''));
      });
    }

    finalClassroomsList.push(classroom);
  }

  // Calculate stats
  let totalRecurrentSessions = 0;
  finalClassroomsList.forEach(r => {
    Object.values(r.sessionsByDay).forEach(sessions => {
      totalRecurrentSessions += sessions.length;
    });
  });

  const outputPayload = {
    updatedAt: new Date().toISOString(),
    semester: '2026-2',
    weeksCount: 16,
    dateRange: { start: startDate, end: endDate },
    totalRooms: finalClassroomsList.length,
    totalSemesterRawEvents: totalRawEvents,
    totalConsolidatedWeeklySessions: totalRecurrentSessions,
    totalRecurringSessions,
    totalSporadicSessions,
    classrooms: finalClassroomsList
  };

  const outputPath = path.resolve(process.cwd(), 'public/data/classrooms_intranet.json');
  const semesterBackupPath = path.resolve(process.cwd(), 'public/data/classrooms_semester_consolidated.json');

  fs.writeFileSync(outputPath, JSON.stringify(outputPayload, null, 2), 'utf-8');
  fs.writeFileSync(semesterBackupPath, JSON.stringify(outputPayload, null, 2), 'utf-8');

  console.log(`\n💾 Archivo consolidado guardado en:\n👉 ${outputPath}`);
  console.log(`👉 ${semesterBackupPath}`);
  console.log(`\n📈 Resultados del Cronograma Semestral Absoluto:`);
  console.log(`   - Total aulas analizadas: ${finalClassroomsList.length}`);
  console.log(`   - Total eventos brutos descargados en 16 semanas: ${totalRawEvents}`);
  console.log(`   - Bloques semanales fijos y recurrentes consolidados: ${totalRecurrentSessions}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSemesterScraper().catch((err) => {
    console.error('Fatal error in semester scraper:', err);
    process.exit(1);
  });
}
