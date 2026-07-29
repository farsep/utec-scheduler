import React from 'react';
import { User, GraduationCap, Award, Calendar, Clock, Sparkles } from 'lucide-react';
import type { MetadataInfo } from '../types/schedule';

interface StudentBannerProps {
  metadata: MetadataInfo;
}

export const StudentBanner: React.FC<StudentBannerProps> = ({ metadata }) => {
  if (!metadata.studentName && !metadata.major) return null;

  return (
    <div className="student-metadata-banner">
      <div className="student-meta-item student-name">
        <User size={15} color="var(--accent-primary)" />
        <span className="student-meta-label">Alumno:</span>
        <span className="student-meta-value">{metadata.studentName || 'Farid Espinoza'}</span>
      </div>

      {metadata.major && (
        <div className="student-meta-item">
          <GraduationCap size={15} color="var(--accent-emerald)" />
          <span className="student-meta-label">Carrera:</span>
          <span className="student-meta-value">{metadata.major}</span>
        </div>
      )}

      {metadata.malla && (
        <div className="student-meta-item">
          <Award size={15} color="var(--accent-purple)" />
          <span className="student-meta-label">Malla:</span>
          <span className="student-meta-value">{metadata.malla}</span>
        </div>
      )}

      {metadata.program && (
        <div className="student-meta-item">
          <span className="student-meta-label">Programa:</span>
          <span className="student-meta-value">{metadata.program}</span>
        </div>
      )}

      {metadata.semester && (
        <div className="student-meta-item">
          <Calendar size={15} color="var(--accent-amber)" />
          <span className="student-meta-label">Periodo:</span>
          <span className="student-meta-value">{metadata.semester}</span>
        </div>
      )}

      {metadata.registrationTime && (
        <div className="student-meta-item registration-turn">
          <Clock size={15} color="#f43f5e" />
          <span className="student-meta-label">Turno de Matrícula:</span>
          <span className="student-meta-value highlight-turn">{metadata.registrationTime}</span>
        </div>
      )}
    </div>
  );
};
