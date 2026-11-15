import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, FileSpreadsheet, FileText, Upload, CheckCircle2, Download, AlertCircle, Trash2, Loader2, Code2 } from 'lucide-react';
import { parseExcelFile } from '../utils/excelParser';
import { parsePDFFile, type PDFParseResult } from '../utils/pdfParser';
import { getClassroomsCatalog } from '../utils/masterDataLoader';
import { mutuallyEnrichCoursesWithScrapedData } from '../utils/courseDirectoryUtils';
import type { Course, MetadataInfo } from '../types/schedule';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataParsed: (courses: Course[], metadata: MetadataInfo) => void;
  onPDFParsed: (result: PDFParseResult) => void;
  onClearExcel: () => void;
  onClearPDF: () => void;
  hasExcelData: boolean;
  hasPDFData: boolean;
}

const EXCEL_ACCEPT = '.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/comma-separated-values';
const PDF_ACCEPT = '.pdf,application/pdf';

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  onDataParsed,
  onPDFParsed,
  onClearExcel,
  onClearPDF,
  hasExcelData,
  hasPDFData
}) => {
  const [excelLoadedName, setExcelLoadedName] = useState<string | null>(null);
  const [pdfLoadedName, setPdfLoadedName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<'excel' | 'pdf' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDraggingExcel, setIsDraggingExcel] = useState(false);
  const [isDraggingPDF, setIsDraggingPDF] = useState(false);

  const excelInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const readFileBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error('Formato de datos no válido'));
        }
      };
      reader.onerror = () => {
        reject(reader.error || new Error('No se pudo leer el archivo en el dispositivo'));
      };
      try {
        reader.readAsArrayBuffer(file);
      } catch (e) {
        if (typeof file.arrayBuffer === 'function') {
          file.arrayBuffer().then(resolve).catch(reject);
        } else {
          reject(e);
        }
      }
    });
  };

  const readFileText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  };

  const handleExcelFile = async (file: File) => {
    setErrorMsg(null);
    setIsProcessing('excel');
    try {
      const buffer = await readFileBuffer(file);
      const result = parseExcelFile(buffer);
      if (result.courses.length === 0) {
        setErrorMsg('No se pudieron encontrar cursos válidos en el archivo Excel.');
      } else {
        let coursesToUse = result.courses;
        try {
          const classrooms = await getClassroomsCatalog();
          if (Array.isArray(classrooms) && classrooms.length > 0) {
            coursesToUse = mutuallyEnrichCoursesWithScrapedData(result.courses, classrooms);
          }
        } catch {
          // fallback to raw Excel if classroom catalog is unavailable
        }
        onDataParsed(coursesToUse, result.metadata);
        setExcelLoadedName(file.name);
      }
    } catch (err: any) {
      console.error('Excel parse error:', err);
      setErrorMsg(err.message || 'Error al leer el archivo Excel.');
    } finally {
      setIsProcessing(null);
      if (excelInputRef.current) excelInputRef.current.value = '';
    }
  };

  const handlePDFFile = async (file: File) => {
    setErrorMsg(null);
    setIsProcessing('pdf');
    try {
      const buffer = await readFileBuffer(file);
      const result = await parsePDFFile(buffer);
      if (result.courses.length === 0 && result.eligibleCourseCodes.size === 0) {
        setErrorMsg('No se pudieron encontrar cursos o horarios en el archivo PDF.');
      } else {
        onPDFParsed(result);
        setPdfLoadedName(file.name);
      }
    } catch (err: any) {
      console.error('PDF parse error:', err);
      setErrorMsg(err.message || 'Error al procesar el archivo PDF.');
    } finally {
      setIsProcessing(null);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  const handleJsonSubmit = async (jsonString: string) => {
    setErrorMsg(null);
    try {
      const parsed = JSON.parse(jsonString);
      
      if (!parsed.courses || !parsed.metadata) {
        throw new Error('El JSON no tiene el formato correcto (faltan courses o metadata)');
      }

      const pdfResult: PDFParseResult = {
        metadata: {
          ...parsed.metadata,
          isJsonImport: true
        },
        courses: parsed.courses.map((c: any) => ({
          code: c.code,
          name: c.name,
          color: '',
          sections: [{
            sectionNumber: c.section || '1',
            professors: c.professors || [],
            vacancies: 0,
            enrolled: 0,
            sessions: (c.sessions || []).map((s: any) => {
              let startMinutes = 0, endMinutes = 0;
              if (s.startTime && s.endTime) {
                const [sh, sm] = s.startTime.split(':').map(Number);
                const [eh, em] = s.endTime.split(':').map(Number);
                startMinutes = (sh * 60) + (sm || 0);
                endMinutes = (eh * 60) + (em || 0);
              }
              return {
                id: `${s.day}-${s.startTime}-${s.group}`,
                sessionGroup: s.group,
                sessionType: s.type || 'Teoría',
                modality: s.modality || 'Presencial',
                day: s.day,
                startTime: s.startTime,
                endTime: s.endTime,
                startMinutes,
                endMinutes,
                location: s.location || '',
                professor: s.professor || '',
                frequency: '',
                vacancies: 0,
                enrolled: 0,
                email: ''
              };
            })
          }]
        })),
        eligibleCourseCodes: new Set(),
        eligibleCoursesMap: new Map(),
        isConsolidado: true,
        enrolledSections: parsed.enrolledSections || {},
        extractedText: ''
      };

      onPDFParsed(pdfResult);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al parsear el JSON.');
    }
  };

  const handleJsonFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFileText(file);
      handleJsonSubmit(text);
    } catch (err: any) {
      setErrorMsg('No se pudo leer el archivo JSON.');
    }
    e.target.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'excel' | 'pdf') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (type === 'excel') {
      handleExcelFile(file);
    } else {
      handlePDFFile(file);
    }
  };

  const triggerExcelPicker = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    excelInputRef.current?.click();
  };

  const triggerPDFPicker = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    pdfInputRef.current?.click();
  };

  const modalContent = (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="Importar Oferta Académica"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '660px',
          width: '94%',
          maxHeight: '92dvh',
          overflowY: 'auto',
          backgroundColor: '#F2F0EC',
          border: '2px solid #18181A',
          borderTop: '4px solid #00668C',
          borderRadius: '0px',
          boxShadow: '6px 6px 0px #18181A',
          padding: '20px',
          gap: '14px'
        }}
      >
        <div
          className="modal-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '12px',
            borderBottom: '1.5px solid #18181A',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                backgroundColor: '#005A8C',
                color: '#FFFFFF',
                border: '1.5px solid #18181A',
                borderRadius: '0px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Upload size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: '#005A8C',
                  textTransform: 'uppercase'
                }}
              >
                ESTACIÓN DE INGESTA · UTEC
              </div>
              <h3
                className="modal-title"
                style={{
                  fontSize: '1.1rem',
                  color: '#141416',
                  fontWeight: 700,
                  margin: 0,
                  fontFamily: "var(--font-heading, 'Space Grotesk', sans-serif)"
                }}
              >
                Gestión de Archivos de Matrícula
              </h3>
            </div>
          </div>
          <button
            className="close-btn"
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '0px',
              border: '1.5px solid #18181A',
              backgroundColor: '#DCD9D2',
              color: '#141416',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '1.5px 1.5px 0px #18181A',
              flexShrink: 0
            }}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '0.84rem', color: '#4A4946', lineHeight: 1.5, margin: 0 }}>
          Sube tu <strong>Consolidado de Matrícula</strong>, <strong>Consolidado de Horario</strong>, tu PDF de <strong>Cursos Habilitados</strong> y/o tu archivo Excel de <strong>Oferta Académica</strong>.
        </p>

        {/* Consolidado Automatic Flow Info Banner */}
        <div
          style={{
            backgroundColor: '#E0EBF5',
            border: '1px solid #00668C',
            borderLeft: '4px solid #00668C',
            borderRadius: '0px',
            color: '#0A2E46',
            padding: '12px 14px',
            fontSize: '0.79rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}
        >
          <div
            className="w-7 h-7 bg-[#00668C] text-white border border-[#18181A] flex items-center justify-center shrink-0 rounded-none"
            style={{
              width: '28px',
              height: '28px',
              backgroundColor: '#00668C',
              color: '#FFFFFF',
              border: '1px solid #18181A',
              borderRadius: '0px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="2" y="2" width="8" height="10" stroke="currentColor" strokeWidth="1.6" />
              <path d="M5 6H8M5 8.5H7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
              <path d="M11 6V13H6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
              <path d="M12.8 7.6L11 5.8L9.2 7.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: '#0A2E46', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem' }}>
              Sincronización Automática con Consolidados:
            </div>
            <div style={{ color: '#0A2E46', lineHeight: 1.4 }}>
              Si subes un <strong>Consolidado de Horario</strong> o <strong>Consolidado de Matrícula</strong>, el sistema cargará automáticamente todas tus clases matriculadas y abrirá directamente las opciones de exportación (Google Calendar e iCal <code>.ics</code>).
            </div>
          </div>
        </div>

        {errorMsg && (
          <div
            style={{
              backgroundColor: '#F4E0E2',
              border: '1.5px solid #18181A',
              borderLeft: '4px solid #A82032',
              color: '#6E111E',
              padding: '10px 14px',
              borderRadius: '0px',
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <div
          className="upload-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '12px'
          }}
        >
          {/* Hidden File Inputs (accessible to all mobile browsers) */}
          <input
            ref={excelInputRef}
            type="file"
            accept={EXCEL_ACCEPT}
            onChange={e => handleFileChange(e, 'excel')}
            style={{ position: 'absolute', opacity: 0, width: '1px', height: '1px', pointerEvents: 'none', zIndex: -1 }}
            aria-hidden="true"
          />
          <input
            ref={pdfInputRef}
            type="file"
            accept={PDF_ACCEPT}
            onChange={e => handleFileChange(e, 'pdf')}
            style={{ position: 'absolute', opacity: 0, width: '1px', height: '1px', pointerEvents: 'none', zIndex: -1 }}
            aria-hidden="true"
          />

          {/* Bay 1: 01 · OFERTA ACADÉMICA (.XLSX) */}
          <div
            className={`dropzone-container ${hasExcelData ? 'active' : ''} ${isDraggingExcel ? 'dragging' : ''}`}
            onClick={() => !hasExcelData && !isProcessing && triggerExcelPicker()}
            onDragOver={e => { e.preventDefault(); setIsDraggingExcel(true); }}
            onDragLeave={() => setIsDraggingExcel(false)}
            onDrop={e => {
              e.preventDefault();
              setIsDraggingExcel(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleExcelFile(file);
            }}
            style={{
              backgroundColor: isDraggingExcel ? '#DCEEE6' : '#FAF9F5',
              border: '1.5px solid #18181A',
              borderTop: '4px solid #0D7A4E',
              borderRadius: '0px',
              padding: '16px',
              boxShadow: '2px 2px 0px rgba(24,24,26,0.08)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '12px',
              cursor: hasExcelData ? 'default' : 'pointer'
            }}
          >
            <div style={{ width: '100%' }}>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  color: '#094D31',
                  textTransform: 'uppercase',
                  marginBottom: '10px'
                }}
              >
                01 · OFERTA ACADÉMICA (.XLSX)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  className="bg-[#DCEEE6] text-[#094D31] border-[1.5px] border-[#18181A] rounded-none"
                  style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: '#DCEEE6',
                    color: '#094D31',
                    border: '1.5px solid #18181A',
                    borderRadius: '0px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  {isProcessing === 'excel' ? (
                    <Loader2 size={20} className="spin-icon" />
                  ) : (
                    <FileSpreadsheet size={20} />
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#141416', fontFamily: "var(--font-heading, 'Space Grotesk', sans-serif)" }}>
                    Oferta Excel (.xlsx)
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#4A4946', marginTop: '2px' }}>
                    Catálogo General de Cursos
                  </div>
                </div>
              </div>
            </div>

            {hasExcelData ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px', width: '100%' }}>
                <span
                  className="bg-[#0D7A4E] text-white border border-[#18181A] px-2.5 py-0.5 font-mono text-[10.5px] font-bold uppercase rounded-none inline-flex items-center gap-1"
                  style={{
                    backgroundColor: '#0D7A4E',
                    color: '#FFFFFF',
                    border: '1px solid #18181A',
                    borderRadius: '0px',
                    padding: '2px 10px',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '10.5px',
                    fontWeight: 700,
                    textTransform: 'uppercase'
                  }}
                >
                  ✓ EXCEL CARGADO
                </span>
                {excelLoadedName && (
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '10.5px',
                      color: '#4A4946',
                      wordBreak: 'break-all'
                    }}
                  >
                    {excelLoadedName}
                  </div>
                )}
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onClearExcel();
                    setExcelLoadedName(null);
                  }}
                  className="bg-[#F4E0E2] hover:bg-[#A82032] text-[#6E111E] hover:text-white border border-[#A82032] px-3 py-1.5 font-mono text-[11px] font-bold uppercase rounded-none cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Trash2 size={12} /> Eliminar Excel
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isProcessing === 'excel'}
                onClick={e => {
                  e.stopPropagation();
                  triggerExcelPicker();
                }}
                className="bg-[#0D7A4E] hover:bg-[#095939] text-white border-[1.5px] border-[#18181A] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider rounded-none shadow-[2px_2px_0px_#18181A] cursor-pointer inline-flex items-center gap-1.5"
              >
                <Upload size={13} />
                {isProcessing === 'excel' ? 'Procesando...' : 'Examinar Excel'}
              </button>
            )}
          </div>

          {/* Bay 2: 02 · CONSOLIDADO / HORARIO (.PDF) */}
          <div
            className={`dropzone-container ${hasPDFData ? 'active' : ''} ${isDraggingPDF ? 'dragging' : ''}`}
            onClick={() => !hasPDFData && !isProcessing && triggerPDFPicker()}
            onDragOver={e => { e.preventDefault(); setIsDraggingPDF(true); }}
            onDragLeave={() => setIsDraggingPDF(false)}
            onDrop={e => {
              e.preventDefault();
              setIsDraggingPDF(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handlePDFFile(file);
            }}
            style={{
              backgroundColor: isDraggingPDF ? '#F9E3E1' : '#FAF9F5',
              border: '1.5px solid #18181A',
              borderTop: '4px solid #B8332A',
              borderRadius: '0px',
              padding: '16px',
              boxShadow: '2px 2px 0px rgba(24,24,26,0.08)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '12px',
              cursor: hasPDFData ? 'default' : 'pointer'
            }}
          >
            <div style={{ width: '100%' }}>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  color: '#6E111E',
                  textTransform: 'uppercase',
                  marginBottom: '10px'
                }}
              >
                02 · CONSOLIDADO / HORARIO (.PDF)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  className="bg-[#F9E3E1] text-[#6E111E] border-[1.5px] border-[#18181A] rounded-none"
                  style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: '#F9E3E1',
                    color: '#6E111E',
                    border: '1.5px solid #18181A',
                    borderRadius: '0px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  {isProcessing === 'pdf' ? (
                    <Loader2 size={20} className="spin-icon" />
                  ) : (
                    <FileText size={20} />
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#141416', fontFamily: "var(--font-heading, 'Space Grotesk', sans-serif)" }}>
                    PDF de Horario / Cursos
                  </div>
                  <div style={{ fontSize: '0.73rem', color: '#4A4946', marginTop: '2px', lineHeight: 1.3 }}>
                    Consolidado de Horario, Matrícula o Cursos Habilitados
                  </div>
                </div>
              </div>
            </div>

            {hasPDFData ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px', width: '100%' }}>
                <span
                  className="bg-[#0D7A4E] text-white border border-[#18181A] px-2.5 py-0.5 font-mono text-[10.5px] font-bold uppercase rounded-none inline-flex items-center gap-1"
                  style={{
                    backgroundColor: '#0D7A4E',
                    color: '#FFFFFF',
                    border: '1px solid #18181A',
                    borderRadius: '0px',
                    padding: '2px 10px',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '10.5px',
                    fontWeight: 700,
                    textTransform: 'uppercase'
                  }}
                >
                  ✓ PDF CARGADO
                </span>
                {pdfLoadedName && (
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '10.5px',
                      color: '#4A4946',
                      wordBreak: 'break-all'
                    }}
                  >
                    {pdfLoadedName}
                  </div>
                )}
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onClearPDF();
                    setPdfLoadedName(null);
                  }}
                  className="bg-[#F4E0E2] hover:bg-[#A82032] text-[#6E111E] hover:text-white border border-[#A82032] px-3 py-1.5 font-mono text-[11px] font-bold uppercase rounded-none cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Trash2 size={12} /> Eliminar PDF
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isProcessing === 'pdf'}
                onClick={e => {
                  e.stopPropagation();
                  triggerPDFPicker();
                }}
                className="bg-[#00668C] hover:bg-[#18181A] text-white border-[1.5px] border-[#18181A] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider rounded-none shadow-[2px_2px_0px_#18181A] cursor-pointer inline-flex items-center gap-1.5"
              >
                <Upload size={13} />
                {isProcessing === 'pdf' ? 'Procesando...' : 'Examinar PDF'}
              </button>
            )}
          </div>
        </div>

        {/* Download Sample File Box (Excel Only) */}
        <div
          style={{
            backgroundColor: '#FAF9F5',
            border: '1px solid #18181A',
            padding: '12px 14px',
            borderRadius: '0px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#141416', fontFamily: "'JetBrains Mono', monospace" }}>
            Archivo de muestra pública para prueba:
          </div>
          <a
            href="/samples/Consulta_Horario.xlsx"
            download
            style={{
              fontSize: '0.73rem',
              padding: '6px 12px',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#DCD9D2',
              color: '#141416',
              border: '1px solid #18181A',
              borderRadius: '0px',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              boxShadow: '2px 2px 0px #18181A'
            }}
          >
            <Download size={14} /> Descargar Consulta_Horario.xlsx
          </a>
        </div>

        {/* JSON Import Section */}
        <div style={{ marginTop: '2px', borderTop: '1.5px solid #18181A', paddingTop: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Code2 size={16} color="#141416" />
            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#141416', fontFamily: "'JetBrains Mono', monospace" }}>
              Opciones Avanzadas: Importar JSON
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#4A4946', lineHeight: 1.4, margin: '0 0 8px 0' }}>
            Pega aquí el código JSON enviado a tu correo o sube el archivo .json para recrear un horario exportado.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <input
              type="text"
              placeholder="Pega el contenido JSON aquí..."
              className="search-input"
              style={{
                flex: '1 1 200px',
                minWidth: 0,
                fontSize: '0.75rem',
                padding: '8px 12px',
                backgroundColor: '#FAF9F5',
                border: '1px solid #18181A',
                borderRadius: '0px',
                color: '#141416',
                fontFamily: "'JetBrains Mono', monospace"
              }}
              onChange={e => {
                const val = e.target.value;
                if (val && val.trim().startsWith('{')) {
                  handleJsonSubmit(val);
                }
              }}
            />
            <label
              style={{
                fontSize: '0.75rem',
                padding: '7px 12px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#DCD9D2',
                color: '#141416',
                border: '1px solid #18181A',
                borderRadius: '0px',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                boxShadow: '2px 2px 0px #18181A',
                whiteSpace: 'nowrap'
              }}
            >
              <Upload size={14} /> ↑ Subir .json
              <input type="file" accept=".json,application/json" onChange={handleJsonFileUpload} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '6px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 20px',
              backgroundColor: '#DCD9D2',
              color: '#141416',
              border: '1.5px solid #18181A',
              borderRadius: '0px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              boxShadow: '2px 2px 0px #18181A',
              cursor: 'pointer'
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
