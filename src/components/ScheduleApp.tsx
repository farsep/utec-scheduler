import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Navbar } from './Navbar';
import { CourseSidebar } from './CourseSidebar';
import { TimetableGrid } from './TimetableGrid';
import { ConflictBanner } from './ConflictBanner';
import { MultiScheduleTabs } from './MultiScheduleTabs';
import { FileUploadModal } from './FileUploadModal';
import { ExportModal } from './ExportModal';
import type { Course, MetadataInfo, ScheduleOption, Conflict } from '../types/schedule';
import { loadDefaultSampleData } from '../utils/sampleData';
import { detectConflicts, calculateTotalCredits, calculateTotalHours } from '../utils/scheduleUtils';
import { Download, Sparkles, RefreshCw, CheckCircle } from 'lucide-react';

const STORAGE_KEY = 'utec_schedule_builder_state_v1';

export const ScheduleApp: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [metadata, setMetadata] = useState<MetadataInfo>({});
  const [isSampleLoaded, setIsSampleLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [options, setOptions] = useState<ScheduleOption[]>([
    { id: 'opt_1', name: 'Opción A', selectedSections: {} },
    { id: 'opt_2', name: 'Opción B', selectedSections: {} }
  ]);
  const [activeOptionId, setActiveOptionId] = useState<string>('opt_1');

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Load sample dataset on mount
  useEffect(() => {
    async function initData() {
      setIsLoading(true);
      const data = await loadDefaultSampleData();
      if (data.courses.length > 0) {
        setCourses(data.courses);
        setMetadata(data.metadata);
        setIsSampleLoaded(true);

        // Pre-select a clean initial demo schedule on Opción A
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
      setIsLoading(false);
    }
    initData();
  }, []);

  // Current active option
  const activeOption = options.find(o => o.id === activeOptionId) || options[0];
  const selectedSections = activeOption ? activeOption.selectedSections : {};

  // Conflict calculation
  const conflicts: Conflict[] = detectConflicts(courses, selectedSections);
  const totalCredits = calculateTotalCredits(courses, selectedSections);
  const totalHours = calculateTotalHours(courses, selectedSections);
  const eligibleCount = courses.filter(c => c.isEligible).length;

  // Handle Section Toggle
  const handleSelectSection = (courseCode: string, sectionNumber: string) => {
    setOptions(prevOptions =>
      prevOptions.map(opt => {
        if (opt.id === activeOptionId) {
          const nextSecs = { ...opt.selectedSections, [courseCode]: sectionNumber };
          // Check if zero conflicts and celebration threshold
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

  const handleExcelParsed = (newCourses: Course[], newMeta: MetadataInfo) => {
    setCourses(newCourses);
    setMetadata(newMeta);
    setIsSampleLoaded(false);
  };

  const handlePDFParsed = (eligibleCodes: Set<string>, map: Map<string, { type: string; plan?: string }>) => {
    setCourses(prev =>
      prev.map(c => {
        if (eligibleCodes.has(c.code)) {
          const extra = map.get(c.code);
          return { ...c, isEligible: true, courseType: extra?.type, plan: extra?.plan };
        }
        return { ...c, isEligible: false };
      })
    );
  };

  const handleReloadSample = async () => {
    setIsLoading(true);
    const data = await loadDefaultSampleData();
    setCourses(data.courses);
    setMetadata(data.metadata);
    setIsSampleLoaded(true);
    setIsLoading(false);
  };

  return (
    <div className="app-container">
      <Navbar
        metadata={metadata}
        onOpenUpload={() => setIsUploadOpen(true)}
        onLoadSample={handleReloadSample}
        isSampleLoaded={isSampleLoaded}
        coursesCount={courses.length}
        eligibleCount={eligibleCount}
      />

      <main className="workspace-layout">
        {/* Left Sidebar: Course Catalog */}
        <CourseSidebar
          courses={courses}
          selectedSections={selectedSections}
          onSelectSection={handleSelectSection}
          onRemoveSection={handleRemoveSection}
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
                title="Limpiar este horario"
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
          <TimetableGrid
            courses={courses}
            selectedSections={selectedSections}
            conflicts={conflicts}
            onSelectSection={handleSelectSection}
            onRemoveSection={handleRemoveSection}
          />

          {/* Footer Stats Bar */}
          <div className="stats-footer">
            <div className="stats-group">
              <div className="stat-item">
                <span style={{ color: 'var(--text-muted)' }}>Cursos Elegidos:</span>
                <span className="stat-value">{Object.keys(selectedSections).length}</span>
              </div>
              <div className="stat-item">
                <span style={{ color: 'var(--text-muted)' }}>Total Créditos:</span>
                <span className="stat-value" style={{ color: 'var(--accent-emerald)' }}>{totalCredits}</span>
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

      {/* Upload Modal */}
      <FileUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onDataParsed={handleExcelParsed}
        onPDFParsed={handlePDFParsed}
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
