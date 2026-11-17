import type { Course, OptimizerOptions, GeneratedScheduleResult, WorkerMessage, Session } from '../types/schedule';
import { sessionToBitmask } from './scheduleUtils';
import init, { QuantumEngine } from '../../wasm-engine/pkg/wasm_engine.js';

let wasmEngine: QuantumEngine | null = null;
let isWasmInitialized = false;

let topResults: GeneratedScheduleResult[] = [];
let workerPoolBase: string[] = [];
let workerPinned: string[] = [];
let workerNeededFromPool = 0;
let estimatedTotal = 1;
let processedSchedules = 0;
let resultIdCounter = 0;

function getCombinationsCount(n: number, r: number): number {
  if (r < 0 || r > n) return 0;
  let count = 1;
  for (let i = 1; i <= r; i++) {
    count = (count * (n - i + 1)) / i;
  }
  return count;
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const data = e.data;

  if (data.type === 'INIT') {
    if (!isWasmInitialized) {
      try {
        await init();
        isWasmInitialized = true;
      } catch {
        self.postMessage({ type: 'ERROR', message: 'Failed to init WASM' });
        return;
      }
    }

    const {
      courses,
      poolBase,
      pinned,
      neededFromPool,
      options,
      pinnedSections,
      blockedTimeMask,
      isConstraintStrict,
    } = data;

    topResults = [];
    processedSchedules = 0;
    resultIdCounter = 0;
    workerPoolBase = poolBase;
    workerPinned = pinned;
    workerNeededFromPool = neededFromPool;

    const workerPinnedSections = pinnedSections || {};
    const workerBlockedTimeMask: bigint[] =
      blockedTimeMask && blockedTimeMask.length >= 7
        ? blockedTimeMask.slice(0, 7)
        : [0n, 0n, 0n, 0n, 0n, 0n, 0n];
    const workerIsConstraintStrict = Boolean(isConstraintStrict);

    const includeSet = new Set<string>([...poolBase, ...pinned]);
    const rustCourses: Array<{
      course_code: string;
      sections: Array<{ homochronous_sections: string[]; mask: bigint[] }>;
    }> = [];

    let normalModeTotalCombos = 1;

    for (const course of courses) {
      if (includeSet.size > 0 && !includeSet.has(course.code)) continue;

      let validSections = course.sections;

      if (options.onlyWithVacancies) {
        validSections = validSections.filter((sec) => sec.vacancies > sec.enrolled);
      }

      if (options.excludedDays && options.excludedDays.length > 0) {
        const excluded = new Set(options.excludedDays);
        validSections = validSections.filter(
          (sec) => !sec.sessions.some((sess: Session) => excluded.has(sess.day))
        );
      }

      if (options.isAdvancedMode) {
        if (options.minTimeMinutes !== undefined) {
          const minM = options.minTimeMinutes;
          validSections = validSections.filter(
            (sec) => !sec.sessions.some((sess: Session) => sess.startMinutes < minM)
          );
        }
        if (options.maxTimeMinutes !== undefined) {
          const maxM = options.maxTimeMinutes;
          validSections = validSections.filter(
            (sec) => !sec.sessions.some((sess: Session) => sess.endMinutes > maxM)
          );
        }
      }

      const uniqueSectionsMap = new Map<
        string,
        { homochronousSections: string[]; bitmask: bigint }
      >();
      for (const sec of validSections) {
        const hash = sec.sessions
          .map((s) => `${s.day}-${s.startTime}-${s.endTime}`)
          .sort()
          .join('|');
        const existing = uniqueSectionsMap.get(hash);
        if (!existing) {
          uniqueSectionsMap.set(hash, {
            homochronousSections: [sec.sectionNumber],
            bitmask: sessionToBitmask(sec.sessions),
          });
        } else {
          existing.homochronousSections.push(sec.sectionNumber);
        }
      }

      const deduplicated = Array.from(uniqueSectionsMap.values());
      if (neededFromPool === 0) {
        normalModeTotalCombos *= Math.max(1, deduplicated.length);
      }

      rustCourses.push({
        course_code: course.code,
        sections: deduplicated.map((sec) => {
          const maskArray: bigint[] = [];
          let temp = sec.bitmask;
          for (let d = 0; d < 7; d++) {
            maskArray.push(temp & 0x0fffffffffffffffn);
            temp >>= 60n;
          }
          return {
            homochronous_sections: sec.homochronousSections,
            mask: maskArray,
          };
        }),
      });
    }

    if (neededFromPool > 0) {
      estimatedTotal = Math.max(1, getCombinationsCount(workerPoolBase.length, workerNeededFromPool));
    } else {
      estimatedTotal = Math.max(1, normalModeTotalCombos);
    }

    try {
      wasmEngine = new QuantumEngine(
        rustCourses,
        options,
        pinned,
        poolBase,
        workerPinnedSections,
        workerBlockedTimeMask,
        workerIsConstraintStrict
      );
    } catch (err) {
      console.error('Failed to create engine', err);
      self.postMessage({ type: 'ERROR', message: 'Failed to create WASM Engine. See console.' });
      return;
    }

    self.postMessage({ type: 'READY' } as WorkerMessage);
  } else if (data.type === 'TASK') {
    const { task } = data;

    try {
      if (!wasmEngine) return;

      const progressCallback = (nodes: number) => {
        self.postMessage({
          type: 'PROGRESS',
          evaluated: processedSchedules + nodes,
          total: estimatedTotal,
          validFound: topResults.length,
        } as WorkerMessage);
      };

      const rustResults = wasmEngine.compute_chunk(
        workerNeededFromPool,
        task.prefix,
        task.startIdx,
        task.maxNodesLimit || 0,
        task.sectionFilters || {},
        progressCallback
      );

      if (Array.isArray(rustResults) && rustResults.length > 0) {
        for (const r of rustResults) {
          const keys = Object.keys(r.selectedSections);
          const expandHelper = (idx: number, currentSelections: Record<string, string>) => {
            if (idx === keys.length) {
              topResults.push({
                id: `gen_${resultIdCounter++}`,
                selectedSections: { ...currentSelections },
                metrics: r.metrics,
                score: r.score,
              });

              if (topResults.length >= 2000) {
                topResults.sort((a, b) => (b.score || 0) - (a.score || 0));
                topResults = topResults.slice(0, 200);
              }
              return;
            }
            const courseCode = keys[idx];
            const sectionArray = r.selectedSections[courseCode] as string[];
            for (const sec of sectionArray) {
              currentSelections[courseCode] = sec;
              expandHelper(idx + 1, currentSelections);
            }
          };
          expandHelper(0, {});
        }
      }

      const chunkWeight =
        task.estimatedCombos ??
        (workerNeededFromPool > 0
          ? getCombinationsCount(
              workerPoolBase.length - task.startIdx,
              workerNeededFromPool - task.prefix.length
            )
          : Math.max(1, Math.round(estimatedTotal / 8)));
      processedSchedules += chunkWeight;

      self.postMessage({
        type: 'PROGRESS',
        evaluated: processedSchedules,
        total: estimatedTotal,
        validFound: topResults.length,
      } as WorkerMessage);
    } catch (err) {
      console.error('Error in compute_chunk', err);
    }

    self.postMessage({ type: 'READY' } as WorkerMessage);
  } else if (data.type === 'FINISH') {
    topResults.sort((a, b) => (b.score || 0) - (a.score || 0));
    const finalResults = topResults.slice(0, 200);

    self.postMessage({
      type: 'PROGRESS',
      evaluated: processedSchedules,
      total: estimatedTotal,
      validFound: finalResults.length,
    } as WorkerMessage);

    self.postMessage({
      type: 'COMPLETE',
      results: finalResults,
    } as WorkerMessage);
  }
};
