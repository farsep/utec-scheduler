import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, BookOpen, Building2, GraduationCap, Award } from 'lucide-react';

export type CanonicalDockTab = 'schedule' | 'courses' | 'classrooms' | 'professors' | 'mentors';

export interface MobileBottomNavProps {
  activeTab?: string;
  onSwitchTab?: (tab: string, targetUrl?: string) => void;
}

interface DockItem {
  id: CanonicalDockTab;
  href: string;
  label: string;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
}

export const CANONICAL_DOCK_ITEMS: DockItem[] = [
  { id: 'schedule', href: '/', label: 'Horarios', title: 'Armador de Horarios', icon: Calendar },
  { id: 'courses', href: '/cursos', label: 'Cursos', title: 'Catálogo de Cursos Ofertados', icon: BookOpen },
  { id: 'classrooms', href: '/aulas', label: 'Aulas', title: 'Buscador de Aulas Libres', icon: Building2 },
  { id: 'professors', href: '/profesores', label: 'Docentes', title: 'Directorio de Docentes', icon: GraduationCap },
  { id: 'mentors', href: '/mentores', label: 'Mentores', title: 'Mentores Académicos', icon: Award },
];

const DOCK_BEAM_COLORS = ['#00779E', '#B85D00', '#0D7A4E', '#B8332A', '#3D348B'] as const;
const DOCK_TINT_COLORS = ['#E0EBF5', '#F5E8D3', '#DCEEE6', '#F9E3E1', '#EAE8F6'] as const;
const DOCK_TOOLTIP_LABELS = ['[ HORARIOS ]', '[ CURSOS ]', '[ AULAS ]', '[ DOCENTES ]', '[ MENTORES ]'] as const;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function getActiveMainPane(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const panes = Array.from(document.querySelectorAll<HTMLElement>('.app-shell-tab-pane'));
  const visiblePane = panes.find(el => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
  if (visiblePane) {
    return visiblePane.querySelector<HTMLElement>('main') || visiblePane;
  }
  return document.querySelector<HTMLElement>('main.main-content, main, .app-shell-main');
}

export function getCanonicalDockIndex(tabKey?: string): number {
  if (!tabKey) {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.split('?')[0].split('#')[0];
      if (p === '/cursos' || p.startsWith('/curso') || p === '/malla' || p.startsWith('/malla')) return 1;
      if (p === '/aulas' || p.startsWith('/aula')) return 2;
      if (p === '/profesores' || p === '/docentes' || p.startsWith('/profesor')) return 3;
      if (p === '/mentores' || p.startsWith('/mentor')) return 4;
      return 0;
    }
    return 0;
  }
  const norm = tabKey.toLowerCase();
  if (norm === 'schedule' || norm === 'horarios' || norm === '/') return 0;
  if (norm === 'courses' || norm === 'cursos' || norm === 'malla') return 1;
  if (norm === 'classrooms' || norm === 'aulas') return 2;
  if (norm === 'professors' || norm === 'docentes' || norm === 'profesores') return 3;
  if (norm === 'mentors' || norm === 'mentores') return 4;
  return 0;
}

function shouldIgnorePageSwipe(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return true;

  // 1. Any modal, dialog, command palette, or drawer open
  if (
    document.querySelector('[role="dialog"]') ||
    document.querySelector('.modal-open') ||
    document.querySelector('.schedule-import-modal') ||
    document.querySelector('.classroom-detail-modal') ||
    document.querySelector('.prof-detail-modal') ||
    document.querySelector('.course-detail-modal') ||
    document.querySelector('.mentor-detail-modal') ||
    document.querySelector('.command-palette-overlay') ||
    document.querySelector('.mobile-sidebar-drawer.is-open')
  ) {
    return true;
  }

  // 2. Interactive form controls, painters, explicit opt-outs, or mobile course swipe cards
  if (
    target.closest('[data-no-page-swipe]') ||
    target.closest('.overflow-x-auto') ||
    target.closest('input') ||
    target.closest('select') ||
    target.closest('textarea') ||
    target.closest('button') ||
    target.closest('[role="button"]') ||
    target.closest('.interactive-painter') ||
    target.closest('.time-block-painter') ||
    (typeof window !== 'undefined' && window.innerWidth < 768 && target.closest('.course-card-swipe-container'))
  ) {
    return true;
  }

  // 3. Horizontally scrollable container or ancestor
  let el: HTMLElement | null = target;
  while (el && el !== document.body && el !== document.documentElement) {
    if (el.hasAttribute('data-no-page-swipe') || el.classList.contains('overflow-x-auto')) {
      return true;
    }
    if (el.scrollWidth > el.clientWidth + 4) {
      const style = window.getComputedStyle(el);
      const overflowX = style.overflowX;
      if (overflowX === 'auto' || overflowX === 'scroll') {
        return true;
      }
    }
    if (
      el.classList.contains('dag-scroll-container') ||
      el.classList.contains('schedule-grid-scroll') ||
      el.classList.contains('grafton-topbar__switcher') ||
      el.classList.contains('prof-modal-timeline-scroll') ||
      el.classList.contains('filter-pills-scroll') ||
      el.classList.contains('grafton-mobile-dock')
    ) {
      return true;
    }
    el = el.parentElement;
  }

  return false;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeTab, onSwitchTab }) => {
  const [activePathIndex, setActivePathIndex] = useState<number>(() => {
    return getCanonicalDockIndex(activeTab);
  });
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [scrubState, setScrubState] = useState<{ index: number; progress: number } | null>(null);
  const dockRef = useRef<HTMLElement | null>(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const paneResetTimerRef = useRef<number | null>(null);

  // Synchronize activePathIndex when activeTab prop changes or when URL changes
  useEffect(() => {
    const updateFromLocationOrProp = () => {
      setActivePathIndex(getCanonicalDockIndex(activeTab));
    };

    updateFromLocationOrProp();

    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', updateFromLocationOrProp);
      window.addEventListener('astro:page-load', updateFromLocationOrProp);
      window.addEventListener('DOMContentLoaded', updateFromLocationOrProp);
      return () => {
        window.removeEventListener('popstate', updateFromLocationOrProp);
        window.removeEventListener('astro:page-load', updateFromLocationOrProp);
        window.removeEventListener('DOMContentLoaded', updateFromLocationOrProp);
      };
    }
  }, [activeTab]);

  const currentTabIndex = activePathIndex;

  // Sync dock progress CSS variable to active index & clear any stale pane transforms
  useEffect(() => {
    if (dockRef.current) {
      dockRef.current.style.setProperty('--dock-active-progress', String(currentTabIndex));
    }
    if (typeof document !== 'undefined') {
      document
        .querySelectorAll<HTMLElement>('.app-shell-tab-pane, main.main-content, .app-shell-root')
        .forEach(el => {
          el.style.removeProperty('transform');
          el.style.removeProperty('transition');
          el.style.removeProperty('will-change');
        });
    }
  }, [currentTabIndex]);

  // Prefetch adjacent & all routes for instantaneous navigation
  useEffect(() => {
    if (typeof window === 'undefined') return;
    CANONICAL_DOCK_ITEMS.forEach(item => {
      if (item.href !== window.location.pathname) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = item.href;
        document.head.appendChild(link);
      }
    });
  }, []);

  const handleNavigate = useCallback(
    (index: number) => {
      const target = CANONICAL_DOCK_ITEMS[index];
      if (!target) return;

      setActivePathIndex(index);
      if (dockRef.current) {
        dockRef.current.style.setProperty('--dock-active-progress', String(index));
      }
      setHoverIndex(null);

      if (onSwitchTab) {
        onSwitchTab(target.id, target.href);
      } else if (typeof window !== 'undefined') {
        if (window.location.pathname !== target.href) {
          window.location.href = target.href;
        }
      }
    },
    [onSwitchTab]
  );

  // Gesture 1: 1:1 Elastic Page-Swipe with Live Polychrome Dock Interpolation (< 1024px)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let isSwipeActive = false;
    let isSwipeLocked = false;
    let isVerticalScroll = false;
    let trackedPane: HTMLElement | null = null;

    const applySliderProgress = (progress: number, nearestIdx: number) => {
      if (dockRef.current) {
        dockRef.current.style.setProperty('--dock-active-progress', String(progress));
      }
      if (sliderRef.current) {
        sliderRef.current.style.borderTopColor = DOCK_BEAM_COLORS[nearestIdx] || DOCK_BEAM_COLORS[0];
        sliderRef.current.style.backgroundColor = DOCK_TINT_COLORS[nearestIdx] || DOCK_TINT_COLORS[0];
      }
    };

    const clearSliderInlineColors = () => {
      if (sliderRef.current) {
        sliderRef.current.style.removeProperty('border-top-color');
        sliderRef.current.style.removeProperty('background-color');
      }
    };

    const resetPaneParallax = (animateBack: boolean) => {
      if (!trackedPane) return;
      const pane = trackedPane;
      trackedPane = null;
      if (paneResetTimerRef.current) {
        window.clearTimeout(paneResetTimerRef.current);
        paneResetTimerRef.current = null;
      }
      if (animateBack) {
        pane.style.transition = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)';
        pane.style.transform = 'translate3d(0, 0, 0)';
        paneResetTimerRef.current = window.setTimeout(() => {
          pane.style.removeProperty('transform');
          pane.style.removeProperty('transition');
          pane.style.removeProperty('will-change');
        }, 230);
      } else {
        pane.style.removeProperty('transform');
        pane.style.removeProperty('transition');
        pane.style.removeProperty('will-change');
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (window.innerWidth >= 1024 || e.touches.length !== 1) return;
      if (shouldIgnorePageSwipe(e.target)) {
        isSwipeLocked = true;
        isVerticalScroll = true;
        return;
      }

      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = performance.now();
      isSwipeActive = false;
      isSwipeLocked = false;
      isVerticalScroll = false;
      trackedPane = null;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (window.innerWidth >= 1024 || e.touches.length !== 1) return;
      if (isVerticalScroll) return;

      const deltaX = e.touches[0].clientX - touchStartX;
      const deltaY = e.touches[0].clientY - touchStartY;

      if (!isSwipeLocked) {
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        if (absY > 10 && absX <= absY * 1.35) {
          isVerticalScroll = true;
          isSwipeLocked = true;
          return;
        }
        if (absX > absY * 1.35 && absX > 10) {
          isSwipeActive = true;
          isSwipeLocked = true;
          trackedPane = getActiveMainPane();
          if (trackedPane) {
            trackedPane.style.willChange = 'transform';
            trackedPane.style.transition = 'none';
          }
        } else if (Math.hypot(absX, absY) > 16) {
          isVerticalScroll = true;
          isSwipeLocked = true;
          return;
        }
      }

      if (isSwipeActive) {
        if (e.cancelable) e.preventDefault();

        if (sliderRef.current) {
          sliderRef.current.classList.add('is-dragging');
        }

        const raw = currentTabIndex - deltaX / Math.max(window.innerWidth, 1);
        const damped =
          raw < 0 ? raw * 0.18 : raw > 4 ? 4 + (raw - 4) * 0.18 : raw;
        const progress = clamp(damped, -0.22, 4.22);
        const nearestIdx = Math.round(clamp(progress, 0, 4));

        applySliderProgress(progress, nearestIdx);
        setHoverIndex(nearestIdx);

        if (trackedPane) {
          const parallaxX = clamp(deltaX * 0.22, -56, 56);
          trackedPane.style.transform = `translate3d(${parallaxX.toFixed(1)}px, 0, 0)`;
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!isSwipeActive) {
        isSwipeLocked = false;
        isVerticalScroll = false;
        return;
      }

      const deltaX = e.changedTouches[0].clientX - touchStartX;
      const duration = Math.max(1, performance.now() - touchStartTime);
      const velocity = Math.abs(deltaX) / duration;

      if (sliderRef.current) {
        sliderRef.current.classList.remove('is-dragging');
      }
      clearSliderInlineColors();

      let targetIdx = currentTabIndex;
      if (Math.abs(deltaX) > 64 || velocity > 0.38) {
        if (deltaX < 0 && currentTabIndex < 4) {
          targetIdx = currentTabIndex + 1;
        } else if (deltaX > 0 && currentTabIndex > 0) {
          targetIdx = currentTabIndex - 1;
        }
      }

      if (dockRef.current) {
        dockRef.current.style.setProperty('--dock-active-progress', String(targetIdx));
      }
      setHoverIndex(null);

      if (targetIdx !== currentTabIndex) {
        try {
          navigator.vibrate?.(10);
        } catch (_) {}
        resetPaneParallax(false);
        handleNavigate(targetIdx);
      } else {
        resetPaneParallax(true);
      }

      isSwipeActive = false;
      isSwipeLocked = false;
      isVerticalScroll = false;
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      if (paneResetTimerRef.current) window.clearTimeout(paneResetTimerRef.current);
    };
  }, [currentTabIndex, handleNavigate]);

  // Gesture 2: Magnetic Thumb-Scrubbing Across the Bottom Bar (< 1024px)
  const updateDockScrub = (clientX: number) => {
    const width = Math.max(window.innerWidth, 1);
    const fractionalIndex = clamp((clientX / width) * 5 - 0.5, 0, 4);
    const nearestIdx = Math.round(fractionalIndex);
    setHoverIndex(nearestIdx);
    setScrubState({ index: nearestIdx, progress: fractionalIndex });
    if (dockRef.current) {
      dockRef.current.style.setProperty('--dock-active-progress', String(fractionalIndex));
    }
    if (sliderRef.current) {
      sliderRef.current.style.borderTopColor = DOCK_BEAM_COLORS[nearestIdx] || DOCK_BEAM_COLORS[0];
      sliderRef.current.style.backgroundColor = DOCK_TINT_COLORS[nearestIdx] || DOCK_TINT_COLORS[0];
    }
    return nearestIdx;
  };

  const onDockTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    if (sliderRef.current) {
      sliderRef.current.classList.add('is-dragging');
    }
    updateDockScrub(e.touches[0].clientX);
  };

  const onDockTouchMove = (e: React.TouchEvent<HTMLElement>) => {
    if (e.cancelable) e.preventDefault();
    updateDockScrub(e.touches[0].clientX);
  };

  const onDockTouchEnd = (e: React.TouchEvent<HTMLElement>) => {
    if (sliderRef.current) {
      sliderRef.current.classList.remove('is-dragging');
      sliderRef.current.style.removeProperty('border-top-color');
      sliderRef.current.style.removeProperty('background-color');
    }
    const clientX = e.changedTouches[0]?.clientX ?? 0;
    const width = Math.max(window.innerWidth, 1);
    const fractionalIndex = clamp((clientX / width) * 5 - 0.5, 0, 4);
    const nearestIdx = Math.round(fractionalIndex);
    setScrubState(null);
    if (nearestIdx !== currentTabIndex) {
      try {
        navigator.vibrate?.(10);
      } catch (_) {}
    }
    handleNavigate(nearestIdx);
  };

  const displayedActiveIndex = hoverIndex !== null ? hoverIndex : currentTabIndex;
  const activeDockModule = CANONICAL_DOCK_ITEMS[displayedActiveIndex]?.id || 'schedule';

  return (
    <nav
      ref={dockRef}
      className="grafton-mobile-dock lg:hidden select-none"
      aria-label="Navegación principal móvil Grafton"
      data-active-dock={activeDockModule}
      onTouchStart={onDockTouchStart}
      onTouchMove={onDockTouchMove}
      onTouchEnd={onDockTouchEnd}
      onTouchCancel={() => {
        if (sliderRef.current) {
          sliderRef.current.classList.remove('is-dragging');
          sliderRef.current.style.removeProperty('border-top-color');
          sliderRef.current.style.removeProperty('background-color');
        }
        if (dockRef.current) {
          dockRef.current.style.setProperty('--dock-active-progress', String(currentTabIndex));
        }
        setHoverIndex(null);
        setScrubState(null);
      }}
    >
      {scrubState !== null && (
        <div
          className="grafton-dock-scrub-pill"
          style={{
            left: `calc(${((scrubState.progress + 0.5) / 5) * 100}%)`,
            borderTopColor: DOCK_BEAM_COLORS[scrubState.index] || DOCK_BEAM_COLORS[0],
          }}
        >
          {DOCK_TOOLTIP_LABELS[scrubState.index]}
        </div>
      )}
      <div className="grafton-dock-grid grid grid-cols-5 h-[60px] relative">
        {/* Hardware-Accelerated Sliding Indicator */}
        <div
          ref={sliderRef}
          className="grafton-dock-slider"
          aria-hidden="true"
        />

        {/* 5 Canonical Route Tabs */}
        {CANONICAL_DOCK_ITEMS.map((item, index) => {
          const isActive = displayedActiveIndex === index;
          const Icon = item.icon;

          return (
            <a
              key={item.id}
              href={item.href}
              data-dock-module={item.id}
              className={`grafton-dock-item ${isActive ? 'is-active' : ''}`}
              title={item.title}
              aria-current={isActive ? 'page' : undefined}
              onClick={e => {
                e.preventDefault();
                handleNavigate(index);
              }}
            >
              <div className="grafton-dock-icon">
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.75} />
              </div>
              <span className="grafton-dock-label">{item.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
};
