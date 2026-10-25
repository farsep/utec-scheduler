import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Clock, Check, ChevronDown, Sparkles } from 'lucide-react';

export interface CustomTimePickerProps {
  value: string; // Format "HH:MM", e.g. "10:00"
  onChange: (value: string) => void;
  prefix?: string; // e.g. "De:" or "A:"
  minHour?: number; // default 7
  maxHour?: number; // default 22
  minuteStep?: number; // default 15
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  align?: 'left' | 'right';
}

const COMMON_PRESETS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
  '19:00', '20:00', '21:00', '22:00'
];

export const CustomTimePicker: React.FC<CustomTimePickerProps> = ({
  value,
  onChange,
  prefix,
  minHour = 7,
  maxHour = 22,
  minuteStep = 15,
  className = '',
  disabled = false,
  size = 'md',
  align = 'left'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);

  // Parse current hour and minute
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

  // Format display string with AM/PM: e.g. "10:00 AM" or "02:00 PM"
  const formattedDisplay = useMemo(() => {
    const h = currentHour;
    const m = String(currentMinute).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
  }, [currentHour, currentMinute]);

  // Generate available hours
  const hoursList = useMemo(() => {
    const list: { hour: number; label12: string; label24: string }[] = [];
    for (let h = minHour; h <= maxHour; h++) {
      const ampm = h >= 12 ? 'PM' : 'AM';
      let h12 = h % 12;
      if (h12 === 0) h12 = 12;
      list.push({
        hour: h,
        label12: `${String(h12).padStart(2, '0')} ${ampm}`,
        label24: `${String(h).padStart(2, '0')}:00`
      });
    }
    return list;
  }, [minHour, maxHour]);

  // Generate available minutes
  const minutesList = useMemo(() => {
    const list: number[] = [];
    for (let m = 0; m < 60; m += minuteStep) {
      list.push(m);
    }
    return list;
  }, [minuteStep]);

  // Click outside to close
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

  // Viewport detection
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 320 && rect.top > spaceBelow) {
        setOpenUpwards(true);
      } else {
        setOpenUpwards(false);
      }

      // Scroll active hour into view
      setTimeout(() => {
        const activeHourElem = hourListRef.current?.querySelector('.time-picker-item--active');
        if (activeHourElem) {
          activeHourElem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }, 50);
    }
  }, [isOpen]);

  const handleSelectHour = (hour: number) => {
    const newTime = `${String(hour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
    onChange(newTime);
  };

  const handleSelectMinute = (minute: number) => {
    const newTime = `${String(currentHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    onChange(newTime);
  };

  const handleApplyPreset = (preset: string) => {
    onChange(preset);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`custom-time-picker-container ${size === 'sm' ? 'custom-time-picker--sm' : ''} ${disabled ? 'custom-time-picker--disabled' : ''} ${className}`}
    >
      {/* Trigger Button */}
      <button
        type="button"
        className={`custom-time-picker-trigger ${isOpen ? 'custom-time-picker-trigger--open' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        disabled={disabled}
      >
        <div className="custom-time-picker-trigger-content">
          {prefix && <span className="custom-time-prefix">{prefix}</span>}
          <span className="custom-time-value">{formattedDisplay}</span>
        </div>
        <Clock size={14} className="custom-time-icon" />
      </button>

      {/* Popover Panel */}
      {isOpen && (
        <div
          className={`custom-time-popover ${openUpwards ? 'custom-time-popover--upwards' : ''} ${align === 'right' ? 'custom-time-popover--right' : ''}`}
          role="dialog"
          aria-label="Selector de Horario"
        >
          {/* Popover Header */}
          <div className="time-popover-header">
            <div className="time-popover-title-row">
              <Clock size={14} className="time-popover-icon" />
              <span>Seleccionar Hora</span>
            </div>
            <span className="time-popover-preview-badge">
              {formattedDisplay}
            </span>
          </div>

          {/* Quick Preset Buttons */}
          <div className="time-popover-presets">
            <span className="time-presets-title">Horas Frecuentes:</span>
            <div className="time-presets-grid">
              {COMMON_PRESETS.slice(0, 8).map(preset => {
                const isActive = value === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    className={`time-preset-pill ${isActive ? 'time-preset-pill--active' : ''}`}
                    onClick={() => handleApplyPreset(preset)}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Columns: Hours & Minutes */}
          <div className="time-columns-container">
            {/* Hours Column */}
            <div className="time-column-wrap">
              <div className="time-column-header">Hora</div>
              <div ref={hourListRef} className="time-column-list">
                {hoursList.map(({ hour, label12, label24 }) => {
                  const isActive = hour === currentHour;
                  return (
                    <button
                      key={hour}
                      type="button"
                      className={`time-picker-item ${isActive ? 'time-picker-item--active' : ''}`}
                      onClick={() => handleSelectHour(hour)}
                    >
                      <span className="time-item-main">{label12}</span>
                      <span className="time-item-sub">({label24})</span>
                      {isActive && <Check size={12} className="time-item-check" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Minutes Column */}
            <div className="time-column-wrap">
              <div className="time-column-header">Minutos</div>
              <div className="time-column-list">
                {minutesList.map(minute => {
                  const isActive = minute === currentMinute;
                  const label = `:${String(minute).padStart(2, '0')}`;
                  return (
                    <button
                      key={minute}
                      type="button"
                      className={`time-picker-item ${isActive ? 'time-picker-item--active' : ''}`}
                      onClick={() => handleSelectMinute(minute)}
                    >
                      <span className="time-item-main">{label} min</span>
                      {isActive && <Check size={12} className="time-item-check" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer Action */}
          <div className="time-popover-footer">
            <button
              type="button"
              className="time-popover-done-btn"
              onClick={() => setIsOpen(false)}
            >
              <Check size={14} />
              <span>Aplicar ({formattedDisplay})</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
