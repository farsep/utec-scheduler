import type { Course, Session } from '../types/schedule';
import { formatLocation, getCourseColor, getCoursePrefix } from './scheduleUtils';

// Google OAuth 2.0 Client Configuration
// Uses built-in client ID or custom client ID stored in localStorage/environment
const DEFAULT_CLIENT_ID = '383894781243-h8kq4jundmvmn91ae18t3vqifaibf7gj.apps.googleusercontent.com';

const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.app.created https://www.googleapis.com/auth/calendar';

export interface GoogleCalendarAuth {
  accessToken: string;
  expiresAt: number; // timestamp in ms
  userEmail?: string;
}

export interface SyncResult {
  success: boolean;
  eventsCreated: number;
  eventsDeleted: number;
  calendarId: string;
  calendarUrl: string;
  message?: string;
}

// Google Calendar API Color ID mapping from hex colors
const GOOGLE_COLOR_IDS: Record<string, string> = {
  '#3b82f6': '1',  // Blue -> Lavender/Blue
  '#10b981': '2',  // Emerald -> Sage/Green
  '#8b5cf6': '3',  // Purple -> Grape
  '#f59e0b': '5',  // Amber -> Yellow
  '#ec4899': '4',  // Pink -> Flamingo
  '#06b6d4': '7',  // Cyan -> Peacock
  '#6366f1': '9',  // Indigo -> Blueberry
  '#f97316': '6',  // Orange -> Tangerine
  '#ef4444': '11', // Red -> Tomato
  '#84cc16': '10', // Lime -> Basil
};

function getGoogleColorId(hexColor: string): string {
  const cleanHex = hexColor.toLowerCase();
  return GOOGLE_COLOR_IDS[cleanHex] || '1';
}

/**
 * Dynamically loads Google Identity Services client script (gsi/client)
 */
export function loadGoogleGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('Window object is unavailable'));
    }
    if ((window as any).google?.accounts?.oauth2) {
      return resolve();
    }
    const existingScript = document.getElementById('google-gsi-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Google script')));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Error loading Google Identity Services script'));
    document.head.appendChild(script);
  });
}

/**
 * Gets saved OAuth authentication token from localStorage
 */
export function getSavedAuth(): GoogleCalendarAuth | null {
  try {
    const raw = localStorage.getItem('utec_gcal_auth');
    if (!raw) return null;
    const auth: GoogleCalendarAuth = JSON.parse(raw);
    if (Date.now() >= auth.expiresAt - 60000) {
      // Token expired or about to expire in 1 minute
      localStorage.removeItem('utec_gcal_auth');
      return null;
    }
    return auth;
  } catch (err) {
    return null;
  }
}

/**
 * Saves OAuth authentication token to localStorage
 */
export function saveAuth(auth: GoogleCalendarAuth) {
  try {
    localStorage.setItem('utec_gcal_auth', JSON.stringify(auth));
  } catch (err) {
    console.error('Failed to save Google Auth:', err);
  }
}

/**
 * Clears saved Google OAuth token
 */
export function logoutGoogle() {
  localStorage.removeItem('utec_gcal_auth');
  localStorage.removeItem('utec_gcal_id');
  localStorage.removeItem('utec_gcal_synced_events');
}

/**
 * Requests OAuth 2.0 access token via Google Identity Services popup
 */
export async function requestGoogleAccessToken(customClientId?: string): Promise<GoogleCalendarAuth> {
  await loadGoogleGsiScript();

  const clientId = customClientId || localStorage.getItem('utec_custom_client_id') || DEFAULT_CLIENT_ID;

  return new Promise((resolve, reject) => {
    try {
      const google = (window as any).google;
      if (!google?.accounts?.oauth2) {
        return reject(new Error('Google Identity Services script not ready'));
      }

      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: async (response: any) => {
          if (response.error) {
            return reject(new Error(response.error_description || response.error));
          }
          const expiresInMs = (parseInt(response.expires_in, 10) || 3600) * 1000;
          const auth: GoogleCalendarAuth = {
            accessToken: response.access_token,
            expiresAt: Date.now() + expiresInMs
          };

          // Fetch user info / email if possible
          try {
            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${response.access_token}` }
            });
            if (userRes.ok) {
              const userData = await userRes.json();
              auth.userEmail = userData.email;
            }
          } catch (e) {
            console.warn('Could not fetch user profile info:', e);
          }

          saveAuth(auth);
          resolve(auth);
        },
        error_callback: (err: any) => {
          reject(new Error(err.message || 'Google Authentication window closed or blocked'));
        }
      });

      client.requestAccessToken();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Retrieves or creates a dedicated "UTEC - Mi Horario (2026-2)" Google Calendar
 */
export async function getOrCreateUTECCalendar(accessToken: string): Promise<string> {
  const savedCalId = localStorage.getItem('utec_gcal_id');
  if (savedCalId) {
    // Verify calendar exists
    try {
      const checkRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(savedCalId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (checkRes.ok) {
        return savedCalId;
      }
    } catch (e) {
      // Proceed to list/create
    }
  }

  // Search in user's calendar list
  const listRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (listRes.ok) {
    const listData = await listRes.json();
    const existing = (listData.items || []).find((c: any) =>
      c.summary && c.summary.includes('UTEC - Mi Horario')
    );
    if (existing) {
      localStorage.setItem('utec_gcal_id', existing.id);
      return existing.id;
    }
  }

  // Create new calendar
  const createRes = await fetch('https://www.googleapis.com/calendar/v3/calendars', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      summary: 'UTEC - Mi Horario (2026-2)',
      description: 'Horario de clases UTEC creado desde la aplicación UTEC Matrícula Scheduler',
      timeZone: 'America/Lima'
    })
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Error al crear el calendario en Google: ${errText}`);
  }

  const newCal = await createRes.json();
  localStorage.setItem('utec_gcal_id', newCal.id);
  return newCal.id;
}

/**
 * Synchronizes and adds/edits courses directly in Google Calendar
 */
/**
 * Synchronizes and adds/edits courses directly in Google Calendar with high concurrency
 */
export async function syncScheduleToGoogleCalendar(
  accessToken: string,
  courses: Course[],
  selectedSections: Record<string, string>,
  colorMode: 'prefix' | 'course' = 'prefix',
  targetCalendarId?: string
): Promise<SyncResult> {
  const calendarId = targetCalendarId || (await getOrCreateUTECCalendar(accessToken));

  // Step 1: Clear previously tracked UTEC events in parallel
  const deletedCount = await clearTrackedUTECEvents(accessToken, calendarId);

  // Step 2: Calculate date bounds for UTEC semester
  const SEMESTER_WEEKS = 16;
  const baseMonday = new Date(2026, 7, 10); // August 10, 2026 is Monday

  const semesterEndDate = new Date(baseMonday);
  semesterEndDate.setDate(baseMonday.getDate() + (SEMESTER_WEEKS * 7) - 1);
  const untilYear = semesterEndDate.getFullYear();
  const untilMonth = String(semesterEndDate.getMonth() + 1).padStart(2, '0');
  const untilDay = String(semesterEndDate.getDate()).padStart(2, '0');
  const untilStr = `${untilYear}${untilMonth}${untilDay}T235959Z`;

  const dayOffset: Record<string, number> = {
    Lun: 0,
    Mar: 1,
    Mie: 2,
    Jue: 3,
    Vie: 4,
    Sab: 5,
    Dom: 6
  };

  // Prepare all event payloads upfront
  const eventPayloads: { courseCode: string; payload: any }[] = [];

  for (const [courseCode, secNum] of Object.entries(selectedSections)) {
    const course = courses.find(c => c.code === courseCode);
    if (!course) continue;
    const section = course.sections.find(s => s.sectionNumber === secNum);
    if (!section) continue;

    const mainSecNum = secNum.split(' (')[0];
    let subGroupLabel = '';
    const matchParen = secNum.match(/\((.*?)\)/);
    if (matchParen && matchParen[1]) {
      subGroupLabel = matchParen[1];
    }

    const courseColor = getCourseColor(courseCode, colorMode);
    const googleColorId = getGoogleColorId(courseColor);

    for (const sess of section.sessions) {
      const offset = dayOffset[sess.day] ?? 0;
      const eventDate = new Date(baseMonday);
      eventDate.setDate(baseMonday.getDate() + offset);

      const year = eventDate.getFullYear();
      const month = String(eventDate.getMonth() + 1).padStart(2, '0');
      const day = String(eventDate.getDate()).padStart(2, '0');

      const [startH, startM] = sess.startTime.split(':');
      const [endH, endM] = sess.endTime.split(':');

      const startDateTime = `${year}-${month}-${day}T${startH}:${startM}:00`;
      const endDateTime = `${year}-${month}-${day}T${endH}:${endM}:00`;

      const groupTitle = subGroupLabel ? sess.sessionGroup : sess.sessionGroup;
      const summaryText = `[${courseCode}] ${course.name} - Sec ${mainSecNum} (${groupTitle})`;
      const profText = sess.professor || section.professors[0] || 'Por asignar';

      const descriptionText = `📚 Curso: ${course.name} (${courseCode})\n` +
        `📌 Sección: ${mainSecNum}${subGroupLabel ? ` (${subGroupLabel})` : ''}\n` +
        `📝 Sesión: ${sess.sessionGroup}\n` +
        `👨‍🏫 Profesor: ${profText}\n` +
        `📍 Modalidad: ${sess.modality || 'Presencial'}\n\n` +
        `Generado automáticamente por UTEC Matrícula Scheduler`;

      const locationText = formatLocation(sess.location) ? `${formatLocation(sess.location)}, UTEC Barranco` : 'UTEC Barranco';

      eventPayloads.push({
        courseCode,
        payload: {
          summary: summaryText,
          location: locationText,
          description: descriptionText,
          start: {
            dateTime: `${startDateTime}-05:00`,
            timeZone: 'America/Lima'
          },
          end: {
            dateTime: `${endDateTime}-05:00`,
            timeZone: 'America/Lima'
          },
          recurrence: [
            `RRULE:FREQ=WEEKLY;UNTIL=${untilStr}`
          ],
          colorId: googleColorId
        }
      });
    }
  }

  // Step 3: Execute creation in high-performance concurrent chunks (batch size: 6)
  const newEventIds: string[] = [];
  let eventsCreated = 0;
  const CHUNK_SIZE = 6;
  const endpoint = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

  for (let i = 0; i < eventPayloads.length; i += CHUNK_SIZE) {
    const chunk = eventPayloads.slice(i, i + CHUNK_SIZE);
    const results = await Promise.allSettled(
      chunk.map(async ({ payload }) => {
        const createRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        if (createRes.ok) {
          return await createRes.json();
        } else {
          const errText = await createRes.text();
          throw new Error(errText);
        }
      })
    );

    results.forEach((res) => {
      if (res.status === 'fulfilled' && res.value?.id) {
        newEventIds.push(res.value.id);
        eventsCreated++;
      } else if (res.status === 'rejected') {
        console.error('Failed to create an event batch item:', res.reason);
      }
    });
  }

  // Save active event IDs to local storage for future edit/update sync operations
  localStorage.setItem(`utec_gcal_events_${calendarId}`, JSON.stringify(newEventIds));

  const calendarUrl = `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(calendarId)}`;

  return {
    success: true,
    eventsCreated,
    eventsDeleted: deletedCount,
    calendarId,
    calendarUrl,
    message: `¡Horario sincronizado exitosamente! Se agregaron ${eventsCreated} clases a tu Google Calendar.`
  };
}

/**
 * Clears tracked UTEC calendar events from the specified Google Calendar in parallel
 */
export async function clearTrackedUTECEvents(accessToken: string, calendarId: string): Promise<number> {
  const storageKey = `utec_gcal_events_${calendarId}`;
  let eventIds: string[] = [];

  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) eventIds = JSON.parse(raw);
  } catch (e) {
    eventIds = [];
  }

  let deletedCount = 0;

  if (eventIds.length > 0) {
    const CHUNK_SIZE = 6;
    for (let i = 0; i < eventIds.length; i += CHUNK_SIZE) {
      const chunk = eventIds.slice(i, i + CHUNK_SIZE);
      const results = await Promise.allSettled(
        chunk.map(async (eventId) => {
          const delRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${accessToken}` }
            }
          );
          return delRes.ok || delRes.status === 404;
        })
      );

      results.forEach((res) => {
        if (res.status === 'fulfilled' && res.value) {
          deletedCount++;
        }
      });
    }
  }

  localStorage.removeItem(storageKey);
  return deletedCount;
}

/**
 * Generates single-click "Add to Google Calendar" web intent URL for an individual session
 */
export function generateGoogleCalendarWebIntentUrl(
  course: Course,
  secNum: string,
  session: Session
): string {
  const baseMonday = new Date(2026, 7, 10);
  const dayOffset: Record<string, number> = { Lun: 0, Mar: 1, Mie: 2, Jue: 3, Vie: 4, Sab: 5, Dom: 6 };
  const offset = dayOffset[session.day] ?? 0;

  const eventDate = new Date(baseMonday);
  eventDate.setDate(baseMonday.getDate() + offset);

  const year = eventDate.getFullYear();
  const month = String(eventDate.getMonth() + 1).padStart(2, '0');
  const day = String(eventDate.getDate()).padStart(2, '0');

  const [startH, startM] = session.startTime.split(':');
  const [endH, endM] = session.endTime.split(':');

  // Format: YYYYMMDDTHHmmSS
  const startStr = `${year}${month}${day}T${startH}${startM}00`;
  const endStr = `${year}${month}${day}T${endH}${endM}00`;

  const mainSecNum = secNum.split(' (')[0];
  const title = `[${course.code}] ${course.name} - Sec ${mainSecNum} (${session.sessionGroup})`;
  const location = formatLocation(session.location) ? `${formatLocation(session.location)}, UTEC` : 'UTEC Barranco';
  const details = `Curso: ${course.name} (${course.code})\nSección: ${secNum}\nProfesor: ${session.professor || 'Por asignar'}\nModalidad: ${session.modality || 'Presencial'}`;
  const recur = 'RRULE:FREQ=WEEKLY;UNTIL=20261129T235959Z';

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${startStr}/${endStr}`,
    details: details,
    location: location,
    recur: recur,
    ctz: 'America/Lima'
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
