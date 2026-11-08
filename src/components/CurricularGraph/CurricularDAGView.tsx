import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  UTEC_16_CAREERS,
  UTEC_FACULTIES,
  getCourseFullLabel,
  type CareerCurriculum,
  type CurricularCourseNode,
  type FacultyId,
} from '../../data/utecCurriculaData';
import { CourseApp } from '../CourseDirectory/CourseApp';
import { GitBranch, BookOpen, CheckCircle2, ArrowRight, ArrowLeft, Plus } from 'lucide-react';

interface CurricularDAGViewProps {
  scheduledCourseCodes?: Set<string>;
  offeredCourseCodes?: Set<string>;
  onSelectCourseForSchedule?: (courseCode: string) => void;
}

interface SvgEdge {
  key: string;
  d: string;
  kind: 'prereq-direct' | 'prereq-base' | 'unlock-direct' | 'unlock-chain' | 'muted';
}

export const CurricularDAGView: React.FC<CurricularDAGViewProps> = ({
  scheduledCourseCodes = new Set(),
  offeredCourseCodes = new Set(),
  onSelectCourseForSchedule,
}) => {
  const [subMode, setSubMode] = useState<'dag' | 'catalog'>('dag');
  const [selectedFaculty, setSelectedFaculty] = useState<'ALL' | FacultyId>('ALL');
  const [selectedCareerId, setSelectedCareerId] = useState<string>('ciencia-computacion');
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>('CS2013');
  const [svgEdges, setSvgEdges] = useState<SvgEdge[]>([]);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const activeCareer: CareerCurriculum = useMemo(() => {
    return UTEC_16_CAREERS.find(c => c.id === selectedCareerId) || UTEC_16_CAREERS[0];
  }, [selectedCareerId]);

  const visibleCareers = useMemo(() => {
    if (selectedFaculty === 'ALL') return UTEC_16_CAREERS;
    return UTEC_16_CAREERS.filter(c => c.facultyId === selectedFaculty);
  }, [selectedFaculty]);

  const handleSelectCareer = (career: CareerCurriculum) => {
    setSelectedCareerId(career.id);
    if (!career.courses.some(c => c.code === selectedCourseCode)) {
      setSelectedCourseCode(career.defaultSelectedCode);
    }
  };

  // Ensure selectedCourseCode exists in activeCareer
  const activeCourse: CurricularCourseNode = useMemo(() => {
    return (
      activeCareer.courses.find(c => c.code === selectedCourseCode) ||
      activeCareer.courses.find(c => c.code === activeCareer.defaultSelectedCode) ||
      activeCareer.courses[0]
    );
  }, [activeCareer, selectedCourseCode]);

  // Compute upstream prerequisite sets (direct & transitive) and downstream unlock sets
  const graphRelations = useMemo(() => {
    const courseMap = new Map<string, CurricularCourseNode>();
    const childrenMap = new Map<string, string[]>();

    for (const c of activeCareer.courses) {
      courseMap.set(c.code, c);
      childrenMap.set(c.code, []);
    }
    for (const c of activeCareer.courses) {
      for (const p of c.prereqs) {
        if (childrenMap.has(p)) {
          childrenMap.get(p)!.push(c.code);
        }
      }
    }

    const directPrereqs = new Set<string>(activeCourse.prereqs);
    const allPrereqs = new Set<string>();
    const stackUp = [...activeCourse.prereqs];
    while (stackUp.length > 0) {
      const curr = stackUp.pop()!;
      if (!allPrereqs.has(curr)) {
        allPrereqs.add(curr);
        const node = courseMap.get(curr);
        if (node) {
          for (const p of node.prereqs) stackUp.push(p);
        }
      }
    }

    const directUnlocks = new Set<string>(childrenMap.get(activeCourse.code) || []);
    const allUnlocks = new Set<string>();
    const stackDown = [...directUnlocks];
    while (stackDown.length > 0) {
      const curr = stackDown.pop()!;
      if (!allUnlocks.has(curr)) {
        allUnlocks.add(curr);
        const kids = childrenMap.get(curr) || [];
        for (const k of kids) stackDown.push(k);
      }
    }

    return {
      courseMap,
      directPrereqs,
      allPrereqs,
      directUnlocks,
      allUnlocks,
    };
  }, [activeCareer, activeCourse]);

  // Group courses into 6 cycle columns
  const cycles = useMemo(() => {
    return ([1, 2, 3, 4, 5, 6] as const).map(cycleNum => {
      const items = activeCareer.courses.filter(c => c.cycle === cycleNum);
      const totalCredits = items.reduce((acc, c) => acc + c.credits, 0);
      return { cycleNum, items, totalCredits };
    });
  }, [activeCareer]);

  // Recompute SVG Bezier connector coordinates whenever career, selected course, or stage size changes
  const computeEdges = useCallback(() => {
    const stageEl = stageRef.current;
    if (!stageEl) return;

    const stageRect = stageEl.getBoundingClientRect();
    if (stageRect.width === 0) return;

    const nextEdges: SvgEdge[] = [];

    for (const target of activeCareer.courses) {
      for (const sourceCode of target.prereqs) {
        const sourceEl = nodeRefs.current[sourceCode];
        const targetEl = nodeRefs.current[target.code];
        if (!sourceEl || !targetEl) continue;

        const sRect = sourceEl.getBoundingClientRect();
        const tRect = targetEl.getBoundingClientRect();

        const x1 = sRect.right - stageRect.left;
        const y1 = sRect.top - stageRect.top + sRect.height / 2;
        const x2 = tRect.left - stageRect.left;
        const y2 = tRect.top - stageRect.top + tRect.height / 2;

        const dx = Math.max(28, (x2 - x1) * 0.48);
        const d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${(x1 + dx).toFixed(1)} ${y1.toFixed(1)}, ${(x2 - dx).toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;

        let kind: SvgEdge['kind'] = 'muted';
        if (target.code === activeCourse.code && graphRelations.directPrereqs.has(sourceCode)) {
          kind = 'prereq-direct';
        } else if (
          graphRelations.allPrereqs.has(target.code) &&
          graphRelations.allPrereqs.has(sourceCode)
        ) {
          kind = 'prereq-base';
        } else if (sourceCode === activeCourse.code && graphRelations.directUnlocks.has(target.code)) {
          kind = 'unlock-direct';
        } else if (
          graphRelations.allUnlocks.has(sourceCode) &&
          graphRelations.allUnlocks.has(target.code)
        ) {
          kind = 'unlock-chain';
        }

        nextEdges.push({
          key: `${sourceCode}->${target.code}`,
          d,
          kind,
        });
      }
    }

    // Paint muted edges first, active highlighted edges on top
    nextEdges.sort((a, b) => (a.kind === 'muted' ? -1 : b.kind === 'muted' ? 1 : 0));
    setSvgEdges(nextEdges);
  }, [activeCareer, activeCourse.code, graphRelations]);

  useEffect(() => {
    if (subMode !== 'dag') return;
    const raf = requestAnimationFrame(computeEdges);
    const timer = setTimeout(computeEdges, 90);

    const stageEl = stageRef.current;
    let observer: ResizeObserver | null = null;
    if (stageEl && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => computeEdges());
      observer.observe(stageEl);
    }
    window.addEventListener('resize', computeEdges);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      if (observer) observer.disconnect();
      window.removeEventListener('resize', computeEdges);
    };
  }, [computeEdges, subMode]);

  const isSelectedInSchedule = scheduledCourseCodes.has(activeCourse.code);
  const isOfferedInCatalog = offeredCourseCodes.has(activeCourse.code);

  return (
    <div className="curricular-dag-root">
      {/* Sub-view Bar: Curricular Graph (16 Careers) vs 2026-2 Offered Catalog */}
      <div className="dag-submode-bar">
        <div className="dag-submode-inner">
          <div className="dag-submode-tabs" role="tablist" aria-label="Modo de exploración curricular">
            <button
              type="button"
              className={`dag-submode-btn ${subMode === 'dag' ? 'is-active' : ''}`}
              onClick={() => setSubMode('dag')}
            >
              <GitBranch size={14} />
              <span>Ruta Curricular Interactiva · 16 Carreras UTEC</span>
            </button>
            <button
              type="button"
              className={`dag-submode-btn ${subMode === 'catalog' ? 'is-active' : ''}`}
              onClick={() => setSubMode('catalog')}
            >
              <BookOpen size={14} />
              <span>Catálogo Ofertado 2026-2 (420 Cursos & Modo Oyente)</span>
            </button>
          </div>

          <div className="dag-submode-legend">
            <span className="dag-legend-item">
              <span className="dag-legend-swatch dag-legend-swatch--amber" />
              Prerrequisito
            </span>
            <span className="dag-legend-item">
              <span className="dag-legend-swatch dag-legend-swatch--cyan" />
              Curso Seleccionado
            </span>
            <span className="dag-legend-item">
              <span className="dag-legend-swatch dag-legend-swatch--emerald" />
              Desbloquea
            </span>
          </div>
        </div>
      </div>

      {subMode === 'catalog' ? (
        <CourseApp hideTopNavbar />
      ) : (
        <main className="dag-main-container">
          {/* 1. 4 Faculties & 16 Careers Selector Header */}
          <section className="grafton-card dag-careers-panel" aria-label="Selector de 4 Facultades y 16 Carreras UTEC">
            <div className="dag-panel-header">
              <div>
                <div className="dag-eyebrow">ESTRUCTURA CURRICULAR OFICIAL · UTEC BARRANCO</div>
                <h1 className="dag-title">
                  Malla Curricular & Grafo de Prerrequisitos — 16 Carreras de Pregrado
                </h1>
              </div>

              {/* Faculty Filter Strip */}
              <div className="dag-faculty-strip">
                <button
                  type="button"
                  className={`dag-faculty-btn ${selectedFaculty === 'ALL' ? 'is-active' : ''}`}
                  onClick={() => setSelectedFaculty('ALL')}
                >
                  Todas (16)
                </button>
                {UTEC_FACULTIES.map(fac => (
                  <button
                    key={fac.id}
                    type="button"
                    className={`dag-faculty-btn ${selectedFaculty === fac.id ? 'is-active' : ''}`}
                    onClick={() => setSelectedFaculty(fac.id)}
                  >
                    {fac.shortName} ({fac.careersCount})
                  </button>
                ))}
              </div>
            </div>

            {/* Responsive 1 / 2 / 4 Column Grid of Career Selector Buttons */}
            <div className="dag-careers-grid">
              {visibleCareers.map(career => {
                const isActive = career.id === activeCareer.id;
                return (
                  <button
                    key={career.id}
                    type="button"
                    className={`dag-career-btn ${isActive ? 'is-active' : ''}`}
                    onClick={() => handleSelectCareer(career)}
                  >
                    <span className="dag-career-code">{career.shortCode}</span>
                    <span className="dag-career-meta">
                      <span className="dag-career-name">{career.name}</span>
                      <span className="dag-career-faculty">{career.facultyName}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 2. Top Course Inspector Card (Full Course Name + Code on every pill) */}
          <section className="grafton-card dag-inspector-card" aria-label="Inspector de asignatura seleccionada">
            <div className="dag-inspector-main">
              <span className="dag-inspector-code">{activeCourse.code}</span>
              <div className="dag-inspector-titles">
                <h2 className="dag-inspector-name">{activeCourse.name}</h2>
                <div className="dag-inspector-sub">
                  <span>{activeCareer.name}</span>
                  <span>·</span>
                  <span>Ciclo {activeCourse.cycle}</span>
                  <span>·</span>
                  <span>{activeCourse.credits} créditos</span>
                  {isSelectedInSchedule && (
                    <>
                      <span>·</span>
                      <span className="dag-in-schedule-tag">
                        <CheckCircle2 size={13} /> En tu horario actual
                      </span>
                    </>
                  )}
                </div>
              </div>

              {isOfferedInCatalog && !isSelectedInSchedule && onSelectCourseForSchedule && (
                <button
                  type="button"
                  className="btn btn-primary dag-add-schedule-btn"
                  onClick={() => onSelectCourseForSchedule(activeCourse.code)}
                >
                  <Plus size={14} />
                  <span>Añadir a Horario</span>
                </button>
              )}
            </div>

            <div className="dag-inspector-relations">
              {/* Prerequisites Column */}
              <div className="dag-relation-group">
                <span className="dag-relation-label">
                  <ArrowLeft size={13} /> Requiere aprobar antes:
                </span>
                <div className="dag-relation-pills">
                  {activeCourse.prereqs.length === 0 ? (
                    <span className="dag-relation-empty">
                      Ingreso directo · Sin prerrequisitos previos
                    </span>
                  ) : (
                    activeCourse.prereqs.map(prereqCode => (
                      <button
                        key={prereqCode}
                        type="button"
                        className="dag-pill dag-pill--prereq"
                        onClick={() => setSelectedCourseCode(prereqCode)}
                      >
                        ● {getCourseFullLabel(prereqCode, activeCareer)}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Unlocks Column */}
              <div className="dag-relation-group">
                <span className="dag-relation-label">
                  <ArrowRight size={13} /> Desbloquea directamente:
                </span>
                <div className="dag-relation-pills">
                  {graphRelations.directUnlocks.size === 0 ? (
                    <span className="dag-relation-empty">
                      Asignatura terminal de ruta especializada
                    </span>
                  ) : (
                    Array.from(graphRelations.directUnlocks).map(unlockCode => (
                      <button
                        key={unlockCode}
                        type="button"
                        className="dag-pill dag-pill--unlock"
                        onClick={() => setSelectedCourseCode(unlockCode)}
                      >
                        ● {getCourseFullLabel(unlockCode, activeCareer)}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* 3. 6-Cycle Horizontal Scroll Curricular Graph Stage */}
          <section className="grafton-card dag-canvas-card" aria-label="Grafo curricular por ciclos">
            <div className="dag-scroll-container">
              <div className="dag-stage-inner" ref={stageRef}>
                {/* SVG Bezier Connectors Layer */}
                <svg className="dag-svg-layer" aria-hidden="true">
                  {svgEdges.map(edge => {
                    let stroke = '#C6C3BB';
                    let strokeWidth = 1.25;
                    let strokeDasharray: string | undefined = undefined;
                    let opacity = 0.65;

                    if (edge.kind === 'prereq-direct') {
                      stroke = '#B85D00';
                      strokeWidth = 2.6;
                      opacity = 1;
                    } else if (edge.kind === 'prereq-base') {
                      stroke = '#D97706';
                      strokeWidth = 2.1;
                      strokeDasharray = '5 3';
                      opacity = 0.95;
                    } else if (edge.kind === 'unlock-direct') {
                      stroke = '#0D7A4E';
                      strokeWidth = 2.6;
                      opacity = 1;
                    } else if (edge.kind === 'unlock-chain') {
                      stroke = '#10B981';
                      strokeWidth = 2.0;
                      strokeDasharray = '5 3';
                      opacity = 0.92;
                    }

                    return (
                      <path
                        key={edge.key}
                        d={edge.d}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        strokeDasharray={strokeDasharray}
                        opacity={opacity}
                      />
                    );
                  })}
                </svg>

                {/* 6 Cycle Columns */}
                <div className="dag-columns-grid">
                  {cycles.map(({ cycleNum, items, totalCredits }) => (
                    <div key={cycleNum} className="dag-cycle-column">
                      <div className="dag-cycle-header">
                        <span className="dag-cycle-title">CICLO {cycleNum}</span>
                        <span className="dag-cycle-credits">{totalCredits} cr</span>
                      </div>

                      <div className="dag-cycle-nodes">
                        {items.map(node => {
                          const isSelected = node.code === activeCourse.code;
                          const isDirectPrereq = graphRelations.directPrereqs.has(node.code);
                          const isBasePrereq =
                            !isDirectPrereq && graphRelations.allPrereqs.has(node.code);
                          const isDirectUnlock = graphRelations.directUnlocks.has(node.code);
                          const isChainUnlock =
                            !isDirectUnlock && graphRelations.allUnlocks.has(node.code);
                          const isInSchedule = scheduledCourseCodes.has(node.code);

                          let stateClass = 'dag-node--neutral';
                          let statusText = isInSchedule ? '✓ En tu horario' : '○ Explorar ruta';

                          if (isSelected) {
                            stateClass = 'dag-node--selected';
                            statusText = '★ Curso Seleccionado';
                          } else if (isDirectPrereq) {
                            stateClass = 'dag-node--prereq-direct';
                            statusText = '● Prerrequisito directo';
                          } else if (isBasePrereq) {
                            stateClass = 'dag-node--prereq-base';
                            statusText = '● Prerrequisito base';
                          } else if (isDirectUnlock) {
                            stateClass = 'dag-node--unlock-direct';
                            statusText = '● Se desbloquea';
                          } else if (isChainUnlock) {
                            stateClass = 'dag-node--unlock-chain';
                            statusText = '→ Ruta posterior';
                          } else if (isInSchedule) {
                            stateClass = 'dag-node--in-schedule';
                          }

                          return (
                            <button
                              key={node.code}
                              id={`dag-node-${node.code}`}
                              ref={el => {
                                nodeRefs.current[node.code] = el;
                              }}
                              type="button"
                              className={`dag-node-card ${stateClass}`}
                              onClick={() => setSelectedCourseCode(node.code)}
                            >
                              <div className="dag-node-top">
                                <span className="dag-node-code">
                                  {node.code} · Ciclo {node.cycle}
                                </span>
                                <span className="dag-node-cr">{node.credits} cr</span>
                              </div>

                              <div className="dag-node-name">{node.name}</div>

                              <div className="dag-node-status">{statusText}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </main>
      )}
    </div>
  );
};

