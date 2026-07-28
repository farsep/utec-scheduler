import React from 'react';
import { X, Calendar, Image, FileSpreadsheet, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { generateICS, downloadFile } from '../utils/icsExporter';
import type { Course } from '../types/schedule';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  selectedSections: Record<string, string>;
  optionName: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  courses,
  selectedSections,
  optionName
}) => {
  if (!isOpen) return null;

  const handleExportICS = () => {
    const icsContent = generateICS(courses, selectedSections);
    downloadFile(icsContent, `Horario_UTEC_${optionName.replace(/\s+/g, '_')}.ics`, 'text/calendar;charset=utf-8');
  };

  const handleExportImage = async () => {
    const gridElem = document.querySelector('.timetable-grid-wrapper') as HTMLElement;
    if (!gridElem) return;
    try {
      const canvas = await html2canvas(gridElem, {
        scale: 2,
        backgroundColor: '#0a0d14'
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
    const rows = [['Codigo', 'Curso', 'Seccion', 'Creditos']];
    Object.entries(selectedSections).forEach(([code, sec]) => {
      const course = courses.find(c => c.code === code);
      if (course) {
        rows.push([code, `"${course.name}"`, sec, String(course.credits || 3)]);
      }
    });
    const csvContent = rows.map(e => e.join(',')).join('\n');
    downloadFile(csvContent, `Cursos_Seleccionados_${optionName.replace(/\s+/g, '_')}.csv`, 'text/csv;charset=utf-8');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Download size={22} color="var(--accent-primary)" />
            <h3 className="modal-title">Exportar Horario ({optionName})</h3>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Selecciona el formato en el que deseas guardar o sincronizar tu horario semanal.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* iCal Export */}
          <div
            className="course-card"
            style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
            onClick={handleExportICS}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '10px', borderRadius: '10px', color: 'var(--accent-primary)' }}>
                <Calendar size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Calendario iCal (.ics)</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Importar en Google Calendar, Apple Calendar u Outlook</div>
              </div>
            </div>
            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>Descargar</button>
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
                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Lista en CSV / Excel</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Resumen de cursos y secciones elegidas</div>
              </div>
            </div>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>Descargar</button>
          </div>
        </div>
      </div>
    </div>
  );
};
