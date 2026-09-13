import type { Course, OptimizerOptions, GeneratedScheduleResult, WorkerMessage, Session } from '../types/schedule';
import { calculateMetricsFromSessions } from './scheduleOptimizer';

// Convert minutes (e.g. 7:30 = 450) to a slot index. Assuming 30 min slots starting at 07:00 (420)
// To be safe and precise, let's use 15-minute slots starting from 07:00 (420).
// 15 hours * 4 = 60 slots per day. 7 days = 420 bits. Fits easily in BigInt.
function sessionToBitmask(sessions: {day: string, startMinutes: number, endMinutes: number}[]): bigint {
  const dayOffsets: Record<string, bigint> = {
    'Lun': 0n, 'Mar': 60n, 'Mie': 120n, 'Jue': 180n, 'Vie': 240n, 'Sab': 300n, 'Dom': 360n
  };
  let mask = 0n;
  for (const s of sessions) {
    const dayOffset = dayOffsets[s.day];
    if (dayOffset === undefined) continue;
    
    // Each slot is 15 mins. 07:00 = 420.
    const startSlot = Math.max(0, Math.floor((s.startMinutes - 420) / 15));
    const endSlot = Math.max(0, Math.ceil((s.endMinutes - 420) / 15));
    
    for (let i = startSlot; i < endSlot; i++) {
       mask |= (1n << (dayOffset + BigInt(i)));
    }
  }
  return mask;
}



// Self-invoking message listener for the Web Worker
self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const data = e.data;
  
  if (data.type === 'START') {
    const { courses, combinationsChunk, options } = data;
    
    let topResults: GeneratedScheduleResult[] = [];
    let evaluatedSchedules = 0;
    let estimatedTotal = 0;
    
    for (const courseSet of combinationsChunk) {
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
        
        const deduplicatedSections = Array.from(uniqueSectionsMap.values());

        return {
          courseCode: course.code,
          sections: deduplicatedSections.map(sec => ({
            ...sec,
            bitmask: sessionToBitmask(sec.sessions)
          }))
        };
      });

      // If any course in this set has no valid sections left, this combination is invalid
      if (courseSections.some(cs => cs.sections.length === 0)) {
        continue;
      }
      
      // MRV (Minimum Remaining Values): Sort courses by domain size (ascending)
      courseSections.sort((a, b) => a.sections.length - b.sections.length);

      // Calculate estimated combinations for this set (for progress bar)
      let setCombinations = 1;
      courseSections.forEach(cs => setCombinations *= cs.sections.length);
      estimatedTotal += setCombinations;

      // CSP Engine with Forward Checking
      // currentDomains: mapping index -> remaining valid sections for that course
      function backtrack(index: number, currentMask: bigint, currentCombination: Record<string, string>, currentSessions: Session[], currentDomains: typeof courseSections) {
        if (index === courseSections.length) {
          const combo = { ...currentCombination };
          const metrics = calculateMetricsFromSessions(currentSessions, options);
          
          let rawScore = 0;
          if (options.targets.includes('min_gaps')) rawScore -= metrics.totalGapMinutes;
          if (options.targets.includes('min_days')) rawScore -= (metrics.activeDaysCount * 500);
          if (options.targets.includes('min_day_gaps')) rawScore -= (metrics.dayGaps * 1000); // Heavy penalty for day gaps
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
          
          // Report progress every 5000 schedules
          if (evaluatedSchedules % 5000 === 0) {
            self.postMessage({ 
              type: 'PROGRESS', 
              evaluated: evaluatedSchedules, 
              total: estimatedTotal,
              validFound: evaluatedSchedules // Now validFound represents total evaluated valid schedules
            } as WorkerMessage);
          }
          return;
        }

        const { courseCode, sections } = currentDomains[index];

        for (const section of sections) {
          // If section conflicts with current mask, skip (though forward checking already filtered it)
          if ((currentMask & section.bitmask) !== 0n) continue;
          
          currentCombination[courseCode] = section.sectionNumber;
          const nextMask = currentMask | section.bitmask;
          
          // Forward Checking: Prune domains of future courses
          let isViable = true;
          const nextDomains = [];
          
          for (let i = 0; i < currentDomains.length; i++) {
            if (i <= index) {
              nextDomains.push(currentDomains[i]); // Already assigned or being assigned
            } else {
              const futureCourse = currentDomains[i];
              const validFutureSections = futureCourse.sections.filter(s => (s.bitmask & nextMask) === 0n);
              if (validFutureSections.length === 0) {
                isViable = false;
                break;
              }
              nextDomains.push({ courseCode: futureCourse.courseCode, sections: validFutureSections });
            }
          }
          
          if (isViable) {
            currentSessions.push(...section.sessions);
            backtrack(index + 1, nextMask, currentCombination, currentSessions, nextDomains);
            for (let i = 0; i < section.sessions.length; i++) currentSessions.pop();
          }
        }
      }

      backtrack(0, 0n, {}, [], courseSections);
    }
    
    // Final sort
    topResults.sort((a, b) => (b.score || 0) - (a.score || 0));
    
    // Final progress report
    self.postMessage({ 
      type: 'PROGRESS', 
      evaluated: evaluatedSchedules, 
      total: estimatedTotal,
      validFound: evaluatedSchedules
    } as WorkerMessage);

    self.postMessage({ 
      type: 'COMPLETE', 
      results: topResults 
    } as WorkerMessage);
  }
};
