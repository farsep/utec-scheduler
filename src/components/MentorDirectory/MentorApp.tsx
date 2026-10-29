import React, { useState, useEffect, useMemo } from 'react';
import type { DayOfWeek } from '../../types/schedule';
import type { MentorInfo, MentorFilterState } from '../../types/mentor';
import { MENTORS_DATA } from '../../data/mentorsData';
import { getCurrentDayAndMinutes } from '../../utils/classroomUtils';
import {
  evaluateMentorLiveStatus,
  filterAndSortMentors
} from '../../utils/mentorUtils';
import { MentorNavbar } from './MentorNavbar';
import { MentorFilterBar } from './MentorFilterBar';
import { MentorCard } from './MentorCard';
import { MentorDetailModal } from './MentorDetailModal';
import {
  Award,
  Sparkles,
  Search,
  BookOpen,
  ArrowUp,
  Radio,
  Building2,
  Video
} from 'lucide-react';

export const MentorApp: React.FC = () => {
  const initialTime = getCurrentDayAndMinutes();

  const [mentors] = useState<MentorInfo[]>(MENTORS_DATA);
  const [realTime, setRealTime] = useState<{ day: DayOfWeek; minutes: number; timeStr: string }>(initialTime);

  // Filter state
  const [filter, setFilter] = useState<MentorFilterState>({
    searchQuery: '',
    selectedDay: 'ALL',
    selectedModality: 'ALL',
    selectedCourse: 'ALL',
    selectedDepartment: 'ALL',
    onlyLiveNow: false,
    onlyToday: false,
    sortBy: 'name_asc'
  });

  // Selected mentor for modal
  const [selectedMentor, setSelectedMentor] = useState<MentorInfo | null>(null);

  // Floating back to top button visibility
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

  // Real-time clock ticker
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

  const handleFilterChange = (updates: Partial<MentorFilterState>) => {
    setFilter(prev => ({ ...prev, ...updates }));
  };

  // Unique courses for filter dropdown
  const availableCourses = useMemo(() => {
    const map = new Map<string, string>();
    mentors.forEach(m => {
      m.courses.forEach(c => map.set(c.code, c.name));
    });
    return Array.from(map.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [mentors]);

  // Unique departments
  const availableDepartments = useMemo(() => {
    const map = new Map<string, string>();
    mentors.forEach(m => {
      map.set(m.departmentCode, m.departmentName);
    });
    return Array.from(map.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [mentors]);

  // Counts for KPIs
  const liveNowCount = useMemo(() => {
    return mentors.filter(m => {
      const { isMentoringNow } = evaluateMentorLiveStatus(m, realTime.day, realTime.minutes);
      return isMentoringNow;
    }).length;
  }, [mentors, realTime.day, realTime.minutes]);

  const presencialSessionsCount = useMemo(() => {
    return mentors.reduce((acc, m) => acc + m.sessions.filter(s => s.modality === 'Presencial').length, 0);
  }, [mentors]);

  const virtualSessionsCount = useMemo(() => {
    return mentors.reduce((acc, m) => acc + m.sessions.filter(s => s.modality === 'Virtual').length, 0);
  }, [mentors]);

  // Filtered and sorted mentors
  const filteredMentors = useMemo(() => {
    return filterAndSortMentors(mentors, filter, realTime.day, realTime.minutes);
  }, [mentors, filter, realTime.day, realTime.minutes]);

  return (
    <div className="classroom-finder-root professor-finder-root mentor-finder-root">
      {/* Top Navbar */}
      <MentorNavbar
        totalMentors={mentors.length}
        filteredCount={filteredMentors.length}
        liveNowCount={liveNowCount}
      />

      <main className="classroom-finder-main professor-finder-main mentor-finder-main">
        {/* Hero Banner with Integrated High-End KPI Badges */}
        <div className="classroom-hero-banner glass-card">
          <div className="hero-content">
            <div className="hero-chip">
              <Sparkles size={14} className="hero-sparkle" />
              <span>Directorio Académico UTEC • Ciclo 2026-2</span>
            </div>

            <h1 className="hero-title">
              Directorio de <span className="gradient-text">Mentores Académicos</span>
            </h1>

            <p className="hero-subtitle">
              Asesorías gratuitas entre pares. Consulta los horarios de atención, modalidades (presenciales en campus y virtuales) y la programación semanal de aulas asignadas para todo el ciclo.
            </p>
          </div>

          {/* Hero KPI Badges on the right side - matching the gorgeous look of Aulas and Docentes */}
          <div className="hero-kpi-badges prof-hero-kpi-badges mentor-hero-kpi-badges">
            <div className="hero-kpi-badge prof-hero-kpi-card">
              <div className="prof-kpi-card-header">
                <div className="prof-kpi-icon-wrap prof-kpi-icon-wrap--blue">
                  <Award size={16} />
                </div>
                <span className="prof-kpi-badge-pill">UTEC 2026-2</span>
              </div>
              <span className="kpi-num text-accent">{mentors.length}</span>
              <span className="kpi-txt">Mentores</span>
            </div>

            <div className="hero-kpi-badge prof-hero-kpi-card">
              <div className="prof-kpi-card-header">
                <div className="prof-kpi-icon-wrap prof-kpi-icon-wrap--emerald">
                  <BookOpen size={16} />
                </div>
                <span className="prof-kpi-badge-pill prof-kpi-badge-pill--emerald">Cursos</span>
              </div>
              <span className="kpi-num text-emerald">{availableCourses.length}</span>
              <span className="kpi-txt">
                <span className="kpi-txt-full">Asignaturas</span>
                <span className="kpi-txt-short">Cursos</span>
              </span>
            </div>

            <div
              className={`hero-kpi-badge prof-hero-kpi-card ${filter.selectedModality === 'Presencial' ? 'prof-hero-kpi-card--live' : ''}`}
              onClick={() => handleFilterChange({ selectedModality: filter.selectedModality === 'Presencial' ? 'ALL' : 'Presencial' })}
              style={{ cursor: 'pointer' }}
              title="Filtrar sesiones presenciales en campus"
            >
              <div className="prof-kpi-card-header">
                <div className="prof-kpi-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399' }}>
                  <Building2 size={16} />
                </div>
                <span className="prof-kpi-badge-pill prof-kpi-badge-pill--emerald">Campus</span>
              </div>
              <span className="kpi-num text-emerald">{presencialSessionsCount}</span>
              <span className="kpi-txt">
                <span className="kpi-txt-full">Presenciales</span>
                <span className="kpi-txt-short">Campus</span>
              </span>
            </div>

            <div
              className={`hero-kpi-badge prof-hero-kpi-card ${liveNowCount > 0 ? 'prof-hero-kpi-card--live' : ''}`}
              onClick={() => handleFilterChange({ onlyLiveNow: !filter.onlyLiveNow })}
              style={{ cursor: 'pointer' }}
              title="Filtrar mentores en vivo ahora"
            >
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
              <span className="kpi-txt">
                <span className="kpi-txt-full">En Sesión Ahora</span>
                <span className="kpi-txt-short">En Vivo</span>
              </span>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <MentorFilterBar
          filter={filter}
          onFilterChange={handleFilterChange}
          availableCourses={availableCourses}
          availableDepartments={availableDepartments}
          currentDay={realTime.day}
          totalFiltered={filteredMentors.length}
          totalAll={mentors.length}
          liveNowCount={liveNowCount}
        />

        {/* Mentors Grid / Empty State */}
        {filteredMentors.length > 0 ? (
          <div className="prof-grid mentor-grid">
            {filteredMentors.map((mentor) => (
              <MentorCard
                key={mentor.id}
                mentor={mentor}
                currentDay={realTime.day}
                currentMinutes={realTime.minutes}
                onSelect={(m) => setSelectedMentor(m)}
              />
            ))}
          </div>
        ) : (
          <div className="prof-empty-state glass-card">
            <div className="empty-icon-wrap">
              <Search size={36} />
            </div>
            <h3 className="empty-title">No se encontraron mentores</h3>
            <p className="empty-desc">
              No hay mentores que coincidan con los filtros seleccionados o el término de búsqueda{' '}
              {filter.searchQuery && <strong>"{filter.searchQuery}"</strong>}.
            </p>
            <button
              type="button"
              className="btn btn-secondary empty-reset-btn"
              onClick={() =>
                setFilter({
                  searchQuery: '',
                  selectedDay: 'ALL',
                  selectedModality: 'ALL',
                  selectedCourse: 'ALL',
                  selectedDepartment: 'ALL',
                  onlyLiveNow: false,
                  onlyToday: false,
                  sortBy: 'name_asc'
                })
              }
            >
              Restablecer Filtros
            </button>
          </div>
        )}
      </main>

      {/* Floating Scroll to Top Button */}
      {showScrollTop && (
        <button
          type="button"
          className="prof-scroll-top-btn"
          onClick={scrollToTop}
          title="Volver arriba"
          aria-label="Volver arriba"
        >
          <ArrowUp size={20} />
        </button>
      )}

      {/* Detail Modal */}
      {selectedMentor && (
        <MentorDetailModal
          mentor={selectedMentor}
          onClose={() => setSelectedMentor(null)}
          currentDay={realTime.day}
          currentMinutes={realTime.minutes}
        />
      )}
    </div>
  );
};
