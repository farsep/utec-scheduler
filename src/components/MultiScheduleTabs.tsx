import React from 'react';
import { Plus, Trash2, Copy } from 'lucide-react';
import type { ScheduleOption } from '../types/schedule';

interface MultiScheduleTabsProps {
  options: ScheduleOption[];
  activeOptionId: string;
  onSelectOption: (id: string) => void;
  onAddOption: () => void;
  onDuplicateOption: (id: string) => void;
  onDeleteOption: (id: string) => void;
}

export const MultiScheduleTabs: React.FC<MultiScheduleTabsProps> = ({
  options,
  activeOptionId,
  onSelectOption,
  onAddOption,
  onDuplicateOption,
  onDeleteOption
}) => {
  return (
    <div className="option-tabs">
      {options.map(opt => {
        const count = Object.keys(opt.selectedSections).length;
        const isActive = opt.id === activeOptionId;

        return (
          <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              className={`tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSelectOption(opt.id)}
            >
              <span>{opt.name}</span>
              <span className="glass-pill" style={{ padding: '1px 6px', fontSize: '0.7rem' }}>
                {count} {count === 1 ? 'curso' : 'cursos'}
              </span>
            </button>

            {isActive && options.length > 1 && (
              <button
                className="close-btn"
                onClick={() => onDeleteOption(opt.id)}
                title="Eliminar esta opción"
                style={{ padding: '4px' }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        );
      })}

      <button className="add-tab-btn" onClick={onAddOption} title="Crear nueva alternativa de horario">
        <Plus size={16} />
      </button>
    </div>
  );
};
