import React, { useState, useEffect, useMemo } from 'react';
import type { Course, DayOfWeek } from '../../types/schedule';
import type { MentorInfo, MentorFilterState } from '../../types/mentor';
import { MENTORS_DATA } from '../../data/mentorsData';
import { getCurrentDayAndMinutes } from '../../utils/classroomUtils';
import { evaluateMentorLiveStatus, filterAndSortMentors } from '../../utils/mentorUtils';
import { MentorNavbar } from './MentorNavbar';
import { MentorFilterBar } from './MentorFilterBar';
import { MentorCard, type ActiveUserBlock } from './MentorCard';
import { MentorDetailModal } from './MentorDetailModal';
import {
  Award,
  Search,
  BookOpen,
  ArrowUp,
  Radio,
  Building2,
  CheckCircle2,
} from 'lucide-react';

interface MentorAppProps {
  hideTopNavbar?: boolean;
  scheduleCourses?: Course[];
  selectedSections?: Record<string, string>;
}

export const MentorApp: React.FC<MentorAppProps> = ({
  hideTopNavbar = false,
  scheduleCourses = [],
  selectedSections = {},
}) => {
  const initialTime = getCurrentDayAndMinutes();

  const [mentors] = useState<MentorInfo[]>(MENTORS_DATA);
  const [realTime, setRealTime] = useState<{ day: DayOfWeek; minutes: number; timeStr: string }>(
    initialTime
  );
  const [onlyCompatibleSchedule, setOnlyCompatibleSchedule] = useState<boolean>(false);

  const [filter, setFilter] = useState<MentorFilterState>({
    searchQuery: '',
    selectedDay: 'ALL',
    selectedModality: 'ALL',
    selectedCourse: 'ALL',
    selectedDepartment: 'ALL',
    onlyLiveNow: false,
    onlyToday: false,
    sortBy: 'name_asc',
  });

  const [selectedMentor, setSelectedMentor] = useState<MentorInfo | null>(null);
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

  // Build active schedule time blocks for live mentor clash detection
  const userScheduleBlocks: ActiveUserBlock[] = useMemo(() => {
    const blocks: ActiveUserBlock[] = [];
    Object.entries(selectedSections).forEach(([courseCode, secNum]) => {
      const course = scheduleCourses.find(c => c.code === courseCode);
      if (!course) return;
      const sec = course.sections.find(s => s.sectionNumber === secNum);
      if (!sec) return;
      sec.sessions.forEach(sess => {
        blocks.push({
          courseCode: course.code,
          courseName: course.name,
          day: sess.day,
          startMinutes: sess.startMinutes,
          endMinutes: sess.endMinutes,
        });
      });
    });
    return blocks;
  }, [scheduleCourses, selectedSections]);

  const handleFilterChange = (updates: Partial<MentorFilterState>) => {
    setFilter(prev => ({ ...prev, ...updates }));
  };

  const availableCourses = useMemo(() => {
    const map = new Map<string, string>();
    mentors.forEach(m => {
      m.courses.forEach(c => map.set(c.code, c.name));
    });
    return Array.from(map.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [mentors]);

  const availableDepartments = useMemo(() => {
    const map = new Map<string, string>();
    mentors.forEach(m => {
      map.set(m.departmentCode, m.departmentName);
    });
    return Array.from(map.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [mentors]);

  const liveNowCount = useMemo(() => {
    return mentors.filter(m => {
      const { isMentoringNow } = evaluateMentorLiveStatus(m, realTime.day, realTime.minutes);
      return isMentoringNow;
    }).length;
  }, [mentors, realTime.day, realTime.minutes]);

  const presencialSessionsCount = useMemo(() => {
    return mentors.reduce(
      (acc, m) => acc + m.sessions.filter(s => s.modality === 'Presencial').length,
      0
    );
  }, [mentors]);

  const compatibleMentorsCount = useMemo(() => {
    if (userScheduleBlocks.length === 0) return mentors.length;
    return mentors.filter(m =>
      m.sessions.some(
        sess =>
          !userScheduleBlocks.some(
            ub =>
              ub.day === sess.day &&
              Math.max(ub.startMinutes, sess.startMinutes) <
                Math.min(ub.endMinutes, sess.endMinutes)
          )
      )
    ).length;
  }, [mentors, userScheduleBlocks]);

  const filteredMentors = useMemo(() => {
    const base = filterAndSortMentors(mentors, filter, realTime.day, realTime.minutes);
    if (!onlyCompatibleSchedule || userScheduleBlocks.length === 0) return base;
    return base.filter(m =>
      m.sessions.some(
        sess =>
          !userScheduleBlocks.some(
            ub =>
              ub.day === sess.day &&
              Math.max(ub.startMinutes, sess.startMinutes) <
                Math.min(ub.endMinutes, sess.endMinutes)
          )
      )
    );
  }, [mentors, filter, realTime.day, realTime.minutes, onlyCompatibleSchedule, userScheduleBlocks]);

  return (
    <div className="classroom-finder-root professor-finder-root mentor-finder-root">
      {!hideTopNavbar && (
        <MentorNavbar
          totalMentors={mentors.length}
          filteredCount={filteredMentors.length}
          liveNowCount={liveNowCount}
        />
      )}

      <main className="classroom-finder-main professor-finder-main mentor-finder-main">
        {/* Grafton Swiss Hero Banner */}
        <div className="classroom-hero-banner glass-card">
          <div className="hero-content">
            <div className="hero-chip">
              <span>MENTORES & ASESORÍAS DE PARES · UTEC 2026-2</span>
            </div>

            <h1 className="hero-title">
              Mentores & Asesorías <span className="gradient-text">(Compatibles con tu Horario)</span>
            </h1>

            <p className="hero-subtitle">
              Detección automática de cruces contra tu horario activo: identifica al instante qué
              sesiones de mentoría están <strong>● Libres</strong> en tu semana y cuáles se cruzan
              con tus asignaturas seleccionadas.
            </p>
          </div>

          <div className="hero-kpi-badges prof-hero-kpi-badges mentor-hero-kpi-badges">
            <div
              className={`hero-kpi-badge prof-hero-kpi-card ${onlyCompatibleSchedule ? 'prof-hero-kpi-card--live' : ''}`}
              onClick={() => setOnlyCompatibleSchedule(prev => !prev)}
              style={{ cursor: 'pointer' }}
              title="Filtrar mentores con al menos una sesión libre en tu horario"
            >
              <div className="prof-kpi-card-header">
                <div className="prof-kpi-icon-wrap prof-kpi-icon-wrap--emerald">
                  <CheckCircle2 size={16} />
                </div>
                <span className="prof-kpi-badge-pill prof-kpi-badge-pill--emerald">Sin Cruce</span>
              </div>
              <span className="kpi-num text-emerald">{compatibleMentorsCount}</span>
              <span className="kpi-txt">Compatibles</span>
            </div>

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
                <span className="prof-kpi-badge-pill">Cursos</span>
              </div>
              <span className="kpi-num">{availableCourses.length}</span>
              <span className="kpi-txt">Asignaturas</span>
            </div>

            <div
              className={`hero-kpi-badge prof-hero-kpi-card ${filter.selectedModality === 'Presencial' ? 'prof-hero-kpi-card--live' : ''}`}
              onClick={() =>
                handleFilterChange({
                  selectedModality: filter.selectedModality === 'Presencial' ? 'ALL' : 'Presencial',
                })
              }
              style={{ cursor: 'pointer' }}
            >
              <div className="prof-kpi-card-header">
                <div className="prof-kpi-icon-wrap prof-kpi-icon-wrap--emerald">
                  <Building2 size={16} />
                </div>
                <span className="prof-kpi-badge-pill">Campus</span>
              </div>
              <span className="kpi-num">{presencialSessionsCount}</span>
              <span className="kpi-txt">Presenciales</span>
            </div>

            <div
              className={`hero-kpi-badge prof-hero-kpi-card ${filter.onlyLiveNow ? 'prof-hero-kpi-card--live' : ''}`}
              onClick={() => handleFilterChange({ onlyLiveNow: !filter.onlyLiveNow })}
              style={{ cursor: 'pointer' }}
            >
              <div className="prof-kpi-card-header">
                <div className="prof-kpi-icon-wrap prof-kpi-icon-wrap--purple">
                  <Radio size={16} />
                </div>
                <span className="prof-kpi-badge-pill">En Vivo</span>
              </div>
              <span className="kpi-num">{liveNowCount}</span>
              <span className="kpi-txt">Ahora</span>
            </div>
          </div>
        </div>

        {/* Compatibility Quick Filter Strip */}
        <div className="mentor-compat-bar">
          <button
            type="button"
            className={`filter-pill-btn ${onlyCompatibleSchedule ? 'active' : ''}`}
            onClick={() => setOnlyCompatibleSchedule(prev => !prev)}
          >
            {onlyCompatibleSchedule
              ? `✓ Mostrando solo compatibles con tu horario (${compatibleMentorsCount})`
              : `Filtrar compatibles con tu horario (${compatibleMentorsCount} de ${mentors.length})`}
          </button>
          <span className="mentor-compat-note">
            Horario evaluado: {Object.keys(selectedSections).length} asignaturas activas
          </span>
        </div>

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

        {filteredMentors.length > 0 ? (
          <div className="prof-grid mentor-grid">
            {filteredMentors.map(mentor => (
              <MentorCard
                key={mentor.id}
                mentor={mentor}
                currentDay={realTime.day}
                currentMinutes={realTime.minutes}
                userScheduleBlocks={userScheduleBlocks}
                onSelect={m => setSelectedMentor(m)}
              />
            ))}
          </div>
        ) : (
          <div className="prof-empty-state glass-card">
            <div className="empty-icon-wrap">
              <Search size={32} />
            </div>
            <h3 className="empty-title">No se encontraron mentores</h3>
            <p className="empty-desc">
              No hay mentores que coincidan con los filtros seleccionados
              {filter.searchQuery && <strong> "{filter.searchQuery}"</strong>}.
            </p>
            <button
              type="button"
              className="btn btn-secondary empty-reset-btn"
              onClick={() => {
                setOnlyCompatibleSchedule(false);
                setFilter({
                  searchQuery: '',
                  selectedDay: 'ALL',
                  selectedModality: 'ALL',
                  selectedCourse: 'ALL',
                  selectedDepartment: 'ALL',
                  onlyLiveNow: false,
                  onlyToday: false,
                  sortBy: 'name_asc',
                });
              }}
            >
              Restablecer Filtros
            </button>
          </div>
        )}
      </main>

      {showScrollTop && (
        <button
          type="button"
          className="mobile-floating-top-btn"
          onClick={scrollToTop}
          title="Subir a filtros y búsqueda"
          aria-label="Subir a filtros y búsqueda"
        >
          <ArrowUp size={15} />
          <span>Búsqueda</span>
        </button>
      )}

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
