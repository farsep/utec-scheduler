import type { DayOfWeek, SessionType } from './schedule';

export interface ProfessorSession {
  id: string;
  courseCode: string;
  courseName: string;
  courseColor: string;
  sectionNumber: string;
  sessionGroup: string;
  sessionType: SessionType;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  durationHours: number;
  frequency: string;
  rawLocation: string;
  roomCode: string;
  roomDisplayName: string;
  floor: number;
  modality: string;
  vacancies: number;
  enrolled: number;
}

export interface ProfessorCourseSection {
  sectionNumber: string;
  sessions: ProfessorSession[];
  vacancies: number;
  enrolled: number;
  totalWeeklyHours: number;
  modalities: string[];
  roomCodes: string[];
}

export interface ProfessorCourseSummary {
  code: string;
  name: string;
  color: string;
  sectionsCount: number;
  sections: string[];
  sectionGroups: ProfessorCourseSection[];
  totalWeeklyHours: number;
  roomCodes: string[];
}

export interface ProfessorInfo {
  id: string;
  rawName: string;
  displayName: string;
  lastNameFirst: string;
  initials: string;
  email: string;
  department: string;
  departmentLabel: string;
  sessions: ProfessorSession[];
  sessionsByDay: Record<DayOfWeek, ProfessorSession[]>;
  courses: ProfessorCourseSummary[];
  totalHoursPerWeek: number;
  totalSessionsCount: number;
  uniqueCoursesCount: number;
  uniqueSectionsCount: number;
  uniqueRooms: string[];
  daysTaught: DayOfWeek[];
  busiestDay: DayOfWeek | null;
  totalVacancies: number;
  totalEnrolled: number;
  earliestStartMinutes: number;
  latestEndMinutes: number;
}

export type ProfessorSortOption =
  | 'name_asc'
  | 'name_desc'
  | 'hours_desc'
  | 'courses_desc'
  | 'sessions_desc'
  | 'students_desc';

export interface ProfessorFilterState {
  searchQuery: string;
  selectedDay: DayOfWeek | 'ALL';
  selectedDepartment: string | 'ALL';
  selectedModality: 'ALL' | 'Presencial' | 'Sincronico';
  onlyLiveNow: boolean;
  onlyToday: boolean;
  sortBy: ProfessorSortOption;
}
