import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, Plus, Trash2, GripVertical, CheckCircle2, MapPin, User, Users, Check } from 'lucide-react';
import type { Course, Section, Session, FilterState } from '../types/schedule';
import { normalizeString, formatLocation } from '../utils/scheduleUtils';

interface CourseSidebarProps {
  courses: Course[];
  selectedSections: Record<string, string>; // courseCode -> sectionNumber
  onSelectSection: (courseCode: string, sectionNumber: string) => void;
  onRemoveSection: (courseCode: string) => void;
  onDragStartSection: (dragInfo: { courseCode: string; sectionNumber: string }) => void;
  onDragEndSection: () => void;
}

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
  onDragEndSection
}) => {
  const [filterState, setFilterState] = useState<FilterState>({
    searchQuery: '',
    onlyEligible: false,
    modalityFilter: 'ALL',
    dayFilter: 'ALL',
    typeFilter: 'ALL'
  });

  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set(['CC1103', 'CS5352', 'CS2023']));
  const [allExpanded, setAllExpanded] = useState<boolean>(false);

  // Memoized course filtering
  const filteredCourses = useMemo(() => {
    const q = filterState.searchQuery ? normalizeString(filterState.searchQuery) : '';

    return courses.filter(course => {
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

      if (filterState.onlyEligible && !course.isEligible) {
        return false;
      }

      if (filterState.typeFilter !== 'ALL' && course.courseType !== filterState.typeFilter) {
        return false;
      }

      return true;
    });
  }, [courses, filterState.searchQuery, filterState.onlyEligible, filterState.typeFilter]);

  const toggleCourseExpand = (code: string) => {
    setExpandedCourses(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const toggleExpandAll = () => {
    if (allExpanded) {
      setExpandedCourses(new Set());
      setAllExpanded(false);
    } else {
      const allCodes = new Set(filteredCourses.map(c => c.code));
      setExpandedCourses(allCodes);
      setAllExpanded(true);
    }
  };

  // Helper to group sections into main sections
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
      // Always sort subsections alphanumerically
      subsections.sort((a, b) =>
        a.sectionNumber.localeCompare(b.sectionNumber, undefined, { numeric: true, sensitivity: 'base' })
      );

      const hasSubsections = subsections.length > 1;

      // Shared sessions across all subsections
      let sharedSessions: Session[] = [];
      if (subsections.length > 0) {
        sharedSessions = subsections[0].sessions.filter(sess0 =>
          subsections.every(sub =>
            sub.sessions.some(s => s.day === sess0.day && s.startTime === sess0.startTime && s.endTime === sess0.endTime && s.sessionGroup === sess0.sessionGroup)
          )
        );
      }

      // Collect Teoría / Main professors ONLY for main card
      const teoriaProfs: string[] = [];

      // Check shared sessions first
      sharedSessions.forEach(sess => {
        if (sess.professor && sess.professor !== 'Por asignar' && !teoriaProfs.includes(sess.professor)) {
          teoriaProfs.push(sess.professor);
        }
      });

      // Check any session with sessionType === 'Teoría'
      if (teoriaProfs.length === 0) {
        subsections.forEach(sub => {
          sub.sessions.forEach(sess => {
            if (sess.sessionType === 'Teoría' && sess.professor && sess.professor !== 'Por asignar' && !teoriaProfs.includes(sess.professor)) {
              teoriaProfs.push(sess.professor);
            }
          });
        });
      }

      // Fallback if no specific theory professor found
      if (teoriaProfs.length === 0 && subsections[0]?.professors.length > 0) {
        subsections[0].professors.forEach(p => {
          if (p && p !== 'Por asignar' && !teoriaProfs.includes(p)) teoriaProfs.push(p);
        });
      }

      // Collect all modalities
      const modSet = new Set<string>();
      subsections.forEach(s => s.sessions.forEach(sess => {
        if (sess.modality) modSet.add(sess.modality);
      }));

      let totalVacancies = 0;
      let totalEnrolled = 0;

      if (subsections.length > 0) {
        totalVacancies = subsections.reduce((acc, sub) => acc + (sub.vacancies || 0), 0);
        totalEnrolled = subsections.reduce((acc, sub) => acc + (sub.enrolled || 0), 0);
      }

      result.push({
        mainSecNum,
        subsections,
        hasSubsections,
        sharedSessions,
        modalities: Array.from(modSet),
        teoriaProfessors: teoriaProfs,
        totalVacancies,
        totalEnrolled
      });
    });

    // Sort main sections numerically / alphanumerically
    result.sort((a, b) =>
      a.mainSecNum.localeCompare(b.mainSecNum, undefined, { numeric: true, sensitivity: 'base' })
    );

    return result;
  };

  // Helper to extract Laboratorio / Subgroup professors ONLY for a specific subsection card
  const getSubsectionLabProfessors = (subSec: Section, sharedSessions: Session[]): string[] => {
    const profs: string[] = [];

    subSec.sessions.forEach(sess => {
      const isShared = sharedSessions.some(s => s.day === sess.day && s.startTime === sess.startTime && s.sessionGroup === sess.sessionGroup);
      if (!isShared && sess.professor && sess.professor !== 'Por asignar' && !profs.includes(sess.professor)) {
        profs.push(sess.professor);
      }
    });

    if (profs.length === 0) {
      subSec.professors.forEach(p => {
        if (p && p !== 'Por asignar' && !profs.includes(p)) profs.push(p);
      });
    }

    return profs;
  };

  return (
    <aside className="glass-panel sidebar-panel">
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 700 }}>
              Cursos Disponibles
            </h3>
            <span className="glass-pill" style={{ background: 'rgba(59, 130, 246, 0.18)', color: 'var(--accent-primary)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
              {filteredCourses.length}
            </span>
          </div>

          <button
            onClick={toggleExpandAll}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {allExpanded ? 'Colapsar Todo' : 'Expandir Todo'}
          </button>
        </div>

        {/* Search input bar */}
        <div className="search-bar">
          <Search size={16} color="var(--text-muted)" />
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
            className={`filter-pill-btn ${filterState.onlyEligible ? 'active' : ''}`}
            onClick={() => setFilterState(prev => ({ ...prev, onlyEligible: !prev.onlyEligible }))}
          >
            {filterState.onlyEligible ? '✓ Habilitados PDF' : 'Habilitados PDF'}
          </button>
          <button
            className={`filter-pill-btn ${filterState.typeFilter === 'Obligatorio' ? 'active' : ''}`}
            onClick={() => setFilterState(prev => ({ ...prev, typeFilter: prev.typeFilter === 'Obligatorio' ? 'ALL' : 'Obligatorio' }))}
          >
            Obligatorios
          </button>
          <button
            className={`filter-pill-btn ${filterState.typeFilter === 'Electivo' ? 'active' : ''}`}
            onClick={() => setFilterState(prev => ({ ...prev, typeFilter: prev.typeFilter === 'Electivo' ? 'ALL' : 'Electivo' }))}
          >
            Electivos
          </button>
        </div>
      </div>

      {/* Course List Scroll */}
      <div className="course-list-scroll">
        {filteredCourses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No hay cursos que coincidan con la búsqueda.
          </div>
        ) : (
          filteredCourses.map(course => {
            const isSelected = !!selectedSections[course.code];
            const activeSectionNum = selectedSections[course.code];
            const isExpanded = allExpanded || expandedCourses.has(course.code) || isSelected || !!filterState.searchQuery;
            const mainSectionGroups = getCourseMainSectionGroups(course);

            return (
              <div key={course.code} className="course-card">
                {/* Course Header Row */}
                <div
                  className="course-card-header"
                  onClick={() => toggleCourseExpand(course.code)}
                >
                  <div className="course-info">
                    <div className="course-code-row">
                      <span className="course-code" style={{ color: course.color }}>{course.code}</span>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        • {mainSectionGroups.length} {mainSectionGroups.length === 1 ? 'sección' : 'secciones'}
                      </span>
                      {course.isEligible && <span className="eligible-badge">Habilitado</span>}
                    </div>
                    {/* Full Untruncated Course Name */}
                    <div className="course-name">{course.name}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isSelected && (
                      <span className="glass-pill" style={{ color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.15)' }}>
                        <CheckCircle2 size={12} style={{ display: 'inline', marginRight: '3px' }} />
                        Sec {activeSectionNum}
                      </span>
                    )}
                    {isExpanded ? <ChevronDown size={18} color="var(--text-muted)" /> : <ChevronRight size={18} color="var(--text-muted)" />}
                  </div>
                </div>

                {/* Expanded Sections Breakdown */}
                {isExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px', background: 'rgba(0, 0, 0, 0.25)' }}>
                    {mainSectionGroups.map(mainGroup => {
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
                            e.dataTransfer.setData('text/plain', JSON.stringify({
                              courseCode: course.code,
                              sectionNumber: singleSubSec.sectionNumber
                            }));
                            onDragStartSection({ courseCode: course.code, sectionNumber: singleSubSec.sectionNumber });
                          }}
                          onDragEnd={() => {
                            if (!mainGroup.hasSubsections) onDragEndSection();
                          }}
                          onMouseEnter={() => {
                            if (!mainGroup.hasSubsections && singleSubSec) {
                              onDragStartSection({ courseCode: course.code, sectionNumber: singleSubSec.sectionNumber });
                            }
                          }}
                          onMouseLeave={() => {
                            if (!mainGroup.hasSubsections) onDragEndSection();
                          }}
                        >
                          {/* Main Section Header Row */}
                          <div className="main-section-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800 }}>
                                Sección {mainGroup.mainSecNum}
                              </span>
                              {mainGroup.hasSubsections && (
                                <span className="subsections-count-badge">
                                  {mainGroup.subsections.length} subsecciones
                                </span>
                              )}
                            </div>

                            {/* Standard Selection Button beside section title if NO subsecciones exist */}
                            {!mainGroup.hasSubsections && singleSubSec && (
                              isSingleSelected ? (
                                <button
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
                                  className="select-btn"
                                  onClick={e => {
                                    e.stopPropagation();
                                    onSelectSection(course.code, singleSubSec.sectionNumber);
                                  }}
                                >
                                  <Plus size={12} /> Seleccionar
                                </button>
                              )
                            )}
                          </div>

                          {/* Modality & Enrollment Info */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <span>{mainGroup.modalities.join(' / ') || 'Presencial'}</span>
                            <span style={{ color: 'var(--text-muted)' }}>({mainGroup.totalEnrolled}/{mainGroup.totalVacancies} matriculados)</span>
                          </div>

                          {/* Docente / Teoría Professor ONLY */}
                          {mainGroup.teoriaProfessors.length > 0 && (
                            <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                              {mainGroup.teoriaProfessors.join(', ')}
                            </div>
                          )}

                          {/* CASE A: Single Section - Render clean session breakdown list directly */}
                          {!mainGroup.hasSubsections && singleSubSec && (
                            <div className="session-tag-list" style={{ marginTop: '4px' }}>
                              {singleSubSec.sessions.map((sess, idx) => (
                                <div key={idx} className="session-tag">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="session-tag-type">{sess.sessionGroup}</span>
                                    {sess.modality && (
                                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                        ({sess.modality})
                                      </span>
                                    )}
                                    <span><strong>{sess.day}</strong> {sess.startTime}-{sess.endTime}</span>
                                  </div>
                                  {sess.location && (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                      <MapPin size={11} /> {formatLocation(sess.location)}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* CASE B: Multi-Subsecciones - Render Obligatorio & Subsecciones breakdown */}
                          {mainGroup.hasSubsections && (
                            <>
                              {/* Shared Obligatorio Sessions (e.g. TEORÍA VIRTUAL 1) */}
                              {mainGroup.sharedSessions.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                                  <div className="obligatorio-label">OBLIGATORIO:</div>
                                  {mainGroup.sharedSessions.map((sSess, sIdx) => (
                                    <div key={sIdx} className="obligatorio-session-pill">
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span>{sSess.sessionGroup}</span>
                                        {sSess.modality && (
                                          <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>({sSess.modality})</span>
                                        )}
                                      </div>
                                      <span><strong>{sSess.day}</strong> {sSess.startTime}-{sSess.endTime}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Subsections Selection Area */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                                <div className="obligatorio-label" style={{ color: 'var(--text-muted)' }}>
                                  ELIGE UNA SUBSECCIÓN:
                                </div>

                                {mainGroup.subsections.map(subSec => {
                                  const isSubSelected = activeSectionNum === subSec.sectionNumber;

                                  // Extract subsection sub-label (e.g. "Laboratorio 11")
                                  let subTitle = `Sección ${subSec.sectionNumber}`;
                                  const matchParen = subSec.sectionNumber.match(/\((.*?)\)/);
                                  if (matchParen && matchParen[1]) {
                                    subTitle = matchParen[1];
                                  }

                                  // Specific non-shared sessions
                                  const specificSessions = subSec.sessions.filter(sess =>
                                    !mainGroup.sharedSessions.some(s => s.day === sess.day && s.startTime === sess.startTime && s.sessionGroup === sess.sessionGroup)
                                  );

                                  // Laboratorio / Subgroup professors ONLY
                                  const labProfs = getSubsectionLabProfessors(subSec, mainGroup.sharedSessions);

                                  return (
                                    <div
                                      key={subSec.sectionNumber}
                                      className={`subsection-card ${isSubSelected ? 'selected' : ''}`}
                                      draggable={true}
                                      onDragStart={e => {
                                        e.dataTransfer.effectAllowed = 'copy';
                                        e.dataTransfer.setData('text/plain', JSON.stringify({
                                          courseCode: course.code,
                                          sectionNumber: subSec.sectionNumber
                                        }));
                                        onDragStartSection({ courseCode: course.code, sectionNumber: subSec.sectionNumber });
                                      }}
                                      onDragEnd={() => {
                                        onDragEndSection();
                                      }}
                                      onMouseEnter={() => {
                                        onDragStartSection({ courseCode: course.code, sectionNumber: subSec.sectionNumber });
                                      }}
                                      onMouseLeave={() => {
                                        onDragEndSection();
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '0.92rem' }}>
                                          {subTitle}
                                        </span>
                                        {isSubSelected && (
                                          <span style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            <Check size={12} /> SELECCIONADO
                                          </span>
                                        )}
                                      </div>

                                      {/* Specific Session Time, Modality & Location */}
                                      {specificSessions.map((spSess, spIdx) => (
                                        <div key={spIdx} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                          <span><strong>{spSess.day}</strong> {spSess.startTime}-{spSess.endTime}</span>
                                          {spSess.modality && (
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>({spSess.modality})</span>
                                          )}
                                        </div>
                                      ))}

                                      {/* Vacancies & Laboratorio Docente ONLY */}
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        <span>{subSec.enrolled}/{subSec.vacancies}</span>
                                        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{labProfs.join(', ')}</span>
                                      </div>

                                      {/* Action Button */}
                                      <div style={{ marginTop: '4px' }}>
                                        {isSubSelected ? (
                                          <button
                                            className="select-btn remove"
                                            onClick={e => {
                                              e.stopPropagation();
                                              onRemoveSection(course.code);
                                            }}
                                            style={{ width: '100%', justifyContent: 'center' }}
                                          >
                                            <Trash2 size={12} /> Quitar
                                          </button>
                                        ) : (
                                          <button
                                            className="select-btn"
                                            onClick={e => {
                                              e.stopPropagation();
                                              onSelectSection(course.code, subSec.sectionNumber);
                                            }}
                                            style={{ width: '100%', justifyContent: 'center' }}
                                          >
                                            <Plus size={12} /> Seleccionar
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
