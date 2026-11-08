export interface GraftonPigment {
  id: string;
  bg: string;
  hatch: string;
  border: string;
  bar: string;
  text: string;
  subtext: string;
}

/**
 * Direction A · Grafton Swiss Concrete
 * Matte high-legibility architectural pigments inspired by UTEC Barranco & Swiss grids.
 */
export const GRAFTON_PIGMENTS: GraftonPigment[] = [
  {
    id: 'cobalt',
    bg: '#E0EBF5',
    hatch: 'rgba(0, 102, 153, 0.09)',
    border: '#006699',
    bar: '#006699',
    text: '#0A2E46',
    subtext: '#134668',
  },
  {
    id: 'emerald',
    bg: '#DCEEE6',
    hatch: 'rgba(15, 118, 82, 0.09)',
    border: '#0F7652',
    bar: '#0F7652',
    text: '#093B29',
    subtext: '#12563D',
  },
  {
    id: 'ochre',
    bg: '#F5E8D3',
    hatch: 'rgba(184, 93, 0, 0.09)',
    border: '#B85D00',
    bar: '#B85D00',
    text: '#4D2600',
    subtext: '#6E3800',
  },
  {
    id: 'violet',
    bg: '#E8E3F3',
    hatch: 'rgba(85, 60, 154, 0.09)',
    border: '#553C9A',
    bar: '#553C9A',
    text: '#2A1B4E',
    subtext: '#3F2A73',
  },
  {
    id: 'crimson',
    bg: '#F4E0E2',
    hatch: 'rgba(168, 32, 50, 0.09)',
    border: '#A82032',
    bar: '#A82032',
    text: '#520D17',
    subtext: '#751523',
  },
  {
    id: 'cyan',
    bg: '#D9EEF2',
    hatch: 'rgba(0, 119, 158, 0.09)',
    border: '#00779E',
    bar: '#00779E',
    text: '#063747',
    subtext: '#0B5066',
  },
  {
    id: 'olive',
    bg: '#E5ECDC',
    hatch: 'rgba(77, 107, 42, 0.09)',
    border: '#4D6B2A',
    bar: '#4D6B2A',
    text: '#233311',
    subtext: '#344B1A',
  },
  {
    id: 'slate',
    bg: '#E2E6F0',
    hatch: 'rgba(54, 79, 132, 0.09)',
    border: '#364F84',
    bar: '#364F84',
    text: '#182542',
    subtext: '#263B66',
  },
];

const FIXED_COURSE_PIGMENTS: Record<string, number> = {
  CS2013: 0, // Cobalt — Programación III
  CS2023: 1, // Emerald — Algoritmos y Estructuras de Datos
  IN2005: 2, // Ochre — Estadística Aplicada
  CC1105: 2, // Ochre — Estadística y Probabilidades I
  CS2041: 3, // Violet — Base de Datos I
  MA2001: 4, // Crimson — Cálculo Vectorial
  CC1104: 4, // Crimson — Cálculo Vectorial
  CS2031: 5, // Cyan — Desarrollo Basado en Plataformas
  CS5352: 6, // Olive — 3D Graphics Programming
  CC1103: 7, // Slate — Álgebra Lineal
};

export function getGraftonPigment(courseCode: string): GraftonPigment {
  if (!courseCode) return GRAFTON_PIGMENTS[0];
  const normalized = courseCode.trim().toUpperCase();
  if (normalized in FIXED_COURSE_PIGMENTS) {
    return GRAFTON_PIGMENTS[FIXED_COURSE_PIGMENTS[normalized]];
  }
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRAFTON_PIGMENTS[Math.abs(hash) % GRAFTON_PIGMENTS.length];
}

export function isLaboratorySession(sessionGroup?: string): boolean {
  if (!sessionGroup) return false;
  return /LAB|TALLER|PR[ÁA]C/i.test(sessionGroup);
}

export function getGraftonBlockBackground(pigment: GraftonPigment, isLab: boolean): string {
  if (!isLab) return pigment.bg;
  return `repeating-linear-gradient(-45deg, ${pigment.bg}, ${pigment.bg} 7px, ${pigment.hatch} 7px, ${pigment.hatch} 11px)`;
}

