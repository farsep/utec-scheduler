import type { DayOfWeek, SessionType, Course, Section, Session } from '../types/schedule';
import type {
  CourseExtendedInfo,
  CourseExtendedSection,
  CourseExtendedSession,
  CourseFilterState,
  VisitorCourseItem
} from '../types/courseDirectory';
import type { ClassroomInfo } from '../types/classroom';
import { ALL_DAYS, parseLocationInfo, DAY_LABELS } from './classroomUtils';
import { getDepartmentFromCourseCode, formatProfessorName } from './professorUtils';
import { minutesToTime, normalizeString, getCourseColor, parseSessionType } from './scheduleUtils';

const VISITOR_STORAGE_KEY = 'matriculab_visitor_courses_v1';

/**
 * Transforms raw courses into deeply indexed and statistics-rich CourseExtendedInfo items
 */
export function processRawCoursesIntoDirectory(courses: Course[]): CourseExtendedInfo[] {
  return courses.map(course => {
    const deptInfo = getDepartmentFromCourseCode(course.code);

    let totalVacancies = 0;
    let totalEnrolled = 0;
    let totalSessionsCount = 0;
    const modalitiesSet = new Set<string>();
    const daysSet = new Set<DayOfWeek>();
    const professorsMap = new Map<string, string>(); // name -> email
    const roomsSet = new Set<string>();

    const extendedSections: CourseExtendedSection[] = course.sections.map(section => {
      let secHours = 0;
      const secModalities = new Set<string>();
      const secDays = new Set<DayOfWeek>();
      const secRooms = new Set<string>();

      const extendedSessions: CourseExtendedSession[] = (section.sessions || []).map(sess => {
        totalSessionsCount++;
        const durationHours = Math.max(0.5, (sess.endMinutes - sess.startMinutes) / 60);
        secHours += durationHours;

        if (sess.modality) {
          modalitiesSet.add(sess.modality);
          secModalities.add(sess.modality);
        }

        if (sess.day) {
          daysSet.add(sess.day);
          secDays.add(sess.day);
        }

        const loc = sess.location ? sess.location.trim() : '';
        const parsedLoc = parseLocationInfo(loc);
        const roomCode = parsedLoc ? parsedLoc.code : (loc || 'Por asignar');
        const roomDisplayName = parsedLoc ? parsedLoc.displayName : (loc || 'Por definir');
        const floor = parsedLoc ? parsedLoc.floor : 1;

        if (loc && !loc.toLowerCase().includes('virtual')) {
          roomsSet.add(roomDisplayName);
          secRooms.add(roomDisplayName);
        }

        if (sess.professor && !/docente\s*utec/i.test(sess.professor)) {
          const profFmt = formatProfessorName(sess.professor);
          if (!professorsMap.has(profFmt.displayName)) {
            professorsMap.set(profFmt.displayName, sess.email || '');
          }
        }

        return {
          ...sess,
          durationHours,
          roomCode,
          roomDisplayName,
          floor
        };
      });

      totalVacancies += section.vacancies || 0;
      totalEnrolled += section.enrolled || 0;

      return {
        ...section,
        sessions: extendedSessions,
        totalWeeklyHours: Math.round(secHours * 10) / 10,
        modalities: Array.from(secModalities),
        daysTaught: Array.from(secDays),
        rooms: Array.from(secRooms)
      };
    });

    // Total weekly hours of the course: calculated as the average or representative hours across sections
    const totalWeeklyHours = extendedSections.length > 0
      ? Math.max(...extendedSections.map(s => s.totalWeeklyHours))
      : 0;

    const uniqueProfessors = Array.from(professorsMap.entries()).map(([name, email]) => ({
      name,
      email
    }));

    // Sort days by standard calendar order
    const sortedDays = ALL_DAYS.filter(d => daysSet.has(d));

    return {
      ...course,
      department: deptInfo.code,
      departmentLabel: deptInfo.label,
      departmentColor: deptInfo.color,
      extendedSections,
      totalSectionsCount: course.sections.length,
      totalSessionsCount,
      totalVacancies,
      totalEnrolled,
      totalWeeklyHours,
      modalities: Array.from(modalitiesSet),
      daysTaught: sortedDays,
      uniqueProfessors,
      uniqueRooms: Array.from(roomsSet).sort()
    };
  });
}

/**
 * Checks if a course is currently being taught in any section/classroom right now,
 * and finds the next upcoming session.
 */
export function evaluateCourseLiveStatus(
  course: CourseExtendedInfo,
  nowDay: DayOfWeek,
  nowMinutes: number
): {
  isCurrentlyLive: boolean;
  liveSession?: CourseExtendedInfo['liveSession'];
  nextSession?: CourseExtendedInfo['nextSession'];
  minutesUntilNext?: number;
} {
  // Collect all sessions across all sections
  const allSessions: Array<{
    sectionNumber: string;
    session: CourseExtendedSession;
  }> = [];

  course.extendedSections.forEach(sec => {
    sec.sessions.forEach(sess => {
      allSessions.push({
        sectionNumber: sec.sectionNumber,
        session: sess
      });
    });
  });

  // 1. Check if any session is live RIGHT NOW
  const currentLive = allSessions.find(
    item =>
      item.session.day === nowDay &&
      nowMinutes >= item.session.startMinutes &&
      nowMinutes < item.session.endMinutes
  );

  if (currentLive) {
    const s = currentLive.session;
    return {
      isCurrentlyLive: true,
      liveSession: {
        sectionNumber: currentLive.sectionNumber,
        sessionGroup: s.sessionGroup,
        sessionType: s.sessionType,
        room: s.roomDisplayName,
        roomCode: s.roomCode,
        professor: s.professor ? formatProfessorName(s.professor).displayName : 'Docente UTEC',
        email: s.email,
        startTime: s.startTime,
        endTime: s.endTime,
        startMinutes: s.startMinutes,
        endMinutes: s.endMinutes
      }
    };
  }

  // 2. Next session today later in the day
  const nextToday = allSessions
    .filter(item => item.session.day === nowDay && item.session.startMinutes > nowMinutes)
    .sort((a, b) => a.session.startMinutes - b.session.startMinutes)[0];

  if (nextToday) {
    const s = nextToday.session;
    return {
      isCurrentlyLive: false,
      nextSession: {
        day: nowDay,
        startTime: s.startTime,
        endTime: s.endTime,
        startMinutes: s.startMinutes,
        endMinutes: s.endMinutes,
        room: s.roomDisplayName,
        sectionNumber: nextToday.sectionNumber,
        sessionType: s.sessionType,
        professor: s.professor ? formatProfessorName(s.professor).displayName : 'Docente UTEC',
        email: s.email
      },
      minutesUntilNext: s.startMinutes - nowMinutes
    };
  }

  // 3. Next session on upcoming days of the week
  const currentDayIndex = ALL_DAYS.indexOf(nowDay);
  for (let offset = 1; offset < ALL_DAYS.length; offset++) {
    const targetDay = ALL_DAYS[(currentDayIndex + offset) % ALL_DAYS.length];
    const targetSessions = allSessions
      .filter(item => item.session.day === targetDay)
      .sort((a, b) => a.session.startMinutes - b.session.startMinutes);

    if (targetSessions.length > 0) {
      const first = targetSessions[0];
      const s = first.session;
      return {
        isCurrentlyLive: false,
        nextSession: {
          day: targetDay,
          startTime: s.startTime,
          endTime: s.endTime,
          startMinutes: s.startMinutes,
          endMinutes: s.endMinutes,
          room: s.roomDisplayName,
          sectionNumber: first.sectionNumber,
          sessionType: s.sessionType,
          professor: s.professor ? formatProfessorName(s.professor).displayName : 'Docente UTEC',
          email: s.email
        }
      };
    }
  }

  return { isCurrentlyLive: false };
}

/**
 * Cross-references courses between Scraped Intranet Data and Master Excel Catalog.
 * Scraping data is the source of truth for physical classrooms, real teachers, and active semester schedules.
 * Excel complements with institutional emails, official course descriptions, and virtual/remote lectures.
 * Merges courses bidirectionally so neither virtual classes (like Álgebra Lineal) nor scraping-only classes are omitted.
 */
export function mutuallyEnrichCoursesWithScrapedData(
  excelCourses: Course[],
  intranetClassrooms: ClassroomInfo[]
): Course[] {
  if (!intranetClassrooms || intranetClassrooms.length === 0) {
    return excelCourses;
  }

  // 1. Build Global Professor Email Lookup from Excel
  const profEmailMap = new Map<string, string>();
  for (const c of excelCourses) {
    for (const s of c.sections) {
      for (const sess of s.sessions) {
        if (sess.professor && sess.email) {
          const rawP = sess.professor.trim().toLowerCase();
          const cleanP = normalizeString(rawP);
          if (!profEmailMap.has(cleanP)) profEmailMap.set(cleanP, sess.email.trim());
          const commaParts = sess.professor.split(',');
          if (commaParts.length === 2) {
            const natural = normalizeString(`${commaParts[1].trim()} ${commaParts[0].trim()}`);
            if (!profEmailMap.has(natural)) profEmailMap.set(natural, sess.email.trim());
          }
        }
      }
    }
  }

  // Helper to find email for a professor name
  const findProfEmail = (profName?: string): string => {
    if (!profName) return '';
    const clean = normalizeString(profName);
    if (profEmailMap.has(clean)) return profEmailMap.get(clean)!;
    // Check by words/surname
    const words = clean.split(' ').filter(w => w.length > 2);
    for (const [key, email] of profEmailMap.entries()) {
      if (words.some(w => key.includes(w))) {
        return email;
      }
    }
    return '';
  };

  // 2. Index Scraped Sessions
  interface ScrapedItem {
    id: string;
    courseCode: string;
    courseName: string;
    sectionNumber: string;
    sessionGroup: string;
    sessionType: SessionType;
    day: DayOfWeek;
    startTime: string;
    endTime: string;
    startMinutes: number;
    endMinutes: number;
    professor: string;
    email: string;
    roomCode: string;
    roomDisplayName: string;
    floor: number;
    used: boolean;
  }

  const scrapedItems: ScrapedItem[] = [];
  const scrapedBySecKey = new Map<string, ScrapedItem[]>();
  const scrapedByDayKey = new Map<string, ScrapedItem[]>();
  const scrapedByCourseSec = new Map<string, ScrapedItem[]>();
  const scrapedByCourse = new Map<string, ScrapedItem[]>();

  for (const room of intranetClassrooms) {
    for (const day of ALL_DAYS) {
      const daySessions = room.sessionsByDay?.[day] || [];
      for (const s of daySessions) {
        if (!s.courseCode || s.courseCode === 'RESERVA' || s.courseCode === 'ACTIVIDAD') continue;
        const cCode = s.courseCode.toUpperCase().trim();
        const secNorm = String(parseInt(s.sectionNumber, 10) || s.sectionNumber).trim();
        const roomDisplayName = room.displayName || room.code;

        let profEmail = s.email || '';
        if (!profEmail && s.professor) {
          profEmail = findProfEmail(s.professor);
        }

        const rawGrp = String(s.sessionGroup || secNorm).trim();
        const grpDigits = (rawGrp.match(/\d+/) || [secNorm])[0];
        let inferredType: SessionType = 'Teoría';
        if (/lab|prac|prác|tall/i.test(rawGrp)) {
          inferredType = parseSessionType(rawGrp);
        } else if (/teo/i.test(rawGrp)) {
          inferredType = 'Teoría';
        } else if (room.type === 'laboratorio' || (grpDigits.length >= 2 && Number(grpDigits) >= 11 && grpDigits !== secNorm)) {
          inferredType = 'Laboratorio';
        }
        const formattedGroup = /^(TEOR|LAB|PRAC|PRÁC|TALL)/i.test(rawGrp)
          ? rawGrp
          : `${inferredType === 'Laboratorio' ? 'LABORATORIO' : 'TEORÍA'} ${grpDigits}`;

        const item: ScrapedItem = {
          id: `${room.code}-${cCode}-${secNorm}-${day}-${s.startMinutes}`,
          courseCode: cCode,
          courseName: s.courseName || cCode,
          sectionNumber: secNorm,
          sessionGroup: formattedGroup,
          sessionType: inferredType,
          day,
          startTime: s.startTime,
          endTime: s.endTime,
          startMinutes: s.startMinutes,
          endMinutes: s.endMinutes,
          professor: s.professor || 'Docente UTEC',
          email: profEmail,
          roomCode: room.code,
          roomDisplayName,
          floor: room.floor || 1,
          used: false
        };

        scrapedItems.push(item);

        const secKey = `${cCode}::${secNorm}::${day}`;
        if (!scrapedBySecKey.has(secKey)) scrapedBySecKey.set(secKey, []);
        scrapedBySecKey.get(secKey)!.push(item);

        const dayKey = `${cCode}::${day}`;
        if (!scrapedByDayKey.has(dayKey)) scrapedByDayKey.set(dayKey, []);
        scrapedByDayKey.get(dayKey)!.push(item);

        const courseSecKey = `${cCode}::${secNorm}`;
        if (!scrapedByCourseSec.has(courseSecKey)) scrapedByCourseSec.set(courseSecKey, []);
        scrapedByCourseSec.get(courseSecKey)!.push(item);

        if (!scrapedByCourse.has(cCode)) scrapedByCourse.set(cCode, []);
        scrapedByCourse.get(cCode)!.push(item);
      }
    }
  }

  // 3. Mutually Enrich existing Excel courses
  // Physical sessions from Excel that DO NOT exist in scraping were canceled due to low enrollment.
  // We intentionally filter them out so students only see confirmed, active courses and rooms.
  const enrichedCourses: Course[] = [];

  for (const course of excelCourses) {
    const cCode = course.code.toUpperCase().trim();

    const validSections: Section[] = [];
    // Collect all explicit subgroup numbers defined across sub-sections of this course
    const explicitSubgroups = new Set<string>();
    for (const sec of course.sections) {
      const parenMatch = sec.sectionNumber.match(/\(([^)]+)\)/);
      if (parenMatch) {
        const gNum = (parenMatch[1].match(/\d+/) || [''])[0];
        if (gNum) explicitSubgroups.add(`${String(parseInt(sec.sectionNumber, 10))}::${gNum}`);
      }
    }

    for (const section of course.sections) {
      const baseSec = String(parseInt(section.sectionNumber, 10) || section.sectionNumber.split(' ')[0]).trim();
      const parenMatch = section.sectionNumber.match(/\(([^)]+)\)/);
      const requiredSubgroupLabel = parenMatch ? parenMatch[1].trim().toUpperCase() : null;
      const enrichedSessions: Session[] = [];
      let hadPhysicalPlanned = false;
      let activePhysicalCount = 0;

      for (const session of section.sessions) {
        const isVirtual = /virt|online|sincron|asincron/i.test(session.location) ||
                          /virt|online|sincron|asincron/i.test(session.modality);
        if (!isVirtual) {
          hadPhysicalPlanned = true;
        }

        const secKey = `${cCode}::${baseSec}::${session.day}`;
        const dayKey = `${cCode}::${session.day}`;

        const secCandidates = scrapedBySecKey.get(secKey) || [];
        // Only fall back to cross-section dayKey candidates if the Excel session shares the EXACT same physical room and time
        // (combined multi-section labs where UTEC's calendar only displays one section's label)
        const crossSecCandidates = secCandidates.length > 0
          ? []
          : (scrapedByDayKey.get(dayKey) || []).filter(cand =>
              session.startMinutes === cand.startMinutes &&
              session.endMinutes === cand.endMinutes &&
              Boolean(session.location && (session.location.includes(cand.roomCode) || cand.roomDisplayName.includes(session.location)))
            );

        const candidates = secCandidates.length > 0 ? secCandidates : crossSecCandidates;

        // Score candidates to find the most accurate matching session
        let bestMatch: ScrapedItem | null = null;
        let bestScore = -1;

        for (const cand of candidates) {
          const overlap = Math.max(0, Math.min(session.endMinutes, cand.endMinutes) - Math.max(session.startMinutes, cand.startMinutes));
          if (overlap < 30 && session.startMinutes !== cand.startMinutes && session.endMinutes !== cand.endMinutes) {
            continue;
          }

          let score = 0;
          if (cand.sectionNumber === baseSec) score += 10;
          if (!cand.used) score += 5;

          const sGrpNum = (session.sessionGroup.match(/\d+/) || [''])[0];
          const cGrpNum = (cand.sessionGroup.match(/\d+/) || [''])[0];
          if (sGrpNum && cGrpNum && sGrpNum === cGrpNum) score += 8;

          // Check professor compatibility
          if (session.professor && cand.professor) {
            const pNorm1 = normalizeString(session.professor);
            const pNorm2 = normalizeString(cand.professor);
            if (pNorm1 === pNorm2 || pNorm1.includes(pNorm2) || pNorm2.includes(pNorm1)) {
              score += 15;
            }
          }

          // Check room compatibility if Excel had a room string
          if (session.location && (session.location.includes(cand.roomCode) || cand.roomDisplayName.includes(session.location))) {
            score += 10;
          }

          // Exact time match bonus
          if (session.startMinutes === cand.startMinutes && session.endMinutes === cand.endMinutes) {
            score += 8;
          }

          if (score > bestScore) {
            bestScore = score;
            bestMatch = cand;
          }
        }

        // If no same-day candidate matched, check if this session was rescheduled to another day/time in the Intranet
        if (!bestMatch && !isVirtual) {
          const sGrpNum = (session.sessionGroup.match(/\d+/) || [''])[0];
          const allSecItems = scrapedByCourseSec.get(`${cCode}::${baseSec}`) || [];
          const rescheduledCand = allSecItems.find(cand => {
            if (cand.used) return false;
            const cGrpNum = (cand.sessionGroup.match(/\d+/) || [''])[0];
            if (sGrpNum && cGrpNum && sGrpNum !== cGrpNum) return false;
            // Make sure this candidate won't directly match another planned session of this section on cand.day
            const hasDirectSibling = section.sessions.some(other =>
              other !== session &&
              other.day === cand.day &&
              Math.max(0, Math.min(other.endMinutes, cand.endMinutes) - Math.max(other.startMinutes, cand.startMinutes)) >= 30
            );
            return !hasDirectSibling;
          });
          if (rescheduledCand) {
            bestMatch = rescheduledCand;
          }
        }

        if (bestMatch) {
          bestMatch.used = true;
          activePhysicalCount++;

          // SCRAPING IS THE SOURCE OF TRUTH:
          // Use verified physical classroom, day, time, and teacher from scraping
          const targetLocation = bestMatch.roomDisplayName || bestMatch.roomCode;
          const targetProf = bestMatch.professor && !/docente\s*utec/i.test(bestMatch.professor)
            ? bestMatch.professor
            : (session.professor || bestMatch.professor || 'Docente UTEC');

          const targetEmail = session.email || bestMatch.email || findProfEmail(targetProf);

          enrichedSessions.push({
            ...session,
            day: bestMatch.day,
            startTime: bestMatch.startTime,
            endTime: bestMatch.endTime,
            startMinutes: bestMatch.startMinutes,
            endMinutes: bestMatch.endMinutes,
            modality: 'Presencial',
            location: targetLocation,
            professor: targetProf,
            email: targetEmail
          });
        } else if (isVirtual || /\b(L301|L203)\b/i.test(session.location)) {
          // Virtual sessions (UTEC-BA Virtual / online) and non-reservable specialized labs (L301, L203)
          // are not in /filtro/aula/reservable, so preserve them when their section is active
          if (/\b(L301|L203)\b/i.test(session.location)) {
            activePhysicalCount++;
          }
          const targetEmail = session.email || findProfEmail(session.professor);
          const parsedLoc = parseLocationInfo(session.location);
          enrichedSessions.push({
            ...session,
            location: parsedLoc ? parsedLoc.displayName : session.location,
            email: targetEmail
          });
        } else {
          // CANCELED PHYSICAL SESSION:
          // The session was scheduled in Excel for a physical classroom, but no classroom in UTEC's intranet scraping has it.
          // It was canceled due to lack of enrollment. We intentionally remove it.
        }
      }

      // Append any extra active Intranet sessions for this section that were added in the Intranet
      const remainingSecItems = (scrapedByCourseSec.get(`${cCode}::${baseSec}`) || []).filter(cand => {
        if (cand.used) return false;
        const cGrpNum = (cand.sessionGroup.match(/\d+/) || [''])[0];
        if (requiredSubgroupLabel) {
          const reqGrpNum = (requiredSubgroupLabel.match(/\d+/) || [''])[0];
          // Include if it matches this sub-section's group or the shared theory group (baseSec)
          return cGrpNum === reqGrpNum || cGrpNum === baseSec;
        }
        return true;
      });

      for (const extra of remainingSecItems) {
        const alreadyInSection = enrichedSessions.some(s =>
          s.day === extra.day &&
          s.startMinutes === extra.startMinutes &&
          s.endMinutes === extra.endMinutes &&
          s.location === extra.roomDisplayName
        );
        if (!alreadyInSection) {
          extra.used = true;
          activePhysicalCount++;
          enrichedSessions.push({
            id: `${cCode}-${section.sectionNumber}-${extra.day}-${extra.startMinutes}-${extra.roomCode}-extra`,
            sessionGroup: extra.sessionGroup,
            sessionType: extra.sessionType,
            modality: 'Presencial',
            day: extra.day,
            startTime: extra.startTime,
            endTime: extra.endTime,
            startMinutes: extra.startMinutes,
            endMinutes: extra.endMinutes,
            frequency: 'Semana General',
            location: extra.roomDisplayName,
            vacancies: section.vacancies || 0,
            enrolled: section.enrolled || 0,
            professor: extra.professor,
            email: extra.email
          });
        }
      }

      // If this section is a subgroup variant (e.g. "1 (LABORATORIO 12)" or "1 (TEORÍA 12)"),
      // verify that the defining subgroup session actually survived (unless it was in non-reservable L301/L203)
      if (requiredSubgroupLabel) {
        const hadNonReservableRoom = section.sessions.some(s =>
          s.sessionGroup.trim().toUpperCase() === requiredSubgroupLabel &&
          /\b(L301|L203)\b/i.test(s.location)
        );
        const subgroupSurvived = enrichedSessions.some(s =>
          s.sessionGroup.trim().toUpperCase() === requiredSubgroupLabel
        );
        if (!subgroupSurvived && !hadNonReservableRoom) {
          continue;
        }
      }

      // If this section originally had physical classes planned, but ALL of them were canceled,
      // the section itself was canceled by UTEC. Drop any orphaned virtual sessions.
      if (hadPhysicalPlanned && activePhysicalCount === 0) {
        continue;
      }

      if (enrichedSessions.length === 0) {
        continue;
      }

      validSections.push({
        ...section,
        sessions: enrichedSessions,
        professors: Array.from(new Set(enrichedSessions.map(s => s.professor).filter(Boolean)))
      });
    }

    // Also incorporate any newly opened sections in the Intranet for this existing Excel course
    const unusedCourseItems = (scrapedByCourse.get(cCode) || []).filter(it => !it.used);
    if (unusedCourseItems.length > 0) {
      const newSecMap = new Map<string, ScrapedItem[]>();
      for (const it of unusedCourseItems) {
        it.used = true;
        if (!newSecMap.has(it.sectionNumber)) newSecMap.set(it.sectionNumber, []);
        newSecMap.get(it.sectionNumber)!.push(it);
      }
      for (const [secNum, secItems] of newSecMap.entries()) {
        const sessions: Session[] = secItems.map((it, idx) => ({
          id: `${cCode}-${secNum}-${it.day}-${it.startMinutes}-${idx}`,
          sessionGroup: it.sessionGroup,
          sessionType: it.sessionType,
          modality: 'Presencial',
          day: it.day,
          startTime: it.startTime,
          endTime: it.endTime,
          startMinutes: it.startMinutes,
          endMinutes: it.endMinutes,
          frequency: 'Semana General',
          location: it.roomDisplayName,
          vacancies: 0,
          enrolled: 0,
          professor: it.professor,
          email: it.email
        }));
        validSections.push({
          sectionNumber: secNum,
          sessions,
          vacancies: 0,
          enrolled: 0,
          professors: Array.from(new Set(secItems.map(i => i.professor).filter(Boolean)))
        });
      }
    }

    if (validSections.length === 0) {
      // Entire course canceled due to lack of enrollment
      continue;
    }

    enrichedCourses.push({
      ...course,
      sections: validSections
    });
  }

  // 4. Incorporate courses present in Scraping that were NOT in Excel
  const excelCodeSet = new Set(excelCourses.map(c => c.code.toUpperCase().trim()));
  const scrapingOnlyCoursesMap = new Map<string, ScrapedItem[]>();

  for (const item of scrapedItems) {
    if (!excelCodeSet.has(item.courseCode)) {
      if (!scrapingOnlyCoursesMap.has(item.courseCode)) {
        scrapingOnlyCoursesMap.set(item.courseCode, []);
      }
      scrapingOnlyCoursesMap.get(item.courseCode)!.push(item);
    }
  }

  for (const [newCode, items] of scrapingOnlyCoursesMap.entries()) {
    const courseName = items[0]?.courseName || newCode;
    const secMap = new Map<string, ScrapedItem[]>();

    for (const it of items) {
      if (!secMap.has(it.sectionNumber)) secMap.set(it.sectionNumber, []);
      secMap.get(it.sectionNumber)!.push(it);
    }

    const sections: Section[] = [];
    for (const [secNum, secItems] of secMap.entries()) {
      const sessions: Session[] = secItems.map((it, idx) => ({
        id: `${newCode}-${secNum}-${it.day}-${it.startMinutes}-${idx}`,
        sessionGroup: it.sessionGroup,
        sessionType: it.sessionType,
        modality: 'Presencial',
        day: it.day,
        startTime: it.startTime,
        endTime: it.endTime,
        startMinutes: it.startMinutes,
        endMinutes: it.endMinutes,
        frequency: 'Semana General',
        location: it.roomDisplayName,
        vacancies: 0,
        enrolled: 0,
        professor: it.professor,
        email: it.email
      }));

      sections.push({
        sectionNumber: secNum,
        sessions,
        vacancies: 0,
        enrolled: 0,
        professors: Array.from(new Set(secItems.map(i => i.professor).filter(Boolean)))
      });
    }

    enrichedCourses.push({
      code: newCode,
      name: courseName,
      sections,
      color: getCourseColor(newCode)
    });
  }

  return enrichedCourses;
}

/**
 * Filters and sorts courses according to search query, filters and visitor selection
 */
export function filterAndSortCourses(
  courses: CourseExtendedInfo[],
  filter: CourseFilterState,
  nowDay: DayOfWeek,
  nowMinutes: number,
  visitorCourseCodes: Set<string>
): CourseExtendedInfo[] {
  const normQuery = normalizeString(filter.searchQuery);

  return courses
    .filter(course => {
      // 1. Accent-insensitive and diacritic-insensitive search across code, name, professors, and classrooms
      if (normQuery) {
        const matchesCode = normalizeString(course.code).includes(normQuery);
        const matchesName = normalizeString(course.name).includes(normQuery);
        const matchesProf = course.uniqueProfessors.some(p =>
          normalizeString(p.name).includes(normQuery) || normalizeString(p.email).includes(normQuery)
        );
        const matchesRoom = course.uniqueRooms.some(r => normalizeString(r).includes(normQuery));

        if (!matchesCode && !matchesName && !matchesProf && !matchesRoom) {
          return false;
        }
      }

      // 2. Department filter
      if (filter.selectedDepartment !== 'ALL') {
        if (course.department !== filter.selectedDepartment) {
          return false;
        }
      }

      // 3. Day filter
      if (filter.selectedDay !== 'ALL') {
        if (!course.daysTaught.includes(filter.selectedDay)) {
          return false;
        }
      }

      // 4. Modality filter
      if (filter.selectedModality !== 'ALL') {
        if (!course.modalities.includes(filter.selectedModality)) {
          return false;
        }
      }

      // 5. Visitor filter (Only saved visitor courses)
      if (filter.onlyVisitor) {
        if (!visitorCourseCodes.has(course.code)) {
          return false;
        }
      }

      // 6. Live Now filter
      if (filter.onlyLiveNow) {
        const { isCurrentlyLive } = evaluateCourseLiveStatus(course, nowDay, nowMinutes);
        if (!isCurrentlyLive) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      switch (filter.sortBy) {
        case 'code_asc':
          return a.code.localeCompare(b.code);
        case 'code_desc':
          return b.code.localeCompare(a.code);
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'sections_desc':
          return b.totalSectionsCount - a.totalSectionsCount;
        case 'hours_desc':
          return b.totalWeeklyHours - a.totalWeeklyHours;
        default:
          return a.code.localeCompare(b.code);
      }
    });
}

/**
 * Visitor Courses LocalStorage Helpers
 */
export function getSavedVisitorCourses(): VisitorCourseItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(VISITOR_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading visitor courses from localStorage:', e);
    return [];
  }
}

export function saveVisitorCourses(items: VisitorCourseItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VISITOR_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('matriculab:visitor-updated', { detail: items }));
  } catch (e) {
    console.error('Error saving visitor courses to localStorage:', e);
  }
}

export function toggleVisitorCourseInStorage(
  course: CourseExtendedInfo,
  sectionNumber: string = 'ALL'
): { updatedItems: VisitorCourseItem[]; isAdded: boolean } {
  const current = getSavedVisitorCourses();
  const index = current.findIndex(c => c.courseCode === course.code);

  let updated: VisitorCourseItem[];
  let isAdded = false;

  if (index >= 0) {
    // Remove if already saved
    updated = current.filter(c => c.courseCode !== course.code);
    isAdded = false;
  } else {
    // Add new visitor course
    const newItem: VisitorCourseItem = {
      courseCode: course.code,
      courseName: course.name,
      department: course.departmentLabel,
      color: course.color,
      selectedSection: sectionNumber,
      addedAt: Date.now()
    };
    updated = [newItem, ...current];
    isAdded = true;
  }

  saveVisitorCourses(updated);
  return { updatedItems: updated, isAdded };
}

/**
 * Pre-fills an academic, polite request email for UTEC students to audit / visit a course
 */
export function generateVisitorEmailTemplate(params: {
  courseCode: string;
  courseName: string;
  sectionNumber?: string;
  professorName?: string;
  professorEmail?: string;
  studentName?: string;
  studentMajor?: string;
  scheduleSummary?: string;
}): { subject: string; body: string; mailtoUrl: string } {
  const profSalutation = params.professorName ? `Prof. ${params.professorName}` : 'Estimado(a) Docente';
  const secText = params.sectionNumber ? ` (Sección ${params.sectionNumber})` : '';
  const stuName = params.studentName || '[Tu Nombre Completo]';
  const stuMajor = params.studentMajor || '[Tu Carrera]';

  const subject = `[Solicitud Oyente / Visitante] ${params.courseCode} - ${params.courseName}${secText}`;

  const body = `Estimado(a) ${profSalutation},

Espero que se encuentre muy bien.

Mi nombre es ${stuName}, estudiante de ${stuMajor} en UTEC. Me comunico con el debido respeto porque tengo un gran interés académico y profesional en su curso de "${params.courseName}" (${params.courseCode})${secText}${params.scheduleSummary ? ` [${params.scheduleSummary}]` : ''}.

Le escribo para consultarle cordialmente si tendría inconveniente en que asista a sus clases en calidad de visitante (oyente) durante este ciclo académico.

Me comprometo formalmente a:
- Asistir con total puntualidad y discreción.
- No interferir con la dinámica de la sesión ni con las evaluaciones de los alumnos matriculados.
- Ocupar asientos disponibles sin comprometer el aforo reglamentario del aula.

Agradezco de antemano su valioso tiempo y consideración a mi solicitud. Quedo atento a su respuesta.

Atentamente,
${stuName}
Estudiante UTEC`;

  const to = params.professorEmail || '';
  const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return { subject, body, mailtoUrl };
}

/**
 * Generates Google Calendar Event Creation URL for a course session
 */
export function generateGoogleCalendarUrlForSession(
  session: CourseExtendedSession,
  courseName: string,
  courseCode: string,
  sectionNumber: string
): string {
  const title = `[Oyente] ${courseCode} - ${courseName} (Sec. ${sectionNumber})`;
  const location = session.roomDisplayName ? `UTEC - ${session.roomDisplayName}` : 'UTEC';
  const description = `Asistencia como oyente / visitante.\nCurso: ${courseName} (${courseCode})\nSección: ${sectionNumber} - ${session.sessionGroup} (${session.sessionType})\nModalidad: ${session.modality}\nDocente: ${session.professor || 'Docente UTEC'}`;

  // Form Google Calendar recurring or next instance query
  const baseUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  return `${baseUrl}&text=${encodeURIComponent(title)}&location=${encodeURIComponent(location)}&details=${encodeURIComponent(description)}`;
}

/**
 * Generates an .ics file content for downloading visitor course sessions
 */
export function generateIcsForVisitorSessions(
  course: CourseExtendedInfo,
  selectedSectionNumber?: string
): string {
  const sectionsToExport = selectedSectionNumber && selectedSectionNumber !== 'ALL'
    ? course.extendedSections.filter(s => s.sectionNumber === selectedSectionNumber)
    : course.extendedSections;

  let icsEvents = '';

  const dayMapToIcsDay: Record<DayOfWeek, string> = {
    Lun: 'MO',
    Mar: 'TU',
    Mie: 'WE',
    Jue: 'TH',
    Vie: 'FR',
    Sab: 'SA'
  };

  sectionsToExport.forEach(sec => {
    sec.sessions.forEach(sess => {
      const summary = `[Oyente] ${course.code} - ${course.name} (Sec. ${sec.sectionNumber})`;
      const location = sess.roomDisplayName ? `UTEC ${sess.roomDisplayName}` : 'UTEC';
      const description = `Curso como oyente: ${course.name} - ${sess.sessionGroup}. Docente: ${sess.professor || 'Docente UTEC'}`;
      const icsDay = dayMapToIcsDay[sess.day] || 'MO';

      icsEvents += `BEGIN:VEVENT
UID:visitor-${course.code}-${sec.sectionNumber}-${sess.id}-${Date.now()}@matriculab.utec
SUMMARY:${summary}
LOCATION:${location}
DESCRIPTION:${description}
RRULE:FREQ=WEEKLY;BYDAY=${icsDay}
STATUS:CONFIRMED
END:VEVENT\n`;
    });
  });

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//MatricuLAB//Cursos UTEC Visitante//ES
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Cursos Visitante UTEC (${course.code})
${icsEvents}END:VCALENDAR`;
}

// Distinct vibrant section colors for timetables and badges
export const SECTION_PALETTES = [
  { bg: 'rgba(59, 130, 246, 0.22)', border: '#3b82f6', text: '#93c5fd', badge: 'rgba(59, 130, 246, 0.3)' },
  { bg: 'rgba(16, 185, 129, 0.22)', border: '#10b981', text: '#6ee7b7', badge: 'rgba(16, 185, 129, 0.3)' },
  { bg: 'rgba(139, 92, 246, 0.22)', border: '#8b5cf6', text: '#c4b5fd', badge: 'rgba(139, 92, 246, 0.3)' },
  { bg: 'rgba(245, 158, 11, 0.22)', border: '#f59e0b', text: '#fde68a', badge: 'rgba(245, 158, 11, 0.3)' },
  { bg: 'rgba(236, 72, 153, 0.22)', border: '#ec4899', text: '#fbcfe8', badge: 'rgba(236, 72, 153, 0.3)' },
  { bg: 'rgba(6, 182, 212, 0.22)', border: '#06b6d4', text: '#a5f3fc', badge: 'rgba(6, 182, 212, 0.3)' },
  { bg: 'rgba(249, 115, 22, 0.22)', border: '#f97316', text: '#fed7aa', badge: 'rgba(249, 115, 22, 0.3)' },
  { bg: 'rgba(132, 204, 22, 0.22)', border: '#84cc16', text: '#d9f99d', badge: 'rgba(132, 204, 22, 0.3)' }
];

export function getSectionColor(sectionNumber: string): typeof SECTION_PALETTES[0] {
  const num = parseInt(sectionNumber, 10);
  const idx = isNaN(num) ? 0 : Math.max(0, num - 1) % SECTION_PALETTES.length;
  return SECTION_PALETTES[idx];
}

