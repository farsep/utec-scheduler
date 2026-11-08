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
  kind: 'prereq' | 'unlock' | 'muted';
}

function getDepartmentDotColor(code: string, name: string): string {
  if (
    code.startsWith('DS') ||
    code.startsWith('BA') ||
    code === 'CS3015' ||
    code === 'CS3060' ||
    code === 'CS3061' ||
    code === 'CS2041' ||
    code === 'CS2042' ||
    /datos|machine learning|deep learning|inteligencia artificial/i.test(name)
  ) {
    return '#10B981'; // IA / Datos
  }
  if (
    code.startsWith('MA') ||
    code.startsWith('QU') ||
    code.startsWith('FI') ||
    code === 'CS1040' ||
    code === 'CS1042' ||
    code === 'CS2020' ||
    code === 'IN2005' ||
    code === 'IN2006' ||
    code === 'ME1002' ||
    code === 'ME2003'
  ) {
    return '#F59E0B'; // Ciencias / Matemáticas
  }
  if (
    code.startsWith('HH') ||
    code.startsWith('PI') ||
    code.startsWith('GH') ||
    code.startsWith('AD') ||
    code.startsWith('PR') ||
    code.startsWith('EL500')
  ) {
    return '#8B5CF6'; // Gestión / HACS
  }
  return '#3B82F6'; // Computación / Carrera
}

export const CurricularDAGView: React.FC<CurricularDAGViewProps> = ({
  scheduledCourseCodes = new Set(),
  offeredCourseCodes = new Set(),
  onSelectCourseForSchedule,
}) => {
  const [subMode, setSubMode] = useState<'dag' | 'catalog'>('dag');
  const [selectedFaculty, setSelectedFaculty] = useState<'ALL' | FacultyId>('ALL');
  const [selectedCareerId, setSelectedCareerId] = useState<string>('ciencia-computacion');
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>('CS1042');
  const [hoveredCourseCode, setHoveredCourseCode] = useState<string | null>(null);
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
    setHoveredCourseCode(null);
    if (!career.courses.some(c => c.code === selectedCourseCode)) {
      setSelectedCourseCode(career.defaultSelectedCode);
    }
  };

  const focusCode = hoveredCourseCode || selectedCourseCode;

  // Ensure focusCode / selectedCourseCode exists in activeCareer
  const activeCourse: CurricularCourseNode = useMemo(() => {
    return (
      activeCareer.courses.find(c => c.code === focusCode) ||
      activeCareer.courses.find(c => c.code === selectedCourseCode) ||
      activeCareer.courses.find(c => c.code === activeCareer.defaultSelectedCode) ||
      activeCareer.courses[0]
    );
  }, [activeCareer, focusCode, selectedCourseCode]);

  // Compute full recursive upstream ancestors and downstream descendants for activeCourse
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
    const ancestors = new Set<string>();
    const stackUp = [...activeCourse.prereqs];
    while (stackUp.length > 0) {
      const curr = stackUp.pop()!;
      if (!ancestors.has(curr)) {
        ancestors.add(curr);
        const node = courseMap.get(curr);
        if (node) {
          for (const p of node.prereqs) stackUp.push(p);
        }
      }
    }

    const directUnlocks = new Set<string>(childrenMap.get(activeCourse.code) || []);
    const descendants = new Set<string>();
    const stackDown = [...directUnlocks];
    while (stackDown.length > 0) {
      const curr = stackDown.pop()!;
      if (!descendants.has(curr)) {
        descendants.add(curr);
        const kids = childrenMap.get(curr) || [];
        for (const k of kids) stackDown.push(k);
      }
    }

    return {
      courseMap,
      childrenMap,
      directPrereqs,
      ancestors,
      allPrereqs: ancestors,
      directUnlocks,
      descendants,
      allUnlocks: descendants,
    };
  }, [activeCareer, activeCourse]);

  // Group courses into all 10 cycle columns (Ciclo 1 to Ciclo 10 — 200 credits)
  const cycles = useMemo(() => {
    return ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const).map(cycleNum => {
      const items = activeCareer.courses.filter(c => c.cycle === cycleNum);
      const totalCredits = items.reduce((acc, c) => acc + c.credits, 0);
      return { cycleNum, items, totalCredits };
    });
  }, [activeCareer]);

  const careerTotalCredits = useMemo(() => {
    return activeCareer.totalCredits ?? activeCareer.courses.reduce((acc, c) => acc + c.credits, 0);
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
        const isPrereqEdge =
          (target.code === activeCourse.code || graphRelations.ancestors.has(target.code)) &&
          graphRelations.ancestors.has(sourceCode);
        const isUnlockEdge =
          (sourceCode === activeCourse.code || graphRelations.descendants.has(sourceCode)) &&
          graphRelations.descendants.has(target.code);

        if (isPrereqEdge) {
          kind = 'prereq';
        } else if (isUnlockEdge) {
          kind = 'unlock';
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
                  <span>10 Ciclos ({careerTotalCredits} cr)</span>
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
                        onClick={() => {
                          setHoveredCourseCode(null);
                          setSelectedCourseCode(prereqCode);
                        }}
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
                        onClick={() => {
                          setHoveredCourseCode(null);
                          setSelectedCourseCode(unlockCode);
                        }}
                      >
                        ● {getCourseFullLabel(unlockCode, activeCareer)}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* 3. 10-Cycle Horizontal Scroll Curricular Graph Stage */}
          <section className="grafton-card dag-canvas-card" aria-label="Grafo curricular por ciclos">
            <div className="dag-scroll-container">
              <div className="dag-stage-inner" ref={stageRef}>
                {/* SVG Bezier Connectors Layer */}
                <svg className="dag-svg-layer" aria-hidden="true">
                  {svgEdges.map(edge => {
                    let stroke = 'rgba(24, 24, 26, 0.14)';
                    let strokeWidth = 1.1;
                    let opacity = 0.22;

                    if (edge.kind === 'prereq') {
                      stroke = '#F59E0B';
                      strokeWidth = 2.4;
                      opacity = 1;
                    } else if (edge.kind === 'unlock') {
                      stroke = '#10B981';
                      strokeWidth = 2.4;
                      opacity = 1;
                    }

                    return (
                      <path
                        key={edge.key}
                        d={edge.d}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        opacity={opacity}
                      />
                    );
                  })}
                </svg>

                {/* 10 Cycle Columns */}
                <div className="dag-columns-grid">
                  {cycles.map(({ cycleNum, items, totalCredits }) => (
                    <div key={cycleNum} className="dag-cycle-column">
                      <div className="dag-cycle-header">
                        <span className="dag-cycle-title">CICLO {cycleNum}</span>
                        <span className="dag-cycle-credits">{totalCredits} cr</span>
                      </div>

                      <div className="dag-cycle-nodes">
                        {items.map(node => {
                          const unlocks = graphRelations.childrenMap.get(node.code) || [];
                          const isSelected = node.code === activeCourse.code;
                          const isPrereq = !isSelected && graphRelations.ancestors.has(node.code);
                          const isUnlock = !isSelected && graphRelations.descendants.has(node.code);
                          const isRelated = isSelected || isPrereq || isUnlock;
                          const isInSchedule = scheduledCourseCodes.has(node.code);
                          const deptColor = getDepartmentDotColor(node.code, node.name);

                          let stateClass = 'dag-node--ghost';
                          if (isSelected) {
                            stateClass = 'dag-node--selected dag-node--related';
                          } else if (isPrereq) {
                            stateClass = 'dag-node--prereq dag-node--prereq-direct dag-node--related';
                          } else if (isUnlock) {
                            stateClass = 'dag-node--unlock dag-node--unlock-direct dag-node--related';
                          }

                          return (
                            <button
                              key={node.code}
                              id={`dag-node-${node.code}`}
                              ref={el => {
                                nodeRefs.current[node.code] = el;
                              }}
                              type="button"
                              data-related={isRelated ? 'true' : 'false'}
                              data-role={
                                isSelected
                                  ? 'selected'
                                  : isPrereq
                                    ? 'prereq'
                                    : isUnlock
                                      ? 'unlock'
                                      : 'unrelated'
                              }
                              className={`dag-node-card ${stateClass}`}
                              onClick={() => setSelectedCourseCode(node.code)}
                              onMouseEnter={() => setHoveredCourseCode(node.code)}
                              onMouseLeave={() =>
                                setHoveredCourseCode(prev => (prev === node.code ? null : prev))
                              }
                            >
                              {/* Top Row: 8px Department Dot + Bold Code (Left) & Quiet Credits (Right) */}
                              <div className="dag-node-top">
                                <span className="dag-node-top-left">
                                  <span
                                    className="dag-dept-dot"
                                    style={{ backgroundColor: deptColor }}
                                  />
                                  <span className="dag-node-code">{node.code}</span>
                                </span>
                                <span className="dag-node-cr">{node.credits} cr</span>
                              </div>

                              {/* Middle: Full Course Name */}
                              <div className="dag-node-name">{node.name}</div>

                              {/* Bottom Row: Role Badge or Academic Status (Left) & Unlock Count (Right) */}
                              <div className="dag-node-bottom">
                                <span className="dag-node-bottom-left">
                                  {isSelected ? (
                                    <span className="dag-role-badge dag-role-badge--selected px-1.5 py-0.5 text-[10px] font-semibold bg-[#00779E]/15 text-[#005A78]">
                                      Seleccionado
                                    </span>
                                  ) : isPrereq ? (
                                    <span className="dag-role-badge dag-role-badge--prereq px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/15 text-[#B85D00]">
                                      Prerrequisito
                                    </span>
                                  ) : isUnlock ? (
                                    <span className="dag-role-badge dag-role-badge--unlock px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-[#0D7A4E]">
                                      Se desbloquea
                                    </span>
                                  ) : node.cycle <= 2 ? (
                                    <span className="dag-node-status dag-node-status--passed">
                                      <span
                                        className="dag-status-dot"
                                        style={{ backgroundColor: '#10B981' }}
                                      />
                                      Aprobado
                                    </span>
                                  ) : isInSchedule || node.cycle === 3 ? (
                                    <span className="dag-node-status dag-node-status--schedule">
                                      <span
                                        className="dag-status-dot"
                                        style={{ backgroundColor: '#00779E' }}
                                      />
                                      En tu horario
                                    </span>
                                  ) : (
                                    <span className="dag-node-status dag-node-status--available">
                                      <span
                                        className="dag-status-dot"
                                        style={{ backgroundColor: '#6B7280' }}
                                      />
                                      Disponible
                                    </span>
                                  )}
                                </span>
                                <span className="dag-node-unlock-count">
                                  {unlocks.length > 0 ? `→ ${unlocks.length}` : ''}
                                </span>
                              </div>
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

