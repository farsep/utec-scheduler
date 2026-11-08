import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface TimeBlockerGridProps {
  blockedMask: bigint[];
  onChange: (newMask: bigint[]) => void;
  hoveredMask?: bigint[] | null;
  courseBlocks?: { dayIdx: number; startSlot: number; endSlot: number; color: string; title: string; subtitle: string; }[];
  pinnedBlocks?: {
    dayIdx: number; startSlot: number; endSlot: number;
    color: string; title: string; subtitle: string;
    density?: number;
    isParent?: boolean;
  }[];
  pinnedMask?: bigint[];
  courseViabilityMasks?: Record<string, bigint[][]>;
}

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const START_HOUR = 7;
const END_HOUR = 22;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR);
const SLOT_PX = 10; // 40px/hour ÷ 4 slots/hour
const GRID_PAD_TOP = 10; // matches paddingTop on scroll container

interface TimeBlock {
  dayIdx: number;
  startSlot: number;
  endSlot: number;
}

function getBlocksFromMask(mask: bigint[]): TimeBlock[] {
  const blocks: TimeBlock[] = [];
  for (let d = 0; d < mask.length; d++) {
    let start = -1;
    for (let s = 0; s < 60; s++) {
      const set = (mask[d] & (1n << BigInt(s))) !== 0n;
      if (set && start === -1) start = s;
      else if (!set && start !== -1) { blocks.push({ dayIdx: d, startSlot: start, endSlot: s - 1 }); start = -1; }
    }
    if (start !== -1) blocks.push({ dayIdx: d, startSlot: start, endSlot: 59 });
  }
  return blocks;
}

type Drag =
  | { kind: 'idle' }
  | { kind: 'creating';    dayIdx: number; anchorSlot: number; currentSlot: number }
  | { kind: 'resize-top';  dayIdx: number; origStart: number;  origEnd: number; currentSlot: number }
  | { kind: 'resize-bot';  dayIdx: number; origStart: number;  origEnd: number; currentSlot: number };

export const TimeBlockerGrid: React.FC<TimeBlockerGridProps> = ({
  blockedMask, onChange, hoveredMask,
  courseBlocks = [], pinnedBlocks = [],
  pinnedMask, courseViabilityMasks,
}) => {
  const [drag, setDrag] = useState<Drag>({ kind: 'idle' });
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Viability & pin guards ────────────────────────────────────────────────
  const isMaskViable = useCallback((mask: bigint[]): boolean => {
    if (!courseViabilityMasks) return true;
    return Object.values(courseViabilityMasks).every(sectionMasks =>
      sectionMasks.length === 0 ||
      sectionMasks.some(secMask => secMask.every((dm, d) => (mask[d] & dm) === 0n))
    );
  }, [courseViabilityMasks]);

  const isPinned = useCallback((d: number, s: number) =>
    !!pinnedMask && (pinnedMask[d] & (1n << BigInt(s))) !== 0n,
  [pinnedMask]);

  // Apply slots to mask with viability + pin guard
  const applySlots = useCallback((base: bigint[], d: number, from: number, to: number, block: boolean): bigint[] => {
    const m = [...base];
    for (let i = from; i <= to; i++) {
      if (block) {
        if (isPinned(d, i)) continue;
        const test = [...m]; test[d] |= (1n << BigInt(i));
        if (isMaskViable(test)) m[d] |= (1n << BigInt(i));
      } else {
        m[d] &= ~(1n << BigInt(i));
      }
    }
    return m;
  }, [isPinned, isMaskViable]);

  // ── Display mask (live during drag) ──────────────────────────────────────
  const displayMask = useMemo((): bigint[] => {
    if (drag.kind === 'idle') return blockedMask;
    const base = [...blockedMask];

    if (drag.kind === 'creating') {
      // anchorSlot = hourStart of initial click; anchor always occupies a full hour.
      // Cursor above anchor → extend upward:   block = [currentSlot, anchorSlot+3]
      // Cursor at/below anchor → extend down:  block = [anchorSlot,  currentSlot]
      const anchorEnd = Math.min(drag.anchorSlot + 3, 59);
      const blockStart = drag.currentSlot < drag.anchorSlot ? drag.currentSlot : drag.anchorSlot;
      const blockEnd   = drag.currentSlot < drag.anchorSlot ? anchorEnd          : drag.currentSlot;
      return applySlots(base, drag.dayIdx, blockStart, blockEnd, true);
    }
    if (drag.kind === 'resize-top') {
      const newStart = Math.min(Math.max(drag.currentSlot, 0), drag.origEnd);
      const cleared = applySlots(base, drag.dayIdx, drag.origStart, drag.origEnd, false);
      return applySlots(cleared, drag.dayIdx, newStart, drag.origEnd, true);
    }
    if (drag.kind === 'resize-bot') {
      const newEnd = Math.max(Math.min(drag.currentSlot, 59), drag.origStart);
      const cleared = applySlots(base, drag.dayIdx, drag.origStart, drag.origEnd, false);
      return applySlots(cleared, drag.dayIdx, drag.origStart, newEnd, true);
    }
    return base;
  }, [blockedMask, drag, applySlots]);

  // ── Commit on release ─────────────────────────────────────────────────────
  const commit = useCallback(() => {
    if (drag.kind !== 'idle') {
      onChange(displayMask);
      setDrag({ kind: 'idle' });
    }
  }, [drag.kind, displayMask, onChange]);

  // Listen for mouseup anywhere (handles drag released outside grid)
  useEffect(() => {
    window.addEventListener('mouseup', commit);
    return () => window.removeEventListener('mouseup', commit);
  }, [commit]);

  // ── Y → slot index (for window mousemove during resize) ──────────────────
  const slotFromClientY = useCallback((clientY: number): number => {
    if (!scrollRef.current) return 0;
    const rect = scrollRef.current.getBoundingClientRect();
    const y = clientY - rect.top + scrollRef.current.scrollTop - GRID_PAD_TOP;
    return Math.max(0, Math.min(59, Math.floor(y / SLOT_PX)));
  }, []);

  // ── Global mousemove: tracks slot for ALL drag modes ────────────────────
  // We use a ref so the handler always reads fresh drag state without
  // needing to re-register on every state change (avoids stale closures).
  const dragRef = useRef<Drag>({ kind: 'idle' });
  useEffect(() => { dragRef.current = drag; }, [drag]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const d = dragRef.current;
      if (d.kind === 'idle') return;

      const rawSlot = slotFromClientY(e.clientY);

      if (d.kind === 'creating') {
        // Snap to hour boundary; decide direction relative to anchor
        const hourStart = Math.floor(rawSlot / 4) * 4;
        const hourEnd   = Math.min(hourStart + 3, 59);
        // Cursor above anchor → block grows upward: currentSlot = top of that hour
        // Cursor at/below    → block grows downward: currentSlot = bottom of that hour
        const newCurrent = hourEnd < d.anchorSlot ? hourStart : hourEnd;
        setDrag(prev => prev.kind === 'creating' ? { ...prev, currentSlot: newCurrent } : prev);
      } else {
        // resize-top / resize-bot: just track the raw slot
        setDrag(prev => prev.kind === 'idle' ? prev : { ...prev, currentSlot: rawSlot });
      }
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, [slotFromClientY]); // only slotFromClientY needed; drag state is read via ref

  // ── Cell event handlers (creating mode) ──────────────────────────────────
  const handleCellDown = (dayIdx: number, slotIdx: number) => {
    if (isPinned(dayIdx, slotIdx)) return;
    // Snap to the full 1-hour row the click lands in
    const hourStart = Math.floor(slotIdx / 4) * 4;
    const hourEnd   = Math.min(hourStart + 3, 59);
    setDrag({ kind: 'creating', dayIdx, anchorSlot: hourStart, currentSlot: hourEnd });
  };

  // ── Delete a block by clicking its body ──────────────────────────────────
  const deleteBlock = (block: TimeBlock) => {
    const m = [...blockedMask];
    for (let i = block.startSlot; i <= block.endSlot; i++) m[block.dayIdx] &= ~(1n << BigInt(i));
    onChange(m);
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const blockedBlocks = useMemo(() => getBlocksFromMask(displayMask), [displayMask]);
  const ghostBlocks   = useMemo(() => hoveredMask ? getBlocksFromMask(hoveredMask) : [], [hoveredMask]);

  const isSlotBlocked = useCallback((d: number, s: number) =>
    (displayMask[d] & (1n << BigInt(s))) !== 0n,
  [displayMask]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes pulse-ghost {
          0% { opacity: 0.4; } 50% { opacity: 0.8; } 100% { opacity: 0.4; }
        }
        .tbg-resize-handle { opacity: 0.85; transition: opacity 0.15s, background 0.15s; }
        .tbg-resize-handle:hover { opacity: 1 !important; background: rgba(168,32,50,0.28) !important; }
        .tbg-block-body { opacity: 0.96; transition: opacity 0.15s; }
        .tbg-block-body:hover { opacity: 1; }
      `}</style>

      <div
        className="time-blocker-grid"
        style={{
          userSelect: 'none',
          background: 'var(--bg-surface)',
          borderRadius: '0px',
          border: '1px solid #18181A',
          borderTop: '2px solid #18181A',
          overflow: 'hidden',
          padding: '16px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
        onMouseLeave={commit}
      >
        {/* Day headers */}
        <div style={{ display: 'flex', marginBottom: '0px', background: '#DCD9D2', border: '1px solid #C6C3BB', borderBottom: '1px solid #18181A' }}>
          <div style={{ width: '50px', borderRight: '1px solid #C6C3BB', padding: '6px 4px', fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: '#4A4946', textAlign: 'center', fontWeight: 700 }}>HORA</div>
          {DAYS.map((day, idx) => (
            <div
              key={day}
              className="tbg-day-header"
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: '0.82rem',
                fontFamily: 'var(--font-heading)',
                color: '#141416',
                fontWeight: 700,
                padding: '6px 4px',
                borderLeft: idx === 0 ? '1px solid #C6C3BB' : 'none',
                borderRight: '1px solid #C6C3BB',
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} style={{ position: 'relative', flex: 1, overflowY: 'auto', paddingBottom: '20px', paddingTop: `${GRID_PAD_TOP}px`, borderLeft: '1px solid #C6C3BB', borderRight: '1px solid #C6C3BB', borderBottom: '1px solid #C6C3BB' }}>
          <div style={{ position: 'relative', height: `${HOURS.length * 40}px` }}>

            {/* Hour gridlines + labels */}
            {HOURS.map((hour, idx) => (
              <div key={hour} style={{ position: 'absolute', top: `${idx * 40}px`, left: 0, width: '100%', height: '40px', display: 'flex', pointerEvents: 'none' }}>
                <div style={{ width: '50px', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: '#4A4946', fontWeight: 600, textAlign: 'right', paddingRight: '8px', transform: 'translateY(-6px)' }}>
                  {String(hour).padStart(2, '0')}:00
                </div>
                <div className="tbg-hour-row-line" style={{ flex: 1, borderTop: '1px solid #D4D1C9', borderBottom: '1px solid #D4D1C9' }} />
              </div>
            ))}

            {/* ── Non-interactive decoration layers ── */}
            <div style={{ position: 'absolute', top: 0, left: '50px', right: 0, bottom: 0, pointerEvents: 'none' }}>

              {/* Blocked-section course blocks (striped) */}
              {courseBlocks.map((b, i) => (
                <div key={`course-${i}`} style={{
                  position: 'absolute',
                  left: `calc(${(b.dayIdx * 100) / 6}% + 2px)`,
                  width: `calc(${100 / 6}% - 4px)`,
                  top: `${(b.startSlot / 4) * 40}px`,
                  height: `${((b.endSlot - b.startSlot + 1) / 4) * 40}px`,
                  background: `repeating-linear-gradient(-45deg, #F4E0E2, #F4E0E2 6px, #EBD0D3 6px, #EBD0D3 12px)`,
                  border: `1px solid #A82032`,
                  borderLeft: `3px solid #A82032`,
                  borderRadius: '0px',
                  boxSizing: 'border-box',
                  zIndex: 2,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px',
                }}>
                  <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#520D17', textAlign: 'center' }}>{b.title}</div>
                  <div style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', textAlign: 'center', color: '#751523' }}>{b.subtitle}</div>
                </div>
              ))}

              {/* Hovered ghost blocks (preview) */}
              {ghostBlocks.map((b, i) => (
                <div key={`ghost-${i}`} style={{
                  position: 'absolute',
                  left: `calc(${(b.dayIdx * 100) / 6}% + 2px)`,
                  width: `calc(${100 / 6}% - 4px)`,
                  top: `${(b.startSlot / 4) * 40}px`,
                  height: `${((b.endSlot - b.startSlot + 1) / 4) * 40}px`,
                  background: 'rgba(0, 119, 158, 0.22)',
                  border: '1.5px solid #00779E',
                  borderRadius: '0px',
                  zIndex: 2,
                  animation: 'pulse-ghost 2s infinite ease-in-out',
                }} />
              ))}

              {/* Pinned / selected-course ghost blocks */}
              {pinnedBlocks.map((b, i) => {
                const h = ((b.endSlot - b.startSlot + 1) / 4) * 40;
                const density  = b.density  ?? 0.5;
                const isParent = b.isParent ?? (density >= 0.75);
                const isLocked = b.subtitle?.startsWith('🔒');
                const bw  = isLocked ? '2px'  : isParent ? '1.5px' : '1px';
                const op  = isLocked ? 1      : isParent ? 0.9     : 0.7;
                return (
                  <div key={`pinned-${i}`} style={{
                    position: 'absolute',
                    left: `calc(${(b.dayIdx * 100) / 6}% + 2px)`,
                    width: `calc(${100 / 6}% - 4px)`,
                    top: `${(b.startSlot / 4) * 40}px`,
                    height: `${h}px`,
                    background: '#E0EBF5',
                    border: `${bw} dashed #006699`,
                    borderLeft: '3px solid #006699',
                    borderRadius: '0px',
                    boxSizing: 'border-box',
                    zIndex: 4,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: '1px', overflow: 'hidden', opacity: op,
                  }}>
                    {h > 24 && <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0A2E46', textAlign: 'center' }}>{b.title}</span>}
                    {h > 44 && <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-mono)', color: '#005A78', textAlign: 'center' }}>{b.subtitle}</span>}
                  </div>
                );
              })}
            </div>

            {/* ── Interactive blocked blocks (Orthogonal 0px Swiss Restriction Blocks) ── */}
            <div style={{ position: 'absolute', top: 0, left: '50px', right: 0, bottom: 0, pointerEvents: 'none' }}>
              {blockedBlocks.map((block, i) => {
                const h = ((block.endSlot - block.startSlot + 1) / 4) * 40;
                const startMins = START_HOUR * 60 + block.startSlot * 15;
                const endMins = START_HOUR * 60 + (block.endSlot + 1) * 15;
                const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
                return (
                  <div
                    key={`block-${i}`}
                    className="tbg-blocked-slot"
                    style={{
                      position: 'absolute',
                      left: `calc(${(block.dayIdx * 100) / 6}% + 2px)`,
                      width: `calc(${100 / 6}% - 4px)`,
                      top: `${(block.startSlot / 4) * 40}px`,
                      height: `${h}px`,
                      backgroundColor: '#F4E0E2',
                      backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, rgba(168,32,50,0.08) 6px, rgba(168,32,50,0.08) 12px)',
                      border: '1.5px solid #A82032',
                      borderLeft: '4px solid #A82032',
                      borderRadius: '0px',
                      boxShadow: 'none',
                      zIndex: 6,
                      pointerEvents: 'auto',
                      boxSizing: 'border-box',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                    }}
                  >
                    {/* ↑ Top resize handle */}
                    <div
                      className="tbg-resize-handle"
                      onMouseDown={(e) => {
                        e.stopPropagation(); e.preventDefault();
                        setDrag({ kind: 'resize-top', dayIdx: block.dayIdx, origStart: block.startSlot, origEnd: block.endSlot, currentSlot: block.startSlot });
                      }}
                      style={{
                        height: '6px', flexShrink: 0, cursor: 'ns-resize',
                        background: 'rgba(168,32,50,0.16)',
                      }}
                    />

                    {/* Block body — click to delete */}
                    <div
                      className="tbg-block-body"
                      onMouseDown={(e) => {
                        e.stopPropagation(); e.preventDefault();
                        deleteBlock(block);
                      }}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                        flexDirection: 'column', gap: '2px',
                        padding: '2px 4px',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#520D17',
                          lineHeight: 1.1,
                          textAlign: 'center',
                        }}
                      >
                        BLOQUEADO
                      </span>
                      {h >= 38 && (
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '10px',
                            fontWeight: 600,
                            color: '#751523',
                            lineHeight: 1,
                          }}
                        >
                          {fmt(startMins)}–{fmt(endMins)}
                        </span>
                      )}
                    </div>

                    {/* ↓ Bottom resize handle */}
                    <div
                      className="tbg-resize-handle"
                      onMouseDown={(e) => {
                        e.stopPropagation(); e.preventDefault();
                        setDrag({ kind: 'resize-bot', dayIdx: block.dayIdx, origStart: block.startSlot, origEnd: block.endSlot, currentSlot: block.endSlot });
                      }}
                      style={{
                        height: '6px', flexShrink: 0, cursor: 'ns-resize',
                        background: 'rgba(168,32,50,0.16)',
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* ── Transparent interactive cell grid (z-8, click-to-create) with explicit vertical & horizontal Swiss lines ── */}
            <div style={{ display: 'flex', position: 'absolute', top: 0, left: '50px', right: 0, bottom: 0, zIndex: 8, pointerEvents: 'none' }}>
              {DAYS.map((_, dayIdx) => (
                <div
                  key={dayIdx}
                  className="tbg-day-column"
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    borderLeft: dayIdx === 0 ? '1px solid #C6C3BB' : 'none',
                    borderRight: '1px solid #C6C3BB',
                    pointerEvents: 'none',
                  }}
                >
                  {Array.from({ length: 60 }).map((_, slotIdx) => {
                    const blocked = isSlotBlocked(dayIdx, slotIdx);
                    const pinned  = isPinned(dayIdx, slotIdx);
                    return (
                      <div
                        key={slotIdx}
                        className="tbg-slot-cell"
                        onMouseDown={() => handleCellDown(dayIdx, slotIdx)}
                        style={{
                          height: `${SLOT_PX}px`,
                          flexShrink: 0,
                          pointerEvents: (blocked || pinned) ? 'none' : 'auto',
                          cursor: 'default',
                          borderBottom: slotIdx % 4 === 3 ? '1px solid #D4D1C9' : 'none',
                          borderRight: '1px solid #C6C3BB',
                          boxSizing: 'border-box',
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </>
  );
};
