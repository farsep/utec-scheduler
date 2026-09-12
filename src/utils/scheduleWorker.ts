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
    
    let validCombinations: Record<string, string>[] = [];
    
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
          validCombinations.push({ ...currentCombination });
          evaluatedSchedules++;
          
          // Report progress every 1000 schedules
          if (evaluatedSchedules % 1000 === 0) {
            self.postMessage({ 
              type: 'PROGRESS', 
              evaluated: evaluatedSchedules, 
              total: estimatedTotal,
              validFound: validCombinations.length
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

    // Now compute metrics and sort
    self.postMessage({ 
      type: 'PROGRESS', 
      evaluated: Math.max(evaluatedSchedules, estimatedTotal), 
      total: Math.max(evaluatedSchedules, estimatedTotal),
      validFound: validCombinations.length
    } as WorkerMessage);
    
    let results: GeneratedScheduleResult[] = validCombinations.map((combo, idx) => {
      const metrics = calculateScheduleMetrics(combo, courses);
      return {
        id: `gen_${Date.now()}_${idx}`,
        selectedSections: combo,
        metrics,
        score: 0 // Will compute below
      };
    });

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

        res.score = activeTargets > 0 ? totalScore / activeTargets : 0;
      });

      // Sort by score (descending)
      results.sort((a, b) => b.score! - a.score!);
    }
    
    // We only send back top 50
    self.postMessage({ 
      type: 'COMPLETE', 
      results: results.slice(0, 50) 
    } as WorkerMessage);
  }
};
