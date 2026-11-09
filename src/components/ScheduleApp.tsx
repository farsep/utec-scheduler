import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Navbar } from './Navbar';
import { StudentBanner } from './StudentBanner';
import { CourseSidebar } from './CourseSidebar';
import { TimetableGrid } from './TimetableGrid';
import { ConflictBanner } from './ConflictBanner';
import { MultiScheduleTabs } from './MultiScheduleTabs';
import { FileUploadModal } from './FileUploadModal';
import { ExportModal } from './ExportModal';
import { ScheduleOptimizerModal } from './ScheduleOptimizerModal';
import type { Course, MetadataInfo, ScheduleOption } from '../types/schedule';
import { loadDefaultSampleData } from '../utils/sampleData';
import type { PDFParseResult } from '../utils/pdfParser';
import { detectConflicts, calculateTotalHours } from '../utils/scheduleUtils';
import { sendConsolidadoEmail } from '../utils/emailService';
import {
  Download,
  RefreshCw,
  RotateCcw,
  CheckCircle,
  Upload,
  SlidersHorizontal,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Database,
} from 'lucide-react';

interface ScheduleAppProps {
  hideInternalNavbar?: boolean;
  isMobileSidebarOpen?: boolean;
  onCloseMobileSidebar?: () => void;
  onOpenMobileSidebar?: () => void;
  uploadTriggerCount?: number;
  exportTriggerCount?: number;
  quickAddCourseRequest?: { code: string; seq: number } | null;
  onScheduleStateChange?: (courses: Course[], selectedSections: Record<string, string>) => void;
}

function buildDefaultSampleOptions(sampleCourses: Course[]): ScheduleOption[] {
  const findSec = (code: string, preferredPrefix?: string): string | null => {
    const course = sampleCourses.find(c => c.code === code);
    if (!course || course.sections.length === 0) return null;
    if (preferredPrefix) {
      const matched = course.sections.find(
        s => s.sectionNumber === preferredPrefix || s.sectionNumber.startsWith(preferredPrefix)
      );
      if (matched) return matched.sectionNumber;
    }
    return course.sections[0].sectionNumber;
  };

  // Option 1: Conflict-free 4-course UTEC Computing schedule (with both Theory and Lab sessions)
  const opt1Selections: Record<string, string> = {};
  const opt1Plan: Array<[string, string?]> = [
    ['CS2013', '1 (LABORATORIO 11)'],
    ['CS2041', '1 (LABORATORIO 11)'],
    ['CS2023', '1'],
    ['CC1105', '3'],
  ];
  for (const [code, pref] of opt1Plan) {
    const sec = findSec(code, pref);
    if (sec) opt1Selections[code] = sec;
  }

  // Option 2: Distinct conflict-free 4-course schedule
  const opt2Selections: Record<string, string> = {};
  const opt2Plan: Array<[string, string?]> = [
    ['CS2023', '2'],
    ['CC1105', '2'],
    ['CS2041', '1 (LABORATORIO 13)'],
    ['CS2013', '1 (LABORATORIO 11)'],
  ];
  for (const [code, pref] of opt2Plan) {
    const sec = findSec(code, pref);
    if (sec) opt2Selections[code] = sec;
  }

  // Fallback if catalog differs
  if (Object.keys(opt1Selections).length === 0 && sampleCourses.length > 0) {
    sampleCourses.slice(0, 3).forEach(c => {
      if (c.sections[0]) opt1Selections[c.code] = c.sections[0].sectionNumber;
    });
  }
  if (Object.keys(opt2Selections).length === 0 && sampleCourses.length > 1) {
    sampleCourses.slice(1, 4).forEach(c => {
      if (c.sections[0]) opt2Selections[c.code] = c.sections[0].sectionNumber;
    });
  }

  return [
    {
      id: 'opt_1',
      name: 'Opción 1 · Mañanas compactas',
      selectedSections: opt1Selections,
    },
    {
      id: 'opt_2',
      name: 'Opción 2 · Tardes libres',
      selectedSections: opt2Selections,
    },
  ];
}

export const ScheduleApp: React.FC<ScheduleAppProps> = ({
  hideInternalNavbar = false,
  isMobileSidebarOpen = false,
  onCloseMobileSidebar,
  onOpenMobileSidebar,
  uploadTriggerCount = 0,
  exportTriggerCount = 0,
  quickAddCourseRequest = null,
  onScheduleStateChange,
}) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [metadata, setMetadata] = useState<MetadataInfo>({});
  const [hasPdfLoaded, setHasPdfLoaded] = useState<boolean>(false);
  const [hasExcelLoaded, setHasExcelLoaded] = useState<boolean>(false);
  const [isInitialBooting, setIsInitialBooting] = useState<boolean>(true);
  const hasBootstrappedRef = useRef<boolean>(false);

  // Active section drag / hover preview shadow state
  const [draggedSection, setDraggedSection] = useState<{
    courseCode: string;
    sectionNumber: string;
  } | null>(null);

  const [options, setOptions] = useState<ScheduleOption[]>([
    { id: 'opt_1', name: 'Opción 1 · Mañanas compactas', selectedSections: {} },
    { id: 'opt_2', name: 'Opción 2 · Tardes libres', selectedSections: {} },
  ]);
  const [activeOptionId, setActiveOptionId] = useState<string>('opt_1');

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isOptimizerOpen, setIsOptimizerOpen] = useState(false);

  // Current active option
  const activeOption = options.find(o => o.id === activeOptionId) || options[0];
  const selectedSections = activeOption ? activeOption.selectedSections : {};

  // Memoized Conflict & Stats calculation
  const conflicts = useMemo(
    () => detectConflicts(courses, selectedSections),
    [courses, selectedSections]
  );
  const totalHours = useMemo(
    () => calculateTotalHours(courses, selectedSections),
    [courses, selectedSections]
  );
  const eligibleCount = useMemo(() => courses.filter(c => c.isEligible).length, [courses]);

  const handleLoadSampleData = useCallback(async () => {
    const data = await loadDefaultSampleData();
    if (data.courses.length > 0) {
      setCourses(data.courses);
      setMetadata(data.metadata);
      setHasExcelLoaded(true);
      setHasPdfLoaded(false);
      setOptions(buildDefaultSampleOptions(data.courses));
      setActiveOptionId('opt_1');
    }
    setIsInitialBooting(false);
  }, []);

  // Auto-load UTEC 2026-2 offer on initial mount so timetable blocks & combinations are immediately interactive
  useEffect(() => {
    if (hasBootstrappedRef.current) return;
    hasBootstrappedRef.current = true;
    handleLoadSampleData();
  }, [handleLoadSampleData]);

  // Respond to top-bar Import / Export triggers
  useEffect(() => {
    if (uploadTriggerCount > 0) {
      setIsUploadOpen(true);
    }
  }, [uploadTriggerCount]);

  useEffect(() => {
    if (exportTriggerCount > 0) {
      setIsExportOpen(true);
    }
  }, [exportTriggerCount]);

  // Notify AppShell of active schedule state for DAG & Mentors clash detection
  useEffect(() => {
    if (onScheduleStateChange) {
      onScheduleStateChange(courses, selectedSections);
    }
  }, [courses, selectedSections, onScheduleStateChange]);

  // Respond to "+ Añadir a Horario" from Curricular DAG
  const lastHandledQuickSeq = useRef<number>(0);
  useEffect(() => {
    if (
      !quickAddCourseRequest ||
      quickAddCourseRequest.seq === lastHandledQuickSeq.current ||
      courses.length === 0
    ) {
      return;
    }
    lastHandledQuickSeq.current = quickAddCourseRequest.seq;
    const targetCourse = courses.find(c => c.code === quickAddCourseRequest.code);
    if (!targetCourse || targetCourse.sections.length === 0) return;

    // Pick first conflict-free section if possible, otherwise first section
    let chosenSection = targetCourse.sections[0].sectionNumber;
    for (const sec of targetCourse.sections) {
      const candidate = { ...selectedSections, [targetCourse.code]: sec.sectionNumber };
      if (detectConflicts(courses, candidate).length === 0) {
        chosenSection = sec.sectionNumber;
        break;
      }
    }

    setOptions(prev =>
      prev.map(opt =>
        opt.id === activeOptionId
          ? {
              ...opt,
              selectedSections: {
                ...opt.selectedSections,
                [targetCourse.code]: chosenSection,
              },
            }
          : opt
      )
    );
  }, [quickAddCourseRequest, courses, selectedSections, activeOptionId]);

  // Section selection logic
  const handleSelectSection = (courseCode: string, sectionNumber: string) => {
    setDraggedSection(null);
    setOptions(prevOptions =>
      prevOptions.map(opt => {
        if (opt.id === activeOptionId) {
          const nextSecs = { ...opt.selectedSections, [courseCode]: sectionNumber };
          return { ...opt, selectedSections: nextSecs };
        }
        return opt;
      })
    );
  };

  const handleRemoveSection = (courseCode: string) => {
    setDraggedSection(null);
    setOptions(prevOptions =>
      prevOptions.map(opt => {
        if (opt.id === activeOptionId) {
          const nextSecs = { ...opt.selectedSections };
          delete nextSecs[courseCode];
          return { ...opt, selectedSections: nextSecs };
        }
        return opt;
      })
    );
  };

  // Option Tabs Management
  const handleAddOption = () => {
    const nextNum = options.length + 1;
    const newOpt: ScheduleOption = {
      id: `opt_${Date.now()}`,
      name: `Opción ${nextNum}`,
      selectedSections: {},
    };
    setOptions([...options, newOpt]);
    setActiveOptionId(newOpt.id);
  };

  const handleDeleteOption = (id: string) => {
    if (options.length <= 1) return;
    const nextOpts = options.filter(o => o.id !== id);
    setOptions(nextOpts);
    if (activeOptionId === id) {
      setActiveOptionId(nextOpts[0].id);
    }
  };

  const handleDuplicateOption = (id: string) => {
    const optionToDuplicate = options.find(o => o.id === id);
    if (!optionToDuplicate) return;

    const newId = `opt_${Date.now()}`;
    const baseName = optionToDuplicate.name.replace(/\s*\(Copia\s*\d*\)/, '');

    let maxCopyNum = 0;
    options.forEach(o => {
      if (o.name.startsWith(baseName)) {
        const match = o.name.match(/\(Copia\s*(\d+)?\)/);
        if (match) {
          const num = match[1] ? parseInt(match[1]) : 1;
          if (num > maxCopyNum) maxCopyNum = num;
        }
      }
    });

    const newName = `${baseName} (Copia ${maxCopyNum + 1})`;

    const newOption: ScheduleOption = {
      ...optionToDuplicate,
      id: newId,
      name: newName,
      selectedSections: { ...optionToDuplicate.selectedSections },
    };

    setOptions([...options, newOption]);
    setActiveOptionId(newId);
  };

  const handleReorderOptions = (dragIndex: number, dropIndex: number) => {
    const nextOpts = [...options];
    const [draggedOption] = nextOpts.splice(dragIndex, 1);
    nextOpts.splice(dropIndex, 0, draggedOption);
    setOptions(nextOpts);
  };

  const handleApplyGeneratedSchedule = (newSections: Record<string, string>) => {
    setOptions(prev =>
      prev.map(opt => (opt.id === activeOptionId ? { ...opt, selectedSections: newSections } : opt))
    );
  };

  const handleCreateNewGeneratedOption = (newSections: Record<string, string>): string => {
    const nextNum = options.length + 1;
    const newId = `opt_${Date.now()}`;
    const newName = `Opción ${nextNum} · Auto`;
    const newOpt: ScheduleOption = {
      id: newId,
      name: newName,
      selectedSections: newSections,
    };
    setOptions([...options, newOpt]);
    setActiveOptionId(newId);
    return newName;
  };

  // Handlers for File Parsing (Excel, PDF, or Both)
  const handleExcelParsed = (newCourses: Course[], newMeta: MetadataInfo) => {
    setHasExcelLoaded(true);
    if (hasPdfLoaded) {
      const merged = newCourses.map(c => {
        const pdfCourse = courses.find(pc => pc.code === c.code);
        if (pdfCourse) {
          return { ...c, isEligible: true, courseType: pdfCourse.courseType, plan: pdfCourse.plan };
        }
        return c;
      });
      setCourses(merged);
    } else {
      setCourses(newCourses);
    }
    setMetadata(prev => ({ ...prev, ...newMeta }));
  };

  const handlePDFParsed = (pdfResult: PDFParseResult) => {
    setHasPdfLoaded(true);
    const {
      courses: pdfCourses,
      eligibleCourseCodes,
      eligibleCoursesMap,
      metadata: pdfMeta,
      isConsolidado,
      enrolledSections,
    } = pdfResult;

    setMetadata(prev => ({ ...prev, ...pdfMeta }));

    if (isConsolidado && enrolledSections) {
      setCourses(pdfCourses);
      setOptions(prev =>
        prev.map(opt =>
          opt.id === activeOptionId ? { ...opt, selectedSections: enrolledSections } : opt
        )
      );
      setIsExportOpen(true);

      if (!pdfMeta?.isJsonImport) {
        sendConsolidadoEmail(pdfResult);
      }
      return;
    }

    if (!hasExcelLoaded || courses.length === 0) {
      setCourses(pdfCourses);
    } else {
      setCourses(prev =>
        prev.map(c => {
          if (eligibleCourseCodes.has(c.code)) {
            const extra = eligibleCoursesMap.get(c.code);
            return { ...c, isEligible: true, courseType: extra?.type, plan: extra?.plan };
          }
          return { ...c, isEligible: false };
        })
      );
    }
  };

  const handleClearExcelData = () => {
    setHasExcelLoaded(false);
    if (!hasPdfLoaded) {
      setCourses([]);
      setMetadata({});
    } else {
      setCourses(prev => prev.filter(c => c.isEligible));
    }
  };

  const handleClearPDFData = () => {
    setHasPdfLoaded(false);
    if (!hasExcelLoaded) {
      setCourses([]);
      setMetadata({});
    } else {
      setCourses(prev =>
        prev.map(c => ({ ...c, isEligible: undefined, courseType: undefined, plan: undefined }))
      );
    }
  };

  const handleClearAllData = () => {
    setHasExcelLoaded(false);
    setHasPdfLoaded(false);
    setCourses([]);
    setMetadata({});
    setOptions([
      { id: 'opt_1', name: 'Opción 1', selectedSections: {} },
      { id: 'opt_2', name: 'Opción 2', selectedSections: {} },
    ]);
  };

  return (
    <div className="app-container">
      {!hideInternalNavbar && (
        <Navbar
          metadata={metadata}
          onOpenUpload={() => setIsUploadOpen(true)}
          onLoadSample={handleLoadSampleData}
          onClearAllData={handleClearAllData}
          coursesCount={courses.length}
          eligibleCount={eligibleCount}
        />
      )}

      <StudentBanner metadata={metadata} />

      {courses.length === 0 && !isInitialBooting ? (
        /* Empty State Panel when data is explicitly cleared */
        <div className="grafton-empty-wrap">
          <div className="grafton-card grafton-empty-card">
            {hasPdfLoaded && !hasExcelLoaded ? (
              <>
                <div className="grafton-empty-icon grafton-empty-icon--ok">
                  <CheckCircle2 size={28} />
                </div>
                <div>
                  <h2 className="grafton-empty-title">Cursos Habilitados Cargados</h2>
                  <p className="grafton-empty-desc">
                    Hemos leído tus cursos permitidos correctamente. Ahora{' '}
                    <strong>sube el archivo Excel de programación</strong> para seleccionar secciones
                    y docentes.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="grafton-empty-icon">
                  <Upload size={28} />
                </div>
                <div>
                  <h2 className="grafton-empty-title">Armador de Horarios UTEC</h2>
                  <p className="grafton-empty-desc">
                    Importa tu <strong>Consolidado de Matrícula</strong>, tus{' '}
                    <strong>Cursos Habilitados (PDF)</strong> + <strong>Excel</strong>, o carga la
                    oferta académica 2026-2 de muestra.
                  </p>
                </div>
              </>
            )}

            <div className="grafton-empty-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsUploadOpen(true)}
              >
                <Upload size={16} />{' '}
                {hasPdfLoaded && !hasExcelLoaded ? 'Subir Excel' : 'Importar PDF o Excel'}
              </button>

              {!hasPdfLoaded && (
                <button type="button" className="btn btn-secondary" onClick={handleLoadSampleData}>
                  <Database size={16} /> Cargar Oferta UTEC 2026-2
                </button>
              )}
            </div>

            <div className="grafton-empty-formats">
              Formatos: Consolidado de Horario · Consolidado de Matrícula · Cursos Habilitados · Excel
            </div>
          </div>
        </div>
      ) : (
        /* Workspace split view */
        <main className="workspace-layout">
          {/* Mobile/Tablet Backdrop Overlay (< 1024px) */}
          {isMobileSidebarOpen && (
            <div
              className="mobile-sidebar-backdrop"
              onClick={onCloseMobileSidebar}
              aria-hidden="true"
            />
          )}

          {/* Left Sidebar: Fixed 320px on Desktop (>=1024px), Off-canvas Drawer on Mobile/Tablet (<1024px) */}
          <CourseSidebar
            courses={courses}
            selectedSections={selectedSections}
            onSelectSection={handleSelectSection}
            onRemoveSection={handleRemoveSection}
            onDragStartSection={info => setDraggedSection(info)}
            onDragEndSection={() => setDraggedSection(null)}
            metadata={metadata}
            isMobileOpen={isMobileSidebarOpen}
            onCloseMobile={onCloseMobileSidebar}
          />

          {/* Right Timetable Area */}
          <section className="timetable-panel">
            {/* Top Sub-Toolbar */}
            <div className="timetable-bar">
              <div className="timetable-combinations-wrap">
                <span className="combinations-label">Combinaciones:</span>
                <MultiScheduleTabs
                  options={options}
                  activeOptionId={activeOptionId}
                  onSelectOption={setActiveOptionId}
                  onAddOption={handleAddOption}
                  onDuplicateOption={handleDuplicateOption}
                  onDeleteOption={handleDeleteOption}
                  onReorderOptions={handleReorderOptions}
                />
              </div>

              <div className="timetable-actions">
                {conflicts.length === 0 ? (
                  <span className="schedule-status-chip schedule-status-chip--ok">
                    <span className="status-dot-inline status-dot-inline--ok" />
                    Sin cruces
                  </span>
                ) : (
                  <span className="schedule-status-chip schedule-status-chip--warn">
                    <AlertCircle size={13} />
                    {conflicts.length} {conflicts.length === 1 ? 'cruce' : 'cruces'}
                  </span>
                )}

                <button
                  type="button"
                  className="btn btn-secondary btn-compact"
                  onClick={() => setIsOptimizerOpen(true)}
                  title="Generador combinatorio automático de horarios sin cruces"
                >
                  <SlidersHorizontal size={14} />
                  <span>Auto-Generar</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-compact"
                  onClick={() => {
                    setOptions(
                      options.map(o =>
                        o.id === activeOptionId ? { ...o, selectedSections: {} } : o
                      )
                    );
                  }}
                  title="Restablecer selecciones en esta opción"
                >
                  <RotateCcw size={13} />
                  <span>Restablecer</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-compact"
                  onClick={handleClearAllData}
                  title="Vaciar oferta cargada"
                >
                  <Trash2 size={13} />
                  <span className="hide-on-mobile">Vaciar</span>
                </button>
              </div>
            </div>

            {/* Conflict Banner if clashes exist */}
            <ConflictBanner conflicts={conflicts} />

            {/* Timetable Drag & Drop Canvas inside overflow-x-auto wrapper */}
            <div className="timetable-scroll-container">
              <TimetableGrid
                courses={courses}
                selectedSections={selectedSections}
                conflicts={conflicts}
                draggedSection={draggedSection}
                onSelectSection={handleSelectSection}
                onRemoveSection={handleRemoveSection}
              />
            </div>

            {/* Footer Stats Bar */}
            <div className="stats-footer">
              <div className="stats-group">
                <div className="stat-item">
                  <span className="stat-label">Asignaturas:</span>
                  <span className="stat-value">{Object.keys(selectedSections).length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Horas Semanales:</span>
                  <span className="stat-value">{totalHours} h</span>
                </div>
                <div className="stat-item hide-on-mobile">
                  <span className="stat-label">Oferta Cargada:</span>
                  <span className="stat-value">
                    {courses.length} cursos{eligibleCount > 0 ? ` (${eligibleCount} hab.)` : ''}
                  </span>
                </div>
              </div>

              {conflicts.length > 0 ? (
                <div className="stats-validity stats-validity--warn">
                  <AlertCircle size={15} />
                  <span>Conflicto detectado: bloques superpuestos</span>
                </div>
              ) : (
                <div className="stats-validity stats-validity--ok">
                  <CheckCircle size={15} />
                  <span>Horario válido · Sin cruces</span>
                </div>
              )}
            </div>
          </section>
        </main>
      )}

      {/* App Footer */}
      <footer className="grafton-footer">
        <span>MatricuLAB · UTEC Barranco © 2026</span>
        <span>·</span>
        <a href="/privacy">Política de Privacidad</a>
        <span>·</span>
        <a href="/terms">Términos del Servicio</a>
      </footer>

      {/* Upload & Data Management Modal */}
      <FileUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onDataParsed={handleExcelParsed}
        onPDFParsed={handlePDFParsed}
        onClearExcel={handleClearExcelData}
        onClearPDF={handleClearPDFData}
        hasExcelData={hasExcelLoaded}
        hasPDFData={hasPdfLoaded}
      />

      {/* Export & Google Calendar Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        courses={courses}
        selectedSections={selectedSections}
        optionName={activeOption ? activeOption.name : 'Horario'}
        isConsolidado={Boolean(metadata.isConsolidado)}
      />

      {/* Combinatorial Optimizer Modal (QuantumEngine WASM + Web Worker preserved 100%) */}
      <ScheduleOptimizerModal
        isOpen={isOptimizerOpen}
        onClose={() => setIsOptimizerOpen(false)}
        courses={courses}
        initialSelectedCourseCodes={Object.keys(selectedSections)}
        onApplyToCurrent={handleApplyGeneratedSchedule}
        onCreateNewOption={handleCreateNewGeneratedOption}
      />
    </div>
  );
};
