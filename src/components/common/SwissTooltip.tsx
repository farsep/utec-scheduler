import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

export type SwissTooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface SwissTooltipProps {
  title?: string;
  content: React.ReactNode;
  placement?: SwissTooltipPlacement;
  delayMs?: number;
  block?: boolean;
  maxWidth?: number;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

interface TooltipCoords {
  top: number;
  left: number;
  actualPlacement: SwissTooltipPlacement;
}

function computeTooltipCoords(
  anchorEl: HTMLElement,
  tipEl: HTMLElement,
  preferred: SwissTooltipPlacement
): TooltipCoords {
  const anchor = anchorEl.getBoundingClientRect();
  const tip = tipEl.getBoundingClientRect();
  const gap = 8;
  const pad = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let actual = preferred;
  if (preferred === 'top' && anchor.top - tip.height - gap < pad && anchor.bottom + tip.height + gap <= vh - pad) {
    actual = 'bottom';
  } else if (preferred === 'bottom' && anchor.bottom + tip.height + gap > vh - pad && anchor.top - tip.height - gap >= pad) {
    actual = 'top';
  } else if (preferred === 'left' && anchor.left - tip.width - gap < pad && anchor.right + tip.width + gap <= vw - pad) {
    actual = 'right';
  } else if (preferred === 'right' && anchor.right + tip.width + gap > vw - pad && anchor.left - tip.width - gap >= pad) {
    actual = 'left';
  }

  let top = 0;
  let left = 0;

  if (actual === 'top') {
    top = anchor.top - tip.height - gap;
    left = anchor.left + anchor.width / 2 - tip.width / 2;
  } else if (actual === 'bottom') {
    top = anchor.bottom + gap;
    left = anchor.left + anchor.width / 2 - tip.width / 2;
  } else if (actual === 'left') {
    top = anchor.top + anchor.height / 2 - tip.height / 2;
    left = anchor.left - tip.width - gap;
  } else {
    top = anchor.top + anchor.height / 2 - tip.height / 2;
    left = anchor.right + gap;
  }

  left = Math.max(pad, Math.min(left, vw - tip.width - pad));
  top = Math.max(pad, Math.min(top, vh - tip.height - pad));

  return { top, left, actualPlacement: actual };
}

export const SwissTooltip: React.FC<SwissTooltipProps> = ({
  title,
  content,
  placement = 'top',
  delayMs = 160,
  block = false,
  maxWidth = 265,
  className = '',
  style,
  children,
}) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<TooltipCoords | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const tooltipId = useId();

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const openTip = useCallback(() => {
    clearTimer();
    if (delayMs <= 0) {
      setVisible(true);
    } else {
      timerRef.current = window.setTimeout(() => setVisible(true), delayMs);
    }
  }, [delayMs]);

  const closeTip = useCallback(() => {
    clearTimer();
    setVisible(false);
  }, []);

  useEffect(() => () => clearTimer(), []);

  useEffect(() => {
    if (!visible) return;
    const updatePosition = () => {
      if (!anchorRef.current || !tipRef.current) return;
      setCoords(computeTooltipCoords(anchorRef.current, tipRef.current, placement));
    };
    updatePosition();
    const rafId = window.requestAnimationFrame(updatePosition);
    const onScrollOrKey = (e: Event) => {
      if (e.type === 'keydown' && (e as KeyboardEvent).key !== 'Escape') return;
      closeTip();
    };
    window.addEventListener('scroll', onScrollOrKey, true);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('keydown', onScrollOrKey);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScrollOrKey, true);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('keydown', onScrollOrKey);
    };
  }, [visible, placement, closeTip, title, content]);

  const anchorClass = [
    'swiss-tooltip-anchor',
    block ? 'swiss-tooltip-anchor--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <span
        ref={anchorRef}
        className={anchorClass}
        style={style}
        onMouseEnter={openTip}
        onMouseLeave={closeTip}
        onFocus={openTip}
        onBlur={closeTip}
        aria-describedby={visible ? tooltipId : undefined}
      >
        {children}
      </span>
      {visible &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tipRef}
            id={tooltipId}
            role="tooltip"
            className={`swiss-tooltip-portal swiss-tooltip-portal--${coords?.actualPlacement ?? placement}`}
            style={{
              top: coords ? `${coords.top}px` : '-9999px',
              left: coords ? `${coords.left}px` : '-9999px',
              maxWidth: `${maxWidth}px`,
              opacity: coords ? 1 : 0,
            }}
          >
            {title && <div className="swiss-tooltip-title">{title}</div>}
            <div className="swiss-tooltip-body">{content}</div>
          </div>,
          document.body
        )}
    </>
  );
};

export interface SwissInfoTipProps {
  title?: string;
  content: React.ReactNode;
  placement?: SwissTooltipPlacement;
  ariaLabel?: string;
  maxWidth?: number;
}

/**
 * Interactive Grafton Swiss [i] badge that opens on hover/focus (desktop)
 * and tap-toggle (touch devices / iOS).
 */
export const SwissInfoTip: React.FC<SwissInfoTipProps> = ({
  title,
  content,
  placement = 'top',
  ariaLabel = 'Ver explicación',
  maxWidth = 285,
}) => {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [coords, setCoords] = useState<TooltipCoords | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipId = useId();
  const open = hovered || focused || pinned;

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      if (!btnRef.current || !tipRef.current) return;
      setCoords(computeTooltipCoords(btnRef.current, tipRef.current, placement));
    };
    updatePosition();
    const rafId = window.requestAnimationFrame(updatePosition);
    const closeAll = () => {
      setHovered(false);
      setFocused(false);
      setPinned(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      closeAll();
    };
    const onScrollOrKey = (e: Event) => {
      if (e.type === 'keydown' && (e as KeyboardEvent).key !== 'Escape') return;
      closeAll();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onScrollOrKey, true);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('keydown', onScrollOrKey);
    return () => {
      window.cancelAnimationFrame(rafId);
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onScrollOrKey, true);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('keydown', onScrollOrKey);
    };
  }, [open, placement, title, content]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`swiss-info-tip-btn ${open ? 'is-active' : ''}`}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={(e) => {
          try {
            if (e.currentTarget.matches(':focus-visible')) setFocused(true);
          } catch {
            setFocused(true);
          }
        }}
        onBlur={() => setFocused(false)}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (pinned) {
            setPinned(false);
            setHovered(false);
            setFocused(false);
          } else {
            setPinned(true);
          }
        }}
      >
        <Info size={10} strokeWidth={2.5} aria-hidden="true" />
      </button>
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tipRef}
            id={tipId}
            role="tooltip"
            className={`swiss-tooltip-portal swiss-tooltip-portal--${coords?.actualPlacement ?? placement}`}
            style={{
              top: coords ? `${coords.top}px` : '-9999px',
              left: coords ? `${coords.left}px` : '-9999px',
              maxWidth: `${maxWidth}px`,
              opacity: coords ? 1 : 0,
            }}
          >
            {title && <div className="swiss-tooltip-title">{title}</div>}
            <div className="swiss-tooltip-body">{content}</div>
          </div>,
          document.body
        )}
    </>
  );
};

export default SwissTooltip;
