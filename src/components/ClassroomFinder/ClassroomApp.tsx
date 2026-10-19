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
  ChevronDown
} from 'lucide-react';

export const ClassroomApp: React.FC = () => {
  const initialTime = getCurrentDayAndMinutes();

  const [classrooms, setClassrooms] = useState<ClassroomInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // System real-time clock
  const [systemDay, setSystemDay] = useState<DayOfWeek>(initialTime.day);
  const [systemMinutes, setSystemMinutes] = useState<number>(initialTime.minutes);
  const [systemTimeStr, setSystemTimeStr] = useState<string>(initialTime.timeStr);

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

  // Toggle to show occupied rooms as well (default: show free first, with toggle)
  const [showOccupiedRooms, setShowOccupiedRooms] = useState<boolean>(false);

  // Keep clock updated every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const current = getCurrentDayAndMinutes();
      setSystemDay(current.day);
      setSystemMinutes(current.minutes);
      setSystemTimeStr(current.timeStr);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

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

  // Handle custom excel upload
  const handleUploadExcel = async (file: File) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const buffer = await file.arrayBuffer();
      const parseResult = parseExcelFile(buffer);
      const extractedRooms = extractClassroomsFromCourses(parseResult.courses);
      if (extractedRooms.length === 0) {
        throw new Error('No se encontraron aulas con ubicación física en el archivo subido.');
      }
      setClassrooms(extractedRooms);
    } catch (err: any) {
      console.error('Error al procesar archivo:', err);
      setLoadError(err?.message || 'Error al procesar el archivo Excel.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (updates: Partial<ClassroomFilterState>) => {
    setFilter(prev => ({ ...prev, ...updates }));
  };

  const handleResetFilters = () => {
    const current = getCurrentDayAndMinutes();
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
    return classrooms.map(c => evaluateClassroom(c, filter, systemMinutes));
  }, [classrooms, filter, systemMinutes]);

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
  const isToday = filter.selectedDay === systemDay;

  return (
    <div className="classroom-finder-root">
      {/* Top Navigation */}
      <ClassroomNavbar
        totalRooms={classrooms.length}
        availableRooms={totalAvailable}
        onUploadExcel={handleUploadExcel}
        onReloadSample={loadMasterSchedule}
        isLoading={isLoading}
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
          systemDay={systemDay}
          systemTimeStr={systemTimeStr}
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
                  ? `Desocupadas ahora (${systemTimeStr}) en el día ${filter.selectedDay}`
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
                    nowMinutes={systemMinutes}
                    isToday={isToday}
                    onOpenDetail={(cls) => setSelectedRoom(cls)}
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
                        nowMinutes={systemMinutes}
                        isToday={isToday}
                        onOpenDetail={(cls) => setSelectedRoom(cls)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Classroom Weekly Schedule Detail Modal */}
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
