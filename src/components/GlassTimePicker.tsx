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

  // Generate hours from 07:00 to 23:00
  const timeOptions = Array.from({ length: 17 }, (_, i) => {
    const hour = i + 7;
    return `${hour.toString().padStart(2, '0')}:00`;
  });

  // Format time for display (e.g., 14:00 -> 02:00 PM)
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
        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
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
          padding: '6px 12px',
          background: 'rgba(0, 0, 0, 0.2)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-primary)',
          fontSize: '0.8rem',
          cursor: 'pointer',
          outline: 'none',
          transition: 'border-color 0.2s',
          borderColor: isOpen ? 'var(--accent-primary)' : 'var(--border-color)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={14} color="var(--accent-primary)" />
          <span>{formatTimeDisplay(value)}</span>
        </div>
        <ChevronDown size={14} style={{ opacity: 0.5, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: '100%',
            maxHeight: '200px',
            overflowY: 'auto',
            background: 'var(--bg-card)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            padding: '4px'
          }}
        >
          {timeOptions.map((time) => (
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
                padding: '8px 12px',
                background: value === time ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: value === time ? 'var(--accent-primary)' : 'var(--text-primary)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'background 0.1s'
              }}
              onMouseEnter={(e) => {
                if (value !== time) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255, 255, 255, 0.05)';
              }}
              onMouseLeave={(e) => {
                if (value !== time) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
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
