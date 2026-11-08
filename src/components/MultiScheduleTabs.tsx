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

export const MultiScheduleTabs: React.FC<MultiScheduleTabsProps> = ({
  options,
  activeOptionId,
  onSelectOption,
  onAddOption,
  onDuplicateOption,
  onDeleteOption,
  onReorderOptions,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
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
    <div className="multi-schedule-tabs-root">
      <div className="option-tabs no-scrollbar">
        {options.map((opt, index) => {
          const count = Object.keys(opt.selectedSections).length;
          const isActive = opt.id === activeOptionId;
          const isDragging = draggedIndex === index;

          return (
            <div
              key={opt.id}
              className={`tab-wrapper ${isActive ? 'active' : ''}`}
              draggable
              onDragStart={e => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={e => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              style={{ opacity: isDragging ? 0.45 : 1, cursor: isDragging ? 'grabbing' : 'grab' }}
            >
              <button
                type="button"
                className="tab-content-btn"
                onClick={() => onSelectOption(opt.id)}
                title={opt.name}
              >
                <span className="tab-name">{opt.name}</span>
                <span className="pill-count">{count}c</span>
              </button>
            </div>
          );
        })}
      </div>

      <div className="option-tab-controls">
        <button
          type="button"
          className="add-tab-btn"
          onClick={onAddOption}
          title="Crear nueva alternativa de horario"
          aria-label="Nueva opción de horario"
        >
          <Plus size={14} />
        </button>

        <button
          type="button"
          className="add-tab-btn"
          onClick={() => onDuplicateOption(activeOptionId)}
          title="Duplicar la opción actual"
          aria-label="Duplicar opción actual"
        >
          <Copy size={13} />
        </button>

        {options.length > 1 && (
          <button
            type="button"
            className="add-tab-btn"
            onClick={() => onDeleteOption(activeOptionId)}
            title="Eliminar la opción actual"
            aria-label="Eliminar opción actual"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
};
