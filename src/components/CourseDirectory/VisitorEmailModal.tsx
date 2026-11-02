import React, { useState } from 'react';
import type { CourseExtendedInfo } from '../../types/courseDirectory';
import { generateVisitorEmailTemplate } from '../../utils/courseDirectoryUtils';
import { CustomSelect } from '../common/CustomSelect';
import {
  Mail,
  Copy,
  Check,
  ExternalLink,
  X,
  GraduationCap,
  ShieldCheck,
  User,
  PenLine,
  ChevronDown,
  ChevronUp
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
  const [studentName, setStudentName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('matriculab_visitor_name') || '';
      } catch {
        return '';
      }
    }
    return '';
  });
  const [studentMajor, setStudentMajor] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('matriculab_visitor_major') || '';
      } catch {
        return '';
      }
    }
    return '';
  });
  const [showPersonalize, setShowPersonalize] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedSubject, setCopiedSubject] = useState<boolean>(false);

  const handleNameChange = (val: string) => {
    setStudentName(val);
    try {
      localStorage.setItem('matriculab_visitor_name', val);
    } catch {}
  };

  const handleMajorChange = (val: string) => {
    setStudentMajor(val);
    try {
      localStorage.setItem('matriculab_visitor_major', val);
    } catch {}
  };

  // Find target section
  const targetSection =
    course.extendedSections.find(s => s.sectionNumber === sectionNum) ||
    course.extendedSections[0];

  // Primary professor of section
  const sectionProf =
    targetSection && targetSection.sessions.length > 0
      ? targetSection.sessions.find(s => s.professor && !/docente\s*utec/i.test(s.professor))
      : null;

  const profName = sectionProf?.professor || course.uniqueProfessors[0]?.name || 'Docente UTEC';
  const profEmail = sectionProf?.email || course.uniqueProfessors[0]?.email || '';

  // Summary of days and hours
  const scheduleSummary = targetSection
    ? targetSection.sessions
        .map(s => `${s.day} ${s.startTime}-${s.endTime} (${s.roomDisplayName})`)
        .join(', ')
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

  const handleCopySubject = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(subject);
      setCopiedSubject(true);
      setTimeout(() => setCopiedSubject(false), 2000);
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
                <span className="visitor-title-mobile">Permiso de Oyente / Visitante</span>
              </h2>
              <div className="visitor-modal-subtitle-row">
                <span className="visitor-course-code-badge">{course.code}</span>
                <span className="visitor-course-name-text">{course.name}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="visitor-modal-close-btn"
            onClick={onClose}
            aria-label="Cerrar modal"
            title="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="visitor-modal-body">
          {/* Section & Teacher Meta Strip */}
          <div className="visitor-meta-strip">
            <div className="visitor-meta-section">
              <span className="visitor-meta-label">Sección a auditar:</span>
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

            <div className="visitor-prof-card">
              <div className="visitor-prof-avatar">
                <GraduationCap size={16} />
              </div>
              <div className="visitor-prof-details">
                <div className="visitor-prof-name-row">
                  <span className="visitor-prof-name" title={profName}>
                    {profName}
                  </span>
                  {profEmail && <span className="prof-dest-tag">Destinatario</span>}
                </div>
                <span className="visitor-prof-email">
                  {profEmail ? (
                    <a href={`mailto:${profEmail}`} className="email-link">
                      {profEmail}
                    </a>
                  ) : (
                    'Correo institucional UTEC'
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Student Info Collapsible Bar */}
          <div className="visitor-student-bar">
            <button
              type="button"
              className="visitor-student-toggle-btn"
              onClick={() => setShowPersonalize(!showPersonalize)}
              aria-expanded={showPersonalize}
            >
              <div className="visitor-student-preview">
                <User size={13} className="visitor-student-icon" />
                <span className="visitor-student-summary">
                  Remitente:{' '}
                  <strong>{studentName ? studentName : 'Estudiante anónimo'}</strong>
                  {studentMajor && (
                    <span className="visitor-student-major-pill"> • {studentMajor}</span>
                  )}
                </span>
              </div>
              <span className="visitor-student-edit-action">
                <PenLine size={12} />
                <span>{showPersonalize ? 'Cerrar' : (studentName ? 'Editar' : 'Completar datos')}</span>
                {showPersonalize ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </span>
            </button>

            {showPersonalize && (
              <div className="visitor-student-form-fields">
                <div className="visitor-form-group">
                  <label htmlFor="visitor-student-name">Tu nombre (opcional):</label>
                  <input
                    id="visitor-student-name"
                    type="text"
                    className="visitor-input"
                    placeholder="Ej: Farid Espinoza"
                    value={studentName}
                    onChange={e => handleNameChange(e.target.value)}
                    autoComplete="name"
                  />
                </div>
                <div className="visitor-form-group">
                  <label htmlFor="visitor-student-major">Tu carrera (opcional):</label>
                  <input
                    id="visitor-student-major"
                    type="text"
                    className="visitor-input"
                    placeholder="Ej: Ciencia de la Computación"
                    value={studentMajor}
                    onChange={e => handleMajorChange(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Email Preview Container */}
          <div className="visitor-email-preview-container">
            <div className="email-preview-header">
              <div className="email-subject-group">
                <span className="email-header-label">Asunto:</span>
                <span className="email-header-subject" title={subject}>
                  {subject}
                </span>
              </div>
              <button
                type="button"
                className="email-copy-subj-btn"
                onClick={handleCopySubject}
                title="Copiar asunto al portapapeles"
              >
                {copiedSubject ? <Check size={12} className="text-emerald" /> : <Copy size={12} />}
                <span>{copiedSubject ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
            <div className="email-preview-body">
              <pre className="email-body-text">{body}</pre>
            </div>
          </div>

          {/* Compact Etiquette Tip */}
          <div className="visitor-advice-alert">
            <ShieldCheck size={15} className="text-emerald visitor-advice-icon" />
            <p>
              <strong>Etiqueta de Oyente UTEC:</strong> Asiste con puntualidad, ubícate en asientos libres sin comprometer el aforo y presenta tus respetos al docente al inicio o final de la clase.
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
            <span>{copied ? '¡Borrador Copiado!' : 'Copiar Borrador'}</span>
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
