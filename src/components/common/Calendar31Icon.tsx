import React from 'react';

interface Calendar31IconProps {
  size?: number;
  className?: string;
}

/**
 * Architectural Swiss Calendar-31 SVG icon for Google Calendar UI slots.
 */
export const Calendar31Icon: React.FC<Calendar31IconProps> = ({ size = 40, className }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* Orthogonal concrete paper frame */}
      <rect x="0.75" y="0.75" width="38.5" height="38.5" fill="#FAF9F5" stroke="#18181A" strokeWidth="1.5" />
      {/* Swiss cyan header band */}
      <rect x="1.5" y="1.5" width="37" height="10" fill="#00779E" />
      <line x1="0.75" y1="11.5" x2="39.25" y2="11.5" stroke="#18181A" strokeWidth="1.5" />
      {/* Binding pins */}
      <rect x="9" y="4" width="3" height="5" fill="#FAF9F5" />
      <rect x="28" y="4" width="3" height="5" fill="#FAF9F5" />
      {/* Technical "31" date numeral */}
      <text
        x="20"
        y="31"
        textAnchor="middle"
        fill="#141416"
        fontFamily="JetBrains Mono, monospace"
        fontWeight="700"
        fontSize="16"
        letterSpacing="-0.04em"
      >
        31
      </text>
    </svg>
  );
};

