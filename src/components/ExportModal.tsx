import React, { useState } from 'react';
import { X, Calendar, Image, FileSpreadsheet, Download, RefreshCw, Sparkles } from 'lucide-react';
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
  const [isExportingImage, setIsExportingImage] = useState(false);

  const handleExportICS = () => {
    const icsContent = generateICS(courses, selectedSections, icsColorMode);
    downloadFile(icsContent, `Horario_UTEC_${optionName.replace(/\s+/g, '_')}.ics`, 'text/calendar;charset=utf-8');
  };

  const handleExportImage = async () => {
    const gridElem = document.querySelector('.timetable-grid-wrapper') as HTMLElement;
    if (!gridElem || isExportingImage) return;

    setIsExportingImage(true);
    try {
      // Dynamically load html2canvas only when needed to keep initial bundle light
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(gridElem, {
        scale: 2,
        backgroundColor: '#080b11',
        logging: false,
        useCORS: true,
        allowTaint: true,
        removeContainer: true,
        imageTimeout: 0
      });
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Horario_UTEC_${optionName.replace(/\s+/g, '_')}.png`;
      a.click();
    } catch (err) {
      console.error('Failed to export schedule image:', err);
    } finally {
      setIsExportingImage(false);
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Google Calendar Direct Sync Option */}
            <div
              className="export-card"
              style={{
                background: 'linear-gradient(135deg, rgba(66, 133, 244, 0.12) 0%, rgba(52, 168, 83, 0.08) 100%)',
                border: '1px solid rgba(66, 133, 244, 0.35)',
                cursor: 'pointer'
              }}
              onClick={() => setIsGCalModalOpen(true)}
            >
              <div className="export-card-row">
                <div className="export-card-info">
                  <div className="export-card-icon" style={{ background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(66, 133, 244, 0.3)' }}>
                    <img src="/google-calendar-icon.svg" alt="Google Calendar" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="export-card-title">Google Calendar</span>
                      <span style={{ fontSize: '0.66rem', fontWeight: 700, background: '#10b981', color: '#ffffff', padding: '2px 7px', borderRadius: '10px', letterSpacing: '0.02em' }}>
                        DIRECTO
                      </span>
                    </div>
                    <div className="export-card-desc">
                      {isConsolidado
                        ? 'Agrega y sincroniza directamente las clases de tu Consolidado en tu Google Calendar sin archivos intermedios.'
                        : 'Sincroniza y actualiza todos tus cursos seleccionados en un calendario dedicado de Google.'}
                    </div>
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    background: '#4285F4',
                    borderColor: '#4285F4',
                    flexShrink: 0
                  }}
                >
                  Conectar
                </button>
              </div>
            </div>

            {/* iCal Export */}
            <div className="export-card">
              <div className="export-card-row">
                <div className="export-card-info">
                  <div className="export-card-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-primary)' }}>
                    <Calendar size={24} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="export-card-title">Calendario iCal (.ics)</div>
                    <div className="export-card-desc">
                      Exporta un archivo universal compatible con Apple Calendar, Outlook, Google Calendar y apps móviles.
                    </div>
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  style={{ padding: '8px 16px', fontSize: '0.82rem', flexShrink: 0 }}
                  onClick={handleExportICS}
                >
                  Descargar .ics
                </button>
              </div>

              {/* Color Mode Selector */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', borderRadius: '10px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border-color)', marginTop: '2px' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Esquema de colores de los eventos en el archivo .ics:
                </div>
                <div className="export-color-grid">
                  <button
                    type="button"
                    onClick={() => setIcsColorMode('prefix')}
                    style={{
                      padding: '8px 10px',
                      fontSize: '0.74rem',
                      borderRadius: '8px',
                      border: icsColorMode === 'prefix' ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      background: icsColorMode === 'prefix' ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
                      color: icsColorMode === 'prefix' ? 'var(--accent-primary)' : 'var(--text-muted)',
                      fontWeight: icsColorMode === 'prefix' ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'center'
                    }}
                  >
                    🎨 Por categoría (prefijos CS, CC...)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIcsColorMode('course')}
                    style={{
                      padding: '8px 10px',
                      fontSize: '0.74rem',
                      borderRadius: '8px',
                      border: icsColorMode === 'course' ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      background: icsColorMode === 'course' ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
                      color: icsColorMode === 'course' ? 'var(--accent-primary)' : 'var(--text-muted)',
                      fontWeight: icsColorMode === 'course' ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'center'
                    }}
                  >
                    🌈 Un color por cada curso
                  </button>
                </div>
              </div>
            </div>

            {/* PNG Image Export */}
            <div
              className="export-card"
              style={{ cursor: 'pointer' }}
              onClick={handleExportImage}
            >
              <div className="export-card-row">
                <div className="export-card-info">
                  <div className="export-card-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)' }}>
                    <Image size={24} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="export-card-title">Imagen PNG de alta resolución</div>
                    <div className="export-card-desc">Captura visual completa y nítida de tu grilla semanal para compartir o guardar como fondo.</div>
                  </div>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '0.82rem', gap: '6px', flexShrink: 0 }}
                  disabled={isExportingImage}
                >
                  {isExportingImage ? <RefreshCw size={14} className="spin-icon" /> : null}
                  <span>{isExportingImage ? 'Generando...' : 'Descargar PNG'}</span>
                </button>
              </div>
            </div>

            {/* CSV Export */}
            <div
              className="export-card"
              style={{ cursor: 'pointer' }}
              onClick={handleExportCSV}
            >
              <div className="export-card-row">
                <div className="export-card-info">
                  <div className="export-card-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)' }}>
                    <FileSpreadsheet size={24} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="export-card-title">Lista en CSV / Excel (UTF-8)</div>
                    <div className="export-card-desc">Tabla detallada con códigos, secciones, grupos, docentes asignados y horas lectivas.</div>
                  </div>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '0.82rem', flexShrink: 0 }}
                >
                  Descargar CSV
                </button>
              </div>
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
