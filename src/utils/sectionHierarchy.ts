export interface ParsedSectionHierarchy {
  raw: string;
  mainSection: string;
  hasSubsection: boolean;
  subsectionRaw: string | null;
  subsectionKindShort: string | null;
  subsectionNum: string | null;
  subsectionCode: string | null;
  subsectionPillLabel: string;
  compactTicketCode: string;
  compactBadgeLabel: string;
  sidebarCompactCode: string;
}

export interface SectionWithSessionsLike {
  sectionNumber: string;
  sessions?: Array<{
    sessionGroup?: string;
    sessionType?: string;
    day?: string;
    startTime?: string;
    endTime?: string;
    startMinutes?: number;
    endMinutes?: number;
    roomDisplayName?: string;
    professor?: string;
  }>;
}

export interface SectionHierarchyGroup<T extends SectionWithSessionsLike> {
  mainSection: string;
  subsections: T[];
  hasSubsections: boolean;
}

export type CourseSectionStructureKind =
  | 'flat'
  | 'single-main-subsections'
  | 'multi-main-subsections';

export interface CourseSectionStructure<T extends SectionWithSessionsLike> {
  kind: CourseSectionStructureKind;
  groups: SectionHierarchyGroup<T>[];
}

function getKindPrefixAndShort(subRaw: string): { kindShort: string; codePrefix: string } {
  if (/laboratorio\s+virtual/i.test(subRaw)) {
    return { kindShort: 'Lab Virt', codePrefix: 'LV' };
  }
  if (/laboratorio|lab/i.test(subRaw)) {
    return { kindShort: 'Lab', codePrefix: 'L' };
  }
  if (/teor[ií]a|teo/i.test(subRaw)) {
    return { kindShort: 'Teo', codePrefix: 'T' };
  }
  if (/pr[aá]ctica|pra/i.test(subRaw)) {
    return { kindShort: 'Prác', codePrefix: 'P' };
  }
  if (/taller|tal/i.test(subRaw)) {
    return { kindShort: 'Tal', codePrefix: 'TA' };
  }
  if (/seminario|sem/i.test(subRaw)) {
    return { kindShort: 'Sem', codePrefix: 'SE' };
  }
  return { kindShort: 'Sub', codePrefix: 'SB' };
}

function formatPaddedMain(mainSection: string): string {
  return /^\d+$/.test(mainSection)
    ? `S${mainSection.padStart(2, '0')}`
    : `S${mainSection}`;
}

/**
 * Parses section numbers like "2", "1 (LABORATORIO 11)", "2 (TEORÍA 21)", or "1 (LABORATORIO VIRTUAL 11)"
 * into main section and subsection metadata.
 */
export function parseSectionHierarchy(secNum: string): ParsedSectionHierarchy {
  const raw = (secNum || '').trim();
  const match = raw.match(/^([^\s(]+)\s*(?:\(([^)]+)\))?$/);
  const mainSection = match?.[1] || raw;
  const subRaw = match?.[2]?.trim() || null;

  const paddedMain = formatPaddedMain(mainSection);

  if (!subRaw) {
    return {
      raw,
      mainSection,
      hasSubsection: false,
      subsectionRaw: null,
      subsectionKindShort: null,
      subsectionNum: null,
      subsectionCode: null,
      subsectionPillLabel: `S${mainSection}`,
      compactTicketCode: paddedMain,
      compactBadgeLabel: `Sec. ${mainSection}`,
      sidebarCompactCode: `Sec ${mainSection}`,
    };
  }

  const { kindShort, codePrefix } = getKindPrefixAndShort(subRaw);
  const numMatch = subRaw.match(/(\d+)\s*$/);
  const subsectionNum = numMatch ? numMatch[1] : null;
  const subsectionCode = subsectionNum ? `${codePrefix}${subsectionNum}` : codePrefix;
  const subsectionPillLabel = subsectionNum ? `${kindShort} ${subsectionNum}` : kindShort;

  return {
    raw,
    mainSection,
    hasSubsection: true,
    subsectionRaw: subRaw,
    subsectionKindShort: kindShort,
    subsectionNum,
    subsectionCode,
    subsectionPillLabel,
    compactTicketCode: `${paddedMain}·${subsectionCode}`,
    compactBadgeLabel: `Sec. ${mainSection} · ${subsectionPillLabel}`,
    sidebarCompactCode: `Sec ${mainSection} · ${subsectionCode}`,
  };
}

/**
 * Resolves subsection metadata for a section object, inferring specific Lab/Sub labels
 * when an entry without parentheses (e.g. "2" holding LABORATORIO 26/27) sits inside
 * a main section that has multiple subsections.
 */
export function resolveSectionHierarchy<T extends SectionWithSessionsLike>(
  section: T,
  groupHasSubsections: boolean
): ParsedSectionHierarchy {
  const base = parseSectionHierarchy(section.sectionNumber);
  if (base.hasSubsection || !groupHasSubsections) {
    return base;
  }

  const distinctGroups: string[] = [];
  for (const sess of section.sessions || []) {
    const grp = (sess.sessionGroup || '').trim();
    if (!grp) continue;
    // Skip main shared theory matching mainSection (e.g. "TEORÍA 2" inside main section "2")
    const isMainSharedTheory =
      /^TEOR[IÍ]A\s+/i.test(grp) &&
      grp.replace(/^TEOR[IÍ]A\s+/i, '').trim() === base.mainSection;
    if (!isMainSharedTheory && !distinctGroups.includes(grp)) {
      distinctGroups.push(grp);
    }
  }

  if (distinctGroups.length === 1) {
    const inferred = parseSectionHierarchy(`${base.mainSection} (${distinctGroups[0]})`);
    return {
      ...inferred,
      raw: base.raw,
    };
  }

  const paddedMain = formatPaddedMain(base.mainSection);
  if (distinctGroups.length > 1) {
    const first = distinctGroups[0];
    const { kindShort, codePrefix } = getKindPrefixAndShort(first);
    const nums = distinctGroups
      .map(g => g.match(/(\d+)\s*$/)?.[1])
      .filter((n): n is string => Boolean(n));
    const numSummary = nums.length > 0 ? nums.join('/') : String(distinctGroups.length);
    const firstNum = nums[0] || '';
    const subsectionCode = firstNum ? `${codePrefix}${firstNum}+` : `${codePrefix}+`;
    const subsectionPillLabel = `${kindShort} ${numSummary}`;

    return {
      raw: base.raw,
      mainSection: base.mainSection,
      hasSubsection: true,
      subsectionRaw: distinctGroups.join(' / '),
      subsectionKindShort: kindShort,
      subsectionNum: numSummary,
      subsectionCode,
      subsectionPillLabel,
      compactTicketCode: `${paddedMain}·${subsectionCode}`,
      compactBadgeLabel: `Sec. ${base.mainSection} · ${subsectionPillLabel}`,
      sidebarCompactCode: `Sec ${base.mainSection} · ${subsectionCode}`,
    };
  }

  return {
    raw: base.raw,
    mainSection: base.mainSection,
    hasSubsection: true,
    subsectionRaw: 'General',
    subsectionKindShort: 'Base',
    subsectionNum: null,
    subsectionCode: 'Base',
    subsectionPillLabel: 'Base',
    compactTicketCode: `${paddedMain}·Base`,
    compactBadgeLabel: `Sec. ${base.mainSection} · Base`,
    sidebarCompactCode: `Sec ${base.mainSection} · Base`,
  };
}

/**
 * Groups course sections by main section number and classifies the course hierarchy structure.
 */
export function buildSectionHierarchyGroups<T extends SectionWithSessionsLike>(
  sections: T[]
): CourseSectionStructure<T> {
  const map = new Map<string, T[]>();

  for (const sec of sections) {
    const { mainSection } = parseSectionHierarchy(sec.sectionNumber);
    const list = map.get(mainSection);
    if (list) {
      list.push(sec);
    } else {
      map.set(mainSection, [sec]);
    }
  }

  const groups: SectionHierarchyGroup<T>[] = Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .map(([mainSection, subsections]) => {
      const hasSubsections =
        subsections.length > 1 ||
        subsections.some(s => parseSectionHierarchy(s.sectionNumber).hasSubsection);

      const sortedSubs = [...subsections].sort((a, b) => {
        const labelA = resolveSectionHierarchy(a, hasSubsections).subsectionPillLabel;
        const labelB = resolveSectionHierarchy(b, hasSubsections).subsectionPillLabel;
        return labelA.localeCompare(labelB, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      });

      return {
        mainSection,
        subsections: sortedSubs,
        hasSubsections,
      };
    });

  const anySubsections = groups.some(g => g.hasSubsections);
  const kind: CourseSectionStructureKind = !anySubsections
    ? 'flat'
    : groups.length === 1
      ? 'single-main-subsections'
      : 'multi-main-subsections';

  return { kind, groups };
}

/**
 * Extracts sessions shared identically across all subsections of a main section group
 * (e.g. shared TEORÍA 1 across Lab 11..Lab 17).
 */
export function extractSharedGroupSessions<
  TSec extends {
    sessions: Array<{
      day: string;
      startTime: string;
      endTime: string;
      sessionGroup: string;
    }>;
  }
>(subsections: TSec[]): TSec['sessions'][number][] {
  if (subsections.length <= 1) return [];
  const firstSessions = subsections[0]?.sessions || [];
  return firstSessions.filter(sess0 =>
    subsections.every(sub =>
      sub.sessions.some(
        s =>
          s.day === sess0.day &&
          s.startTime === sess0.startTime &&
          s.endTime === sess0.endTime &&
          s.sessionGroup === sess0.sessionGroup
      )
    )
  ) as TSec['sessions'][number][];
}

/**
 * Formats display tokens when a session is shared/merged across multiple sections or subsections.
 */
export function formatMergedSectionsDisplay(sectionNumbers: string[]): {
  ticketCode: string;
  badgeCode: string;
  badgeLabel: string;
  isSingleMainGroup: boolean;
  mainSection: string;
} {
  const firstParsed = parseSectionHierarchy(sectionNumbers[0] || '');
  const uniqueMains = Array.from(
    new Set(sectionNumbers.map(s => parseSectionHierarchy(s).mainSection))
  );

  if (uniqueMains.length === 1) {
    const main = uniqueMains[0];
    const padded = formatPaddedMain(main);
    const secPad = /^\d+$/.test(main) ? main.padStart(2, '0') : main;
    return {
      ticketCode: `${padded}·${sectionNumbers.length}s`,
      badgeCode: `SEC ${secPad} · ${sectionNumbers.length} SUBS`,
      badgeLabel: `Sec. ${main} · ${sectionNumbers.length} subsecs`,
      isSingleMainGroup: true,
      mainSection: main,
    };
  }

  const firstPadded = formatPaddedMain(firstParsed.mainSection);
  const firstSecPad = /^\d+$/.test(firstParsed.mainSection)
    ? firstParsed.mainSection.padStart(2, '0')
    : firstParsed.mainSection;

  return {
    ticketCode: `${firstPadded}+${sectionNumbers.length - 1}`,
    badgeCode: `SEC ${firstSecPad}+${sectionNumbers.length - 1}`,
    badgeLabel: `${sectionNumbers.length} secciones`,
    isSingleMainGroup: false,
    mainSection: firstParsed.mainSection,
  };
}

/**
 * Matches section filter values including 'ALL', main-section prefix 'MAIN:1', or exact subsection names.
 */
export function matchesSectionFilter(sectionNumber: string, filterValue?: string): boolean {
  if (!filterValue || filterValue === 'ALL') return true;
  if (filterValue.startsWith('MAIN:')) {
    const targetMain = filterValue.slice(5);
    return parseSectionHierarchy(sectionNumber).mainSection === targetMain;
  }
  return sectionNumber === filterValue;
}
