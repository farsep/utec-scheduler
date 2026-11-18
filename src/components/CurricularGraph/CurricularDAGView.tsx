import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  UTEC_16_CAREERS,
  UTEC_FACULTIES,
  getCourseFullLabel,
  type CareerCurriculum,
  type CurricularCourseNode,
  type FacultyId,
} from '../../data/utecCurriculaData';
import { GitBranch, BookOpen, CheckCircle2, ArrowRight, ArrowLeft, ArrowUp, ChevronUp, Plus, Maximize2 } from 'lucide-react';

interface CurricularDAGViewProps {
  scheduledCourseCodes?: Set<string>;
  offeredCourseCodes?: Set<string>;
  onSelectCourseForSchedule?: (courseCode: string) => void;
}

interface SvgEdge {
  key: string;
  d: string;
  kind: 'prereq-direct' | 'prereq-transitive' | 'unlock-direct' | 'unlock-transitive' | 'muted';
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
  const [selectedFaculty, setSelectedFaculty] = useState<'ALL' | FacultyId>('ALL');
  const [selectedCareerId, setSelectedCareerId] = useState<string>('ciencia-computacion');
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>('CS1042');
  const [svgEdges, setSvgEdges] = useState<SvgEdge[]>([]);
  const [mobileInspectorExpanded, setMobileInspectorExpanded] = useState(false);
  const [dagZoom, setDagZoom] = useState<number>(1);
  const [stageDims, setStageDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const panStateRef = useRef<{
    isDown: boolean;
    didDrag: boolean;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    lastX: number;
    lastY: number;
    lastTime: number;
    velX: number;
    velY: number;
    rafId: number | null;
  }>({
    isDown: false,
    didDrag: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    velX: 0,
    velY: 0,
    rafId: null,
  });

  // Listen for Command Palette career switches
  useEffect(() => {
    const applyCareer = (careerId?: string) => {
      if (!careerId) return;
      const found = UTEC_16_CAREERS.find(c => c.id === careerId);
      if (found) {
        setSelectedFaculty('ALL');
        setSelectedCareerId(found.id);
        setSelectedCourseCode(found.defaultSelectedCode);
      }
    };
    const pendingCareer = (window as any).__MATRICULAB_PENDING_CAREER__;
    if (pendingCareer) {
      delete (window as any).__MATRICULAB_PENDING_CAREER__;
      applyCareer(pendingCareer);
    }
    const onSelectCareerEvt = (e: Event) => {
      const detail = (e as CustomEvent<{ careerId?: string }>).detail;
      delete (window as any).__MATRICULAB_PENDING_CAREER__;
      applyCareer(detail?.careerId);
    };
    window.addEventListener('matriculab:cmdk-select-career', onSelectCareerEvt);
    return () => window.removeEventListener('matriculab:cmdk-select-career', onSelectCareerEvt);
  }, []);

  const activeCareer: CareerCurriculum = useMemo(() => {
    return UTEC_16_CAREERS.find(c => c.id === selectedCareerId) || UTEC_16_CAREERS[0];
  }, [selectedCareerId]);

  useEffect(() => {
    const collapseOnScroll = () => {
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setMobileInspectorExpanded(false);
      }
    };
    window.addEventListener('scroll', collapseOnScroll, { passive: true });
    const scroller = stageRef.current?.closest('.dag-scroll-container');
    scroller?.addEventListener('scroll', collapseOnScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', collapseOnScroll);
      scroller?.removeEventListener('scroll', collapseOnScroll);
    };
  }, [activeCareer.id]);

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

  // Ensure selectedCourseCode exists in activeCareer (Click-to-Select ONLY; no hover hijacking)
  const activeCourse: CurricularCourseNode = useMemo(() => {
    return (
      activeCareer.courses.find(c => c.code === selectedCourseCode) ||
      activeCareer.courses.find(c => c.code === activeCareer.defaultSelectedCode) ||
      activeCareer.courses[0]
    );
  }, [activeCareer, selectedCourseCode]);

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
    setStageDims({ w: stageEl.offsetWidth, h: stageEl.offsetHeight });

    const scale = Math.max(dagZoom, 0.25);
    const nextEdges: SvgEdge[] = [];

    for (const target of activeCareer.courses) {
      for (const sourceCode of target.prereqs) {
        const sourceEl = nodeRefs.current[sourceCode];
        const targetEl = nodeRefs.current[target.code];
        if (!sourceEl || !targetEl) continue;

        const sRect = sourceEl.getBoundingClientRect();
        const tRect = targetEl.getBoundingClientRect();

        const x1 = (sRect.right - stageRect.left) / scale;
        const y1 = (sRect.top - stageRect.top + sRect.height / 2) / scale;
        const x2 = (tRect.left - stageRect.left) / scale;
        const y2 = (tRect.top - stageRect.top + tRect.height / 2) / scale;

        const dx = Math.max(28, (x2 - x1) * 0.48);
        const d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${(x1 + dx).toFixed(1)} ${y1.toFixed(1)}, ${(x2 - dx).toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;

        let kind: SvgEdge['kind'] = 'muted';
        if (target.code === activeCourse.code && graphRelations.directPrereqs.has(sourceCode)) {
          kind = 'prereq-direct';
        } else if (
          graphRelations.ancestors.has(target.code) &&
          graphRelations.ancestors.has(sourceCode)
        ) {
          kind = 'prereq-transitive';
        } else if (sourceCode === activeCourse.code && graphRelations.directUnlocks.has(target.code)) {
          kind = 'unlock-direct';
        } else if (
          graphRelations.descendants.has(sourceCode) &&
          graphRelations.descendants.has(target.code)
        ) {
          kind = 'unlock-transitive';
        }

        nextEdges.push({
          key: `${sourceCode}->${target.code}`,
          d,
          kind,
        });
      }
    }

    // Paint muted edges first, then 2nd-degree transitive edges, then 1st-degree direct edges on top
    const edgeOrder: Record<SvgEdge['kind'], number> = {
      muted: 0,
      'prereq-transitive': 1,
      'unlock-transitive': 1,
      'prereq-direct': 2,
      'unlock-direct': 2,
    };
    nextEdges.sort((a, b) => edgeOrder[a.kind] - edgeOrder[b.kind]);
    setSvgEdges(nextEdges);
  }, [activeCareer, activeCourse.code, graphRelations, dagZoom]);

  const stopPanMomentum = useCallback(() => {
    if (panStateRef.current.rafId !== null) {
      cancelAnimationFrame(panStateRef.current.rafId);
      panStateRef.current.rafId = null;
    }
  }, []);

  useEffect(() => stopPanMomentum, [stopPanMomentum]);

  const handleDagMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !scrollContainerRef.current) return;
    stopPanMomentum();
    const scroller = scrollContainerRef.current;
    const now = performance.now();
    panStateRef.current = {
      isDown: true,
      didDrag: false,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: scroller.scrollLeft,
      scrollTop: scroller.scrollTop,
      lastX: e.clientX,
      lastY: e.clientY,
      lastTime: now,
      velX: 0,
      velY: 0,
      rafId: null,
    };
  };

  const handleDagMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const p = panStateRef.current;
    const scroller = scrollContainerRef.current;
    if (!p.isDown || !scroller) return;

    const dx = e.clientX - p.startX;
    const dy = e.clientY - p.startY;
    if (!p.didDrag && Math.hypot(dx, dy) > 5) {
      p.didDrag = true;
      setIsPanning(true);
    }
    if (!p.didDrag) return;

    e.preventDefault();
    scroller.scrollLeft = p.scrollLeft - dx;
    scroller.scrollTop = p.scrollTop - dy;

    const now = performance.now();
    const dt = Math.max(8, now - p.lastTime);
    p.velX = ((p.lastX - e.clientX) / dt) * 16;
    p.velY = ((p.lastY - e.clientY) / dt) * 16;
    p.lastX = e.clientX;
    p.lastY = e.clientY;
    p.lastTime = now;
  };

  const endDagPan = () => {
    const p = panStateRef.current;
    const scroller = scrollContainerRef.current;
    if (!p.isDown) return;
    p.isDown = false;
    setIsPanning(false);

    if (p.didDrag && scroller && (Math.abs(p.velX) > 0.6 || Math.abs(p.velY) > 0.6)) {
      const step = () => {
        p.velX *= 0.92;
        p.velY *= 0.92;
        scroller.scrollLeft += p.velX;
        scroller.scrollTop += p.velY;
        if (Math.abs(p.velX) > 0.4 || Math.abs(p.velY) > 0.4) {
          p.rafId = requestAnimationFrame(step);
        } else {
          p.rafId = null;
        }
      };
      p.rafId = requestAnimationFrame(step);
    }

    if (p.didDrag) {
      window.setTimeout(() => {
        panStateRef.current.didDrag = false;
      }, 60);
    }
  };

  const handleDagWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const step = e.deltaY < 0 ? 0.08 : -0.08;
      setDagZoom(z => Number(Math.max(0.55, Math.min(1.35, z + step)).toFixed(2)));
    }
  };

  const handleFitTenCycles = () => {
    setDagZoom(0.72);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
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
  }, [computeEdges]);

  const isSelectedInSchedule = scheduledCourseCodes.has(activeCourse.code);
  const isOfferedInCatalog = offeredCourseCodes.has(activeCourse.code);

  return (
    <div className="curricular-dag-root">
      {/* Sub-view Bar: Curricular Graph (16 Careers) & Link to 2026-2 Offered Catalog */}
      <div className="dag-submode-bar">
        <div className="dag-submode-inner">
          <div className="dag-submode-tabs" role="tablist" aria-label="Modo de exploración curricular">
            <div className="dag-submode-btn is-active" style={{ cursor: 'default' }}>
              <GitBranch size={14} />
              <span>Ruta Curricular Interactiva · 16 Carreras UTEC</span>
            </div>
            <a
              href="/cursos"
              className="dag-submode-btn"
              title="Explorar el catálogo completo de 420 cursos con secciones, horarios y oyentes"
            >
              <BookOpen size={14} />
              <span>Catálogo Ofertado 2026-2 (420 Cursos)</span>
              <ArrowRight size={13} strokeWidth={2.4} className="swiss-arrow-right" aria-hidden="true" />
            </a>
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

      <main className="dag-main-container">
          {/* 1. Compact Single-Bar Swiss Career Selector (Replaces 4x4 bulky grid, reclaims +200px) */}
          <section className="dag-compact-bar" aria-label="Selector de 4 Facultades y 16 Carreras UTEC">
            {/* Left compartment: Currently selected career with code badge and faculty name */}
            <div className="dag-active-career-compartment">
              <span className="dag-active-career-code">{activeCareer.shortCode}</span>
              <div className="dag-active-career-info">
                <span className="dag-active-career-name">{activeCareer.name}</span>
                <span className="dag-active-career-faculty">{activeCareer.facultyName}</span>
              </div>
            </div>

            {/* Right compartment: Faculty filter tabs + Horizontal scrollable career pills */}
            <div className="dag-selector-scroll-compartment">
              <div className="dag-compact-faculty-strip" role="group" aria-label="Filtro por Facultad">
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

              {/* Clean Horizontal Scrollable Pill Bar */}
              <div className="dag-careers-pills-scroll" role="listbox" aria-label="Carreras de pregrado">
                {visibleCareers.map(career => {
                  const isActive = career.id === activeCareer.id;
                  return (
                    <button
                      key={career.id}
                      type="button"
                      className={`dag-career-pill ${isActive ? 'is-active' : ''}`}
                      onClick={() => handleSelectCareer(career)}
                      title={`${career.name} — ${career.facultyName}`}
                      role="option"
                      aria-selected={isActive}
                    >
                      <span className="dag-career-pill-code">{career.shortCode}</span>
                      <span className="dag-career-pill-name">{career.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 2. Top Course Inspector Card (Natural flow, unclipped) */}
          <section
            className={`grafton-card dag-inspector-card dag-inspector-card--compact relative z-10 min-h-[88px] py-2.5 px-4 ${!mobileInspectorExpanded ? 'is-mobile-collapsed' : ''}`}
            aria-label="Inspector de asignatura seleccionada"
          >
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

              <button
                type="button"
                onClick={() => setMobileInspectorExpanded(v => !v)}
                aria-expanded={mobileInspectorExpanded}
                className="dag-mobile-route-toggle"
                style={{
                  flexShrink: 0,
                  padding: '4px 8px',
                  backgroundColor: '#DCD9D2',
                  color: '#141416',
                  border: '1px solid #18181A',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  borderRadius: '0px',
                  cursor: 'pointer',
                }}
              >
                {mobileInspectorExpanded ? (
                  <span className="swiss-btn-inline">
                    <ChevronUp size={13} strokeWidth={2.4} aria-hidden="true" />
                    <span>Ocultar</span>
                  </span>
                ) : (
                  <span className="swiss-btn-inline">
                    <ArrowUp size={13} strokeWidth={2.4} aria-hidden="true" />
                    <span>Ver Ruta</span>
                  </span>
                )}
              </button>

              <div className="dag-inspector-actions flex items-center gap-2 flex-wrap">
                {isOfferedInCatalog && (
                  <a
                    href={`/cursos?curso=${activeCourse.code}`}
                    className="btn btn-secondary dag-add-schedule-btn"
                    style={{ borderColor: 'var(--border-hairline)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                    title={`Ver secciones, horarios y oyentes de ${activeCourse.code} en Catálogo Ofertado`}
                  >
                    <BookOpen size={14} />
                    <span>Ver en Cursos</span>
                  </a>
                )}
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
            </div>

            <div className="dag-inspector-relations">
              {/* Prerequisites Column */}
              <div className="dag-relation-group">
                <span className="dag-relation-label">
                  <ArrowLeft size={13} /> Requiere aprobar antes:
                </span>
                <div className="dag-relation-pills min-h-[32px] content-start">
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
                        <span className="swiss-dag-dot" aria-hidden="true" />{getCourseFullLabel(prereqCode, activeCareer)}
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
                <div className="dag-relation-pills min-h-[32px] content-start">
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
                        <span className="swiss-dag-dot" aria-hidden="true" />{getCourseFullLabel(unlockCode, activeCareer)}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* 3. 10-Cycle Horizontal Scroll Curricular Graph Stage */}
          <section className="grafton-card dag-canvas-card" aria-label="Grafo curricular por ciclos">
            {/* Compact Zoom & Fit Toolbar */}
            <div className="dag-zoom-toolbar">
              <span className="dag-zoom-hint">
                ARRASTRAR LIENZO PARA DESPLAZAR · CTRL+SCROLL PARA ZOOM
              </span>
              <div className="dag-zoom-controls">
                <button
                  type="button"
                  data-testid="dag-zoom-out"
                  onClick={() => setDagZoom(z => Number(Math.max(0.55, z - 0.1).toFixed(2)))}
                  className="dag-zoom-btn"
                  aria-label="Alejar grafo curricular"
                >
                  −
                </button>
                <button
                  type="button"
                  data-testid="dag-zoom-reset"
                  onClick={() => setDagZoom(1)}
                  className="dag-zoom-btn dag-zoom-btn--reset"
                  title="Restablecer zoom al 100%"
                >
                  {Math.round(dagZoom * 100)}%
                </button>
                <button
                  type="button"
                  data-testid="dag-zoom-in"
                  onClick={() => setDagZoom(z => Number(Math.min(1.35, z + 0.1).toFixed(2)))}
                  className="dag-zoom-btn"
                  aria-label="Acercar grafo curricular"
                >
                  +
                </button>
                <button
                  type="button"
                  data-testid="dag-zoom-fit"
                  onClick={handleFitTenCycles}
                  className={`dag-zoom-btn dag-zoom-btn--fit ${
                    Math.abs(dagZoom - 0.72) < 0.02 ? 'is-active' : ''
                  }`}
                >
                  <Maximize2 size={12} />
                  <span>Ajustar 10 Ciclos</span>
                </button>
              </div>
            </div>

            <div
              id="dag-scroll-container"
              ref={scrollContainerRef}
              data-no-page-swipe="true"
              className={`dag-scroll-container select-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
              onMouseDown={handleDagMouseDown}
              onMouseMove={handleDagMouseMove}
              onMouseUp={endDagPan}
              onMouseLeave={endDagPan}
              onWheel={handleDagWheel}
              onClickCapture={e => {
                if (panStateRef.current.didDrag) {
                  e.stopPropagation();
                  e.preventDefault();
                }
              }}
            >
              <div
                className="dag-stage-zoom-frame"
                style={
                  dagZoom !== 1 && stageDims.w > 0
                    ? {
                        width: `${Math.ceil(stageDims.w * dagZoom)}px`,
                        height: `${Math.ceil(stageDims.h * dagZoom)}px`,
                        overflow: 'hidden',
                      }
                    : undefined
                }
              >
                <div
                  className="dag-stage-inner"
                  ref={stageRef}
                  style={{
                    transform: dagZoom !== 1 ? `scale(${dagZoom})` : undefined,
                    transformOrigin: 'top left',
                    minWidth: Math.abs(dagZoom - 0.72) < 0.02 ? '1780px' : undefined,
                  }}
                >
                {/* SVG Bezier Connectors Layer (z-index: 0, behind 100% opaque .dag-node cards) */}
                <svg className="dag-svg-layer" aria-hidden="true">
                  {svgEdges.map(edge => {
                    let stroke = 'rgba(24, 24, 26, 0.14)';
                    let strokeWidth = 1.1;
                    let strokeDasharray: string | undefined = undefined;
                    let opacity = 0.22;

                    if (edge.kind === 'prereq-direct') {
                      stroke = '#F59E0B';
                      strokeWidth = 2.5;
                      opacity = 1;
                    } else if (edge.kind === 'prereq-transitive') {
                      stroke = '#F59E0B';
                      strokeWidth = 1.6;
                      strokeDasharray = '4 3';
                      opacity = 0.55;
                    } else if (edge.kind === 'unlock-direct') {
                      stroke = '#10B981';
                      strokeWidth = 2.5;
                      opacity = 1;
                    } else if (edge.kind === 'unlock-transitive') {
                      stroke = '#10B981';
                      strokeWidth = 1.6;
                      strokeDasharray = '4 3';
                      opacity = 0.55;
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

                {/* 10 Cycle Columns */}
                <div
                  className="dag-columns-grid"
                  style={
                    Math.abs(dagZoom - 0.72) < 0.02
                      ? { gridTemplateColumns: 'repeat(10, minmax(168px, 1fr))', gap: '12px' }
                      : undefined
                  }
                >
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
                          const isDirectPrereq =
                            !isSelected && graphRelations.directPrereqs.has(node.code);
                          const isTransitivePrereq =
                            !isSelected &&
                            !isDirectPrereq &&
                            graphRelations.ancestors.has(node.code);
                          const isPrereq = isDirectPrereq || isTransitivePrereq;

                          const isDirectUnlock =
                            !isSelected && graphRelations.directUnlocks.has(node.code);
                          const isTransitiveUnlock =
                            !isSelected &&
                            !isDirectUnlock &&
                            graphRelations.descendants.has(node.code);
                          const isUnlock = isDirectUnlock || isTransitiveUnlock;

                          const isRelated = isSelected || isPrereq || isUnlock;
                          const isInSchedule = scheduledCourseCodes.has(node.code);
                          const deptColor = getDepartmentDotColor(node.code, node.name);

                          let stateClass = 'is-ghosted dag-node--ghost';
                          let degreeAttr = 'unrelated';
                          if (isSelected) {
                            stateClass = 'is-selected dag-node--selected dag-node--related';
                            degreeAttr = 'selected';
                          } else if (isDirectPrereq) {
                            stateClass =
                              'is-prereq-direct dag-node--prereq dag-node--prereq-direct dag-node--related';
                            degreeAttr = '1st-prereq';
                          } else if (isTransitivePrereq) {
                            stateClass =
                              'is-prereq-transitive dag-node--prereq dag-node--prereq-base dag-node--related';
                            degreeAttr = '2nd-prereq';
                          } else if (isDirectUnlock) {
                            stateClass =
                              'is-unlock-direct dag-node--unlock dag-node--unlock-direct dag-node--related';
                            degreeAttr = '1st-unlock';
                          } else if (isTransitiveUnlock) {
                            stateClass =
                              'is-unlock-transitive dag-node--unlock dag-node--unlock-chain dag-node--related';
                            degreeAttr = '2nd-unlock';
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
                              data-degree={degreeAttr}
                              data-role={
                                isSelected
                                  ? 'selected'
                                  : isDirectPrereq
                                    ? 'prereq-direct'
                                    : isTransitivePrereq
                                      ? 'prereq-transitive'
                                      : isDirectUnlock
                                        ? 'unlock-direct'
                                        : isTransitiveUnlock
                                          ? 'unlock-transitive'
                                          : 'unrelated'
                              }
                              className={`dag-node dag-node-card ${stateClass}`}
                              onClick={() => setSelectedCourseCode(node.code)}
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
                                  ) : isDirectPrereq ? (
                                    <span className="dag-role-badge dag-role-badge--prereq px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/15 text-[#B85D00]">
                                      Prerrequisito
                                    </span>
                                  ) : isTransitivePrereq ? (
                                    <span className="dag-role-badge dag-role-badge--prereq-transitive px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/10 text-[#B85D00]">
                                      Ruta previa
                                    </span>
                                  ) : isDirectUnlock ? (
                                    <span className="dag-role-badge dag-role-badge--unlock px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-[#0D7A4E]">
                                      Se desbloquea
                                    </span>
                                  ) : isTransitiveUnlock ? (
                                    <span className="dag-role-badge dag-role-badge--unlock-transitive px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-[#0D7A4E]">
                                      Ruta posterior
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
                                  {unlocks.length > 0 ? (
                                    <span className="swiss-btn-inline">
                                      <ArrowRight size={11} strokeWidth={2.4} aria-hidden="true" />
                                      <span>{unlocks.length}</span>
                                    </span>
                                  ) : ''}
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
            </div>
          </section>
        </main>
    </div>
  );
};

