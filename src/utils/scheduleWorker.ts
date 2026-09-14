import type { Course, OptimizerOptions, GeneratedScheduleResult, WorkerMessage, Session } from '../types/schedule';
import { calculateMetricsFromSessions } from './scheduleOptimizer';
import { sessionToBitmask, timeToMinutes } from './scheduleUtils';



let topResults: GeneratedScheduleResult[] = [];
let evaluatedSchedules = 0;
let estimatedTotal = 0;
let workerOptions: OptimizerOptions;
let workerPoolBase: string[];
let workerPinned: string[];
let workerNeededFromPool: number;
let lastProgressTime = 0;
let validSchedulesCount = 0;
let processedSchedules = 0;

interface PreprocessedCourse {
  courseCode: string;
  sections: {
    homochronousSections: string[];
    vacancies: number;
    enrolled: number;
    sessions: Session[];
    bitmask: bigint;
  }[];
}
const preprocessedCourses = new Map<string, PreprocessedCourse>();
const courseConflicts = new Map<string, Set<string>>();

const evaluateCombination = (courseSet: string[]) => {
  const courseSections = courseSet.map(code => preprocessedCourses.get(code)).filter(Boolean) as PreprocessedCourse[];
  if (courseSections.some(cs => cs.sections.length === 0)) return;
  
  courseSections.sort((a, b) => a.sections.length - b.sections.length);

  let setCombinations = 1;
  courseSections.forEach(cs => {
    const totalOriginalSections = cs.sections.reduce((sum, s) => sum + s.homochronousSections.length, 0);
    setCombinations *= totalOriginalSections;
  });
  estimatedTotal += setCombinations;

  let currentThreshold = -Infinity;
  const suffixMaxBonus = new Float64Array(courseSections.length);
  
  for (let i = courseSections.length - 1; i >= 0; i--) {
    let maxBonusForCourse = 0;
    for (const sec of courseSections[i].sections) {
      let mSlots = 0;
      let aSlots = 0;
      for (let day = 0n; day < 7n; day++) {
        for (let slot = 0n; slot < 60n; slot++) {
          if ((sec.bitmask & (1n << (day * 60n + slot))) !== 0n) {
            if (slot < 20n) mSlots++;
            else aSlots++;
          }
        }
      }
      let secBonus = 0;
      if (workerOptions.targets.includes('morning')) secBonus += (mSlots * 15) / 5;
      if (workerOptions.targets.includes('afternoon')) secBonus += (aSlots * 15) / 5;
      if (secBonus > maxBonusForCourse) maxBonusForCourse = secBonus;
    }
    suffixMaxBonus[i] = maxBonusForCourse + (i < courseSections.length - 1 ? suffixMaxBonus[i + 1] : 0);
  }

  function backtrack(index: number, currentMask: bigint, currentCombination: Record<string, string[]>, currentDomains: typeof courseSections) {
    if (index === courseSections.length) {
      let totalGapSlots = 0;
      let activeDaysCount = 0;
      let morningSlots = 0;
      let afternoonSlots = 0;
      let lunchScore = 0;
      let activeSlots = 0;
      let globalEarliestSlot = 60;
      let globalLatestSlot = -1;

      const hasLunchTarget = workerOptions.lunchConfig?.enabled;
      let lunchStartSlot = 0;
      let lunchEndSlot = 0;
      let lunchDurationSlots = 0;
      if (hasLunchTarget && workerOptions.lunchConfig) {
         lunchStartSlot = Math.max(0, Math.floor((timeToMinutes(workerOptions.lunchConfig.startTime) - 420) / 15));
         lunchEndSlot = Math.max(0, Math.ceil((timeToMinutes(workerOptions.lunchConfig.endTime) - 420) / 15));
         lunchDurationSlots = Math.floor(workerOptions.lunchConfig.durationMinutes / 15);
      }

      for (let d = 0; d < 7; d++) {
         const dayMask = (currentMask >> BigInt(d * 60)) & 0x0FFFFFFFFFFFFFFFn;
         if (dayMask === 0n) continue;
         activeDaysCount++;
         
         let temp = dayMask;
         let firstSlot = -1;
         let lastSlot = -1;
         let slotsCount = 0;
         
         let lunchFreeSlots = 0;
         let maxLunchFree = 0;

         for (let i = 0n; i < 60n; i++) {
             const bit = (temp & (1n << i)) !== 0n;
             if (bit) {
                 if (firstSlot === -1) firstSlot = Number(i);
                 lastSlot = Number(i);
                 slotsCount++;
                 
                 if (i < 20n) morningSlots++; 
                 else afternoonSlots++;

                 if (hasLunchTarget) lunchFreeSlots = 0;
             } else {
                 if (hasLunchTarget && i >= BigInt(lunchStartSlot) && i < BigInt(lunchEndSlot)) {
                     lunchFreeSlots++;
                     if (lunchFreeSlots > maxLunchFree) maxLunchFree = lunchFreeSlots;
                 }
             }
         }
         
         const gaps = (lastSlot - firstSlot + 1) - slotsCount;
         if (gaps > 0) {
            totalGapSlots += gaps;
         }

         if (hasLunchTarget && maxLunchFree >= lunchDurationSlots) {
             lunchScore++;
         }

         activeSlots += slotsCount;
         if (firstSlot !== -1 && firstSlot < globalEarliestSlot) globalEarliestSlot = firstSlot;
         if (lastSlot !== -1 && lastSlot > globalLatestSlot) globalLatestSlot = lastSlot;
      }

      let bridgeDays = 0;
      let firstActiveDay = -1;
      let lastActiveDay = -1;
      for (let d = 0; d < 6; d++) { // Only Lun to Sab
         const dayMask = (currentMask >> BigInt(d * 60)) & 0x0FFFFFFFFFFFFFFFn;
         if (dayMask !== 0n) {
             if (firstActiveDay === -1) firstActiveDay = d;
             lastActiveDay = d;
         }
      }
      if (firstActiveDay !== -1 && lastActiveDay !== -1) {
          for (let d = firstActiveDay + 1; d < lastActiveDay; d++) {
             const dayMask = (currentMask >> BigInt(d * 60)) & 0x0FFFFFFFFFFFFFFFn;
             if (dayMask === 0n) {
                 bridgeDays++;
             }
          }
      }

      const totalGapMinutes = totalGapSlots * 15;
      const gapHours = Number((totalGapMinutes / 60).toFixed(2));
      const totalHours = Number(((activeSlots * 15) / 60).toFixed(1));
      const earliestStartMinutes = globalEarliestSlot === 60 ? 0 : 420 + (globalEarliestSlot * 15);
      const latestEndMinutes = globalLatestSlot === -1 ? 0 : 420 + ((globalLatestSlot + 1) * 15);
      
      const morningScoreMin = morningSlots * 15;
      const afternoonScoreMin = afternoonSlots * 15;
      const normalizedLunchScore = activeDaysCount > 0 ? lunchScore / activeDaysCount : 0;

      let rawScore = 0;
      if (workerOptions.targets.includes('min_gaps')) rawScore -= totalGapMinutes;
      if (workerOptions.targets.includes('min_days')) rawScore -= (activeDaysCount * 500);
      if (workerOptions.targets.includes('min_day_gaps')) rawScore -= (bridgeDays * 1000); 
      if (workerOptions.targets.includes('morning')) rawScore += (morningScoreMin / 5);
      if (workerOptions.targets.includes('afternoon')) rawScore += (afternoonScoreMin / 5);
      if (hasLunchTarget) rawScore += (normalizedLunchScore * 1000);

      const keys = Object.keys(currentCombination);
      const expandHelper = (idx: number, currentCombo: Record<string, string>) => {
        if (idx === keys.length) {
          topResults.push({
            id: `gen_${Date.now()}_${validSchedulesCount}`,
            selectedSections: { ...currentCombo },
            metrics: {
               totalGapMinutes,
               gapHours,
               activeDaysCount,
               totalHours,
               earliestStartMinutes,
               latestEndMinutes,
               morningScore: morningScoreMin,
               afternoonScore: afternoonScoreMin,
               lunchScore: normalizedLunchScore,
               dayGaps: bridgeDays
            },
            score: rawScore
          });
          validSchedulesCount++;
          return;
        }
        const key = keys[idx];
        for (const sectionNum of currentCombination[key]) {
          currentCombo[key] = sectionNum;
          expandHelper(idx + 1, currentCombo);
        }
      };

      expandHelper(0, {});

      // Update currentThreshold periodically
      if (topResults.length >= 50 && topResults.length % 50 === 0) {
        topResults.sort((a: GeneratedScheduleResult, b: GeneratedScheduleResult) => (b.score || 0) - (a.score || 0));
        currentThreshold = topResults[49].score || -Infinity;
      }

      if (topResults.length >= 2000) {
        topResults.sort((a: GeneratedScheduleResult, b: GeneratedScheduleResult) => (b.score || 0) - (a.score || 0));
        topResults = topResults.slice(0, 200);
        currentThreshold = topResults.length >= 50 ? (topResults[49].score || -Infinity) : -Infinity;
      }
      return;
    }

    const { courseCode, sections } = currentDomains[index];

    for (const section of sections) {
      if ((currentMask & section.bitmask) !== 0n) continue;
      
      const nextMask = currentMask | section.bitmask;
      
      // Branch & Bound Score Pruning
      let days = 0;
      let tempMask = nextMask;
      for (let d = 0; d < 7; d++) {
        if ((tempMask & 0x0FFFFFFFFFFFFFFFn) !== 0n) days++;
        tempMask >>= 60n;
      }
      let inevitablePenalty = 0;
      if (workerOptions.targets.includes('min_days')) inevitablePenalty -= days * 500;
      
      const maxFutureBonus = (index + 1 < currentDomains.length) ? suffixMaxBonus[index + 1] : 0;
      const upperBoundScore = inevitablePenalty + maxFutureBonus + (workerOptions.lunchConfig?.enabled ? 1000 : 0);
      
      if (upperBoundScore < currentThreshold) {
        continue;
      }

      currentCombination[courseCode] = section.homochronousSections;
      
      let isViable = true;
      for (let i = index + 1; i < currentDomains.length; i++) {
        let hasValidSection = false;
        const futureSections = currentDomains[i].sections;
        for (let j = 0; j < futureSections.length; j++) {
          if ((futureSections[j].bitmask & nextMask) === 0n) {
            hasValidSection = true;
            break;
          }
        }
        if (!hasValidSection) {
          isViable = false;
          break;
        }
      }
      
      if (isViable) {
        backtrack(index + 1, nextMask, currentCombination, currentDomains);
      }
    }
  }

  backtrack(0, 0n, {}, courseSections);
  
  processedSchedules += setCombinations;
  const now = Date.now();
  if (now - lastProgressTime > 100) {
     lastProgressTime = now;
     self.postMessage({ 
       type: 'PROGRESS', 
       evaluated: processedSchedules, 
       total: estimatedTotal,
       validFound: validSchedulesCount
     } as WorkerMessage);
  }
};

const generateCombinations = (currentCombo: string[], startIdx: number) => {
   if (currentCombo.length === workerNeededFromPool) {
      evaluateCombination([...workerPinned, ...currentCombo]);
      return;
   }
   for (let i = startIdx; i < workerPoolBase.length; i++) {
      const candidate = workerPoolBase[i];
      let conflict = false;
      const candidateConflicts = courseConflicts.get(candidate);
      if (candidateConflicts) {
         for (const existing of currentCombo) {
            if (candidateConflicts.has(existing)) {
               conflict = true;
               break;
            }
         }
         if (!conflict) {
            for (const existing of workerPinned) {
               if (candidateConflicts.has(existing)) {
                  conflict = true;
                  break;
               }
            }
         }
      }
      if (conflict) continue;

      currentCombo.push(candidate);
      generateCombinations(currentCombo, i + 1);
      currentCombo.pop();
   }
};

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const data = e.data;
  
  if (data.type === 'INIT') {
    const { courses, poolBase, pinned, neededFromPool, options } = data;
    
    topResults = [];
    validSchedulesCount = 0;
    processedSchedules = 0;
    evaluatedSchedules = 0;
    estimatedTotal = 0;
    workerOptions = options;
    workerPoolBase = poolBase;
    workerPinned = pinned;
    workerNeededFromPool = neededFromPool;
    preprocessedCourses.clear();
    
    for (const course of courses) {
      if (neededFromPool > 0 && !poolBase.includes(course.code) && !pinned.includes(course.code)) continue; 
      
      let validSections = course.sections;

      if (options.onlyWithVacancies) {
        validSections = validSections.filter(sec => sec.vacancies > sec.enrolled);
      }
      
      if (options.excludedDays && options.excludedDays.length > 0) {
        validSections = validSections.filter(sec => {
          return !sec.sessions.some(sess => options.excludedDays!.includes(sess.day));
        });
      }
      
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
      
      const uniqueSectionsMap = new Map<string, typeof validSections[0] & { homochronousSections: string[] }>();
      validSections.forEach(sec => {
        const hash = sec.sessions.map(s => `${s.day}-${s.startTime}-${s.endTime}`).sort().join('|');
        if (!uniqueSectionsMap.has(hash)) {
          uniqueSectionsMap.set(hash, { ...sec, homochronousSections: [sec.sectionNumber] });
        } else {
          uniqueSectionsMap.get(hash)!.homochronousSections.push(sec.sectionNumber);
        }
      });
      const deduplicatedSections = Array.from(uniqueSectionsMap.values());
      
      preprocessedCourses.set(course.code, {
        courseCode: course.code,
        sections: deduplicatedSections.map(sec => ({
          ...sec,
          bitmask: sessionToBitmask(sec.sessions)
        }))
      });
    }

    // Build Static Conflict Graph
    courseConflicts.clear();
    const codes = Array.from(preprocessedCourses.keys());
    for (let i = 0; i < codes.length; i++) {
      for (let j = i + 1; j < codes.length; j++) {
        const courseA = preprocessedCourses.get(codes[i])!;
        const courseB = preprocessedCourses.get(codes[j])!;
        
        let possible = false;
        for (const secA of courseA.sections) {
          for (const secB of courseB.sections) {
            if ((secA.bitmask & secB.bitmask) === 0n) {
              possible = true;
              break;
            }
          }
          if (possible) break;
        }
        
        if (!possible) {
          if (!courseConflicts.has(codes[i])) courseConflicts.set(codes[i], new Set());
          courseConflicts.get(codes[i])!.add(codes[j]);
          
          if (!courseConflicts.has(codes[j])) courseConflicts.set(codes[j], new Set());
          courseConflicts.get(codes[j])!.add(codes[i]);
        }
      }
    }
    
    self.postMessage({ type: 'READY' } as WorkerMessage);
  } else if (data.type === 'TASK') {
    const { task } = data;
    if (workerNeededFromPool === 0 || workerNeededFromPool === task.prefix.length) {
      evaluateCombination([...workerPinned, ...task.prefix]);
    } else {
      generateCombinations([...task.prefix], task.startIdx);
    }
    
    self.postMessage({ type: 'READY' } as WorkerMessage);
  } else if (data.type === 'FINISH') {
    topResults.sort((a, b) => (b.score || 0) - (a.score || 0));
    
    self.postMessage({ 
      type: 'PROGRESS', 
      evaluated: processedSchedules, 
      total: estimatedTotal,
      validFound: validSchedulesCount
    } as WorkerMessage);

    self.postMessage({ 
      type: 'COMPLETE', 
      results: topResults 
    } as WorkerMessage);
  }
};
