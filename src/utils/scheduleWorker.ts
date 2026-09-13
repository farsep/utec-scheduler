import type { Course, OptimizerOptions, GeneratedScheduleResult, WorkerMessage } from '../types/schedule';
import { detectConflicts } from './scheduleUtils';
import { calculateScheduleMetrics } from './scheduleOptimizer';

// Helper to get combinations of k elements from array
function getCombinations<T>(array: T[], k: number): T[][] {
  const results: T[][] = [];
  
  function helper(start: number, current: T[]) {
    if (current.length === k) {
      results.push([...current]);
      return;
    }
    for (let i = start; i < array.length; i++) {
      current.push(array[i]);
      helper(i + 1, current);
      current.pop();
    }
  }
  
  helper(0, []);
  return results;
}

// Self-invoking message listener for the Web Worker
self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const data = e.data;
  
  if (data.type === 'START') {
    const { courses, poolCourseCodes, options } = data;
    
    let topResults: GeneratedScheduleResult[] = [];
    
    // 1. Determine which courses to process
    let combinationsOfCoursesToEvaluate: string[][] = [];
    
    if (options.isAdvancedMode) {
      const pinned = options.pinnedCourseCodes || [];
      const targetCourses = options.maxCourses || 5;
      
      const neededFromPool = targetCourses - pinned.length;
      
      // If we don't need any from the pool, or the target is met by pinned alone
      if (neededFromPool <= 0) {
        combinationsOfCoursesToEvaluate = [pinned];
      } else {
        const pool = poolCourseCodes.filter(c => !pinned.includes(c));
        // If we don't have enough courses in the pool to satisfy the requirement
        if (pool.length < neededFromPool) {
          self.postMessage({ type: 'ERROR', message: 'No hay suficientes cursos habilitados para alcanzar la cantidad deseada.' } as WorkerMessage);
          return;
        }
        
        const poolCombinations = getCombinations(pool, neededFromPool);
        combinationsOfCoursesToEvaluate = poolCombinations.map(combo => [...pinned, ...combo]);
      }
    } else {
      // Normal Mode
      combinationsOfCoursesToEvaluate = [poolCourseCodes];
    }
    
    let evaluatedSchedules = 0;
    
    // Helper to calculate total combinations for progress tracking
    // Note: this is an estimate as pruning happens during generation
    let estimatedTotal = 0;
    
    for (const courseSet of combinationsOfCoursesToEvaluate) {
      const selectedCourses = courses.filter(c => courseSet.includes(c.code));
      
      if (selectedCourses.length === 0) continue;

      // Filter sections within each course based on options
      const courseSections = selectedCourses.map(course => {
        let validSections = course.sections;

        // Filter by vacancies
        if (options.onlyWithVacancies) {
          validSections = validSections.filter(sec => sec.vacancies > sec.enrolled);
        }

        // Filter by excluded days
        if (options.excludedDays && options.excludedDays.length > 0) {
          validSections = validSections.filter(sec => {
            return !sec.sessions.some(sess => options.excludedDays!.includes(sess.day));
          });
        }
        
        // Filter by time limits (Advanced Mode)
        if (options.isAdvancedMode) {
          if (options.minTimeMinutes !== undefined) {
            validSections = validSections.filter(sec => {
              return !sec.sessions.some(sess => sess.startMinutes < options.minTimeMinutes!);
            });
          }
          if (options.maxTimeMinutes !== undefined) {
            validSections = validSections.filter(sec => {
              return !sec.sessions.some(sess => sess.endMinutes > options.maxTimeMinutes!);
            });
          }
        }

        // Deduplicate sections with the exact same schedule to avoid combinatorial explosion
        const uniqueSectionsMap = new Map<string, typeof validSections[0]>();
        validSections.forEach(sec => {
          // Sort sessions so order doesn't matter
          const hash = sec.sessions.map(s => `${s.day}-${s.startTime}-${s.endTime}`).sort().join('|');
          if (!uniqueSectionsMap.has(hash)) {
            uniqueSectionsMap.set(hash, sec);
          }
        });
        
        validSections = Array.from(uniqueSectionsMap.values());

        return {
          courseCode: course.code,
          sections: validSections
        };
      });

      // If any course in this set has no valid sections left, this combination is invalid
      if (courseSections.some(cs => cs.sections.length === 0)) {
        continue;
      }
      
      // Calculate estimated combinations for this set (for progress bar)
      let setCombinations = 1;
      courseSections.forEach(cs => setCombinations *= cs.sections.length);
      estimatedTotal += setCombinations;

      // Backtracking for this specific course set
      function backtrack(index: number, currentCombination: Record<string, string>) {
        if (index === courseSections.length) {
          const combo = { ...currentCombination };
          const metrics = calculateScheduleMetrics(combo, courses, options);
          
          let rawScore = 0;
          if (options.targets.includes('min_gaps')) rawScore -= metrics.totalGapMinutes;
          if (options.targets.includes('min_days')) rawScore -= (metrics.activeDaysCount * 500);
          if (options.targets.includes('morning')) rawScore += (metrics.morningScore / 5);
          if (options.targets.includes('afternoon')) rawScore += (metrics.afternoonScore / 5);
          if (options.lunchConfig?.enabled) rawScore += (metrics.lunchScore * 1000);

          topResults.push({
            id: `gen_${Date.now()}_${evaluatedSchedules}`,
            selectedSections: combo,
            metrics,
            score: rawScore
          });

          // Prune to keep memory flat
          if (topResults.length >= 2000) {
            topResults.sort((a: GeneratedScheduleResult, b: GeneratedScheduleResult) => (b.score || 0) - (a.score || 0));
            topResults = topResults.slice(0, 200);
          }

          evaluatedSchedules++;
          
          // Report progress every 2000 schedules
          if (evaluatedSchedules % 2000 === 0) {
            self.postMessage({ 
              type: 'PROGRESS', 
              evaluated: evaluatedSchedules, 
              total: estimatedTotal,
              validFound: evaluatedSchedules // Now validFound represents total evaluated valid schedules
            } as WorkerMessage);
          }
          return;
        }

        const { courseCode, sections } = courseSections[index];

        for (const section of sections) {
          currentCombination[courseCode] = section.sectionNumber;
          
          const conflicts = detectConflicts(courses, currentCombination);
          
          if (conflicts.length === 0) {
            backtrack(index + 1, currentCombination);
          }
          
          delete currentCombination[courseCode];
        }
      }

      backtrack(0, {});
    }

    // Final prune before normalization
    topResults.sort((a, b) => (b.score || 0) - (a.score || 0));
    let results: GeneratedScheduleResult[] = topResults.slice(0, 50);

    // Now compute metrics and sort
    self.postMessage({ 
      type: 'PROGRESS', 
      evaluated: Math.max(evaluatedSchedules, estimatedTotal), 
      total: Math.max(evaluatedSchedules, estimatedTotal),
      validFound: evaluatedSchedules
    } as WorkerMessage);

    // Compute normalized scores
    if (results.length > 0 && options.targets.length > 0) {
      const minGaps = Math.min(...results.map(r => r.metrics.totalGapMinutes));
      const maxGaps = Math.max(...results.map(r => r.metrics.totalGapMinutes));
      const minDays = Math.min(...results.map(r => r.metrics.activeDaysCount));
      const maxDays = Math.max(...results.map(r => r.metrics.activeDaysCount));
      const minMorning = Math.min(...results.map(r => r.metrics.morningScore));
      const maxMorning = Math.max(...results.map(r => r.metrics.morningScore));
      const minAfternoon = Math.min(...results.map(r => r.metrics.afternoonScore));
      const maxAfternoon = Math.max(...results.map(r => r.metrics.afternoonScore));

      const safeNormalize = (val: number, min: number, max: number, invert: boolean) => {
        if (max === min) return 1;
        const norm = (val - min) / (max - min);
        return invert ? 1 - norm : norm;
      };

      results.forEach(res => {
        let totalScore = 0;
        let activeTargets = 0;

        if (options.targets.includes('min_gaps')) {
          totalScore += safeNormalize(res.metrics.totalGapMinutes, minGaps, maxGaps, true);
          activeTargets++;
        }
        if (options.targets.includes('min_days')) {
          totalScore += safeNormalize(res.metrics.activeDaysCount, minDays, maxDays, true);
          activeTargets++;
        }
        if (options.targets.includes('morning')) {
          totalScore += safeNormalize(res.metrics.morningScore, minMorning, maxMorning, false);
          activeTargets++;
        }
        if (options.targets.includes('afternoon')) {
          totalScore += safeNormalize(res.metrics.afternoonScore, minAfternoon, maxAfternoon, false);
          activeTargets++;
        }
        
        // Lunch Break Soft Constraint
        if (options.lunchConfig?.enabled) {
          totalScore += res.metrics.lunchScore;
          activeTargets++;
        }

        res.score = activeTargets > 0 ? totalScore / activeTargets : 0;
      });

      // Final sort by normalized score (descending)
      results.sort((a, b) => b.score! - a.score!);
    }
    
    // Send back top 50
    self.postMessage({ 
      type: 'COMPLETE', 
      results
    } as WorkerMessage);
  }
};
