import type { DayOfWeek } from './schedule';

export interface MentorReservation {
  week: number;
  dateStr: string;
  room: string;
}

export interface MentorSession {
  id: string;
  mentorId: string;
  mentorName: string;
  mentorEmail: string;
  courseCode: string;
  courseName: string;
  courseColor: string;
  departmentCode: string;
  departmentName: string;
  day: DayOfWeek;
  dayName: string;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  timeDisplay: string;
  durationHours: number;
  modality: 'Presencial' | 'Virtual';
  primaryRoom: string;
  allRooms: string[];
  reservations: MentorReservation[];
}

export interface MentorInfo {
  id: string;
  name: string;
  initials: string;
  email: string;
  departmentCode: string;
  departmentName: string;
  sessions: MentorSession[];
  courses: {
    code: string;
    name: string;
    color: string;
  }[];
  daysTaught: DayOfWeek[];
  modalities: ('Presencial' | 'Virtual')[];
  totalSessions: number;
  primaryCourse: string;
  primaryRoom: string;
}

export type MentorSortOption =
  | 'name_asc'
  | 'name_desc'
  | 'course_asc'
  | 'day_asc'
  | 'time_asc';

export interface MentorFilterState {
  searchQuery: string;
  selectedDay: DayOfWeek | 'ALL';
  selectedModality: 'ALL' | 'Presencial' | 'Virtual';
  selectedCourse: string | 'ALL';
  selectedDepartment: string | 'ALL';
  onlyLiveNow: boolean;
  onlyToday: boolean;
  sortBy: MentorSortOption;
}
