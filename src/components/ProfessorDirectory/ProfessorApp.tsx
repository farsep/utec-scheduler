import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { DayOfWeek } from '../../types/schedule';
import type { ProfessorInfo, ProfessorFilterState } from '../../types/professor';
import { getCurrentDayAndMinutes, ALL_DAYS } from '../../utils/classroomUtils';
import { parseExcelFile } from '../../utils/excelParser';
import {
  extractProfessorsFromCourses,
  filterAndSortProfessors,
  evaluateProfessorLiveStatus,
  enrichCoursesWithIntranetData
} from '../../utils/professorUtils';
import { ProfessorNavbar } from './ProfessorNavbar';
import { ProfessorFilterBar } from './ProfessorFilterBar';
import { ProfessorCard } from './ProfessorCard';
import { ProfessorDetailModal } from './ProfessorDetailModal';
import {
  GraduationCap,
  Sparkles,
  Users,
  Search,
  BookOpen,
  Clock,
  ArrowUp,
  AlertCircle,
  HelpCircle,
  Layers,
  Radio
} from 'lucide-react';

export const ProfessorApp: React.FC = () => {
  const initialTime = getCurrentDayAndMinutes();

  const [professors, setProfessors] = useState<ProfessorInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // System real-time clock that ticks every second
  const [realTime, setRealTime] = useState<{ day: DayOfWeek; minutes: number; timeStr: string }>(initialTime);

  // Filter State
  const [filter, setFilter] = useState<ProfessorFilterState>({
    searchQuery: '',
    selectedDay: 'ALL',
    selectedDepartment: 'ALL',
    selectedModality: 'ALL',
    onlyLiveNow: false,
    onlyToday: false,
    sortBy: 'name_asc'
  });

  // Selected professor for detailed view modal
  const [selectedProf, setSelectedProf] = useState<ProfessorInfo | null>(null);

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

  // Real-time ticker
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

  // Load default master schedule on mount
  const loadMasterSchedule = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/samples/Consulta_Horario.xlsx');
      if (!res.ok) throw new Error('No se pudo descargar el archivo de horarios de UTEC');
      const buffer = await res.arrayBuffer();
      const parseResult = parseExcelFile(buffer);

      // Try enriching with intranet data to recover unassigned professors ("DOCENTE UTEC" / empty)
      let coursesToUse = parseResult.courses;
      try {
        const liveRes = await fetch('/data/classrooms_intranet.json');
        if (liveRes.ok) {
          const liveData = await liveRes.json();
          if (Array.isArray(liveData.classrooms) && liveData.classrooms.length > 0) {
            coursesToUse = enrichCoursesWithIntranetData(parseResult.courses, liveData.classrooms);
          }
        }
      } catch (liveErr) {
        console.warn('No se pudo cargar classrooms_intranet.json para enriquecer profesores:', liveErr);
      }

      const extractedProfs = extractProfessorsFromCourses(coursesToUse);
      setProfessors(extractedProfs);
    } catch (err: any) {
      console.error('Error cargando docentes desde Consulta_Horario.xlsx:', err);
      setLoadError(err?.message || 'Error al cargar datos de docentes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMasterSchedule();
  }, [loadMasterSchedule]);

  const handleFilterChange = (updates: Partial<ProfessorFilterState>) => {
    setFilter(prev => ({ ...prev, ...updates }));
  };

  // Count professors currently teaching live
  const teachingNowCount = useMemo(() => {
    return professors.filter(p => {
      const { isTeachingNow } = evaluateProfessorLiveStatus(p, realTime.day, realTime.minutes);
      return isTeachingNow;
    }).length;
  }, [professors, realTime.day, realTime.minutes]);

  // Total unique courses taught across all professors
  const totalUniqueCourses = useMemo(() => {
    const set = new Set<string>();
    professors.forEach(p => p.courses.forEach(c => set.add(c.code)));
    return set.size;
  }, [professors]);

  // Filtered and sorted professors
  const filteredProfessors = useMemo(() => {
    return filterAndSortProfessors(professors, filter, realTime.day, realTime.minutes);
  }, [professors, filter, realTime.day, realTime.minutes]);

  return (
    <div className="classroom-finder-root professor-finder-root">
      {/* Top Navbar */}
      <ProfessorNavbar
        totalProfessors={professors.length}
        filteredCount={filteredProfessors.length}
        teachingNowCount={teachingNowCount}
      />

      <main className="classroom-finder-main professor-finder-main">
        {/* Hero Banner */}
        <div className="classroom-hero-banner glass-card">
          <div className="hero-content">
            <div className="hero-chip">
              <Sparkles size={14} className="hero-sparkle" />
              <span>Directorio Académico UTEC</span>
            </div>

            <h1 className="hero-title">
              Encuentra a tus <span className="gradient-text">Profesores</span>
            </h1>

            <p className="hero-subtitle">
              Consulta el horario completo, cursos que dictan, aulas asignadas, correo institucional y disponibilidad en tiempo real de toda la plana docente.
            </p>
          </div>

          {/* Hero KPI Badges on the right side - matching Aulas premium impression */}
          <div className="hero-kpi-badges prof-hero-kpi-badges">
            <div className="hero-kpi-badge prof-hero-kpi-card">
              <div className="prof-kpi-card-header">
                <div className="prof-kpi-icon-wrap prof-kpi-icon-wrap--blue">
                  <Users size={16} />
                </div>
                <span className="prof-kpi-badge-pill">Plana UTEC</span>
              </div>
              <span className="kpi-num text-accent">{professors.length}</span>
              <span className="kpi-txt">Docentes</span>
            </div>

            <div className="hero-kpi-badge prof-hero-kpi-card">
              <div className="prof-kpi-card-header">
                <div className="prof-kpi-icon-wrap prof-kpi-icon-wrap--emerald">
                  <BookOpen size={16} />
                </div>
                <span className="prof-kpi-badge-pill prof-kpi-badge-pill--emerald">2026 - 2</span>
              </div>
              <span className="kpi-num text-emerald">{totalUniqueCourses}</span>
              <span className="kpi-txt">Cursos Únicos</span>
            </div>

            <div className={`hero-kpi-badge prof-hero-kpi-card ${teachingNowCount > 0 ? 'prof-hero-kpi-card--live' : ''}`}>
              <div className="prof-kpi-card-header">
                <div className="prof-kpi-icon-wrap prof-kpi-icon-wrap--purple">
                  <Radio size={16} />
                </div>
                <span className={`prof-kpi-badge-pill ${teachingNowCount > 0 ? 'prof-kpi-badge-pill--live' : ''}`}>
                  {teachingNowCount > 0 ? (
                    <>
                      <span className="live-dot-mini" /> En Vivo
                    </>
                  ) : (
                    'En Vivo'
                  )}
                </span>
              </div>
              <span className="kpi-num text-purple">{teachingNowCount}</span>
              <span className="kpi-txt">En Clase Ahora</span>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <ProfessorFilterBar
          filter={filter}
          onFilterChange={handleFilterChange}
          totalProfessors={professors.length}
          filteredCount={filteredProfessors.length}
          teachingNowCount={teachingNowCount}
          currentDay={realTime.day}
        />

        {/* Loading State */}
        {isLoading && (
          <div className="classroom-loading-state glass-card">
            <div className="spinner-glow" />
            <div className="loading-text-group">
              <h3>Cargando directorio de docentes de UTEC...</h3>
              <p>Indexando cursos, horarios, aulas y correos institucionales.</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {loadError && (
          <div className="classroom-error-banner glass-card">
            <AlertCircle size={24} className="text-danger" />
            <div>
              <h4>Error al cargar el directorio</h4>
              <p>{loadError}</p>
              <button
                type="button"
                className="btn btn-secondary mt-2"
                onClick={loadMasterSchedule}
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

        {/* Content: Professors Grid */}
        {!isLoading && !loadError && (
          <div className="professors-content-container">
            {filteredProfessors.length === 0 ? (
              <div className="no-rooms-card glass-card">
                <div className="no-rooms-icon-wrap">
                  <GraduationCap size={44} />
                </div>
                <h3>No se encontraron docentes con estos criterios</h3>
                <p>
                  Prueba modificando el texto de búsqueda, desactivando el filtro de día o restableciendo los filtros.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    setFilter({
                      searchQuery: '',
                      selectedDay: 'ALL',
                      selectedDepartment: 'ALL',
                      selectedModality: 'ALL',
                      onlyLiveNow: false,
                      onlyToday: false,
                      sortBy: 'name_asc'
                    })
                  }
                >
                  Restablecer todos los filtros
                </button>
              </div>
            ) : (
              <div className="professors-cards-grid">
                {filteredProfessors.map(prof => (
                  <ProfessorCard
                    key={prof.id}
                    professor={prof}
                    nowDay={realTime.day}
                    nowMinutes={realTime.minutes}
                    onOpenDetail={setSelectedProf}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Mobile Floating Back to Top Button */}
      {showScrollTop && (
        <button
          type="button"
          className="mobile-floating-top-btn"
          onClick={scrollToTop}
          title="Subir a filtros y búsqueda"
        >
          <ArrowUp size={15} />
          <span>Búsqueda</span>
        </button>
      )}

      {/* Professor Detail Modal */}
      {selectedProf && (
        <ProfessorDetailModal
          professor={selectedProf}
          onClose={() => setSelectedProf(null)}
          nowDay={realTime.day}
          nowMinutes={realTime.minutes}
        />
      )}
    </div>
  );
};
