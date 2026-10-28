import type { CourseExtendedInfo } from '../types/courseDirectory';
import type { ProfessorInfo } from '../types/professor';
import type { Course, MetadataInfo } from '../types/schedule';
import type { ClassroomInfo } from '../types/classroom';
import { parseExcelFile } from './excelParser';
import { processRawCoursesIntoDirectory, mutuallyEnrichCoursesWithScrapedData } from './courseDirectoryUtils';
import { extractProfessorsFromCourses } from './professorUtils';

// Global in-memory cache surviving client-side SPA navigation
declare global {
  interface Window {
    __MATRICULAB_COURSES__?: CourseExtendedInfo[];
    __MATRICULAB_PROFESSORS__?: ProfessorInfo[];
    __MATRICULAB_SAMPLE__?: { courses: Course[]; metadata: MetadataInfo };
    __MATRICULAB_CLASSROOMS__?: ClassroomInfo[];
  }
}

let inMemoryCourses: CourseExtendedInfo[] | null = null;
let inMemoryProfessors: ProfessorInfo[] | null = null;
let inMemorySample: { courses: Course[]; metadata: MetadataInfo } | null = null;
let inMemoryClassrooms: ClassroomInfo[] | null = null;

/**
 * Returns courses synchronously if already present in memory or sessionStorage.
 * Used to avoid any loading flicker or skeleton when mounting components.
 */
export function getSynchronousCachedCourses(): CourseExtendedInfo[] | null {
  if (inMemoryCourses && inMemoryCourses.length > 0) return inMemoryCourses;
  if (typeof window !== 'undefined' && window.__MATRICULAB_COURSES__ && window.__MATRICULAB_COURSES__.length > 0) {
    inMemoryCourses = window.__MATRICULAB_COURSES__;
    return inMemoryCourses;
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem('matriculab_courses_cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          inMemoryCourses = parsed;
          window.__MATRICULAB_COURSES__ = parsed;
          return parsed;
        }
      }
    } catch {}
  }
  return null;
}

/**
 * Returns professors synchronously if already present in memory or sessionStorage.
 */
export function getSynchronousCachedProfessors(): ProfessorInfo[] | null {
  if (inMemoryProfessors && inMemoryProfessors.length > 0) return inMemoryProfessors;
  if (typeof window !== 'undefined' && window.__MATRICULAB_PROFESSORS__ && window.__MATRICULAB_PROFESSORS__.length > 0) {
    inMemoryProfessors = window.__MATRICULAB_PROFESSORS__;
    return inMemoryProfessors;
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem('matriculab_professors_cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          inMemoryProfessors = parsed;
          window.__MATRICULAB_PROFESSORS__ = parsed;
          return parsed;
        }
      }
    } catch {}
  }
  return null;
}

/**
 * Prewarms all catalogs in background idle time so switching between any tabs is instant.
 */
export function prewarmAllCatalogs() {
  if (typeof window === 'undefined') return;
  const runner = async () => {
    try {
      await Promise.allSettled([
        getCoursesCatalog(),
        getProfessorsCatalog(),
        getClassroomsCatalog()
      ]);
    } catch {}
  };
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(runner, { timeout: 2000 });
  } else {
    setTimeout(runner, 80);
  }
}

// Automatically start prewarming when module is evaluated in browser
if (typeof window !== 'undefined') {
  prewarmAllCatalogs();
}

/**
 * Loads course catalog with multi-tier caching (Memory -> SessionStorage -> Static JSON -> Excel Fallback).
 * Returns in < 5ms once cached.
 */
export async function getCoursesCatalog(): Promise<CourseExtendedInfo[]> {
  if (inMemoryCourses && inMemoryCourses.length > 0) return inMemoryCourses;
  if (typeof window !== 'undefined' && window.__MATRICULAB_COURSES__ && window.__MATRICULAB_COURSES__.length > 0) {
    inMemoryCourses = window.__MATRICULAB_COURSES__;
    return inMemoryCourses;
  }

  // Tier 2: SessionStorage
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem('matriculab_courses_cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          inMemoryCourses = parsed;
          window.__MATRICULAB_COURSES__ = parsed;
          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
  }

  // Tier 3: Pre-compiled static JSON (super fast JSON.parse vs SheetJS)
  try {
    const res = await fetch('/data/courses_catalog.json');
    if (res.ok) {
      const data: CourseExtendedInfo[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        inMemoryCourses = data;
        if (typeof window !== 'undefined') {
          window.__MATRICULAB_COURSES__ = data;
          try {
            sessionStorage.setItem('matriculab_courses_cache', JSON.stringify(data));
          } catch {
            // storage quota exceeded, in-memory is enough
          }
        }
        return data;
      }
    }
  } catch (jsonErr) {
    console.warn('Pre-compiled courses_catalog.json fetch failed, using fallback:', jsonErr);
  }

  // Tier 4: Fallback to raw Excel parsing
  const excelRes = await fetch('/samples/Consulta_Horario.xlsx');
  if (!excelRes.ok) throw new Error('No se pudo cargar la oferta académica de UTEC');
  const buffer = await excelRes.arrayBuffer();
  const parseResult = parseExcelFile(buffer);
  let coursesToUse = parseResult.courses;

  try {
    const liveRes = await fetch('/data/classrooms_intranet.json');
    if (liveRes.ok) {
      const liveData = await liveRes.json();
      if (Array.isArray(liveData.classrooms) && liveData.classrooms.length > 0) {
        coursesToUse = mutuallyEnrichCoursesWithScrapedData(parseResult.courses, liveData.classrooms);
      }
    }
  } catch {
    // ignore
  }

  const processed = processRawCoursesIntoDirectory(coursesToUse);
  inMemoryCourses = processed;
  if (typeof window !== 'undefined') window.__MATRICULAB_COURSES__ = processed;
  return processed;
}

/**
 * Loads professors catalog with multi-tier caching (Memory -> SessionStorage -> Static JSON -> Excel Fallback).
 * Returns in < 5ms once cached.
 */
export async function getProfessorsCatalog(): Promise<ProfessorInfo[]> {
  if (inMemoryProfessors && inMemoryProfessors.length > 0) return inMemoryProfessors;
  if (typeof window !== 'undefined' && window.__MATRICULAB_PROFESSORS__ && window.__MATRICULAB_PROFESSORS__.length > 0) {
    inMemoryProfessors = window.__MATRICULAB_PROFESSORS__;
    return inMemoryProfessors;
  }

  // Tier 2: SessionStorage
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem('matriculab_professors_cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          inMemoryProfessors = parsed;
          window.__MATRICULAB_PROFESSORS__ = parsed;
          return parsed;
        }
      }
    } catch {
      // ignore
    }
  }

  // Tier 3: Pre-compiled static JSON
  try {
    const res = await fetch('/data/professors_catalog.json');
    if (res.ok) {
      const data: ProfessorInfo[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        inMemoryProfessors = data;
        if (typeof window !== 'undefined') {
          window.__MATRICULAB_PROFESSORS__ = data;
          try {
            sessionStorage.setItem('matriculab_professors_cache', JSON.stringify(data));
          } catch {
            // ignore
          }
        }
        return data;
      }
    }
  } catch (jsonErr) {
    console.warn('Pre-compiled professors_catalog.json fetch failed, using fallback:', jsonErr);
  }

  // Tier 4: Fallback
  const courses = await getCoursesCatalog();
  const profs = extractProfessorsFromCourses(courses as any);
  inMemoryProfessors = profs;
  if (typeof window !== 'undefined') window.__MATRICULAB_PROFESSORS__ = profs;
  return profs;
}

/**
 * Loads sample timetable data for ScheduleApp without parsing Excel in browser.
 */
export async function getSampleScheduleData(): Promise<{ courses: Course[]; metadata: MetadataInfo }> {
  if (inMemorySample) return inMemorySample;
  if (typeof window !== 'undefined' && window.__MATRICULAB_SAMPLE__) {
    inMemorySample = window.__MATRICULAB_SAMPLE__;
    return inMemorySample;
  }

  try {
    const res = await fetch('/data/enriched_courses.json');
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.courses) && data.courses.length > 0) {
        inMemorySample = data;
        if (typeof window !== 'undefined') window.__MATRICULAB_SAMPLE__ = data;
        return data;
      }
    }
  } catch {
    // fallback
  }

  const excelRes = await fetch('/samples/Consulta_Horario.xlsx');
  const buffer = await excelRes.arrayBuffer();
  const parseResult = parseExcelFile(buffer);
  const sample = { courses: parseResult.courses, metadata: parseResult.metadata };
  inMemorySample = sample;
  if (typeof window !== 'undefined') window.__MATRICULAB_SAMPLE__ = sample;
  return sample;
}

/**
 * Returns classrooms synchronously if already in memory or sessionStorage.
 */
export function getSynchronousCachedClassrooms(): ClassroomInfo[] | null {
  if (inMemoryClassrooms && inMemoryClassrooms.length > 0) return inMemoryClassrooms;
  if (typeof window !== 'undefined' && window.__MATRICULAB_CLASSROOMS__ && window.__MATRICULAB_CLASSROOMS__.length > 0) {
    inMemoryClassrooms = window.__MATRICULAB_CLASSROOMS__;
    return inMemoryClassrooms;
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem('matriculab_classrooms_cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          inMemoryClassrooms = parsed;
          window.__MATRICULAB_CLASSROOMS__ = parsed;
          return parsed;
        }
      }
    } catch {}
  }
  return null;
}

/**
 * Loads classrooms catalog with multi-tier caching (Memory -> SessionStorage -> Static JSON -> Fallback).
 */
export async function getClassroomsCatalog(): Promise<ClassroomInfo[]> {
  const sync = getSynchronousCachedClassrooms();
  if (sync) return sync;

  try {
    const liveRes = await fetch('/data/classrooms_intranet.json');
    if (liveRes.ok) {
      const liveData = await liveRes.json();
      if (Array.isArray(liveData.classrooms) && liveData.classrooms.length > 0) {
        inMemoryClassrooms = liveData.classrooms;
        if (typeof window !== 'undefined') {
          window.__MATRICULAB_CLASSROOMS__ = liveData.classrooms;
          try {
            sessionStorage.setItem('matriculab_classrooms_cache', JSON.stringify(liveData.classrooms));
          } catch {}
        }
        return liveData.classrooms;
      }
    }
  } catch {}

  const courses = await getCoursesCatalog();
  const { extractClassroomsFromCourses } = await import('./classroomUtils');
  const extracted = extractClassroomsFromCourses(courses as any);
  inMemoryClassrooms = extracted;
  if (typeof window !== 'undefined') window.__MATRICULAB_CLASSROOMS__ = extracted;
  return extracted;
}

