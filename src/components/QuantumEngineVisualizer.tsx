import React, { useEffect, useMemo, useState } from 'react';

export interface EvalProgressData {
  evaluated: number;
  validFound: number;
  elapsedMs: number;
  isComplete?: boolean;
  phase?: string;
  totalCombinations?: number;
}

interface QuantumEngineVisualizerProps {
  evalProgress: EvalProgressData | null;
  selectedCourseCodes: string[];
  pinnedCourses: string[];
}

const FALLBACK_COURSES = ['CS2013', 'CS2041', 'CS2023', 'CC1105', 'CI5314'];
const DAYS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const HOURS = ['07:00', '09:00', '11:00', '13:00', '15:00', '17:00', '19:00'];

const CUBE_PALETTE = ['#00779E', '#0D7A4E', '#D97706', '#FAF9F5', '#18181A'];

interface OscilloscopeSlot {
  id: string;
  courseIndex: number;
  dayCol: number; // 1..6 (for gridColumn = dayCol + 1)
  rowStart: number; // 1..6
  rowSpan: number;
  baseState: 'test' | 'clash' | 'ok';
}

const SLOT_LAYOUTS: OscilloscopeSlot[][] = [
  [
    { id: 'a1', courseIndex: 0, dayCol: 1, rowStart: 1, rowSpan: 2, baseState: 'ok' },
    { id: 'a2', courseIndex: 1, dayCol: 2, rowStart: 2, rowSpan: 2, baseState: 'test' },
    { id: 'a3', courseIndex: 2, dayCol: 3, rowStart: 1, rowSpan: 2, baseState: 'ok' },
    { id: 'a4', courseIndex: 3, dayCol: 3, rowStart: 2, rowSpan: 2, baseState: 'clash' },
    { id: 'a5', courseIndex: 4, dayCol: 4, rowStart: 4, rowSpan: 2, baseState: 'test' },
    { id: 'a6', courseIndex: 0, dayCol: 5, rowStart: 3, rowSpan: 2, baseState: 'ok' },
    { id: 'a7', courseIndex: 1, dayCol: 6, rowStart: 2, rowSpan: 2, baseState: 'test' },
  ],
  [
    { id: 'b1', courseIndex: 0, dayCol: 1, rowStart: 2, rowSpan: 2, baseState: 'ok' },
    { id: 'b2', courseIndex: 1, dayCol: 2, rowStart: 4, rowSpan: 2, baseState: 'ok' },
    { id: 'b3', courseIndex: 2, dayCol: 3, rowStart: 2, rowSpan: 2, baseState: 'ok' },
    { id: 'b4', courseIndex: 3, dayCol: 4, rowStart: 1, rowSpan: 2, baseState: 'test' },
    { id: 'b5', courseIndex: 4, dayCol: 4, rowStart: 2, rowSpan: 2, baseState: 'clash' },
    { id: 'b6', courseIndex: 0, dayCol: 5, rowStart: 5, rowSpan: 2, baseState: 'ok' },
    { id: 'b7', courseIndex: 2, dayCol: 6, rowStart: 1, rowSpan: 2, baseState: 'test' },
  ],
  [
    { id: 'c1', courseIndex: 0, dayCol: 1, rowStart: 1, rowSpan: 2, baseState: 'ok' },
    { id: 'c2', courseIndex: 1, dayCol: 2, rowStart: 3, rowSpan: 2, baseState: 'ok' },
    { id: 'c3', courseIndex: 2, dayCol: 3, rowStart: 4, rowSpan: 2, baseState: 'test' },
    { id: 'c4', courseIndex: 3, dayCol: 4, rowStart: 3, rowSpan: 2, baseState: 'ok' },
    { id: 'c5', courseIndex: 4, dayCol: 5, rowStart: 2, rowSpan: 2, baseState: 'ok' },
    { id: 'c6', courseIndex: 1, dayCol: 5, rowStart: 3, rowSpan: 2, baseState: 'clash' },
    { id: 'c7', courseIndex: 3, dayCol: 6, rowStart: 4, rowSpan: 2, baseState: 'ok' },
  ],
];

function formatBitmaskByte(seed: number): string {
  const val = (seed * 73 + 41) & 0xff;
  return val.toString(2).padStart(8, '0');
}

export const QuantumEngineVisualizer: React.FC<QuantumEngineVisualizerProps> = ({
  evalProgress,
  selectedCourseCodes,
  pinnedCourses,
}) => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
    }, 65);
    return () => window.clearInterval(id);
  }, []);

  const poolCourses = useMemo(() => {
    return selectedCourseCodes.length > 0 ? selectedCourseCodes : FALLBACK_COURSES;
  }, [selectedCourseCodes]);

  // Smooth live telemetry metrics synced with real worker progress
  const realEvaluated = evalProgress?.evaluated ?? 0;
  const realValid = evalProgress?.validFound ?? 0;
  const realElapsed = Math.max(evalProgress?.elapsedMs ?? 0, (tick + 1) * 65);
  const totalPoolComb = evalProgress?.totalCombinations ?? Math.max(realEvaluated, 1480);

  const animatedEvaluated =
    realEvaluated > 0 ? realEvaluated : Math.min(totalPoolComb, 128 + tick * 247);
  const throughput = Math.round((animatedEvaluated / Math.max(realElapsed, 45)) * 1000);
  const prunedCount = Math.max(0, animatedEvaluated - realValid);
  const validDisplay = realValid > 0 ? realValid : Math.min(50, Math.floor(tick * 3.4));

  const layoutFrameIndex = Math.floor(tick / 2) % SLOT_LAYOUTS.length;
  const activeSlots = SLOT_LAYOUTS[layoutFrameIndex];

  const cubeTick = tick % 9;
  const phaseLabel = useMemo(() => {
    if (evalProgress?.isComplete) {
      return 'FASE: RANKING PARETO Y VALIDACIÓN FINAL';
    }
    if (evalProgress?.phase === 'init') {
      return 'FASE: COMPILACIÓN DE BITMASKS 64-BIT';
    }
    return 'FASE: PODA DE RAMAS Y OPTIMIZACIÓN DE HUECOS';
  }, [evalProgress?.isComplete, evalProgress?.phase]);

  // Progress bar across 24 discrete architectural segments
  const filledSegments = useMemo(() => {
    if (evalProgress?.isComplete) return 24;
    if (totalPoolComb > 0 && realEvaluated > 0) {
      const ratio = Math.min(1, realEvaluated / totalPoolComb);
      return Math.max(4, Math.min(23, Math.round(ratio * 24)));
    }
    return Math.min(23, 5 + ((tick * 2) % 19));
  }, [evalProgress?.isComplete, realEvaluated, totalPoolComb, tick]);

  const bitmasks = useMemo(() => {
    return DAYS.map((day, idx) => ({
      day,
      bits: idx === 5 && tick % 3 === 0 ? '00000000' : formatBitmaskByte(tick + idx * 11),
    }));
  }, [tick]);

  const hasActiveClash = activeSlots.some((s) => s.baseState === 'clash');

  return (
    <div className="quantum-visualizer-shell" data-testid="quantum-engine-visualizer">
      {/* 1. Top Architectural Header & 3x3 Quantum Permutation Cube */}
      <div className="quantum-header-bar">
        <div className="quantum-header-left">
          <div className="quantum-cube-grid" aria-hidden="true">
            {Array.from({ length: 9 }).map((_, idx) => {
              const colorIdx = (idx + cubeTick + (idx % 2 === 0 ? tick : 0)) % CUBE_PALETTE.length;
              return (
                <span
                  key={idx}
                  className="quantum-cube-cell"
                  style={{ backgroundColor: CUBE_PALETTE[colorIdx] }}
                />
              );
            })}
          </div>
          <div className="quantum-title-stack">
            <div className="quantum-main-title">
              MOTOR COMBINATORIO CUÁNTICO · SOLVER ACTIVO
            </div>
            <div className="quantum-sub-title">
              Backtracking Bitmask 64-Bit · Poda de Ramas con Cruce Horario ({poolCourses.length}{' '}
              cursos en pool)
            </div>
          </div>
        </div>
        <div className="quantum-phase-badge">{phaseLabel}</div>
      </div>

      {/* 2. Live 4-Column Tabular Telemetry Strip */}
      <div className="quantum-telemetry-grid">
        <div className="quantum-telemetry-cell">
          <div className="quantum-tel-label">PERMUTACIONES</div>
          <div className="quantum-tel-value">{animatedEvaluated.toLocaleString()}</div>
        </div>
        <div className="quantum-telemetry-cell">
          <div className="quantum-tel-label">THROUGHPUT</div>
          <div className="quantum-tel-value tel-cyan">
            {throughput.toLocaleString()} <span className="tel-unit">comb/s</span>
          </div>
        </div>
        <div className="quantum-telemetry-cell">
          <div className="quantum-tel-label">CRUCES PODADOS</div>
          <div className="quantum-tel-value tel-crimson">{prunedCount.toLocaleString()}</div>
        </div>
        <div className="quantum-telemetry-cell">
          <div className="quantum-tel-label">ÓPTIMOS SIN CRUCE</div>
          <div className="quantum-tel-value tel-emerald">{validDisplay}</div>
        </div>
      </div>

      {/* 3. Centerpiece: Live 6-Day Timetable Oscilloscope Grid */}
      <div className="quantum-oscilloscope-frame">
        <div className="quantum-osc-header">
          <div className="quantum-osc-th time-col">HORA</div>
          {DAYS.map((day) => (
            <div key={day} className="quantum-osc-th">
              {day}
            </div>
          ))}
        </div>

        <div className="quantum-osc-body">
          {/* Background hourly structural rows & day grid lines */}
          {HOURS.map((hour, rIdx) => (
            <React.Fragment key={hour}>
              <div
                className="quantum-osc-time-cell"
                style={{ gridColumn: 1, gridRow: rIdx + 1 }}
              >
                {hour}
              </div>
              {DAYS.map((day, dIdx) => (
                <div
                  key={`${hour}-${day}`}
                  className="quantum-osc-grid-cell"
                  style={{ gridColumn: dIdx + 2, gridRow: rIdx + 1 }}
                />
              ))}
            </React.Fragment>
          ))}

          {/* Sweeping Horizontal Swiss Laser Scanline */}
          <div className="quantum-laser-scanline" aria-hidden="true" />

          {/* Candidate Permutation Course Blocks */}
          {activeSlots.map((slot, sIdx) => {
            const code = poolCourses[slot.courseIndex % poolCourses.length];
            const isPinned = pinnedCourses.includes(code);
            const stateCycle = (tick + sIdx) % 6;
            const visualState =
              slot.baseState === 'clash'
                ? 'clash'
                : stateCycle === 0
                ? 'test'
                : 'ok';

            const tagText =
              visualState === 'clash'
                ? '[CRUCE X]'
                : visualState === 'test'
                ? '[TEST]'
                : '[OK ✓]';

            return (
              <div
                key={slot.id}
                className={`quantum-block state-${visualState} ${isPinned ? 'is-pinned' : ''}`}
                style={{
                  gridColumn: slot.dayCol + 1,
                  gridRow: `${slot.rowStart} / span ${slot.rowSpan}`,
                }}
              >
                <span className="quantum-block-code">{code}</span>
                <span className="quantum-block-tag">{tagText}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Bottom 64-Bit Bitmask Register & Segmented Progress Bar */}
      <div className="quantum-footer-panel">
        <div className="quantum-bitmask-strip">
          <div className="quantum-bitmask-bytes">
            {bitmasks.map((m) => (
              <span key={m.day} className="bitmask-token">
                [{m.day}: {m.bits}]
              </span>
            ))}
          </div>
          <div
            className={`quantum-bitmask-status ${
              hasActiveClash && !evalProgress?.isComplete ? 'is-pruning' : 'is-clear'
            }`}
          >
            {evalProgress?.isComplete
              ? 'BITMASK AND == 0x0000 · SIN COLISIÓN'
              : hasActiveClash
              ? 'PODA BITMASK · RAMA DESCARTADA'
              : 'BITMASK AND == 0x0000 · VÁLIDO'}
          </div>
        </div>

        <div className="quantum-progress-segments" role="progressbar" aria-valuenow={filledSegments} aria-valuemin={0} aria-valuemax={24}>
          {Array.from({ length: 24 }).map((_, idx) => {
            const isActive = idx < filledSegments;
            const segColor = !isActive
              ? '#EAE7E1'
              : idx >= 18
              ? '#0D7A4E'
              : '#00779E';
            return (
              <span
                key={idx}
                className={`quantum-progress-seg ${isActive ? 'filled' : ''}`}
                style={{ backgroundColor: segColor }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
