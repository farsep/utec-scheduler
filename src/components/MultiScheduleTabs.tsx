import React, { useState } from 'react';
import { Plus, Trash2, Copy } from 'lucide-react';
import type { ScheduleOption } from '../types/schedule';

interface MultiScheduleTabsProps {
  options: ScheduleOption[];
  activeOptionId: string;
  onSelectOption: (id: string) => void;
  onAddOption: () => void;
  onDuplicateOption: (id: string) => void;
  onDeleteOption: (id: string) => void;
  onReorderOptions: (dragIndex: number, dropIndex: number) => void;
}

const getSubscript = (numStr: string) => {
  const map: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
  return numStr.split('').map(c => map[c] || c).join('');
};

const getTabLetter = (name: string) => {
  const match = name.match(/Opci[oó]n\s+([A-Z0-9])/i);
  const copyMatch = name.match(/\(Copia\s*(\d+)?\)/i);
  
  const letter = match ? match[1].toUpperCase() : name.charAt(0).toUpperCase();
  const copyNum = copyMatch ? (copyMatch[1] || '1') : '';
  
  return letter + (copyNum ? getSubscript(copyNum) : '');
};

export const MultiScheduleTabs: React.FC<MultiScheduleTabsProps> = ({
  options,
  activeOptionId,
  onSelectOption,
  onAddOption,
  onDuplicateOption,
  onDeleteOption,
  onReorderOptions
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox requires setting data to drag
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;
    onReorderOptions(draggedIndex, dropIndex);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', flex: '1 1 auto', minWidth: 0 }}>
      <div className="option-tabs">
        {options.map((opt, index) => {
          const count = Object.keys(opt.selectedSections).length;
          const isActive = opt.id === activeOptionId;
          const letter = getTabLetter(opt.name);
          const isDragging = draggedIndex === index;

          return (
            <div 
              key={opt.id} 
              className={`tab-wrapper ${isActive ? 'active' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              style={{ opacity: isDragging ? 0.4 : 1, cursor: isDragging ? 'grabbing' : 'grab' }}
            >
              <button
                className="tab-content-btn"
                onClick={() => onSelectOption(opt.id)}
                title={opt.name}
              >
                <div 
                  style={{ 
                    flexShrink: 0, 
                    width: '18px', 
                    height: '18px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    borderRadius: '4px', 
                    background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)', 
                    fontSize: '11px', 
                    fontWeight: 'bold',
                    fontFamily: 'var(--font-heading)',
                    position: 'relative'
                  }}
                >
                  {letter}
                </div>
                <span className="tab-name">{opt.name}</span>
                <span className="glass-pill pill-count" style={{ padding: '1px 6px', fontSize: '0.7rem', flexShrink: 0 }}>
                  {count} {count === 1 ? 'curso' : 'cursos'}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '12px' }}>
        <button className="add-tab-btn" onClick={onAddOption} title="Crear nueva alternativa de horario">
          <Plus size={16} />
        </button>

        <div style={{ width: '1px', height: '16px', background: 'var(--border-color)', margin: '0 4px' }} />

        <button
          className="add-tab-btn"
          onClick={() => onDuplicateOption(activeOptionId)}
          title="Duplicar la opción actual"
        >
          <Copy size={14} />
        </button>

        {options.length > 1 && (
          <button
            className="add-tab-btn"
            onClick={() => onDeleteOption(activeOptionId)}
            title="Eliminar la opción actual"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
