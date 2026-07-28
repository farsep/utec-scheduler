import React, { useState } from 'react';
import { Search, ChevronDown, ChevronRight, Plus, Trash2, GripVertical, CheckCircle2 } from 'lucide-react';
import type { Course, FilterState } from '../types/schedule';

interface CourseSidebarProps {
  courses: Course[];
  selectedSections: Record<string, string>; // courseCode -> sectionNumber
  onSelectSection: (courseCode: string, sectionNumber: string) => void;
  onRemoveSection: (courseCode: string) => void;
}

export const CourseSidebar: React.FC<CourseSidebarProps> = ({
  courses,
  selectedSections,
  onSelectSection,
  onRemoveSection
}) => {
  const [filterState, setFilterState] = useState<FilterState>({
    searchQuery: '',
    onlyEligible: false,
    modalityFilter: 'ALL',
    dayFilter: 'ALL',
    typeFilter: 'ALL'
  });

  // Track manually expanded courses. Default to first 5 or empty.
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set(['CS5352', 'CC1103', 'CS2023']));
  const [allExpanded, setAllExpanded] = useState<boolean>(false);

  // Filter courses
  const filteredCourses = courses.filter(course => {
    // Search query
    if (filterState.searchQuery) {
      const q = filterState.searchQuery.toLowerCase();
      const matchesCode = course.code.toLowerCase().includes(q);
      const matchesName = course.name.toLowerCase().includes(q);
      if (!matchesCode && !matchesName) return false;
    }

    // Only eligible
    if (filterState.onlyEligible && !course.isEligible) {
      return false;
    }

    // Type filter
    if (filterState.typeFilter !== 'ALL' && course.courseType !== filterState.typeFilter) {
      return false;
    }

    return true;
  });

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

  return (
    <aside className="glass-panel sidebar-panel">
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700 }}>
              Cursos Disponibles
            </h3>
            <span className="glass-pill" style={{ background: 'rgba(59, 130, 246, 0.18)', color: 'var(--accent-primary)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
              {filteredCourses.length}
            </span>
          </div>

          <button
            className="filter-pill-btn"
            onClick={toggleExpandAll}
            style={{ fontSize: '0.72rem', padding: '3px 8px' }}
          >
            {allExpanded ? 'Colapsar Todo' : 'Expandir Todo'}
          </button>
        </div>

        {/* Search Input */}
        <div className="search-bar">
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por código (ej. CS2023) o curso..."
            value={filterState.searchQuery}
            onChange={e => setFilterState({ ...filterState, searchQuery: e.target.value })}
          />
        </div>

        {/* Filter Pills */}
        <div className="filter-pills">
          <button
            className={`filter-pill-btn ${filterState.onlyEligible ? 'active' : ''}`}
            onClick={() => setFilterState({ ...filterState, onlyEligible: !filterState.onlyEligible })}
          >
            ✓ Habilitados PDF
          </button>

          <button
            className={`filter-pill-btn ${filterState.typeFilter === 'Obligatorio' ? 'active' : ''}`}
            onClick={() => setFilterState({ ...filterState, typeFilter: filterState.typeFilter === 'Obligatorio' ? 'ALL' : 'Obligatorio' })}
          >
            Obligatorios
          </button>

          <button
            className={`filter-pill-btn ${filterState.typeFilter === 'Electivo' ? 'active' : ''}`}
            onClick={() => setFilterState({ ...filterState, typeFilter: filterState.typeFilter === 'Electivo' ? 'ALL' : 'Electivo' })}
          >
            Electivos
          </button>
        </div>

        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <GripVertical size={14} color="var(--accent-primary)" />
          <span>Arrastra secciones a la grilla o haz clic en <strong>+ Agregar</strong></span>
        </div>
      </div>

      {/* Course List Scroll */}
      <div className="course-list-scroll">
        {filteredCourses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No hay cursos que coincidan con el filtro.
          </div>
        ) : (
          filteredCourses.map(course => {
            const isSelected = !!selectedSections[course.code];
            const activeSectionNum = selectedSections[course.code];
            const isExpanded = allExpanded || expandedCourses.has(course.code) || isSelected || !!filterState.searchQuery;

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
                      {course.isEligible && <span className="eligible-badge">Habilitado</span>}
                      {course.courseType && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          • {course.courseType}
                        </span>
                      )}
                    </div>
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

                {/* Sections List */}
                {isExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px', background: 'rgba(0, 0, 0, 0.2)' }}>
                    {course.sections.map(section => {
                      const isSecSelected = activeSectionNum === section.sectionNumber;

                      return (
                        <div
                          key={section.sectionNumber}
                          className={`section-item ${isSecSelected ? 'selected' : ''}`}
                          draggable={true}
                          onDragStart={e => {
                            e.dataTransfer.effectAllowed = 'copy';
                            e.dataTransfer.setData('text/plain', JSON.stringify({
                              courseCode: course.code,
                              sectionNumber: section.sectionNumber
                            }));
                          }}
                          style={{
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            cursor: 'grab'
                          }}
                        >
                          <div className="section-header-row">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <GripVertical size={16} color="var(--text-muted)" />
                              <span className="section-badge">
                                Sección {section.sectionNumber}
                              </span>
                            </div>

                            {isSecSelected ? (
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
                                  onSelectSection(course.code, section.sectionNumber);
                                }}
                              >
                                <Plus size={12} /> Agregar
                              </button>
                            )}
                          </div>

                          <div className="session-tag-list">
                            {section.sessions.map((sess, idx) => (
                              <div key={idx} className="session-tag">
                                <span className="session-tag-type">{sess.sessionGroup}</span>
                                <span><strong>{sess.day}</strong> {sess.startTime} - {sess.endTime}</span>
                              </div>
                            ))}
                          </div>

                          {section.professors.length > 0 && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', gap: '4px', marginTop: '2px' }}>
                              <span>Docente:</span>
                              <span style={{ color: 'var(--text-secondary)' }}>{section.professors.join(', ')}</span>
                            </div>
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
