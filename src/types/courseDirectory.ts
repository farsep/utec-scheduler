import type { DayOfWeek, SessionType, Course, Section, Session } from './schedule';

export interface CourseExtendedSession extends Session {
  durationHours: number;
  roomCode: string;
  roomDisplayName: string;
  floor: number;
}

export interface CourseExtendedSection extends Omit<Section, 'sessions'> {
  sessions: CourseExtendedSession[];
  totalWeeklyHours: number;
  modalities: string[];
  daysTaught: DayOfWeek[];
  rooms: string[];
}

export interface CourseExtendedInfo extends Course {
  department: string;
  departmentLabel: string;
  departmentColor: string;
  extendedSections: CourseExtendedSection[];
  totalSectionsCount: number;
  totalSessionsCount: number;
  totalVacancies: number;
  totalEnrolled: number;
  totalWeeklyHours: number;
  modalities: string[];
  daysTaught: DayOfWeek[];
  uniqueProfessors: { name: string; email: string }[];
  uniqueRooms: string[];
  isCurrentlyLive?: boolean;
  liveSession?: {
    sectionNumber: string;
    sessionGroup: string;
    sessionType: SessionType;
    room: string;
    roomCode: string;
    professor: string;
    email: string;
    startTime: string;
    endTime: string;
    startMinutes: number;
    endMinutes: number;
  };
  nextSession?: {
    day: DayOfWeek;
    startTime: string;
    endTime: string;
    startMinutes: number;
    endMinutes: number;
    room: string;
    sectionNumber: string;
    sessionType: SessionType;
    professor: string;
    email: string;
  };
  minutesUntilNext?: number;
}

export interface VisitorCourseItem {
  courseCode: string;
  courseName: string;
  department?: string;
  color?: string;
  selectedSection?: string; // 'ALL' or specific sectionNumber like '1'
  addedAt: number;
  customNotes?: string;
}

export type CourseSortOption =
  | 'code_asc'
  | 'code_desc'
  | 'name_asc'
  | 'name_desc'
  | 'sections_desc'
  | 'hours_desc';

export interface CourseFilterState {
  searchQuery: string;
  selectedDepartment: string | 'ALL';
  selectedDay: DayOfWeek | 'ALL';
  selectedModality: 'ALL' | 'Presencial' | 'Sincronico';
  onlyLiveNow: boolean;
  onlyVisitor: boolean;
  sortBy: CourseSortOption;
}
