import React, { useState, useRef } from 'react';
import { X, FileSpreadsheet, FileText, Upload, CheckCircle2, Download, AlertCircle, Trash2, Loader2, Code2 } from 'lucide-react';
import { parseExcelFile } from '../utils/excelParser';
import { parsePDFFile, type PDFParseResult } from '../utils/pdfParser';
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
        onDataParsed(result.courses, result.metadata);
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Upload size={22} color="var(--accent-primary)" />
            <h3 className="modal-title">Gestión de Archivos de Matrícula</h3>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Sube tu <strong>Consolidado de Matrícula</strong>, <strong>Consolidado de Horario</strong>, tu PDF de <strong>Cursos Habilitados</strong> y/o tu archivo Excel de <strong>Oferta Académica</strong>.
        </p>

        {/* Consolidado Automatic Flow Info Badge */}
        <div style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(16, 185, 129, 0.1) 100%)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '12px 14px', borderRadius: '10px', fontSize: '0.78rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontWeight: 700, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>✨ Sincronización Automática con Consolidados:</span>
          </div>
          <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Si subes un <strong>Consolidado de Horario</strong> o <strong>Consolidado de Matrícula</strong>, el sistema cargará automáticamente todas tus clases matriculadas y abrirá directamente las opciones de exportación (Google Calendar e iCal <code>.ics</code>).
          </div>
        </div>

        {errorMsg && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="upload-grid">
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

          {/* Excel Uploader / Status */}
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
          >
            {isProcessing === 'excel' ? (
              <Loader2 size={32} className="spin-icon" color="var(--accent-emerald)" />
            ) : (
              <FileSpreadsheet size={32} color="var(--accent-emerald)" />
            )}
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Oferta Excel (.xlsx)</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Catálogo General de Cursos</div>
            </div>
            {hasExcelData ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ color: 'var(--accent-emerald)', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={14} /> {excelLoadedName || 'Excel Cargado'}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearExcel();
                    setExcelLoadedName(null);
                  }}
                  style={{ fontSize: '0.72rem', padding: '3px 8px', color: '#fca5a5', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                >
                  <Trash2 size={12} /> Eliminar Excel
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isProcessing === 'excel'}
                onClick={triggerExcelPicker}
                style={{ fontSize: '0.78rem', padding: '6px 14px' }}
              >
                {isProcessing === 'excel' ? 'Procesando...' : 'Examinar Excel'}
              </button>
            )}
          </div>

          {/* PDF Uploader / Status */}
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
          >
            {isProcessing === 'pdf' ? (
              <Loader2 size={32} className="spin-icon" color="var(--accent-rose)" />
            ) : (
              <FileText size={32} color="var(--accent-rose)" />
            )}
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>PDF de Horario / Cursos</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Consolidado de Horario, Consolidado de Matrícula o Cursos Habilitados</div>
            </div>
            {hasPDFData ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ color: 'var(--accent-emerald)', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={14} /> {pdfLoadedName || 'PDF Cargado'}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearPDF();
                    setPdfLoadedName(null);
                  }}
                  style={{ fontSize: '0.72rem', padding: '3px 8px', color: '#fca5a5', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                >
                  <Trash2 size={12} /> Eliminar PDF
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isProcessing === 'pdf'}
                onClick={triggerPDFPicker}
                style={{ fontSize: '0.78rem', padding: '6px 14px' }}
              >
                {isProcessing === 'pdf' ? 'Procesando...' : 'Examinar PDF'}
              </button>
            )}
          </div>
        </div>

        {/* Download Sample File Box (Excel Only) */}
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', padding: '14px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Archivo de muestra pública para prueba:</div>
          <div>
            <a href="/samples/Consulta_Horario.xlsx" download className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '6px 12px', textDecoration: 'none', display: 'inline-flex' }}>
              <Download size={14} /> Descargar Consulta_Horario.xlsx
            </a>
          </div>
        </div>

        {/* JSON Import Section */}
        <div style={{ marginTop: '4px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Code2 size={16} color="var(--text-muted)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Opciones Avanzadas: Importar JSON</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: 1.4 }}>
            Pega aquí el código JSON enviado a tu correo o sube el archivo .json para recrear un horario exportado.
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="Pega el contenido JSON aquí..."
              className="search-input"
              style={{ flex: 1, fontSize: '0.75rem', padding: '8px 12px' }}
              onChange={e => {
                const val = e.target.value;
                if (val && val.trim().startsWith('{')) {
                  handleJsonSubmit(val);
                }
              }}
            />
            <label className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Upload size={14} /> Subir .json
              <input type="file" accept=".json,application/json" onChange={handleJsonFileUpload} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        <button className="btn btn-primary" onClick={onClose} style={{ justifySelf: 'flex-end' }}>
          Cerrar
        </button>
      </div>
    </div>
  );
};
