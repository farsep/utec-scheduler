export type DayOfWeek = 'Lun' | 'Mar' | 'Mie' | 'Jue' | 'Vie' | 'Sab';

export type SessionType = 'Teoría' | 'Laboratorio' | 'Práctica' | 'Taller' | 'Otro';

export interface Session {
  id: string;
  sessionGroup: string; // e.g., "TEORÍA 1", "LABORATORIO 11"
  sessionType: SessionType;
  modality: 'Presencial' | 'Sincronico' | string;
  day: DayOfWeek;
  startTime: string; // "10:00"
  endTime: string; // "12:00"
  startMinutes: number; // 600
  endMinutes: number; // 720
  frequency: string; // "Semana General"
  location: string; // "UTEC-BA M802"
  vacancies: number;
  enrolled: number;
  professor: string;
  email: string;
}

export interface Section {
  sectionNumber: string; // "1", "2" or "1 (LABORATORIO 11)"
  sessions: Session[];
  vacancies: number;
  enrolled: number;
  professors: string[];
}

export interface Course {
  code: string; // e.g. "CC1103"
  name: string; // e.g. "Álgebra Lineal"
  sections: Section[];
  color: string;
  isEligible?: boolean; // True if listed in student's PDF
  courseType?: 'Obligatorio' | 'Electivo' | string;
  plan?: string; // e.g. "CD-2021-1"
}

export interface MetadataInfo {
  studentName?: string;
  program?: string;
  major?: string;
  semester?: string;
  registrationTime?: string;
}

export interface ScheduleOption {
  id: string;
  name: string;
  selectedSections: Record<string, string>; // courseCode -> sectionNumber
}

export interface Conflict {
  id: string;
  course1Code: string;
  course1Name: string;
  section1Number: string;
  session1Group: string;
  course2Code: string;
  course2Name: string;
  section2Number: string;
  session2Group: string;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
}

export interface FilterState {
  searchQuery: string;
  onlyEligible: boolean;
  modalityFilter: 'ALL' | 'Presencial' | 'Sincronico';
  dayFilter: 'ALL' | DayOfWeek;
  typeFilter: 'ALL' | 'Obligatorio' | 'Electivo';
}
