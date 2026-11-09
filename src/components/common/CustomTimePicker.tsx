import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Clock, Check, X } from 'lucide-react';

export interface CustomTimePickerProps {
  value: string; // Format "HH:MM", e.g. "10:48"
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

const FREQUENT_HOURS = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00'];
const MINUTES_LIST = [0, 15, 30, 45];

export const CustomTimePicker: React.FC<CustomTimePickerProps> = ({
  value,
  onChange,
  prefix,
  minHour = 7,
  maxHour = 22,
  className = '',
  disabled = false,
  align = 'right'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button - Single line horizontal button */}
      <button
        type="button"
        className="h-9 px-3.5 inline-flex items-center gap-2 whitespace-nowrap bg-[#F2F0EC] border border-[#18181A] border-t-2 border-t-[#00779E] font-mono text-xs font-bold text-[#141416] hover:bg-[#00779E] hover:text-white rounded-none shadow-[2px_2px_0px_rgba(24,24,26,0.12)] cursor-pointer transition-colors"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        disabled={disabled}
      >
        <Clock size={14} className="shrink-0" />
        <span className="whitespace-nowrap flex items-center gap-1">
          {prefix && <span className="text-[#5A5852] font-mono">{prefix}</span>}
          <span>{formattedDisplay}</span>
        </span>
      </button>

      {/* Floating Grafton Swiss Popover */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Selector de Horario"
          className="grafton-time-picker-popover"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: align === 'right' ? 0 : 'auto',
            left: align === 'left' ? 0 : 'auto',
            zIndex: 60,
            width: '360px',
            maxWidth: 'calc(100vw - 24px)',
            backgroundColor: '#F2F0EC',
            border: '2px solid #18181A',
            borderTop: '4px solid #18181A',
            borderRadius: '0px',
            boxShadow: '6px 6px 0px rgba(24, 24, 26, 0.24)',
            padding: '14px'
          }}
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#C6C3BB]">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-[#141416]" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#141416]">
                SELECCIONAR HORA
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-[#00779E] text-white px-2 py-0.5 font-mono text-xs font-bold rounded-none">
                {formattedDisplay}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-[#5A5852] hover:text-[#141416] hover:bg-[#DCD9D2] rounded-none cursor-pointer transition-colors"
                aria-label="Cerrar selector de hora"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Section 1: HORAS FRECUENTES */}
          <div className="mb-3">
            <div className="font-mono text-[10px] uppercase text-[#5A5852] mb-1.5 font-bold tracking-wider">
              HORAS FRECUENTES
            </div>
            <div className="grid grid-cols-4 gap-1">
              {FREQUENT_HOURS.map((preset) => {
                const isActive = value === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`py-1 text-center font-mono text-[11px] font-bold rounded-none cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-[#00779E] text-white border border-[#18181A]'
                        : 'bg-[#DCD9D2] border border-[#C6C3BB] text-[#141416] hover:border-[#18181A] hover:bg-[#00779E] hover:text-white'
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: HORA (07:00 – 22:00) */}
          <div className="mb-3">
            <div className="font-mono text-[10px] uppercase text-[#5A5852] mb-1.5 font-bold tracking-wider">
              HORA (07:00 – 22:00)
            </div>
            <div className="grid grid-cols-4 gap-1.5 max-h-[140px] overflow-y-auto pr-0.5">
              {hoursList.map((h) => {
                const isActive = h === currentHour;
                const label = `${String(h).padStart(2, '0')}:00`;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleSelectHour(h)}
                    className={`py-1.5 text-center font-mono text-xs rounded-none cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-[#18181A] text-[#F2F0EC] border border-[#18181A] font-bold'
                        : 'bg-[#FFFFFF] text-[#141416] border border-[#C6C3BB] hover:border-[#18181A]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: MINUTOS */}
          <div className="mb-3">
            <div className="font-mono text-[10px] uppercase text-[#5A5852] mb-1.5 font-bold tracking-wider">
              MINUTOS
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {MINUTES_LIST.map((m) => {
                const isActive = m === currentMinute;
                const label = `:${String(m).padStart(2, '0')} min`;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleSelectMinute(m)}
                    className={`py-1.5 text-center font-mono text-xs rounded-none cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-[#00779E] text-white border border-[#18181A] font-bold'
                        : 'bg-[#FFFFFF] text-[#141416] border border-[#C6C3BB] hover:border-[#18181A]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Apply Button */}
          <div>
            <button
              type="button"
              className="w-full py-2 bg-[#0D7A4E] hover:bg-[#095939] text-white border border-[#18181A] font-mono text-xs font-bold uppercase tracking-wider rounded-none shadow-[2px_2px_0px_#18181A] cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              onClick={() => setIsOpen(false)}
            >
              <Check size={14} />
              <span>✓ APLICAR ({formattedDisplay})</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
