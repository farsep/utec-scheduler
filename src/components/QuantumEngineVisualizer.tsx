import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  getGraftonPigment,
  getGraftonBlockBackground,
  GRAFTON_PIGMENTS,
} from '../utils/graftonPigments';

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

const FALLBACK_COURSES = ['CS2013', 'CS2023', 'CC1105', 'CS2041', 'CC1104', 'CS2031', 'CS5352', 'CC1103'];
const DAYS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const HOURS = ['07:00', '09:00', '11:00', '13:00', '15:00', '17:00', '19:00'];

const NEUTRAL_CUBE_CELLS = ['#FAF9F5', '#18181A'] as const;

interface OscilloscopeSlot {
  id: string;
  courseCode: string;
  isPinned: boolean;
  dayCol: number; // 1..6 (gridColumn = dayCol + 1)
  rowStart: number; // 1..7
  rowSpan: number; // 1..2
  visualState: 'test' | 'clash' | 'ok';
}

interface CandidateFrame {
  frameId: number;
  slots: OscilloscopeSlot[];
  cubeColors: string[];
  bitmasks: Array<{ day: string; bits: string }>;
  hasActiveClash: boolean;
}

function randomInt(min: number, maxInclusive: number): number {
  return Math.floor(Math.random() * (maxInclusive - min + 1)) + min;
}

function sampleCourseCodes(
  poolCourses: string[],
  pinnedCourses: string[],
  count: number
): string[] {
  const source = poolCourses.length > 0 ? poolCourses : FALLBACK_COURSES;
  const picked: string[] = [];
  const used = new Set<string>();

  // Include a random subset of pinned courses so anchored subjects remain represented
  if (pinnedCourses.length > 0) {
    const shuffledPinned = [...pinnedCourses].sort(() => Math.random() - 0.5);
    const maxPinned = Math.min(shuffledPinned.length, Math.max(1, Math.floor(count / 2)));
    for (let i = 0; i < maxPinned; i++) {
      const code = shuffledPinned[i];
      if (!used.has(code)) {
        used.add(code);
        picked.push(code);
      }
    }
  }

  // Pick remaining courses randomly from the full pool without repeating in the same frame
  let guard = 0;
  while (picked.length < count && guard < count * 6) {
    guard++;
    const candidate = source[Math.floor(Math.random() * source.length)];
    if (!used.has(candidate) || used.size >= source.length) {
      used.add(candidate);
      picked.push(candidate);
    }
  }

  return picked;
}

function generateRandomCubeColors(slots?: OscilloscopeSlot[]): string[] {
  const slotBars = slots && slots.length > 0
    ? slots.map((s) => getGraftonPigment(s.courseCode).bar)
    : GRAFTON_PIGMENTS.slice(0, 6).map((p) => p.bar);
  const palette = [...slotBars, ...NEUTRAL_CUBE_CELLS];
  return Array.from({ length: 9 }, () => palette[Math.floor(Math.random() * palette.length)]);
}

function generateRandomCandidateFrame(
  frameId: number,
  poolCourses: string[],
  pinnedCourses: string[],
  forceValid: boolean
): CandidateFrame {
  const slotCount = randomInt(5, 8);
  const chosenCodes = sampleCourseCodes(poolCourses, pinnedCourses, slotCount);
  const pinnedSet = new Set(pinnedCourses);

  // 6 days x 7 time rows occupancy tracker
  const occupied: boolean[][] = Array.from({ length: 6 }, () => Array(7).fill(false));
  const shouldInjectClash = !forceValid && Math.random() < 0.55;
  const baseTarget = shouldInjectClash ? Math.max(4, slotCount - 1) : slotCount;

  const slots: OscilloscopeSlot[] = [];

  for (let i = 0; i < baseTarget; i++) {
    const courseCode = chosenCodes[i % chosenCodes.length];
    let placed = false;

    for (let attempt = 0; attempt < 24; attempt++) {
      const dayIdx = Math.floor(Math.random() * 6);
      const rowSpan = Math.random() < 0.72 ? 2 : 1;
      const maxStart = 7 - rowSpan; // 0-indexed max start (0..5 for span 2, 0..6 for span 1)
      const rowIdx = randomInt(0, maxStart);

      let free = true;
      for (let r = rowIdx; r < rowIdx + rowSpan; r++) {
        if (occupied[dayIdx][r]) {
          free = false;
          break;
        }
      }

      if (free) {
        for (let r = rowIdx; r < rowIdx + rowSpan; r++) {
          occupied[dayIdx][r] = true;
        }
        const visualState: 'ok' | 'test' =
          forceValid ? 'ok' : Math.random() < 0.3 ? 'test' : 'ok';

        slots.push({
          id: `f${frameId}-s${i}`,
          courseCode,
          isPinned: pinnedSet.has(courseCode),
          dayCol: dayIdx + 1,
          rowStart: rowIdx + 1,
          rowSpan,
          visualState,
        });
        placed = true;
        break;
      }
    }

    if (!placed && slots.length < 4) {
      // Fallback free single-row scan
      for (let d = 0; d < 6 && !placed; d++) {
        for (let r = 0; r < 7 && !placed; r++) {
          if (!occupied[d][r]) {
            occupied[d][r] = true;
            slots.push({
              id: `f${frameId}-s${i}`,
              courseCode,
              isPinned: pinnedSet.has(courseCode),
              dayCol: d + 1,
              rowStart: r + 1,
              rowSpan: 1,
              visualState: forceValid ? 'ok' : 'test',
            });
            placed = true;
          }
        }
      }
    }
  }

  // Optionally inject 1 (or occasionally 2) colliding branch blocks to showcase bitmask pruning
  let hasActiveClash = false;
  if (shouldInjectClash && slots.length > 0) {
    const clashCount = Math.random() < 0.25 && chosenCodes.length > baseTarget + 1 ? 2 : 1;
    const usedTargets = new Set<number>();

    for (let c = 0; c < clashCount; c++) {
      const targetIdx = Math.floor(Math.random() * slots.length);
      if (usedTargets.has(targetIdx)) continue;
      usedTargets.add(targetIdx);

      const target = slots[targetIdx];
      const clashCode = chosenCodes[(baseTarget + c) % chosenCodes.length];
      // Offset by +1 row when possible so both colliding cards remain readable in the grid
      const shift =
        target.rowStart < 6 ? 1 : target.rowStart > 1 ? -1 : 0;
      const clashRowStart = Math.max(1, Math.min(6, target.rowStart + shift));
      const clashRowSpan = clashRowStart <= 6 ? 2 : 1;

      const dayIdx = target.dayCol - 1;
      for (let r = clashRowStart - 1; r < Math.min(7, clashRowStart - 1 + clashRowSpan); r++) {
        occupied[dayIdx][r] = true;
      }

      slots.push({
        id: `f${frameId}-clash${c}`,
        courseCode: clashCode,
        isPinned: pinnedSet.has(clashCode),
        dayCol: target.dayCol,
        rowStart: clashRowStart,
        rowSpan: clashRowSpan,
        visualState: 'clash',
      });
      hasActiveClash = true;
    }
  }

  // Derive 8-bit daily bitmask registers directly from the occupied schedule rows
  const bitmasks = DAYS.map((day, dIdx) => {
    let mask = 0;
    for (let r = 0; r < 7; r++) {
      if (occupied[dIdx][r]) {
        mask |= 1 << (7 - r);
      }
    }
    if (hasActiveClash && slots.some((s) => s.dayCol === dIdx + 1 && s.visualState === 'clash')) {
      mask |= 1;
    }
    return {
      day,
      bits: mask.toString(2).padStart(8, '0'),
    };
  });

  return {
    frameId,
    slots,
    cubeColors: generateRandomCubeColors(slots),
    bitmasks,
    hasActiveClash,
  };
}

export const QuantumEngineVisualizer: React.FC<QuantumEngineVisualizerProps> = ({
  evalProgress,
  selectedCourseCodes,
  pinnedCourses,
}) => {
  const poolCourses = useMemo(() => {
    return selectedCourseCodes.length > 0 ? selectedCourseCodes : FALLBACK_COURSES;
  }, [selectedCourseCodes]);

  const frameCounterRef = useRef(1);
  const latestInputsRef = useRef({
    poolCourses,
    pinnedCourses,
    isComplete: Boolean(evalProgress?.isComplete),
  });
  latestInputsRef.current = {
    poolCourses,
    pinnedCourses,
    isComplete: Boolean(evalProgress?.isComplete),
  };

  const [animState, setAnimState] = useState<{
    tick: number;
    candidateFrame: CandidateFrame;
  }>(() => ({
    tick: 0,
    candidateFrame: generateRandomCandidateFrame(
      0,
      poolCourses,
      pinnedCourses,
      Boolean(evalProgress?.isComplete)
    ),
  }));

  useEffect(() => {
    const id = window.setInterval(() => {
      const { poolCourses: pool, pinnedCourses: pinned, isComplete } = latestInputsRef.current;
      setAnimState((prev) => {
        const nextTick = prev.tick + 1;
        if (nextTick % 2 === 0) {
          const nextFrameId = frameCounterRef.current++;
          return {
            tick: nextTick,
            candidateFrame: generateRandomCandidateFrame(nextFrameId, pool, pinned, isComplete),
          };
        }
        return {
          tick: nextTick,
          candidateFrame: {
            ...prev.candidateFrame,
            cubeColors: generateRandomCubeColors(prev.candidateFrame.slots),
          },
        };
      });
    }, 85);
    return () => window.clearInterval(id);
  }, []);

  // Ensure completion immediately locks onto a clean clash-free candidate frame
  useEffect(() => {
    if (evalProgress?.isComplete) {
      const nextFrameId = frameCounterRef.current++;
      setAnimState((prev) => ({
        ...prev,
        candidateFrame: generateRandomCandidateFrame(
          nextFrameId,
          poolCourses,
          pinnedCourses,
          true
        ),
      }));
    }
  }, [evalProgress?.isComplete, poolCourses, pinnedCourses]);

  const { tick, candidateFrame } = animState;

  // Smooth live telemetry metrics synced with real worker progress
  const realEvaluated = evalProgress?.evaluated ?? 0;
  const realValid = evalProgress?.validFound ?? 0;
  const realElapsed = Math.max(evalProgress?.elapsedMs ?? 0, (tick + 1) * 85);
  const totalPoolComb = evalProgress?.totalCombinations ?? Math.max(realEvaluated, 1480);

  const animatedEvaluated =
    realEvaluated > 0 ? realEvaluated : Math.min(totalPoolComb, 128 + tick * 247);
  const throughput = Math.round((animatedEvaluated / Math.max(realElapsed, 45)) * 1000);
  const prunedCount = Math.max(0, animatedEvaluated - realValid);
  const validDisplay = realValid > 0 ? realValid : Math.min(50, Math.floor(tick * 3.4));

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

  const { slots: activeSlots, cubeColors, bitmasks, hasActiveClash } = candidateFrame;

  return (
    <div className="quantum-visualizer-shell" data-testid="quantum-engine-visualizer">
      {/* 1. Top Architectural Header & 3x3 Quantum Permutation Cube */}
      <div className="quantum-header-bar">
        <div className="quantum-header-left">
          <div className="quantum-cube-grid" aria-hidden="true">
            {cubeColors.map((cellColor, idx) => (
              <span
                key={idx}
                className="quantum-cube-cell"
                style={{ backgroundColor: cellColor }}
              />
            ))}
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
          {activeSlots.map((slot) => {
            const pigment = getGraftonPigment(slot.courseCode);
            const isClash = slot.visualState === 'clash';
            const isTest = slot.visualState === 'test';
            const tagText = isClash
              ? '[CRUCE X]'
              : isTest
              ? '[TEST]'
              : '[OK ✓]';

            const borderLine = isClash
              ? '1.5px solid #A82032'
              : `1.5px ${isTest ? 'dashed' : 'solid'} ${pigment.border}`;

            return (
              <div
                key={slot.id}
                className={`quantum-block state-${slot.visualState} ${slot.isPinned ? 'is-pinned' : ''}`}
                style={{
                  gridColumn: slot.dayCol + 1,
                  gridRow: `${slot.rowStart} / span ${slot.rowSpan}`,
                  background: isClash
                    ? 'repeating-linear-gradient(45deg, #F4E0E2, #F4E0E2 4px, #E8C5C9 4px, #E8C5C9 8px)'
                    : getGraftonBlockBackground(pigment, isTest),
                  borderRight: borderLine,
                  borderBottom: borderLine,
                  borderTop: slot.isPinned ? '2.5px solid #B85D00' : borderLine,
                  borderLeft: `3.5px solid ${pigment.bar}`,
                  color: isClash ? '#520D17' : pigment.text,
                }}
              >
                <span className="quantum-block-code">{slot.courseCode}</span>
                <span
                  className="quantum-block-tag"
                  style={{ color: isClash ? '#A82032' : pigment.subtext }}
                >
                  {tagText}
                </span>
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
