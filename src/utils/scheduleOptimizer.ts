import type { Course, Session, DayOfWeek, OptimizerOptions, GeneratedScheduleResult } from '../types/schedule';
import { detectConflicts, calculateTotalHours } from './scheduleUtils';

export function calculateScheduleMetrics(selectedSections: Record<string, string>, courses: Course[]): {
  totalGapMinutes: number;
  gapHours: number;
  activeDaysCount: number;
  totalHours: number;
  earliestStartMinutes: number;
  latestEndMinutes: number;
  morningScore: number;
  afternoonScore: number;
} {
  // Collect all sessions for the week
  const sessionsByDay: Record<string, Session[]> = {
    Lun: [], Mar: [], Mie: [], Jue: [], Vie: [], Sab: [], Dom: []
  };

  let totalHours = 0;
  let morningScore = 0; // Preference for early classes
  let afternoonScore = 0; // Preference for late classes
  let earliestStartMinutes = 24 * 60;
  let latestEndMinutes = 0;

  Object.entries(selectedSections).forEach(([courseCode, secNum]) => {
    const course = courses.find(c => c.code === courseCode);
    if (!course) return;
    const section = course.sections.find(s => s.sectionNumber === secNum);
    if (!section) return;

    section.sessions.forEach(sess => {
      sessionsByDay[sess.day].push(sess);
      
      const duration = sess.endMinutes - sess.startMinutes;
      totalHours += duration / 60;

      if (sess.startMinutes < earliestStartMinutes) earliestStartMinutes = sess.startMinutes;
      if (sess.endMinutes > latestEndMinutes) latestEndMinutes = sess.endMinutes;

      // Simple scoring for morning/afternoon preference
      // Morning is better if closer to 8:00 (480 mins)
      // Afternoon is better if closer to 18:00 (1080 mins)
      morningScore += Math.max(0, 1080 - sess.startMinutes);
      afternoonScore += Math.max(0, sess.startMinutes - 480);
    });
  });

  let totalGapMinutes = 0;
  let activeDaysCount = 0;

  Object.keys(sessionsByDay).forEach(day => {
    const sessions = sessionsByDay[day];
    if (sessions.length > 0) {
      activeDaysCount++;
      // Sort sessions by start time
      sessions.sort((a, b) => a.startMinutes - b.startMinutes);

      for (let i = 0; i < sessions.length - 1; i++) {
        const gap = sessions[i + 1].startMinutes - sessions[i].endMinutes;
        if (gap > 0) {
          totalGapMinutes += gap;
        }
      }
    }
  });

  return {
    totalGapMinutes,
    gapHours: Number((totalGapMinutes / 60).toFixed(2)),
    activeDaysCount,
    totalHours: Number(totalHours.toFixed(1)),
    earliestStartMinutes: earliestStartMinutes === 24 * 60 ? 0 : earliestStartMinutes,
    latestEndMinutes,
    morningScore,
    afternoonScore
  };
}

export function generateOptimalSchedules(
  courses: Course[],
  selectedCourseCodes: string[],
  options: OptimizerOptions
): GeneratedScheduleResult[] {
  const selectedCourses = courses.filter(c => selectedCourseCodes.includes(c.code));
  
  if (selectedCourses.length === 0) return [];

  // Filter sections within each course based on options
  const courseSections = selectedCourses.map(course => {
    let validSections = course.sections;

    // Filter by vacancies if requested
    if (options.onlyWithVacancies) {
      validSections = validSections.filter(sec => sec.vacancies > sec.enrolled);
    }

    // Filter by excluded days
    if (options.excludedDays && options.excludedDays.length > 0) {
      validSections = validSections.filter(sec => {
        return !sec.sessions.some(sess => options.excludedDays!.includes(sess.day));
      });
    }

    return {
      courseCode: course.code,
      sections: validSections
    };
  });

  // If any course has no valid sections left, no schedule is possible
  if (courseSections.some(cs => cs.sections.length === 0)) {
    return [];
  }

  const validCombinations: Record<string, string>[] = [];
  
  // Backtracking function to generate combinations
  function backtrack(index: number, currentCombination: Record<string, string>) {
    // If we have selected a section for all courses
    if (index === courseSections.length) {
      validCombinations.push({ ...currentCombination });
      return;
    }

    const { courseCode, sections } = courseSections[index];

    for (const section of sections) {
      currentCombination[courseCode] = section.sectionNumber;

      // Check conflicts for current partial combination
      // To optimize, we only really need to check the newly added course against existing, 
      // but detectConflicts is fast enough for small N (N <= 10 courses)
      const conflicts = detectConflicts(courses, currentCombination);
      
      if (conflicts.length === 0) {
        backtrack(index + 1, currentCombination);
      }
      
      // Remove for next iteration
      delete currentCombination[courseCode];
    }
  }

  backtrack(0, {});

  // Compute metrics for all valid combinations
  let results: GeneratedScheduleResult[] = validCombinations.map((combo, idx) => {
    const metrics = calculateScheduleMetrics(combo, courses);
    return {
      id: `gen_${Date.now()}_${idx}`,
      selectedSections: combo,
      metrics
    };
  });

  // Sort based on optimization target
  results.sort((a, b) => {
    const target = options.target || 'min_gaps';
    
    if (target === 'min_gaps') {
      if (a.metrics.totalGapMinutes !== b.metrics.totalGapMinutes) {
        return a.metrics.totalGapMinutes - b.metrics.totalGapMinutes;
      }
      // Tie breaker: less days
      if (a.metrics.activeDaysCount !== b.metrics.activeDaysCount) {
        return a.metrics.activeDaysCount - b.metrics.activeDaysCount;
      }
    } else if (target === 'min_days') {
      if (a.metrics.activeDaysCount !== b.metrics.activeDaysCount) {
        return a.metrics.activeDaysCount - b.metrics.activeDaysCount;
      }
      // Tie breaker: less gaps
      if (a.metrics.totalGapMinutes !== b.metrics.totalGapMinutes) {
        return a.metrics.totalGapMinutes - b.metrics.totalGapMinutes;
      }
    } else if (target === 'morning') {
      if (b.metrics.morningScore !== a.metrics.morningScore) {
        return b.metrics.morningScore - a.metrics.morningScore;
      }
      if (a.metrics.totalGapMinutes !== b.metrics.totalGapMinutes) {
        return a.metrics.totalGapMinutes - b.metrics.totalGapMinutes;
      }
    } else if (target === 'afternoon') {
      if (b.metrics.afternoonScore !== a.metrics.afternoonScore) {
        return b.metrics.afternoonScore - a.metrics.afternoonScore;
      }
      if (a.metrics.totalGapMinutes !== b.metrics.totalGapMinutes) {
        return a.metrics.totalGapMinutes - b.metrics.totalGapMinutes;
      }
    }
    
    return 0;
  });

  // Take top N if needed, or return all
  return results;
}
