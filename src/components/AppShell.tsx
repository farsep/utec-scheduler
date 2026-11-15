import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ScheduleApp } from './ScheduleApp';
import { CurricularDAGView } from './CurricularGraph/CurricularDAGView';
import { CourseApp } from './CourseDirectory/CourseApp';
import { ProfessorApp } from './ProfessorDirectory/ProfessorApp';
import { ClassroomApp } from './ClassroomFinder/ClassroomApp';
import { MentorApp } from './MentorDirectory/MentorApp';
import { MobileBottomNav } from './MobileBottomNav';
import { GraftonTopBar } from './GraftonTopBar';
import { CommandPalette } from './CommandPalette';
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

  const suppressPopStateModalCloseRef = useRef(false);

  const switchTab = useCallback(
    (targetTab: TabKey, targetUrl?: string) => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('matriculab:close-modals'));
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
          suppressPopStateModalCloseRef.current = true;
          try {
            window.dispatchEvent(new PopStateEvent('popstate'));
          } finally {
            suppressPopStateModalCloseRef.current = false;
          }
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
      if (!suppressPopStateModalCloseRef.current) {
        window.dispatchEvent(new CustomEvent('matriculab:close-modals'));
      }
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

  // Universal < 768px Mobile Bottom-Sheet Drag-to-Dismiss for .modal-card & .visitor-modal-dialog
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let activeSheet: HTMLElement | null = null;
    let activeBackdrop: HTMLElement | null = null;
    let scrollEl: HTMLElement | null = null;
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let startedOnHeader = false;
    let isDragging = false;
    let lockedOut = false;

    const findScrollableParent = (node: HTMLElement, boundary: HTMLElement): HTMLElement | null => {
      let cur: HTMLElement | null = node;
      while (cur && cur !== boundary) {
        if (cur.scrollHeight > cur.clientHeight + 4) {
          const ov = window.getComputedStyle(cur).overflowY;
          if (ov === 'auto' || ov === 'scroll') return cur;
        }
        cur = cur.parentElement;
      }
      return boundary;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (window.innerWidth >= 768 || e.touches.length !== 1) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const sheet = target.closest('.modal-card, .visitor-modal-dialog') as HTMLElement | null;
      if (!sheet) return;

      if (target.closest('button, a, input, select, textarea, .tbg-interactive-grid, .overflow-x-auto')) {
        return;
      }

      scrollEl = findScrollableParent(target, sheet);
      startedOnHeader = Boolean(target.closest('.modal-header, .visitor-modal-header, .grafton-modal-drag-handle'));
      if (!startedOnHeader && scrollEl && scrollEl.scrollTop > 2) return;

      activeSheet = sheet;
      activeBackdrop = sheet.closest('.modal-overlay, .visitor-modal-backdrop') as HTMLElement | null;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = performance.now();
      isDragging = false;
      lockedOut = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!activeSheet || lockedOut || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - startX;
      const deltaY = e.touches[0].clientY - startY;

      if (!isDragging) {
        if (!startedOnHeader && scrollEl && scrollEl.scrollTop > 2) {
          lockedOut = true;
          activeSheet = null;
          return;
        }
        if (deltaY < -6 || Math.abs(deltaX) > Math.abs(deltaY) * 1.15) {
          lockedOut = true;
          activeSheet = null;
          return;
        }
        if (deltaY > 8 && deltaY > Math.abs(deltaX) * 1.25) {
          isDragging = true;
          activeSheet.style.transition = 'none';
          if (activeBackdrop) activeBackdrop.style.transition = 'none';
        }
      }

      if (isDragging) {
        if (e.cancelable) e.preventDefault();
        const clampedY = Math.max(0, deltaY);
        activeSheet.style.transform = `translate3d(0, ${clampedY}px, 0)`;
        if (activeBackdrop) {
          const dim = Math.max(0.2, 1 - Math.min(1, clampedY / 320) * 0.72);
          activeBackdrop.style.opacity = String(dim);
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!activeSheet) return;
      const sheet = activeSheet;
      const backdrop = activeBackdrop;
      const wasDragging = isDragging;
      activeSheet = null;
      activeBackdrop = null;
      isDragging = false;
      lockedOut = false;

      if (!wasDragging) return;

      const deltaY = (e.changedTouches[0]?.clientY ?? startY) - startY;
      const elapsed = Math.max(1, performance.now() - startTime);
      const velocity = deltaY / elapsed;

      if (deltaY > 105 || (velocity > 0.45 && deltaY > 24)) {
        sheet.style.transition = 'transform 180ms cubic-bezier(0.32, 1, 0.23, 1)';
        sheet.style.transform = 'translate3d(0, 100%, 0)';
        if (backdrop) {
          backdrop.style.transition = 'opacity 180ms ease-out';
          backdrop.style.opacity = '0';
        }
        window.setTimeout(() => {
          const closeBtn = sheet.querySelector(
            '.close-btn, .visitor-close-btn, button[aria-label*="Cerrar"]'
          ) as HTMLButtonElement | null;
          if (closeBtn) {
            closeBtn.click();
          } else if (backdrop) {
            backdrop.click();
          }
          // Reset transforms in case element persists
          sheet.style.removeProperty('transform');
          sheet.style.removeProperty('transition');
          if (backdrop) {
            backdrop.style.removeProperty('opacity');
            backdrop.style.removeProperty('transition');
          }
        }, 175);
      } else {
        sheet.style.transition = 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)';
        sheet.style.transform = 'translate3d(0, 0, 0)';
        if (backdrop) {
          backdrop.style.transition = 'opacity 200ms ease-out';
          backdrop.style.opacity = '1';
        }
        window.setTimeout(() => {
          sheet.style.removeProperty('transform');
          sheet.style.removeProperty('transition');
          if (backdrop) {
            backdrop.style.removeProperty('opacity');
            backdrop.style.removeProperty('transition');
          }
        }, 210);
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
    };
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

        window.dispatchEvent(new CustomEvent('matriculab:close-modals'));

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

      <MobileBottomNav
        activeTab={activeTab}
        onSwitchTab={(tab, url) => switchTab(tab as TabKey, url)}
      />

      <CommandPalette
        onSwitchTab={(tab, url) => switchTab(tab, url)}
        onOpenUploadModal={handleOpenUploadFromTopBar}
        onOpenExportModal={handleOpenExportFromTopBar}
      />
    </div>
  );
};
