import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ScheduleApp } from './ScheduleApp';
import { CurricularDAGView } from './CurricularGraph/CurricularDAGView';
import { CourseApp } from './CourseDirectory/CourseApp';
import { ProfessorApp } from './ProfessorDirectory/ProfessorApp';
import { ClassroomApp } from './ClassroomFinder/ClassroomApp';
import { MentorApp } from './MentorDirectory/MentorApp';
import { GraftonTopBar } from './GraftonTopBar';
import { prewarmAllCatalogs } from '../utils/masterDataLoader';
import type { Course } from '../types/schedule';

export type TabKey = 'schedule' | 'malla' | 'courses' | 'professors' | 'classrooms' | 'mentors';

interface AppShellProps {
  initialTab: TabKey;
}

const PATH_TO_TAB: Record<string, TabKey> = {
  '/': 'schedule',
  '/malla': 'malla',
  '/mallas': 'malla',
  '/cursos': 'courses',
  '/profesores': 'professors',
  '/docentes': 'professors',
  '/aulas': 'classrooms',
  '/mentores': 'mentors',
};

const TAB_TITLES: Record<TabKey, string> = {
  schedule: 'MatricuLAB · Armador de Horarios UTEC',
  malla: 'Malla Curricular & 16 Carreras UTEC · MatricuLAB',
  courses: 'Catálogo de Cursos Ofertados 2026-2 · MatricuLAB',
  professors: 'Directorio de Docentes UTEC · MatricuLAB',
  classrooms: 'Aulas y Laboratorios Libres UTEC · MatricuLAB',
  mentors: 'Mentores Académicos UTEC 2026-2 · MatricuLAB',
};

const TAB_PATHS: Record<TabKey, string> = {
  schedule: '/',
  malla: '/malla',
  courses: '/cursos',
  professors: '/profesores',
  classrooms: '/aulas',
  mentors: '/mentores',
};

export const AppShell: React.FC<AppShellProps> = ({ initialTab }) => {
  const getTabFromLocation = (): TabKey => {
    if (typeof window !== 'undefined') {
      let p = window.location.pathname.split('?')[0].split('#')[0];
      if (p.length > 1 && p.endsWith('/')) {
        p = p.slice(0, -1);
      }
      if (PATH_TO_TAB[p]) return PATH_TO_TAB[p];
    }
    return initialTab;
  };

  const [activeTab, setActiveTab] = useState<TabKey>(getTabFromLocation);
  // Keep schedule mounted so Export/Import & live clash detection across Malla and Mentors work immediately
  const [visitedTabs, setVisitedTabs] = useState<Set<TabKey>>(
    () => new Set<TabKey>(['schedule', activeTab])
  );
  const scrollPositions = useRef<Partial<Record<TabKey, number>>>({});

  // Mobile sidebar drawer state + external modal triggers for ScheduleApp
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [uploadTriggerCount, setUploadTriggerCount] = useState<number>(0);
  const [exportTriggerCount, setExportTriggerCount] = useState<number>(0);
  const [quickAddCourseCode, setQuickAddCourseCode] = useState<{ code: string; seq: number } | null>(null);

  // Live synced schedule state for DAG & Mentors clash detection
  const [scheduleCourses, setScheduleCourses] = useState<Course[]>([]);
  const [selectedSections, setSelectedSections] = useState<Record<string, string>>({});

  useEffect(() => {
    prewarmAllCatalogs();
    if (typeof window !== 'undefined' && !navigator.webdriver) {
      const fontId = 'grafton-google-fonts';
      if (!document.getElementById(fontId)) {
        const link = document.createElement('link');
        link.id = fontId;
        link.rel = 'stylesheet';
        link.href =
          'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@600;700&display=swap';
        document.head.appendChild(link);
      }
    }
  }, []);

  const switchTab = useCallback(
    (targetTab: TabKey, targetUrl?: string) => {
      if (typeof window !== 'undefined') {
        scrollPositions.current[activeTab] = window.scrollY;
      }

      setIsMobileSidebarOpen(false);

      setVisitedTabs(prev => {
        if (prev.has(targetTab)) return prev;
        const next = new Set(prev);
        next.add(targetTab);
        return next;
      });

      setActiveTab(targetTab);

      const nextPath = targetUrl || TAB_PATHS[targetTab] || '/';
      if (typeof window !== 'undefined') {
        const curPathAndSearch = window.location.pathname + window.location.search;
        if (curPathAndSearch !== nextPath) {
          window.history.pushState({ tab: targetTab }, '', nextPath);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      }
      if (TAB_TITLES[targetTab]) {
        document.title = TAB_TITLES[targetTab];
      }

      requestAnimationFrame(() => {
        const savedScroll = scrollPositions.current[targetTab] || 0;
        window.scrollTo({ top: savedScroll, behavior: 'instant' as ScrollBehavior });
      });
    },
    [activeTab]
  );

  useEffect(() => {
    const handlePopState = () => {
      let p = window.location.pathname.split('?')[0].split('#')[0];
      if (p.length > 1 && p.endsWith('/')) {
        p = p.slice(0, -1);
      }
      const targetTab = PATH_TO_TAB[p] || 'schedule';
      setActiveTab(targetTab);
      setVisitedTabs(prev => new Set(prev).add(targetTab));
      document.title = TAB_TITLES[targetTab] || document.title;

      requestAnimationFrame(() => {
        const savedScroll = scrollPositions.current[targetTab] || 0;
        window.scrollTo({ top: savedScroll, behavior: 'instant' as ScrollBehavior });
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Intercept internal route links for instant SPA tab switching
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;

      const rawHref = anchor.getAttribute('href');
      if (
        !rawHref ||
        rawHref.startsWith('#') ||
        rawHref.startsWith('blob:') ||
        rawHref.startsWith('data:') ||
        rawHref.startsWith('mailto:') ||
        anchor.target === '_blank'
      ) {
        return;
      }

      let cleanPath = rawHref.split('?')[0].split('#')[0];
      if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
        cleanPath = cleanPath.slice(0, -1);
      }

      const targetTab = PATH_TO_TAB[cleanPath];
      if (targetTab) {
        e.preventDefault();
        e.stopPropagation();

        if (targetTab !== activeTab) {
          switchTab(targetTab, rawHref);
        } else {
          if (rawHref && (window.location.pathname + window.location.search) !== rawHref) {
            window.history.pushState({ tab: targetTab }, '', rawHref);
            window.dispatchEvent(new PopStateEvent('popstate'));
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    };

    document.addEventListener('click', handleDocumentClick, { capture: true });
    return () => document.removeEventListener('click', handleDocumentClick, { capture: true });
  }, [activeTab, switchTab]);

  const handleOpenUploadFromTopBar = useCallback(() => {
    if (activeTab !== 'schedule') {
      switchTab('schedule');
    }
    setUploadTriggerCount(c => c + 1);
  }, [activeTab, switchTab]);

  const handleOpenExportFromTopBar = useCallback(() => {
    if (activeTab !== 'schedule') {
      switchTab('schedule');
    }
    setExportTriggerCount(c => c + 1);
  }, [activeTab, switchTab]);

  const handleScheduleStateChange = useCallback(
    (courses: Course[], sections: Record<string, string>) => {
      setScheduleCourses(courses);
      setSelectedSections(sections);
    },
    []
  );

  const handleSelectCourseFromDAG = useCallback(
    (courseCode: string) => {
      setQuickAddCourseCode(prev => ({ code: courseCode, seq: (prev?.seq || 0) + 1 }));
      switchTab('schedule');
    },
    [switchTab]
  );

  const scheduledCourseCodes = useMemo(
    () => new Set(Object.keys(selectedSections)),
    [selectedSections]
  );

  const offeredCourseCodes = useMemo(
    () => new Set(scheduleCourses.map(c => c.code)),
    [scheduleCourses]
  );

  return (
    <div className="app-shell-root">
      <GraftonTopBar
        activeTab={activeTab}
        onSwitchTab={tab => switchTab(tab)}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
        onOpenUploadModal={handleOpenUploadFromTopBar}
        onOpenExportModal={handleOpenExportFromTopBar}
      />

      {visitedTabs.has('schedule') && (
        <div
          id="matriculab-view-schedule"
          className="app-shell-tab-pane"
          style={{ display: activeTab === 'schedule' ? 'block' : 'none' }}
        >
          <ScheduleApp
            hideInternalNavbar
            isMobileSidebarOpen={isMobileSidebarOpen}
            onCloseMobileSidebar={() => setIsMobileSidebarOpen(false)}
            onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
            uploadTriggerCount={uploadTriggerCount}
            exportTriggerCount={exportTriggerCount}
            quickAddCourseRequest={quickAddCourseCode}
            onScheduleStateChange={handleScheduleStateChange}
          />
        </div>
      )}

      {visitedTabs.has('malla') && (
        <div
          id="matriculab-view-malla"
          className="app-shell-tab-pane"
          style={{ display: activeTab === 'malla' ? 'block' : 'none' }}
        >
          <CurricularDAGView
            scheduledCourseCodes={scheduledCourseCodes}
            offeredCourseCodes={offeredCourseCodes}
            onSelectCourseForSchedule={handleSelectCourseFromDAG}
          />
        </div>
      )}

      {visitedTabs.has('courses') && (
        <div
          id="matriculab-view-courses"
          className="app-shell-tab-pane"
          style={{ display: activeTab === 'courses' ? 'block' : 'none' }}
        >
          <CourseApp hideTopNavbar />
        </div>
      )}

      {visitedTabs.has('professors') && (
        <div
          id="matriculab-view-professors"
          className="app-shell-tab-pane"
          style={{ display: activeTab === 'professors' ? 'block' : 'none' }}
        >
          <ProfessorApp hideTopNavbar />
        </div>
      )}

      {visitedTabs.has('classrooms') && (
        <div
          id="matriculab-view-classrooms"
          className="app-shell-tab-pane"
          style={{ display: activeTab === 'classrooms' ? 'block' : 'none' }}
        >
          <ClassroomApp hideTopNavbar />
        </div>
      )}

      {visitedTabs.has('mentors') && (
        <div
          id="matriculab-view-mentors"
          className="app-shell-tab-pane"
          style={{ display: activeTab === 'mentors' ? 'block' : 'none' }}
        >
          <MentorApp
            hideTopNavbar
            scheduleCourses={scheduleCourses}
            selectedSections={selectedSections}
          />
        </div>
      )}
    </div>
  );
};
