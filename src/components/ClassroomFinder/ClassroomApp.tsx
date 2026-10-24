import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { DayOfWeek } from '../../types/schedule';
import type { ClassroomInfo, ClassroomFilterState, ClassroomAvailability } from '../../types/classroom';
import {
  extractClassroomsFromCourses,
  evaluateClassroom,
  getCurrentDayAndMinutes,
  ALL_DAYS,
  ROOM_TYPE_LABELS
} from '../../utils/classroomUtils';
import { minutesToTime } from '../../utils/scheduleUtils';
import { parseExcelFile } from '../../utils/excelParser';
import { ClassroomNavbar } from './ClassroomNavbar';
import { ClassroomFilterBar } from './ClassroomFilterBar';
import { ClassroomCard } from './ClassroomCard';
import { ClassroomDetailModal } from './ClassroomDetailModal';
import {
  Sparkles,
  Building2,
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

export const ClassroomApp: React.FC = () => {
  const initialTime = getCurrentDayAndMinutes();

  const [classrooms, setClassrooms] = useState<ClassroomInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
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

  // Load default master schedule on mount
  const loadMasterSchedule = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/samples/Consulta_Horario.xlsx');
      if (!res.ok) throw new Error('No se pudo descargar el archivo de horarios de ejemplo');
      const buffer = await res.arrayBuffer();
      const parseResult = parseExcelFile(buffer);
      const extractedRooms = extractClassroomsFromCourses(parseResult.courses);
      setClassrooms(extractedRooms);
    } catch (err: any) {
      console.error('Error cargando Consulta_Horario.xlsx:', err);
      setLoadError(err?.message || 'Error al cargar datos de horarios');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMasterSchedule();
  }, [loadMasterSchedule]);

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

  // Count available rooms per floor
  const floorCounts = useMemo(() => {
    const counts: Record<number | string, number> = {};
    for (let f = 1; f <= 10; f++) counts[f] = 0;

    evaluatedClassrooms.forEach(item => {
      if (item.isAvailableForSearch) {
        counts[item.classroom.floor] = (counts[item.classroom.floor] || 0) + 1;
      }
    });

    return counts;
  }, [evaluatedClassrooms]);

  // Filter and sort rooms
  const { availableRoomsList, busyRoomsList } = useMemo(() => {
    const query = filter.searchQuery.trim().toLowerCase();

    const matchesFilters = (item: ClassroomAvailability) => {
      const { classroom } = item;

      // Floor filter
      if (filter.selectedFloor !== 'ALL' && classroom.floor !== filter.selectedFloor) {
        return false;
      }

      // Room Type filter
      if (filter.selectedType !== 'ALL' && classroom.type !== filter.selectedType) {
        return false;
      }

      // Text query search
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
  }, [evaluatedClassrooms, filter]);

  const totalAvailable = availableRoomsList.length;
  const isToday = filter.selectedDay === realTime.day;

  return (
    <div className="classroom-finder-root">
      {/* Top Navigation */}
      <ClassroomNavbar
        totalRooms={classrooms.length}
        availableRooms={totalAvailable}
      />

      <main className="classroom-finder-main">
        {/* Hero Banner Section */}
        <div className="classroom-hero-banner glass-card">
          <div className="hero-content">
            <div className="hero-chip">
              <Sparkles size={14} className="hero-chip-icon" />
              <span>Buscador Inteligente de Espacios UTEC</span>
            </div>
            <h1 className="hero-title">
              Encuentra <span className="gradient-text">Aulas y Espacios Libres</span> al instante
            </h1>
            <p className="hero-subtitle">
              Consulta en tiempo real la disponibilidad de aulas, laboratorios y mesas de trabajo entre pisos de UTEC.
              Filtra por horario o descubre qué espacios están desocupados en este preciso momento.
            </p>
          </div>

          <div className="hero-kpi-badges">
            <div className="hero-kpi-badge">
              <span className="kpi-num text-emerald">{totalAvailable}</span>
              <span className="kpi-txt">Aulas Libres</span>
            </div>
            <div className="hero-kpi-badge">
              <span className="kpi-num text-accent">{classrooms.length}</span>
              <span className="kpi-txt">Espacios Totales</span>
            </div>
            <div className="hero-kpi-badge">
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

        {/* Loading Spinner */}
        {isLoading ? (
          <div className="classroom-loading-state">
            <div className="loading-spinner" />
            <p className="loading-text">Cargando y analizando 75+ aulas de UTEC...</p>
          </div>
        ) : (
          <div className="classroom-results-container">
            {/* Available Classrooms Section */}
            <div className="results-section-header">
              <div className="section-title-wrap">
                <CheckCircle2 size={20} className="text-emerald" />
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
              <div className="no-rooms-card glass-card">
                <Building2 size={40} className="no-rooms-icon" />
                <h3>No hay aulas disponibles con estos criterios</h3>
                <p>
                  Prueba ampliando el rango de tiempo, seleccionando otro piso o reduciendo las horas mínimas requeridas.
                </p>
                <button className="btn btn-primary" onClick={handleResetFilters}>
                  Restablecer Filtros
                </button>
              </div>
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
          <ArrowUp size={15} />
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
