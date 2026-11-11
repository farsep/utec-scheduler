import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { DayOfWeek } from '../../types/schedule';
import type { ClassroomInfo, ClassroomFilterState, ClassroomAvailability } from '../../types/classroom';
import {
  extractClassroomsFromCourses,
  evaluateClassroom,
  getCurrentDayAndMinutes,
  ALL_DAYS,
  ROOM_TYPE_LABELS,
  resolveCanonicalRoom
} from '../../utils/classroomUtils';
import { minutesToTime } from '../../utils/scheduleUtils';
import { getClassroomsCatalog, getSynchronousCachedClassrooms } from '../../utils/masterDataLoader';
import { ClassroomNavbar } from './ClassroomNavbar';
import { ClassroomFilterBar } from './ClassroomFilterBar';
import { ClassroomCard } from './ClassroomCard';
import { ClassroomDetailModal } from './ClassroomDetailModal';
import { BroadcastIcon } from '../common/BroadcastIcon';
import { ArchitecturalEmptyState } from '../common/ArchitecturalEmptyState';
import {
  Building2,
  LayoutGrid,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Layers,
  ChevronDown,
  ArrowUp
} from 'lucide-react';

interface ClassroomAppProps {
  hideTopNavbar?: boolean;
}

interface ArchitecturalFloorLevel {
  floor: number;
  title: string;
}

const UTEC_ARCHITECTURAL_FLOORS: ArchitecturalFloorLevel[] = [
  { floor: 10, title: 'Piso 10 · Aulas y Salas de Estudio' },
  { floor: 9, title: 'Piso 9 · Aulas de Docencia' },
  { floor: 8, title: 'Piso 8 · Aulas y Mesas Colaborativas' },
  { floor: 7, title: 'Piso 7 · Aulas de Cátedra' },
  { floor: 6, title: 'Piso 6 · Aulas, Laboratorios y Mesas' },
  { floor: 5, title: 'Piso 5 · Aulas y Laboratorios' },
  { floor: 4, title: 'Piso 4 · Aulas Magistrales y Laboratorios' },
  { floor: 3, title: 'Piso 3 · Aulas y Mesas de Trabajo' },
  { floor: 2, title: 'Piso 2 · Aulas y Laboratorios' },
  { floor: 1, title: 'Piso 1 · Auditorios, Aula Magna y Laboratorios' },
];

export const ClassroomApp: React.FC<ClassroomAppProps> = ({ hideTopNavbar = false }) => {
  const initialTime = getCurrentDayAndMinutes();
  const cachedClassrooms = getSynchronousCachedClassrooms();

  const [classrooms, setClassrooms] = useState<ClassroomInfo[]>(() => cachedClassrooms || []);
  const [isLoading, setIsLoading] = useState<boolean>(() => !cachedClassrooms || cachedClassrooms.length === 0);
  const [loadError, setLoadError] = useState<string | null>(null);

  // System real-time clock that ticks every second
  const [realTime, setRealTime] = useState<{ day: DayOfWeek; minutes: number; timeStr: string }>(initialTime);

  // Live simulation mode
  const [isSimulatedTime, setIsSimulatedTime] = useState<boolean>(false);
  const [simulatedMinutes, setSimulatedMinutes] = useState<number>(initialTime.minutes);

  // Filter State
  const [filter, setFilter] = useState<ClassroomFilterState>({
    searchQuery: '',
    selectedDay: initialTime.day,
    mode: 'live_now',
    startTime: '10:00',
    endTime: '12:00',
    startMinutes: 600,
    endMinutes: 720,
    selectedFloor: 'ALL',
    selectedType: 'ALL',
    minFreeHours: 0,
    sortBy: 'floor_asc'
  });

  // Selected room for detailed view modal
  const [selectedRoom, setSelectedRoom] = useState<ClassroomInfo | null>(null);

  const handleOpenDetail = useCallback((cls: ClassroomInfo) => {
    setSelectedRoom(cls);
  }, []);

  // Toggle to show occupied rooms as well (default: show free first, with toggle)
  const [showOccupiedRooms, setShowOccupiedRooms] = useState<boolean>(false);

  // Sub-view Mode: Direct Classroom Availability & Search (Default) vs Grafton Vertical Campus (Floors & Levels)
  const [subMode, setSubMode] = useState<'directory' | 'floors'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const v = params.get('vista') || params.get('view');
      if (v === 'pisos' || v === 'campus' || v === 'floors') return 'floors';
    }
    return 'directory';
  });

  const handleSwitchSubMode = useCallback((mode: 'directory' | 'floors') => {
    setSubMode(mode);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (mode === 'floors') {
        url.searchParams.set('vista', 'pisos');
      } else {
        url.searchParams.delete('vista');
        url.searchParams.delete('view');
      }
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkVistaParam = () => {
      const params = new URLSearchParams(window.location.search);
      const v = params.get('vista') || params.get('view');
      if (v === 'pisos' || v === 'campus' || v === 'floors') {
        setSubMode('floors');
      } else {
        setSubMode('directory');
      }
    };
    window.addEventListener('popstate', checkVistaParam);
    return () => window.removeEventListener('popstate', checkVistaParam);
  }, []);

  // Floating back to top button visibility for mobile
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 380);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Real-time ticker: only triggers React re-render when the minute actually ticks
  useEffect(() => {
    const interval = setInterval(() => {
      const current = getCurrentDayAndMinutes();
      setRealTime(prev => {
        if (prev.minutes === current.minutes && prev.day === current.day) {
          return prev;
        }
        return current;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Effective minutes for live mode (real or simulated)
  const effectiveLiveMinutes = isSimulatedTime ? simulatedMinutes : realTime.minutes;
  const effectiveLiveTimeStr = minutesToTime(effectiveLiveMinutes);

  // Handlers for real-time live clock changes
  const handleStepLiveTime = (deltaMinutes: number) => {
    setIsSimulatedTime(true);
    setSimulatedMinutes(prev => {
      const base = isSimulatedTime ? prev : realTime.minutes;
      return Math.max(420, Math.min(1320, base + deltaMinutes));
    });
  };

  const handleSetLiveTime = (timeStr: string) => {
    if (!timeStr) return;
    const [h, m] = timeStr.split(':').map(Number);
    setIsSimulatedTime(true);
    setSimulatedMinutes(h * 60 + m);
  };

  const handleResetRealTime = () => {
    setIsSimulatedTime(false);
    setSimulatedMinutes(realTime.minutes);
  };

  // Data source info
  const [dataSourceInfo, setDataSourceInfo] = useState<{
    type: 'intranet' | 'excel';
    weekRange?: { start: string; end: string };
    totalEvents?: number;
    updatedAt?: string;
  }>({ type: 'intranet' });

  // Load schedule on mount (intranet live JSON with Excel fallback via masterDataLoader)
  const loadMasterSchedule = useCallback(async () => {
    if (!classrooms.length) {
      setIsLoading(true);
    }
    setLoadError(null);
    try {
      const extractedRooms = await getClassroomsCatalog();
      setClassrooms(extractedRooms);
    } catch (err: any) {
      console.error('Error cargando datos de horarios:', err);
      setLoadError(err?.message || 'Error al cargar datos de horarios');
    } finally {
      setIsLoading(false);
    }
  }, [classrooms.length]);

  useEffect(() => {
    loadMasterSchedule();
  }, [loadMasterSchedule]);

  // Deep-link auto-open via ?aula=CODE URL parameter (and on popstate)
  useEffect(() => {
    if (!classrooms.length || typeof window === 'undefined') return;

    const checkUrlParam = () => {
      const params = new URLSearchParams(window.location.search);
      const aulaParam = params.get('aula') || params.get('search');
      if (!aulaParam) return;

      const canonical = resolveCanonicalRoom(aulaParam);
      const targetRoom = classrooms.find(
        c => c.code.toUpperCase() === canonical.code.toUpperCase() ||
             c.displayName.toLowerCase() === canonical.displayName.toLowerCase() ||
             c.code.toUpperCase() === aulaParam.toUpperCase()
      );

      if (targetRoom) {
        // Reset restrictive filters so the requested room is displayed
        setFilter(prev => {
          const updates: Partial<ClassroomFilterState> = {};
          if (prev.selectedFloor !== 'ALL' && prev.selectedFloor !== targetRoom.floor) {
            updates.selectedFloor = 'ALL';
          }
          if (prev.selectedType !== 'ALL' && prev.selectedType !== targetRoom.type) {
            updates.selectedType = 'ALL';
          }
          if (prev.searchQuery) {
            updates.searchQuery = '';
          }
          return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
        });

        setSelectedRoom(targetRoom);

        setTimeout(() => {
          const el = document.getElementById(`room-card-${targetRoom.code}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 120);
      }
    };

    checkUrlParam();
    window.addEventListener('popstate', checkUrlParam);
    return () => window.removeEventListener('popstate', checkUrlParam);
  }, [classrooms]);

  const handleFilterChange = (updates: Partial<ClassroomFilterState>) => {
    setFilter(prev => ({ ...prev, ...updates }));
  };

  const handleResetFilters = () => {
    const current = getCurrentDayAndMinutes();
    setIsSimulatedTime(false);
    setSimulatedMinutes(current.minutes);
    setFilter({
      searchQuery: '',
      selectedDay: current.day,
      mode: 'live_now',
      startTime: '10:00',
      endTime: '12:00',
      startMinutes: 600,
      endMinutes: 720,
      selectedFloor: 'ALL',
      selectedType: 'ALL',
      minFreeHours: 0,
      sortBy: 'floor_asc'
    });
  };

  // Evaluate all classrooms for current filter state
  const evaluatedClassrooms: ClassroomAvailability[] = useMemo(() => {
    const nowForEvaluation = filter.mode === 'live_now' ? effectiveLiveMinutes : filter.startMinutes;
    return classrooms.map(c => evaluateClassroom(c, filter, nowForEvaluation));
  }, [classrooms, filter, effectiveLiveMinutes]);

  // Check if a classroom item matches filters OTHER THAN floor (room type, text search query)
  const matchesNonFloorFilters = useCallback((item: ClassroomAvailability) => {
    const { classroom } = item;

    // Room Type filter
    if (filter.selectedType !== 'ALL' && classroom.type !== filter.selectedType) {
      return false;
    }

    // Text query search
    const query = filter.searchQuery.trim().toLowerCase();
    if (query) {
      const matchCode = classroom.code.toLowerCase().includes(query);
      const matchName = classroom.displayName.toLowerCase().includes(query);
      const matchFloor = `piso ${classroom.floor}`.includes(query);
      const matchType = (ROOM_TYPE_LABELS[classroom.type]?.label || '').toLowerCase().includes(query);
      if (!matchCode && !matchName && !matchFloor && !matchType) {
        return false;
      }
    }

    return true;
  }, [filter.selectedType, filter.searchQuery]);

  // Count available rooms per floor, dynamically reflecting the active type and search filters
  const { floorCounts, totalAvailableAllFloors } = useMemo(() => {
    const counts: Record<number | string, number> = {};
    for (let f = 1; f <= 10; f++) counts[f] = 0;
    let totalAllFloors = 0;

    evaluatedClassrooms.forEach(item => {
      if (item.isAvailableForSearch && matchesNonFloorFilters(item)) {
        counts[item.classroom.floor] = (counts[item.classroom.floor] || 0) + 1;
        totalAllFloors++;
      }
    });

    counts['ALL'] = totalAllFloors;
    return { floorCounts: counts, totalAvailableAllFloors: totalAllFloors };
  }, [evaluatedClassrooms, matchesNonFloorFilters]);

  // Filter and sort rooms
  const { availableRoomsList, busyRoomsList } = useMemo(() => {
    const matchesFilters = (item: ClassroomAvailability) => {
      // Floor filter
      if (filter.selectedFloor !== 'ALL' && item.classroom.floor !== filter.selectedFloor) {
        return false;
      }
      return matchesNonFloorFilters(item);
    };

    const sortFn = (a: ClassroomAvailability, b: ClassroomAvailability) => {
      switch (filter.sortBy) {
        case 'floor_desc':
          if (b.classroom.floor !== a.classroom.floor) return b.classroom.floor - a.classroom.floor;
          return a.classroom.code.localeCompare(b.classroom.code);
        case 'free_time':
          return b.totalFreeMinutesToday - a.totalFreeMinutesToday;
        case 'name':
          return a.classroom.code.localeCompare(b.classroom.code);
        case 'floor_asc':
        default:
          if (a.classroom.floor !== b.classroom.floor) return a.classroom.floor - b.classroom.floor;
          return a.classroom.code.localeCompare(b.classroom.code);
      }
    };

    const available: ClassroomAvailability[] = [];
    const busy: ClassroomAvailability[] = [];

    evaluatedClassrooms.forEach(item => {
      if (!matchesFilters(item)) return;

      if (item.isAvailableForSearch) {
        available.push(item);
      } else {
        busy.push(item);
      }
    });

    available.sort(sortFn);
    busy.sort(sortFn);

    return { availableRoomsList: available, busyRoomsList: busy };
  }, [evaluatedClassrooms, filter.selectedFloor, filter.sortBy, matchesNonFloorFilters]);

  const totalAvailable = availableRoomsList.length;
  const isToday = filter.selectedDay === realTime.day;

  return (
    <div className="classroom-finder-root">
      {/* Top Navigation */}
      {!hideTopNavbar && (
        <ClassroomNavbar
          totalRooms={classrooms.length}
          availableRooms={totalAvailableAllFloors}
        />
      )}

      {/* Sub-view Bar: Curricular Graph style view switcher */}
      <div className="dag-submode-bar classroom-submode-bar">
        <div className="dag-submode-inner">
          <div className="dag-submode-tabs" role="tablist" aria-label="Modo de exploración de aulas">
            <button
              type="button"
              className={`dag-submode-btn classroom-submode-btn ${subMode === 'directory' ? 'is-active' : ''}`}
              onClick={() => handleSwitchSubMode('directory')}
              role="tab"
              aria-selected={subMode === 'directory'}
            >
              <LayoutGrid size={14} />
              <span className="submode-txt-full">Directorio y Disponibilidad de Aulas (Buscador & Horarios)</span>
              <span className="submode-txt-short">Directorio de Aulas</span>
            </button>
            <button
              type="button"
              className={`dag-submode-btn classroom-submode-btn ${subMode === 'floors' ? 'is-active' : ''}`}
              onClick={() => handleSwitchSubMode('floors')}
              role="tab"
              aria-selected={subMode === 'floors'}
            >
              <Building2 size={14} />
              <span className="submode-txt-full">Campus Vertical Grafton Architects (Pisos y Niveles)</span>
              <span className="submode-txt-short">Campus Vertical (Pisos)</span>
            </button>
          </div>

          <div className="dag-submode-legend classroom-submode-legend">
            <span className="dag-legend-item">
              <span className="dag-legend-swatch dag-legend-swatch--emerald" />
              <span>{totalAvailableAllFloors} Libres</span>
            </span>
            <span className="dag-legend-item">
              <span className="dag-legend-swatch dag-legend-swatch--amber" />
              <span>{classrooms.length - totalAvailableAllFloors} En clase</span>
            </span>
            <span className="dag-legend-item">
              <span className="dag-legend-swatch dag-legend-swatch--cyan" />
              <span>10 Pisos UTEC</span>
            </span>
          </div>
        </div>
      </div>

      <main className="classroom-finder-main">
        {/* Hero Banner Section */}
        <div className="classroom-hero-banner glass-card">
          <div className="hero-content">
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
              <div className="hero-chip" style={{ marginBottom: 0 }}>
                <Building2 size={14} className="hero-chip-icon" />
                <span>Buscador Inteligente de Espacios UTEC</span>
              </div>
              {dataSourceInfo.type === 'intranet' && (
                <div
                  className="hero-chip"
                  style={{
                    marginBottom: 0,
                    background: 'rgba(16, 185, 129, 0.15)',
                    borderColor: 'rgba(16, 185, 129, 0.4)',
                    color: '#34d399'
                  }}
                  title={`Sincronizado con Intranet de Reservas UTEC (${dataSourceInfo.weekRange ? `Semana ${dataSourceInfo.weekRange.start} - ${dataSourceInfo.weekRange.end}` : ''})`}
                >
                  <BroadcastIcon className="w-3.5 h-3.5 shrink-0 inline text-[#10b981]" />
                  <span>Intranet UTEC en Vivo ({dataSourceInfo.totalEvents?.toLocaleString() || 0} reservas)</span>
                </div>
              )}
            </div>
            <h1 className="hero-title">
              Encuentra <span className="gradient-text">Aulas y Espacios Libres</span> al instante
            </h1>
            <p className="hero-subtitle">
              Consulta en tiempo real la disponibilidad de aulas, laboratorios y mesas de trabajo entre pisos de UTEC.
              Filtra por horario o descubre qué espacios están desocupados en este preciso momento.
            </p>
          </div>

          <div className="hero-kpi-badges prof-hero-kpi-badges classroom-hero-kpi-badges">
            <div className="hero-kpi-badge prof-hero-kpi-card prof-hero-kpi-card--live">
              <div className="prof-kpi-card-header">
                <div className="prof-kpi-icon-wrap prof-kpi-icon-wrap--emerald">
                  <CheckCircle2 size={16} />
                </div>
                <span className="prof-kpi-badge-pill prof-kpi-badge-pill--live">
                  <BroadcastIcon className="w-3.5 h-3.5 shrink-0 inline mr-1" /> En Vivo
                </span>
              </div>
              <span className="kpi-num text-emerald">{totalAvailable}</span>
              <span className="kpi-txt">Aulas Libres</span>
            </div>
            <div className="hero-kpi-badge prof-hero-kpi-card">
              <div className="prof-kpi-card-header">
                <div className="prof-kpi-icon-wrap prof-kpi-icon-wrap--blue">
                  <Building2 size={16} />
                </div>
                <span className="prof-kpi-badge-pill">Campus</span>
              </div>
              <span className="kpi-num text-accent">{classrooms.length}</span>
              <span className="kpi-txt">
                <span className="kpi-txt-full">Espacios Totales</span>
                <span className="kpi-txt-short">Espacios</span>
              </span>
            </div>
            <div className="hero-kpi-badge prof-hero-kpi-card">
              <div className="prof-kpi-card-header">
                <div className="prof-kpi-icon-wrap prof-kpi-icon-wrap--purple">
                  <Layers size={16} />
                </div>
                <span className="prof-kpi-badge-pill">Niveles</span>
              </div>
              <span className="kpi-num text-purple">10</span>
              <span className="kpi-txt">Pisos UTEC</span>
            </div>
          </div>
        </div>

        {/* Load Error Banner if any */}
        {loadError && (
          <div className="classroom-error-banner">
            <AlertCircle size={18} />
            <span>{loadError}</span>
            <button className="btn btn-secondary btn-sm" onClick={loadMasterSchedule}>
              Reintentar
            </button>
          </div>
        )}

        {/* Filter Bar */}
        <ClassroomFilterBar
          filter={filter}
          onChangeFilter={handleFilterChange}
          systemDay={realTime.day}
          systemTimeStr={realTime.timeStr}
          isSimulatedTime={isSimulatedTime}
          activeLiveTimeStr={effectiveLiveTimeStr}
          onStepLiveTime={handleStepLiveTime}
          onSetLiveTime={handleSetLiveTime}
          onResetRealTime={handleResetRealTime}
          floorCounts={floorCounts}
          totalAvailable={totalAvailable}
          totalRooms={classrooms.length}
          onResetFilters={handleResetFilters}
        />

        {/* Conditional View: Campus Vertical by Floors VS Directory Cards Grid */}
        {subMode === 'floors' ? (
          /* UTEC Barranco Architectural Floor Explorer (Grafton Swiss Concrete) */
          !isLoading && evaluatedClassrooms.length > 0 && (
            <section className="grafton-card campus-floor-explorer" aria-label="Explorador por pisos UTEC Barranco">
              <div className="campus-floor-explorer__head">
                <div>
                  <div className="dag-eyebrow">CAMPUS VERTICAL GRAFTON ARCHITECTS · BARRANCO</div>
                  <h2 className="campus-floor-explorer__title">
                    Aulas y Laboratorios por Niveles (Estado en Tiempo Real)
                  </h2>
                </div>
                <span className="campus-floor-explorer__meta">
                  {totalAvailableAllFloors} libres de {classrooms.length} espacios
                </span>
              </div>

              <div className="campus-floor-groups">
                {UTEC_ARCHITECTURAL_FLOORS.map(level => {
                  const floorRooms = evaluatedClassrooms
                    .filter(item => item.classroom.floor === level.floor)
                    .sort((a, b) => {
                      if (a.isAvailableForSearch !== b.isAvailableForSearch) {
                        return a.isAvailableForSearch ? -1 : 1;
                      }
                      return a.classroom.code.localeCompare(b.classroom.code);
                    });

                  if (floorRooms.length === 0) return null;

                  const availableCount = floorRooms.filter(r => r.isAvailableForSearch).length;

                  return (
                    <div key={`floor-${level.floor}`} className="campus-floor-band">
                      <div className="campus-floor-band__header">
                        <span className="campus-floor-band__title">{level.title}</span>
                        <span className="campus-floor-band__count">
                          {availableCount} libres / {floorRooms.length}
                        </span>
                      </div>

                      <div className="campus-floor-chips">
                        {floorRooms.map(item => {
                          const isFree = item.isAvailableForSearch;
                          return (
                            <button
                              key={item.classroom.id}
                              type="button"
                              className={`campus-room-chip ${isFree ? 'is-free' : 'is-busy'} cursor-pointer hover:border-[#18181A] hover:shadow-[2px_2px_0px_#18181A] transition-all`}
                              onClick={() => handleOpenDetail(item.classroom)}
                              title={`${item.classroom.displayName} — Clic para ver horario semanal`}
                            >
                              <span className="campus-room-chip__code">
                                {isFree ? '●' : '○'} {item.classroom.code}
                              </span>
                              <span className="campus-room-chip__state">
                                {isFree ? `Libre · Piso ${item.classroom.floor}` : 'En clase'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )
        ) : (
          /* Directory View: Loading State or Available Classrooms Grid + Occupied Section */
          isLoading ? (
            <div className="classroom-loading-state">
              <div className="loading-spinner" />
              <p className="loading-text">Cargando y analizando 75+ aulas de UTEC...</p>
            </div>
          ) : (
            <div className="classroom-results-container">
              {/* Available Classrooms Section */}
              <div className="results-section-header">
                <div className="section-title-wrap">
                  <span className="section-status-square" aria-hidden="true">
                    <BroadcastIcon className="w-3.5 h-3.5" />
                  </span>
                  <h2>
                    Aulas Disponibles
                    <span className="section-count-tag">{totalAvailable}</span>
                  </h2>
                </div>
                <span className="section-subtitle">
                  {filter.mode === 'live_now'
                    ? `Desocupadas en este momento (${effectiveLiveTimeStr}) en el día ${filter.selectedDay}`
                    : `Totalmente libres de ${filter.startTime} a ${filter.endTime}`}
                </span>
              </div>

              {availableRoomsList.length === 0 ? (
                <ArchitecturalEmptyState
                  icon={<Building2 size={24} />}
                  title="No hay aulas disponibles con estos criterios"
                  description="Prueba ampliando el rango de tiempo, seleccionando otro piso o reduciendo las horas mínimas requeridas."
                  resetLabel="Restablecer Filtros"
                  onReset={handleResetFilters}
                />
              ) : (
                <div className="classroom-cards-grid">
                  {availableRoomsList.map(item => (
                    <ClassroomCard
                      key={item.classroom.id}
                      availability={item}
                      filter={filter}
                      nowMinutes={effectiveLiveMinutes}
                      isToday={isToday}
                      onOpenDetail={handleOpenDetail}
                    />
                  ))}
                </div>
              )}

              {/* Occupied Rooms Accordion / Toggle */}
              {busyRoomsList.length > 0 && (
                <div className="occupied-section-wrap">
                  <button
                    type="button"
                    className="occupied-toggle-btn glass-card"
                    onClick={() => setShowOccupiedRooms(!showOccupiedRooms)}
                  >
                    <div className="toggle-btn-left">
                      <Clock size={18} className="text-muted" />
                      <span>
                        Ver Aulas Ocupadas en este horario ({busyRoomsList.length})
                      </span>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`toggle-chevron ${showOccupiedRooms ? 'open' : ''}`}
                    />
                  </button>

                  {showOccupiedRooms && (
                    <div className="classroom-cards-grid classroom-cards-grid--occupied">
                      {busyRoomsList.map(item => (
                        <ClassroomCard
                          key={item.classroom.id}
                          availability={item}
                          filter={filter}
                          nowMinutes={effectiveLiveMinutes}
                          isToday={isToday}
                          onOpenDetail={handleOpenDetail}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        )}
      </main>

      {/* Mobile Floating Back to Top / Quick Floor Button */}
      {showScrollTop && (
        <button
          type="button"
          className="mobile-floating-top-btn"
          onClick={scrollToTop}
          title="Subir a filtros y selección de pisos"
        >
          <span className="floating-top-arrow" style={{ color: '#00779E', fontWeight: 700 }}>↑</span>
          <span>Filtros y Pisos</span>
        </button>
      )}

      {/* Classroom Weekly Schedule Detail Modal (Fixed Viewport Centered Modal / Mobile Bottom Sheet) */}
      {selectedRoom && (
        <ClassroomDetailModal
          classroom={selectedRoom}
          onClose={() => setSelectedRoom(null)}
          systemDay={filter.selectedDay}
        />
      )}
    </div>
  );
};
