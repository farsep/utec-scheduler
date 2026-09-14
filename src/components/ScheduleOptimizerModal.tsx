import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Sparkles, CheckSquare, Square, Filter, ChevronRight, CheckCircle2, Clock, Calendar, Check, Search, Coffee } from 'lucide-react';
import type { Course, OptimizerOptions, GeneratedScheduleResult, DayOfWeek } from '../types/schedule';
import { generateOptimalSchedules } from '../utils/scheduleOptimizer';
import { formatLocation, getCourseColor, getCoursePrefix, minutesToTime, normalizeString, getCombinations, sessionToBitmask } from '../utils/scheduleUtils';
import { TimetableGrid } from './TimetableGrid';
import { GlassTimePicker } from './GlassTimePicker';
import { Eye } from 'lucide-react';

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
  const workerRefs = useRef<Worker[]>([]);
  
  const cancelGeneration = () => {
    workerRefs.current.forEach(w => w.terminate());
    workerRefs.current = [];
    setIsGenerating(false);
    setWorkerProgress(null);
  };

  const prevIsOpen = useRef(false);

  // Focus trap ref
  const modalRef = useRef<HTMLDivElement>(null);

  // When modal closes, reset preview and selection
  useEffect(() => {
    if (isOpen) {
      prevIsOpen.current = true;
      setPreviewSchedule(null);
      // Try to maintain user selection if possible, otherwise reset to all
      if (initialSelectedCourseCodes.length > 0) {
        setSelectedCourseCodes(initialSelectedCourseCodes);
      }
    } else if (prevIsOpen.current) {
      prevIsOpen.current = false;
    }
  }, [isOpen, initialSelectedCourseCodes]);

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

  const handleGenerate = () => {
    setIsGenerating(true);
    setPreviewSchedule(null);
    setSavedOptionsRecord({});
    setWorkerProgress(null);
    setResults(null);
    
    workerRefs.current.forEach(w => w.terminate());
    workerRefs.current = [];

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

          const depth = Math.min(2, neededFromPool);
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
        totalCombinations = 1;
        neededFromPool = selectedCourseCodes.length;
      }

      const numWorkers = navigator.hardwareConcurrency || 4;
      
      if (chunkTasks.length === 0) {
        setResults([]);
        setIsGenerating(false);
        return;
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

      for (let i = 0; i < numWorkers; i++) {
        const worker = new Worker(new URL('../utils/scheduleWorker.ts', import.meta.url), { type: 'module' });
        workerRefs.current.push(worker);

        worker.onmessage = (e: MessageEvent) => {
          const msg = e.data;
          if (msg.type === 'READY') {
            if (tasksQueue.length > 0) {
              const nextTask = tasksQueue.shift()!;
              worker.postMessage({ type: 'TASK', task: nextTask });
            } else {
              worker.postMessage({ type: 'FINISH' });
            }
          } else if (msg.type === 'PROGRESS') {
            workersProgress[i] = { evaluated: msg.evaluated, total: msg.total, validFound: msg.validFound };
            updateGlobalProgress();
          } else if (msg.type === 'COMPLETE') {
            allResults[i] = msg.results;
            completedWorkers++;
            worker.terminate();

            if (completedWorkers === numWorkers && !hasError) {
              // Merge all results
              const mergedResults = allResults.flat();
              // Sort by score descending and take top 200
              mergedResults.sort((a, b) => (b.score || 0) - (a.score || 0));
              setResults(mergedResults.slice(0, 200));
              setIsGenerating(false);
              workerRefs.current = [];
            }
          } else if (msg.type === 'ERROR') {
            if (!hasError) {
              hasError = true;
              alert(msg.message);
              setIsGenerating(false);
              workerRefs.current.forEach(w => w.terminate());
              workerRefs.current = [];
            }
          }
        };

        worker.postMessage({
          type: 'INIT',
          courses,
          poolBase,
          pinned,
          neededFromPool,
          options: currentOptions
        });
      }
    }, 100);
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

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '1000px', width: '95%', maxHeight: '90vh', padding: '0', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'var(--accent-gradient)', padding: '8px', borderRadius: '10px', display: 'flex' }}>
              <Sparkles size={20} color="white" />
            </div>
            <div>
              <h3 className="modal-title" style={{ fontSize: '1.2rem', marginBottom: '2px' }}>Generador Automático de Horarios</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Encuentra las mejores combinaciones sin cruces y con menor cantidad de huecos.</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Content Body - Split View */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          
          {/* Left Panel: Configuration */}
          <div style={{ width: '340px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.1)', userSelect: 'none' }}>
            
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
                    padding: '10px 12px', background: isAdvancedMode ? 'rgba(59, 130, 246, 0.15)' : 'rgba(0,0,0,0.2)', 
                    borderRadius: '8px', cursor: 'pointer', marginBottom: '16px',
                    border: isAdvancedMode ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--border-color)',
                    transition: 'all 0.2s'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: isAdvancedMode ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                      Armador de Semestre (Modo Avanzado)
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>El algoritmo elegirá los cursos por ti</div>
                  </div>
                  <div style={{ 
                    width: '36px', height: '20px', background: isAdvancedMode ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)',
                    borderRadius: '10px', position: 'relative', transition: 'all 0.3s'
                  }}>
                    <div style={{
                      position: 'absolute', top: '2px', left: isAdvancedMode ? '18px' : '2px',
                      width: '16px', height: '16px', background: 'white', borderRadius: '50%',
                      transition: 'all 0.3s'
                    }} />
                  </div>
                </div>

                {isAdvancedMode && (
                  <div style={{ padding: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border-color)' }}>
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
                    
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <div 
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', cursor: 'pointer' }}
                        onClick={() => setIsLunchEnabled(!isLunchEnabled)}
                      >
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                          Garantizar Hora de Almuerzo
                        </label>
                        <div style={{ 
                          width: '36px', height: '20px', background: isLunchEnabled ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)',
                          borderRadius: '10px', position: 'relative', transition: 'all 0.3s'
                        }}>
                          <div style={{
                            position: 'absolute', top: '2px', left: isLunchEnabled ? '18px' : '2px',
                            width: '16px', height: '16px', background: 'white', borderRadius: '50%',
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
                            <select 
                              className="search-input"
                              style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', WebkitAppearance: 'none', appearance: 'none', background: 'rgba(0,0,0,0.2)' }}
                              value={lunchDuration}
                              onChange={(e) => setLunchDuration(Number(e.target.value))}
                            >
                              <option value={30}>30 minutos</option>
                              <option value={45}>45 minutos</option>
                              <option value={60}>1 hora</option>
                              <option value={90}>1 hora y media</option>
                              <option value={120}>2 horas</option>
                            </select>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Selected Courses Tags */}
                {selectedCourseCodes.length > 0 && !isAdvancedMode && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px', padding: '8px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid var(--border-color)', maxHeight: '100px', overflowY: 'auto' }}>
                    {selectedCourseCodes.map(code => {
                      const courseColor = getCourseColor(code);
                      return (
                        <div 
                          key={code}
                          className="selected-course-pill"
                          style={{ 
                            background: `rgba(${parseInt(courseColor.slice(1,3),16)}, ${parseInt(courseColor.slice(3,5),16)}, ${parseInt(courseColor.slice(5,7),16)}, 0.15)`,
                            border: `1px solid ${courseColor}40`,
                            color: courseColor
                          }}
                        >
                          {code}
                          <button 
                            className="selected-course-pill-close"
                            onClick={(e) => { e.stopPropagation(); toggleCourse(code); }}
                            style={{ color: courseColor }}
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
                    background: 'rgba(0,0,0,0.25)', 
                    borderRadius: '8px', 
                    padding: '4px', 
                    marginBottom: '12px',
                    border: '1px solid var(--border-color)',
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
                          fontWeight: typeFilter === type ? 600 : 400,
                          color: typeFilter === type ? '#fff' : 'var(--text-muted)',
                          background: typeFilter === type ? 'rgba(255,255,255,0.1)' : 'transparent',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease-in-out',
                          boxShadow: typeFilter === type ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
                          border: typeFilter === type ? '1px solid rgba(255,255,255,0.05)' : '1px solid transparent'
                        }}
                      >
                        {type === 'ALL' ? 'Todos' : type}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ 
                  display: 'flex', 
                  background: 'rgba(0,0,0,0.15)', 
                  borderRadius: '8px', 
                  padding: '4px', 
                  marginBottom: '12px',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}>
                  <button 
                    style={{ flex: 1, padding: '6px', fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '4px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
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
                      style={{ flex: 1, padding: '6px', fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '4px', transition: 'all 0.2s', borderLeft: '1px solid rgba(255,255,255,0.05)', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
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
                    style={{ flex: 1, padding: '6px', fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '4px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
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
                      borderRadius: '6px', transition: 'all 0.2s ease',
                      background: showOnlyEligible ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                      color: showOnlyEligible ? '#34d399' : 'var(--text-muted)'
                    }}
                  >
                    {showOnlyEligible ? <CheckSquare size={14} color="#34d399" /> : <Square size={14} color="var(--text-muted)" />}
                    <span>Mostrar únicamente cursos habilitados en esta lista</span>
                  </div>
                )}


                <div className="course-list-scroll" style={{ maxHeight: '200px', paddingRight: '8px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', padding: '8px', overflowY: 'auto' }}>
                  {filteredCourses.map(course => {
                    const isSelected = selectedCourseCodes.includes(course.code);
                    return (
                    <div 
                      key={course.code} 
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
                            fontWeight: 600, 
                            fontSize: '0.85rem',
                            color: isSelected ? course.color : 'var(--accent-blue)',
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
                          color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
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
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            opacity: pinnedCourseCodes.includes(course.code) ? 1 : 0.3,
                            filter: pinnedCourseCodes.includes(course.code) ? 'none' : 'grayscale(100%)',
                            fontSize: '1rem', display: 'flex', alignItems: 'center'
                          }}
                          title={pinnedCourseCodes.includes(course.code) ? "Desfijar curso" : "Fijar curso (el algoritmo intentará incluirlo)"}
                        >
                          📌
                        </button>
                      )}
                    </div>
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
                      { id: 'min_gaps', label: '⚡ Menos huecos' },
                      { id: 'min_days', label: '📅 Menos días' },
                      { id: 'min_day_gaps', label: '🚫 Sin días puente (huecos)' },
                      { id: 'morning', label: '🌅 Mañanas' },
                      { id: 'afternoon', label: '🌇 Tardes/Noches' }
                    ].map(target => {
                      const isActive = options.targets.includes(target.id as any);
                      return (
                        <div
                          key={target.id}
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
                          style={{
                            display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer',
                            userSelect: 'none', padding: '6px 12px', borderRadius: '8px',
                            background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.03)',
                            border: isActive ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
                            color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {isActive ? <CheckSquare size={14} color="var(--accent-primary)" /> : <Square size={14} color="var(--text-muted)" />}
                          {target.label}
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
                      background: options.onlyWithVacancies ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                      border: options.onlyWithVacancies ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
                      padding: '6px 10px', borderRadius: '8px', transition: 'all 0.2s ease',
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
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        >
                          {(options.excludedDays || []).includes(day) ? `🚫 Sin ${day}` : day}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', marginTop: 'auto', flexShrink: 0, background: 'rgba(0,0,0,0.2)' }}>
              {!isGenerating ? (
                <button 
                  className="btn btn-primary" 
                  style={{ 
                    width: '100%', padding: '12px', fontSize: '0.95rem', 
                    background: (selectedCourseCodes.length === 0) ? 'var(--surface-light)' : 'var(--accent-gradient)', 
                    border: 'none',
                    opacity: (selectedCourseCodes.length === 0) ? 0.5 : 1,
                    cursor: (selectedCourseCodes.length === 0) ? 'not-allowed' : 'pointer',
                    pointerEvents: (selectedCourseCodes.length === 0) ? 'none' : 'auto'
                  }}
                  onClick={handleGenerate}
                  disabled={selectedCourseCodes.length === 0}
                >
                  Generar Horarios
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button 
                    className="btn btn-secondary" 
                    style={{ 
                      width: '100%', padding: '12px', fontSize: '0.95rem', 
                      borderColor: 'var(--accent-rose)', color: 'var(--accent-rose)' 
                    }}
                    onClick={cancelGeneration}
                  >
                    Detener Búsqueda
                  </button>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Si cierras esta ventana, la búsqueda continuará en segundo plano.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Results */}
          <div style={{ flex: 1, background: '#0a0d14', position: 'relative', overflow: 'hidden' }}>
            {/* PREVIEW VIEW */}
            {previewSchedule && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#0a0d14', zIndex: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h4 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Eye size={20} color="var(--accent-primary)" /> Vista Previa del Horario
                  </h4>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => setPreviewSchedule(null)}
                    style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                  >
                    ← Volver a resultados
                  </button>
                </div>
                <div style={{ flex: 1, minHeight: '500px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                  <TimetableGrid 
                    courses={courses}
                    selectedSections={previewSchedule}
                    conflicts={[]}
                    draggedSection={null}
                    onSelectSection={() => {}}
                    onRemoveSection={() => {}}
                    compressView={true}
                  />
                </div>
              </div>
            )}

            {/* RESULTS VIEW */}
            <div style={{ 
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
              padding: '24px', overflowY: 'auto', 
              visibility: previewSchedule ? 'hidden' : 'visible',
              opacity: previewSchedule ? 0 : 1
            }}>
                {!results && !isGenerating && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center' }}>
                    <Sparkles size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                    <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Listo para Optimizar</p>
                    <p style={{ fontSize: '0.9rem', maxWidth: '300px', lineHeight: 1.5 }}>Selecciona tus cursos y preferencias en el panel izquierdo y presiona "Generar Horarios".</p>
                  </div>
                )}

            {isGenerating && (
              <div className="skeleton-grid-container">
                {/* HUD Overlay */}
                <div className="hud-overlay">
                  <h4 className="hud-title">Evaluando Horarios...</h4>
                  {workerProgress ? (
                    <>
                      <div className="hud-stats">
                        {workerProgress.evaluated.toLocaleString()} / {workerProgress.total.toLocaleString()} combinaciones
                        <br/>
                        <span style={{ color: '#10b981' }}>{workerProgress.validFound.toLocaleString()} viables</span>
                      </div>
                      <div className="hud-progress-bar">
                        <div 
                          className="hud-progress-fill" 
                          style={{ width: `${Math.min(100, (workerProgress.evaluated / Math.max(1, workerProgress.total)) * 100)}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="hud-stats">Iniciando Motor Cuántico...</div>
                  )}
                </div>

                {/* Tetris Blocks */}
                {Array.from({ length: 15 }).map((_, i) => (
                  <div 
                    key={i} 
                    className="tetris-block"
                    style={{
                      left: `calc(16px + ${(i % 7)} * (((100% - 80px) / 7) + 8px))`,
                      top: `${Math.random() * 80}%`,
                      height: `${40 + Math.random() * 80}px`,
                      animationDelay: `${Math.random() * 2}s`,
                      animationDuration: `${1.5 + Math.random() * 2}s`,
                      backgroundColor: `rgba(255, 255, 255, ${0.02 + Math.random() * 0.04})`,
                      borderColor: `rgba(255, 255, 255, ${0.08 + Math.random() * 0.1})`
                    }}
                  />
                ))}

                {/* Grid Skeleton */}
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={`row-${i}`} className="skeleton-row">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <div key={`cell-${i}-${j}`} className="skeleton-cell" />
                    ))}
                  </div>
                ))}
              </div>
            )}

            {results && results.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center' }}>
                <X size={48} style={{ color: 'var(--accent-rose)', opacity: 0.5, marginBottom: '16px' }} />
                <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--accent-rose)' }}>No se encontraron combinaciones</p>
                <p style={{ fontSize: '0.9rem', maxWidth: '400px', lineHeight: 1.5 }}>
                  Es probable que haya cruces de horario inevitables entre los cursos seleccionados, o las restricciones (días libres/vacantes) son muy estrictas.
                </p>
              </div>
            )}

            {results && results.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Resultados <span className="glass-pill" style={{ color: 'var(--accent-primary)', borderColor: 'rgba(59, 130, 246, 0.4)' }}>{results.length} opciones</span>
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Mostrando los mejores resultados ordenados</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {results.slice(0, 50).map((res, index) => (
                    <div key={res.id} className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                            <h5 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>
                              Opción {index + 1} {index === 0 && '🏆'}
                            </h5>
                            {res.metrics.totalGapMinutes === 0 && (
                              <span className="glass-pill" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)', fontSize: '0.7rem' }}>
                                ✨ 0h Huecos
                              </span>
                            )}
                            {res.score !== undefined && options.targets.length > 0 && (
                              <span className="glass-pill" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-primary)', borderColor: 'rgba(59, 130, 246, 0.4)', fontSize: '0.7rem' }}>
                                🎯 Score: {Math.round(res.score || 0)} pts
                              </span>
                            )}
                            {savedOptionsRecord[res.id] && savedOptionsRecord[res.id].length > 0 && (
                              <span className="glass-pill" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)', fontSize: '0.7rem' }}>
                                📌 Guardado en {savedOptionsRecord[res.id].join(', ')}
                              </span>
                            )}
                          </div>
                          
                          <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={13} color="var(--text-muted)" /> {res.metrics.gapHours}h huecos totales
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Calendar size={13} color="var(--text-muted)" /> {res.metrics.activeDaysCount} días de clase
                            </span>
                            {res.metrics.lunchScore !== undefined && res.metrics.lunchScore > 0 && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Coffee size={13} color="var(--text-muted)" /> {Math.round(res.metrics.lunchScore * 100)}% almuerzo
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                            onClick={() => setPreviewSchedule(res.selectedSections)}
                          >
                            <Eye size={14} /> Preview
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ 
                              padding: '6px 12px', 
                              fontSize: '0.8rem',
                              background: activeSaveId === res.id ? 'rgba(16, 185, 129, 0.15)' : undefined,
                              color: activeSaveId === res.id ? '#10b981' : undefined,
                              borderColor: activeSaveId === res.id ? '#10b981' : undefined
                            }}
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
                            {activeSaveId === res.id ? `✅ Guardado en ${lastSavedName}` : 'Crear Nueva Pestaña'}
                          </button>
                          <button 
                            className="btn btn-primary" 
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            onClick={() => {
                              onApplyToCurrent(res.selectedSections);
                              onClose();
                            }}
                          >
                            Aplicar
                          </button>
                        </div>
                      </div>

                      {/* Sections breakdown */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                        {Object.entries(res.selectedSections).map(([courseCode, secNum]) => {
                          const course = courses.find(c => c.code === courseCode);
                          const color = getCourseColor(courseCode);
                          return (
                            <div key={courseCode} style={{ 
                              display: 'flex', alignItems: 'center', gap: '6px', 
                              background: 'rgba(255,255,255,0.03)', padding: '4px 8px', 
                              borderRadius: '6px', border: `1px solid ${color}44`,
                              fontSize: '0.75rem'
                            }}>
                              <span style={{ color, fontWeight: 700 }}>{courseCode}</span>
                              <span style={{ color: 'var(--text-muted)' }}>Sec {secNum}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  
                  {results.length > 50 && (
                    <div style={{ textAlign: 'center', padding: '10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      + {results.length - 50} opciones adicionales (mostrando las 50 mejores)
                    </div>
                  )}
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
