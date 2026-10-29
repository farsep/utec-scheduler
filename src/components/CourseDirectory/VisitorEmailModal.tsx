import React, { useState } from 'react';
import type { CourseExtendedInfo, CourseExtendedSection } from '../../types/courseDirectory';
import { generateVisitorEmailTemplate } from '../../utils/courseDirectoryUtils';
import { CustomSelect } from '../common/CustomSelect';
import {
  Mail,
  Copy,
  Check,
  ExternalLink,
  X,
  Sparkles,
  HelpCircle,
  GraduationCap,
  ShieldCheck,
  User,
  BookOpen
} from 'lucide-react';

interface VisitorEmailModalProps {
  course: CourseExtendedInfo;
  selectedSectionNumber?: string;
  onClose: () => void;
}

export const VisitorEmailModal: React.FC<VisitorEmailModalProps> = ({
  course,
  selectedSectionNumber = '1',
  onClose
}) => {
  const [sectionNum, setSectionNum] = useState<string>(selectedSectionNumber);
  const [studentName, setStudentName] = useState<string>('');
  const [studentMajor, setStudentMajor] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Find target section
  const targetSection = course.extendedSections.find(s => s.sectionNumber === sectionNum) || course.extendedSections[0];

  // Primary professor of section
  const sectionProf = targetSection && targetSection.sessions.length > 0
    ? targetSection.sessions.find(s => s.professor && !/docente\s*utec/i.test(s.professor))
    : null;

  const profName = sectionProf?.professor || course.uniqueProfessors[0]?.name || 'Docente UTEC';
  const profEmail = sectionProf?.email || course.uniqueProfessors[0]?.email || '';

  // Summary of days and hours
  const scheduleSummary = targetSection
    ? targetSection.sessions.map(s => `${s.day} ${s.startTime}-${s.endTime} (${s.roomDisplayName})`).join(', ')
    : '';

  const { subject, body, mailtoUrl } = generateVisitorEmailTemplate({
    courseCode: course.code,
    courseName: course.name,
    sectionNumber: sectionNum,
    professorName: profName,
    professorEmail: profEmail,
    studentName: studentName.trim() || undefined,
    studentMajor: studentMajor.trim() || undefined,
    scheduleSummary
  });

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="visitor-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="visitor-modal-dialog glass-card" onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="visitor-modal-header">
          <div className="visitor-modal-title-group">
            <div className="visitor-modal-icon-badge">
              <Mail size={18} />
            </div>
            <div className="visitor-modal-title-text">
              <h2 className="visitor-modal-title">
                <span className="visitor-title-desktop">Solicitud de Asistencia como Visitante / Oyente</span>
                <span className="visitor-title-mobile">Solicitud de Oyente / Visitante</span>
              </h2>
              <span className="visitor-modal-subtitle">
                {course.code} - {course.name}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="visitor-modal-close-btn"
            onClick={onClose}
            title="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="visitor-modal-body">
          {/* Section & Student Form Row */}
          <div className="visitor-form-grid">
            <div className="visitor-form-group visitor-form-group--section">
              <label>Sección a auditar:</label>
              <CustomSelect
                value={sectionNum}
                onChange={val => setSectionNum(String(val))}
                options={course.extendedSections.map(sec => ({
                  value: sec.sectionNumber,
                  label: `Sección ${sec.sectionNumber}`,
                  badge: sec.sessions.map(s => s.day).join(', ')
                }))}
                size="sm"
                ariaLabel="Seleccionar sección a auditar"
              />
            </div>

            <div className="visitor-form-group">
              <label htmlFor="student-name">Tu nombre (opcional):</label>
              <input
                id="student-name"
                type="text"
                className="visitor-input"
                placeholder="Ej: Farid Espinoza"
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
              />
            </div>

            <div className="visitor-form-group">
              <label htmlFor="student-major">Tu carrera (opcional):</label>
              <input
                id="student-major"
                type="text"
                className="visitor-input"
                placeholder="Ej: Ciencia de Datos"
                value={studentMajor}
                onChange={e => setStudentMajor(e.target.value)}
              />
            </div>
          </div>

          {/* Teacher Info Card */}
          <div className="visitor-prof-card">
            <div className="visitor-prof-avatar">
              <GraduationCap size={18} />
            </div>
            <div className="visitor-prof-details">
              <span className="visitor-prof-name">Docente: {profName}</span>
              <span className="visitor-prof-email">
                {profEmail ? (
                  <a href={`mailto:${profEmail}`} className="email-link">
                    {profEmail}
                  </a>
                ) : (
                  'Correo institucional en el directorio UTEC'
                )}
              </span>
            </div>
            {profEmail && (
              <span className="prof-dest-tag">Destinatario</span>
            )}
          </div>

          {/* Email Preview Container */}
          <div className="visitor-email-preview-container">
            <div className="email-preview-header">
              <span className="email-header-label">Asunto:</span>
              <span className="email-header-subject">{subject}</span>
            </div>
            <div className="email-preview-body">
              <pre>{body}</pre>
            </div>
          </div>

          {/* Advice Alert */}
          <div className="visitor-advice-alert">
            <ShieldCheck size={16} className="text-emerald visitor-advice-icon" />
            <p>
              <strong>Etiqueta de Oyente UTEC:</strong> Asiste con puntualidad, ubícate en los asientos disponibles sin comprometer el aforo y presenta tus respetos al docente al inicio o final de la clase.
            </p>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="visitor-modal-footer">
          <button
            type="button"
            className="btn btn-secondary visitor-copy-btn"
            onClick={handleCopy}
          >
            {copied ? <Check size={16} className="text-emerald" /> : <Copy size={16} />}
            <span>{copied ? '¡Copiado!' : 'Copiar Borrador'}</span>
          </button>

          <a
            href={mailtoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary visitor-send-btn"
          >
            <ExternalLink size={16} />
            <span className="visitor-title-desktop">Abrir en Gmail / Correo</span>
            <span className="visitor-title-mobile">Abrir en Correo</span>
          </a>
        </div>
      </div>
    </div>
  );
};
