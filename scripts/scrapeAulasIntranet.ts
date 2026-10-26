import fs from 'fs';
import path from 'path';
import type { DayOfWeek } from '../src/types/schedule';
import type { ClassroomInfo, ClassroomSession, RoomType } from '../src/types/classroom';
import { parseLocationInfo, ALL_DAYS } from '../src/utils/classroomUtils';

// Default credentials passed from active intranet session
const DEFAULT_AUTH_TOKEN = 'eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJhcm5pZS5lc3Bpbm96YUB1dGVjLmVkdS5wZSIsImF1ZGllbmNlIjoidW5kZXRlcm1pbmVkIiwiY3JlYXRlZCI6MTc5MzAyNTY4NjAzMSwiZXhwIjoxNzkzMDQwMDg2fQ.a99jVHJUmAgWGPJCICKQ0gvtaT41nQ5JRzD6Bsh_7RnKL9PXf_xq8DdKdz3i0Q90Ven8hUiVFY76-GsNNZMaOw';
const DEFAULT_COOKIE = 'sessionId=s%3A2d_U_DB7q1dmoViIXXPdDJBvR4bd1d3S.7CbAMf8cxNi6WfsaBii%2FopfH72%2BbmrrCTUzxYrx4P5k';

interface RawAula {
  codAula: number;
  nomAliasAula: string;
}

interface RawEvent {
  title: string;
  start: string; // "26/10/2026 08:30"
  end: string;   // "26/10/2026 09:30"
}

interface CliArgs {
  token: string;
  cookie: string;
  startDate: string;
  endDate: string;
  outputPath: string;
  concurrency: number;
}

function parseCliArgs(): CliArgs {
  const args = process.argv.slice(2);
  let token = process.env.UTEC_AUTH_TOKEN || DEFAULT_AUTH_TOKEN;
  let cookie = process.env.UTEC_SESSION_ID || DEFAULT_COOKIE;
  let startDate = '';
  let endDate = '';
  let outputPath = path.resolve(process.cwd(), 'public/data/classrooms_intranet.json');
  let concurrency = 6;

  for (const arg of args) {
    if (arg.startsWith('--token=')) token = arg.replace('--token=', '').trim();
    if (arg.startsWith('--cookie=')) {
      let c = arg.replace('--cookie=', '').trim();
      if (!c.startsWith('sessionId=')) c = `sessionId=${c}`;
      cookie = c;
    }
    if (arg.startsWith('--start=')) startDate = arg.replace('--start=', '').trim();
    if (arg.startsWith('--end=')) endDate = arg.replace('--end=', '').trim();
    if (arg.startsWith('--output=')) outputPath = path.resolve(process.cwd(), arg.replace('--output=', '').trim());
    if (arg.startsWith('--concurrency=')) concurrency = parseInt(arg.replace('--concurrency=', ''), 10) || 6;
  }

  // Calculate current week Monday to Saturday if not specified
  if (!startDate || !endDate) {
    const now = new Date();
    const day = now.getDay(); // 0 is Sun, 1 is Mon
    const diffToMonday = day === 0 ? -6 : 1 - day;
    
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);

    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);

    const fmt = (d: Date) => {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };

    startDate = fmt(monday);
    endDate = fmt(saturday);
  }

  return { token, cookie, startDate, endDate, outputPath, concurrency };
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

  // Extracurricular reservation / club / private event
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

function parseDateTimeString(dateTimeStr: string): { dayOfWeek: DayOfWeek; timeStr: string; minutes: number } | null {
  // Format: "26/10/2026 08:30"
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
    0: null // Sunday
  };

  const dayOfWeek = dayMap[dayIdx];
  if (!dayOfWeek) return null;

  const [h, min] = timePart.split(':').map(Number);
  const minutes = (h || 0) * 60 + (min || 0);

  return { dayOfWeek, timeStr: timePart, minutes };
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

async function runScraper() {
  console.log('🚀 Iniciando scraper de Aulas Libres Intranet UTEC...');
  const config = parseCliArgs();
  console.log(`📅 Rango de fechas: ${config.startDate} al ${config.endDate}`);
  console.log(`⚡ Concurrencia: ${config.concurrency} peticiones paralelas`);

  console.log('📡 Consultando catálogo de espacios...');
  const catalog = await fetchCatalog(config.token);
  console.log(`✅ Catálogo obtenido: ${catalog.length} aulas/espacios registrados.`);

  const classroomMap = new Map<string, ClassroomInfo>();

  // Initialize all known rooms in the catalog
  for (const item of catalog) {
    const parsedLoc = parseLocationInfo(item.nomAliasAula);
    const roomCode = parsedLoc?.code || item.nomAliasAula.toUpperCase();
    const displayName = parsedLoc?.displayName || item.nomAliasAula;
    const type: RoomType = parsedLoc?.type || 'otro';
    const floor = parsedLoc?.floor || 1;

    classroomMap.set(roomCode, {
      id: roomCode,
      code: roomCode,
      rawLocation: item.nomAliasAula,
      displayName,
      type,
      floor,
      sessionsByDay: {
        Lun: [],
        Mar: [],
        Mie: [],
        Jue: [],
        Vie: [],
        Sab: []
      }
    });
  }

  console.log(`⏳ Descargando reservas para ${catalog.length} aulas...`);
  let completed = 0;
  let totalEventsFound = 0;

  // Process in batches
  for (let i = 0; i < catalog.length; i += config.concurrency) {
    const chunk = catalog.slice(i, i + config.concurrency);
    await Promise.all(
      chunk.map(async (aula) => {
        try {
          const events = await fetchRoomEvents(aula.codAula, config.startDate, config.endDate, config.token, config.cookie);
          totalEventsFound += events.length;

          const parsedLoc = parseLocationInfo(aula.nomAliasAula);
          const roomCode = parsedLoc?.code || aula.nomAliasAula.toUpperCase();
          const room = classroomMap.get(roomCode);

          if (room) {
            for (const ev of events) {
              const startParsed = parseDateTimeString(ev.start);
              const endParsed = parseDateTimeString(ev.end);
              if (!startParsed || !endParsed) continue;

              const titleDetails = parseEventTitle(ev.title);

              const session: ClassroomSession = {
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
                enrolled: 0
              };

              room.sessionsByDay[startParsed.dayOfWeek].push(session);
            }
          }
        } catch (err: any) {
          console.error(`❌ Error en aula ${aula.nomAliasAula} (cod ${aula.codAula}):`, err.message);
        } finally {
          completed++;
        }
      })
    );

    const percent = Math.round((completed / catalog.length) * 100);
    process.stdout.write(`\r[Progreso: ${percent}%] ${completed}/${catalog.length} aulas procesadas...`);
  }

  console.log('\n✨ Descarga finalizada.');
  console.log(`📊 Total de reservas y clases encontradas: ${totalEventsFound}`);

  // Sort sessions within each room/day by start time
  const classroomsList = Array.from(classroomMap.values());
  for (const room of classroomsList) {
    for (const day of ALL_DAYS) {
      room.sessionsByDay[day].sort((a, b) => a.startMinutes - b.startMinutes);
    }
  }

  if (totalEventsFound === 0) {
    console.error('\n⚠️ ATENCIÓN: Se obtuvieron 0 eventos (posiblemente la cookie/sesión de la intranet expiró con HTTP 500).');
    console.error('👉 Por seguridad, no se sobreescribirán los datos existentes. Por favor renueva tu cookie de sesión.');
    return;
  }

  // Ensure output directory exists
  const dir = path.dirname(config.outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const outputPayload = {
    updatedAt: new Date().toISOString(),
    weekRange: {
      start: config.startDate,
      end: config.endDate
    },
    totalRooms: classroomsList.length,
    totalEvents: totalEventsFound,
    classrooms: classroomsList
  };

  fs.writeFileSync(config.outputPath, JSON.stringify(outputPayload, null, 2), 'utf-8');
  console.log(`💾 Datos guardados exitosamente en:\n👉 ${config.outputPath}`);

  // Auto-enrich with Excel if available
  const excelPath = path.resolve(process.cwd(), 'public/samples/Consulta_Horario.xlsx');
  if (fs.existsSync(excelPath)) {
    console.log('\n🔄 Enriqueciendo profesores y correos cruzando con Excel...');
    const { enrichClassroomsFile } = await import('./enrichClassrooms');
    enrichClassroomsFile(config.outputPath, excelPath);
  }
}

runScraper().catch((err) => {
  console.error('Fatal scraper error:', err);
  process.exit(1);
});

