import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { DayOfWeek } from '../../types/schedule';
import type {
  CourseExtendedInfo,
  CourseFilterState,
  VisitorCourseItem
} from '../../types/courseDirectory';
import { getCurrentDayAndMinutes, ALL_DAYS } from '../../utils/classroomUtils';
import { getCoursesCatalog, getSynchronousCachedCourses } from '../../utils/masterDataLoader';
import {
  evaluateCourseLiveStatus,
  filterAndSortCourses,
  getSavedVisitorCourses,
  toggleVisitorCourseInStorage
} from '../../utils/courseDirectoryUtils';
import { CourseNavbar } from './CourseNavbar';
import { CourseFilterBar } from './CourseFilterBar';
import { CourseCard } from './CourseCard';
import { CourseDetailModal } from './CourseDetailModal';
import {
  BookOpen,
  Sparkles,
  Users,
  Radio,
  Star,
  Layers,
  ArrowUp,
  AlertCircle,
  HelpCircle,
  GraduationCap
} from 'lucide-react';

export const CourseApp: React.FC = () => {
  const initialTime = getCurrentDayAndMinutes();
  const cachedCourses = getSynchronousCachedCourses();

  // Instant render without skeleton if already in memory
  const [courses, setCourses] = useState<CourseExtendedInfo[]>(() => cachedCourses || []);
  const [isLoading, setIsLoading] = useState<boolean>(() => !cachedCourses || cachedCourses.length === 0);
  const [loadError, setLoadError] = useState<string | null>(null);

  // System real-time clock that ticks every second
  const [realTime, setRealTime] = useState<{ day: DayOfWeek; minutes: number; timeStr: string }>(initialTime);

  // Saved visitor courses
  const [visitorItems, setVisitorItems] = useState<VisitorCourseItem[]>([]);

  // Filter State
  const [filter, setFilter] = useState<CourseFilterState>({
    searchQuery: '',
    selectedDepartment: 'ALL',
    selectedDay: 'ALL',
    selectedModality: 'ALL',
    onlyLiveNow: false,
    onlyVisitor: false,
    sortBy: 'code_asc'
  });

  // Selected course for detail modal
  const [selectedCourse, setSelectedCourse] = useState<CourseExtendedInfo | null>(null);

  // Toast notification for visitor actions
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  // Load visitor saved items from localStorage on mount & listen to changes
  useEffect(() => {
    setVisitorItems(getSavedVisitorCourses());

    const handleStorageUpdate = (e: any) => {
      setVisitorItems(getSavedVisitorCourses());
    };
    window.addEventListener('matriculab:visitor-updated', handleStorageUpdate);
    return () => window.removeEventListener('matriculab:visitor-updated', handleStorageUpdate);
  }, []);

  // Set of saved visitor course codes for O(1) checks
  const visitorCourseCodes = useMemo(() => {
    return new Set(visitorItems.map(item => item.courseCode));
  }, [visitorItems]);

  // Load master courses on mount
  const loadMasterCourses = useCallback(async () => {
    if (!courses.length) {
      setIsLoading(true);
    }
    setLoadError(null);
    try {
      const extended = await getCoursesCatalog();
      setCourses(extended);
    } catch (err: any) {
      console.error('Error cargando cursos de UTEC:', err);
      setLoadError(err?.message || 'Error al cargar cursos ofertados de UTEC');
    } finally {
      setIsLoading(false);
    }
  }, [courses.length]);

  useEffect(() => {
    loadMasterCourses();
  }, [loadMasterCourses]);

  const handleFilterChange = (updates: Partial<CourseFilterState>) => {
    setFilter(prev => ({ ...prev, ...updates }));
  };

  // Toggle visitor bookmark
  const handleToggleVisitor = (course: CourseExtendedInfo, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const { isAdded, updatedItems } = toggleVisitorCourseInStorage(course);
    setVisitorItems(updatedItems);

    setToastMessage(
      isAdded
        ? `⭐ "${course.code} - ${course.name}" guardado como visitante (oyente)`
        : `Eliminado de tus cursos de visitante`
    );
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Total unique sections across all courses
  const totalSectionsCount = useMemo(() => {
    return courses.reduce((acc, c) => acc + c.totalSectionsCount, 0);
  }, [courses]);

  // Count courses currently being taught live
  const liveNowCount = useMemo(() => {
    return courses.filter(c => {
      const { isCurrentlyLive } = evaluateCourseLiveStatus(c, realTime.day, realTime.minutes);
      return isCurrentlyLive;
    }).length;
  }, [courses, realTime.day, realTime.minutes]);

  // Filtered and sorted courses
  const filteredCourses = useMemo(() => {
    return filterAndSortCourses(
      courses,
      filter,
      realTime.day,
      realTime.minutes,
      visitorCourseCodes
    );
  }, [courses, filter, realTime.day, realTime.minutes, visitorCourseCodes]);

  // Progressive rendering: initial batch of 36 cards renders in <10ms for Adobe-level responsiveness
  const [visibleCount, setVisibleCount] = useState<number>(36);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset batch size on filter or search changes
  useEffect(() => {
    setVisibleCount(36);
  }, [filter]);

  // IntersectionObserver smoothly streams more cards as user scrolls
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => Math.min(prev + 36, filteredCourses.length));
        }
      },
      { rootMargin: '600px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filteredCourses.length]);

  const displayedCourses = useMemo(() => {
    return filteredCourses.slice(0, visibleCount);
  }, [filteredCourses, visibleCount]);

  return (
    <div className="classroom-finder-root course-finder-root">
      {/* Top Navbar */}
      <CourseNavbar
        totalCourses={courses.length}
        filteredCount={filteredCourses.length}
        liveNowCount={liveNowCount}
      />

      <main className="classroom-finder-main course-finder-main">
        {/* Hero Banner */}
        <div className="classroom-hero-banner glass-card course-hero-banner">
          <div className="hero-content">
            <div className="hero-chip">
              <Sparkles size={14} className="hero-sparkle" />
              <span>Oferta Académica UTEC 2026-2</span>
            </div>

            <h1 className="hero-title">
              Catálogo de <span className="gradient-text">Cursos Ofertados</span>
            </h1>

            <p className="hero-subtitle">
              Explora todos los cursos de pregrado de la UTEC: consulta secciones, horarios semanales, aulas asignadas y <strong>asiste directamente como visitante (oyente)</strong>.
            </p>
          </div>

          {/* Hero KPI Badges */}
          <div className="hero-kpi-badges prof-hero-kpi-badges course-hero-kpi-badges">
            <div className="hero-kpi-badge prof-hero-kpi-card">
              <div className="prof-kpi-card-header">
                <div className="prof-kpi-icon-wrap prof-kpi-icon-wrap--blue">
                  <BookOpen size={16} />
                </div>
                <span className="prof-kpi-badge-pill">Catálogo</span>
              </div>
              <span className="kpi-num text-accent">{courses.length}</span>
              <span className="kpi-txt">Cursos Ofertados</span>
            </div>

            <div className="hero-kpi-badge prof-hero-kpi-card">
              <div className="prof-kpi-card-header">
                <div className="prof-kpi-icon-wrap prof-kpi-icon-wrap--emerald">
                  <Layers size={16} />
                </div>
                <span className="prof-kpi-badge-pill prof-kpi-badge-pill--emerald">2026 - 2</span>
              </div>
              <span className="kpi-num text-emerald">{totalSectionsCount}</span>
              <span className="kpi-txt">Secciones Totales</span>
            </div>

            <div className={`hero-kpi-badge prof-hero-kpi-card ${liveNowCount > 0 ? 'prof-hero-kpi-card--live' : ''}`}>
              <div className="prof-kpi-card-header">
                <div className="prof-kpi-icon-wrap prof-kpi-icon-wrap--purple">
                  <Radio size={16} />
                </div>
                <span className={`prof-kpi-badge-pill ${liveNowCount > 0 ? 'prof-kpi-badge-pill--live' : ''}`}>
                  {liveNowCount > 0 ? (
                    <>
                      <span className="live-dot-mini" /> En Vivo
                    </>
                  ) : (
                    'En Vivo'
                  )}
                </span>
              </div>
              <span className="kpi-num text-purple">{liveNowCount}</span>
              <span className="kpi-txt">Dictándose Ahora</span>
            </div>

            <div
              className={`hero-kpi-badge prof-hero-kpi-card visitor-kpi-card ${visitorItems.length > 0 ? 'visitor-kpi-card--active' : ''}`}
              onClick={() => handleFilterChange({ onlyVisitor: !filter.onlyVisitor })}
              role="button"
              tabIndex={0}
              title="Filtrar tus cursos de oyente"
            >
              <div className="prof-kpi-card-header">
                <div className="prof-kpi-icon-wrap prof-kpi-icon-wrap--amber">
                  <Star size={16} className={visitorItems.length > 0 ? 'star-filled-gold' : ''} />
                </div>
                <span className="prof-kpi-badge-pill prof-kpi-badge-pill--amber">Modo Oyente</span>
              </div>
              <span className="kpi-num text-amber">{visitorItems.length}</span>
              <span className="kpi-txt">Mis Visitados</span>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <CourseFilterBar
          filter={filter}
          onFilterChange={handleFilterChange}
          totalCourses={courses.length}
          filteredCount={filteredCourses.length}
          liveNowCount={liveNowCount}
          visitorCount={visitorItems.length}
          currentDay={realTime.day}
        />

        {/* Loading State */}
        {isLoading && (
          <div className="classroom-loading-state glass-card">
            <div className="spinner-glow" />
            <div className="loading-text-group">
              <h3>Cargando catálogo oficial de cursos UTEC...</h3>
              <p>Procesando secciones, horarios semanales, docentes y aulas asignadas.</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {loadError && (
          <div className="classroom-error-banner glass-card">
            <AlertCircle size={24} className="text-danger" />
            <div>
              <h4>Error al cargar el catálogo de cursos</h4>
              <p>{loadError}</p>
              <button
                type="button"
                className="btn btn-secondary mt-2"
                onClick={loadMasterCourses}
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

        {/* Content: Courses Grid */}
        {!isLoading && !loadError && (
          <div className="courses-content-container">
            {filteredCourses.length === 0 ? (
              <div className="no-rooms-card glass-card">
                <div className="no-rooms-icon-wrap">
                  <BookOpen size={44} />
                </div>
                <h3>No se encontraron cursos con estos criterios</h3>
                <p>
                  Prueba buscando por otra palabra clave, cambiando de carrera o desactivando el filtro de oyente.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    setFilter({
                      searchQuery: '',
                      selectedDepartment: 'ALL',
                      selectedDay: 'ALL',
                      selectedModality: 'ALL',
                      onlyLiveNow: false,
                      onlyVisitor: false,
                      sortBy: 'code_asc'
                    })
                  }
                >
                  Restablecer todos los filtros
                </button>
              </div>
            ) : (
              <div className="courses-cards-grid">
                {displayedCourses.map(course => (
                  <CourseCard
                    key={course.code}
                    course={course}
                    nowDay={realTime.day}
                    nowMinutes={realTime.minutes}
                    isVisitor={visitorCourseCodes.has(course.code)}
                    onToggleVisitor={handleToggleVisitor}
                    onOpenDetail={setSelectedCourse}
                  />
                ))}
                {visibleCount < filteredCourses.length && (
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

      {/* Floating Back to Top Button */}
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

      {/* Detail Modal */}
      {selectedCourse && (
        <CourseDetailModal
          course={selectedCourse}
          isVisitor={visitorCourseCodes.has(selectedCourse.code)}
          onToggleVisitor={handleToggleVisitor}
          onClose={() => setSelectedCourse(null)}
          nowDay={realTime.day}
          nowMinutes={realTime.minutes}
        />
      )}

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="course-toast-notification glass-card" role="alert">
          <Sparkles size={16} className="text-accent-amber" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
