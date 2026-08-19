import React, { useState } from 'react';
import { X, Calendar, Image, FileSpreadsheet, Download, RefreshCw, Sparkles } from 'lucide-react';
import html2canvas from 'html2canvas';
import { generateICS, downloadFile } from '../utils/icsExporter';
import { formatLocation } from '../utils/scheduleUtils';
import { GoogleCalendarModal } from './GoogleCalendarModal';
import type { Course } from '../types/schedule';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  selectedSections: Record<string, string>;
  optionName: string;
  isConsolidado?: boolean;
}

function escapeCSVCell(val: string | number | undefined | null): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  courses,
  selectedSections,
  optionName,
  isConsolidado = false
}) => {
  if (!isOpen) return null;

  const [icsColorMode, setIcsColorMode] = useState<'prefix' | 'course'>('prefix');
  const [isGCalModalOpen, setIsGCalModalOpen] = useState(false);

  const handleExportICS = () => {
    const icsContent = generateICS(courses, selectedSections, icsColorMode);
    downloadFile(icsContent, `Horario_UTEC_${optionName.replace(/\s+/g, '_')}.ics`, 'text/calendar;charset=utf-8');
  };

  const handleExportImage = async () => {
    const gridElem = document.querySelector('.timetable-grid-wrapper') as HTMLElement;
    if (!gridElem) return;
    try {
      const canvas = await html2canvas(gridElem, {
        scale: 2,
        backgroundColor: '#080b11'
      });
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Horario_UTEC_${optionName.replace(/\s+/g, '_')}.png`;
      a.click();
    } catch (err) {
      console.error('Failed to export schedule image:', err);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Codigo',
      'Curso',
      'Seccion Principal',
      'Subseccion / Grupo',
      'Docente(s)',
      'Horarios y Sesiones',
      'Tipo',
      'Creditos'
    ];

    const rows: string[][] = [headers];

    Object.entries(selectedSections).forEach(([code, secNum]) => {
      const course = courses.find(c => c.code === code);
      if (!course) return;
      const section = course.sections.find(s => s.sectionNumber === secNum);
      if (!section) return;

      const mainSecNum = secNum.split(' (')[0];
      let subGroupLabel = '-';
      const matchParen = secNum.match(/\((.*?)\)/);
      if (matchParen && matchParen[1]) {
        subGroupLabel = matchParen[1];
      }

      // Unique professors
      const profsSet = new Set<string>();
      if (section.professors) {
        section.professors.forEach(p => {
          if (p && p !== 'Por asignar') profsSet.add(p);
        });
      }
      section.sessions.forEach(sess => {
        if (sess.professor && sess.professor !== 'Por asignar') profsSet.add(sess.professor);
      });
      const professorsStr = Array.from(profsSet).join('; ') || 'Por asignar';

      // Sessions breakdown string
      const sessionsStr = section.sessions.map(sess => {
        const mod = sess.modality ? ` (${sess.modality})` : '';
        const cleanLoc = formatLocation(sess.location);
        const loc = cleanLoc ? ` @ ${cleanLoc}` : '';
        return `${sess.sessionGroup}: ${sess.day} ${sess.startTime}-${sess.endTime}${mod}${loc}`;
      }).join(' | ');

      rows.push([
        code,
        course.name,
        mainSecNum,
        subGroupLabel,
        professorsStr,
        sessionsStr,
        course.courseType || 'Obligatorio',
        String((course as any).credits || 3)
      ]);
    });

    // Prepend UTF-8 BOM (\uFEFF) to ensure full Unicode support (accents, ñ, foreign languages) in Excel and all apps
    const csvContent = '\uFEFF' + rows.map(row => row.map(escapeCSVCell).join(',')).join('\r\n');
    downloadFile(csvContent, `Cursos_Seleccionados_${optionName.replace(/\s+/g, '_')}.csv`, 'text/csv;charset=utf-8;');
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Download size={22} color="var(--accent-primary)" />
              <h3 className="modal-title">Exportar u Organizar Horario ({optionName})</h3>
            </div>
            <button className="close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Selecciona el formato o servicio con el que deseas sincronizar tu horario semanal.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Google Calendar Direct Sync Option */}
            <div
              className="course-card"
              style={{
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, rgba(66, 133, 244, 0.15) 0%, rgba(52, 168, 83, 0.1) 100%)',
                border: '1px solid rgba(66, 133, 244, 0.4)',
                cursor: 'pointer'
              }}
              onClick={() => setIsGCalModalOpen(true)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#4285F4', padding: '10px', borderRadius: '10px', color: '#ffffff' }}>
                  <Calendar size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Sincronizar con Google Calendar
                    <span style={{ fontSize: '0.68rem', background: '#34A853', color: '#fff', padding: '2px 6px', borderRadius: '10px' }}>DIRECTO</span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    {isConsolidado ? 'Agrega o edita tus clases del Consolidado en tu Google Calendar' : 'Agrega y actualiza tus cursos directamente en Google Calendar'}
                  </div>
                </div>
              </div>
              <button
                className="btn btn-primary"
                style={{
                  padding: '8px 14px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  background: '#4285F4',
                  borderColor: '#4285F4'
                }}
              >
                Conectar / Sincronizar
              </button>
            </div>

            {/* iCal Export */}
            <div
              className="course-card"
              style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '10px', borderRadius: '10px', color: 'var(--accent-primary)' }}>
                    <Calendar size={22} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Calendario iCal (.ics)</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Importar archivo en Apple Calendar, Outlook u otros</div>
                  </div>
                </div>
                <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.78rem' }} onClick={handleExportICS}>Descargar</button>
              </div>

              {/* Color Mode Selector */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Esquema de colores de los eventos en el archivo .ics:
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setIcsColorMode('prefix')}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      fontSize: '0.74rem',
                      borderRadius: '6px',
                      border: icsColorMode === 'prefix' ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      background: icsColorMode === 'prefix' ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
                      color: icsColorMode === 'prefix' ? 'var(--accent-primary)' : 'var(--text-muted)',
                      fontWeight: icsColorMode === 'prefix' ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    🎨 Por categoría (prefijos CS, CC, HH...)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIcsColorMode('course')}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      fontSize: '0.74rem',
                      borderRadius: '6px',
                      border: icsColorMode === 'course' ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      background: icsColorMode === 'course' ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
                      color: icsColorMode === 'course' ? 'var(--accent-primary)' : 'var(--text-muted)',
                      fontWeight: icsColorMode === 'course' ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    🌈 Un color por cada curso
                  </button>
                </div>
              </div>
            </div>

            {/* PNG Image Export */}
            <div
              className="course-card"
              style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              onClick={handleExportImage}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '10px', borderRadius: '10px', color: 'var(--accent-emerald)' }}>
                  <Image size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Imagen PNG de alta resolución</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Captura visual completa de tu grilla semanal</div>
                </div>
              </div>
              <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>Descargar</button>
            </div>

            {/* CSV Export */}
            <div
              className="course-card"
              style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              onClick={handleExportCSV}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '10px', borderRadius: '10px', color: 'var(--accent-amber)' }}>
                  <FileSpreadsheet size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Lista en CSV / Excel (UTF-8)</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Resumen completo con subsecciones, docentes y horarios</div>
                </div>
              </div>
              <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>Descargar</button>
            </div>
          </div>
        </div>
      </div>

      <GoogleCalendarModal
        isOpen={isGCalModalOpen}
        onClose={() => setIsGCalModalOpen(false)}
        courses={courses}
        selectedSections={selectedSections}
        optionName={optionName}
        isConsolidado={isConsolidado}
      />
    </>
  );
};
