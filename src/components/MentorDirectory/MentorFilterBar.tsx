import React, { useRef, useEffect } from 'react';
import type { DayOfWeek } from '../../types/schedule';
import type { MentorFilterState, MentorSortOption } from '../../types/mentor';
import { ALL_DAYS, DAY_LABELS } from '../../utils/classroomUtils';
import { CustomSelect } from '../common/CustomSelect';
import {
  Search,
  X,
  RotateCcw,
  Calendar,
  Building2,
  Video,
  ArrowUpDown,
  BookOpen,
  GraduationCap
} from 'lucide-react';

interface UniqueCourseOption {
  code: string;
  name: string;
}

interface MentorFilterBarProps {
  filter: MentorFilterState;
  onFilterChange: (updates: Partial<MentorFilterState>) => void;
  availableCourses: UniqueCourseOption[];
  availableDepartments: { code: string; name: string }[];
  currentDay: DayOfWeek;
  totalFiltered: number;
  totalAll: number;
  liveNowCount: number;
}

export const MentorFilterBar: React.FC<MentorFilterBarProps> = ({
  filter,
  onFilterChange,
  availableCourses,
  availableDepartments,
  currentDay,
  totalFiltered,
  totalAll,
  liveNowCount
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
    filter.selectedModality !== 'ALL' ||
    filter.selectedCourse !== 'ALL' ||
    filter.selectedDepartment !== 'ALL' ||
    filter.onlyLiveNow ||
    filter.onlyToday ||
    filter.sortBy !== 'name_asc';

  const resetFilters = () => {
    onFilterChange({
      searchQuery: '',
      selectedDay: 'ALL',
      selectedModality: 'ALL',
      selectedCourse: 'ALL',
      selectedDepartment: 'ALL',
      onlyLiveNow: false,
      onlyToday: false,
      sortBy: 'name_asc'
    });
  };

  return (
    <div className="professor-filter-bar glass-card mentor-filter-bar">
      {/* Primary Search Input Row */}
      <div className="prof-search-row">
        <div className="prof-search-input-wrapper">
          <Search className="prof-search-icon" size={19} />
          <input
            ref={searchInputRef}
            type="text"
            className="prof-search-input"
            placeholder="Buscar mentor por nombre, correo, curso (ej. Cálculo, CS6002), o aula (ej. S1101)..."
            value={filter.searchQuery}
            onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
            aria-label="Buscar mentor académico"
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

        {/* Sort Selector Dropdown using CustomSelect */}
        <CustomSelect
          value={filter.sortBy}
          onChange={(val) => onFilterChange({ sortBy: val as MentorSortOption })}
          options={[
            { value: 'name_asc', label: 'Nombre: A → Z' },
            { value: 'name_desc', label: 'Nombre: Z → A' },
            { value: 'course_asc', label: 'Curso: A → Z' },
            { value: 'day_asc', label: 'Día de la semana' },
            { value: 'time_asc', label: 'Horario más temprano' }
          ]}
          icon={<ArrowUpDown size={15} />}
          align="right"
          ariaLabel="Ordenar mentores"
        />
      </div>

      {/* Filter Chips & Controls Row */}
      <div className="prof-controls-row">
        {/* Day Selector Pills */}
        <div className="prof-day-pills-group" role="group" aria-label="Filtrar por día de asesoría">
          <button
            type="button"
            className={`prof-day-pill ${filter.selectedDay === 'ALL' ? 'prof-day-pill--active' : ''}`}
            onClick={() => onFilterChange({ selectedDay: 'ALL' })}
          >
            Todos
          </button>
          {ALL_DAYS.map((day) => {
            const isToday = currentDay === day;
            const isSelected = filter.selectedDay === day;

            return (
              <button
                key={day}
                type="button"
                className={`prof-day-pill ${isSelected ? 'prof-day-pill--active' : ''} ${isToday ? 'prof-day-pill--today' : ''}`}
                onClick={() => onFilterChange({ selectedDay: isSelected ? 'ALL' : day })}
                title={`Ver mentores con asesorías los ${DAY_LABELS[day]}`}
              >
                <span>{day}</span>
                {isToday && <span className="today-dot" title="Hoy" />}
              </button>
            );
          })}
        </div>

        {/* Course CustomSelect */}
        <CustomSelect
          value={filter.selectedCourse}
          onChange={(val) => onFilterChange({ selectedCourse: val })}
          options={[
            { value: 'ALL', label: `Todos los Cursos (${availableCourses.length})` },
            ...availableCourses.map((c) => ({
              value: c.code,
              label: c.name,
              badge: c.code,
              badgeColor: '#3b82f6'
            }))
          ]}
          icon={<BookOpen size={15} />}
          searchable={true}
          searchPlaceholder="Buscar curso o código..."
          placeholder="Todos los Cursos"
          ariaLabel="Filtrar por curso"
        />

        {/* Department / Carrera CustomSelect */}
        <CustomSelect
          value={filter.selectedDepartment}
          onChange={(val) => onFilterChange({ selectedDepartment: val })}
          options={[
            { value: 'ALL', label: 'Todas las áreas académicas' },
            ...availableDepartments.map((d) => ({
              value: d.code,
              label: d.name,
              badge: d.code,
              badgeColor: '#8b5cf6'
            }))
          ]}
          icon={<GraduationCap size={15} />}
          searchPlaceholder="Buscar área académica..."
          placeholder="Todas las áreas"
          ariaLabel="Filtrar por carrera o área"
        />

        {/* Quick Toggles Group */}
        <div className="prof-toggles-group">
          {/* Live Now Toggle */}
          <button
            type="button"
            className={`prof-toggle-btn ${filter.onlyLiveNow ? 'prof-toggle-btn--active prof-toggle-btn--live' : ''}`}
            onClick={() => onFilterChange({ onlyLiveNow: !filter.onlyLiveNow })}
            title="Mostrar únicamente mentores que se encuentran en sesión en este momento"
          >
            <span className="live-beacon-dot" />
            <span>En Mentoría Ahora</span>
            {liveNowCount > 0 && (
              <span className="toggle-badge">{liveNowCount}</span>
            )}
          </button>

          {/* Today Toggle */}
          <button
            type="button"
            className={`prof-toggle-btn ${filter.onlyToday ? 'prof-toggle-btn--active' : ''}`}
            onClick={() => onFilterChange({ onlyToday: !filter.onlyToday })}
            title={`Mostrar mentores que tienen asesorías programadas hoy (${currentDay})`}
          >
            <Calendar size={14} />
            <span>Sesiones Hoy</span>
          </button>

          {/* Modality Filter Buttons */}
          <div className="prof-modality-group">
            <button
              type="button"
              className={`prof-modality-btn ${filter.selectedModality === 'Presencial' ? 'prof-modality-btn--active' : ''}`}
              onClick={() =>
                onFilterChange({
                  selectedModality: filter.selectedModality === 'Presencial' ? 'ALL' : 'Presencial'
                })
              }
              title="Solo mentorías presenciales en campus UTEC"
            >
              <Building2 size={13} style={{ marginRight: 4, display: 'inline' }} />
              Presencial
            </button>
            <button
              type="button"
              className={`prof-modality-btn ${filter.selectedModality === 'Virtual' ? 'prof-modality-btn--active' : ''}`}
              onClick={() =>
                onFilterChange({
                  selectedModality: filter.selectedModality === 'Virtual' ? 'ALL' : 'Virtual'
                })
              }
              title="Solo mentorías virtuales"
            >
              <Video size={13} style={{ marginRight: 4, display: 'inline' }} />
              Virtual
            </button>
          </div>

          {/* Clear Filters Button if any active */}
          {hasActiveFilters && (
            <button
              type="button"
              className="prof-clear-filters-btn"
              onClick={resetFilters}
              title="Restablecer filtros"
            >
              <RotateCcw size={14} />
              <span>Limpiar ({totalFiltered} de {totalAll})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
