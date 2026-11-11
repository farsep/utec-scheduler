import React from 'react';

export interface GraftonKpiSlot {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  valueColor: string; // e.g. '#0D7A4E', '#141416', '#00779E'
  accentColor: string; // e.g. '#0D7A4E', '#18181A', '#00779E'
  onClick?: () => void;
  className?: string;
  dataTestId?: string;
}

interface GraftonMobileKpiBandProps {
  slots: GraftonKpiSlot[];
  className?: string;
}

export const GraftonMobileKpiBand: React.FC<GraftonMobileKpiBandProps> = ({ slots, className = '' }) => {
  return (
    <div
      className={`grafton-mobile-kpi-band kpi-dashboard-band w-full mb-4 lg:hidden select-none ${className}`}
      style={{
        borderRadius: '0px',
        border: '2px solid #18181A',
        backgroundColor: '#FFFFFF',
        boxShadow: '3px 3px 0px #18181A',
        padding: '0px',
      }}
    >
      <div
        className="grafton-kpi-grid w-full"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))`,
          width: '100%',
        }}
      >
        {slots.map((slot, idx) => (
          <div
            key={idx}
            data-testid={slot.dataTestId || `kpi-slot-${idx}`}
            className={`grafton-kpi-compartment text-center flex flex-col items-center justify-between min-h-[68px] pt-2.5 pb-2 px-1 ${
              idx < slots.length - 1 ? 'border-r-[1.5px] border-r-[#18181A]' : ''
            } ${slot.onClick ? 'cursor-pointer active:bg-black/5' : ''} ${slot.className || ''}`}
            style={{
              borderBottom: `4.5px solid ${slot.accentColor}`,
              borderRadius: '0px',
            }}
            onClick={slot.onClick}
          >
            {/* Top Signal Icon */}
            <div
              className="grafton-kpi-top-icon flex items-center justify-center shrink-0"
              style={{ color: slot.accentColor }}
            >
              {slot.icon}
            </div>

            {/* Massive Metric */}
            <div
              className="grafton-kpi-metric"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '28px',
                fontWeight: 800,
                lineHeight: 1,
                margin: '1px 0',
                color: slot.valueColor,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {slot.value}
            </div>

            {/* Micro Uppercase Label */}
            <div
              className="grafton-kpi-label"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '9px',
                fontWeight: 700,
                color: '#5A5852',
                letterSpacing: '-0.02em',
                lineHeight: 1,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              {slot.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

