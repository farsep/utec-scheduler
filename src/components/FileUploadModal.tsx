import React, { useState } from 'react';
import { X, FileSpreadsheet, FileText, Upload, CheckCircle2, Download, AlertCircle } from 'lucide-react';
import { parseExcelFile } from '../utils/excelParser';
import { parsePDFFile } from '../utils/pdfParser';
import type { Course, MetadataInfo } from '../types/schedule';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataParsed: (courses: Course[], metadata: MetadataInfo) => void;
  onPDFParsed: (eligibleCodes: Set<string>, map: Map<string, { type: string; plan?: string }>) => void;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  onDataParsed,
  onPDFParsed
}) => {
  const [excelLoaded, setExcelLoaded] = useState<string | null>(null);
  const [pdfLoaded, setPdfLoaded] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleExcelDrop = (file: File) => {
    setIsProcessing(true);
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
          setExcelLoaded(file.name);
        }
      } catch (err) {
        setErrorMsg('Error al leer el archivo Excel.');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handlePDFDrop = async (file: File) => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const buffer = await file.arrayBuffer();
      const result = await parsePDFFile(buffer);
      if (result.eligibleCourseCodes.size === 0) {
        setErrorMsg('No se detectaron códigos de curso en el PDF de Cursos Habilitados.');
      } else {
        onPDFParsed(result.eligibleCourseCodes, result.eligibleCoursesMap);
        setPdfLoaded(file.name);
      }
    } catch (err) {
      setErrorMsg('Error al procesar el archivo PDF.');
    } finally {
      setIsProcessing(false);
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
            <h3 className="modal-title">Subir Archivos de Matrícula</h3>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Carga la lista completa de horarios publicada en Excel y/o tu ficha de <strong>Cursos Habilitados</strong> en PDF para filtrar tus alternativas correspondientes al semestre.
        </p>

        {errorMsg && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Excel Uploader */}
          <div className={`dropzone-container ${excelLoaded ? 'active' : ''}`}>
            <FileSpreadsheet size={32} color="var(--accent-emerald)" />
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>1. Oferta Completa (.xlsx)</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Archivo Consulta_Horario.xlsx</div>
            </div>
            {excelLoaded ? (
              <div style={{ color: 'var(--accent-emerald)', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={14} /> {excelLoaded}
              </div>
            ) : (
              <label className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }}>
                Examinar Excel
                <input type="file" accept=".xlsx, .xls, .csv" onChange={e => handleFileChange(e, 'excel')} style={{ display: 'none' }} />
              </label>
            )}
          </div>

          {/* PDF Uploader */}
          <div className={`dropzone-container ${pdfLoaded ? 'active' : ''}`}>
            <FileText size={32} color="var(--accent-rose)" />
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>2. Cursos Habilitados (.pdf)</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PDF de Matrícula Alumno</div>
            </div>
            {pdfLoaded ? (
              <div style={{ color: 'var(--accent-emerald)', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={14} /> {pdfLoaded}
              </div>
            ) : (
              <label className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }}>
                Examinar PDF
                <input type="file" accept=".pdf" onChange={e => handleFileChange(e, 'pdf')} style={{ display: 'none' }} />
              </label>
            )}
          </div>
        </div>

        {/* Download Sample Files Box */}
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', padding: '14px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Archivos de muestra incluidos para pruebas:</div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <a href="/samples/Consulta_Horario.xlsx" download className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 10px', textDecoration: 'none' }}>
              <Download size={14} /> Consulta_Horario.xlsx
            </a>
            <a href="/samples/cursos_habilitados.pdf" download className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 10px', textDecoration: 'none' }}>
              <Download size={14} /> cursos_habilitados.pdf
            </a>
          </div>
        </div>

        <button className="btn btn-primary" onClick={onClose} style={{ justifySelf: 'flex-end' }}>
          Listo
        </button>
      </div>
    </div>
  );
};
