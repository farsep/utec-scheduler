import React, { useState, useEffect } from 'react';
import { X, Calendar, Image, FileSpreadsheet, Download, RefreshCw, Bell, BellOff, Palette, Layers, Clock } from 'lucide-react';
import { generateICS, downloadFile } from '../utils/icsExporter';
import { formatLocation, getCourseColor, getCoursePrefix, getScheduleColorMap } from '../utils/scheduleUtils';
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

const ALARM_SEGMENTS = [
  { value: 0, label: 'Sin alarma' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min ★' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hora' }
];

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
  const [reminderMinutes, setReminderMinutes] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('utec_reminder_minutes');
      return saved !== null ? Number(saved) : 15;
    }
    return 15;
  });
  const [isGCalModalOpen, setIsGCalModalOpen] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSelectReminder = (minutes: number) => {
    setReminderMinutes(minutes);
    if (typeof window !== 'undefined') {
      localStorage.setItem('utec_reminder_minutes', String(minutes));
    }
  };

  const handleExportICS = () => {
    const icsContent = generateICS(courses, selectedSections, icsColorMode, reminderMinutes);
    downloadFile(icsContent, `Horario_UTEC_${optionName.replace(/\s+/g, '_')}.ics`, 'text/calendar;charset=utf-8');
  };

  const handleExportImage = async () => {
    const gridElem = document.querySelector('.timetable-grid-wrapper') as HTMLElement;
    if (!gridElem || isExportingImage) return;

    setIsExportingImage(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(gridElem, {
        scale: 2,
        backgroundColor: '#F2F0EC',
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

    const csvContent = '\uFEFF' + rows.map(row => row.map(escapeCSVCell).join(',')).join('\r\n');
    downloadFile(csvContent, `Cursos_Seleccionados_${optionName.replace(/\s+/g, '_')}.csv`, 'text/csv;charset=utf-8;');
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Exportar u Organizar Horario"
          className="modal-card export-modal-card"
          onClick={e => e.stopPropagation()}
          style={{
            backgroundColor: '#F2F0EC',
            border: '2px solid #18181A',
            borderTop: '4px solid #18181A',
            borderRadius: '0px',
            boxShadow: '6px 6px 0px #18181A',
            maxWidth: '620px',
            width: '94%',
            padding: '20px',
            boxSizing: 'border-box'
          }}
        >
          {/* Header */}
          <div
            className="modal-header"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '14px',
              paddingBottom: '12px',
              borderBottom: '1.5px solid #18181A'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  backgroundColor: '#DCD9D2',
                  border: '1.5px solid #18181A',
                  borderRadius: '0px',
                  color: '#141416',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Download size={18} />
              </div>
              <div>
                <h3
                  className="modal-title"
                  style={{
                    fontFamily: 'var(--font-heading, Space Grotesk)',
                    fontWeight: 700,
                    fontSize: '1.05rem',
                    color: '#141416',
                    margin: 0
                  }}
                >
                  Exportar u Organizar Horario ({optionName})
                </h3>
                <span
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '11px',
                    color: '#5A5852'
                  }}
                >
                  SINCRONIZACIÓN Y FORMATOS OFICIALES · UTEC 2026-2
                </span>
              </div>
            </div>
            <button
              type="button"
              className="close-btn"
              onClick={onClose}
              aria-label="Cerrar modal de exportación"
              style={{
                width: '32px',
                height: '32px',
                border: '1px solid #18181A',
                backgroundColor: '#DCD9D2',
                borderRadius: '0px',
                color: '#141416',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          </div>

          <p
            style={{
              fontFamily: 'var(--font-body, Inter)',
              fontSize: '12.5px',
              color: '#4A4946',
              marginTop: 0,
              marginBottom: '14px',
              lineHeight: 1.4
            }}
          >
            Selecciona el formato o servicio con el que deseas sincronizar tu horario semanal.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* 1. Google Calendar Direct Sync Option */}
            <div
              className="export-card"
              style={{
                backgroundColor: '#FAF9F5',
                border: '1px solid #18181A',
                borderTop: '2px solid #18181A',
                borderRadius: '0px',
                padding: '12px 14px',
                cursor: 'pointer'
              }}
              onClick={() => setIsGCalModalOpen(true)}
            >
              <div className="export-card-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div className="export-card-info" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0 }}>
                  <div
                    className="export-card-icon"
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '0px',
                      border: '1.5px solid #18181A',
                      backgroundColor: '#E0EBF5',
                      color: '#005A78',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '15px',
                      fontWeight: 700
                    }}
                  >
                    31
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="export-card-title" style={{ fontFamily: 'var(--font-heading, Space Grotesk)', fontWeight: 700, fontSize: '13.5px', color: '#141416' }}>
                        Google Calendar
                      </span>
                      <span
                        style={{
                          backgroundColor: '#18181A',
                          color: '#F2F0EC',
                          borderLeft: '3px solid #0D7A4E',
                          borderRadius: '0px',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 8px'
                        }}
                      >
                        DIRECTO
                      </span>
                    </div>
                    <div className="export-card-desc" style={{ fontSize: '11.5px', color: '#5A5852', marginTop: '2px', lineHeight: 1.35 }}>
                      {isConsolidado
                        ? 'Agrega y sincroniza directamente las clases de tu Consolidado en tu Google Calendar sin archivos intermedios.'
                        : 'Sincroniza y actualiza todos tus cursos seleccionados en un calendario dedicado de Google.'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-export-action"
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#00779E',
                    color: '#FFFFFF',
                    border: '1px solid #18181A',
                    borderRadius: '0px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    boxShadow: '2px 2px 0px #18181A',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  Conectar
                </button>
              </div>
            </div>

            {/* 2. iCal Export (.ics) */}
            <div
              className="export-card"
              style={{
                backgroundColor: '#FAF9F5',
                border: '1px solid #18181A',
                borderTop: '2px solid #18181A',
                borderRadius: '0px',
                padding: '12px 14px'
              }}
            >
              <div className="export-card-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div className="export-card-info" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0 }}>
                  <div
                    className="export-card-icon"
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '0px',
                      border: '1.5px solid #18181A',
                      backgroundColor: '#DCD9D2',
                      color: '#141416',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Calendar size={22} color="#141416" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="export-card-title" style={{ fontFamily: 'var(--font-heading, Space Grotesk)', fontWeight: 700, fontSize: '13.5px', color: '#141416' }}>
                      Calendario iCal (.ics)
                    </div>
                    <div className="export-card-desc" style={{ fontSize: '11.5px', color: '#5A5852', marginTop: '2px', lineHeight: 1.35 }}>
                      Exporta un archivo universal compatible con Apple Calendar, Outlook, Google Calendar y apps móviles.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-export-action"
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#00779E',
                    color: '#FFFFFF',
                    border: '1px solid #18181A',
                    borderRadius: '0px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    boxShadow: '2px 2px 0px #18181A',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                  onClick={handleExportICS}
                >
                  Descargar .ics
                </button>
              </div>

              {/* Color Scheme Switcher */}
              <div
                style={{
                  backgroundColor: '#EAE7E1',
                  border: '1px solid #C6C3BB',
                  borderLeft: '3px solid #18181A',
                  borderRadius: '0px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  marginTop: '10px'
                }}
              >
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: '#141416', letterSpacing: '0.02em' }}>
                  Esquema de colores de los eventos en el archivo .ics:
                </div>
                <div className="export-color-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setIcsColorMode('prefix')}
                    style={{
                      padding: '8px 10px',
                      fontSize: '11px',
                      borderRadius: '0px',
                      border: '1px solid #18181A',
                      borderTop: icsColorMode === 'prefix' ? '3px solid #00779E' : '1px solid #C6C3BB',
                      backgroundColor: icsColorMode === 'prefix' ? '#18181A' : '#F2F0EC',
                      color: icsColorMode === 'prefix' ? '#F2F0EC' : '#4A4946',
                      fontWeight: icsColorMode === 'prefix' ? 700 : 500,
                      fontFamily: 'JetBrains Mono, monospace',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <Palette size={13} />
                    <span>Por categoría (prefijos CS, CC...)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIcsColorMode('course')}
                    style={{
                      padding: '8px 10px',
                      fontSize: '11px',
                      borderRadius: '0px',
                      border: '1px solid #18181A',
                      borderTop: icsColorMode === 'course' ? '3px solid #00779E' : '1px solid #C6C3BB',
                      backgroundColor: icsColorMode === 'course' ? '#18181A' : '#F2F0EC',
                      color: icsColorMode === 'course' ? '#F2F0EC' : '#4A4946',
                      fontWeight: icsColorMode === 'course' ? 700 : 500,
                      fontFamily: 'JetBrains Mono, monospace',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <Layers size={13} />
                    <span>Un color por cada curso</span>
                  </button>
                </div>

                {/* Swatch Preview Bar */}
                {Object.keys(selectedSections).length > 0 && (() => {
                  const colorMap = getScheduleColorMap(Object.keys(selectedSections), icsColorMode);
                  return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '4px', paddingTop: '6px', borderTop: '1px dashed #C6C3BB' }}>
                      {Object.keys(selectedSections).sort().map((code) => {
                        const course = courses.find(c => c.code === code);
                        const prefix = getCoursePrefix(code);
                        const color = colorMap[code] || getCourseColor(code, icsColorMode);
                        return (
                          <span
                            key={code}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '11px',
                              padding: '2px 7px',
                              borderRadius: '0px',
                              backgroundColor: '#F2F0EC',
                              border: '1px solid #C6C3BB',
                              color: '#141416',
                              fontFamily: 'JetBrains Mono, monospace'
                            }}
                            title={`${course?.name || code} - Color: ${color}`}
                          >
                            <span style={{ width: '8px', height: '8px', borderRadius: '0px', backgroundColor: color, border: '1px solid #18181A' }} />
                            <span style={{ fontWeight: 700 }}>{code}</span>
                            {icsColorMode === 'prefix' && (
                              <span style={{ fontSize: '10px', color: '#5A5852' }}>({prefix})</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Precision Swiss Alarm Control Block */}
                <div
                  className="export-alarm-control-block"
                  style={{
                    backgroundColor: '#FAF9F5',
                    border: '1px solid #C6C3BB',
                    borderRadius: '0px',
                    padding: '10px 12px',
                    marginTop: '6px'
                  }}
                >
                  {/* Header Row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={13} color="#141416" />
                      <span
                        style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          color: '#141416'
                        }}
                      >
                        RECORDATORIO PREVIO (.ICS)
                      </span>
                    </div>
                    <span
                      style={{
                        backgroundColor: '#DCD9D2',
                        border: '1px solid #18181A',
                        padding: '2px 8px',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#141416',
                        borderRadius: '0px'
                      }}
                    >
                      {reminderMinutes === 0 ? 'DESACTIVADO' : `ACTIVO · -${reminderMinutes} MIN`}
                    </span>
                  </div>

                  {/* 5-Option Segmented Swiss Bar */}
                  <div
                    className="alarm-segmented-bar"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, 1fr)',
                      gap: '4px',
                      margin: '6px 0'
                    }}
                  >
                    {ALARM_SEGMENTS.map(seg => {
                      const isActive = reminderMinutes === seg.value;
                      return (
                        <button
                          key={seg.value}
                          type="button"
                          onClick={() => handleSelectReminder(seg.value)}
                          style={{
                            backgroundColor: isActive ? '#18181A' : '#F2F0EC',
                            color: isActive ? '#F2F0EC' : '#4A4946',
                            border: isActive ? '1px solid #18181A' : '1px solid #C6C3BB',
                            borderBottom: isActive ? '3px solid #00779E' : '1px solid #C6C3BB',
                            borderRadius: '0px',
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: '11px',
                            fontWeight: isActive ? 700 : 500,
                            padding: '6px 2px',
                            cursor: 'pointer',
                            textAlign: 'center'
                          }}
                        >
                          {seg.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Technical Footnote Box (ZERO GREEN TEXT) */}
                  <div
                    style={{
                      backgroundColor: '#F2F0EC',
                      border: '1px solid #C6C3BB',
                      borderLeft: '3px solid #00779E',
                      borderRadius: '0px',
                      padding: '6px 10px',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '10.5px',
                      color: '#4A4946',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginTop: '6px'
                    }}
                  >
                    {reminderMinutes === 0 ? (
                      <>
                        <BellOff size={13} style={{ flexShrink: 0, color: '#141416' }} />
                        <span>Se omitirá la regla VALARM en el archivo .ics exportado.</span>
                      </>
                    ) : (
                      <>
                        <Bell size={13} style={{ flexShrink: 0, color: '#141416' }} />
                        <span>
                          Se insertará una regla VALARM estándar (<strong>-PT{reminderMinutes}M</strong>) en cada bloque horario exportado ({reminderMinutes >= 60 ? '1 hora' : `${reminderMinutes} min`} antes).
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. PNG Image Export */}
            <div
              className="export-card"
              style={{
                backgroundColor: '#FAF9F5',
                border: '1px solid #18181A',
                borderTop: '2px solid #18181A',
                borderRadius: '0px',
                padding: '12px 14px',
                cursor: 'pointer'
              }}
              onClick={handleExportImage}
            >
              <div className="export-card-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div className="export-card-info" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0 }}>
                  <div
                    className="export-card-icon"
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '0px',
                      border: '1.5px solid #18181A',
                      backgroundColor: '#DCD9D2',
                      color: '#141416',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Image size={22} color="#141416" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="export-card-title" style={{ fontFamily: 'var(--font-heading, Space Grotesk)', fontWeight: 700, fontSize: '13.5px', color: '#141416' }}>
                      Imagen PNG de alta resolución
                    </div>
                    <div className="export-card-desc" style={{ fontSize: '11.5px', color: '#5A5852', marginTop: '2px', lineHeight: 1.35 }}>
                      Captura visual completa y nítida de tu grilla semanal para compartir o guardar como fondo.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-export-action"
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#DCD9D2',
                    color: '#141416',
                    border: '1px solid #18181A',
                    borderRadius: '0px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    boxShadow: '2px 2px 0px #18181A',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexShrink: 0
                  }}
                  disabled={isExportingImage}
                >
                  {isExportingImage ? <RefreshCw size={13} className="spin-icon" /> : null}
                  <span>{isExportingImage ? 'Generando...' : 'Descargar PNG'}</span>
                </button>
              </div>
            </div>

            {/* 4. CSV Export */}
            <div
              className="export-card"
              style={{
                backgroundColor: '#FAF9F5',
                border: '1px solid #18181A',
                borderTop: '2px solid #18181A',
                borderRadius: '0px',
                padding: '12px 14px',
                cursor: 'pointer'
              }}
              onClick={handleExportCSV}
            >
              <div className="export-card-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div className="export-card-info" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0 }}>
                  <div
                    className="export-card-icon"
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '0px',
                      border: '1.5px solid #18181A',
                      backgroundColor: '#DCD9D2',
                      color: '#141416',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <FileSpreadsheet size={22} color="#141416" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="export-card-title" style={{ fontFamily: 'var(--font-heading, Space Grotesk)', fontWeight: 700, fontSize: '13.5px', color: '#141416' }}>
                      Lista en CSV / Excel (UTF-8)
                    </div>
                    <div className="export-card-desc" style={{ fontSize: '11.5px', color: '#5A5852', marginTop: '2px', lineHeight: 1.35 }}>
                      Tabla detallada con códigos, secciones, grupos, docentes asignados y horas lectivas.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-export-action"
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#DCD9D2',
                    color: '#141416',
                    border: '1px solid #18181A',
                    borderRadius: '0px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    boxShadow: '2px 2px 0px #18181A',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
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
