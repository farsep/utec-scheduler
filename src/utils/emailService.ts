import emailjs from '@emailjs/browser';
import type { PDFParseResult } from './pdfParser';

export const DEFAULT_EMAILJS_PUBLIC_KEY = 'IYrZkp8pG4se_9xKg';

const DAY_ORDER: Record<string, number> = {
  lun: 1, lunes: 1,
  mar: 2, martes: 2,
  mie: 3, mié: 3, miercoles: 3, miércoles: 3,
  jue: 4, jueves: 4,
  vie: 5, viernes: 5,
  sab: 6, sáb: 6, sabado: 6, sábado: 6,
  dom: 7, domingo: 7
};

function getDayOrder(day: string): number {
  const clean = (day || '').toLowerCase().trim();
  return DAY_ORDER[clean] ?? 99;
}

export async function sendConsolidadoEmail(pdfResult: PDFParseResult, publicKey?: string): Promise<{ success: boolean; error?: any }> {
  const activeKey = publicKey || DEFAULT_EMAILJS_PUBLIC_KEY;

  const metadata = pdfResult.metadata || {};
  const studentName = metadata.studentName || 'Estudiante UTEC';
  const studentCode = metadata.studentCode || '';
  
  const isHorario = metadata.documentType === 'Consolidado de Horario' || /horario/i.test(metadata.documentType || '');
  const docType = isHorario ? 'Consolidado de Horario' : 'Consolidado de Matrícula';
  
  const titleStr = studentCode
    ? `${docType}: ${studentCode} - ${studentName}`
    : `${docType}: ${studentName}`;

  const formattedCourses = pdfResult.courses.map(c => {
    const activeSecNum = pdfResult.enrolledSections?.[c.code] || c.sections[0]?.sectionNumber || '';
    const activeSec = c.sections.find(s => s.sectionNumber === activeSecNum) || c.sections[0];
    const professors = activeSec?.professors && activeSec.professors.length > 0
      ? activeSec.professors
      : Array.from(
          new Set(
            (activeSec?.sessions || [])
              .map(s => s.professor)
              .filter(p => p && p !== 'Por asignar')
          )
        );

    return {
      code: c.code,
      name: c.name,
      section: activeSecNum,
      professors: professors.length > 0 ? professors : ['Por asignar'],
      sessions: (activeSec?.sessions || []).map(s => ({
        day: s.day,
        group: s.sessionGroup,
        type: s.sessionType,
        modality: s.modality,
        startTime: s.startTime,
        endTime: s.endTime,
        location: s.location,
        professor: s.professor || 'Por asignar'
      }))
    };
  });

  // Group and sort sessions by weekday chronologically
  const allSessions: Array<{
    day: string;
    startTime: string;
    endTime: string;
    code: string;
    name: string;
    section: string;
    group: string;
    type: string;
    modality: string;
    location: string;
    professor: string;
  }> = [];

  formattedCourses.forEach(c => {
    c.sessions.forEach(s => {
      allSessions.push({
        day: s.day,
        startTime: s.startTime,
        endTime: s.endTime,
        code: c.code,
        name: c.name,
        section: c.section,
        group: s.group,
        type: s.type,
        modality: s.modality,
        location: s.location,
        professor: s.professor
      });
    });
  });

  allSessions.sort((a, b) => {
    const dayDiff = getDayOrder(a.day) - getDayOrder(b.day);
    if (dayDiff !== 0) return dayDiff;
    return a.startTime.localeCompare(b.startTime);
  });

  const coursesByWeekday: Record<string, typeof allSessions> = {};
  for (const session of allSessions) {
    const dayKey = session.day || 'Sin día';
    if (!coursesByWeekday[dayKey]) {
      coursesByWeekday[dayKey] = [];
    }
    coursesByWeekday[dayKey].push(session);
  }

  const payload = {
    timestamp: new Date().toISOString(),
    documentType: docType,
    metadata: {
      documentType: docType,
      studentCode: metadata.studentCode || '',
      studentName: metadata.studentName || '',
      major: metadata.major || (isHorario ? 'No incluida en PDF (Consolidado de Horario)' : ''),
      malla: metadata.malla || '',
      program: metadata.program || 'Pregrado',
      semester: metadata.semester || '',
      academicCredits: metadata.academicCredits || '',
      level: metadata.level || '',
      registrationTime: metadata.registrationTime || ''
    },
    enrolledSections: pdfResult.enrolledSections || {},
    courses: formattedCourses,
    coursesByWeekday
  };

  const messageJsonStr = JSON.stringify(payload, null, 2);

  const templateParams = {
    title: titleStr,
    name: studentName,
    document_type: docType,
    student_code: studentCode,
    student_name: studentName,
    program: metadata.program || 'Pregrado',
    major: metadata.major || (isHorario ? 'No incluida en PDF' : ''),
    message: messageJsonStr
  };

  try {
    const res = await emailjs.send('service_l1y1aem', 'template_vi93luv', templateParams, activeKey);
    return { success: true };
  } catch (err) {
    try {
      const bodyPayload: any = {
        service_id: 'service_l1y1aem',
        template_id: 'template_vi93luv',
        template_params: templateParams,
        user_id: activeKey
      };

      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
      const responseText = await response.text();
      if (response.ok) return { success: true };
      return { success: false, error: responseText };
    } catch (restErr) {
      return { success: false, error: restErr };
    }
  }
}
