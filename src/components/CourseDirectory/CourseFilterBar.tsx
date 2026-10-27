import React, { useRef, useEffect } from 'react';
import type { DayOfWeek } from '../../types/schedule';
import type { CourseFilterState, CourseSortOption } from '../../types/courseDirectory';
import { ALL_DAYS, DAY_LABELS } from '../../utils/classroomUtils';
import { DEPARTMENT_CONFIG } from '../../utils/professorUtils';
import { CustomSelect, type SelectOption } from '../common/CustomSelect';
import {
  Search,
  X,
  RotateCcw,
  Radio,
  Star,
  GraduationCap,
  Layers,
  ArrowUpDown,
  Laptop,
  Calendar
} from 'lucide-react';

interface CourseFilterBarProps {
  filter: CourseFilterState;
  onFilterChange: (updates: Partial<CourseFilterState>) => void;
  totalCourses: number;
  filteredCount: number;
  liveNowCount: number;
  visitorCount: number;
  currentDay: DayOfWeek;
}

export const CourseFilterBar: React.FC<CourseFilterBarProps> = ({
  filter,
  onFilterChange,
  totalCourses,
  filteredCount,
  liveNowCount,
  visitorCount,
  currentDay
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut '/' to quickly focus the search bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        if (!['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement as HTMLElement)?.tagName)) {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isFiltered =
    Boolean(filter.searchQuery.trim()) ||
    filter.selectedDepartment !== 'ALL' ||
    filter.selectedDay !== 'ALL' ||
    filter.selectedModality !== 'ALL' ||
    filter.onlyLiveNow ||
    filter.onlyVisitor ||
    filter.sortBy !== 'code_asc';

  const handleReset = () => {
    onFilterChange({
      searchQuery: '',
      selectedDepartment: 'ALL',
      selectedDay: 'ALL',
      selectedModality: 'ALL',
      onlyLiveNow: false,
      onlyVisitor: false,
      sortBy: 'code_asc'
    });
  };

  // Department options for CustomSelect
  const departmentOptions: SelectOption[] = [
    { value: 'ALL', label: 'Todas las carreras / áreas' },
    ...Object.entries(DEPARTMENT_CONFIG).map(([code, config]) => ({
      value: code,
      label: config.label,
      badge: code !== 'OTRO' ? code : undefined,
      badgeColor: config.color
    }))
  ];

  // Modality options for CustomSelect
  const modalityOptions: SelectOption[] = [
    { value: 'ALL', label: 'Todas las modalidades' },
    { value: 'Presencial', label: 'Presencial (Campus UTEC)', badge: 'Campus', badgeColor: '#10b981' },
    { value: 'Sincronico', label: 'Sincrónico / Virtual', badge: 'Virtual', badgeColor: '#3b82f6' }
  ];

  // Sort options for CustomSelect (without vacancies)
  const sortOptions: SelectOption[] = [
    { value: 'code_asc', label: 'Código: A → Z' },
    { value: 'code_desc', label: 'Código: Z → A' },
    { value: 'name_asc', label: 'Nombre: A → Z' },
    { value: 'name_desc', label: 'Nombre: Z → A' },
    { value: 'sections_desc', label: 'Más secciones ofertadas' },
    { value: 'hours_desc', label: 'Más horas semanales' }
  ];

  return (
    <div className="classroom-filter-bar glass-card course-filter-bar">
      {/* Primary Search Input Row */}
      <div className="prof-search-row course-search-row">
        <div className="prof-search-input-wrapper">
          <Search className="prof-search-icon" size={19} />
          <input
            ref={searchInputRef}
            type="text"
            className="prof-search-input"
            placeholder="Buscar por código (ej: CC1103), nombre, docente o aula..."
            value={filter.searchQuery}
            onChange={e => onFilterChange({ searchQuery: e.target.value })}
            autoComplete="off"
            spellCheck="false"
            aria-label="Buscar curso"
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
          onChange={val => onFilterChange({ sortBy: val as CourseSortOption })}
          options={sortOptions}
          icon={<ArrowUpDown size={15} />}
          align="right"
          ariaLabel="Ordenar cursos"
        />
      </div>

      {/* Filter Controls Row: Day Pills, Custom Dropdowns & Quick Beacons */}
      <div className="prof-controls-row course-controls-row">
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
                title={`Ver cursos con clases los ${DAY_LABELS[day]}`}
              >
                <span>{day}</span>
                {isToday && <span className="today-dot" title="Hoy" />}
              </button>
            );
          })}
        </div>

        {/* Department / Carrera Selector using CustomSelect */}
        <CustomSelect
          value={filter.selectedDepartment}
          onChange={val => onFilterChange({ selectedDepartment: val })}
          options={departmentOptions}
          icon={<GraduationCap size={15} />}
          searchPlaceholder="Buscar carrera o área..."
          ariaLabel="Filtrar por carrera o área"
        />

        {/* Modality Selector using CustomSelect */}
        <CustomSelect
          value={filter.selectedModality}
          onChange={val => onFilterChange({ selectedModality: val as 'ALL' | 'Presencial' | 'Sincronico' })}
          options={modalityOptions}
          icon={<Laptop size={15} />}
          ariaLabel="Filtrar por modalidad"
        />

        {/* Quick Toggle Beacon Buttons */}
        <div className="prof-toggles-group course-toggles-group">
          {/* Live Now Toggle */}
          <button
            type="button"
            className={`prof-toggle-btn course-quick-pill--live ${filter.onlyLiveNow ? 'prof-toggle-btn--active prof-toggle-btn--live' : ''}`}
            onClick={() => onFilterChange({ onlyLiveNow: !filter.onlyLiveNow })}
            title="Mostrar únicamente cursos con clases en este momento"
          >
            <Radio size={14} className={filter.onlyLiveNow ? 'live-spin' : ''} />
            <span>En vivo ahora</span>
            {liveNowCount > 0 && <span className="pill-count-bubble">{liveNowCount}</span>}
          </button>

          {/* Visitor Saved Courses Toggle */}
          <button
            type="button"
            className={`prof-toggle-btn course-quick-pill--visitor ${filter.onlyVisitor ? 'course-quick-pill--active-visitor' : ''}`}
            onClick={() => onFilterChange({ onlyVisitor: !filter.onlyVisitor })}
            title="Mostrar mis cursos guardados para asistir como visitante (oyente)"
          >
            <Star size={14} className={visitorCount > 0 ? 'star-filled-gold' : ''} />
            <span>Mis Visitados</span>
            {visitorCount > 0 && <span className="pill-count-bubble">{visitorCount}</span>}
          </button>

          {/* Reset Filters button */}
          {isFiltered && (
            <button
              type="button"
              className="btn btn-secondary filter-reset-btn"
              onClick={handleReset}
              title="Restablecer todos los filtros"
            >
              <RotateCcw size={14} />
              <span>Limpiar</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Stats Counter */}
      <div className="filter-count-feedback">
        <span className="filter-count-highlight">
          Mostrando <strong>{filteredCount}</strong> de <strong>{totalCourses}</strong> cursos ofertados
        </span>
        {filter.onlyVisitor && (
          <span className="visitor-filter-indicator">
            <Star size={12} className="star-filled-gold" /> Filtrando tus cursos guardados como visitante
          </span>
        )}
      </div>
    </div>
  );
};
