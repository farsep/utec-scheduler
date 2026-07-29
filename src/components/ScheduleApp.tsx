import React, { useState, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { Navbar } from './Navbar';
import { StudentBanner } from './StudentBanner';
import { CourseSidebar } from './CourseSidebar';
import { TimetableGrid } from './TimetableGrid';
import { ConflictBanner } from './ConflictBanner';
import { MultiScheduleTabs } from './MultiScheduleTabs';
import { FileUploadModal } from './FileUploadModal';
import { ExportModal } from './ExportModal';
import type { Course, MetadataInfo, ScheduleOption } from '../types/schedule';
import { loadDefaultSampleData } from '../utils/sampleData';
import type { PDFParseResult } from '../utils/pdfParser';
import { detectConflicts, calculateTotalHours } from '../utils/scheduleUtils';
import { Download, RefreshCw, CheckCircle, Upload, Sparkles } from 'lucide-react';

export const ScheduleApp: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [metadata, setMetadata] = useState<MetadataInfo>({});
  const [hasPdfLoaded, setHasPdfLoaded] = useState<boolean>(false);
  const [hasExcelLoaded, setHasExcelLoaded] = useState<boolean>(false);

  // Active section drag / hover preview shadow state
  const [draggedSection, setDraggedSection] = useState<{ courseCode: string; sectionNumber: string } | null>(null);

  const [options, setOptions] = useState<ScheduleOption[]>([
    { id: 'opt_1', name: 'Opción A', selectedSections: {} },
    { id: 'opt_2', name: 'Opción B', selectedSections: {} }
  ]);
  const [activeOptionId, setActiveOptionId] = useState<string>('opt_1');

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Current active option
  const activeOption = options.find(o => o.id === activeOptionId) || options[0];
  const selectedSections = activeOption ? activeOption.selectedSections : {};

  // Memoized Conflict & Stats calculation for maximum UI performance
  const conflicts = useMemo(() => detectConflicts(courses, selectedSections), [courses, selectedSections]);
  const totalHours = useMemo(() => calculateTotalHours(courses, selectedSections), [courses, selectedSections]);
  const eligibleCount = useMemo(() => courses.filter(c => c.isEligible).length, [courses]);

  // Section selection logic
  const handleSelectSection = (courseCode: string, sectionNumber: string) => {
    setDraggedSection(null);
    setOptions(prevOptions =>
      prevOptions.map(opt => {
        if (opt.id === activeOptionId) {
          const nextSecs = { ...opt.selectedSections, [courseCode]: sectionNumber };
          const newConflicts = detectConflicts(courses, nextSecs);
          if (newConflicts.length === 0 && Object.keys(nextSecs).length >= 3) {
            confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
          }
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
      name: `Opción ${String.fromCharCode(64 + nextNum)}`,
      selectedSections: {}
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
    const { courses: pdfCourses, eligibleCourseCodes, eligibleCoursesMap, metadata: pdfMeta } = pdfResult;

    setMetadata(prev => ({ ...prev, ...pdfMeta }));

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
    }
  };

  const handleClearPDFData = () => {
    setHasPdfLoaded(false);
    if (!hasExcelLoaded) {
      setCourses([]);
      setMetadata({});
    } else {
      setCourses(prev => prev.map(c => ({ ...c, isEligible: undefined, courseType: undefined, plan: undefined })));
    }
  };

  const handleClearAllData = () => {
    setHasExcelLoaded(false);
    setHasPdfLoaded(false);
    setCourses([]);
    setMetadata({});
    setOptions([
      { id: 'opt_1', name: 'Opción A', selectedSections: {} },
      { id: 'opt_2', name: 'Opción B', selectedSections: {} }
    ]);
  };

  const handleLoadSampleData = async () => {
    const data = await loadDefaultSampleData();
    if (data.courses.length > 0) {
      setCourses(data.courses);
      setMetadata(data.metadata);
      setHasExcelLoaded(true);

      const initialSelections: Record<string, string> = {};
      const targetCodes = ['CS5352', 'CC1103', 'CS2023', 'HH5101'];
      targetCodes.forEach(code => {
        const course = data.courses.find(c => c.code === code);
        if (course && course.sections.length > 0) {
          initialSelections[code] = course.sections[0].sectionNumber;
        }
      });

      setOptions([
        { id: 'opt_1', name: 'Opción A (Mañana)', selectedSections: initialSelections },
        { id: 'opt_2', name: 'Opción B (Tarde)', selectedSections: {} }
      ]);
    }
  };

  return (
    <div className="app-container">
      <Navbar
        metadata={metadata}
        onOpenUpload={() => setIsUploadOpen(true)}
        onLoadSample={handleLoadSampleData}
        onClearAllData={handleClearAllData}
        coursesCount={courses.length}
        eligibleCount={eligibleCount}
      />

      <StudentBanner metadata={metadata} />

      {courses.length === 0 ? (
        /* Empty State Hero Banner when no file is loaded */
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
          <div className="glass-panel" style={{ maxWidth: '640px', width: '100%', padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 0 30px rgba(59, 130, 246, 0.4)' }}>
              <Upload size={32} />
            </div>

            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 800, marginBottom: '8px' }}>
                Arma tu Horario de Matrícula
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
                Sube <strong>un archivo PDF de Cursos Habilitados</strong>, <strong>un archivo Excel</strong>, o <strong>ambos</strong> para comenzar a armar tu horario con drag & drop.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => setIsUploadOpen(true)} style={{ padding: '12px 24px', fontSize: '0.95rem' }}>
                <Upload size={18} /> Subir PDF o Excel
              </button>

              <button className="btn btn-secondary" onClick={handleLoadSampleData} style={{ padding: '12px 20px', fontSize: '0.95rem' }}>
                <Sparkles size={18} color="var(--accent-amber)" /> Datos Muestra UTEC
              </button>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.03)', padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              Soporta: Solo PDF • Solo Excel • Ambos archivos combinados
            </div>
          </div>
        </div>
      ) : (
        /* Workspace split view when courses are loaded */
        <main className="workspace-layout">
          {/* Left Sidebar: Course Catalog */}
          <CourseSidebar
            courses={courses}
            selectedSections={selectedSections}
            onSelectSection={handleSelectSection}
            onRemoveSection={handleRemoveSection}
            onDragStartSection={info => setDraggedSection(info)}
            onDragEndSection={() => setDraggedSection(null)}
          />

          {/* Right Timetable Area */}
          <section className="timetable-panel">
            {/* Top Control Bar */}
            <div className="timetable-bar">
              <MultiScheduleTabs
                options={options}
                activeOptionId={activeOptionId}
                onSelectOption={setActiveOptionId}
                onAddOption={handleAddOption}
                onDuplicateOption={() => {}}
                onDeleteOption={handleDeleteOption}
              />

              <div className="timetable-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setOptions(options.map(o => o.id === activeOptionId ? { ...o, selectedSections: {} } : o));
                  }}
                  title="Limpiar selecciones en esta opción"
                >
                  <RefreshCw size={14} /> Limpiar
                </button>

                <button className="btn btn-primary" onClick={() => setIsExportOpen(true)}>
                  <Download size={16} /> Exportar Horario
                </button>
              </div>
            </div>

            {/* Conflict Banner if clashes exist */}
            <ConflictBanner conflicts={conflicts} />

            {/* Timetable Drag & Drop Canvas */}
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
                  <span style={{ color: 'var(--text-muted)' }}>Cursos Elegidos:</span>
                  <span className="stat-value">{Object.keys(selectedSections).length}</span>
                </div>
                <div className="stat-item">
                  <span style={{ color: 'var(--text-muted)' }}>Horas Semanales:</span>
                  <span className="stat-value" style={{ color: 'var(--accent-purple)' }}>{totalHours} hrs</span>
                </div>
              </div>

              {conflicts.length === 0 && Object.keys(selectedSections).length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-emerald)', fontWeight: 700, fontSize: '0.88rem' }}>
                  <CheckCircle size={18} />
                  <span>¡Horario Válido y Sin Cruces!</span>
                </div>
              )}
            </div>
          </section>
        </main>
      )}

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

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        courses={courses}
        selectedSections={selectedSections}
        optionName={activeOption ? activeOption.name : 'Horario'}
      />
    </div>
  );
};
