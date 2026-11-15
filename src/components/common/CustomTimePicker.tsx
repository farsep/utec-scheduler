import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Clock, Check, X } from 'lucide-react';

export interface CustomTimePickerProps {
  value: string; // Format "HH:MM", e.g. "10:48"
  onChange: (value: string) => void;
  prefix?: string; // e.g. "De:" or "A:"
  minHour?: number; // default 7
  maxHour?: number; // default 22
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  align?: 'left' | 'right';
  customTrigger?: (formattedDisplay: string, onClick: (e?: React.MouseEvent) => void, isOpen: boolean) => React.ReactNode;
}

const FREQUENT_HOURS = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00'];
const MINUTES_LIST = [0, 10, 15, 20, 30, 40, 45, 50];

export const CustomTimePicker: React.FC<CustomTimePickerProps> = ({
  value,
  onChange,
  prefix,
  minHour = 7,
  maxHour = 22,
  className = '',
  disabled = false,
  size = 'md',
  align = 'left',
  customTrigger
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [manualTime, setManualTime] = useState(value || '');

  // Keep manual input in sync with external value
  useEffect(() => {
    setManualTime(value || '');
  }, [value]);

  // Parse current hour and minute from value (e.g. "10:48")
  const { currentHour, currentMinute } = useMemo(() => {
    if (!value || !value.includes(':')) {
      return { currentHour: 10, currentMinute: 0 };
    }
    const [h, m] = value.split(':');
    return {
      currentHour: parseInt(h, 10) || 10,
      currentMinute: parseInt(m, 10) || 0
    };
  }, [value]);

  // Format display string with 12h AM/PM: e.g. "10:48 AM" or "02:15 PM"
  const formattedDisplay = useMemo(() => {
    const h = currentHour;
    const m = String(currentMinute).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
  }, [currentHour, currentMinute]);

  // Generate 07:00 - 22:00 hours list
  const hoursList = useMemo(() => {
    const list: number[] = [];
    for (let h = minHour; h <= maxHour; h++) {
      list.push(h);
    }
    return list;
  }, [minHour, maxHour]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Viewport bounds clamping safeguard
  useEffect(() => {
    if (!isOpen || !popoverRef.current) return;
    const el = popoverRef.current;

    const checkViewportBounds = () => {
      if (!el) return;
      // In desktop (>= 1024px), preserve strictly left-aligned anchoring to the trigger button
      if (window.innerWidth >= 1024) {
        if (align === 'left') {
          el.style.left = '0px';
          el.style.right = 'auto';
          return;
        } else if (align === 'right') {
          el.style.left = 'auto';
          el.style.right = '0px';
          return;
        }
      }

      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const padding = 8;

      // If popover is centered via CSS transform, let CSS handle it
      const computed = window.getComputedStyle(el);
      if (computed.transform !== 'none') return;

      if (rect.right > vw - padding) {
        const overflow = rect.right - (vw - padding);
        el.style.left = `${Math.max(padding, el.offsetLeft - overflow)}px`;
        el.style.right = 'auto';
      } else if (rect.left < padding) {
        const underflow = padding - rect.left;
        el.style.left = `${el.offsetLeft + underflow}px`;
        el.style.right = 'auto';
      }
    };

    const rafId = requestAnimationFrame(checkViewportBounds);
    window.addEventListener('resize', checkViewportBounds);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', checkViewportBounds);
    };
  }, [isOpen]);

  const toggleOpen = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!disabled) {
      setIsOpen(prev => !prev);
    }
  };

  const handleSelectHour = (h: number) => {
    const newTime = `${String(h).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
    onChange(newTime);
  };

  const handleSelectMinute = (m: number) => {
    const newTime = `${String(currentHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    onChange(newTime);
  };

  const handleSelectPreset = (preset: string) => {
    onChange(preset);
  };

  const handleManualTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setManualTime(val);
    const match = val.match(/^([01]?[0-9]|2[0-3]):([0-5][0-9])$/);
    if (match) {
      onChange(val);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`grafton-time-picker-wrapper ${className}`}
    >
      {/* Trigger Button or Custom Trigger */}
      {customTrigger ? (
        customTrigger(formattedDisplay, toggleOpen, isOpen)
      ) : (
        <button
          type="button"
          className={`grafton-time-trigger-btn ${size === 'sm' ? 'grafton-time-trigger-btn--sm' : ''} ${isOpen ? 'grafton-time-trigger-btn--open' : ''}`}
          onClick={toggleOpen}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          disabled={disabled}
        >
          <Clock size={13} className="shrink-0" />
          <span className="gtp-trigger-text">
            {prefix && <span className="gtp-prefix">{prefix}</span>}
            <span className="gtp-val">{formattedDisplay}</span>
          </span>
        </button>
      )}

      {/* Floating Grafton Swiss Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Selector de Horario"
          className={`grafton-time-picker-popover ${align === 'right' ? 'grafton-time-picker-popover--right' : 'grafton-time-picker-popover--left'}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Popover Header */}
          <div className="gtp-header">
            <div className="gtp-title">
              <Clock size={13} />
              <span>SELECCIONAR HORA</span>
            </div>
            <div className="gtp-manual-box">
              {/* Direct manual input */}
              <input
                type="text"
                value={manualTime}
                onChange={handleManualTimeChange}
                placeholder="HH:MM"
                maxLength={5}
                className="gtp-input"
                title="Escribe la hora exacta en formato 24h (ej: 11:40)"
              />
              <span className="gtp-badge-preview">
                {formattedDisplay}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="gtp-close-btn"
                aria-label="Cerrar selector de hora"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Quick Presets */}
          <div style={{ marginBottom: '10px' }}>
            <span className="gtp-section-label">HORAS FRECUENTES</span>
            <div className="gtp-grid-4">
              {FREQUENT_HOURS.map(preset => {
                const isSelected = value === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    className={`gtp-chip ${isSelected ? 'gtp-chip--active' : ''}`}
                    onClick={() => handleSelectPreset(preset)}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hour Selector Grid */}
          <div style={{ marginBottom: '10px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                whiteSpace: 'nowrap',
                marginBottom: '6px',
              }}
            >
              <span
                className="gtp-section-label"
                style={{ marginBottom: 0, whiteSpace: 'nowrap' }}
              >
                HORA ({String(minHour).padStart(2, '0')}:00–{String(maxHour).padStart(2, '0')}:00)
              </span>
              <span
                style={{
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  padding: '2px 6px',
                  backgroundColor: '#DCD9D2',
                  border: '1px solid #18181A',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#141416',
                  borderRadius: '0px',
                }}
              >
                {String(currentHour).padStart(2, '0')}:00
              </span>
            </div>
            <div className="gtp-hours-grid">
              {hoursList.map(h => {
                const isSelected = currentHour === h;
                const h12 = h % 12 === 0 ? 12 : h % 12;
                const ampm = h >= 12 ? 'PM' : 'AM';
                return (
                  <button
                    key={h}
                    type="button"
                    className={`gtp-chip ${isSelected ? 'gtp-chip--active' : ''}`}
                    onClick={() => handleSelectHour(h)}
                    title={`${String(h).padStart(2, '0')}:00 (${h12} ${ampm})`}
                  >
                    {String(h).padStart(2, '0')}:00
                  </button>
                );
              })}
            </div>
          </div>

          {/* Minute Selector */}
          <div style={{ marginBottom: '10px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                whiteSpace: 'nowrap',
                marginBottom: '6px',
              }}
            >
              <span className="gtp-section-label" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>MINUTOS</span>
              <span
                style={{
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#4A4946',
                }}
              >
                :{String(currentMinute).padStart(2, '0')}
              </span>
            </div>
            <div className="gtp-grid-4">
              {MINUTES_LIST.map(m => {
                const isSelected = currentMinute === m;
                return (
                  <button
                    key={m}
                    type="button"
                    className={`gtp-chip ${isSelected ? 'gtp-chip--active' : ''}`}
                    style={{ whiteSpace: 'nowrap' }}
                    onClick={() => handleSelectMinute(m)}
                  >
                    :{String(m).padStart(2, '0')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Confirm Button */}
          <button
            type="button"
            className="gtp-apply-btn"
            onClick={() => setIsOpen(false)}
          >
            <Check size={13} />
            <span>APLICAR ({formattedDisplay})</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomTimePicker;
