import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ScheduleApp } from './ScheduleApp';
import { CourseApp } from './CourseDirectory/CourseApp';
import { ProfessorApp } from './ProfessorDirectory/ProfessorApp';
import { ClassroomApp } from './ClassroomFinder/ClassroomApp';
import { MentorApp } from './MentorDirectory/MentorApp';
import { prewarmAllCatalogs } from '../utils/masterDataLoader';

export type TabKey = 'schedule' | 'courses' | 'professors' | 'classrooms' | 'mentors';

interface AppShellProps {
  initialTab: TabKey;
}

const PATH_TO_TAB: Record<string, TabKey> = {
  '/': 'schedule',
  '/cursos': 'courses',
  '/profesores': 'professors',
  '/docentes': 'professors',
  '/aulas': 'classrooms',
  '/mentores': 'mentors'
};

const TAB_TITLES: Record<TabKey, string> = {
  schedule: 'MatrícuLAB - Armador de Horarios UTEC',
  courses: 'Catálogo de Cursos UTEC - MatrícuLAB',
  professors: 'Directorio de Docentes UTEC - MatrícuLAB',
  classrooms: 'Buscador de Aulas Libres UTEC - MatrícuLAB',
  mentors: 'Mentores Académicos UTEC 2026-2 - MatrícuLAB'
};

const TAB_PATHS: Record<TabKey, string> = {
  schedule: '/',
  courses: '/cursos',
  professors: '/profesores',
  classrooms: '/aulas',
  mentors: '/mentores'
};

export const AppShell: React.FC<AppShellProps> = ({ initialTab }) => {
  // Determine active tab from URL or fallback to initialTab
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
  const [visitedTabs, setVisitedTabs] = useState<Set<TabKey>>(() => new Set([activeTab]));
  const scrollPositions = useRef<Partial<Record<TabKey, number>>>({});

  // Kick off background prewarm for all data sets during idle time
  useEffect(() => {
    prewarmAllCatalogs();
  }, []);

  const switchTab = useCallback((targetTab: TabKey, targetUrl?: string) => {
    // 1. Save scroll position of current tab
    if (typeof window !== 'undefined') {
      scrollPositions.current[activeTab] = window.scrollY;
    }

    // 2. Mark target tab as visited so it mounts if not yet loaded
    setVisitedTabs(prev => {
      if (prev.has(targetTab)) return prev;
      const next = new Set(prev);
      next.add(targetTab);
      return next;
    });

    // 3. Switch active tab in React state (0ms instant transition)
    setActiveTab(targetTab);

    // 4. Update browser history and page title
    const nextPath = targetUrl || TAB_PATHS[targetTab] || '/';
    if (typeof window !== 'undefined' && window.location.pathname !== nextPath) {
      window.history.pushState({ tab: targetTab }, '', nextPath);
    }
    if (TAB_TITLES[targetTab]) {
      document.title = TAB_TITLES[targetTab];
    }

    // 5. Restore saved scroll position for target tab or scroll to top
    requestAnimationFrame(() => {
      const savedScroll = scrollPositions.current[targetTab] || 0;
      window.scrollTo({ top: savedScroll, behavior: 'instant' });
    });
  }, [activeTab]);

  // Handle browser Back / Forward buttons (popstate)
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
        window.scrollTo({ top: savedScroll, behavior: 'instant' });
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Universal click interceptor: capture clicks on internal tab links for instant 0ms tab transitions
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      // Don't intercept middle clicks, ctrl+clicks, cmd+clicks, etc.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;

      const rawHref = anchor.getAttribute('href');
      if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('blob:') || rawHref.startsWith('data:') || anchor.target === '_blank') {
        return;
      }

      // Check if internal route
      let cleanPath = rawHref.split('?')[0].split('#')[0];
      if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
        cleanPath = cleanPath.slice(0, -1);
      }

      const targetTab = PATH_TO_TAB[cleanPath];
      if (targetTab) {
        // Prevent default browser / Astro navigation
        e.preventDefault();
        e.stopPropagation();

        if (targetTab !== activeTab) {
          switchTab(targetTab, rawHref);
        } else {
          // If already on active tab, scroll smoothly to top
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    };

    document.addEventListener('click', handleDocumentClick, { capture: true });
    return () => document.removeEventListener('click', handleDocumentClick, { capture: true });
  }, [activeTab, switchTab]);

  // Pre-mount tabs on hover/touchstart so they are already in DOM before the click finishes
  useEffect(() => {
    const handlePointerPreMount = (e: Event) => {
      const anchor = (e.target as HTMLElement)?.closest?.('a');
      if (!anchor) return;

      const rawHref = anchor.getAttribute('href');
      if (!rawHref) return;

      let cleanPath = rawHref.split('?')[0].split('#')[0];
      if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
        cleanPath = cleanPath.slice(0, -1);
      }

      const targetTab = PATH_TO_TAB[cleanPath];
      if (targetTab) {
        setVisitedTabs(prev => {
          if (prev.has(targetTab)) return prev;
          const next = new Set(prev);
          next.add(targetTab);
          return next;
        });
      }
    };

    document.addEventListener('pointerover', handlePointerPreMount, { passive: true, capture: true });
    document.addEventListener('touchstart', handlePointerPreMount, { passive: true, capture: true });
    return () => {
      document.removeEventListener('pointerover', handlePointerPreMount, { capture: true });
      document.removeEventListener('touchstart', handlePointerPreMount, { capture: true });
    };
  }, []);

  return (
    <div className="app-shell-root">
      {visitedTabs.has('schedule') && (
        <div
          id="matriculab-view-schedule"
          className="app-shell-tab-pane"
          style={{ display: activeTab === 'schedule' ? 'block' : 'none' }}
        >
          <ScheduleApp />
        </div>
      )}

      {visitedTabs.has('courses') && (
        <div
          id="matriculab-view-courses"
          className="app-shell-tab-pane"
          style={{ display: activeTab === 'courses' ? 'block' : 'none' }}
        >
          <CourseApp />
        </div>
      )}

      {visitedTabs.has('professors') && (
        <div
          id="matriculab-view-professors"
          className="app-shell-tab-pane"
          style={{ display: activeTab === 'professors' ? 'block' : 'none' }}
        >
          <ProfessorApp />
        </div>
      )}

      {visitedTabs.has('classrooms') && (
        <div
          id="matriculab-view-classrooms"
          className="app-shell-tab-pane"
          style={{ display: activeTab === 'classrooms' ? 'block' : 'none' }}
        >
          <ClassroomApp />
        </div>
      )}

      {visitedTabs.has('mentors') && (
        <div
          id="matriculab-view-mentors"
          className="app-shell-tab-pane"
          style={{ display: activeTab === 'mentors' ? 'block' : 'none' }}
        >
          <MentorApp />
        </div>
      )}
    </div>
  );
};
