import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  BookOpen,
  GraduationCap,
  Building2,
  GitBranch,
  Zap,
  Download,
  Upload,
  Star,
  ArrowRight,
  X,
} from 'lucide-react';
import type { CourseExtendedInfo } from '../types/courseDirectory';
import type { ProfessorInfo } from '../types/professor';
import type { ClassroomInfo } from '../types/classroom';
import {
  getCoursesCatalog,
  getProfessorsCatalog,
  getClassroomsCatalog,
  getSynchronousCachedCourses,
  getSynchronousCachedProfessors,
  getSynchronousCachedClassrooms,
} from '../utils/masterDataLoader';
import { UTEC_16_CAREERS } from '../data/utecCurriculaData';
import type { TabKey } from './AppShell';

type PaletteCategory = 'ALL' | 'COURSES' | 'PROFESSORS' | 'CLASSROOMS' | 'MALLAS' | 'ACTIONS';

interface PaletteItem {
  id: string;
  category: Exclude<PaletteCategory, 'ALL'>;
  code: string;
  title: string;
  subtitle: string;
  badge: string;
  accentColor: string;
  searchKey: string;
  scoreBoost?: number;
  onSelect: () => void;
}

interface CommandPaletteProps {
  onSwitchTab: (tab: TabKey, targetUrl?: string) => void;
  onOpenUploadModal: () => void;
  onOpenExportModal: () => void;
}

function normalizeQuery(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  onSwitchTab,
  onOpenUploadModal,
  onOpenExportModal,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<PaletteCategory>('ALL');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [courses, setCourses] = useState<CourseExtendedInfo[]>(
    () => getSynchronousCachedCourses() || []
  );
  const [professors, setProfessors] = useState<ProfessorInfo[]>(
    () => getSynchronousCachedProfessors() || []
  );
  const [classrooms, setClassrooms] = useState<ClassroomInfo[]>(
    () => getSynchronousCachedClassrooms() || []
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load catalogs on open if not yet cached
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    Promise.allSettled([
      getCoursesCatalog(),
      getProfessorsCatalog(),
      getClassroomsCatalog(),
    ]).then(([cRes, pRes, rRes]) => {
      if (cancelled) return;
      if (cRes.status === 'fulfilled' && cRes.value.length > 0) setCourses(cRes.value);
      if (pRes.status === 'fulfilled' && pRes.value.length > 0) setProfessors(pRes.value);
      if (rRes.status === 'fulfilled' && rRes.value.length > 0) setClassrooms(rRes.value);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Global Cmd+K / Ctrl+K shortcut & custom event listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(prev => {
          const next = !prev;
          if (next) {
            setQuery('');
            setCategory('ALL');
            setSelectedIndex(0);
          }
          return next;
        });
      }
    };
    const onOpenEvt = () => {
      setQuery('');
      setCategory('ALL');
      setSelectedIndex(0);
      setIsOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('matriculab:open-cmdk', onOpenEvt);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('matriculab:open-cmdk', onOpenEvt);
    };
  }, []);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      const raf = requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [isOpen]);

  const closePalette = useCallback(() => {
    setIsOpen(false);
  }, []);

  const allItems = useMemo<PaletteItem[]>(() => {
    const actions: PaletteItem[] = [
      {
        id: 'action-optimizer',
        category: 'ACTIONS',
        code: 'QUANTUM',
        title: 'Ejecutar Motor Cuántico (Generador Automático)',
        subtitle: 'Combina cursos sin cruces y evalúa hasta 50 horarios óptimos',
        badge: 'ACCIÓN',
        accentColor: '#00779E',
        searchKey: 'ejecutar motor cuantico generador automatico horarios sin cruces',
        scoreBoost: 5,
        onSelect: () => {
          closePalette();
          onSwitchTab('schedule', '/');
          window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent('matriculab:cmdk-open-optimizer'));
          }, 60);
        },
      },
      {
        id: 'action-export',
        category: 'ACTIONS',
        code: 'EXPORT',
        title: 'Exportar Horario (.ics / PDF / PNG / Google Calendar)',
        subtitle: 'Descarga tu horario en iCalendar o sincroniza con Google Calendar',
        badge: 'ACCIÓN',
        accentColor: '#00779E',
        searchKey: 'exportar horario ics pdf png google calendar descargar',
        onSelect: () => {
          closePalette();
          onOpenExportModal();
        },
      },
      {
        id: 'action-import',
        category: 'ACTIONS',
        code: 'IMPORT',
        title: 'Importar Oferta Académica (PDF / Excel / JSON)',
        subtitle: 'Carga tu Consolidado de Matrícula o Oferta UTEC personalizada',
        badge: 'ACCIÓN',
        accentColor: '#00779E',
        searchKey: 'importar oferta pdf excel json archivo matricula',
        onSelect: () => {
          closePalette();
          onOpenUploadModal();
        },
      },
      {
        id: 'action-oyente',
        category: 'ACTIONS',
        code: 'OYENTE',
        title: 'Modo Oyente (Ver cursos guardados en Catálogo)',
        subtitle: 'Ir a /cursos y filtrar tus cursos marcados como oyente ★',
        badge: 'ACCIÓN',
        accentColor: '#B85D00',
        searchKey: 'modo oyente star visitante filtrar cursos',
        onSelect: () => {
          closePalette();
          onSwitchTab('courses', '/cursos');
          window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent('matriculab:cmdk-toggle-oyente'));
          }, 60);
        },
      },
    ];

    const courseItems: PaletteItem[] = courses.map(c => ({
      id: `course-${c.code}`,
      category: 'COURSES',
      code: c.code,
      title: c.name,
      subtitle: `${c.departmentLabel || 'Curso'} · ${c.totalSectionsCount} sec. · ${c.credits || 0} créditos`,
      badge: 'CURSO',
      accentColor: '#B85D00',
      searchKey: normalizeQuery(`${c.code} ${c.name} ${c.departmentLabel || ''}`),
      onSelect: () => {
        closePalette();
        onSwitchTab('courses', `/cursos?curso=${encodeURIComponent(c.code)}`);
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent('matriculab:cmdk-open-course', { detail: { code: c.code } }));
        }, 60);
      },
    }));

    const professorItems: PaletteItem[] = professors.map(p => ({
      id: `prof-${p.id}`,
      category: 'PROFESSORS',
      code: p.initials,
      title: p.displayName,
      subtitle: `${p.departmentLabel} · ${p.uniqueCoursesCount} cursos · ${p.totalHoursPerWeek}h/sem`,
      badge: 'DOCENTE',
      accentColor: '#B8332A',
      searchKey: normalizeQuery(
        `${p.displayName} ${p.lastNameFirst} ${p.email || ''} ${p.departmentLabel} ${p.courses.map(c => c.code + ' ' + c.name).join(' ')}`
      ),
      onSelect: () => {
        closePalette();
        onSwitchTab('professors', `/profesores?profesor=${encodeURIComponent(p.displayName)}`);
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('matriculab:cmdk-open-professor', { detail: { name: p.displayName } })
          );
        }, 60);
      },
    }));

    const classroomItems: PaletteItem[] = classrooms.map(r => ({
      id: `room-${r.code}`,
      category: 'CLASSROOMS',
      code: r.code,
      title: r.displayName || `Aula ${r.code}`,
      subtitle: `Piso ${r.floor} · Tipo: ${r.type.toUpperCase()}`,
      badge: 'AULA',
      accentColor: '#0D7A4E',
      searchKey: normalizeQuery(`${r.code} ${r.displayName} ${r.type} piso ${r.floor}`),
      onSelect: () => {
        closePalette();
        onSwitchTab('classrooms', `/aulas?aula=${encodeURIComponent(r.code)}`);
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('matriculab:cmdk-open-classroom', { detail: { code: r.code } })
          );
        }, 60);
      },
    }));

    const mallaItems: PaletteItem[] = UTEC_16_CAREERS.map(m => ({
      id: `malla-${m.id}`,
      category: 'MALLAS',
      code: m.shortCode,
      title: m.name,
      subtitle: `${m.facultyName} · ${m.totalCredits} créditos (10 ciclos)`,
      badge: 'MALLA',
      accentColor: '#00779E',
      searchKey: normalizeQuery(`${m.shortCode} ${m.name} ${m.facultyName} malla carrera`),
      onSelect: () => {
        closePalette();
        (window as any).__MATRICULAB_PENDING_CAREER__ = m.id;
        onSwitchTab('malla', '/malla');
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('matriculab:cmdk-select-career', { detail: { careerId: m.id } })
          );
        }, 60);
      },
    }));

    return [...actions, ...courseItems, ...classroomItems, ...professorItems, ...mallaItems];
  }, [courses, professors, classrooms, onSwitchTab, onOpenExportModal, onOpenUploadModal, closePalette]);

  const filteredItems = useMemo(() => {
    const q = normalizeQuery(query);
    const pool = category === 'ALL' ? allItems : allItems.filter(it => it.category === category);

    if (!q) {
      if (category === 'ALL') {
        const defaults = [
          ...pool.filter(i => i.category === 'ACTIONS'),
          ...pool.filter(i => i.category === 'COURSES').slice(0, 4),
          ...pool.filter(i => i.category === 'CLASSROOMS').slice(0, 3),
          ...pool.filter(i => i.category === 'MALLAS').slice(0, 3),
          ...pool.filter(i => i.category === 'PROFESSORS').slice(0, 3),
        ];
        return defaults;
      }
      return pool.slice(0, 40);
    }

    const terms = q.split(/\s+/).filter(Boolean);
    const scored: { item: PaletteItem; rank: number }[] = [];

    for (const item of pool) {
      const codeNorm = normalizeQuery(item.code);
      const titleNorm = normalizeQuery(item.title);
      if (!terms.every(t => item.searchKey.includes(t) || codeNorm.includes(t) || titleNorm.includes(t))) {
        continue;
      }
      let rank = item.scoreBoost || 0;
      if (codeNorm === q) rank += 120;
      else if (codeNorm.startsWith(q)) rank += 75;
      if (titleNorm === q) rank += 90;
      else if (titleNorm.startsWith(q)) rank += 50;
      else if (titleNorm.includes(q)) rank += 25;
      scored.push({ item, rank });
    }

    scored.sort((a, b) => b.rank - a.rank);
    return scored.slice(0, 36).map(s => s.item);
  }, [allItems, query, category]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, category]);

  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>('[data-cmdk-active="true"]');
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, isOpen]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredItems.length > 0) {
        setSelectedIndex(prev => (prev + 1) % filteredItems.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredItems.length > 0) {
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredItems[selectedIndex];
      if (target) target.onSelect();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  const getCategoryIcon = (cat: PaletteItem['category'], code: string) => {
    switch (cat) {
      case 'COURSES':
        return <BookOpen size={14} />;
      case 'PROFESSORS':
        return <GraduationCap size={14} />;
      case 'CLASSROOMS':
        return <Building2 size={14} />;
      case 'MALLAS':
        return <GitBranch size={14} />;
      case 'ACTIONS':
        if (code === 'EXPORT') return <Download size={14} />;
        if (code === 'IMPORT') return <Upload size={14} />;
        if (code === 'OYENTE') return <Star size={14} />;
        return <Zap size={14} />;
    }
  };

  const tabs: { id: PaletteCategory; label: string }[] = [
    { id: 'ALL', label: 'TODOS' },
    { id: 'COURSES', label: `CURSOS (${courses.length || 420})` },
    { id: 'PROFESSORS', label: `DOCENTES (${professors.length || 392})` },
    { id: 'CLASSROOMS', label: `AULAS (${classrooms.length || 100})` },
    { id: 'MALLAS', label: `MALLAS (${UTEC_16_CAREERS.length})` },
    { id: 'ACTIONS', label: 'ACCIONES' },
  ];

  return createPortal(
    <div
      className="command-palette-overlay"
      onClick={closePalette}
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de Comandos Universal Grafton"
      data-testid="command-palette-dialog"
    >
      <div
        className="grafton-cmdk-dialog"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Search Input */}
        <div className="grafton-cmdk-header">
          <Search size={18} className="grafton-cmdk-search-icon" />
          <input
            ref={inputRef}
            type="text"
            data-testid="cmdk-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Buscar cursos (CS2023), aulas (A908), docentes, carreras o acciones..."
            className="grafton-cmdk-input"
            aria-label="Buscar en toda la plataforma"
          />
          <kbd className="grafton-cmdk-esc">
            ESC
          </kbd>
          <button
            type="button"
            onClick={closePalette}
            aria-label="Cerrar paleta de comandos"
            className="grafton-cmdk-close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Category Filter Strip */}
        <div className="grafton-cmdk-tabs no-scrollbar">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setCategory(t.id)}
              className={`grafton-cmdk-tab ${category === t.id ? 'is-active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div ref={listRef} className="grafton-cmdk-list">
          {filteredItems.length === 0 ? (
            <div className="grafton-cmdk-empty">
              No se encontraron coincidencias para &ldquo;{query}&rdquo;.
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isActive = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-cmdk-active={isActive ? 'true' : 'false'}
                  data-cmdk-item-id={item.id}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => item.onSelect()}
                  className={`grafton-cmdk-item ${isActive ? 'is-active' : ''}`}
                  style={{
                    borderLeft: `4px solid ${isActive ? item.accentColor : 'transparent'}`,
                  }}
                >
                  <div className="grafton-cmdk-item-left">
                    <span
                      className="grafton-cmdk-item-icon"
                      style={{ color: item.accentColor }}
                    >
                      {getCategoryIcon(item.category, item.code)}
                    </span>
                    <div className="grafton-cmdk-item-body">
                      <div className="grafton-cmdk-item-top">
                        <span className="grafton-cmdk-item-code">
                          {item.code}
                        </span>
                        <span className="grafton-cmdk-item-title">
                          {item.title}
                        </span>
                      </div>
                      <div className="grafton-cmdk-item-sub">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>
                  <div className="grafton-cmdk-item-right">
                    <span
                      className="grafton-cmdk-item-badge"
                      style={{ color: item.accentColor }}
                    >
                      {item.badge}
                    </span>
                    <ArrowRight size={13} className="grafton-cmdk-item-arrow" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div className="grafton-cmdk-footer">
          <span>↑↓ NAVEGAR · ↵ EJECUTAR / ABRIR</span>
          <span className="grafton-cmdk-footer-shortcut">⌘K / CTRL+K PALETA GRAFTON</span>
        </div>
      </div>
    </div>,
    document.body
  );
};
