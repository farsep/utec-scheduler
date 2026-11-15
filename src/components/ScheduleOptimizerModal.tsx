import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Clock, Coffee, Eye, Pin, Info, Filter, ShieldAlert, CheckCircle2, Search, ArrowLeft, Lock, Unlock, CheckSquare, Square, ChevronRight, Check, SlidersHorizontal, User } from 'lucide-react';
import type { Course, OptimizerOptions, GeneratedScheduleResult, DayOfWeek } from '../types/schedule';
import { generateOptimalSchedules } from '../utils/scheduleOptimizer';
import { formatLocation, getCourseColor, getCourseDepartmentPalette, getCoursePrefix, minutesToTime, normalizeString, getCombinations, sessionToBitmask } from '../utils/scheduleUtils';
import { TimetableGrid } from './TimetableGrid';
import { GlassTimePicker } from './GlassTimePicker';
import { CustomSelect } from './common/CustomSelect';
import { TimeBlockerGrid } from './TimeBlockerGrid';
import { ErrorBoundary } from './ErrorBoundary';
import { QuantumEngineVisualizer } from './QuantumEngineVisualizer';

// Patch BigInt to be serializable by JSON.stringify
// This prevents React DevTools from crashing the entire app when inspecting state that contains BigInts
if (typeof BigInt !== 'undefined' && !(BigInt.prototype as any).toJSON) {
  (BigInt.prototype as any).toJSON = function () {
    return this.toString() + 'n';
  };
}

function formatCompactSectionLabel(rawSecStr: string): { mainText: string; labSuffix: string | null; hasLab: boolean } {
  const hasLab = /LABORATORIO|LAB/i.test(rawSecStr);
  const compact = rawSecStr
    .replace(/\(\s*LABORATORIO\s*(\d+)\s*\)/gi, '· LAB $1')
    .replace(/\(\s*TEOR[ÍI]A\s*(\d+)\s*\)/gi, '· TEO $1')
    .replace(/LABORATORIO\s*(\d+)/gi, 'LAB $1')
    .replace(/TEOR[ÍI]A\s*(\d+)/gi, 'TEO $1')
    .replace(/\s+/g, ' ')
    .trim();

  const labMatch = compact.match(/^(.*?)\s*((?:·\s*)?LAB\s*\d+.*)$/i);
  if (labMatch && labMatch[1]) {
    return {
      mainText: `Sec ${labMatch[1].trim()}`,
      labSuffix: labMatch[2].trim().startsWith('·') ? labMatch[2].trim() : `· ${labMatch[2].trim()}`,
      hasLab: true,
    };
  }
  return { mainText: `Sec ${compact}`, labSuffix: null, hasLab };
}

interface ScheduleOptimizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  initialSelectedCourseCodes: string[];
  onApplyToCurrent: (sections: Record<string, string>) => void;
  onCreateNewOption: (sections: Record<string, string>) => string;
}

export const ScheduleOptimizerModal: React.FC<ScheduleOptimizerModalProps> = ({
  isOpen,
  onClose,
  courses,
  initialSelectedCourseCodes,
  onApplyToCurrent,
  onCreateNewOption
}) => {
  const [selectedCourseCodes, setSelectedCourseCodes] = useState<string[]>(initialSelectedCourseCodes);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyEligible, setShowOnlyEligible] = useState(false);
  
  const [options, setOptions] = useState<OptimizerOptions>({
    targets: ['min_gaps'],
    excludedDays: [],
    onlyWithVacancies: false
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GeneratedScheduleResult[] | null>(null);

  const [previewSchedule, setPreviewSchedule] = useState<Record<string, string> | null>(null);
  const [activeSaveId, setActiveSaveId] = useState<string | null>(null);
  const [lastSavedName, setLastSavedName] = useState<string | null>(null);
  const [savedOptionsRecord, setSavedOptionsRecord] = useState<Record<string, string[]>>({});

  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [showBlockerGrid, setShowBlockerGrid] = useState(false);
  const [pinnedCourseCodes, setPinnedCourseCodes] = useState<string[]>([]);
  const [maxCourses, setMaxCourses] = useState(5);
  const [minTime, setMinTime] = useState<string>('07:00');
  const [maxTime, setMaxTime] = useState<string>('22:00');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Obligatorio' | 'Electivo'>('ALL');
  
  // Lunch Break state
  const [isLunchEnabled, setIsLunchEnabled] = useState(false);
  const [lunchStart, setLunchStart] = useState<string>('12:00');
  const [lunchEnd, setLunchEnd] = useState<string>('15:00');
  const [lunchDuration, setLunchDuration] = useState<number>(60);
  
  const [workerProgress, setWorkerProgress] = useState<{ evaluated: number, total: number, validFound: number } | null>(null);
  const [mobileViewPane, setMobileViewPane] = useState<'config' | 'results'>('config');
  const [evalPhase, setEvalPhase] = useState<'init' | 'searching' | 'complete'>('init');
  const workerRefs = useRef<Worker[]>([]);
  const workersReadyRef = useRef<boolean[]>([]);
  const lastInitHashRef = useRef<string>('');
  const generationStartTimeRef = useRef<number>(0);
  const totalCombinationsRef = useRef<number>(0);
  const finishTimerRef = useRef<number | null>(null);
  const isGeneratingRef = useRef<boolean>(false);
  
  // Advanced Constraints State
  const [pinnedSections, setPinnedSections] = useState<Record<string, string>>({});
  const [blockedTimeMask, setBlockedTimeMask] = useState<bigint[]>([0n, 0n, 0n, 0n, 0n, 0n, 0n]);
  const [blockedSectionsForTime, setBlockedSectionsForTime] = useState<Array<{courseCode: string, sectionName: string}>>([]);
  const [isConstraintStrict, setIsConstraintStrict] = useState(false);
  const [hoveredSectionForPreview, setHoveredSectionForPreview] = useState<{ courseCode: string; sectionName: string } | null>(null);

  const computedHoveredMask = useMemo(() => {
    if (!hoveredSectionForPreview) return null;
    const course = courses.find(c => c.code === hoveredSectionForPreview.courseCode);
    if (!course) return null;
    const sec = course.sections.find(s => s.sectionNumber === hoveredSectionForPreview.sectionName);
    if (!sec) return null;
    const mask = [0n, 0n, 0n, 0n, 0n, 0n, 0n];
    let temp = sessionToBitmask(sec.sessions);
    for (let d = 0; d < 7; d++) {
      mask[d] = temp & 0x0FFFFFFFFFFFFFFFn;
      temp >>= 60n;
    }
    return mask;
  }, [hoveredSectionForPreview, courses]);

  const mergedBlockedTimeMask = useMemo(() => {
    const newMask = [...blockedTimeMask];
    blockedSectionsForTime.forEach(bs => {
      const course = courses.find(c => c.code === bs.courseCode);
      if (course) {
        const sec = course.sections.find(s => s.sectionNumber === bs.sectionName);
        if (sec) {
          let temp = sessionToBitmask(sec.sessions);
          for (let d = 0; d < 7; d++) {
            newMask[d] |= (temp & 0x0FFFFFFFFFFFFFFFn);
            temp >>= 60n;
          }
        }
      }
    });
    return newMask;
  }, [blockedTimeMask, blockedSectionsForTime, courses]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const cancelGeneration = () => {
    if (finishTimerRef.current !== null) {
      window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
    isGeneratingRef.current = false;
    workerRefs.current.forEach(w => w.terminate());
    workerRefs.current = [];
    workersReadyRef.current = [];
    lastInitHashRef.current = '';
    setIsGenerating(false);
    setWorkerProgress(null);
    setEvalPhase('init');
  };

  const prevIsOpen = useRef(false);

  // Focus trap ref
  const modalRef = useRef<HTMLDivElement>(null);

  // When modal opens/closes, sync initial selection only on open transition and cleanup workers/timers on close
  useEffect(() => {
    if (isOpen) {
      const wasOpen = prevIsOpen.current;
      prevIsOpen.current = true;
      if (!wasOpen) {
        setPreviewSchedule(null);
        setResults(null);
        if (initialSelectedCourseCodes.length > 0) {
          setSelectedCourseCodes(initialSelectedCourseCodes);
        } else if (courses.length > 0) {
          // Pre-select up to 4 courses when opening with an empty schedule so the generator is ready
          const defaultCodes = courses.filter(c => c.sections.length > 0).slice(0, 4).map(c => c.code);
          if (defaultCodes.length > 0) {
            setSelectedCourseCodes(defaultCodes);
          }
        }
        setMobileViewPane('config');
      }
    } else if (prevIsOpen.current) {
      prevIsOpen.current = false;
      isGeneratingRef.current = false;
      if (finishTimerRef.current !== null) {
        window.clearTimeout(finishTimerRef.current);
        finishTimerRef.current = null;
      }
      // Terminate workers on close to save RAM
      workerRefs.current.forEach(w => w.terminate());
      workerRefs.current = [];
      workersReadyRef.current = [];
      lastInitHashRef.current = '';
    }
  }, [isOpen, initialSelectedCourseCodes, courses]);

  // Warm-up Effect
  useEffect(() => {
    if (!isOpen || !isAdvancedMode || isGenerating || isGeneratingRef.current) return;

    const timeToMinutes = (timeStr: string) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    const currentOptions: OptimizerOptions = {
      ...options,
      isAdvancedMode,
      maxCourses,
      pinnedCourseCodes,
      minTimeMinutes: isAdvancedMode ? timeToMinutes(minTime) : undefined,
      maxTimeMinutes: isAdvancedMode ? timeToMinutes(maxTime) : undefined,
      lunchConfig: {
        enabled: isLunchEnabled,
        startTime: lunchStart,
        endTime: lunchEnd,
        durationMinutes: lunchDuration
      }
    };

    const pinned = pinnedCourseCodes || [];
    const targetCourses = maxCourses || 5;
    const neededFromPool = targetCourses - pinned.length;
    const pool = selectedCourseCodes.filter(c => !pinned.includes(c));
    const poolBase = neededFromPool <= 0 ? [] : pool;

    const currentHash = JSON.stringify({ 
      poolBase, 
      pinned, 
      neededFromPool, 
      options: currentOptions,
      pinnedSections,
      blockedTimeMask: mergedBlockedTimeMask.map(b => b.toString()),
      isConstraintStrict 
    });

    const timer = setTimeout(() => {
      if (isGeneratingRef.current) return;
      const numWorkers = navigator.hardwareConcurrency || 4;
      if (workerRefs.current.length === 0) {
        for (let i = 0; i < numWorkers; i++) {
          workerRefs.current.push(new Worker(new URL('../utils/scheduleWorker.ts', import.meta.url), { type: 'module' }));
          workersReadyRef.current.push(false);
        }
      }

      if (lastInitHashRef.current !== currentHash) {
        lastInitHashRef.current = currentHash;
        workersReadyRef.current.fill(false);
        
        workerRefs.current.forEach((worker, i) => {
          worker.onmessage = (e) => {
            if (e.data.type === 'READY') {
              workersReadyRef.current[i] = true;
            }
          };
          worker.postMessage({
            type: 'INIT',
            courses,
            poolBase,
            pinned,
            neededFromPool,
            options: currentOptions,
            pinnedSections,
            blockedTimeMask: mergedBlockedTimeMask,
            isConstraintStrict
          });
        });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [
    isOpen, isAdvancedMode, courses, options, maxCourses, 
    pinnedCourseCodes, minTime, maxTime, isLunchEnabled, 
    lunchStart, lunchEnd, lunchDuration, selectedCourseCodes,
    pinnedSections, mergedBlockedTimeMask, isConstraintStrict
  ]);

  const toggleCourse = (code: string) => {
    setSelectedCourseCodes(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const togglePin = (code: string) => {
    setPinnedCourseCodes(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const handleTogglePinSection = useCallback((courseCode: string, secName: string, currentlyPinned: boolean) => {
    console.log("Toggle Pin Section:", courseCode, secName, "Currently Pinned:", currentlyPinned);
    setPinnedSections(prev => {
      if (currentlyPinned) {
        const { [courseCode]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [courseCode]: secName };
    });
  }, []);

  const handleBlockSection = useCallback((courseCode: string, sectionName: string) => {
    setBlockedSectionsForTime(prev => {
      const exists = prev.find(p => p.courseCode === courseCode && p.sectionName === sectionName);
      if (exists) {
        return prev.filter(p => !(p.courseCode === courseCode && p.sectionName === sectionName));
      }
      return [...prev, { courseCode, sectionName }];
    });
  }, []);

  const handleGenerate = () => {
    if (finishTimerRef.current !== null) {
      window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
    generationStartTimeRef.current = performance.now();
    totalCombinationsRef.current = 0;
    isGeneratingRef.current = true;
    setEvalPhase('init');
    setIsGenerating(true);
    setMobileViewPane('results');
    setPreviewSchedule(null);
    setSavedOptionsRecord({});
    setWorkerProgress(null);
    setResults(null);

    setTimeout(() => {
      const timeToMinutes = (timeStr: string) => {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
      };

      const currentOptions: OptimizerOptions = {
        ...options,
        isAdvancedMode,
        maxCourses,
        pinnedCourseCodes,
        minTimeMinutes: isAdvancedMode ? timeToMinutes(minTime) : undefined,
        maxTimeMinutes: isAdvancedMode ? timeToMinutes(maxTime) : undefined,
        lunchConfig: {
          enabled: isLunchEnabled,
          startTime: lunchStart,
          endTime: lunchEnd,
          durationMinutes: lunchDuration
        }
      };

      // Lazy Generation Setup
      let chunkTasks: {prefix: string[], startIdx: number}[] = [];
      let totalCombinations = 0;
      let poolBase: string[] = [];
      let neededFromPool = 0;
      let pinned: string[] = [];
      if (isAdvancedMode) {
        pinned = pinnedCourseCodes || [];
        const targetCourses = maxCourses || 5;
        neededFromPool = targetCourses - pinned.length;
        
        if (neededFromPool <= 0) {
          chunkTasks = [{ prefix: [], startIdx: 0 }];
          totalCombinations = 1;
          neededFromPool = 0;
        } else {
          const pool = selectedCourseCodes.filter(c => !pinned.includes(c));
          if (pool.length < neededFromPool) {
            alert('No hay suficientes cursos habilitados para alcanzar la cantidad deseada.');
            setIsGenerating(false);
            return;
          }

          // Build lightweight static conflict graph to prune chunkTasks
          const courseConflicts = new Map<string, Set<string>>();
          for (let i = 0; i < pool.length; i++) {
            for (let j = i + 1; j < pool.length; j++) {
              const c1 = courses.find(c => c.code === pool[i]);
              const c2 = courses.find(c => c.code === pool[j]);
              if (!c1 || !c2) continue;
              
              let possible = false;
              for (const s1 of c1.sections) {
                const b1 = sessionToBitmask(s1.sessions);
                for (const s2 of c2.sections) {
                  const b2 = sessionToBitmask(s2.sessions);
                  if ((b1 & b2) === 0n) {
                    possible = true;
                    break;
                  }
                }
                if (possible) break;
              }
              if (!possible) {
                if (!courseConflicts.has(pool[i])) courseConflicts.set(pool[i], new Set());
                if (!courseConflicts.has(pool[j])) courseConflicts.set(pool[j], new Set());
                courseConflicts.get(pool[i])!.add(pool[j]);
                courseConflicts.get(pool[j])!.add(pool[i]);
              }
            }
          }

          let count = 1;
          for (let i = 1; i <= neededFromPool; i++) {
            count = (count * (pool.length - i + 1)) / i;
          }
          totalCombinations = count;

          const depth = 1; // Limit prefix chunks to depth 1 (O(N) chunks) instead of O(N^2)
          function generateTasks(currentCombo: string[], startIdx: number) {
            if (currentCombo.length === depth || currentCombo.length === neededFromPool) {
              chunkTasks.push({ prefix: [...currentCombo], startIdx });
              return;
            }
            for (let i = startIdx; i < pool.length; i++) {
              const candidate = pool[i];
              let conflict = false;
              const conflicts = courseConflicts.get(candidate);
              if (conflicts) {
                for (const existing of currentCombo) {
                  if (conflicts.has(existing)) {
                    conflict = true;
                    break;
                  }
                }
              }
              if (conflict) continue;

              currentCombo.push(candidate);
              generateTasks(currentCombo, i + 1);
              currentCombo.pop();
            }
          }
          generateTasks([], 0);
          poolBase = pool;
        }
      } else {
        chunkTasks = [{ prefix: selectedCourseCodes, startIdx: 0 }];
        totalCombinations = selectedCourseCodes.reduce((acc, code) => {
          const c = courses.find(item => item.code === code);
          return acc * Math.max(1, c ? c.sections.length : 1);
        }, 1);
        neededFromPool = selectedCourseCodes.length;
      }

      totalCombinationsRef.current = Math.max(1, totalCombinations);
      const numWorkers = navigator.hardwareConcurrency || 4;
      
      if (chunkTasks.length === 0) {
        const elapsed = performance.now() - generationStartTimeRef.current;
        finishTimerRef.current = window.setTimeout(() => {
          isGeneratingRef.current = false;
          setResults([]);
          setIsGenerating(false);
          setMobileViewPane('results');
          finishTimerRef.current = null;
        }, Math.max(0, 1000 - elapsed));
        return;
      }

      if (workerRefs.current.length === 0) {
        for (let i = 0; i < numWorkers; i++) {
          workerRefs.current.push(new Worker(new URL('../utils/scheduleWorker.ts', import.meta.url), { type: 'module' }));
          workersReadyRef.current.push(false);
        }
      }

      const tasksQueue = [...chunkTasks];
      const allResults: GeneratedScheduleResult[][] = Array(numWorkers).fill([]);
      const workersProgress = Array(numWorkers).fill({ evaluated: 0, total: 0, validFound: 0 });
      let completedWorkers = 0;
      let hasError = false;

      const updateGlobalProgress = () => {
        let globalEvaluated = 0;
        let globalTotal = 0;
        let globalValid = 0;
        for (const wp of workersProgress) {
          globalEvaluated += wp.evaluated;
          globalTotal += wp.total;
          globalValid += wp.validFound;
        }
        setWorkerProgress({ evaluated: globalEvaluated, total: globalTotal, validFound: globalValid });
      };

      const currentHash = JSON.stringify({
        poolBase,
        pinned,
        neededFromPool,
        options: currentOptions,
        pinnedSections,
        blockedTimeMask: mergedBlockedTimeMask.map(b => b.toString()),
        isConstraintStrict
      });
      const needsInit = lastInitHashRef.current !== currentHash || !workersReadyRef.current.every(Boolean);
      if (needsInit) {
        lastInitHashRef.current = currentHash;
        workersReadyRef.current.fill(false);
      }

      for (let i = 0; i < numWorkers; i++) {
        const worker = workerRefs.current[i];

        worker.onmessage = (e: MessageEvent) => {
          const msg = e.data;
          if (msg.type === 'READY') {
            workersReadyRef.current[i] = true;
            if (tasksQueue.length > 0) {
              const nextTask = tasksQueue.shift()!;
              worker.postMessage({ type: 'TASK', task: nextTask });
            } else {
              worker.postMessage({ type: 'FINISH' });
            }
          } else if (msg.type === 'PROGRESS') {
            workersProgress[i] = { evaluated: msg.evaluated, total: msg.total, validFound: msg.validFound };
            setEvalPhase('searching');
            updateGlobalProgress();
          } else if (msg.type === 'COMPLETE') {
            allResults[i] = msg.results;
            completedWorkers++;
            // We DO NOT terminate the worker anymore! It stays alive for subsequent generations.

            if (completedWorkers === numWorkers && !hasError) {
              const mergedResults = allResults.flat();
              mergedResults.sort((a, b) => (b.score || 0) - (a.score || 0));
              setEvalPhase('complete');
              setWorkerProgress(prev => ({
                evaluated: Math.max(prev?.evaluated ?? 0, totalCombinationsRef.current || 1),
                total: Math.max(prev?.total ?? 0, totalCombinationsRef.current || 1),
                validFound: mergedResults.length
              }));
              const elapsed = performance.now() - generationStartTimeRef.current;
              const remainingDelay = Math.max(0, 1000 - elapsed);
              finishTimerRef.current = window.setTimeout(() => {
                isGeneratingRef.current = false;
                setResults(mergedResults.slice(0, 200));
                setIsGenerating(false);
                setMobileViewPane('results');
                finishTimerRef.current = null;
              }, remainingDelay);
            }
          } else if (msg.type === 'ERROR') {
            if (!hasError) {
              hasError = true;
              isGeneratingRef.current = false;
              alert(msg.message);
              setIsGenerating(false);
              // Only on error we reset the workers to ensure a clean state
              workerRefs.current.forEach(w => w.terminate());
              workerRefs.current = [];
              workersReadyRef.current = [];
              lastInitHashRef.current = '';
            }
          }
        };

        if (needsInit) {
          worker.postMessage({
            type: 'INIT',
            courses,
            poolBase,
            pinned,
            neededFromPool,
            options: currentOptions,
            pinnedSections,
            blockedTimeMask: mergedBlockedTimeMask,
            isConstraintStrict
          });
        } else if (workersReadyRef.current[i]) {
          // Worker is already warmed up, start TASK immediately
          if (tasksQueue.length > 0) {
            const nextTask = tasksQueue.shift()!;
            worker.postMessage({ type: 'TASK', task: nextTask });
          } else {
            worker.postMessage({ type: 'FINISH' });
          }
        }
      }
    }, 10);
  };

  const toggleExcludedDay = (day: DayOfWeek) => {
    setOptions(prev => {
      const prevExcluded = prev.excludedDays || [];
      const excluded = prevExcluded.includes(day)
        ? prevExcluded.filter(d => d !== day)
        : [...prevExcluded, day];
      return { ...prev, excludedDays: excluded };
    });
  };

  const hasEligibleFilter = courses.some(c => c.isEligible) && courses.some(c => !c.isEligible);
  const hasCourseTypeFilter = courses.some(c => c.courseType === 'Obligatorio') && courses.some(c => c.courseType === 'Electivo');

  const filteredCourses = useMemo(() => {
    let result = courses;
    if (showOnlyEligible) {
      result = result.filter(c => c.isEligible);
    }
    if (typeFilter !== 'ALL') {
      result = result.filter(c => c.courseType === typeFilter);
    }
    const q = normalizeString(searchQuery);
    if (q) {
      result = result.filter(c => {
        const cCode = normalizeString(c.code);
        const cName = normalizeString(c.name);
        return cCode.includes(q) || cName.includes(q);
      });
    }
    return result;
  }, [courses, searchQuery, showOnlyEligible, typeFilter]);

  const courseBlocksForGrid = useMemo(() => {
    const blocks: { dayIdx: number; startSlot: number; endSlot: number; color: string; title: string; subtitle: string; }[] = [];
    blockedSectionsForTime.forEach(bs => {
      const course = courses.find(c => c.code === bs.courseCode);
      if (!course) return;
      const sec = course.sections.find(s => s.sectionNumber === bs.sectionName);
      if (!sec) return;
      
      const dayOffsets: Record<string, number> = { 'Lun': 0, 'Mar': 1, 'Mie': 2, 'Jue': 3, 'Vie': 4, 'Sab': 5, 'Dom': 6 };
      sec.sessions.forEach(session => {
        const dayIdx = dayOffsets[session.day];
        if (dayIdx !== undefined) {
          const startSlot = Math.max(0, Math.floor((session.startMinutes - 420) / 15));
          const endSlot = Math.max(0, Math.ceil((session.endMinutes - 420) / 15)) - 1;
          if (startSlot <= endSlot) {
            blocks.push({
              dayIdx,
              startSlot,
              endSlot,
              color: course.color,
              title: course.code,
              subtitle: `Sec ${sec.sectionNumber}`
            });
          }
        }
      });
    });
    return blocks;
  }, [blockedSectionsForTime, courses]);

  // Ghost blocks for selected courses + viability enforcement
  // Visual  : one block per unique session TIME RANGE (deduplicated), labeled with density
  // Protect : hard-protect intersection; soft-correct via handleBlockedMaskChange
  const { pinnedBlocksForGrid, pinnedTimeMask, courseViabilityMasks } = useMemo(() => {
    const dayOffsets: Record<string, number> = { 'Lun': 0, 'Mar': 1, 'Mie': 2, 'Jue': 3, 'Vie': 4, 'Sab': 5, 'Dom': 6 };

    type GhostBlock = {
      dayIdx: number; startSlot: number; endSlot: number;
      color: string; title: string; subtitle: string;
      density: number; // fraction of sections sharing this slot (0-1)
      isParent: boolean; // shared by most/all sections
    };

    const blocks: GhostBlock[] = [];
    const protectedMask = [0n, 0n, 0n, 0n, 0n, 0n, 0n];
    const viabilityMasks: Record<string, bigint[][]> = {};

    const sessionMask = (sessions: any[]): bigint[] => {
      const m = [0n, 0n, 0n, 0n, 0n, 0n, 0n];
      sessions.forEach(s => {
        const d = dayOffsets[s.day];
        if (d === undefined) return;
        const start = Math.max(0, Math.floor((s.startMinutes - 420) / 15));
        const end   = Math.max(0, Math.ceil ((s.endMinutes   - 420) / 15)) - 1;
        for (let i = start; i <= end; i++) m[d] |= (1n << BigInt(i));
      });
      return m;
    };

    selectedCourseCodes.forEach(code => {
      const course = courses.find(c => c.code === code);
      if (!course || course.sections.length === 0) return;

      const isCoursePinned  = pinnedCourseCodes.includes(code);
      const pinnedSecName   = pinnedSections[code];

      // Ghost blocks + protection only when the user has explicitly fixed the course
      // (thumbtack pin) or locked a specific section (candado).
      // Merely selecting a course for the pool does NOT show ghost blocks.
      if (!isCoursePinned && !pinnedSecName) return;

      const uniqueSecNames = [...new Set(course.sections.map(s => s.sectionNumber))];
      const totalSections  = uniqueSecNames.length;

      // Per-section masks for viability validation
      const secMasks = uniqueSecNames
        .map(n => course.sections.find(s => s.sectionNumber === n))
        .filter(Boolean)
        .map(sec => sessionMask(sec!.sessions));
      viabilityMasks[code] = secMasks;

      if (pinnedSecName) {
        // Specific section candado-pinned: show only it, protect its slots fully
        const sec = course.sections.find(s => s.sectionNumber === pinnedSecName);
        if (!sec) return;
        const m = sessionMask(sec.sessions);
        sec.sessions.forEach(s => {
          const d = dayOffsets[s.day];
          if (d === undefined) return;
          const start = Math.max(0, Math.floor((s.startMinutes - 420) / 15));
          const end   = Math.max(0, Math.ceil ((s.endMinutes   - 420) / 15)) - 1;
          if (start <= end) blocks.push({ dayIdx: d, startSlot: start, endSlot: end, color: course.color, title: course.code, subtitle: `[FIJO] ${pinnedSecName}`, density: 1, isParent: true });
        });
        for (let d = 0; d < 7; d++) protectedMask[d] |= m[d];
      } else {
        // Group sessions by exact time range to avoid duplicate blocks
        const groups = new Map<string, { dayIdx: number; startSlot: number; endSlot: number; sections: Set<string> }>();
        uniqueSecNames.forEach(secName => {
          const sec = course.sections.find(s => s.sectionNumber === secName);
          if (!sec) return;
          sec.sessions.forEach(s => {
            const d = dayOffsets[s.day];
            if (d === undefined) return;
            const start = Math.max(0, Math.floor((s.startMinutes - 420) / 15));
            const end   = Math.max(0, Math.ceil ((s.endMinutes   - 420) / 15)) - 1;
            if (start > end) return;
            const key = `${d}-${start}-${end}`;
            if (!groups.has(key)) groups.set(key, { dayIdx: d, startSlot: start, endSlot: end, sections: new Set() });
            groups.get(key)!.sections.add(secName);
          });
        });

        groups.forEach(g => {
          const shared  = g.sections.size;
          const density = shared / totalSections;
          const isParent = density >= 0.75;
          let subtitle: string;
          if (shared === totalSections)    subtitle = `Todas (${totalSections})`;
          else if (shared === 1)           subtitle = `Sec ${[...g.sections][0]}`;
          else                             subtitle = `${shared}/​${totalSections} secs`;
          blocks.push({ dayIdx: g.dayIdx, startSlot: g.startSlot, endSlot: g.endSlot, color: course.color, title: course.code, subtitle, density, isParent });
        });

        // Hard-protect intersection (slots ALL sections share)
        if (secMasks.length > 0) {
          const intersect = Array.from({ length: 7 }, () => (1n << 60n) - 1n);
          secMasks.forEach(m => { for (let d = 0; d < 7; d++) intersect[d] &= m[d]; });
          for (let d = 0; d < 7; d++) protectedMask[d] |= intersect[d];
        }
      }
    });

    return { pinnedBlocksForGrid: blocks, pinnedTimeMask: protectedMask, courseViabilityMasks: viabilityMasks };
  }, [selectedCourseCodes, pinnedSections, pinnedCourseCodes, courses]);

  // Viability-aware mask setter: after each drag, ensure at least one complete section
  // per course remains unblocked. If not, restore the least-blocked section.
  const handleBlockedMaskChange = useCallback((newMask: bigint[]) => {
    let validated = [...newMask] as bigint[];
    Object.entries(courseViabilityMasks).forEach(([, sectionMasks]) => {
      if (sectionMasks.length === 0) return;
      const hasViable = sectionMasks.some(secMask =>
        secMask.every((dayMask, d) => (validated[d] & dayMask) === 0n)
      );
      if (!hasViable) {
        // Find the section with the fewest currently-blocked slots and restore it
        let minBlocked = Infinity;
        let bestMask = sectionMasks[0];
        sectionMasks.forEach(secMask => {
          let n = 0;
          for (let d = 0; d < 7; d++) {
            let bits = validated[d] & secMask[d];
            while (bits !== 0n) { n++; bits &= bits - 1n; }
          }
          if (n < minBlocked) { minBlocked = n; bestMask = secMask; }
        });
        for (let d = 0; d < 7; d++) validated[d] &= ~bestMask[d];
      }
    });
    setBlockedTimeMask(validated);
  }, [courseViabilityMasks]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card optimizer-modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="Generador Automático de Horarios"
        onClick={e => e.stopPropagation()}
      >
        
        {/* Header */}
        <div
          className="modal-header"
          style={{
            padding: '16px 20px',
            borderBottom: '3px solid #00779E',
            backgroundColor: '#DCD9D2',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              backgroundColor: '#E0EBF5',
              border: '1.5px solid #18181A',
              borderTop: '3px solid #00779E',
              borderRadius: '0px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: '#004D6B'
            }}>
              <SlidersHorizontal size={18} />
            </div>
            <div>
              <h3 className="modal-title" style={{ fontSize: '1.15rem', marginBottom: '2px', color: '#141416', fontWeight: 700 }}>Generador Automático de Horarios</h3>
              <p style={{ fontSize: '0.82rem', color: '#5A5852', margin: 0 }}>Encuentra las mejores combinaciones sin cruces y con menor cantidad de huecos.</p>
            </div>
          </div>
          <button
            className="close-btn"
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '0px',
              border: '1.5px solid #18181A',
              backgroundColor: '#DCD9D2',
              color: '#141416',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '1.5px 1.5px 0px #18181A'
            }}
          >
            <X size={18} />
          </button>
        </div>

        <ErrorBoundary>
        {/* Content Body - Split View */}
        <div
          className={`optimizer-split-body ${
            isGenerating || previewSchedule || (results !== null && mobileViewPane === 'results')
              ? 'optimizer-mobile-pane-results'
              : 'optimizer-mobile-pane-config'
          }`}
        >
          
          {/* Left Panel: Configuration */}
          <div className="optimizer-config-panel" data-has-results={Boolean(results || isGenerating)}>
            {results && results.length > 0 && !isGenerating && (
              <button
                type="button"
                className="optimizer-mobile-back-results-btn"
                onClick={() => setMobileViewPane('results')}
              >
                Ver {Math.min(50, results.length)} Opciones Óptimas →
              </button>
            )}
            
            {/* Scrollable Configuration Area */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {/* Step 1: Select Courses */}
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>1. Selecciona Cursos</h4>
                  <span className="glass-pill" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                    {selectedCourseCodes.length} {isAdvancedMode ? 'en pool' : `/ ${courses.length}`}
                  </span>
                </div>

                <div 
                  onClick={() => setIsAdvancedMode(!isAdvancedMode)}
                  style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                    padding: '10px 12px', background: isAdvancedMode ? 'var(--accent-soft)' : 'var(--bg-elevated)', 
                    borderRadius: '0px', cursor: 'pointer', marginBottom: '16px',
                    border: isAdvancedMode ? '1px solid var(--accent-primary)' : '1px solid var(--border-hairline)',
                    transition: 'all 0.2s'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: isAdvancedMode ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                      Armador de Semestre (Modo Avanzado)
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>El algoritmo elegirá los cursos por ti</div>
                  </div>
                  <div style={{ 
                    width: '36px', height: '20px', background: isAdvancedMode ? 'var(--accent-primary)' : 'var(--border-hairline)',
                    borderRadius: '0px', position: 'relative', transition: 'all 0.3s'
                  }}>
                    <div style={{
                      position: 'absolute', top: '2px', left: isAdvancedMode ? '18px' : '2px',
                      width: '16px', height: '16px', background: 'white', borderRadius: '0px',
                      transition: 'all 0.3s'
                    }} />
                  </div>
                </div>

                {isAdvancedMode && (
                  <div style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: '0px', marginBottom: '16px', border: '1px solid var(--border-hairline)' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Cursos totales a llevar (incluyendo fijos): {maxCourses}
                    </label>
                    <input 
                      type="range" 
                      min="1" max="8" 
                      value={maxCourses} 
                      onChange={(e) => setMaxCourses(parseInt(e.target.value))}
                      style={{ width: '100%', marginBottom: '12px' }}
                    />
                    
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <GlassTimePicker 
                          label="Hora Inicio" 
                          value={minTime} 
                          onChange={setMinTime} 
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <GlassTimePicker 
                          label="Hora Fin" 
                          value={maxTime} 
                          onChange={setMaxTime} 
                        />
                      </div>
                    </div>
                    
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-hairline)' }}>
                      <div 
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', cursor: 'pointer' }}
                        onClick={() => setIsLunchEnabled(!isLunchEnabled)}
                      >
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                          Garantizar Hora de Almuerzo
                        </label>
                        <div style={{ 
                          width: '36px', height: '20px', background: isLunchEnabled ? 'var(--accent-primary)' : 'var(--border-hairline)',
                          borderRadius: '0px', position: 'relative', transition: 'all 0.3s', flexShrink: 0
                        }}>
                          <div style={{
                            position: 'absolute', top: '2px', left: isLunchEnabled ? '18px' : '2px',
                            width: '16px', height: '16px', background: 'white', borderRadius: '0px',
                            transition: 'all 0.3s'
                          }} />
                        </div>
                      </div>
                      
                      {isLunchEnabled && (
                        <>
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                            <div style={{ flex: 1 }}>
                              <GlassTimePicker 
                                label="Inicio Rango" 
                                value={lunchStart} 
                                onChange={setLunchStart} 
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <GlassTimePicker 
                                label="Fin Rango" 
                                value={lunchEnd} 
                                onChange={setLunchEnd} 
                              />
                            </div>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                              Duración mínima
                            </label>
                            <CustomSelect
                              size="sm"
                              value={lunchDuration}
                              onChange={(val) => setLunchDuration(Number(val))}
                              options={[
                                { value: 30, label: '30 minutos' },
                                { value: 45, label: '45 minutos' },
                                { value: 60, label: '1 hora' },
                                { value: 90, label: '1 hora y media' },
                                { value: 120, label: '2 horas' }
                              ]}
                              ariaLabel="Duración mínima de almuerzo"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Calendario de Bloqueos (Restricciones Temporales) Toggle Block */}
                <div style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: '0px', marginBottom: '16px', border: '1px solid var(--border-hairline)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: (showBlockerGrid || isAdvancedMode) ? '10px' : '0px' }}>
                    <div 
                      onClick={() => setShowBlockerGrid(!showBlockerGrid)}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}
                    >
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', margin: 0 }}>
                        Calendario de Bloqueos (Restricciones Temporales)
                      </label>
                    </div>
                    <div 
                      data-testid="toggle-blocker-grid"
                      onClick={() => setShowBlockerGrid(!showBlockerGrid)}
                      style={{ 
                        width: '36px', height: '20px', background: (showBlockerGrid || isAdvancedMode) ? 'var(--accent-primary)' : 'var(--border-hairline)',
                        borderRadius: '0px', position: 'relative', transition: 'all 0.3s', cursor: 'pointer', flexShrink: 0
                      }}>
                      <div style={{
                        position: 'absolute', top: '2px', left: (showBlockerGrid || isAdvancedMode) ? '18px' : '2px',
                        width: '16px', height: '16px', background: 'white', borderRadius: '0px',
                        transition: 'all 0.3s'
                      }} />
                    </div>
                  </div>

                  {(showBlockerGrid || isAdvancedMode) && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border-hairline)' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Modo Estricto:</span>
                        <div 
                          onClick={() => setIsConstraintStrict(!isConstraintStrict)}
                          style={{ 
                            width: '36px', height: '20px', background: isConstraintStrict ? 'var(--accent-primary)' : 'var(--border-hairline)',
                            borderRadius: '0px', position: 'relative', transition: 'all 0.3s', cursor: 'pointer', flexShrink: 0
                          }}>
                          <div style={{
                            position: 'absolute', top: '2px', left: isConstraintStrict ? '18px' : '2px',
                            width: '16px', height: '16px', background: 'white', borderRadius: '0px',
                            transition: 'all 0.3s'
                          }} />
                        </div>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '8px 0 0 0', lineHeight: 1.35 }}>
                        {isConstraintStrict ? 'Modo Estricto: Se descartan los cruces rojos.' : 'Modo Flexible: Se penalizan los cruces rojos.'} Configura los bloqueos en el gran panel derecho.
                      </p>
                    </>
                  )}
                </div>

                {/* Selected Courses Tags */}
                {selectedCourseCodes.length > 0 && !isAdvancedMode && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px', padding: '8px', background: 'var(--bg-elevated)', borderRadius: '0px', border: '1px solid var(--border-hairline)', maxHeight: '100px', overflowY: 'auto' }}>
                    {selectedCourseCodes.map(code => {
                      const courseColor = getCourseColor(code);
                      return (
                        <div 
                          key={code}
                          className="selected-course-pill"
                          style={{ 
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-hairline)',
                            borderLeft: `3px solid ${courseColor}`,
                            color: 'var(--text-primary)'
                          }}
                        >
                          {code}
                          <button 
                            className="selected-course-pill-close"
                            onClick={(e) => { e.stopPropagation(); toggleCourse(code); }}
                            style={{ color: 'var(--text-secondary)' }}
                            title="Quitar curso"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                <div className="search-bar" style={{ marginBottom: '12px' }}>
                  <Search size={14} color="var(--text-muted)" />
                  <input 
                    type="text" 
                    className="search-input" 
                    placeholder="Buscar curso..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {hasCourseTypeFilter && (
                  <div style={{ 
                    display: 'flex', 
                    background: 'var(--bg-elevated)', 
                    borderRadius: '0px', 
                    padding: '4px', 
                    marginBottom: '12px',
                    border: '1px solid var(--border-hairline)',
                    position: 'relative'
                  }}>
                    {['ALL', 'Obligatorio', 'Electivo'].map((type) => (
                      <div 
                        key={type}
                        onClick={() => setTypeFilter(type as any)}
                        style={{
                          flex: 1,
                          textAlign: 'center',
                          padding: '6px 0',
                          fontSize: '0.7rem',
                          fontWeight: typeFilter === type ? 700 : 500,
                          color: typeFilter === type ? '#FFFFFF' : 'var(--text-secondary)',
                          background: typeFilter === type ? 'var(--border-strong)' : 'transparent',
                          borderRadius: '0px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease-in-out',
                          border: '1px solid transparent'
                        }}
                      >
                        {type === 'ALL' ? 'Todos' : type}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ 
                  display: 'flex', 
                  background: 'var(--bg-elevated)', 
                  borderRadius: '0px', 
                  padding: '4px', 
                  marginBottom: '12px',
                  border: '1px solid var(--border-hairline)',
                }}>
                  <button 
                    style={{ flex: 1, padding: '6px', fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '0px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    onMouseOver={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    onClick={() => {
                      const visibleCodes = filteredCourses.map(c => c.code);
                      setSelectedCourseCodes(prev => Array.from(new Set([...prev, ...visibleCodes])));
                    }}
                  >
                    <CheckSquare size={12} /> Seleccionar
                  </button>
                  {hasEligibleFilter && (
                    <button 
                      style={{ flex: 1, padding: '6px', fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '0px', transition: 'all 0.2s', borderLeft: '1px solid var(--border-hairline)', borderRight: '1px solid var(--border-hairline)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      onMouseOver={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                      onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                      onClick={() => {
                        const eligibleCodes = courses.filter(c => c.isEligible).map(c => c.code);
                        setSelectedCourseCodes(eligibleCodes);
                      }}
                    >
                      <Filter size={12} /> Habilitados
                    </button>
                  )}
                  <button 
                    style={{ flex: 1, padding: '6px', fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '0px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    onMouseOver={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    onClick={() => {
                      const visibleCodes = new Set(filteredCourses.map(c => c.code));
                      setSelectedCourseCodes(prev => prev.filter(code => !visibleCodes.has(code)));
                    }}
                  >
                    <Square size={12} /> Limpiar
                  </button>
                </div>

                {hasEligibleFilter && (
                  <div 
                    onClick={() => setShowOnlyEligible(!showOnlyEligible)}
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer',
                      userSelect: 'none', marginBottom: '8px', padding: '4px 6px',
                      borderRadius: '0px', transition: 'all 0.2s ease',
                      background: showOnlyEligible ? '#DCEEE6' : 'transparent',
                      color: showOnlyEligible ? 'var(--status-ok)' : 'var(--text-muted)'
                    }}
                  >
                    {showOnlyEligible ? <CheckSquare size={14} color="var(--status-ok)" /> : <Square size={14} color="var(--text-muted)" />}
                    <span>Mostrar únicamente cursos habilitados en esta lista</span>
                  </div>
                )}


                <div className="course-list-scroll" style={{ maxHeight: '200px', paddingRight: '8px', border: '1px solid var(--border-hairline)', borderRadius: '0px', background: 'var(--bg-canvas)', padding: '8px', overflowY: 'auto' }}>
                  {filteredCourses.map(course => {
                    const isSelected = selectedCourseCodes.includes(course.code);
                    return (
                      <React.Fragment key={course.code}>
                        <div 
                          onClick={() => toggleCourse(course.code)}
                          className={`optimizer-course-item ${isSelected ? 'selected' : ''}`}
                        >
                          <div className="check-icon" style={{ display: 'flex', alignItems: 'center' }}>
                            {isSelected ? 
                              <CheckSquare size={18} color="var(--text-muted)" /> : 
                              <Square size={18} color="var(--text-muted)" />
                            }
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ 
                                fontWeight: 700, 
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: '0.82rem',
                                color: '#141416',
                                transition: 'color 0.2s ease'
                              }}>{course.code}</span>
                              {course.isEligible && (
                                <span className="habilitado-badge">
                                  HABILITADO
                                </span>
                              )}
                            </div>
                            <div style={{ 
                              fontSize: '0.75rem', 
                              color: isSelected ? '#141416' : 'var(--text-muted)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              transition: 'color 0.2s ease'
                            }}>
                              {course.name}
                            </div>
                          </div>
                          
                          {isAdvancedMode && isSelected && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); togglePin(course.code); }}
                              style={{
                                background: pinnedCourseCodes.includes(course.code) ? '#DCD9D2' : 'transparent',
                                border: pinnedCourseCodes.includes(course.code) ? '1px solid #18181A' : '1px solid transparent',
                                padding: '3px 5px',
                                cursor: 'pointer',
                                opacity: pinnedCourseCodes.includes(course.code) ? 1 : 0.45,
                                color: pinnedCourseCodes.includes(course.code) ? '#B85D00' : '#4A4946',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              title={pinnedCourseCodes.includes(course.code) ? "Desfijar curso" : "Fijar curso (el algoritmo intentará incluirlo)"}
                            >
                              <Pin size={13} />
                            </button>
                          )}
                        </div>
                        {isAdvancedMode && isSelected && pinnedCourseCodes.includes(course.code) && (
                          <div style={{ padding: '4px 8px 8px 32px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-hairline)' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Fijar sección específica (Opcional):</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '8px' }}>
                              {course.sections.map(sec => {
                                const secName = sec.sectionNumber;
                                const isPinned = pinnedSections[course.code] === secName;
                                const profs = sec.professors.length > 0 ? sec.professors.join(', ') : 'Sin profesor asignado';
                                const full = sec.enrolled >= sec.vacancies && sec.vacancies > 0;
                                
                                // Check if section is blocked
                                const isSectionBlocked = blockedSectionsForTime.some(bs => bs.courseCode === course.code && bs.sectionName === secName);

                                return (
                                  <div 
                                    key={secName}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleTogglePinSection(course.code, secName, isPinned);
                                    }}
                                    onMouseEnter={() => setHoveredSectionForPreview({ courseCode: course.code, sectionName: secName })}
                                    onMouseLeave={() => setHoveredSectionForPreview(null)}
                                    style={{
                                      padding: '8px 12px',
                                      borderRadius: '0px',
                                      cursor: 'pointer',
                                      border: isPinned ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-hairline)',
                                      background: isPinned ? '#E0EBF5' : 'var(--bg-surface)',
                                      color: 'var(--text-primary)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '4px',
                                      transition: 'all 0.2s',
                                      position: 'relative',
                                      overflow: 'hidden'
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.8rem' }}>
                                        {isPinned ? <Lock size={12} color="var(--accent-primary)" /> : <Unlock size={12} color="var(--text-muted)" />}
                                        Sección {secName}
                                      </div>
                                      <div style={{ 
                                        fontSize: '0.7rem', 
                                        padding: '2px 6px', 
                                        borderRadius: '0px', 
                                        background: full ? '#F4E0E2' : '#DCEEE6',
                                        color: full ? '#520D17' : '#093B29',
                                        fontWeight: 600
                                      }}>
                                        {sec.enrolled} / {sec.vacancies}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      <User size={11} style={{ flexShrink: 0 }} />
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{profs}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <div style={{ display: 'flex', gap: '4px' }}>
                                        {Array.from(new Set(sec.sessions.map(s => s.sessionType))).map((type, i) => (
                                          <span key={i} style={{ fontSize: '0.65rem', background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: '0px', color: 'var(--text-secondary)', border: '1px solid var(--border-hairline)' }}>
                                            {type}
                                          </span>
                                        ))}
                                      </div>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleBlockSection(course.code, secName);
                                        }}
                                        style={{ 
                                          background: isSectionBlocked ? '#DCEEE6' : '#F4E0E2', 
                                          border: isSectionBlocked ? '1px solid #0D7A4E' : '1px solid #A82032', 
                                          borderRadius: '0px', color: isSectionBlocked ? '#093B29' : '#520D17', fontSize: '0.65rem', padding: '3px 8px', 
                                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", transition: 'all 0.2s' 
                                        }}
                                        title={isSectionBlocked ? "Desbloquear el horario de esta sección en el calendario" : "Bloquear el horario de esta sección en el calendario"}
                                      >
                                        {isSectionBlocked ? '✓ Desbloquear' : '✕ Bloquear'}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                })}
                </div>
              </div>

              {/* Step 2: Optimization Preferences */}
              <div style={{ padding: '0 20px 20px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Filter size={16} color="var(--text-muted)" />
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>2. Preferencias</h4>
                </div>

                {/* Targets */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Objetivos de Optimización (Selección Múltiple):</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {[
                      { id: 'min_gaps', label: 'Menos huecos' },
                      { id: 'min_days', label: 'Menos días' },
                      { id: 'min_day_gaps', label: 'Sin días puente (huecos)' },
                      { id: 'morning', label: 'Mañanas' },
                      { id: 'afternoon', label: 'Tardes/Noches' }
                    ].map(target => {
                      const isActive = options.targets.includes(target.id as any);
                      return (
                        <div
                          key={target.id}
                          className={`pref-pill ${isActive ? 'active' : ''}`}
                          onClick={() => {
                            setOptions(prev => {
                              let newTargets = isActive
                                ? prev.targets.filter(t => t !== target.id)
                                : [...prev.targets, target.id as any];
                              
                              // Mutually exclusive constraints
                              if (!isActive) {
                                if (target.id === 'morning') {
                                  newTargets = newTargets.filter(t => t !== 'afternoon');
                                } else if (target.id === 'afternoon') {
                                  newTargets = newTargets.filter(t => t !== 'morning');
                                }
                              }
                              
                              return { ...prev, targets: newTargets };
                            });
                          }}
                        >
                          <span
                            className={`pref-pill-led ${isActive ? 'is-on' : 'is-off'}`}
                            aria-hidden="true"
                          />
                          <span>{target.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Filtros y Restricciones:</label>
                  <div 
                    onClick={() => setOptions({ ...options, onlyWithVacancies: !options.onlyWithVacancies })}
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer',
                      background: options.onlyWithVacancies ? 'var(--accent-soft)' : 'transparent',
                      border: options.onlyWithVacancies ? '1px solid var(--accent-primary)' : '1px solid transparent',
                      padding: '6px 10px', borderRadius: '0px', transition: 'all 0.2s ease',
                      marginLeft: '-10px', // slightly offset to align text with other labels
                      userSelect: 'none' // Prevent text selection on double click
                    }}
                  >
                    {options.onlyWithVacancies ? <CheckSquare size={16} color="var(--accent-primary)" /> : <Square size={16} color="var(--text-muted)" />}
                    <span style={{ color: options.onlyWithVacancies ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      Solo secciones con vacantes disponibles
                    </span>
                  </div>
                  
                  <div style={{ marginTop: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Días que deseas libres:</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {(['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'] as DayOfWeek[]).map(day => (
                        <button
                          key={day}
                          onClick={() => toggleExcludedDay(day)}
                          className={`filter-pill-btn ${(options.excludedDays || []).includes(day) ? 'active' : ''}`}
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.75rem',
                            borderRadius: '0px',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 700,
                            background: (options.excludedDays || []).includes(day) ? '#18181A' : '#FAF9F5',
                            color: (options.excludedDays || []).includes(day) ? '#F2F0EC' : '#4A4946',
                            border: (options.excludedDays || []).includes(day) ? '1px solid #18181A' : '1px solid #C6C3BB',
                            borderLeft: (options.excludedDays || []).includes(day) ? '3px solid #A82032' : '1px solid #C6C3BB',
                          }}
                        >
                          {(options.excludedDays || []).includes(day) ? `✕ Sin ${day}` : day}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 20px', borderTop: '1.5px solid #18181A', marginTop: 'auto', flexShrink: 0, background: '#EAE7E1' }}>
              {!isGenerating ? (
                <button 
                  className="optimizer-generate-btn" 
                  onClick={handleGenerate}
                  disabled={selectedCourseCodes.length === 0}
                >
                  Generar Horarios
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button 
                    className="optimizer-cancel-btn" 
                    onClick={cancelGeneration}
                  >
                    Detener Búsqueda
                  </button>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#4A4946', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>
                    Solver activo · Ejecución en paralelo Web Worker.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Results */}
          <div className="optimizer-right-panel" data-has-results={Boolean(results || isGenerating)}>
            {/* PREVIEW VIEW */}
            {previewSchedule && (
              <div style={{ position: 'absolute', inset: 0, padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#FAF9F5', zIndex: 25, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', borderBottom: '1.5px solid #18181A', paddingBottom: '10px' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'Space Grotesk', sans-serif", color: '#141416' }}>
                    <Eye size={18} color="#00779E" /> Vista Previa del Horario
                  </h4>
                  <button 
                    type="button"
                    className="optimizer-back-config-btn"
                    onClick={() => setPreviewSchedule(null)}
                  >
                    ← Volver a resultados
                  </button>
                </div>
                <div style={{ flex: 1, minHeight: 0, background: '#FAF9F5', borderRadius: '0px', border: '1.5px solid #18181A', overflow: 'auto' }}>
                  <TimetableGrid 
                    courses={courses}
                    selectedSections={previewSchedule}
                    conflicts={[]}
                    draggedSection={null}
                    onSelectSection={() => {}}
                    onRemoveSection={() => {}}
                    compressView={true}
                    readOnly={true}
                  />
                </div>
              </div>
            )}

            {/* RESULTS VIEW */}
            <div
              className="optimizer-results-pane"
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                visibility: previewSchedule ? 'hidden' : 'visible',
                opacity: previewSchedule ? 0 : 1
              }}
            >
              {!results && !isGenerating && (
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px' }}>
                  {(isAdvancedMode || showBlockerGrid) ? (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#141416' }}>Calendario de Bloqueos</h4>
                          <p style={{ fontSize: '0.82rem', color: '#5A5852', margin: '4px 0 0 0' }}>
                            Haz clic y arrastra para bloquear horarios que deseas evitar.
                          </p>
                        </div>
                        {isConstraintStrict && (
                          <span className="glass-pill" style={{ background: '#F4E0E2', color: '#A82032', borderColor: '#A82032', borderRadius: '0px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                            MODO ESTRICTO ACTIVO
                          </span>
                        )}
                      </div>
                      <div style={{ flex: 1, minHeight: 0 }}>
                        <TimeBlockerGrid 
                          blockedMask={blockedTimeMask}
                          onChange={handleBlockedMaskChange}
                          hoveredMask={computedHoveredMask}
                          courseBlocks={courseBlocksForGrid}
                          pinnedBlocks={pinnedBlocksForGrid}
                          pinnedMask={pinnedTimeMask}
                          courseViabilityMasks={courseViabilityMasks}
                        />
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#5A5852', textAlign: 'center', padding: '16px' }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        backgroundColor: '#DCD9D2',
                        border: '1.5px solid #18181A',
                        borderRadius: '0px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '16px',
                        color: '#141416'
                      }}>
                        <Calendar size={24} />
                      </div>
                      <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#141416', fontFamily: 'var(--font-heading, Space Grotesk)', marginBottom: '6px' }}>Listo para Optimizar</p>
                      <p style={{ fontSize: '0.88rem', maxWidth: '320px', lineHeight: 1.5, color: '#5A5852' }}>Selecciona tus cursos y preferencias en el panel izquierdo y presiona &quot;Generar Horarios&quot;.</p>
                    </div>
                  )}
                </div>
              )}

              {isGenerating && (
                <div style={{ flex: 1, minHeight: 0, padding: '14px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <QuantumEngineVisualizer
                    evalProgress={{
                      evaluated: workerProgress?.evaluated ?? 0,
                      validFound: workerProgress?.validFound ?? 0,
                      elapsedMs: generationStartTimeRef.current
                        ? performance.now() - generationStartTimeRef.current
                        : 0,
                      isComplete: evalPhase === 'complete',
                      phase: evalPhase,
                      totalCombinations: totalCombinationsRef.current || workerProgress?.total || undefined
                    }}
                    selectedCourseCodes={selectedCourseCodes}
                    pinnedCourses={pinnedCourseCodes}
                  />
                </div>
              )}

              {results && results.length === 0 && (
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', color: '#4A4946', textAlign: 'center' }}>
                  <div style={{ width: '44px', height: '44px', border: '1.5px solid #A82032', background: '#F4E0E2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px', color: '#A82032' }}>
                    <X size={24} />
                  </div>
                  <p style={{ fontSize: '1.05rem', fontWeight: 700, color: '#A82032', margin: '0 0 6px 0' }}>No se encontraron combinaciones</p>
                  <p style={{ fontSize: '0.86rem', maxWidth: '400px', lineHeight: 1.5, marginBottom: '20px', color: '#5A5852' }}>
                    Es probable que haya cruces de horario inevitables entre los cursos seleccionados, o las restricciones (días libres/vacantes) son muy estrictas.
                  </p>
                  <button 
                    className="optimizer-back-config-btn" 
                    onClick={() => {
                      setMobileViewPane('config');
                      if (typeof window === 'undefined' || window.innerWidth >= 1024) {
                        setResults(null);
                      }
                    }}
                  >
                    ← Volver a Configurar ({selectedCourseCodes.length})
                  </button>
                </div>
              )}

              {results && results.length > 0 && (
                <>
                  {/* Sticky Top Navigation Bar */}
                  <div className="results-view-header">
                    <button
                      type="button"
                      className="optimizer-back-config-btn"
                      onClick={() => {
                        setMobileViewPane('config');
                        if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
                          setResults(null);
                        }
                      }}
                    >
                      ← Configurar Cursos y Filtros ({selectedCourseCodes.length})
                    </button>
                    <span className="optimizer-optimal-count-badge">
                      {Math.min(50, results.length)} OPCIONES ÓPTIMAS
                    </span>
                  </div>

                  {/* Scrollable 50 Result Cards Container */}
                  <div className="optimizer-results-scroll overflow-y-auto">
                    {results.slice(0, 50).map((res, index) => {
                      const rankLabel =
                        index === 0
                          ? '#01 · ÓPTIMO'
                          : index <= 2
                          ? `#0${index + 1} · TOP`
                          : `#${String(index + 1).padStart(2, '0')}`;
                      const cardTierClass =
                        index === 0 ? 'is-rank-first' : index <= 2 ? 'is-rank-top' : 'is-rank-std';
                      const zoneAClass =
                        index === 0
                          ? 'grafton-result-zone-a--rank1'
                          : index <= 2
                          ? 'grafton-result-zone-a--top'
                          : 'grafton-result-zone-a--std';
                      const rankClass =
                        index === 0
                          ? 'rank-optimo grafton-rank-badge--optimo'
                          : index <= 2
                          ? 'rank-top grafton-rank-badge--top'
                          : 'rank-std grafton-rank-badge--std';
                      const gapsTierClass =
                        (res.metrics.gapHours ?? 0) <= 2
                          ? 'grafton-telemetry-pill--gaps-low'
                          : 'grafton-telemetry-pill--gaps-high';

                      return (
                        <div
                          key={res.id}
                          className={`optimizer-swiss-card ${cardTierClass}`}
                        >
                          {/* ZONE A: Top Header & Telemetry Row */}
                          <div className={`optimizer-card-zone-a ${zoneAClass}`}>
                            <div className="optimizer-zone-a-left">
                              <span className={`swiss-rank-badge ${rankClass}`}>{rankLabel}</span>
                              <span className="swiss-option-title">Opción {index + 1}</span>
                            </div>
                            <div className="optimizer-zone-a-right">
                              <span className="swiss-telemetry-pill pill-score grafton-telemetry-pill--score">
                                SCORE: {Math.round(res.score || 0)} PTS
                              </span>
                              <span className={`swiss-telemetry-pill pill-gaps ${gapsTierClass}`}>
                                {res.metrics.gapHours}H HUECOS
                              </span>
                              <span className="swiss-telemetry-pill pill-days grafton-telemetry-pill--days">
                                {res.metrics.activeDaysCount} DÍAS
                              </span>
                              {savedOptionsRecord[res.id] && savedOptionsRecord[res.id].length > 0 && (
                                <span className="swiss-telemetry-pill pill-saved">
                                  TAB: {savedOptionsRecord[res.id].join(', ')}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* ZONE B: Middle Course & Section Bicolor Chips Grid */}
                          <div className="optimizer-card-zone-b">
                            {Object.entries(res.selectedSections).map(([courseCode, secNum]) => {
                              const { mainText, labSuffix } = formatCompactSectionLabel(secNum);
                              const palette = getCourseDepartmentPalette(courseCode);

                              return (
                                <div
                                  key={courseCode}
                                  className="swiss-course-chip result-course-chip"
                                  data-course-code={courseCode}
                                >
                                  <span
                                    className="swiss-chip-code result-course-chip__code"
                                    style={{
                                      backgroundColor: palette.codeBg,
                                      color: palette.codeText,
                                      borderRightColor: '#18181A',
                                    }}
                                  >
                                    {courseCode}
                                  </span>
                                  <span
                                    className="swiss-chip-sec result-course-chip__sec"
                                    style={{
                                      backgroundColor: palette.secBg,
                                      color: palette.secText,
                                    }}
                                  >
                                    {mainText}
                                    {labSuffix && (
                                      <span className="result-course-chip__lab"> {labSuffix}</span>
                                    )}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          {/* ZONE C: Bottom Dedicated Action Bar */}
                          <div className="optimizer-card-zone-c">
                            <button
                              type="button"
                              className="swiss-action-btn btn-preview"
                              onClick={() => setPreviewSchedule(res.selectedSections)}
                            >
                              <Eye size={12} />
                              <span>Vista Previa</span>
                            </button>
                            <button
                              type="button"
                              className={`swiss-action-btn btn-new-tab ${
                                activeSaveId === res.id ? 'is-saved' : ''
                              }`}
                              onClick={() => {
                                const newName = onCreateNewOption(res.selectedSections);
                                setSavedOptionsRecord(prev => ({
                                  ...prev,
                                  [res.id]: [...(prev[res.id] || []), newName]
                                }));
                                setActiveSaveId(res.id);
                                setLastSavedName(newName);
                                setTimeout(() => {
                                  setActiveSaveId(null);
                                  setLastSavedName(null);
                                }, 2500);
                              }}
                            >
                              {activeSaveId === res.id ? (
                                <span>✓ {lastSavedName}</span>
                              ) : (
                                <>
                                  <span className="sm-only-text">+ Pestaña</span>
                                  <span className="lg-only-text">+ Nueva Pestaña</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              className="swiss-action-btn btn-apply"
                              onClick={() => {
                                onApplyToCurrent(res.selectedSections);
                                onClose();
                              }}
                            >
                              ✓ Aplicar
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {results.length > 50 && (
                      <div className="optimizer-more-footer">
                        + {results.length - 50} COMBINACIONES ADICIONALES EVALUADAS (TOP 50 EN PANTALLA)
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        </ErrorBoundary>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
