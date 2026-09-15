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
        .tbg-resize-handle { opacity: 0.6; transition: opacity 0.15s, background 0.15s; }
        .tbg-resize-handle:hover { opacity: 1 !important; background: rgba(239,68,68,0.6) !important; }
        .tbg-block-body { opacity: 0.85; transition: opacity 0.15s; }
        .tbg-block-body:hover { opacity: 1; }
      `}</style>

      <div
        className="time-blocker-grid"
        style={{
          userSelect: 'none',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          padding: '16px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
        onMouseLeave={commit}
      >
        {/* Day headers */}
        <div style={{ display: 'flex', marginBottom: '8px' }}>
          <div style={{ width: '50px' }} />
          {DAYS.map(day => (
            <div key={day} style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>{day}</div>
          ))}
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} style={{ position: 'relative', flex: 1, overflowY: 'auto', paddingBottom: '20px', paddingTop: `${GRID_PAD_TOP}px` }}>
          <div style={{ position: 'relative', height: `${HOURS.length * 40}px` }}>

            {/* Hour gridlines + labels */}
            {HOURS.map((hour, idx) => (
              <div key={hour} style={{ position: 'absolute', top: `${idx * 40}px`, left: 0, width: '100%', height: '40px', display: 'flex', pointerEvents: 'none' }}>
                <div style={{ width: '50px', fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right', paddingRight: '8px', transform: 'translateY(-6px)' }}>
                  {hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                </div>
                <div style={{ flex: 1, borderTop: '1px solid rgba(255,255,255,0.05)' }} />
              </div>
            ))}

            {/* ── Non-interactive decoration layers ── */}
            <div style={{ position: 'absolute', top: 0, left: '50px', right: 0, bottom: 0, pointerEvents: 'none' }}>

              {/* Blocked-section course blocks (striped) */}
              {courseBlocks.map((b, i) => (
                <div key={`course-${i}`} style={{
                  position: 'absolute',
                  left: `calc(${(b.dayIdx * 100) / 6}% + 4px)`,
                  width: `calc(${100 / 6}% - 8px)`,
                  top: `${(b.startSlot / 4) * 40}px`,
                  height: `${((b.endSlot - b.startSlot + 1) / 4) * 40}px`,
                  background: `repeating-linear-gradient(45deg, ${b.color}20, ${b.color}20 10px, ${b.color}40 10px, ${b.color}40 20px)`,
                  border: `1px solid ${b.color}60`, borderRadius: '6px', boxSizing: 'border-box', zIndex: 2,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px',
                }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 600, color: b.color, textAlign: 'center', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>🚫 {b.title}</div>
                  <div style={{ fontSize: '0.6rem', textAlign: 'center', textShadow: '0 1px 2px rgba(0,0,0,0.8)', color: 'rgba(255,255,255,0.7)' }}>{b.subtitle}</div>
                </div>
              ))}

              {/* Hovered ghost blocks (preview) */}
              {ghostBlocks.map((b, i) => (
                <div key={`ghost-${i}`} style={{
                  position: 'absolute',
                  left: `calc(${(b.dayIdx * 100) / 6}% + 4px)`,
                  width: `calc(${100 / 6}% - 8px)`,
                  top: `${(b.startSlot / 4) * 40}px`,
                  height: `${((b.endSlot - b.startSlot + 1) / 4) * 40}px`,
                  background: 'rgba(59,130,246,0.4)', border: '1px solid rgba(59,130,246,0.8)',
                  borderRadius: '6px', zIndex: 2, animation: 'pulse-ghost 2s infinite ease-in-out',
                }} />
              ))}

              {/* Pinned / selected-course ghost blocks */}
              {pinnedBlocks.map((b, i) => {
                const h = ((b.endSlot - b.startSlot + 1) / 4) * 40;
                const density  = b.density  ?? 0.5;
                const isParent = b.isParent ?? (density >= 0.75);
                const isLocked = b.subtitle?.startsWith('🔒');
                const bw  = isLocked ? '2px'  : isParent ? '1.5px' : '1px';
                const ba  = isLocked ? 'CC'   : isParent ? '88'    : '44';
                const bgA = isLocked ? '28'   : isParent ? '18'    : '0D';
                const op  = isLocked ? 1      : isParent ? 0.85    : 0.55;
                const icon = isLocked ? '🔒'  : isParent ? '🔗'    : '◔';
                return (
                  <div key={`pinned-${i}`} style={{
                    position: 'absolute',
                    left: `calc(${(b.dayIdx * 100) / 6}% + 4px)`,
                    width: `calc(${100 / 6}% - 8px)`,
                    top: `${(b.startSlot / 4) * 40}px`,
                    height: `${h}px`,
                    background: `${b.color}${bgA}`,
                    border: `${bw} dashed ${b.color}${ba}`,
                    borderRadius: '8px', boxSizing: 'border-box', zIndex: 4,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: '1px', overflow: 'hidden', opacity: op,
                  }}>
                    {h > 20 && <span style={{ fontSize: '0.6rem', lineHeight: 1 }}>{icon}</span>}
                    {h > 34 && <span style={{ fontSize: '0.58rem', fontWeight: 700, color: b.color, textShadow: '0 1px 3px rgba(0,0,0,0.9)', textAlign: 'center' }}>{b.title}</span>}
                    {h > 52 && <span style={{ fontSize: '0.5rem', color: b.color, opacity: 0.8, textAlign: 'center' }}>{b.subtitle}</span>}
                  </div>
                );
              })}
            </div>

            {/* ── Interactive blocked blocks (with resize handles) ── */}
            {/* z-index 6: above decoration, below cell grid (z-8 with pass-through for blocked cells) */}
            <div style={{ position: 'absolute', top: 0, left: '50px', right: 0, bottom: 0, pointerEvents: 'none' }}>
              {blockedBlocks.map((block, i) => {
                const h = ((block.endSlot - block.startSlot + 1) / 4) * 40;
                return (
                  <div
                    key={`block-${i}`}
                    style={{
                      position: 'absolute',
                      left: `calc(${(block.dayIdx * 100) / 6}% + 4px)`,
                      width: `calc(${100 / 6}% - 8px)`,
                      top: `${(block.startSlot / 4) * 40}px`,
                      height: `${h}px`,
                      background: 'rgba(239,68,68,0.22)',
                      border: '1px solid rgba(239,68,68,0.55)',
                      borderRadius: '8px',
                      boxShadow: '0 4px 14px rgba(239,68,68,0.1)',
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
                        height: '8px', flexShrink: 0, cursor: 'ns-resize',
                        background: 'rgba(239,68,68,0.35)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <div style={{ width: '18px', height: '2px', background: 'rgba(255,255,255,0.45)', borderRadius: '1px' }} />
                    </div>

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
                        flexDirection: 'column', gap: '4px',
                      }}
                    >
                      {h > 30 && <div style={{ width: '20px', height: '3px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px' }} />}
                      {h > 50 && <Clock size={13} color="rgba(255,255,255,0.45)" />}
                      {h > 30 && <div style={{ width: '20px', height: '3px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px' }} />}
                    </div>

                    {/* ↓ Bottom resize handle */}
                    <div
                      className="tbg-resize-handle"
                      onMouseDown={(e) => {
                        e.stopPropagation(); e.preventDefault();
                        setDrag({ kind: 'resize-bot', dayIdx: block.dayIdx, origStart: block.startSlot, origEnd: block.endSlot, currentSlot: block.endSlot });
                      }}
                      style={{
                        height: '8px', flexShrink: 0, cursor: 'ns-resize',
                        background: 'rgba(239,68,68,0.35)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <div style={{ width: '18px', height: '2px', background: 'rgba(255,255,255,0.45)', borderRadius: '1px' }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Transparent interactive cell grid (z-8, click-to-create) ── */}
            {/* Container + columns: pointer-events NONE so events fall through to blocks below.
                Only individual empty cells get pointer-events:auto. */}
            <div style={{ display: 'flex', position: 'absolute', top: 0, left: '50px', right: 0, bottom: 0, zIndex: 8, pointerEvents: 'none' }}>
              {DAYS.map((_, dayIdx) => (
                <div
                  key={dayIdx}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    borderLeft: dayIdx === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                    pointerEvents: 'none', // day columns don't intercept — only cells do
                  }}
                >
                  {/* Exactly 60 slots, each SLOT_PX (10px) tall — matches block positioning */}
                  {Array.from({ length: 60 }).map((_, slotIdx) => {
                    const blocked = isSlotBlocked(dayIdx, slotIdx);
                    const pinned  = isPinned(dayIdx, slotIdx);
                    return (
                      <div
                        key={slotIdx}
                        onMouseDown={() => handleCellDown(dayIdx, slotIdx)}
                        style={{
                          height: `${SLOT_PX}px`,  // fixed 10px = 40px/hour ÷ 4 slots
                          flexShrink: 0,
                          // Empty cells receive events; blocked/pinned cells pass events
                          // through to the interactive block below (z-6)
                          pointerEvents: (blocked || pinned) ? 'none' : 'auto',
                          cursor: 'default',
                          borderBottom: slotIdx % 4 === 3 ? '1px solid rgba(255,255,255,0.02)' : 'none',
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
