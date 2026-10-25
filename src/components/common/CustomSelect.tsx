import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  badge?: string;
  badgeColor?: string;
  icon?: React.ReactNode;
}

export interface CustomSelectProps {
  value: string | number;
  onChange: (value: any) => void;
  options: SelectOption[];
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  menuClassName?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  align?: 'left' | 'right';
  disabled?: boolean;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  icon,
  className = '',
  menuClassName = '',
  searchable,
  searchPlaceholder = 'Buscar opción...',
  align = 'left',
  disabled = false,
  size = 'md',
  ariaLabel
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openUpwards, setOpenUpwards] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-enable search if there are more than 7 options unless explicitly disabled
  const shouldSearch = searchable ?? options.length > 7;

  // Selected Option
  const selectedOption = useMemo(
    () => options.find(opt => String(opt.value) === String(value)),
    [options, value]
  );

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(opt =>
      opt.label.toLowerCase().includes(q) ||
      (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Focus search input on open & detect viewport bounds
  useEffect(() => {
    if (isOpen) {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        // If less than 280px below and more space above, open upwards
        if (spaceBelow < 280 && rect.top > spaceBelow) {
          setOpenUpwards(true);
        } else {
          setOpenUpwards(false);
        }
      }

      if (shouldSearch) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    } else {
      setSearchQuery('');
    }
  }, [isOpen, shouldSearch]);

  const handleSelect = (val: string | number) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div
      ref={containerRef}
      className={`custom-select-container ${size === 'sm' ? 'custom-select-container--sm' : ''} ${disabled ? 'custom-select-container--disabled' : ''} ${className}`}
    >
      {/* Trigger Button */}
      <button
        type="button"
        className={`custom-select-trigger ${isOpen ? 'custom-select-trigger--open' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || selectedOption?.label || placeholder}
        disabled={disabled}
      >
        <div className="custom-select-trigger-content">
          {icon && <span className="custom-select-trigger-icon">{icon}</span>}
          {selectedOption?.badge && (
            <span
              className="custom-select-badge"
              style={selectedOption.badgeColor ? { borderColor: selectedOption.badgeColor, color: selectedOption.badgeColor } : undefined}
            >
              {selectedOption.badge}
            </span>
          )}
          <span className="custom-select-trigger-label">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <ChevronDown
          size={14}
          className={`custom-select-chevron ${isOpen ? 'custom-select-chevron--open' : ''}`}
        />
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div
          className={`custom-select-menu ${openUpwards ? 'custom-select-menu--upwards' : ''} ${align === 'right' ? 'custom-select-menu--right' : ''} ${menuClassName}`}
          role="listbox"
        >
          {/* Integrated Search Bar */}
          {shouldSearch && (
            <div className="custom-select-search-wrap">
              <Search size={13} className="custom-select-search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                className="custom-select-search-input"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onClick={e => e.stopPropagation()}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="custom-select-search-clear"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          {/* Options List */}
          <div className="custom-select-options-list">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = String(option.value) === String(value);

                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`custom-select-option ${isSelected ? 'custom-select-option--selected' : ''}`}
                    onClick={() => handleSelect(option.value)}
                  >
                    <div className="custom-select-option-left">
                      {option.icon && (
                        <span className="custom-select-option-icon">{option.icon}</span>
                      )}
                      {option.badge && (
                        <span
                          className="custom-select-badge"
                          style={option.badgeColor ? { borderColor: option.badgeColor, color: option.badgeColor } : undefined}
                        >
                          {option.badge}
                        </span>
                      )}
                      <span className="custom-select-option-label">{option.label}</span>
                    </div>

                    {isSelected && (
                      <Check size={14} className="custom-select-check-icon" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="custom-select-empty">
                No se encontraron opciones
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
