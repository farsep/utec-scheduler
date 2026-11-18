import React from 'react';

export interface SwissLockIconProps {
  locked?: boolean;
  size?: number;
  className?: string;
  animateOnMount?: boolean;
}

/**
 * Architectural padlock vector icon aligned with Grafton Swiss Concrete:
 * sharp 0px rectilinear body with a mechanical closing shackle animation.
 */
export const SwissLockIcon: React.FC<SwissLockIconProps> = ({
  locked = true,
  size = 13,
  className = '',
  animateOnMount = false,
}) => {
  const stateClass = locked ? 'swiss-lock-icon--locked' : 'swiss-lock-icon--unlocked';
  const mountClass = locked && animateOnMount ? 'swiss-lock-icon--snap' : '';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`swiss-lock-icon ${stateClass} ${mountClass} ${className}`.trim()}
      aria-hidden="true"
    >
      <path
        className="swiss-lock-shackle"
        d="M5 7.5V4.5C5 2.84315 6.34315 1.5 8 1.5C9.65685 1.5 11 2.84315 11 4.5V7.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <rect
        className="swiss-lock-body"
        x="2.5"
        y="7.5"
        width="11"
        height="7"
        rx="0"
        fill="currentColor"
        fillOpacity={locked ? '0.16' : '0'}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="miter"
      />
      <line
        className="swiss-lock-keyhole"
        x1="8"
        y1="9.75"
        x2="8"
        y2="12.25"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="square"
      />
    </svg>
  );
};

export default SwissLockIcon;
