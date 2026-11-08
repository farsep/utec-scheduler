import React, { useState, useRef, useEffect } from 'react';
import { Clock, ChevronDown } from 'lucide-react';

interface GlassTimePickerProps {
  value: string; // Format "HH:MM"
  onChange: (value: string) => void;
  label?: string;
}

export const GlassTimePicker: React.FC<GlassTimePickerProps> = ({ value, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const timeOptions = Array.from({ length: 16 }, (_, i) => {
    const hour = i + 7;
    return `${hour.toString().padStart(2, '0')}:00`;
  });

  const formatTimeDisplay = (time24: string) => {
    if (!time24) return '--:--';
    const [h, m] = time24.split(':');
    let hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${hour.toString().padStart(2, '0')}:${m} ${ampm}`;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {label && (
        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          background: 'var(--bg-surface)',
          border: `1px solid ${isOpen ? 'var(--accent-primary)' : 'var(--border-hairline)'}`,
          borderRadius: '0px',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.78rem',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clock size={13} color="var(--accent-primary)" />
          <span>{formatTimeDisplay(value)}</span>
        </div>
        <ChevronDown
          size={13}
          style={{
            opacity: 0.7,
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s',
          }}
        />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 2px)',
            left: 0,
            width: '100%',
            maxHeight: '200px',
            overflowY: 'auto',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-strong)',
            borderTop: '2px solid var(--border-strong)',
            borderRadius: '0px',
            boxShadow: 'var(--shadow-tactile)',
            zIndex: 120,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {timeOptions.map(time => (
            <button
              key={time}
              type="button"
              onClick={() => {
                onChange(time);
                setIsOpen(false);
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '7px 10px',
                background: value === time ? 'var(--accent-soft)' : 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--border-hairline)',
                borderRadius: '0px',
                color: value === time ? '#005A78' : 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                fontWeight: value === time ? 700 : 500,
                cursor: 'pointer',
              }}
            >
              {formatTimeDisplay(time)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
