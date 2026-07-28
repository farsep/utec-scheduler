export type DayOfWeek = 'Lun' | 'Mar' | 'Mie' | 'Jue' | 'Vie' | 'Sab';

export type SessionType = 'Teoría' | 'Laboratorio' | 'Práctica' | 'Taller' | 'Otro';

export interface Session {
  id: string;
  sessionGroup: string; // e.g. "TEORÍA 1", "LABORATORIO 11"
  sessionType: SessionType;
  modality: string; // "Presencial", "Sincronico", "Hibrido"
  day: DayOfWeek;
  startTime: string; // "15:00"
  endTime: string; // "17:00"
  startMinutes: number; // 900
  endMinutes: number; // 1020
  frequency: string; // "Semana General"
  location: string; // "UTEC-BA A1003"
  vacancies: number;
  enrolled: number;
  professor: string;
  email: string;
}

export interface Section {
  sectionNumber: string; // "1", "2", "101"
  sessions: Session[];
  vacancies: number;
  enrolled: number;
  professors: string[];
}

export interface Course {
  code: string; // "CS5352"
  name: string; // "3D Graphics Programming"
  sections: Section[];
  isEligible?: boolean; // From PDF student eligibility check
  courseType?: 'Obligatorio' | 'Electivo' | string; // From PDF
  plan?: string; // "CD-2021-1"
  credits?: number; // Calculated or default (3-4)
  color: string; // CSS color string or gradient index
}

export interface SelectedSection {
  courseCode: string;
  courseName: string;
  sectionNumber: string;
  color: string;
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

export interface MetadataInfo {
  studentName?: string;
  program?: string;
  major?: string;
  semester?: string;
  registrationTime?: string;
}

export interface FilterState {
  searchQuery: string;
  onlyEligible: boolean;
  modalityFilter: string; // 'ALL' | 'Presencial' | 'Sincronico'
  dayFilter: string; // 'ALL' | DayOfWeek
  typeFilter: string; // 'ALL' | 'Obligatorio' | 'Electivo'
}
