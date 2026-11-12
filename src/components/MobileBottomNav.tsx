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

  // 1. Any modal, dialog, or drawer open
  if (
    document.querySelector('[role="dialog"]') ||
    document.querySelector('.modal-open') ||
    document.querySelector('.schedule-import-modal') ||
    document.querySelector('.classroom-detail-modal') ||
    document.querySelector('.prof-detail-modal') ||
    document.querySelector('.course-detail-modal') ||
    document.querySelector('.mentor-detail-modal') ||
    document.querySelector('.mobile-sidebar-drawer.is-open')
  ) {
    return true;
  }

  // 2. Interactive form controls or painters
  if (
    target.closest('input') ||
    target.closest('select') ||
    target.closest('textarea') ||
    target.closest('button') ||
    target.closest('[role="button"]') ||
    target.closest('.interactive-painter') ||
    target.closest('.time-block-painter')
  ) {
    return true;
  }

  // 3. Horizontally scrollable container or ancestor
  let el: HTMLElement | null = target;
  while (el && el !== document.body && el !== document.documentElement) {
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
  const dockRef = useRef<HTMLElement | null>(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);

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

  // Sync dock progress CSS variable to active index
  useEffect(() => {
    if (dockRef.current) {
      dockRef.current.style.setProperty('--dock-active-progress', String(currentTabIndex));
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

  // Gesture 1: YouTube-iOS Horizontal Touch Swipe on Viewport (< 1024px)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let isSwipeActive = false;
    let isSwipeLocked = false;
    let isVerticalScroll = false;
    let activeContentEl: HTMLElement | null = null;

    const onTouchStart = (e: TouchEvent) => {
      if (window.innerWidth >= 1024 || e.touches.length !== 1) return;
      if (shouldIgnorePageSwipe(e.target)) return;

      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
      isSwipeActive = false;
      isSwipeLocked = false;
      isVerticalScroll = false;

      // Find active tab pane or main container for parallax shift
      activeContentEl =
        document.querySelector('.app-shell-tab-pane[style*="display: block"]') ||
        document.querySelector('main.main-content') ||
        document.querySelector('.app-shell-root');
    };

    const onTouchMove = (e: TouchEvent) => {
      if (window.innerWidth >= 1024 || e.touches.length !== 1) return;
      if (isVerticalScroll) return;

      const deltaX = e.touches[0].clientX - touchStartX;
      const deltaY = e.touches[0].clientY - touchStartY;

      if (!isSwipeLocked) {
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
          isVerticalScroll = true;
          isSwipeLocked = true;
          return;
        }
        if (Math.abs(deltaX) > Math.abs(deltaY) * 1.35 && Math.abs(deltaX) > 14) {
          isSwipeActive = true;
          isSwipeLocked = true;
        }
      }

      if (isSwipeActive) {
        if (e.cancelable) e.preventDefault();

        if (sliderRef.current) {
          sliderRef.current.classList.add('is-dragging');
        }

        // Fractional progress: deltaX > 0 (swipe right -> prev tab), deltaX < 0 (swipe left -> next tab)
        const fractionalProgress = Math.max(
          0,
          Math.min(4, currentTabIndex - deltaX / window.innerWidth)
        );

        if (dockRef.current) {
          dockRef.current.style.setProperty('--dock-active-progress', String(fractionalProgress));
        }

        setHoverIndex(Math.round(fractionalProgress));

        if (activeContentEl) {
          const shift = Math.max(-48, Math.min(48, deltaX * 0.18));
          activeContentEl.style.transform = `translate3d(${shift}px, 0, 0)`;
          activeContentEl.style.transition = 'none';
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!isSwipeActive) return;

      const deltaX = e.changedTouches[0].clientX - touchStartX;
      const duration = Date.now() - touchStartTime;
      const velocity = Math.abs(deltaX) / Math.max(1, duration);

      if (sliderRef.current) {
        sliderRef.current.classList.remove('is-dragging');
      }

      if (activeContentEl) {
        activeContentEl.style.transition = 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)';
        activeContentEl.style.transform = 'translate3d(0, 0, 0)';
      }

      let targetIdx = currentTabIndex;
      if (Math.abs(deltaX) >= 68 || velocity >= 0.38) {
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
        handleNavigate(targetIdx);
      }

      isSwipeActive = false;
      isSwipeLocked = false;
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
    };
  }, [currentTabIndex, handleNavigate]);

  // Gesture 2: Direct Thumb-Scrubbing Across the Bottom Bar (< 1024px)
  const onDockTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    if (sliderRef.current) {
      sliderRef.current.classList.add('is-dragging');
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const rawProgress = Math.max(0, Math.min(4, (x / rect.width) * 5));
    const idx = Math.max(0, Math.min(4, Math.floor(rawProgress)));
    setHoverIndex(idx);
    if (dockRef.current) {
      dockRef.current.style.setProperty('--dock-active-progress', String(idx));
    }
  };

  const onDockTouchMove = (e: React.TouchEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const rawProgress = Math.max(0, Math.min(4, (x / rect.width) * 5));
    const idx = Math.max(0, Math.min(4, Math.floor(rawProgress)));
    setHoverIndex(idx);
    if (dockRef.current) {
      dockRef.current.style.setProperty('--dock-active-progress', String(idx));
    }
  };

  const onDockTouchEnd = (e: React.TouchEvent<HTMLElement>) => {
    if (sliderRef.current) {
      sliderRef.current.classList.remove('is-dragging');
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.changedTouches[0].clientX - rect.left;
    const rawProgress = Math.max(0, Math.min(4, (x / rect.width) * 5));
    const idx = Math.max(0, Math.min(4, Math.floor(rawProgress)));
    handleNavigate(idx);
  };

  const displayedActiveIndex = hoverIndex !== null ? hoverIndex : currentTabIndex;

  return (
    <nav
      ref={dockRef}
      className="grafton-mobile-dock lg:hidden select-none"
      aria-label="Navegación principal móvil Grafton"
      style={{
        '--dock-active-progress': displayedActiveIndex,
      } as React.CSSProperties}
      onTouchStart={onDockTouchStart}
      onTouchMove={onDockTouchMove}
      onTouchEnd={onDockTouchEnd}
      onTouchCancel={() => {
        if (sliderRef.current) sliderRef.current.classList.remove('is-dragging');
        if (dockRef.current) {
          dockRef.current.style.setProperty('--dock-active-progress', String(currentTabIndex));
        }
        setHoverIndex(null);
      }}
    >
      <div className="grafton-dock-grid grid grid-cols-5 h-[60px] relative">
        {/* Hardware-Accelerated Sliding Indicator */}
        <div
          ref={sliderRef}
          className="grafton-dock-slider"
          aria-hidden="true"
          style={{
            transform: `translate3d(calc(${displayedActiveIndex} * 100%), 0, 0)`,
          }}
        />

        {/* 5 Canonical Route Tabs */}
        {CANONICAL_DOCK_ITEMS.map((item, index) => {
          const isActive = displayedActiveIndex === index;
          const Icon = item.icon;

          return (
            <a
              key={item.id}
              href={item.href}
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
