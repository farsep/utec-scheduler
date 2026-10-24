import React, { useRef, useEffect } from 'react';
import type { DayOfWeek } from '../../types/schedule';
import type { ProfessorFilterState, ProfessorSortOption } from '../../types/professor';
import { ALL_DAYS, DAY_LABELS } from '../../utils/classroomUtils';
import { DEPARTMENT_CONFIG } from '../../utils/professorUtils';
import {
  Search,
  X,
  SlidersHorizontal,
  Sparkles,
  Calendar,
  GraduationCap,
  ArrowUpDown,
  Radio,
  BookOpen,
  RotateCcw
} from 'lucide-react';

interface ProfessorFilterBarProps {
  filter: ProfessorFilterState;
  onFilterChange: (updates: Partial<ProfessorFilterState>) => void;
  totalProfessors: number;
  filteredCount: number;
  teachingNowCount: number;
  currentDay: DayOfWeek;
}

export const ProfessorFilterBar: React.FC<ProfessorFilterBarProps> = ({
  filter,
  onFilterChange,
  totalProfessors,
  filteredCount,
  teachingNowCount,
  currentDay
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: '/' focuses search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        if (
          document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA'
        ) {
          return;
        }
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const hasActiveFilters =
    filter.searchQuery.trim() !== '' ||
    filter.selectedDay !== 'ALL' ||
    filter.selectedDepartment !== 'ALL' ||
    filter.selectedModality !== 'ALL' ||
    filter.onlyLiveNow ||
    filter.onlyToday ||
    filter.sortBy !== 'name_asc';

  const resetFilters = () => {
    onFilterChange({
      searchQuery: '',
      selectedDay: 'ALL',
      selectedDepartment: 'ALL',
      selectedModality: 'ALL',
      onlyLiveNow: false,
      onlyToday: false,
      sortBy: 'name_asc'
    });
  };

  return (
    <div className="professor-filter-bar glass-card">
      {/* Primary Search Input Row */}
      <div className="prof-search-row">
        <div className="prof-search-input-wrapper">
          <Search className="prof-search-icon" size={19} />
          <input
            ref={searchInputRef}
            type="text"
            className="prof-search-input"
            placeholder="Buscar docente por nombre, correo, código de curso (ej. CS2023) o aula (ej. A801)..."
            value={filter.searchQuery}
            onChange={e => onFilterChange({ searchQuery: e.target.value })}
            aria-label="Buscar docente"
          />
          {filter.searchQuery ? (
            <button
              type="button"
              className="prof-search-clear-btn"
              onClick={() => onFilterChange({ searchQuery: '' })}
              title="Limpiar búsqueda"
            >
              <X size={16} />
            </button>
          ) : (
            <kbd className="prof-search-shortcut" title="Presiona '/' para buscar">
              /
            </kbd>
          )}
        </div>

        {/* Sort Selector Dropdown */}
        <div className="prof-sort-wrapper">
          <ArrowUpDown size={15} className="prof-sort-icon" />
          <select
            className="prof-sort-select"
            value={filter.sortBy}
            onChange={e => onFilterChange({ sortBy: e.target.value as ProfessorSortOption })}
            aria-label="Ordenar docentes"
          >
            <option value="name_asc">Nombre: A → Z</option>
            <option value="name_desc">Nombre: Z → A</option>
            <option value="hours_desc">Más horas semanales</option>
            <option value="courses_desc">Más cursos a cargo</option>
            <option value="sessions_desc">Más sesiones semanales</option>
            <option value="students_desc">Más alumnos / vacantes</option>
          </select>
        </div>
      </div>

      {/* Filter Chips & Controls Row */}
      <div className="prof-controls-row">
        {/* Day Selector Pills */}
        <div className="prof-day-pills-group" role="group" aria-label="Filtrar por día de clase">
          <button
            type="button"
            className={`prof-day-pill ${filter.selectedDay === 'ALL' ? 'prof-day-pill--active' : ''}`}
            onClick={() => onFilterChange({ selectedDay: 'ALL' })}
          >
            Todos
          </button>
          {ALL_DAYS.map(day => {
            const isToday = currentDay === day;
            const isSelected = filter.selectedDay === day;

            return (
              <button
                key={day}
                type="button"
                className={`prof-day-pill ${isSelected ? 'prof-day-pill--active' : ''} ${isToday ? 'prof-day-pill--today' : ''}`}
                onClick={() => onFilterChange({ selectedDay: isSelected ? 'ALL' : day })}
                title={`Ver docentes que dictan los ${DAY_LABELS[day]}`}
              >
                <span>{day}</span>
                {isToday && <span className="today-dot" title="Hoy" />}
              </button>
            );
          })}
        </div>

        {/* Department / Carrera Selector */}
        <div className="prof-dept-select-wrap">
          <GraduationCap size={15} className="prof-dept-icon" />
          <select
            className="prof-dept-select"
            value={filter.selectedDepartment}
            onChange={e => onFilterChange({ selectedDepartment: e.target.value })}
            aria-label="Filtrar por departamento"
          >
            <option value="ALL">Todas las carreras / áreas</option>
            {Object.entries(DEPARTMENT_CONFIG).map(([code, config]) => (
              <option key={code} value={code}>
                {code !== 'OTRO' ? `${code} - ${config.label}` : config.label}
              </option>
            ))}
          </select>
        </div>

        {/* Quick Toggle Beacon Buttons */}
        <div className="prof-toggles-group">
          {/* Live Now Toggle */}
          <button
            type="button"
            className={`prof-toggle-btn ${filter.onlyLiveNow ? 'prof-toggle-btn--active prof-toggle-btn--live' : ''}`}
            onClick={() => onFilterChange({ onlyLiveNow: !filter.onlyLiveNow })}
            title="Mostrar únicamente docentes que se encuentran dictando clase en este momento"
          >
            <span className="live-beacon-dot" />
            <span>Dictando Ahora</span>
            {teachingNowCount > 0 && (
              <span className="toggle-badge">{teachingNowCount}</span>
            )}
          </button>

          {/* Today Toggle */}
          <button
            type="button"
            className={`prof-toggle-btn ${filter.onlyToday ? 'prof-toggle-btn--active' : ''}`}
            onClick={() => onFilterChange({ onlyToday: !filter.onlyToday })}
            title="Mostrar docentes que tienen clases programadas hoy"
          >
            <Calendar size={14} />
            <span>Clases Hoy</span>
          </button>

          {/* Modality Filter */}
          <div className="prof-modality-group">
            <button
              type="button"
              className={`prof-modality-btn ${filter.selectedModality === 'Presencial' ? 'prof-modality-btn--active' : ''}`}
              onClick={() =>
                onFilterChange({
                  selectedModality: filter.selectedModality === 'Presencial' ? 'ALL' : 'Presencial'
                })
              }
              title="Solo docentes con clases presenciales en campus"
            >
              Presencial
            </button>
          </div>

          {/* Clear Filters Button if any active */}
          {hasActiveFilters && (
            <button
              type="button"
              className="prof-reset-btn"
              onClick={resetFilters}
              title="Restablecer todos los filtros"
            >
              <RotateCcw size={13} />
              <span>Restablecer</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Results Summary Strip */}
      <div className="prof-filter-meta-strip">
        <div className="prof-results-text">
          <span>
            Mostrando <strong>{filteredCount}</strong> de {totalProfessors} docentes
          </span>
          {filter.selectedDepartment !== 'ALL' && (
            <span className="active-tag-chip">
              {DEPARTMENT_CONFIG[filter.selectedDepartment]?.label || filter.selectedDepartment}
              <button
                type="button"
                onClick={() => onFilterChange({ selectedDepartment: 'ALL' })}
              >
                ×
              </button>
            </span>
          )}
          {filter.selectedDay !== 'ALL' && (
            <span className="active-tag-chip">
              {DAY_LABELS[filter.selectedDay]}
              <button
                type="button"
                onClick={() => onFilterChange({ selectedDay: 'ALL' })}
              >
                ×
              </button>
            </span>
          )}
          {filter.onlyLiveNow && (
            <span className="active-tag-chip active-tag-chip--live">
              En clase ahora
              <button
                type="button"
                onClick={() => onFilterChange({ onlyLiveNow: false })}
              >
                ×
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
