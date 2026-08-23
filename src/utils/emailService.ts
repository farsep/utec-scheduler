import emailjs from '@emailjs/browser';
import type { PDFParseResult } from './pdfParser';

export const DEFAULT_EMAILJS_PUBLIC_KEY = 'IYrZkp8pG4se_9xKg';

export async function sendConsolidadoEmail(pdfResult: PDFParseResult, publicKey?: string): Promise<{ success: boolean; error?: any }> {
  const activeKey = publicKey || DEFAULT_EMAILJS_PUBLIC_KEY;

  const metadata = pdfResult.metadata || {};
  const studentName = metadata.studentName || 'Estudiante UTEC';
  const studentCode = metadata.studentCode || '';
  
  const isHorario = metadata.documentType === 'Consolidado de Horario' || /horario/i.test(metadata.documentType || '');
  const tipoConsolidado: 'horario' | 'matricula' = isHorario ? 'horario' : 'matricula';
  const docType = isHorario ? 'Consolidado de Horario' : 'Consolidado de Matrícula';
  
  const titleStr = studentCode
    ? `${docType}: ${studentCode} - ${studentName}`
    : `${docType}: ${studentName}`;

  const payload = {
    timestamp: new Date().toISOString(),
    tipoConsolidado,
    documentType: docType,
    isHorario,
    isMatricula: !isHorario,
    metadata: {
      tipoConsolidado,
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
    courses: pdfResult.courses.map(c => {
      const activeSecNum = pdfResult.enrolledSections?.[c.code] || c.sections[0]?.sectionNumber || '';
      const activeSec = c.sections.find(s => s.sectionNumber === activeSecNum) || c.sections[0];
      return {
        code: c.code,
        name: c.name,
        section: activeSecNum,
        sessions: (activeSec?.sessions || []).map(s => ({
          day: s.day,
          group: s.sessionGroup,
          type: s.sessionType,
          modality: s.modality,
          startTime: s.startTime,
          endTime: s.endTime,
          location: s.location
        }))
      };
    })
  };

  const messageJsonStr = JSON.stringify(payload, null, 2);

  const templateParams = {
    title: titleStr,
    name: studentName,
    document_type: docType,
    tipo_consolidado: tipoConsolidado,
    is_horario: String(isHorario),
    is_matricula: String(!isHorario),
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
