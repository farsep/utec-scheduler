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



let topResults: GeneratedScheduleResult[] = [];
let evaluatedSchedules = 0;
let estimatedTotal = 0;
let workerOptions: OptimizerOptions;
let workerPoolBase: string[];
let workerPinned: string[];
let workerNeededFromPool: number;

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

  function backtrack(index: number, currentMask: bigint, currentCombination: Record<string, string[]>, currentSessions: Session[], currentDomains: typeof courseSections) {
    if (index === courseSections.length) {
      const metrics = calculateMetricsFromSessions(currentSessions, workerOptions);
      
      let rawScore = 0;
      if (workerOptions.targets.includes('min_gaps')) rawScore -= metrics.totalGapMinutes;
      if (workerOptions.targets.includes('min_days')) rawScore -= (metrics.activeDaysCount * 500);
      if (workerOptions.targets.includes('min_day_gaps')) rawScore -= (metrics.dayGaps * 1000); 
      if (workerOptions.targets.includes('morning')) rawScore += (metrics.morningScore / 5);
      if (workerOptions.targets.includes('afternoon')) rawScore += (metrics.afternoonScore / 5);
      if (workerOptions.lunchConfig?.enabled) rawScore += (metrics.lunchScore * 1000);

      const keys = Object.keys(currentCombination);
      const expandHelper = (idx: number, currentCombo: Record<string, string>) => {
        if (idx === keys.length) {
          topResults.push({
            id: `gen_${Date.now()}_${evaluatedSchedules}`,
            selectedSections: { ...currentCombo },
            metrics,
            score: rawScore
          });
          evaluatedSchedules++;
          
          if (evaluatedSchedules % 5000 === 0) {
            self.postMessage({ 
              type: 'PROGRESS', 
              evaluated: evaluatedSchedules, 
              total: estimatedTotal,
              validFound: evaluatedSchedules
            } as WorkerMessage);
          }
          return;
        }
        const key = keys[idx];
        for (const sectionNum of currentCombination[key]) {
          currentCombo[key] = sectionNum;
          expandHelper(idx + 1, currentCombo);
        }
      };

      expandHelper(0, {});

      if (topResults.length >= 2000) {
        topResults.sort((a: GeneratedScheduleResult, b: GeneratedScheduleResult) => (b.score || 0) - (a.score || 0));
        topResults = topResults.slice(0, 200);
      }
      return;
    }

    const { courseCode, sections } = currentDomains[index];

    for (const section of sections) {
      if ((currentMask & section.bitmask) !== 0n) continue;
      
      currentCombination[courseCode] = section.homochronousSections;
      const nextMask = currentMask | section.bitmask;
      
      let isViable = true;
      const nextDomains = [];
      
      for (let i = 0; i < currentDomains.length; i++) {
        if (i <= index) {
          nextDomains.push(currentDomains[i]); 
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
};

const generateCombinations = (currentCombo: string[], startIdx: number) => {
   if (currentCombo.length === workerNeededFromPool) {
      evaluateCombination([...workerPinned, ...currentCombo]);
      return;
   }
   for (let i = startIdx; i < workerPoolBase.length; i++) {
      currentCombo.push(workerPoolBase[i]);
      generateCombinations(currentCombo, i + 1);
      currentCombo.pop();
   }
};

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const data = e.data;
  
  if (data.type === 'INIT') {
    const { courses, poolBase, pinned, neededFromPool, options } = data;
    
    topResults = [];
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
