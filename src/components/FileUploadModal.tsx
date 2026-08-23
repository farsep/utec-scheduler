import React, { useState } from 'react';
import { X, FileSpreadsheet, FileText, Upload, CheckCircle2, Download, AlertCircle, Trash2 } from 'lucide-react';
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExcelDrop = (file: File) => {
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const result = parseExcelFile(buffer);
        if (result.courses.length === 0) {
          setErrorMsg('No se pudieron encontrar cursos válidos en el archivo Excel.');
        } else {
          onDataParsed(result.courses, result.metadata);
          setExcelLoadedName(file.name);
        }
      } catch (err) {
        setErrorMsg('Error al leer el archivo Excel.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handlePDFDrop = async (file: File) => {
    setErrorMsg(null);
    try {
      const buffer = await file.arrayBuffer();
      const result = await parsePDFFile(buffer);
      if (result.courses.length === 0 && result.eligibleCourseCodes.size === 0) {
        setErrorMsg('No se pudieron encontrar cursos o horarios en el archivo PDF.');
      } else {
        onPDFParsed(result);
        setPdfLoadedName(file.name);
      }
    } catch (err) {
      setErrorMsg('Error al procesar el archivo PDF.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'excel' | 'pdf') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (type === 'excel') handleExcelDrop(file);
    else handlePDFDrop(file);
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
          {/* Excel Uploader / Status */}
          <div className={`dropzone-container ${hasExcelData ? 'active' : ''}`}>
            <FileSpreadsheet size={32} color="var(--accent-emerald)" />
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
                  className="btn btn-secondary"
                  onClick={() => {
                    onClearExcel();
                    setExcelLoadedName(null);
                  }}
                  style={{ fontSize: '0.72rem', padding: '3px 8px', color: '#fca5a5', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                >
                  <Trash2 size={12} /> Eliminar Excel
                </button>
              </div>
            ) : (
              <label className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }}>
                Examinar Excel
                <input type="file" accept=".xlsx, .xls, .csv" onChange={e => handleFileChange(e, 'excel')} style={{ display: 'none' }} />
              </label>
            )}
          </div>

          {/* PDF Uploader / Status */}
          <div className={`dropzone-container ${hasPDFData ? 'active' : ''}`}>
            <FileText size={32} color="var(--accent-rose)" />
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
                  className="btn btn-secondary"
                  onClick={() => {
                    onClearPDF();
                    setPdfLoadedName(null);
                  }}
                  style={{ fontSize: '0.72rem', padding: '3px 8px', color: '#fca5a5', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                >
                  <Trash2 size={12} /> Eliminar PDF
                </button>
              </div>
            ) : (
              <label className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }}>
                Examinar PDF
                <input type="file" accept=".pdf" onChange={e => handleFileChange(e, 'pdf')} style={{ display: 'none' }} />
              </label>
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

        <button className="btn btn-primary" onClick={onClose} style={{ justifySelf: 'flex-end' }}>
          Cerrar
        </button>
      </div>
    </div>
  );
};
