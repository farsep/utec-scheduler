import type { Course, Session } from '../types/schedule';

export function generateICS(courses: Course[], selectedSections: Record<string, string>): string {
  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UTEC Matricula Horario Builder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Mi Horario UTEC'
  ];

  // Arbitrary start date for semester schedule preview (e.g. Monday Aug 17, 2026)
  const baseMonday = new Date(2026, 7, 17); // 2026-08-17 is a Monday

  const dayOffset: Record<string, number> = {
    Lun: 0,
    Mar: 1,
    Mie: 2,
    Jue: 3,
    Vie: 4,
    Sab: 5
  };

  Object.entries(selectedSections).forEach(([courseCode, secNum]) => {
    const course = courses.find(c => c.code === courseCode);
    if (!course) return;
    const section = course.sections.find(s => s.sectionNumber === secNum);
    if (!section) return;

    section.sessions.forEach(sess => {
      const offset = dayOffset[sess.day] ?? 0;
      const eventDate = new Date(baseMonday);
      eventDate.setDate(baseMonday.getDate() + offset);

      const year = eventDate.getFullYear();
      const month = String(eventDate.getMonth() + 1).padStart(2, '0');
      const day = String(eventDate.getDate()).padStart(2, '0');

      const [startH, startM] = sess.startTime.split(':');
      const [endH, endM] = sess.endTime.split(':');

      const dtStart = `${year}${month}${day}T${startH}${startM}00`;
      const dtEnd = `${year}${month}${day}T${endH}${endM}00`;

      ics.push(
        'BEGIN:VEVENT',
        `UID:${courseCode}-${secNum}-${sess.id}@utec.edu.pe`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `RRULE:FREQ=WEEKLY;UNTIL=${year}1215T235959Z`,
        `SUMMARY:[${courseCode}] ${course.name} - Sec ${secNum} (${sess.sessionGroup})`,
        `LOCATION:${sess.location || 'UTEC'}`,
        `DESCRIPTION:Profesor: ${sess.professor || 'Por asignar'}\\nModalidad: ${sess.modality}`,
        'END:VEVENT'
      );
    });
  });

  ics.push('END:VCALENDAR');
  return ics.join('\r\n');
}

export function downloadFile(content: string, fileName: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
