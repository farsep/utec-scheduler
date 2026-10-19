import React from 'react';
import type { DayOfWeek } from '../../types/schedule';
import type { ClassroomFilterState, RoomType } from '../../types/classroom';
import { ALL_DAYS, DAY_LABELS, ROOM_TYPE_LABELS } from '../../utils/classroomUtils';
import {
  Zap,
  Clock,
  Search,
  Filter,
  Layers,
  GraduationCap,
  Laptop,
  Users,
  Building,
  RotateCcw,
  Sparkles,
  SlidersHorizontal,
  X
} from 'lucide-react';

interface ClassroomFilterBarProps {
  filter: ClassroomFilterState;
  onChangeFilter: (updates: Partial<ClassroomFilterState>) => void;
  systemDay: DayOfWeek;
  systemTimeStr: string;
  isSimulatedTime: boolean;
  activeLiveTimeStr: string;
  onStepLiveTime: (deltaMinutes: number) => void;
  onSetLiveTime: (timeStr: string) => void;
  onResetRealTime: () => void;
  floorCounts: Record<number | string, number>;
  totalAvailable: number;
  totalRooms: number;
  onResetFilters: () => void;
}

export const ClassroomFilterBar: React.FC<ClassroomFilterBarProps> = ({
  filter,
  onChangeFilter,
  systemDay,
  systemTimeStr,
  isSimulatedTime,
  activeLiveTimeStr,
  onStepLiveTime,
  onSetLiveTime,
  onResetRealTime,
  floorCounts,
  totalAvailable,
  totalRooms,
  onResetFilters
}) => {
  const floors = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const timePresets = [
    { label: 'Mañana', start: '08:00', end: '12:00' },
    { label: 'Almuerzo', start: '12:00', end: '14:00' },
    { label: 'Tarde', start: '14:00', end: '18:00' },
    { label: 'Noche', start: '18:00', end: '22:00' }
  ];

  const handleApplyPreset = (start: string, end: string) => {
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    onChangeFilter({
      mode: 'custom_time',
      startTime: start,
      endTime: end,
      startMinutes: sH * 60 + sM,
      endMinutes: eH * 60 + eM
    });
  };

  const handleTimeChange = (type: 'start' | 'end', value: string) => {
    if (!value) return;
    const [h, m] = value.split(':').map(Number);
    const mins = h * 60 + m;

    if (type === 'start') {
      let nextEndMins = filter.endMinutes;
      let nextEndTime = filter.endTime;
      if (mins >= filter.endMinutes) {
        nextEndMins = Math.min(1320, mins + 60);
        const endH = Math.floor(nextEndMins / 60);
        const endM = nextEndMins % 60;
        nextEndTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
      }
      onChangeFilter({
        startTime: value,
        startMinutes: mins,
        endTime: nextEndTime,
        endMinutes: nextEndMins
      });
    } else {
      let nextStartMins = filter.startMinutes;
      let nextStartTime = filter.startTime;
      if (mins <= filter.startMinutes) {
        nextStartMins = Math.max(420, mins - 60);
        const startH = Math.floor(nextStartMins / 60);
        const startM = nextStartMins % 60;
        nextStartTime = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
      }
      onChangeFilter({
        endTime: value,
        endMinutes: mins,
        startTime: nextStartTime,
        startMinutes: nextStartMins
      });
    }
  };

  const isCustomTime = filter.mode === 'custom_time';

  return (
    <div className="classroom-filter-bar glass-card">
      {/* Top Mode Selector & Live Status Pill */}
      <div className="filter-mode-header">
        <div className="mode-toggle-group">
          <button
            type="button"
            className={`mode-toggle-btn ${filter.mode === 'live_now' ? 'active active--live' : ''}`}
            onClick={() => onChangeFilter({ mode: 'live_now', selectedDay: systemDay })}
          >
            <Zap size={16} />
            <span>Libres Ahora</span>
            <span className="live-pulse-badge">
              {isSimulatedTime ? `Simulando (${activeLiveTimeStr})` : `En vivo (${activeLiveTimeStr})`}
            </span>
          </button>

          <button
            type="button"
            className={`mode-toggle-btn ${filter.mode === 'custom_time' ? 'active' : ''}`}
            onClick={() => onChangeFilter({ mode: 'custom_time' })}
          >
            <Clock size={16} />
            <span>Buscar por Horario</span>
          </button>
        </div>

        {/* Global Summary Badge */}
        <div className="filter-summary-chip">
          <span className="summary-count-highlight">{totalAvailable}</span>
          <span className="summary-count-label">de {totalRooms} aulas disponibles</span>
        </div>
      </div>

      {/* Live Time Controller (Active when in "Libres Ahora") */}
      {!isCustomTime && (
        <div className="live-time-controller">
          <div className="live-time-info">
            <span className={`live-status-dot ${isSimulatedTime ? 'live-status-dot--simulated' : 'live-status-dot--pulse'}`} />
            <span className="live-time-title">
              {isSimulatedTime ? 'Simulando Horario en Vivo:' : 'Hora Actual del Campus (En Vivo):'}
            </span>
            <span className="live-time-badge">{activeLiveTimeStr}</span>
            <span className="live-day-tag">{DAY_LABELS[filter.selectedDay]}</span>
          </div>

          <div className="live-time-actions">
            <button
              type="button"
              className="btn-time-step"
              onClick={() => onStepLiveTime(-15)}
              title="Retroceder 15 minutos en tiempo real"
            >
              -15m
            </button>
            <div className="live-time-input-wrap">
              <input
                type="time"
                step="900"
                value={activeLiveTimeStr}
                onChange={(e) => onSetLiveTime(e.target.value)}
                className="live-time-picker"
                title="Cambiar hora en tiempo real para ver qué aulas estarán libres"
              />
            </div>
            <button
              type="button"
              className="btn-time-step"
              onClick={() => onStepLiveTime(15)}
              title="Avanzar 15 minutos en tiempo real"
            >
              +15m
            </button>

            {isSimulatedTime && (
              <button
                type="button"
                className="btn-reset-realtime"
                onClick={onResetRealTime}
                title="Restablecer a la hora exacta en vivo de tu dispositivo"
              >
                <RotateCcw size={13} />
                <span>Volver a Hora Real</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Primary Filter Grid */}
      <div className="filter-controls-row">
        {/* Day Selector */}
        <div className="filter-control-group">
          <label className="filter-group-label">Día de la semana:</label>
          <div className="day-pills-list">
            {ALL_DAYS.map(day => {
              const isSelected = filter.selectedDay === day;
              const isToday = systemDay === day;
              return (
                <button
                  key={day}
                  type="button"
                  className={`day-pill-btn ${isSelected ? 'selected' : ''}`}
                  onClick={() => onChangeFilter({ selectedDay: day })}
                >
                  <span>{day}</span>
                  {isToday && <span className="today-badge">Hoy</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Settings (Shown if Custom Mode) */}
        {isCustomTime && (
          <div className="filter-control-group filter-control-group--time">
            <label className="filter-group-label">Bloque Horario:</label>
            <div className="time-inputs-container">
              <div className="time-input-box">
                <span className="time-input-prefix">De:</span>
                <input
                  type="time"
                  step="900"
                  min="07:00"
                  max="22:00"
                  value={filter.startTime}
                  onChange={(e) => handleTimeChange('start', e.target.value)}
                  className="time-picker-input"
                />
              </div>

              <span className="time-separator">—</span>

              <div className="time-input-box">
                <span className="time-input-prefix">A:</span>
                <input
                  type="time"
                  step="900"
                  min="07:00"
                  max="22:00"
                  value={filter.endTime}
                  onChange={(e) => handleTimeChange('end', e.target.value)}
                  className="time-picker-input"
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div className="time-presets-strip">
              {timePresets.map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  className="time-preset-btn"
                  onClick={() => handleApplyPreset(preset.start, preset.end)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Min Duration Filter */}
        <div className="filter-control-group">
          <label className="filter-group-label">Disponibilidad mínima:</label>
          <div className="duration-pills-list">
            {[0, 1, 2, 3].map(hours => (
              <button
                key={hours}
                type="button"
                className={`duration-pill-btn ${filter.minFreeHours === hours ? 'selected' : ''}`}
                onClick={() => onChangeFilter({ minFreeHours: hours })}
              >
                {hours === 0 ? 'Cualquiera' : `≥ ${hours}h`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Floor Filter Bar */}
      <div className="floor-filter-row">
        <label className="filter-group-label">
          <Layers size={14} />
          <span>Filtrar por Piso:</span>
        </label>
        <div className="floor-pills-scroll">
          <button
            type="button"
            className={`floor-pill-btn ${filter.selectedFloor === 'ALL' ? 'selected' : ''}`}
            onClick={() => onChangeFilter({ selectedFloor: 'ALL' })}
          >
            <span>Todos los Pisos</span>
            <span className="floor-count-bubble">{totalAvailable}</span>
          </button>

          {floors.map(floor => {
            const count = floorCounts[floor] || 0;
            const isSelected = filter.selectedFloor === floor;
            return (
              <button
                key={floor}
                type="button"
                className={`floor-pill-btn ${isSelected ? 'selected' : ''} ${count === 0 ? 'disabled' : ''}`}
                onClick={() => onChangeFilter({ selectedFloor: floor })}
              >
                <span>Piso {floor}</span>
                <span className={`floor-count-bubble ${count > 0 ? 'floor-count--positive' : ''}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Row: Room Type Chips, Search Input & Sort */}
      <div className="filter-bottom-row">
        {/* Room Type Multi-chips */}
        <div className="room-type-chips">
          <button
            type="button"
            className={`type-chip-btn ${filter.selectedType === 'ALL' ? 'selected' : ''}`}
            onClick={() => onChangeFilter({ selectedType: 'ALL' })}
          >
            <span>Todos</span>
          </button>
          <button
            type="button"
            className={`type-chip-btn ${filter.selectedType === 'aula' ? 'selected' : ''}`}
            onClick={() => onChangeFilter({ selectedType: 'aula' })}
          >
            <GraduationCap size={14} />
            <span>Aulas</span>
          </button>
          <button
            type="button"
            className={`type-chip-btn ${filter.selectedType === 'laboratorio' ? 'selected' : ''}`}
            onClick={() => onChangeFilter({ selectedType: 'laboratorio' })}
          >
            <Laptop size={14} />
            <span>Laboratorios</span>
          </button>
          <button
            type="button"
            className={`type-chip-btn ${filter.selectedType === 'mesas' ? 'selected' : ''}`}
            onClick={() => onChangeFilter({ selectedType: 'mesas' })}
          >
            <Users size={14} />
            <span>Mesas</span>
          </button>
          <button
            type="button"
            className={`type-chip-btn ${filter.selectedType === 'auditorio' ? 'selected' : ''}`}
            onClick={() => onChangeFilter({ selectedType: 'auditorio' })}
          >
            <Building size={14} />
            <span>Auditorios</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="search-input-wrap">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            placeholder="Buscar aula (ej. A704, L203, M802)..."
            value={filter.searchQuery}
            onChange={(e) => onChangeFilter({ searchQuery: e.target.value })}
            className="classroom-search-field"
          />
          {filter.searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => onChangeFilter({ searchQuery: '' })}
              title="Borrar búsqueda"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Sort Select */}
        <div className="sort-dropdown-wrap">
          <SlidersHorizontal size={14} className="sort-icon" />
          <select
            value={filter.sortBy}
            onChange={(e) => onChangeFilter({ sortBy: e.target.value as any })}
            className="sort-select-field"
          >
            <option value="floor_asc">Piso (Menor a Mayor)</option>
            <option value="floor_desc">Piso (Mayor a Menor)</option>
            <option value="free_time">Mayor tiempo libre</option>
            <option value="name">Código de aula</option>
          </select>
        </div>

        {/* Reset button */}
        <button
          type="button"
          className="btn-reset-filters"
          onClick={onResetFilters}
          title="Restablecer filtros a valores predeterminados"
        >
          <RotateCcw size={14} />
          <span>Restablecer</span>
        </button>
      </div>
    </div>
  );
};
