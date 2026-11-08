import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  CheckCircle2,
  MapPin,
  User,
  Check,
  X,
} from 'lucide-react';
import type { Course, Section, Session, FilterState } from '../types/schedule';
import { normalizeString, formatLocation } from '../utils/scheduleUtils';
import { getGraftonPigment } from '../utils/graftonPigments';

interface CourseSidebarProps {
  courses: Course[];
  selectedSections: Record<string, string>;
  onSelectSection: (courseCode: string, sectionNumber: string) => void;
  onRemoveSection: (courseCode: string) => void;
  onDragStartSection: (dragInfo: { courseCode: string; sectionNumber: string }) => void;
  onDragEndSection: () => void;
  metadata?: import('../types/schedule').MetadataInfo;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const CustomSelect = ({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: string;
  options: string[];
  onChange: (val: string) => void;
  placeholder: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="grafton-custom-select-trigger"
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value === 'ALL' ? placeholder : value}
        </span>
        <ChevronDown
          size={14}
          style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        />
      </button>

      {isOpen && (
        <div className="grafton-custom-select-menu">
          <button
            type="button"
            className={`grafton-custom-select-opt ${value === 'ALL' ? 'is-active' : ''}`}
            onClick={() => {
              onChange('ALL');
              setIsOpen(false);
            }}
          >
            {placeholder}
          </button>
          {options.map((opt: string) => (
            <button
              key={opt}
              type="button"
              className={`grafton-custom-select-opt ${value === opt ? 'is-active' : ''}`}
              onClick={() => {
                onChange(opt);
                setIsOpen(false);
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export interface MainSectionGroup {
  mainSecNum: string;
  subsections: Section[];
  hasSubsections: boolean;
  sharedSessions: Session[];
  modalities: string[];
  teoriaProfessors: string[];
  totalVacancies: number;
  totalEnrolled: number;
}

export const CourseSidebar: React.FC<CourseSidebarProps> = ({
  courses,
  selectedSections,
  onSelectSection,
  onRemoveSection,
  onDragStartSection,
  onDragEndSection,
  metadata,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const [filterState, setFilterState] = useState<FilterState>({
    searchQuery: '',
    onlyEligible: false,
    onlySelected: false,
    modalityFilter: 'ALL',
    dayFilter: 'ALL',
    typeFilter: 'ALL',
  });

  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  // Collapse selected sample courses initially on compact cards? No, let's keep compact section switcher or expandable cleanly!
  const [collapsedCourses, setCollapsedCourses] = useState<Set<string>>(new Set());
  const [professorFilters, setProfessorFilters] = useState<Record<string, string>>({});

  const hasEligibleFilter = courses.some(c => c.isEligible) && courses.some(c => !c.isEligible);
  const hasCourseTypeData = courses.some(c => c.courseType !== undefined);

  const filteredCourses = useMemo(() => {
    const q = filterState.searchQuery ? normalizeString(filterState.searchQuery) : '';

    const list = courses.filter(course => {
      if (q) {
        const normCode = normalizeString(course.code);
        const normName = normalizeString(course.name);

        const matchesCode = normCode.includes(q);
        const matchesName = normName.includes(q);
        const matchesProf = course.sections.some(sec =>
          sec.professors.some(prof => normalizeString(prof).includes(q))
        );

        if (!matchesCode && !matchesName && !matchesProf) return false;
      }

      if (hasEligibleFilter && filterState.onlyEligible && !course.isEligible) {
        return false;
      }

      if (filterState.onlySelected && !selectedSections[course.code]) {
        return false;
      }

      if (filterState.typeFilter !== 'ALL' && course.courseType !== filterState.typeFilter) {
        return false;
      }

      return true;
    });

    // Put currently selected courses at the top when no search query is typed so the user sees their active schedule courses immediately
    if (!q) {
      return [...list].sort((a, b) => {
        const aSel = selectedSections[a.code] ? 1 : 0;
        const bSel = selectedSections[b.code] ? 1 : 0;
        if (aSel !== bSel) return bSel - aSel;
        return 0;
      });
    }

    return list;
  }, [
    courses,
    filterState.searchQuery,
    filterState.onlyEligible,
    filterState.onlySelected,
    filterState.typeFilter,
    hasEligibleFilter,
    selectedSections,
  ]);

  const toggleCourseExpand = (code: string, currentlyExpanded: boolean) => {
    if (currentlyExpanded) {
      setExpandedCourses(prev => {
        const next = new Set(prev);
        next.delete(code);
        return next;
      });
      setCollapsedCourses(prev => {
        const next = new Set(prev);
        next.add(code);
        return next;
      });
    } else {
      setExpandedCourses(prev => {
        const next = new Set(prev);
        next.add(code);
        return next;
      });
      setCollapsedCourses(prev => {
        const next = new Set(prev);
        next.delete(code);
        return next;
      });
    }
  };

  const isAllFilteredExpanded =
    filteredCourses.length > 0 &&
    filteredCourses.every(course => {
      let isExpanded = expandedCourses.has(course.code) || !!filterState.searchQuery;
      if (collapsedCourses.has(course.code)) isExpanded = false;
      if (expandedCourses.has(course.code)) isExpanded = true;
      return isExpanded;
    });

  const toggleExpandAll = () => {
    if (isAllFilteredExpanded) {
      setCollapsedCourses(prev => {
        const next = new Set(prev);
        filteredCourses.forEach(c => next.add(c.code));
        return next;
      });
      setExpandedCourses(prev => {
        const next = new Set(prev);
        filteredCourses.forEach(c => next.delete(c.code));
        return next;
      });
    } else {
      setExpandedCourses(prev => {
        const next = new Set(prev);
        filteredCourses.forEach(c => next.add(c.code));
        return next;
      });
      setCollapsedCourses(prev => {
        const next = new Set(prev);
        filteredCourses.forEach(c => next.delete(c.code));
        return next;
      });
    }
  };

  const getCourseMainSectionGroups = (course: Course): MainSectionGroup[] => {
    const groupsMap = new Map<string, Section[]>();

    course.sections.forEach(sec => {
      const mainSecNum = sec.sectionNumber.split(' (')[0];
      if (!groupsMap.has(mainSecNum)) {
        groupsMap.set(mainSecNum, []);
      }
      groupsMap.get(mainSecNum)!.push(sec);
    });

    const result: MainSectionGroup[] = [];

    groupsMap.forEach((subsections, mainSecNum) => {
      subsections.sort((a, b) =>
        a.sectionNumber.localeCompare(b.sectionNumber, undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      );

      const hasSubsections = subsections.length > 1;

      let sharedSessions: Session[] = [];
      if (subsections.length > 0) {
        sharedSessions = subsections[0].sessions.filter(sess0 =>
          subsections.every(sub =>
            sub.sessions.some(
              s =>
                s.day === sess0.day &&
                s.startTime === sess0.startTime &&
                s.endTime === sess0.endTime &&
                s.sessionGroup === sess0.sessionGroup
            )
          )
        );
      }

      const teoriaProfs: string[] = [];
      sharedSessions.forEach(sess => {
        if (
          sess.professor &&
          sess.professor !== 'Por asignar' &&
          !teoriaProfs.includes(sess.professor)
        ) {
          teoriaProfs.push(sess.professor);
        }
      });

      if (teoriaProfs.length === 0) {
        subsections.forEach(sub => {
          sub.sessions.forEach(sess => {
            if (
              sess.sessionType === 'Teoría' &&
              sess.professor &&
              sess.professor !== 'Por asignar' &&
              !teoriaProfs.includes(sess.professor)
            ) {
              teoriaProfs.push(sess.professor);
            }
          });
        });
      }

      if (teoriaProfs.length === 0 && subsections[0]?.professors.length > 0) {
        subsections[0].professors.forEach(p => {
          if (p && p !== 'Por asignar' && !teoriaProfs.includes(p)) teoriaProfs.push(p);
        });
      }

      const modSet = new Set<string>();
      subsections.forEach(s =>
        s.sessions.forEach(sess => {
          if (sess.modality) modSet.add(sess.modality);
        })
      );

      const totalVacancies = subsections.reduce((acc, sub) => acc + (sub.vacancies || 0), 0);
      const totalEnrolled = subsections.reduce((acc, sub) => acc + (sub.enrolled || 0), 0);

      result.push({
        mainSecNum,
        subsections,
        hasSubsections,
        sharedSessions,
        modalities: Array.from(modSet),
        teoriaProfessors: teoriaProfs,
        totalVacancies,
        totalEnrolled,
      });
    });

    result.sort((a, b) =>
      a.mainSecNum.localeCompare(b.mainSecNum, undefined, { numeric: true, sensitivity: 'base' })
    );

    return result;
  };

  const selectedCount = Object.keys(selectedSections).length;

  return (
    <aside
      id="course-sidebar-drawer"
      className={`sidebar-panel ${isMobileOpen ? 'is-mobile-open' : ''}`}
      aria-label="Panel de asignaturas y secciones"
    >
      <div className="sidebar-header">
        <div className="sidebar-title-row">
          <div className="sidebar-title-group">
            <h2 className="sidebar-title">Tus Asignaturas</h2>
            <span className="sidebar-count-badge">{filteredCourses.length}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button type="button" onClick={toggleExpandAll} className="sidebar-expand-btn">
              {isAllFilteredExpanded ? 'Colapsar' : 'Expandir'}
            </button>

            {onCloseMobile && (
              <button
                type="button"
                className="sidebar-mobile-close-btn"
                onClick={onCloseMobile}
                aria-label="Cerrar panel de Cursos"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <p className="sidebar-hint">
          Pasa el cursor sobre otra sección para previsualizar en horario
        </p>

        {/* Search input bar */}
        <div className="search-bar">
          <Search size={15} color="var(--text-muted)" />
          <input
            type="text"
            className="search-input"
            placeholder="Buscar curso, código o docente..."
            value={filterState.searchQuery}
            onChange={e => setFilterState(prev => ({ ...prev, searchQuery: e.target.value }))}
          />
        </div>

        {/* Filter Pills */}
        <div className="filter-pills">
          <button
            type="button"
            className={`filter-pill-btn ${filterState.onlySelected ? 'active' : ''}`}
            onClick={() => setFilterState(prev => ({ ...prev, onlySelected: !prev.onlySelected }))}
          >
            {filterState.onlySelected
              ? `✓ En horario (${selectedCount})`
              : `En horario ${selectedCount > 0 ? `(${selectedCount})` : ''}`}
          </button>

          {hasEligibleFilter && (
            <button
              type="button"
              className={`filter-pill-btn ${filterState.onlyEligible ? 'active' : ''}`}
              onClick={() =>
                setFilterState(prev => ({ ...prev, onlyEligible: !prev.onlyEligible }))
              }
            >
              {filterState.onlyEligible ? '✓ Habilitados PDF' : 'Habilitados PDF'}
            </button>
          )}

          {hasCourseTypeData && (
            <>
              <button
                type="button"
                className={`filter-pill-btn ${filterState.typeFilter === 'Obligatorio' ? 'active' : ''}`}
                onClick={() =>
                  setFilterState(prev => ({
                    ...prev,
                    typeFilter: prev.typeFilter === 'Obligatorio' ? 'ALL' : 'Obligatorio',
                  }))
                }
              >
                Obligatorios
              </button>
              <button
                type="button"
                className={`filter-pill-btn ${filterState.typeFilter === 'Electivo' ? 'active' : ''}`}
                onClick={() =>
                  setFilterState(prev => ({
                    ...prev,
                    typeFilter: prev.typeFilter === 'Electivo' ? 'ALL' : 'Electivo',
                  }))
                }
              >
                Electivos
              </button>
              {metadata?.documentType === 'Consolidado de Horario' && (
                <button
                  type="button"
                  className={`filter-pill-btn ${filterState.typeFilter === 'Otros (Malla Nueva)' ? 'active' : ''}`}
                  onClick={() =>
                    setFilterState(prev => ({
                      ...prev,
                      typeFilter:
                        prev.typeFilter === 'Otros (Malla Nueva)' ? 'ALL' : 'Otros (Malla Nueva)',
                    }))
                  }
                >
                  Malla Nueva
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Course List Scroll */}
      <div className="course-list-scroll">
        {filteredCourses.length === 0 ? (
          <div className="sidebar-empty-msg">No hay cursos que coincidan con la búsqueda.</div>
        ) : (
          filteredCourses.map(course => {
            const isSelected = !!selectedSections[course.code];
            const activeSectionNum = selectedSections[course.code];
            const pigment = getGraftonPigment(course.code);

            let isExpanded = expandedCourses.has(course.code) || !!filterState.searchQuery;
            if (collapsedCourses.has(course.code)) {
              isExpanded = false;
            }
            if (expandedCourses.has(course.code)) {
              isExpanded = true;
            }

            const mainSectionGroups = getCourseMainSectionGroups(course);

            const courseProfessors = Array.from(
              new Set(
                course.sections
                  .flatMap(sec => sec.professors)
                  .filter(p => p && p !== 'Por asignar')
              )
            ).sort();

            const currentProfFilter = professorFilters[course.code];
            let displayMainGroups = mainSectionGroups;

            if (currentProfFilter && currentProfFilter !== 'ALL') {
              displayMainGroups = mainSectionGroups
                .map(group => {
                  const matchingSubsections = group.subsections.filter(sub =>
                    sub.professors.includes(currentProfFilter)
                  );
                  if (matchingSubsections.length > 0) {
                    return { ...group, subsections: matchingSubsections };
                  }
                  return null;
                })
                .filter(Boolean) as MainSectionGroup[];
            }

            return (
              <div
                key={course.code}
                className={`course-card ${isSelected ? 'course-card--selected' : ''}`}
              >
                {/* Course Header Row */}
                <div
                  className="course-card-header"
                  onClick={() => toggleCourseExpand(course.code, isExpanded)}
                >
                  <div className="course-info">
                    <div className="course-code-row">
                      <span
                        className="course-pigment-dot"
                        style={{ background: pigment.bar }}
                        aria-hidden="true"
                      />
                      <span className="course-code">{course.code}</span>
                      <span className="course-sec-count">
                        · {mainSectionGroups.length}{' '}
                        {mainSectionGroups.length === 1 ? 'sec' : 'secs'}
                      </span>
                      {course.isEligible && <span className="eligible-badge">Habilitado</span>}
                    </div>
                    <div className="course-name">{course.name}</div>
                  </div>

                  <div className="course-card-chevron">
                    {isSelected && (
                      <span className="selected-sec-pill">
                        <CheckCircle2 size={11} />
                        Sec {activeSectionNum.split(' ')[0]}
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronDown size={16} color="var(--text-secondary)" />
                    ) : (
                      <ChevronRight size={16} color="var(--text-muted)" />
                    )}
                  </div>
                </div>

                {/* Quick Compact Section Pills when Selected & Collapsed (matches 02_Grafton_Schedule_Figma.svg) */}
                {isSelected && !isExpanded && course.sections.length > 0 && (
                  <div className="quick-sec-strip">
                    {course.sections.slice(0, 3).map(sec => {
                      const isThisSec = activeSectionNum === sec.sectionNumber;
                      const shortSec = sec.sectionNumber.replace(/LABORATORIO\s*/i, 'Lab ');
                      const shortProf = sec.professors[0]
                        ? sec.professors[0].split(',')[0].slice(0, 12)
                        : '';
                      return (
                        <button
                          key={sec.sectionNumber}
                          type="button"
                          className={`quick-sec-btn ${isThisSec ? 'is-active' : ''}`}
                          onClick={e => {
                            e.stopPropagation();
                            if (!isThisSec) onSelectSection(course.code, sec.sectionNumber);
                          }}
                          onMouseEnter={() => {
                            if (!isThisSec) {
                              onDragStartSection({
                                courseCode: course.code,
                                sectionNumber: sec.sectionNumber,
                              });
                            }
                          }}
                          onMouseLeave={() => onDragEndSection()}
                          title={`Cambiar a Sección ${sec.sectionNumber}`}
                        >
                          Sec {shortSec}
                          {shortProf ? ` · ${shortProf}` : ''}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Expanded Sections Breakdown */}
                {isExpanded && (
                  <div className="course-sections-drawer">
                    {courseProfessors.length > 1 && (
                      <div className="course-prof-filter">
                        <User size={14} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                        <CustomSelect
                          value={currentProfFilter || 'ALL'}
                          options={courseProfessors}
                          placeholder={`Todos los docentes (${courseProfessors.length})`}
                          onChange={val =>
                            setProfessorFilters(prev => ({ ...prev, [course.code]: val }))
                          }
                        />
                      </div>
                    )}

                    {displayMainGroups.length === 0 && (
                      <div className="sidebar-empty-msg">No hay secciones con este docente.</div>
                    )}

                    {displayMainGroups.map(mainGroup => {
                      const singleSubSec = mainGroup.subsections[0];
                      const isSingleSelected = activeSectionNum === singleSubSec?.sectionNumber;

                      return (
                        <div
                          key={mainGroup.mainSecNum}
                          className="main-section-box"
                          draggable={!mainGroup.hasSubsections}
                          onDragStart={e => {
                            if (mainGroup.hasSubsections || !singleSubSec) return;
                            e.dataTransfer.effectAllowed = 'copy';
                            e.dataTransfer.setData(
                              'text/plain',
                              JSON.stringify({
                                courseCode: course.code,
                                sectionNumber: singleSubSec.sectionNumber,
                              })
                            );
                            onDragStartSection({
                              courseCode: course.code,
                              sectionNumber: singleSubSec.sectionNumber,
                            });
                          }}
                          onDragEnd={() => {
                            if (!mainGroup.hasSubsections) onDragEndSection();
                          }}
                          onMouseEnter={() => {
                            if (!mainGroup.hasSubsections && singleSubSec) {
                              onDragStartSection({
                                courseCode: course.code,
                                sectionNumber: singleSubSec.sectionNumber,
                              });
                            }
                          }}
                          onMouseLeave={() => {
                            if (!mainGroup.hasSubsections) onDragEndSection();
                          }}
                        >
                          <div className="main-section-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="main-section-title">
                                Sección {mainGroup.mainSecNum}
                              </span>
                              {mainGroup.hasSubsections && (
                                <span className="subsections-count-badge">
                                  {mainGroup.subsections.length} subsecs
                                </span>
                              )}
                            </div>

                            {!mainGroup.hasSubsections &&
                              singleSubSec &&
                              (isSingleSelected ? (
                                <button
                                  type="button"
                                  className="select-btn remove"
                                  onClick={e => {
                                    e.stopPropagation();
                                    onRemoveSection(course.code);
                                  }}
                                >
                                  <Trash2 size={12} /> Quitar
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="select-btn"
                                  onClick={e => {
                                    e.stopPropagation();
                                    onSelectSection(course.code, singleSubSec.sectionNumber);
                                  }}
                                >
                                  <Plus size={12} /> Elegir
                                </button>
                              ))}
                          </div>

                          <div className="section-modality-row">
                            <span>{mainGroup.modalities.join(' / ') || 'Presencial'}</span>
                            <span className="section-vacancies">
                              {mainGroup.totalEnrolled}/{mainGroup.totalVacancies} mat.
                            </span>
                          </div>

                          {mainGroup.hasSubsections && mainGroup.teoriaProfessors.length > 0 && (
                            <div className="section-prof-row">
                              <User size={12} color="var(--accent-primary)" />
                              <span>{mainGroup.teoriaProfessors.join(', ')}</span>
                            </div>
                          )}

                          {!mainGroup.hasSubsections && singleSubSec && (
                            <>
                              {(() => {
                                const profMap = new Map<string, string[]>();
                                singleSubSec.sessions.forEach(sess => {
                                  if (sess.professor && sess.professor !== 'Por asignar') {
                                    const type =
                                      sess.sessionType ||
                                      sess.sessionGroup.split(' ')[0] ||
                                      'Docente';
                                    const prof = sess.professor;
                                    if (!profMap.has(prof)) profMap.set(prof, []);
                                    if (!profMap.get(prof)!.includes(type))
                                      profMap.get(prof)!.push(type);
                                  }
                                });

                                const hasMultipleProfs = profMap.size > 1;

                                return (
                                  <>
                                    {profMap.size > 0 && (
                                      <div className="section-profs-stack">
                                        {Array.from(profMap.keys()).map((prof, idx) => (
                                          <div key={idx} className="section-prof-row">
                                            <User size={12} color="var(--accent-primary)" />
                                            <span>{prof}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    <div className="session-tag-list">
                                      {singleSubSec.sessions.map((sess, idx) => (
                                        <div key={idx} className="session-tag">
                                          <div className="session-tag-main">
                                            <span className="session-tag-type">
                                              {sess.sessionGroup}
                                            </span>
                                            <span className="session-tag-time">
                                              <strong>{sess.day}</strong> {sess.startTime}–
                                              {sess.endTime}
                                            </span>
                                          </div>
                                          {sess.location && (
                                            <span className="session-tag-loc">
                                              <MapPin size={10} /> {formatLocation(sess.location)}
                                            </span>
                                          )}
                                          {hasMultipleProfs &&
                                            sess.professor &&
                                            sess.professor !== 'Por asignar' && (
                                              <div className="session-tag-subprof">
                                                <User size={11} /> {sess.professor}
                                              </div>
                                            )}
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                );
                              })()}
                            </>
                          )}

                          {mainGroup.hasSubsections && (
                            <>
                              {mainGroup.sharedSessions.length > 0 && (
                                <div className="shared-sessions-block">
                                  <div className="obligatorio-label">TEORÍA COMPARTIDA:</div>
                                  {mainGroup.sharedSessions.map((sSess, sIdx) => (
                                    <div key={sIdx} className="obligatorio-session-pill">
                                      <span>{sSess.sessionGroup}</span>
                                      <span className="mono-time">
                                        <strong>{sSess.day}</strong> {sSess.startTime}–
                                        {sSess.endTime}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="subsections-list">
                                <div className="obligatorio-label">ELIGE SUBSECCIÓN:</div>

                                {mainGroup.subsections.map(subSec => {
                                  const isSubSelected = activeSectionNum === subSec.sectionNumber;

                                  let subTitle = `Sección ${subSec.sectionNumber}`;
                                  const matchParen = subSec.sectionNumber.match(/\((.*?)\)/);
                                  if (matchParen && matchParen[1]) {
                                    subTitle = matchParen[1];
                                  }

                                  const specificSessions = subSec.sessions.filter(
                                    sess =>
                                      !mainGroup.sharedSessions.some(
                                        s =>
                                          s.day === sess.day &&
                                          s.startTime === sess.startTime &&
                                          s.sessionGroup === sess.sessionGroup
                                      )
                                  );

                                  return (
                                    <div
                                      key={subSec.sectionNumber}
                                      className={`subsection-card ${isSubSelected ? 'selected' : ''}`}
                                      draggable={true}
                                      onDragStart={e => {
                                        e.dataTransfer.effectAllowed = 'copy';
                                        e.dataTransfer.setData(
                                          'text/plain',
                                          JSON.stringify({
                                            courseCode: course.code,
                                            sectionNumber: subSec.sectionNumber,
                                          })
                                        );
                                        onDragStartSection({
                                          courseCode: course.code,
                                          sectionNumber: subSec.sectionNumber,
                                        });
                                      }}
                                      onDragEnd={onDragEndSection}
                                      onMouseEnter={() =>
                                        onDragStartSection({
                                          courseCode: course.code,
                                          sectionNumber: subSec.sectionNumber,
                                        })
                                      }
                                      onMouseLeave={onDragEndSection}
                                    >
                                      <div className="subsection-card-head">
                                        <span className="subsection-title">{subTitle}</span>
                                        {isSubSelected && (
                                          <span className="subsection-selected-tag">
                                            <Check size={11} /> ELEGIDA
                                          </span>
                                        )}
                                      </div>

                                      {specificSessions.map((spSess, spIdx) => (
                                        <div key={spIdx} className="subsection-sess-row">
                                          <span className="mono-time">
                                            <strong>{spSess.day}</strong> {spSess.startTime}–
                                            {spSess.endTime}
                                          </span>
                                          {spSess.location && (
                                            <span className="session-tag-loc">
                                              {formatLocation(spSess.location)}
                                            </span>
                                          )}
                                        </div>
                                      ))}

                                      <div className="subsection-footer">
                                        <span className="section-vacancies">
                                          {subSec.enrolled}/{subSec.vacancies} mat.
                                        </span>
                                        {isSubSelected ? (
                                          <button
                                            type="button"
                                            className="select-btn remove"
                                            onClick={e => {
                                              e.stopPropagation();
                                              onRemoveSection(course.code);
                                            }}
                                          >
                                            <Trash2 size={11} /> Quitar
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            className="select-btn"
                                            onClick={e => {
                                              e.stopPropagation();
                                              onSelectSection(course.code, subSec.sectionNumber);
                                            }}
                                          >
                                            <Plus size={11} /> Elegir
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
