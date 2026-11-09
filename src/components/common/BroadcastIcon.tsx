import React from 'react';
import { Radio } from 'lucide-react';

export interface BroadcastIconProps {
  className?: string;
  size?: number;
}

export const BroadcastIcon: React.FC<BroadcastIconProps> = ({
  className = 'w-3.5 h-3.5 shrink-0',
  size = 14
}) => {
  return <Radio size={size} className={className} aria-hidden="true" />;
};

export default BroadcastIcon;
