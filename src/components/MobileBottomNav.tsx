import React from 'react';
import { Calendar, BookOpen, Building2, GraduationCap, Award } from 'lucide-react';

export type NavTabId = 'horarios' | 'cursos' | 'aulas' | 'docentes' | 'mentores';

interface MobileBottomNavProps {
  activeTab: NavTabId;
}

interface NavItem {
  id: NavTabId;
  href: string;
  label: string;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'horarios', href: '/', label: 'Horarios', title: 'Armador de Horarios', icon: Calendar },
  { id: 'cursos', href: '/cursos', label: 'Cursos', title: 'Catálogo de Cursos Ofertados', icon: BookOpen },
  { id: 'aulas', href: '/aulas', label: 'Aulas', title: 'Buscador de Aulas Libres', icon: Building2 },
  { id: 'docentes', href: '/profesores', label: 'Docentes', title: 'Directorio de Docentes', icon: GraduationCap },
  { id: 'mentores', href: '/mentores', label: 'Mentores', title: 'Mentores Académicos', icon: Award },
];

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeTab }) => {
  return (
    <nav className="mobile-bottom-nav" aria-label="Navegación principal móvil">
      {NAV_ITEMS.map(({ id, href, label, title, icon: Icon }) => {
        const isActive = activeTab === id;
        return (
          <a
            key={id}
            href={href}
            className={`mobile-bottom-nav-item ${isActive ? 'mobile-bottom-nav-item--active' : ''}`}
            title={title}
            aria-current={isActive ? 'page' : undefined}
          >
            <div className="mobile-nav-icon-box">
              <Icon size={19} />
              {isActive && id !== 'horarios' && <span className="mobile-nav-live-dot" />}
            </div>
            <span className="mobile-nav-label">{label}</span>
          </a>
        );
      })}
    </nav>
  );
};
