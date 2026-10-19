import type { DayOfWeek } from './schedule';

export type RoomType = 'aula' | 'laboratorio' | 'mesas' | 'auditorio' | 'otro';

export interface ClassroomSession {
  courseCode: string;
  courseName: string;
  sectionNumber: string;
  sessionGroup: string;
  day: DayOfWeek;
  startTime: string; // "10:00"
  endTime: string;   // "12:00"
  startMinutes: number; // 600
  endMinutes: number;   // 720
  professor: string;
  email: string;
  vacancies: number;
  enrolled: number;
}

export interface ClassroomInfo {
  id: string;          // "A704", "L203", "M802", "AUDITORIO"
  code: string;        // "A704"
  rawLocation: string; // "UTEC-BA A704"
  displayName: string; // "Aula 704", "Laboratorio 203"
  type: RoomType;
  floor: number;       // 1 - 10
  sessionsByDay: Record<DayOfWeek, ClassroomSession[]>;
}

export interface TimeInterval {
  startMinutes: number;
  endMinutes: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export interface OccupiedBlock extends TimeInterval {
  session: ClassroomSession;
}

export interface FreeBlock extends TimeInterval {}

export type LiveStatus = 'free_now' | 'occupied_now' | 'closed';

export interface ClassroomAvailability {
  classroom: ClassroomInfo;
  isAvailableForSearch: boolean; // meets search criteria
  
  // Real-time live status for the evaluated day/time
  liveStatus: LiveStatus;
  currentSession?: ClassroomSession;
  nextSession?: ClassroomSession;
  minutesUntilNextSession?: number;
  minutesUntilCurrentSessionEnds?: number;
  
  // Day summary
  freeBlocksToday: FreeBlock[];
  occupiedBlocksToday: OccupiedBlock[];
  totalFreeMinutesToday: number;
  totalOccupiedMinutesToday: number;
  occupancyPercentage: number;
}

export interface ClassroomFilterState {
  searchQuery: string;
  selectedDay: DayOfWeek;
  mode: 'live_now' | 'custom_time';
  startTime: string; // "10:00"
  endTime: string;   // "12:00"
  startMinutes: number;
  endMinutes: number;
  selectedFloor: number | 'ALL';
  selectedType: RoomType | 'ALL';
  minFreeHours: number; // 0, 1, 2, 3
  sortBy: 'floor_asc' | 'floor_desc' | 'free_time' | 'name';
}
