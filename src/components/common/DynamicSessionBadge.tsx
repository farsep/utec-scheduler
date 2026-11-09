import React from 'react';

export interface DynamicSessionBadgeProps {
  type?: string;
  group?: string | number;
  number?: string | number;
  sessionGroup?: string;
  className?: string;
  durationMinutes?: number;
  isShort?: boolean;
  isNarrow?: boolean;
  forceFull?: boolean;
  forceAbbr?: boolean;
}

export const DynamicSessionBadge: React.FC<DynamicSessionBadgeProps> = ({
  type = '',
  group,
  number,
  sessionGroup,
  className = '',
  durationMinutes,
  isShort,
  isNarrow,
  forceFull,
  forceAbbr
}) => {
  const raw = (sessionGroup || type || '').trim();

  let resolvedType = type;
  let resolvedGroup = number !== undefined ? String(number) : group !== undefined ? String(group) : '';

  if (!resolvedGroup) {
    // If raw is e.g. "TEO1", "LAB11", "TEORÍA 11", "LAB 14", "Teoría 1", "TEO 2"
    // Match type name and trailing group number/letter
    const matchWithNum = raw.match(/^([a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+?)\s*(\d+[a-zA-Z]?)$/);
    if (matchWithNum) {
      resolvedType = matchWithNum[1].trim();
      resolvedGroup = matchWithNum[2].trim();
    } else {
      const matchSimple = raw.match(/^([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)\s*(.*)$/);
      if (matchSimple) {
        resolvedType = matchSimple[1].trim();
        resolvedGroup = matchSimple[2].trim();
      } else {
        resolvedType = raw;
      }
    }
  }

  const isLab = /lab/i.test(resolvedType);
  const isTheory = /teo|teor/i.test(resolvedType);
  const isVirtual = /vir/i.test(resolvedType);
  const isPract = /pr[áa]c/i.test(resolvedType);

  let fullLabel = '';
  let abbrLabel = '';
  let suffix = '';

  if (isTheory) {
    fullLabel = 'Teoría';
    abbrLabel = 'Teo';
    suffix = 'ría';
  } else if (isLab) {
    fullLabel = 'Laboratorio';
    abbrLabel = 'Lab';
    suffix = 'oratorio';
  } else if (isPract) {
    fullLabel = 'Práctica';
    abbrLabel = 'Prác';
    suffix = 'tica';
  } else if (isVirtual) {
    fullLabel = 'Virtual';
    abbrLabel = 'Vir';
    suffix = 'tual';
  } else {
    fullLabel = resolvedType || 'Sesión';
    abbrLabel = resolvedType ? resolvedType.slice(0, 4) : 'Ses';
    suffix = '';
  }

  // Decision rule:
  // "Que si es de 2 horas a mas diga completo "Teoria"/"Laboratorio" y si el espacio es muy pequeño su abreviacion "Teo"/"Lab""
  const isSmallSpace = isShort || isNarrow || (durationMinutes !== undefined && durationMinutes < 110);
  const isTwoHoursOrMore = durationMinutes !== undefined && durationMinutes >= 110;

  let isFull = false;
  if (forceFull) {
    isFull = true;
  } else if (forceAbbr) {
    isFull = false;
  } else if (isTwoHoursOrMore && !isNarrow && !isShort) {
    isFull = true;
  } else if (isSmallSpace) {
    isFull = false;
  } else {
    // Default fallback when duration is not provided (e.g. detailed modal views where space permits)
    isFull = true;
  }

  return (
    <span
      className={`prof-session-group-tag dynamic-session-badge ${className}`}
      title={raw || `${fullLabel} ${resolvedGroup}`.trim()}
    >
      <span className="session-prefix">
        {isFull ? fullLabel : abbrLabel}
      </span>
      {resolvedGroup && (
        <span className="session-group-num">&nbsp;{resolvedGroup}</span>
      )}
    </span>
  );
};

export default DynamicSessionBadge;
