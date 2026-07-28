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
      <AlertTriangle size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
        <div style={{ fontWeight: 800, fontSize: '0.95rem', fontFamily: 'var(--font-heading)' }}>
          ¡Cruce de Horario Detectado! ({conflicts.length} conflicto{conflicts.length > 1 ? 's' : ''})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem', opacity: 0.95 }}>
          {conflicts.map(c => (
            <div key={c.id} style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '6px 10px', borderRadius: '6px' }}>
              <strong>{DAY_NAMES[c.day]} ({c.startTime} - {c.endTime})</strong>: {' '}
              <span>[{c.course1Code}] {c.course1Name} (Sec {c.section1Number} - {c.session1Group})</span> {' '}
              <span style={{ color: '#f87171', fontWeight: 700 }}>cruza con</span> {' '}
              <span>[{c.course2Code}] {c.course2Name} (Sec {c.section2Number} - {c.session2Group})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
