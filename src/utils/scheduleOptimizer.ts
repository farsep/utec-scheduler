import type { Course, Session, DayOfWeek, OptimizerOptions, GeneratedScheduleResult } from '../types/schedule';
import { detectConflicts, calculateTotalHours } from './scheduleUtils';

export function calculateScheduleMetrics(
  selectedSections: Record<string, string>, 
  courses: Course[],
  options?: OptimizerOptions
): {
  totalGapMinutes: number;
  gapHours: number;
  activeDaysCount: number;
  totalHours: number;
  earliestStartMinutes: number;
  latestEndMinutes: number;
  morningScore: number;
  afternoonScore: number;
  lunchScore: number; // 0 to 1, fraction of days meeting lunch criteria
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
  let daysMeetingLunch = 0;

  Object.keys(sessionsByDay).forEach(day => {
    const sessions = sessionsByDay[day];
    if (sessions.length > 0) {
      activeDaysCount++;
      // Sort sessions by start time
      sessions.sort((a, b) => a.startMinutes - b.startMinutes);

      let hasLunchBreak = false;
      const lunchConfig = options?.lunchConfig;

      // If lunch config is active, check the gaps and bounds
      if (lunchConfig && lunchConfig.enabled) {
        const timeToMinutes = (timeStr: string) => {
          const [h, m] = timeStr.split(':').map(Number);
          return h * 60 + m;
        };
        const lunchStart = timeToMinutes(lunchConfig.startTime);
        const lunchEnd = timeToMinutes(lunchConfig.endTime);
        const minDuration = lunchConfig.durationMinutes;

        // The free time could be before the first class, between classes, or after the last class (within the window)
        // Let's create an array of "occupied" blocks within the lunch window
        const blocksInWindow = sessions
          .filter(s => s.endMinutes > lunchStart && s.startMinutes < lunchEnd)
          .map(s => ({
            start: Math.max(s.startMinutes, lunchStart),
            end: Math.min(s.endMinutes, lunchEnd)
          }));

        if (blocksInWindow.length === 0) {
          // No classes in the lunch window, full break available!
          if (lunchEnd - lunchStart >= minDuration) hasLunchBreak = true;
        } else {
          // Check gap before the first class in the window
          if (blocksInWindow[0].start - lunchStart >= minDuration) {
            hasLunchBreak = true;
          }
          // Check gaps between classes in the window
          for (let i = 0; i < blocksInWindow.length - 1; i++) {
            if (blocksInWindow[i + 1].start - blocksInWindow[i].end >= minDuration) {
              hasLunchBreak = true;
            }
          }
          // Check gap after the last class in the window
          if (!hasLunchBreak && lunchEnd - blocksInWindow[blocksInWindow.length - 1].end >= minDuration) {
            hasLunchBreak = true;
          }
        }
      }

      if (hasLunchBreak) daysMeetingLunch++;

      for (let i = 0; i < sessions.length - 1; i++) {
        const gap = sessions[i + 1].startMinutes - sessions[i].endMinutes;
        if (gap > 0) {
          totalGapMinutes += gap;
        }
      }
    }
  });

  const lunchScore = (options?.lunchConfig?.enabled && activeDaysCount > 0) 
    ? (daysMeetingLunch / activeDaysCount) 
    : 0;

  return {
    totalGapMinutes,
    gapHours: Number((totalGapMinutes / 60).toFixed(2)),
    activeDaysCount,
    totalHours: Number(totalHours.toFixed(1)),
    earliestStartMinutes: earliestStartMinutes === 24 * 60 ? 0 : earliestStartMinutes,
    latestEndMinutes,
    morningScore,
    afternoonScore,
    lunchScore
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

  // Calculate min and max for normalization
  if (results.length > 0) {
    let minGaps = Infinity, maxGaps = -Infinity;
    let minDays = Infinity, maxDays = -Infinity;
    let minMorning = Infinity, maxMorning = -Infinity;
    let minAfternoon = Infinity, maxAfternoon = -Infinity;

    results.forEach(r => {
      const { totalGapMinutes, activeDaysCount, morningScore, afternoonScore } = r.metrics;
      if (totalGapMinutes < minGaps) minGaps = totalGapMinutes;
      if (totalGapMinutes > maxGaps) maxGaps = totalGapMinutes;
      if (activeDaysCount < minDays) minDays = activeDaysCount;
      if (activeDaysCount > maxDays) maxDays = activeDaysCount;
      if (morningScore < minMorning) minMorning = morningScore;
      if (morningScore > maxMorning) maxMorning = morningScore;
      if (afternoonScore < minAfternoon) minAfternoon = afternoonScore;
      if (afternoonScore > maxAfternoon) maxAfternoon = afternoonScore;
    });

    const normalize = (val: number, min: number, max: number, invert = false) => {
      if (max === min) return 1; // if all combinations share the same value, it's a perfect score for this metric
      let n = (val - min) / (max - min);
      return invert ? 1 - n : n;
    };

    results.forEach(r => {
      const targets = options.targets || [];
      if (targets.length === 0) {
        // Fallback default score if no targets are selected
        r.score = normalize(r.metrics.totalGapMinutes, minGaps, maxGaps, true);
        return;
      }

      let totalScore = 0;
      targets.forEach(t => {
        if (t === 'min_gaps') totalScore += normalize(r.metrics.totalGapMinutes, minGaps, maxGaps, true);
        else if (t === 'min_days') totalScore += normalize(r.metrics.activeDaysCount, minDays, maxDays, true);
        else if (t === 'morning') totalScore += normalize(r.metrics.morningScore, minMorning, maxMorning, false);
        else if (t === 'afternoon') totalScore += normalize(r.metrics.afternoonScore, minAfternoon, maxAfternoon, false);
      });

      r.score = totalScore / targets.length; // Final score is an average (0 to 1)
    });

    // Sort by final score descending
    results.sort((a, b) => {
      const diff = (b.score || 0) - (a.score || 0);
      if (diff !== 0) return diff;
      // Tie breakers
      if (a.metrics.totalGapMinutes !== b.metrics.totalGapMinutes) {
        return a.metrics.totalGapMinutes - b.metrics.totalGapMinutes;
      }
      return a.metrics.activeDaysCount - b.metrics.activeDaysCount;
    });
  }

  // Take top N if needed, or return all
  return results;
}
