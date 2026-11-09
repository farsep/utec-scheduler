import React from 'react';

export interface DynamicSessionBadgeProps {
  type?: string;
  group?: string | number;
  number?: string | number;
  sessionGroup?: string;
  className?: string;
}

export const DynamicSessionBadge: React.FC<DynamicSessionBadgeProps> = ({
  type = '',
  group,
  number,
  sessionGroup,
  className = ''
}) => {
  const raw = (sessionGroup || type || '').trim();

  let resolvedType = type;
  let resolvedGroup = number !== undefined ? number : group;

  if (resolvedGroup === undefined || resolvedGroup === null) {
    // If raw is e.g. "TEORÍA 11" or "LAB 14" or "TEO 7" or "Laboratorio 2"
    const match = raw.match(/^([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)\s*(.*)$/);
    if (match) {
      resolvedType = match[1];
      resolvedGroup = match[2] || undefined;
    } else {
      resolvedType = raw;
    }
  }

  const isLab = /lab/i.test(resolvedType);
  const isTheory = /teo|teor/i.test(resolvedType);
  const isVirtual = /vir/i.test(resolvedType);
  const isPract = /pr[áa]c/i.test(resolvedType);

  const prefix = isLab
    ? 'LAB'
    : isTheory
    ? 'TEO'
    : isVirtual
    ? 'VIR'
    : isPract
    ? 'PRÁC'
    : resolvedType ? resolvedType.slice(0, 4).toUpperCase() : 'SES';

  const suffix = isLab
    ? 'ORATORIO'
    : isTheory
    ? 'RÍA'
    : isVirtual
    ? 'TUAL'
    : isPract
    ? 'TICA'
    : '';

  const colorClasses = isLab
    ? 'bg-[#DCEEE6] text-[#094D31] border-[#0D7A4E]/40 border-l-[#0D7A4E]'
    : isTheory
    ? 'bg-[#E0EBF5] text-[#005A78] border-[#00779E]/40 border-l-[#00779E]'
    : isVirtual
    ? 'bg-[#F5E8D6] text-[#804200] border-[#C44D00]/40 border-l-[#C44D00]'
    : 'bg-[#DCD9D2] text-[#141416] border-[#18181A]/40 border-l-[#18181A]';

  return (
    <span
      className={`session-type-badge dynamic-session-badge group/badge inline-flex items-center font-mono text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 border border-l-[3px] rounded-none transition-all duration-150 select-none ${colorClasses} ${className}`}
      title={raw || `${prefix}${suffix} ${resolvedGroup || ''}`.trim()}
    >
      <span className="session-prefix">{prefix}</span>
      {suffix && (
        <span className="session-suffix-expand inline-block max-w-0 overflow-hidden opacity-0 group-hover/badge:max-w-[72px] group-hover/badge:opacity-100 group-hover/card:max-w-[72px] group-hover/card:opacity-100 group-hover:max-w-[72px] group-hover:opacity-100 @[220px]:max-w-[72px] @[220px]:opacity-100 transition-all duration-200 ease-out whitespace-nowrap">
          {suffix}
        </span>
      )}
      {resolvedGroup !== undefined && resolvedGroup !== null && resolvedGroup !== '' && (
        <span className="ml-1 font-mono font-semibold">{resolvedGroup}</span>
      )}
    </span>
  );
};

export default DynamicSessionBadge;
