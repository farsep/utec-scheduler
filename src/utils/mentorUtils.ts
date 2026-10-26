import type { DayOfWeek } from '../types/schedule';
import type { MentorInfo, MentorSession, MentorFilterState } from '../types/mentor';
import { normalizeString } from './scheduleUtils';

export interface MentorLiveStatus {
  isMentoringNow: boolean;
  activeSession: MentorSession | null;
  hasSessionToday: boolean;
  todaySessions: MentorSession[];
  nextSession: MentorSession | null;
  statusLabel: string;
}

const DAY_ORDER: Record<DayOfWeek, number> = {
  Lun: 0,
  Mar: 1,
  Mie: 2,
  Jue: 3,
  Vie: 4,
  Sab: 5
};

export function evaluateMentorLiveStatus(
  mentor: MentorInfo,
  currentDay: DayOfWeek,
  currentMinutes: number
): MentorLiveStatus {
  let isMentoringNow = false;
  let activeSession: MentorSession | null = null;
  const todaySessions: MentorSession[] = [];
  let nextSession: MentorSession | null = null;
  let minMinutesUntilNext = Infinity;

  const currentDayIndex = DAY_ORDER[currentDay] ?? 0;

  for (const session of mentor.sessions) {
    if (session.day === currentDay) {
      todaySessions.push(session);

      // Check if happening right now
      if (currentMinutes >= session.startMinutes && currentMinutes < session.endMinutes) {
        isMentoringNow = true;
        activeSession = session;
      } else if (session.startMinutes > currentMinutes) {
        const diff = session.startMinutes - currentMinutes;
        if (diff < minMinutesUntilNext) {
          minMinutesUntilNext = diff;
          nextSession = session;
        }
      }
    } else if (!isMentoringNow && !nextSession) {
      // Find upcoming session on future day
      const sessionDayIndex = DAY_ORDER[session.day] ?? 0;
      let dayDiff = sessionDayIndex - currentDayIndex;
      if (dayDiff < 0) dayDiff += 7;
      const totalMinutesUntil = dayDiff * 24 * 60 + session.startMinutes - currentMinutes;
      if (totalMinutesUntil > 0 && totalMinutesUntil < minMinutesUntilNext) {
        minMinutesUntilNext = totalMinutesUntil;
        nextSession = session;
      }
    }
  }

  let statusLabel = 'Fuera de horario';
  if (isMentoringNow && activeSession) {
    statusLabel = activeSession.modality === 'Presencial'
      ? `En mentoría presencial (${activeSession.primaryRoom})`
      : 'En mentoría virtual ahora';
  } else if (nextSession && nextSession.day === currentDay) {
    statusLabel = `Hoy a las ${nextSession.startTime}`;
  } else if (todaySessions.length > 0) {
    statusLabel = 'Tuvo mentoría hoy';
  } else if (nextSession) {
    statusLabel = `Próxima: ${nextSession.day} ${nextSession.startTime}`;
  }

  return {
    isMentoringNow,
    activeSession,
    hasSessionToday: todaySessions.length > 0,
    todaySessions,
    nextSession,
    statusLabel
  };
}

export function filterAndSortMentors(
  mentors: MentorInfo[],
  filter: MentorFilterState,
  currentDay: DayOfWeek,
  currentMinutes: number
): MentorInfo[] {
  const normQuery = normalizeString(filter.searchQuery);

  const filtered = mentors.filter(mentor => {
    // 1. Text search query
    if (normQuery) {
      const matchName = normalizeString(mentor.name).includes(normQuery);
      const matchEmail = normalizeString(mentor.email).includes(normQuery);
      const matchCourse = mentor.courses.some(c =>
        normalizeString(c.name).includes(normQuery) || normalizeString(c.code).includes(normQuery)
      );
      const matchRoom = mentor.sessions.some(s =>
        normalizeString(s.primaryRoom).includes(normQuery) ||
        s.allRooms.some(r => normalizeString(r).includes(normQuery))
      );
      const matchDept = normalizeString(mentor.departmentName).includes(normQuery);

      if (!matchName && !matchEmail && !matchCourse && !matchRoom && !matchDept) {
        return false;
      }
    }

    // 2. Day filter
    if (filter.selectedDay !== 'ALL') {
      if (!mentor.sessions.some(s => s.day === filter.selectedDay)) {
        return false;
      }
    }

    // 3. Modality filter
    if (filter.selectedModality !== 'ALL') {
      if (!mentor.sessions.some(s => s.modality === filter.selectedModality)) {
        return false;
      }
    }

    // 4. Course filter
    if (filter.selectedCourse !== 'ALL') {
      if (!mentor.courses.some(c => c.code === filter.selectedCourse || c.name === filter.selectedCourse)) {
        return false;
      }
    }

    // 5. Department filter
    if (filter.selectedDepartment !== 'ALL') {
      if (mentor.departmentCode !== filter.selectedDepartment) {
        return false;
      }
    }

    // 6. Live now toggle
    if (filter.onlyLiveNow) {
      const liveStatus = evaluateMentorLiveStatus(mentor, currentDay, currentMinutes);
      if (!liveStatus.isMentoringNow) return false;
    }

    // 7. Today toggle
    if (filter.onlyToday) {
      if (!mentor.sessions.some(s => s.day === currentDay)) {
        return false;
      }
    }

    return true;
  });

  // Sort
  return filtered.sort((a, b) => {
    switch (filter.sortBy) {
      case 'name_asc':
        return a.name.localeCompare(b.name, 'es');
      case 'name_desc':
        return b.name.localeCompare(a.name, 'es');
      case 'course_asc':
        return a.primaryCourse.localeCompare(b.primaryCourse, 'es');
      case 'day_asc': {
        const dayA = Math.min(...a.sessions.map(s => DAY_ORDER[s.day] ?? 99));
        const dayB = Math.min(...b.sessions.map(s => DAY_ORDER[s.day] ?? 99));
        if (dayA !== dayB) return dayA - dayB;
        const timeA = Math.min(...a.sessions.map(s => s.startMinutes));
        const timeB = Math.min(...b.sessions.map(s => s.startMinutes));
        return timeA - timeB;
      }
      case 'time_asc': {
        const timeA = Math.min(...a.sessions.map(s => s.startMinutes));
        const timeB = Math.min(...b.sessions.map(s => s.startMinutes));
        return timeA - timeB;
      }
      default:
        return a.name.localeCompare(b.name, 'es');
    }
  });
}
