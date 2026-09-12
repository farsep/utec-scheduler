import React, { useState, useMemo, useEffect } from 'react';
import { X, Sparkles, CheckSquare, Square, Filter, ChevronRight, CheckCircle2, Clock, Calendar, Check, Search } from 'lucide-react';
import type { Course, OptimizerOptions, GeneratedScheduleResult, DayOfWeek } from '../types/schedule';
import { generateOptimalSchedules } from '../utils/scheduleOptimizer';
import { formatLocation, getCourseColor, getCoursePrefix, minutesToTime } from '../utils/scheduleUtils';

interface ScheduleOptimizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  initialSelectedCourseCodes: string[];
  onApplyToCurrent: (sections: Record<string, string>) => void;
  onCreateNewOption: (sections: Record<string, string>) => void;
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
    target: 'min_gaps',
    excludedDays: [],
    onlyWithVacancies: false
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GeneratedScheduleResult[] | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedCourseCodes(initialSelectedCourseCodes.length > 0 ? initialSelectedCourseCodes : courses.map(c => c.code));
      setResults(null);
    }
  }, [isOpen, initialSelectedCourseCodes, courses]);

  const toggleCourse = (code: string) => {
    setSelectedCourseCodes(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    // Add small timeout to allow UI to update to "generating" state
    setTimeout(() => {
      const generated = generateOptimalSchedules(courses, selectedCourseCodes, options);
      setResults(generated);
      setIsGenerating(false);
    }, 100);
  };

  const toggleExcludedDay = (day: DayOfWeek) => {
    setOptions(prev => {
      const excluded = prev.excludedDays.includes(day)
        ? prev.excludedDays.filter(d => d !== day)
        : [...prev.excludedDays, day];
      return { ...prev, excludedDays: excluded };
    });
  };

  const filteredCourses = useMemo(() => {
    let result = courses;
    if (showOnlyEligible) {
      result = result.filter(c => c.isEligible);
    }
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(c => 
        c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
      );
    }
    return result;
  }, [courses, searchQuery, showOnlyEligible]);

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
          <div style={{ width: '340px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.1)' }}>
            
            {/* Scrollable Configuration Area */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {/* Step 1: Select Courses */}
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>1. Selecciona Cursos</h4>
                  <span className="glass-pill" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                    {selectedCourseCodes.length} / {courses.length}
                  </span>
                </div>

                {/* Selected Courses Tags */}
                {selectedCourseCodes.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px', padding: '8px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid var(--border-color)', maxHeight: '100px', overflowY: 'auto' }}>
                    {selectedCourseCodes.map(code => {
                      const courseColor = getCourseColor(code);
                      return (
                        <div 
                          key={code}
                          style={{ 
                            display: 'flex', alignItems: 'center', gap: '4px', 
                            padding: '2px 6px', borderRadius: '4px', 
                            background: `rgba(${parseInt(courseColor.slice(1,3),16)}, ${parseInt(courseColor.slice(3,5),16)}, ${parseInt(courseColor.slice(5,7),16)}, 0.15)`,
                            border: `1px solid ${courseColor}40`,
                            fontSize: '0.7rem', color: courseColor, fontWeight: 600
                          }}
                        >
                          {code}
                          <button 
                            onClick={(e) => { e.stopPropagation(); toggleCourse(code); }}
                            style={{ background: 'transparent', border: 'none', color: courseColor, cursor: 'pointer', padding: '0 2px', display: 'flex', alignItems: 'center' }}
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

                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <button 
                    className="btn btn-secondary" 
                    style={{ flex: 1, padding: '6px', fontSize: '0.75rem' }}
                    onClick={() => setSelectedCourseCodes(courses.map(c => c.code))}
                  >
                    Todos
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    style={{ flex: 1, padding: '6px', fontSize: '0.75rem' }}
                    onClick={() => setSelectedCourseCodes(courses.filter(c => c.isEligible).map(c => c.code))}
                  >
                    Solo Habilitados
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    style={{ flex: 1, padding: '6px', fontSize: '0.75rem' }}
                    onClick={() => setSelectedCourseCodes([])}
                  >
                    Ninguno
                  </button>
                </div>

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

                <div className="course-list-scroll" style={{ maxHeight: '200px', paddingRight: '8px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', padding: '8px', overflowY: 'auto' }}>
                  {filteredCourses.map(course => (
                    <div 
                      key={course.code} 
                      onClick={() => toggleCourse(course.code)}
                      style={{ 
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', 
                        borderRadius: '6px', cursor: 'pointer', userSelect: 'none',
                        background: selectedCourseCodes.includes(course.code) ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                        border: selectedCourseCodes.includes(course.code) ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                        marginBottom: '4px'
                      }}
                    >
                      {selectedCourseCodes.includes(course.code) ? <CheckSquare size={16} color="var(--accent-primary)" /> : <Square size={16} color="var(--text-muted)" />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: course.color }}>{course.code}</span>
                          {course.isEligible && <span className="eligible-badge" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>Habilitado</span>}
                        </div>
                        <div style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-secondary)' }}>
                          {course.name}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 2: Optimization Preferences */}
              <div style={{ padding: '0 20px 20px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Filter size={16} color="var(--text-muted)" />
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>2. Preferencias</h4>
                </div>

                {/* Target */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Prioridad de Optimización:</label>
                  <select 
                    value={options.target}
                    onChange={(e) => setOptions({ ...options, target: e.target.value as any })}
                    style={{
                      padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', 
                      background: '#0d131f', color: '#fff', fontSize: '0.85rem', outline: 'none'
                    }}
                  >
                    <option value="min_gaps">⚡ Menor cantidad de huecos (Gaps)</option>
                    <option value="min_days">📅 Menos días a la semana</option>
                    <option value="morning">🌅 Preferir Mañanas</option>
                    <option value="afternoon">🌇 Preferir Tardes/Noches</option>
                  </select>
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
                          className={`filter-pill-btn ${options.excludedDays.includes(day) ? 'active' : ''}`}
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        >
                          {options.excludedDays.includes(day) ? `🚫 Sin ${day}` : day}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action */}
            <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', marginTop: 'auto', flexShrink: 0, background: 'rgba(0,0,0,0.2)' }}>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '12px', fontSize: '0.95rem', background: 'var(--accent-gradient)', border: 'none' }}
                onClick={handleGenerate}
                disabled={isGenerating || selectedCourseCodes.length === 0}
              >
                {isGenerating ? 'Generando...' : 'Generar Horarios'}
              </button>
            </div>
          </div>

          {/* Right Panel: Results */}
          <div style={{ flex: 1, padding: '24px', overflowY: 'auto', background: '#0a0d14' }}>
            {!results && !isGenerating && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center' }}>
                <Sparkles size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Listo para Optimizar</p>
                <p style={{ fontSize: '0.9rem', maxWidth: '300px', lineHeight: 1.5 }}>Selecciona tus cursos y preferencias en el panel izquierdo y presiona "Generar Horarios".</p>
              </div>
            )}

            {isGenerating && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--accent-primary)' }}>
                <div className="spin-icon" style={{ marginBottom: '16px' }}><Clock size={32} /></div>
                <p style={{ fontWeight: 600 }}>Buscando las mejores combinaciones...</p>
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
                          </div>
                          
                          <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={13} color="var(--text-muted)" /> {res.metrics.gapHours}h huecos totales
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Calendar size={13} color="var(--text-muted)" /> {res.metrics.activeDaysCount} días de clase
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            onClick={() => {
                              onCreateNewOption(res.selectedSections);
                              onClose();
                            }}
                          >
                            Crear Nueva Pestaña
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
  );
};
