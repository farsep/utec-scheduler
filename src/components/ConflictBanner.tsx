import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Conflict } from '../types/schedule';
import { DAY_NAMES } from '../utils/scheduleUtils';

interface ConflictBannerProps {
  conflicts: Conflict[];
}

export const ConflictBanner: React.FC<ConflictBannerProps> = ({ conflicts }) => {
  if (conflicts.length === 0) return null;

  return (
    <div className="conflict-banner">
      <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
        <div className="conflict-banner__title">
          Cruce de horario detectado ({conflicts.length}{' '}
          {conflicts.length > 1 ? 'conflictos' : 'conflicto'})
        </div>
        <div className="conflict-banner__list">
          {conflicts.map(c => (
            <div key={c.id} className="conflict-banner__item">
              <strong>
                {DAY_NAMES[c.day]} ({c.startTime}–{c.endTime})
              </strong>
              : [{c.course1Code}] {c.course1Name} (Sec {c.section1Number}){' '}
              <strong style={{ color: 'var(--status-warn)' }}>cruza con</strong> [{c.course2Code}]{' '}
              {c.course2Name} (Sec {c.section2Number})
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
