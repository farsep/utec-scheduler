import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { DayOfWeek } from '../../types/schedule';
import type { ProfessorInfo, ProfessorFilterState } from '../../types/professor';
import { getCurrentDayAndMinutes, ALL_DAYS } from '../../utils/classroomUtils';
import { parseExcelFile } from '../../utils/excelParser';
import { getProfessorsCatalog, getSynchronousCachedProfessors } from '../../utils/masterDataLoader';
import {
  extractProfessorsFromCourses,
  filterAndSortProfessors,
  evaluateProfessorLiveStatus,
  resolveCanonicalProfessor
} from '../../utils/professorUtils';
import { mutuallyEnrichCoursesWithScrapedData } from '../../utils/courseDirectoryUtils';
import { ProfessorNavbar } from './ProfessorNavbar';
import { ProfessorFilterBar } from './ProfessorFilterBar';
import { ProfessorCard } from './ProfessorCard';
import { ProfessorDetailModal } from './ProfessorDetailModal';
import { BroadcastIcon } from '../common/BroadcastIcon';
import { GraftonMobileKpiBand } from '../common/GraftonMobileKpiBand';
import { ArchitecturalEmptyState } from '../common/ArchitecturalEmptyState';
import {
  GraduationCap,
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

interface ProfessorAppProps {
  hideTopNavbar?: boolean;
}

export const ProfessorApp: React.FC<ProfessorAppProps> = ({ hideTopNavbar = false }) => {
  const initialTime = getCurrentDayAndMinutes();
  const cachedProfessors = getSynchronousCachedProfessors();

  // Instant render without skeleton if already in memory
  const [professors, setProfessors] = useState<ProfessorInfo[]>(() => cachedProfessors || []);
  const [isLoading, setIsLoading] = useState<boolean>(() => !cachedProfessors || cachedProfessors.length === 0);
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
    if (!professors.length) {
      setIsLoading(true);
    }
    setLoadError(null);
    try {
      const extractedProfs = await getProfessorsCatalog();
      setProfessors(extractedProfs);
    } catch (err: any) {
      console.error('Error cargando docentes de UTEC:', err);
      setLoadError(err?.message || 'Error al cargar datos de docentes');
    } finally {
      setIsLoading(false);
    }
  }, [professors.length]);

  useEffect(() => {
    loadMasterSchedule();
  }, [loadMasterSchedule]);

  // Deep-link auto-open via ?profesor=QUERY URL parameter (and on popstate)
  useEffect(() => {
    if (!professors.length || typeof window === 'undefined') return;

    const checkUrlParam = () => {
      const params = new URLSearchParams(window.location.search);
      const profParam = params.get('profesor') || params.get('p') || params.get('docente');
      if (!profParam) return;

      const targetProf = resolveCanonicalProfessor(profParam, professors);

      if (targetProf) {
        setFilter(prev => ({
          ...prev,
          searchQuery: '',
          selectedDay: 'ALL',
          selectedDepartment: 'ALL',
          selectedModality: 'ALL',
          onlyLiveNow: false,
          onlyToday: false
        }));

        setSelectedProf(targetProf);
      }
    };

    checkUrlParam();
    window.addEventListener('popstate', checkUrlParam);
    return () => window.removeEventListener('popstate', checkUrlParam);
  }, [professors]);

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

  // Progressive rendering: 36 professors rendered on first frame for instant <10ms paint
  const [visibleCount, setVisibleCount] = useState<number>(36);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(36);
  }, [filter]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => Math.min(prev + 36, filteredProfessors.length));
        }
      },
      { rootMargin: '600px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filteredProfessors.length]);

  const displayedProfessors = useMemo(() => {
    return filteredProfessors.slice(0, visibleCount);
  }, [filteredProfessors, visibleCount]);

  return (
    <div className="classroom-finder-root professor-finder-root">
      {/* Top Navbar */}
      {!hideTopNavbar && (
        <ProfessorNavbar
          totalProfessors={professors.length}
          filteredCount={filteredProfessors.length}
          teachingNowCount={teachingNowCount}
        />
      )}

      <main className="classroom-finder-main professor-finder-main">
        {/* Hero Banner */}
        <div className="classroom-hero-banner glass-card">
          <div className="hero-content">
            <div className="hero-chip">
              <GraduationCap size={14} className="hero-sparkle" />
              <span>Directorio Académico UTEC</span>
            </div>

            <h1 className="hero-title">
              Encuentra a tus <span className="gradient-text">Profesores</span>
            </h1>

            <p className="hero-subtitle">
              Consulta el horario completo, cursos que dictan, aulas asignadas, correo institucional y disponibilidad en tiempo real de toda la plana docente.
            </p>
          </div>

          {/* Mobile High-Density 3-Column Swiss Industrial Band (< 1024px) */}
          <GraftonMobileKpiBand
            slots={[
              {
                icon: <BroadcastIcon className="w-3.5 h-3.5 shrink-0 text-[#0D7A4E]" />,
                value: teachingNowCount,
                label: 'DICTANDO AHORA',
                valueColor: '#0D7A4E',
                accentColor: '#0D7A4E',
              },
              {
                icon: <Users size={14} color="#18181A" />,
                value: professors.length,
                label: 'DOCENTES',
                valueColor: '#141416',
                accentColor: '#18181A',
              },
              {
                icon: <BookOpen size={14} color="#00779E" />,
                value: totalUniqueCourses,
                label: 'CURSOS',
                valueColor: '#00779E',
                accentColor: '#00779E',
              },
            ]}
          />

          {/* Hero KPI Badges on the right side - matching Aulas premium impression */}
          <div className="hero-kpi-badges prof-hero-kpi-badges hidden lg:flex">
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
              <span className="kpi-txt">
                <span className="kpi-txt-full">Cursos Únicos</span>
                <span className="kpi-txt-short">Cursos</span>
              </span>
            </div>

            <div className={`hero-kpi-badge prof-hero-kpi-card ${teachingNowCount > 0 ? 'prof-hero-kpi-card--live' : ''}`}>
              <div className="prof-kpi-card-header">
                <div className="prof-kpi-icon-wrap prof-kpi-icon-wrap--purple">
                  <Radio size={16} />
                </div>
                <span className={`prof-kpi-badge-pill ${teachingNowCount > 0 ? 'prof-kpi-badge-pill--live' : ''}`}>
                  {teachingNowCount > 0 ? (
                    <>
                      <BroadcastIcon className="w-3.5 h-3.5 shrink-0 inline mr-1" /> En Vivo
                    </>
                  ) : (
                    'En Vivo'
                  )}
                </span>
              </div>
              <span className="kpi-num text-purple">{teachingNowCount}</span>
              <span className="kpi-txt">
                <span className="kpi-txt-full">En Clase Ahora</span>
                <span className="kpi-txt-short">En Vivo</span>
              </span>
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
              <ArchitecturalEmptyState
                icon={<GraduationCap size={24} />}
                title="No se encontraron docentes con estos criterios"
                description="Prueba modificando el texto de búsqueda, desactivando el filtro de día o restableciendo los filtros."
                query={filter.searchQuery || undefined}
                resetLabel="Restablecer todos los filtros"
                onReset={() =>
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
              />
            ) : (
              <div className="professors-cards-grid">
                {displayedProfessors.map(prof => (
                  <ProfessorCard
                    key={prof.id}
                    professor={prof}
                    nowDay={realTime.day}
                    nowMinutes={realTime.minutes}
                    onOpenDetail={setSelectedProf}
                  />
                ))}
                {visibleCount < filteredProfessors.length && (
                  <div
                    ref={sentinelRef}
                    style={{ height: '20px', width: '100%', gridColumn: '1 / -1', pointerEvents: 'none' }}
                  />
                )}
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
          <span className="floating-top-arrow" style={{ color: '#00779E', fontWeight: 700 }}>↑</span>
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
