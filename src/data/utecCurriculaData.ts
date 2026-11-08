export type FacultyId = 'computacion' | 'negocios' | 'ingenieria' | 'ciencias';

export interface CurricularCourseNode {
  code: string;
  name: string;
  cycle: 1 | 2 | 3 | 4 | 5 | 6;
  credits: number;
  prereqs: string[];
  area: 'core' | 'math' | 'science' | 'humanities';
}

export interface CareerCurriculum {
  id: string;
  name: string;
  shortCode: string;
  facultyId: FacultyId;
  facultyName: string;
  defaultSelectedCode: string;
  courses: CurricularCourseNode[];
}

export interface UtecFacultyMeta {
  id: FacultyId;
  name: string;
  shortName: string;
  careersCount: number;
}

export const UTEC_FACULTIES: UtecFacultyMeta[] = [
  {
    id: 'computacion',
    name: 'Facultad de Computación',
    shortName: 'Computación',
    careersCount: 4,
  },
  {
    id: 'negocios',
    name: 'Facultad de Negocios',
    shortName: 'Negocios',
    careersCount: 2,
  },
  {
    id: 'ingenieria',
    name: 'Facultad de Ingeniería',
    shortName: 'Ingeniería',
    careersCount: 9,
  },
  {
    id: 'ciencias',
    name: 'Facultad de Ciencias Básicas',
    shortName: 'Ciencias Básicas',
    careersCount: 1,
  },
];

export const UTEC_16_CAREERS: CareerCurriculum[] = [
  // =========================================================================
  // FACULTAD DE COMPUTACIÓN (4)
  // =========================================================================
  {
    id: 'ciencia-computacion',
    name: 'Ciencia de la Computación',
    shortCode: 'CS',
    facultyId: 'computacion',
    facultyName: 'Facultad de Computación',
    defaultSelectedCode: 'CS2013',
    courses: [
      { code: 'CS1111', name: 'Programación I', cycle: 1, credits: 4, prereqs: [], area: 'core' },
      { code: 'CC6101', name: 'Fundamentos del Cálculo', cycle: 1, credits: 4, prereqs: [], area: 'math' },
      { code: 'CS1041', name: 'Matemáticas Discretas I', cycle: 1, credits: 4, prereqs: [], area: 'math' },
      { code: 'CS1001', name: 'Introducción a Ciencia de la Computación', cycle: 1, credits: 3, prereqs: [], area: 'core' },

      { code: 'CS1112', name: 'Programación II', cycle: 2, credits: 4, prereqs: ['CS1111', 'CS1001'], area: 'core' },
      { code: 'CC1101', name: 'Cálculo de una Variable', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'math' },
      { code: 'CS1042', name: 'Matemáticas Discretas II', cycle: 2, credits: 4, prereqs: ['CS1041'], area: 'math' },
      { code: 'CC1103', name: 'Álgebra Lineal', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'math' },

      { code: 'CS2013', name: 'Programación III', cycle: 3, credits: 4, prereqs: ['CS1112'], area: 'core' },
      { code: 'CS2041', name: 'Bases de Datos I', cycle: 3, credits: 4, prereqs: ['CS1112', 'CS1042'], area: 'core' },
      { code: 'CS2033', name: 'Teoría de la Computación', cycle: 3, credits: 4, prereqs: ['CS1042'], area: 'core' },
      { code: 'CC1104', name: 'Cálculo Multivariable', cycle: 3, credits: 4, prereqs: ['CC1101', 'CC1103'], area: 'math' },
      { code: 'CC1105', name: 'Estadística y Probabilidades I', cycle: 3, credits: 4, prereqs: ['CC1101'], area: 'math' },

      { code: 'CS2023', name: 'Algoritmos y Estructuras de Datos', cycle: 4, credits: 4, prereqs: ['CS2013', 'CS1042'], area: 'core' },
      { code: 'CC2104', name: 'Análisis Numérico', cycle: 4, credits: 4, prereqs: ['CC1104', 'CC1103'], area: 'math' },
      { code: 'CS2035', name: 'Programación Funcional', cycle: 4, credits: 3, prereqs: ['CS2013', 'CS2033'], area: 'core' },
      { code: 'CS3051', name: 'Arquitectura de Computadores', cycle: 4, credits: 4, prereqs: ['CS2013'], area: 'core' },

      { code: 'CS3026', name: 'Análisis y Diseño de Algoritmos', cycle: 5, credits: 4, prereqs: ['CS2023'], area: 'core' },
      { code: 'CS3029', name: 'Machine Learning', cycle: 5, credits: 4, prereqs: ['CS2013', 'CC1105', 'CC1104'], area: 'core' },
      { code: 'CS3015', name: 'Sistemas Operativos', cycle: 5, credits: 4, prereqs: ['CS3051', 'CS2023'], area: 'core' },

      { code: 'CS4016', name: 'Computación Gráfica', cycle: 6, credits: 4, prereqs: ['CS3026', 'CC2104'], area: 'core' },
      { code: 'CS4052', name: 'Computación Paralela y Distribuida', cycle: 6, credits: 4, prereqs: ['CS3015', 'CS3026'], area: 'core' },
      { code: 'CS3025', name: 'Compiladores', cycle: 6, credits: 4, prereqs: ['CS2033', 'CS2035'], area: 'core' },
    ],
  },

  {
    id: 'sistemas-informacion',
    name: 'Sistemas de Información',
    shortCode: 'IS',
    facultyId: 'computacion',
    facultyName: 'Facultad de Computación',
    defaultSelectedCode: 'CS2031',
    courses: [
      { code: 'CS1111', name: 'Programación I', cycle: 1, credits: 4, prereqs: [], area: 'core' },
      { code: 'CC6101', name: 'Fundamentos del Cálculo', cycle: 1, credits: 4, prereqs: [], area: 'math' },
      { code: 'CS1041', name: 'Matemáticas Discretas I', cycle: 1, credits: 4, prereqs: [], area: 'math' },
      { code: 'IS6001', name: 'Introducción a Sistemas de Información', cycle: 1, credits: 3, prereqs: [], area: 'core' },

      { code: 'CS1112', name: 'Programación II', cycle: 2, credits: 4, prereqs: ['CS1111'], area: 'core' },
      { code: 'CC1101', name: 'Cálculo de una Variable', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'math' },
      { code: 'CS1042', name: 'Matemáticas Discretas II', cycle: 2, credits: 4, prereqs: ['CS1041'], area: 'math' },
      { code: 'CC1103', name: 'Álgebra Lineal', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'math' },

      { code: 'CS2031', name: 'Desarrollo Basado en Plataformas I', cycle: 3, credits: 4, prereqs: ['CS1112', 'IS6001'], area: 'core' },
      { code: 'CS2041', name: 'Bases de Datos I', cycle: 3, credits: 4, prereqs: ['CS1112', 'CS1042'], area: 'core' },
      { code: 'IS2021', name: 'Sistemas Computacionales', cycle: 3, credits: 4, prereqs: ['CS1112'], area: 'core' },
      { code: 'IS2011', name: 'Comunicación Técnica y Empresarial', cycle: 3, credits: 3, prereqs: ['IS6001'], area: 'humanities' },

      { code: 'IS2032', name: 'Desarrollo Basado en Plataformas II', cycle: 4, credits: 4, prereqs: ['CS2031', 'CS2041'], area: 'core' },
      { code: 'CS2053', name: 'Redes y Comunicaciones', cycle: 4, credits: 4, prereqs: ['IS2021'], area: 'core' },
      { code: 'CC1105', name: 'Estadística y Probabilidades I', cycle: 4, credits: 4, prereqs: ['CC1101'], area: 'math' },
      { code: 'DS2011', name: 'Optimización', cycle: 4, credits: 4, prereqs: ['CC1101', 'CC1103'], area: 'math' },

      { code: 'IS2022', name: 'Diseño e Implementación de Sistemas Empresariales', cycle: 5, credits: 4, prereqs: ['IS2032', 'IS2011'], area: 'core' },
      { code: 'CS2032', name: 'Cloud Computing', cycle: 5, credits: 4, prereqs: ['IS2032', 'CS2053'], area: 'core' },
      { code: 'IS3041', name: 'Ingeniería y Arquitectura de Datos', cycle: 5, credits: 4, prereqs: ['CS2041', 'CC1105'], area: 'core' },

      { code: 'IS4024', name: 'DevOps y Gobierno de TI', cycle: 6, credits: 4, prereqs: ['CS2032', 'IS2022'], area: 'core' },
      { code: 'IS3014', name: 'Gestión de Proyectos de TI', cycle: 6, credits: 4, prereqs: ['IS2022'], area: 'core' },
      { code: 'IS5202', name: 'Analítica Empresarial Aplicada', cycle: 6, credits: 4, prereqs: ['IS3041', 'DS2011'], area: 'core' },
    ],
  },

  {
    id: 'ciencia-datos-ia',
    name: 'Ciencia de Datos e Inteligencia Artificial',
    shortCode: 'DS',
    facultyId: 'computacion',
    facultyName: 'Facultad de Computación',
    defaultSelectedCode: 'CS2023',
    courses: [
      { code: 'CS1111', name: 'Programación I', cycle: 1, credits: 4, prereqs: [], area: 'core' },
      { code: 'CC6101', name: 'Fundamentos del Cálculo', cycle: 1, credits: 4, prereqs: [], area: 'math' },
      { code: 'CS1041', name: 'Matemáticas Discretas I', cycle: 1, credits: 4, prereqs: [], area: 'math' },
      { code: 'DS6001', name: 'Introducción a Ciencia de Datos e IA', cycle: 1, credits: 3, prereqs: [], area: 'core' },

      { code: 'CS1112', name: 'Programación II', cycle: 2, credits: 4, prereqs: ['CS1111', 'DS6001'], area: 'core' },
      { code: 'CC1101', name: 'Cálculo de una Variable', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'math' },
      { code: 'CC1103', name: 'Álgebra Lineal', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'math' },

      { code: 'CS2023', name: 'Algoritmos y Estructuras de Datos', cycle: 3, credits: 4, prereqs: ['CS1112', 'CS1041'], area: 'core' },
      { code: 'CS2041', name: 'Bases de Datos I', cycle: 3, credits: 4, prereqs: ['CS1112'], area: 'core' },
      { code: 'CC1104', name: 'Cálculo Multivariable', cycle: 3, credits: 4, prereqs: ['CC1101', 'CC1103'], area: 'math' },
      { code: 'CC1105', name: 'Estadística y Probabilidades I', cycle: 3, credits: 4, prereqs: ['CC1101'], area: 'math' },

      { code: 'DS2011', name: 'Optimización', cycle: 4, credits: 4, prereqs: ['CC1104', 'CC1103'], area: 'math' },
      { code: 'CC2104', name: 'Análisis Numérico', cycle: 4, credits: 4, prereqs: ['CC1104'], area: 'math' },
      { code: 'DS2031', name: 'Fundamentos Matemáticos de Computación', cycle: 4, credits: 4, prereqs: ['CS1041', 'CS2023'], area: 'core' },
      { code: 'DS2041', name: 'Datos y Negocios', cycle: 4, credits: 3, prereqs: ['CS2041', 'CC1105'], area: 'core' },

      { code: 'CS3029', name: 'Machine Learning', cycle: 5, credits: 4, prereqs: ['CS2023', 'DS2011', 'CC1105'], area: 'core' },
      { code: 'DS3021', name: 'Análisis Computacional de Datos', cycle: 5, credits: 4, prereqs: ['CS2041', 'CC1105', 'DS2041'], area: 'core' },
      { code: 'CS5364', name: 'Deep Learning', cycle: 5, credits: 4, prereqs: ['DS2011', 'CC2104'], area: 'core' },

      { code: 'DS5348', name: 'Procesamiento de Lenguaje Natural', cycle: 6, credits: 4, prereqs: ['CS3029', 'CS5364'], area: 'core' },
      { code: 'DS5346', name: 'Modelos Generativos', cycle: 6, credits: 4, prereqs: ['CS3029', 'CS5364'], area: 'core' },
      { code: 'DS4341', name: 'Big Data y MLOps', cycle: 6, credits: 4, prereqs: ['DS3021', 'CS3029'], area: 'core' },
    ],
  },

  {
    id: 'ciberseguridad',
    name: 'Ciberseguridad',
    shortCode: 'CY',
    facultyId: 'computacion',
    facultyName: 'Facultad de Computación',
    defaultSelectedCode: 'CS3015',
    courses: [
      { code: 'CY6001', name: 'Introducción a Ciberseguridad', cycle: 1, credits: 3, prereqs: [], area: 'core' },
      { code: 'CS1111', name: 'Programación I', cycle: 1, credits: 4, prereqs: [], area: 'core' },
      { code: 'CC6101', name: 'Fundamentos del Cálculo', cycle: 1, credits: 4, prereqs: [], area: 'math' },
      { code: 'CS1041', name: 'Matemáticas Discretas I', cycle: 1, credits: 4, prereqs: [], area: 'math' },

      { code: 'CS1112', name: 'Programación II', cycle: 2, credits: 4, prereqs: ['CS1111', 'CY6001'], area: 'core' },
      { code: 'CC1101', name: 'Cálculo de una Variable', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'math' },
      { code: 'CS1042', name: 'Matemáticas Discretas II', cycle: 2, credits: 4, prereqs: ['CS1041'], area: 'math' },
      { code: 'CC1103', name: 'Álgebra Lineal', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'math' },

      { code: 'CS3015', name: 'Sistemas Operativos', cycle: 3, credits: 4, prereqs: ['CS1112', 'CY6001'], area: 'core' },
      { code: 'CS2031', name: 'Desarrollo Basado en Plataformas', cycle: 3, credits: 4, prereqs: ['CS1112'], area: 'core' },
      { code: 'CC1105', name: 'Estadística y Probabilidades I', cycle: 3, credits: 4, prereqs: ['CC1101'], area: 'math' },

      { code: 'CS2053', name: 'Redes y Comunicaciones', cycle: 4, credits: 4, prereqs: ['CS3015'], area: 'core' },
      { code: 'CS2023', name: 'Algoritmos y Estructuras de Datos', cycle: 4, credits: 4, prereqs: ['CS1112', 'CS1042'], area: 'core' },
      { code: 'CY2031', name: 'Fundamentos Matemáticos de Computación', cycle: 4, credits: 4, prereqs: ['CS1042', 'CC1103'], area: 'math' },
      { code: 'CY2042', name: 'Aspectos Legales y Éticos de Ciberseguridad', cycle: 4, credits: 3, prereqs: ['CY6001'], area: 'humanities' },

      { code: 'CS5371', name: 'Criptografía', cycle: 5, credits: 4, prereqs: ['CY2031', 'CS2023'], area: 'core' },
      { code: 'CY3051', name: 'Seguridad de Redes y Comunicaciones', cycle: 5, credits: 4, prereqs: ['CS2053', 'CS3015'], area: 'core' },
      { code: 'CY3061', name: 'Arquitectura de Software Seguro', cycle: 5, credits: 4, prereqs: ['CS2031', 'CS2023'], area: 'core' },

      { code: 'CY4071', name: 'Análisis de Malware', cycle: 6, credits: 4, prereqs: ['CS3015', 'CY3051'], area: 'core' },
      { code: 'CY4072', name: 'Threat Hunting', cycle: 6, credits: 4, prereqs: ['CY3051', 'CC1105'], area: 'core' },
      { code: 'CY4081', name: 'Hacking Ético Avanzado', cycle: 6, credits: 4, prereqs: ['CS5371', 'CY3051', 'CY3061'], area: 'core' },
    ],
  },

  // =========================================================================
  // FACULTAD DE NEGOCIOS (2)
  // =========================================================================
  {
    id: 'administracion-negocios-digitales',
    name: 'Administración y Negocios Digitales',
    shortCode: 'AD',
    facultyId: 'negocios',
    facultyName: 'Facultad de Negocios',
    defaultSelectedCode: 'AD2003',
    courses: [
      { code: 'AD1001', name: 'Introducción a los Negocios y la Innovación Empresarial', cycle: 1, credits: 4, prereqs: [], area: 'core' },
      { code: 'AD1002', name: 'Microeconomía Aplicada', cycle: 1, credits: 4, prereqs: [], area: 'core' },
      { code: 'CC1010', name: 'Pensamiento Matemático', cycle: 1, credits: 4, prereqs: [], area: 'math' },
      { code: 'AD1005', name: 'Tendencias en Tecnología', cycle: 1, credits: 3, prereqs: [], area: 'core' },

      { code: 'AD1201', name: 'Fundamentos de Marketing', cycle: 2, credits: 4, prereqs: ['AD1001'], area: 'core' },
      { code: 'AD6006', name: 'Contabilidad Financiera', cycle: 2, credits: 4, prereqs: ['AD1001'], area: 'core' },
      { code: 'CC6104', name: 'Matemática para Administradores', cycle: 2, credits: 4, prereqs: ['CC1010'], area: 'math' },
      { code: 'CS1111', name: 'Programación I', cycle: 2, credits: 4, prereqs: ['AD1005'], area: 'core' },
      { code: 'AD1204', name: 'Macroeconomía Aplicada', cycle: 2, credits: 3, prereqs: ['AD1002'], area: 'core' },

      { code: 'AD2102', name: 'Programación Orientada a Objetos', cycle: 3, credits: 4, prereqs: ['CS1111'], area: 'core' },
      { code: 'GI2101', name: 'Comportamiento del Consumidor', cycle: 3, credits: 4, prereqs: ['AD1201'], area: 'core' },
      { code: 'GI3101', name: 'Fundamentos de Finanzas', cycle: 3, credits: 4, prereqs: ['AD6006', 'AD1204'], area: 'core' },
      { code: 'CC2103', name: 'Estadística para Administradores I', cycle: 3, credits: 4, prereqs: ['CC6104'], area: 'math' },

      { code: 'AD2401', name: 'Gestión de la Información', cycle: 4, credits: 4, prereqs: ['AD2102'], area: 'core' },
      { code: 'AD2405', name: 'IA: Introducción a Machine Learning', cycle: 4, credits: 4, prereqs: ['AD2102', 'CC2103'], area: 'core' },
      { code: 'AD2003', name: 'Contabilidad Gerencial', cycle: 4, credits: 4, prereqs: ['AD6006', 'GI3101'], area: 'core' },

      { code: 'AD3011', name: 'Introducción a Data Analytics y Big Data', cycle: 5, credits: 4, prereqs: ['AD2401', 'AD2405'], area: 'core' },
      { code: 'AD3202', name: 'Gerencia de Productos Digitales', cycle: 5, credits: 4, prereqs: ['GI2101', 'AD2401'], area: 'core' },
      { code: 'AD3010', name: 'Business Analytics', cycle: 5, credits: 4, prereqs: ['AD2405', 'CC2103'], area: 'core' },

      { code: 'AD4004', name: 'Estrategia Digital', cycle: 6, credits: 4, prereqs: ['AD3202', 'AD2003'], area: 'core' },
      { code: 'AD4403', name: 'Ecommerce y Plataformas Digitales', cycle: 6, credits: 4, prereqs: ['AD3202', 'AD3010'], area: 'core' },
      { code: 'AD4307', name: 'AI Strategy for Business Leaders', cycle: 6, credits: 4, prereqs: ['AD3011', 'AD3010'], area: 'core' },
    ],
  },

  {
    id: 'business-analytics',
    name: 'Business Analytics',
    shortCode: 'BA',
    facultyId: 'negocios',
    facultyName: 'Facultad de Negocios',
    defaultSelectedCode: 'CS2041',
    courses: [
      { code: 'BA6001', name: 'Fundamentos de Negocios', cycle: 1, credits: 4, prereqs: [], area: 'core' },
      { code: 'CC6101', name: 'Fundamentos del Cálculo', cycle: 1, credits: 4, prereqs: [], area: 'math' },
      { code: 'CS1111', name: 'Programación I', cycle: 1, credits: 4, prereqs: [], area: 'core' },

      { code: 'CC1101', name: 'Cálculo de una Variable', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'math' },
      { code: 'BA1202', name: 'Programación Orientada a Objetos', cycle: 2, credits: 4, prereqs: ['CS1111'], area: 'core' },
      { code: 'AD6006', name: 'Contabilidad Financiera', cycle: 2, credits: 4, prereqs: ['BA6001'], area: 'core' },
      { code: 'CC1103', name: 'Álgebra Lineal', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'math' },

      { code: 'AD1002', name: 'Microeconomía Aplicada', cycle: 3, credits: 4, prereqs: ['BA6001', 'CC1101'], area: 'core' },
      { code: 'CC1104', name: 'Cálculo Multivariable', cycle: 3, credits: 4, prereqs: ['CC1101', 'CC1103'], area: 'math' },
      { code: 'CC2103', name: 'Estadística para Administradores I', cycle: 3, credits: 4, prereqs: ['CC1101'], area: 'math' },
      { code: 'CS2041', name: 'Base de Datos I', cycle: 3, credits: 4, prereqs: ['BA1202'], area: 'core' },

      { code: 'CC2106', name: 'Estadística para Administradores II', cycle: 4, credits: 4, prereqs: ['CC2103', 'CC1104'], area: 'math' },
      { code: 'GI3101', name: 'Fundamentos de Finanzas', cycle: 4, credits: 4, prereqs: ['AD6006', 'AD1002'], area: 'core' },
      { code: 'AD3004', name: 'Estrategia Competitiva', cycle: 4, credits: 3, prereqs: ['AD1002'], area: 'core' },
      { code: 'BA2404', name: 'Investigación de Mercados', cycle: 4, credits: 4, prereqs: ['CC2103', 'BA6001'], area: 'core' },

      { code: 'BA3101', name: 'Econometría & Estadística Multivariada', cycle: 5, credits: 4, prereqs: ['CC2106'], area: 'math' },
      { code: 'AD2405', name: 'IA: Introducción a Machine Learning', cycle: 5, credits: 4, prereqs: ['CC2106', 'CS2041'], area: 'core' },
      { code: 'CS2032', name: 'Cloud Computing', cycle: 5, credits: 4, prereqs: ['CS2041'], area: 'core' },

      { code: 'BA4101', name: 'Ingeniería y Arquitectura de Datos para Business Analytics', cycle: 6, credits: 4, prereqs: ['CS2032', 'CS2041'], area: 'core' },
      { code: 'IN2006', name: 'Investigación de Operaciones I', cycle: 6, credits: 4, prereqs: ['CC1103', 'CC1104'], area: 'math' },
      { code: 'IN6013', name: 'Visual Analytics & Storytelling', cycle: 6, credits: 4, prereqs: ['BA2404', 'AD2405'], area: 'core' },
      { code: 'BA4205', name: 'IA para la Toma de Decisiones', cycle: 6, credits: 4, prereqs: ['BA3101', 'AD2405', 'AD3004'], area: 'core' },
    ],
  },

  // =========================================================================
  // FACULTAD DE INGENIERÍA (9)
  // =========================================================================
  {
    id: 'ingenieria-industrial',
    name: 'Ingeniería Industrial',
    shortCode: 'IN',
    facultyId: 'ingenieria',
    facultyName: 'Facultad de Ingeniería',
    defaultSelectedCode: 'IN2006',
    courses: [
      { code: 'CC6101', name: 'Fundamentos del Cálculo', cycle: 1, credits: 4, prereqs: [], area: 'math' },
      { code: 'CS1111', name: 'Programación I', cycle: 1, credits: 4, prereqs: [], area: 'core' },
      { code: 'IN1001', name: 'Introducción a la Ingeniería Industrial', cycle: 1, credits: 3, prereqs: [], area: 'core' },

      { code: 'CC1101', name: 'Cálculo de una Variable', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'math' },
      { code: 'CC1103', name: 'Álgebra Lineal', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'math' },
      { code: 'CC6201', name: 'Introducción a la Mecánica', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'science' },
      { code: 'IN6012', name: 'Fundamentos de Operaciones', cycle: 2, credits: 4, prereqs: ['IN1001'], area: 'core' },

      { code: 'CC1104', name: 'Cálculo Vectorial', cycle: 3, credits: 4, prereqs: ['CC1101', 'CC1103'], area: 'math' },
      { code: 'CC1105', name: 'Estadística y Probabilidades I', cycle: 3, credits: 4, prereqs: ['CC1101'], area: 'math' },
      { code: 'IN2004', name: 'Gestión de Costos', cycle: 3, credits: 4, prereqs: ['IN6012'], area: 'core' },

      { code: 'IN2006', name: 'Investigación de Operaciones I', cycle: 4, credits: 4, prereqs: ['CC1103', 'CC1104', 'IN6012'], area: 'core' },
      { code: 'IN2005', name: 'Estadística Aplicada', cycle: 4, credits: 4, prereqs: ['CC1105'], area: 'math' },
      { code: 'IN3006', name: 'Gestión de la Calidad', cycle: 4, credits: 4, prereqs: ['CC1105', 'IN6012'], area: 'core' },

      { code: 'IN3008', name: 'Cadena de Suministro', cycle: 5, credits: 4, prereqs: ['IN2006', 'IN2004'], area: 'core' },
      { code: 'IN3012', name: 'Simulación Avanzada', cycle: 5, credits: 4, prereqs: ['IN2006', 'IN2005', 'CS1111'], area: 'core' },
      { code: 'IN4008', name: 'Data Analytics para Operaciones', cycle: 5, credits: 4, prereqs: ['IN2005', 'CS1111'], area: 'core' },

      { code: 'IN4021', name: 'Diseño de Operaciones y Economía Circular', cycle: 6, credits: 4, prereqs: ['IN3008', 'IN3006'], area: 'core' },
      { code: 'IN5304', name: 'Cadenas de Suministro y Compras Globales', cycle: 6, credits: 4, prereqs: ['IN3008'], area: 'core' },
      { code: 'IN5007', name: 'Ciencia de la Decisión y Dinámica de Sistemas', cycle: 6, credits: 4, prereqs: ['IN3012'], area: 'core' },
    ],
  },

  {
    id: 'bioingenieria',
    name: 'Bioingeniería',
    shortCode: 'BI',
    facultyId: 'ingenieria',
    facultyName: 'Facultad de Ingeniería',
    defaultSelectedCode: 'BI3006',
    courses: [
      { code: 'BI1002', name: 'Biología para Ingenieros', cycle: 1, credits: 4, prereqs: [], area: 'science' },
      { code: 'CC6101', name: 'Fundamentos del Cálculo', cycle: 1, credits: 4, prereqs: [], area: 'math' },
      { code: 'CC1141', name: 'Química General', cycle: 1, credits: 4, prereqs: [], area: 'science' },
      { code: 'CS1111', name: 'Programación I', cycle: 1, credits: 4, prereqs: [], area: 'core' },

      { code: 'CC1101', name: 'Cálculo de una Variable', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'math' },
      { code: 'BI2002', name: 'Química Orgánica Biológica', cycle: 2, credits: 4, prereqs: ['CC1141', 'BI1002'], area: 'science' },
      { code: 'CC6201', name: 'Introducción a la Mecánica', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'science' },

      { code: 'BI3006', name: 'Biología Celular y Molecular', cycle: 3, credits: 4, prereqs: ['BI1002', 'BI2002'], area: 'core' },
      { code: 'BI2015', name: 'Fundamentos de Biofísica', cycle: 3, credits: 4, prereqs: ['CC6201', 'CC1101', 'BI1002'], area: 'core' },
      { code: 'CC2101', name: 'Ecuaciones Diferenciales', cycle: 3, credits: 4, prereqs: ['CC1101'], area: 'math' },

      { code: 'BI3010', name: 'Bioquímica para Bioingenieros', cycle: 4, credits: 4, prereqs: ['BI3006'], area: 'core' },
      { code: 'EL3016', name: 'Análisis de Señales y Sistemas para Bioingeniería', cycle: 4, credits: 4, prereqs: ['CC2101', 'BI2015', 'CS1111'], area: 'core' },
      { code: 'BI3008', name: 'Biodiseño Médico', cycle: 4, credits: 4, prereqs: ['BI2015'], area: 'core' },

      { code: 'BI5320', name: 'Sensores y BIOMEMS', cycle: 5, credits: 4, prereqs: ['EL3016', 'BI3008'], area: 'core' },
      { code: 'BI4012', name: 'Biotransporte', cycle: 5, credits: 4, prereqs: ['CC2101', 'BI3010'], area: 'core' },
      { code: 'BI4013', name: 'Bioinformática', cycle: 5, credits: 4, prereqs: ['BI3006', 'CS1111'], area: 'core' },

      { code: 'BI4025', name: 'Imágenes Biomédicas', cycle: 6, credits: 4, prereqs: ['EL3016', 'BI5320'], area: 'core' },
      { code: 'BI5324', name: 'Biorreactores', cycle: 6, credits: 4, prereqs: ['BI3010', 'BI4012'], area: 'core' },
      { code: 'BI5325', name: 'Biología Sintética I', cycle: 6, credits: 4, prereqs: ['BI3010', 'BI4013'], area: 'core' },
    ],
  },

  {
    id: 'ingenieria-energia',
    name: 'Ingeniería de la Energía',
    shortCode: 'EN',
    facultyId: 'ingenieria',
    facultyName: 'Facultad de Ingeniería',
    defaultSelectedCode: 'EN2021',
    courses: [
      { code: 'EN6101', name: 'Introducción a la Ingeniería de la Energía', cycle: 1, credits: 3, prereqs: [], area: 'core' },
      { code: 'CC6101', name: 'Fundamentos del Cálculo', cycle: 1, credits: 4, prereqs: [], area: 'math' },
      { code: 'CS1111', name: 'Programación I', cycle: 1, credits: 4, prereqs: [], area: 'core' },

      { code: 'CC1101', name: 'Cálculo de una Variable', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'math' },
      { code: 'CC6201', name: 'Introducción a la Mecánica', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'science' },
      { code: 'CC1103', name: 'Álgebra Lineal', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'math' },

      { code: 'EN2021', name: 'Termodinámica Aplicada', cycle: 3, credits: 4, prereqs: ['CC6201', 'CC1101', 'EN6101'], area: 'core' },
      { code: 'CC1122', name: 'Fundamentos de Electricidad y Magnetismo', cycle: 3, credits: 4, prereqs: ['CC6201', 'CC1101'], area: 'science' },
      { code: 'CC2101', name: 'Ecuaciones Diferenciales', cycle: 3, credits: 4, prereqs: ['CC1101', 'CC1103'], area: 'math' },

      { code: 'EN2011', name: 'Ingeniería Eléctrica', cycle: 4, credits: 4, prereqs: ['CC1122', 'CC2101'], area: 'core' },
      { code: 'EN3016', name: 'Máquinas Térmicas y Transferencia de Calor', cycle: 4, credits: 4, prereqs: ['EN2021'], area: 'core' },
      { code: 'ME2022', name: 'Mecánica de Fluidos', cycle: 4, credits: 4, prereqs: ['EN2021', 'CC2101'], area: 'core' },

      { code: 'EN3024', name: 'Máquinas Eléctricas', cycle: 5, credits: 4, prereqs: ['EN2011'], area: 'core' },
      { code: 'EN3011', name: 'Centrales Eólicas e Hidráulicas', cycle: 5, credits: 4, prereqs: ['ME2022', 'EN3016'], area: 'core' },
      { code: 'EN3015', name: 'Energía Solar y Termosolar', cycle: 5, credits: 4, prereqs: ['EN3016'], area: 'core' },

      { code: 'EN4022', name: 'Sistemas Eléctricos de Potencia', cycle: 6, credits: 4, prereqs: ['EN3024'], area: 'core' },
      { code: 'EN4035', name: 'Gemelos Digitales y SmartGrid', cycle: 6, credits: 4, prereqs: ['EN3024', 'EN3011', 'CS1111'], area: 'core' },
      { code: 'EN4011', name: 'Auditoría y Eficiencia Energética', cycle: 6, credits: 4, prereqs: ['EN3016', 'EN3024'], area: 'core' },
    ],
  },

  {
    id: 'ingenieria-mecanica',
    name: 'Ingeniería Mecánica',
    shortCode: 'ME',
    facultyId: 'ingenieria',
    facultyName: 'Facultad de Ingeniería',
    defaultSelectedCode: 'ME2012',
    courses: [
      { code: 'ME6102', name: 'Dibujo para Ingeniería', cycle: 1, credits: 3, prereqs: [], area: 'core' },
      { code: 'CC6101', name: 'Fundamentos del Cálculo', cycle: 1, credits: 4, prereqs: [], area: 'math' },
      { code: 'CC1141', name: 'Química General', cycle: 1, credits: 4, prereqs: [], area: 'science' },

      { code: 'CC1101', name: 'Cálculo de una Variable', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'math' },
      { code: 'CC6201', name: 'Introducción a la Mecánica', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'science' },
      { code: 'CC1143', name: 'Ciencia de los Materiales', cycle: 2, credits: 4, prereqs: ['CC1141'], area: 'core' },

      { code: 'ME2013', name: 'Estática', cycle: 3, credits: 4, prereqs: ['CC6201', 'CC1101', 'ME6102'], area: 'core' },
      { code: 'ME2021', name: 'Termodinámica Aplicada', cycle: 3, credits: 4, prereqs: ['CC6201', 'CC1101'], area: 'core' },
      { code: 'CC2101', name: 'Ecuaciones Diferenciales', cycle: 3, credits: 4, prereqs: ['CC1101'], area: 'math' },

      { code: 'ME2012', name: 'Dinámica', cycle: 4, credits: 4, prereqs: ['ME2013', 'CC2101'], area: 'core' },
      { code: 'ME2025', name: 'Mecánica de Materiales', cycle: 4, credits: 4, prereqs: ['ME2013', 'CC1143'], area: 'core' },
      { code: 'ME2022', name: 'Mecánica de Fluidos', cycle: 4, credits: 4, prereqs: ['ME2021', 'CC2101'], area: 'core' },

      { code: 'ME3015', name: 'Diseño Mecánico', cycle: 5, credits: 4, prereqs: ['ME2025', 'ME2012'], area: 'core' },
      { code: 'ME3014', name: 'Automatización de Sistemas Mecánicos', cycle: 5, credits: 4, prereqs: ['ME2012'], area: 'core' },

      { code: 'ME4012', name: 'Diseño de Sistemas Mecánicos', cycle: 6, credits: 4, prereqs: ['ME3015'], area: 'core' },
      { code: 'ME4038', name: 'Electromovilidad', cycle: 6, credits: 4, prereqs: ['ME3015', 'ME2022', 'ME3014'], area: 'core' },
      { code: 'ME5310', name: 'Diseño y Manufactura CAD/CAM/CAE', cycle: 6, credits: 4, prereqs: ['ME3015'], area: 'core' },
    ],
  },

  {
    id: 'ingenieria-quimica',
    name: 'Ingeniería Química',
    shortCode: 'IQ',
    facultyId: 'ingenieria',
    facultyName: 'Facultad de Ingeniería',
    defaultSelectedCode: 'IQ2003',
    courses: [
      { code: 'IQ6001', name: 'Introducción a la Ingeniería Química', cycle: 1, credits: 3, prereqs: [], area: 'core' },
      { code: 'IQ1002', name: 'Química Avanzada', cycle: 1, credits: 4, prereqs: [], area: 'science' },
      { code: 'CC6101', name: 'Fundamentos del Cálculo', cycle: 1, credits: 4, prereqs: [], area: 'math' },

      { code: 'IQ2001', name: 'Química Orgánica Aplicada', cycle: 2, credits: 4, prereqs: ['IQ1002'], area: 'core' },
      { code: 'CC1101', name: 'Cálculo de una Variable', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'math' },
      { code: 'IQ2002', name: 'Análisis Químico para Ingeniería', cycle: 2, credits: 4, prereqs: ['IQ1002'], area: 'science' },

      { code: 'IQ2012', name: 'Fisicoquímica', cycle: 3, credits: 4, prereqs: ['IQ2001', 'CC1101'], area: 'core' },
      { code: 'IQ2003', name: 'Análisis de Procesos Químicos', cycle: 3, credits: 4, prereqs: ['IQ6001', 'IQ2002', 'CC1101'], area: 'core' },
      { code: 'CC2101', name: 'Ecuaciones Diferenciales', cycle: 3, credits: 4, prereqs: ['CC1101'], area: 'math' },

      { code: 'IQ3001', name: 'Fenómenos de Transporte', cycle: 4, credits: 4, prereqs: ['IQ2003', 'CC2101'], area: 'core' },
      { code: 'IQ3011', name: 'Termodinámica de Procesos Químicos', cycle: 4, credits: 4, prereqs: ['IQ2012', 'IQ2003'], area: 'core' },

      { code: 'IQ3003', name: 'Operaciones Unitarias', cycle: 5, credits: 4, prereqs: ['IQ3001', 'IQ3011'], area: 'core' },
      { code: 'IQ3006', name: 'Biotecnologías y Bioprocesos', cycle: 5, credits: 4, prereqs: ['IQ2001', 'IQ3001'], area: 'core' },

      { code: 'IQ4003', name: 'Diseño de Reactores Químicos', cycle: 6, credits: 4, prereqs: ['IQ3003', 'IQ3011'], area: 'core' },
      { code: 'IQ5001', name: 'Control de Procesos Químicos', cycle: 6, credits: 4, prereqs: ['IQ3003'], area: 'core' },
      { code: 'IQ5002', name: 'Diseño de Procesos Químicos', cycle: 6, credits: 4, prereqs: ['IQ3003', 'IQ3006'], area: 'core' },
    ],
  },

  {
    id: 'ingenieria-ambiental',
    name: 'Ingeniería Ambiental',
    shortCode: 'AM',
    facultyId: 'ingenieria',
    facultyName: 'Facultad de Ingeniería',
    defaultSelectedCode: 'AM3001',
    courses: [
      { code: 'AM6101', name: 'Introducción a la Ingeniería Ambiental', cycle: 1, credits: 3, prereqs: [], area: 'core' },
      { code: 'AM1002', name: 'Química Orgánica e Inorgánica', cycle: 1, credits: 4, prereqs: [], area: 'science' },
      { code: 'CC6101', name: 'Fundamentos del Cálculo', cycle: 1, credits: 4, prereqs: [], area: 'math' },
      { code: 'CS1111', name: 'Programación I', cycle: 1, credits: 4, prereqs: [], area: 'core' },

      { code: 'AM2001', name: 'Química Ambiental', cycle: 2, credits: 4, prereqs: ['AM1002', 'AM6101'], area: 'core' },
      { code: 'AM2003', name: 'Sistemas de la Tierra', cycle: 2, credits: 4, prereqs: ['AM6101'], area: 'core' },
      { code: 'CC1101', name: 'Cálculo de una Variable', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'math' },

      { code: 'AM1003', name: 'Biología, Ecología y Recursos Naturales', cycle: 3, credits: 4, prereqs: ['AM2001', 'AM2003'], area: 'science' },
      { code: 'AM3002', name: 'Mecánica de Fluidos Ambiental', cycle: 3, credits: 4, prereqs: ['CC1101', 'AM2003'], area: 'core' },
      { code: 'CC1105', name: 'Estadística y Probabilidades I', cycle: 3, credits: 4, prereqs: ['CC1101'], area: 'math' },

      { code: 'AM3001', name: 'Hidrología', cycle: 4, credits: 4, prereqs: ['AM3002', 'AM2003'], area: 'core' },
      { code: 'AM3005', name: 'Edafología y Manejo de Suelos', cycle: 4, credits: 4, prereqs: ['AM2001', 'AM1003'], area: 'core' },

      { code: 'AM3006', name: 'Contaminación Atmosférica', cycle: 5, credits: 4, prereqs: ['AM2001', 'AM3002'], area: 'core' },
      { code: 'AM4012', name: 'Teledetección e IA Aplicada', cycle: 5, credits: 4, prereqs: ['AM3001', 'CS1111', 'CC1105'], area: 'core' },

      { code: 'AM4314', name: 'Ciencia de Datos Ambientales', cycle: 6, credits: 4, prereqs: ['AM4012', 'AM3006'], area: 'core' },
      { code: 'AM4002', name: 'Estudios de Impacto Ambiental', cycle: 6, credits: 4, prereqs: ['AM3001', 'AM3005', 'AM3006'], area: 'core' },
    ],
  },

  {
    id: 'ingenieria-civil',
    name: 'Ingeniería Civil',
    shortCode: 'CI',
    facultyId: 'ingenieria',
    facultyName: 'Facultad de Ingeniería',
    defaultSelectedCode: 'CI2021',
    courses: [
      { code: 'CI6102', name: 'Diseño Gráfico Ingenieril y Modelado 3D', cycle: 1, credits: 3, prereqs: [], area: 'core' },
      { code: 'CC6101', name: 'Fundamentos del Cálculo', cycle: 1, credits: 4, prereqs: [], area: 'math' },
      { code: 'CC1141', name: 'Química General', cycle: 1, credits: 4, prereqs: [], area: 'science' },

      { code: 'CC1101', name: 'Cálculo de una Variable', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'math' },
      { code: 'CC6201', name: 'Introducción a la Mecánica', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'science' },
      { code: 'CI2003', name: 'Geomática Aplicada', cycle: 2, credits: 4, prereqs: ['CI6102'], area: 'core' },

      { code: 'CI2011', name: 'Mecánica Vectorial para Estructuras', cycle: 3, credits: 4, prereqs: ['CC6201', 'CC1101', 'CI6102'], area: 'core' },
      { code: 'CC1143', name: 'Ciencia de los Materiales', cycle: 3, credits: 4, prereqs: ['CC1141'], area: 'science' },
      { code: 'CC2101', name: 'Ecuaciones Diferenciales', cycle: 3, credits: 4, prereqs: ['CC1101'], area: 'math' },

      { code: 'CI2021', name: 'Mecánica Estructural', cycle: 4, credits: 4, prereqs: ['CI2011'], area: 'core' },
      { code: 'CI2032', name: 'Tecnología del Concreto', cycle: 4, credits: 4, prereqs: ['CC1143', 'CI2011'], area: 'core' },
      { code: 'CI2012', name: 'Dinámica y Vibraciones', cycle: 4, credits: 4, prereqs: ['CI2011', 'CC2101'], area: 'core' },

      { code: 'CI3014', name: 'Análisis Estructural', cycle: 5, credits: 4, prereqs: ['CI2021', 'CI2012'], area: 'core' },
      { code: 'CI3051', name: 'Mecánica de Suelos', cycle: 5, credits: 4, prereqs: ['CI2021', 'CI2003'], area: 'core' },

      { code: 'CI5311', name: 'Diseño de Concreto Reforzado', cycle: 6, credits: 4, prereqs: ['CI3014', 'CI2032'], area: 'core' },
      { code: 'CI4035', name: 'Gestión de Proyectos de Construcción y BIM', cycle: 6, credits: 4, prereqs: ['CI2032', 'CI3051'], area: 'core' },
    ],
  },

  {
    id: 'ingenieria-electronica',
    name: 'Ingeniería Electrónica',
    shortCode: 'EL',
    facultyId: 'ingenieria',
    facultyName: 'Facultad de Ingeniería',
    defaultSelectedCode: 'EL3011',
    courses: [
      { code: 'CC6101', name: 'Fundamentos del Cálculo', cycle: 1, credits: 4, prereqs: [], area: 'math' },
      { code: 'CS1111', name: 'Programación I', cycle: 1, credits: 4, prereqs: [], area: 'core' },
      { code: 'EL1001', name: 'Introducción a la Ingeniería Electrónica', cycle: 1, credits: 3, prereqs: [], area: 'core' },

      { code: 'CC1101', name: 'Cálculo de una Variable', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'math' },
      { code: 'EL2013', name: 'Circuitos Digitales', cycle: 2, credits: 4, prereqs: ['CS1111', 'EL1001'], area: 'core' },
      { code: 'CC1122', name: 'Electricidad y Magnetismo', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'science' },

      { code: 'EL2011', name: 'Circuitos Eléctricos', cycle: 3, credits: 4, prereqs: ['CC1122', 'CC1101'], area: 'core' },
      { code: 'EL3011', name: 'Diseño de Computadoras', cycle: 3, credits: 4, prereqs: ['EL2013'], area: 'core' },
      { code: 'CC2101', name: 'Ecuaciones Diferenciales', cycle: 3, credits: 4, prereqs: ['CC1101'], area: 'math' },

      { code: 'EL2012', name: 'Circuitos Analógicos I & II', cycle: 4, credits: 4, prereqs: ['EL2011'], area: 'core' },
      { code: 'EL3013', name: 'Análisis de Señales y Sistemas', cycle: 4, credits: 4, prereqs: ['CC2101', 'EL2011'], area: 'core' },

      { code: 'EL3022', name: 'Procesamiento Digital de Señales', cycle: 5, credits: 4, prereqs: ['EL3013', 'EL3011'], area: 'core' },
      { code: 'EL3012', name: 'Control Automático', cycle: 5, credits: 4, prereqs: ['EL3013'], area: 'core' },
      { code: 'EL3035', name: 'Sistemas Embebidos', cycle: 5, credits: 4, prereqs: ['EL3011', 'EL2012'], area: 'core' },

      { code: 'EL4021', name: 'Telecomunicaciones', cycle: 6, credits: 4, prereqs: ['EL3022'], area: 'core' },
      { code: 'EL4011', name: 'Electrónica de Potencia', cycle: 6, credits: 4, prereqs: ['EL2012', 'EL3012'], area: 'core' },
    ],
  },

  {
    id: 'ingenieria-mecatronica',
    name: 'Ingeniería Mecatrónica',
    shortCode: 'MT',
    facultyId: 'ingenieria',
    facultyName: 'Facultad de Ingeniería',
    defaultSelectedCode: 'MT3001',
    courses: [
      { code: 'MT6011', name: 'Introducción a la Ingeniería Mecatrónica', cycle: 1, credits: 3, prereqs: [], area: 'core' },
      { code: 'CC6101', name: 'Fundamentos del Cálculo', cycle: 1, credits: 4, prereqs: [], area: 'math' },
      { code: 'CS1111', name: 'Programación I', cycle: 1, credits: 4, prereqs: [], area: 'core' },

      { code: 'CC1101', name: 'Cálculo de una Variable', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'math' },
      { code: 'CC1122', name: 'Electricidad y Magnetismo', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'science' },
      { code: 'ME2021', name: 'Termodinámica', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'science' },

      { code: 'EL2081', name: 'Circuitos Eléctricos y Electrónicos I & II', cycle: 3, credits: 4, prereqs: ['CC1122', 'CC1101'], area: 'core' },
      { code: 'ME2013', name: 'Estática', cycle: 3, credits: 4, prereqs: ['CC1101', 'MT6011'], area: 'core' },
      { code: 'CC2101', name: 'Ecuaciones Diferenciales', cycle: 3, credits: 4, prereqs: ['CC1101'], area: 'math' },

      { code: 'MT2001', name: 'Dinámica de Cuerpos Rígidos', cycle: 4, credits: 4, prereqs: ['ME2013', 'CC2101'], area: 'core' },
      { code: 'MT3001', name: 'Sensores y Actuadores', cycle: 4, credits: 4, prereqs: ['EL2081', 'ME2021'], area: 'core' },

      { code: 'EL3012', name: 'Control Automático', cycle: 5, credits: 4, prereqs: ['MT2001', 'EL2081'], area: 'core' },
      { code: 'MT3035', name: 'Sistemas Embebidos', cycle: 5, credits: 4, prereqs: ['EL2081', 'CS1111', 'MT3001'], area: 'core' },
      { code: 'MT4003', name: 'Mecanismos y Transmisión de Movimiento', cycle: 5, credits: 4, prereqs: ['MT2001'], area: 'core' },

      { code: 'MT5305', name: 'Robótica Autónoma Aplicada', cycle: 6, credits: 4, prereqs: ['EL3012', 'MT3035', 'MT4003'], area: 'core' },
      { code: 'MT5001', name: 'Diseño de Sistemas Mecatrónicos', cycle: 6, credits: 4, prereqs: ['EL3012', 'MT3035'], area: 'core' },
    ],
  },

  // =========================================================================
  // FACULTAD DE CIENCIAS BÁSICAS (1)
  // =========================================================================
  {
    id: 'fisica',
    name: 'Física',
    shortCode: 'FI',
    facultyId: 'ciencias',
    facultyName: 'Facultad de Ciencias Básicas',
    defaultSelectedCode: 'CC1104',
    courses: [
      { code: 'CC6101', name: 'Fundamentos del Cálculo', cycle: 1, credits: 4, prereqs: [], area: 'math' },
      { code: 'CC1142', name: 'Química General y Experimental', cycle: 1, credits: 4, prereqs: [], area: 'science' },
      { code: 'CS1111', name: 'Programación I', cycle: 1, credits: 4, prereqs: [], area: 'core' },
      { code: 'FI1001', name: 'Introducción a la Física', cycle: 1, credits: 3, prereqs: [], area: 'core' },

      { code: 'CC1101', name: 'Cálculo de una Variable', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'math' },
      { code: 'CC1103', name: 'Álgebra Lineal', cycle: 2, credits: 4, prereqs: ['CC6101'], area: 'math' },
      { code: 'CC6201', name: 'Introducción a la Mecánica', cycle: 2, credits: 4, prereqs: ['CC6101', 'FI1001'], area: 'core' },
      { code: 'CS1112', name: 'Programación II', cycle: 2, credits: 4, prereqs: ['CS1111'], area: 'core' },

      { code: 'CC1104', name: 'Cálculo Vectorial', cycle: 3, credits: 4, prereqs: ['CC1101', 'CC1103'], area: 'math' },
      { code: 'FI2012', name: 'Física Térmica', cycle: 3, credits: 4, prereqs: ['CC6201', 'CC1142'], area: 'core' },
      { code: 'CC1122', name: 'Electricidad y Magnetismo', cycle: 3, credits: 4, prereqs: ['CC6201', 'CC1101'], area: 'core' },
      { code: 'CC1105', name: 'Estadística y Probabilidades I', cycle: 3, credits: 4, prereqs: ['CC1101'], area: 'math' },

      { code: 'FI2021', name: 'Mecánica Clásica I & II', cycle: 4, credits: 4, prereqs: ['CC6201', 'CC1104'], area: 'core' },
      { code: 'FI2024', name: 'Oscilaciones y Ondas', cycle: 4, credits: 4, prereqs: ['CC1122', 'CC1104'], area: 'core' },
      { code: 'FI2031', name: 'Matemáticas para la Física I & II', cycle: 4, credits: 4, prereqs: ['CC1104', 'CC1103'], area: 'math' },

      { code: 'FI3011', name: 'Electrodinámica I & II', cycle: 5, credits: 4, prereqs: ['CC1122', 'FI2031'], area: 'core' },
      { code: 'FI3022', name: 'Física Moderna', cycle: 5, credits: 4, prereqs: ['FI2021', 'FI2024'], area: 'core' },

      { code: 'FI4011', name: 'Mecánica Cuántica I & II', cycle: 6, credits: 4, prereqs: ['FI3022', 'FI2031'], area: 'core' },
      { code: 'FI4024', name: 'Mecánica Estadística', cycle: 6, credits: 4, prereqs: ['FI2012', 'CC1105', 'FI3022'], area: 'core' },
      { code: 'FI4035', name: 'Física Computacional Avanzada', cycle: 6, credits: 4, prereqs: ['CS1112', 'FI3011'], area: 'core' },
    ],
  },
];

// Global lookup of code -> full name across all 16 curricula as fallback
const GLOBAL_CODE_NAME_MAP: Record<string, string> = {};
for (const career of UTEC_16_CAREERS) {
  for (const c of career.courses) {
    if (!GLOBAL_CODE_NAME_MAP[c.code]) {
      GLOBAL_CODE_NAME_MAP[c.code] = c.name;
    }
  }
}

export function getCourseFullLabel(code: string, career?: CareerCurriculum): string {
  if (career) {
    const found = career.courses.find(c => c.code === code);
    if (found) return `${found.code} · ${found.name}`;
  }
  const fallback = GLOBAL_CODE_NAME_MAP[code];
  return fallback ? `${code} · ${fallback}` : code;
}

