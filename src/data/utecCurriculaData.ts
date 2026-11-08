export type FacultyId = 'computacion' | 'negocios' | 'ingenieria' | 'ciencias';

export type CycleNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type RawCurriculumTuple = [CycleNumber, string, string, number, string[]];

export interface CurricularCourseNode {
  code: string;
  name: string;
  cycle: CycleNumber;
  credits: number;
  prereqs: string[];
  area: 'core' | 'math' | 'science' | 'humanities';
}

export interface CareerCurriculum {
  id: string;
  rawKey: keyof typeof RAW_UTEC_16_CURRICULA;
  name: string;
  shortCode: string;
  facultyId: FacultyId;
  facultyName: string;
  defaultSelectedCode: string;
  totalCredits: number;
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

// =============================================================================
// 100% VERBATIM UTEC 2026 CURRICULA (ALL 16 CAREERS, CICLO 1 TO 10)
// Format: [cycle, code, officialName, credits, prereqCodesArray]
// =============================================================================
export const RAW_UTEC_16_CURRICULA = {
  // ===========================================================================
  // 1. ADMINISTRACIÓN Y NEGOCIOS DIGITALES (200 cr: 21, 21, 21, 20, 21, 22, 22, 17, 17, 18)
  // ===========================================================================
  and: [
    // Ciclo 1 (21 cr)
    [1, 'AD1001', 'Introducción a los Negocios y la Innovación Empresarial', 4, []],
    [1, 'AD1002', 'Microeconomía Aplicada', 3, []],
    [1, 'GH1001', 'Taller de Planeamiento y Estrategias de Aprendizaje', 1, []],
    [1, 'MA1000', 'Pensamiento Matemático', 3, []],
    [1, 'HH1101', 'Comunicación Integral I', 3, []],
    [1, 'PI1101', 'Proyectos Interdisciplinarios I', 3, []],
    [1, 'AD1003', 'Tendencias en Tecnología', 4, []],
    // Ciclo 2 (21 cr)
    [2, 'AD1101', 'Fundamentos de Marketing', 4, ['AD1001']],
    [2, 'AD1102', 'Contabilidad Financiera', 3, ['AD1001']],
    [2, 'MA1005', 'Matemática para Administradores', 4, ['MA1000']],
    [2, 'CS1111', 'Programación I', 4, ['MA1000']],
    [2, 'HH1102', 'Comunicación Integral II', 3, ['HH1101']],
    [2, 'AD1103', 'Macroeconomía Aplicada', 3, ['AD1002']],
    // Ciclo 3 (21 cr)
    [3, 'CS1112', 'Programación Orientada a Objetos', 4, ['CS1111']],
    [3, 'AD2005', 'Comportamiento del Consumidor', 3, ['AD1101']],
    [3, 'AD2008', 'Fundamentos de Finanzas', 3, ['AD1102']],
    [3, 'MA1011', 'Fundamentos de Álgebra Lineal', 2, ['MA1000']],
    [3, 'IN2005', 'Estadística para Administradores I', 4, ['MA1005']],
    [3, 'PI1102', 'Proyectos Interdisciplinarios II', 2, ['PI1101']],
    [3, 'HH2101', 'Electivo de HACS I', 3, []],
    // Ciclo 4 (20 cr)
    [4, 'AD2003', 'Contabilidad Gerencial', 3, ['AD1102']],
    [4, 'AD2009', 'Gestión de la Información', 3, ['CS1112']],
    [4, 'AD2010', 'Derecho Empresarial', 3, ['AD1101']],
    [4, 'AD2011', 'Antropología Aplicada a los Negocios', 3, ['AD2005']],
    [4, 'IN2006', 'Estadística para Administradores II', 3, ['IN2005']],
    [4, 'CS2013', 'Desarrollo Basado en Plataformas I', 2, ['CS1112']],
    [4, 'CS3015', 'IA: Introducción a Machine Learning', 3, ['CS1112', 'MA1011', 'IN2005']],
    // Ciclo 5 (21 cr)
    [5, 'CS2014', 'Desarrollo Basado en Plataformas II', 2, ['CS2013']],
    [5, 'AD3001', 'Análisis de Estados Financieros', 3, ['AD2008']],
    [5, 'AD3002', 'Investigación de Mercados', 4, ['AD2011']],
    [5, 'AD3003', 'Introducción a Data Analytics y Big Data', 3, ['AD2009']],
    [5, 'AD3004', 'Gerencia de Productos Digitales I', 3, ['AD2005', 'CS1112']],
    [5, 'GH2001', 'Emprendedurismo', 3, ['AD2005', 'CS1112']],
    [5, 'PI3101', 'Electivo de Proyectos Interdisciplinarios', 3, ['PI1102']],
    // Ciclo 6 (22 cr)
    [6, 'AD3005', 'Gestión de Personas y Organizaciones', 3, ['AD2011']],
    [6, 'AD3006', 'Gerencia de Operaciones', 4, ['AD3003']],
    [6, 'AD3007', 'Estrategia Competitiva', 3, ['AD3002']],
    [6, 'AD3008', 'Finanzas Corporativas', 3, ['AD3001']],
    [6, 'AD3009', 'Gerencia de Productos Digitales II', 3, ['AD3004']],
    [6, 'AD3091', 'Electivo de Negocios I', 3, []],
    [6, 'HH2102', 'Electivo de HACS II', 3, ['HH2101']],
    // Ciclo 7 (22 cr)
    [7, 'AD4001', 'Business Analytics', 3, ['AD3003']],
    [7, 'AD4002', 'Gestión de Negocios Globales', 3, ['AD3007']],
    [7, 'AD4003', 'Supply Chain Management', 3, ['AD3006']],
    [7, 'AD4004', 'Experience Research & Design', 3, ['AD3009']],
    [7, 'AD4005', 'Gestión de Proyectos', 3, ['GH2001']],
    [7, 'AD4091', 'Electivo de Liderazgo y Organización I', 3, []],
    [7, 'AD4092', 'Electivo de Tecnología I', 4, []],
    // Ciclo 8 (17 cr)
    [8, 'AD4006', 'Dirección Estratégica', 3, ['AD4002']],
    [8, 'AD4007', 'Marketing Digital', 3, ['AD3009']],
    [8, 'PR4010', 'Proyecto Preprofesional', 4, ['AD4005']],
    [8, 'AD4008', 'BPM y Transformación Digital', 4, ['AD4003']],
    [8, 'AD4093', 'Electivo de Negocios II', 3, []],
    // Ciclo 9 (17 cr)
    [9, 'AD5001', 'Formulación y Evaluación de Proyectos Digitales', 4, ['AD4007']],
    [9, 'AD5002', 'Inteligencia Artificial para Negocios', 3, ['AD4001']],
    [9, 'AD5003', 'Estrategia Digital', 3, ['AD4008']],
    [9, 'AD5091', 'Electivo de Liderazgo y Organización II', 3, []],
    [9, 'AD5092', 'Electivo de Tecnología II', 4, []],
    // Ciclo 10 (18 cr)
    [10, 'AD5004', 'Ética Digital y Negocios Sostenibles', 3, ['AD4006']],
    [10, 'AD5005', 'Proyecto Final de Administración y Negocios Digitales', 4, ['AD5001']],
    [10, 'AD5093', 'Electivo de Liderazgo y Organización III', 3, []],
    [10, 'EL5001', 'Electivo Libre I', 4, []],
    [10, 'EL5002', 'Electivo Libre II', 4, []]
  ],

  // ===========================================================================
  // 2. BUSINESS ANALYTICS (200 cr: 21, 21, 19, 21, 21, 19, 21, 19, 20, 18)
  // ===========================================================================
  ba: [
    // Ciclo 1 (21 cr)
    [1, 'GH1001', 'Taller de Planeamiento y Estrategias de Aprendizaje', 1, []],
    [1, 'BA1001', 'Introducción a Business Analytics', 3, []],
    [1, 'CS1111', 'Programación I', 4, []],
    [1, 'HH1101', 'Comunicación Integral I', 3, []],
    [1, 'PI1101', 'Proyectos Interdisciplinarios I', 3, []],
    [1, 'MA1001', 'Fundamentos del Cálculo', 3, []],
    [1, 'AD1101', 'Fundamentos de Marketing', 4, []],
    // Ciclo 2 (21 cr)
    [2, 'AD1102', 'Contabilidad Financiera', 3, []],
    [2, 'MA1002', 'Cálculo de una Variable', 4, ['MA1001']],
    [2, 'MA1010', 'Álgebra Lineal', 3, ['MA1001']],
    [2, 'CS1040', 'Matemáticas Discretas I', 4, []],
    [2, 'CS1112', 'Programación Orientada a Objetos', 4, ['CS1111']],
    [2, 'HH1102', 'Comunicación Integral II', 3, ['HH1101']],
    // Ciclo 3 (19 cr)
    [3, 'AD1002', 'Microeconomía Aplicada', 3, []],
    [3, 'MA2001', 'Cálculo Multivariable', 3, ['MA1002']],
    [3, 'IN2005', 'Estadística para Administradores I', 4, ['MA1002']],
    [3, 'CS2041', 'Base de Datos I', 4, ['CS1111', 'CS1040']],
    [3, 'CS2013', 'Desarrollo Basado en Plataformas I', 2, ['CS1112']],
    [3, 'AD2003', 'Contabilidad Gerencial', 3, ['AD1102']],
    // Ciclo 4 (21 cr)
    [4, 'AD2008', 'Fundamentos de Finanzas', 3, ['AD1102']],
    [4, 'AD3007', 'Estrategia Competitiva', 3, ['AD1101', 'AD1002']],
    [4, 'IN2006', 'Estadística para Administradores II', 3, ['IN2005']],
    [4, 'PI1102', 'Proyectos Interdisciplinarios II', 2, ['PI1101']],
    [4, 'CS2014', 'Desarrollo Basado en Plataformas II', 2, ['CS2013']],
    [4, 'AD3002', 'Investigación de Mercados', 4, ['AD1101']],
    [4, 'BA2091', 'Electivo de Operaciones', 4, []],
    // Ciclo 5 (21 cr)
    [5, 'AD1103', 'Macroeconomía Aplicada', 3, ['AD1002']],
    [5, 'AD3008', 'Finanzas Corporativas', 3, ['AD2008', 'AD2003']],
    [5, 'BA3001', 'Econometría & Estadística Multivariada', 3, ['IN2006']],
    [5, 'CS3015', 'IA: Introducción a Machine Learning', 3, ['MA1010']],
    [5, 'CS3040', 'Cloud Computing', 3, ['CS2014']],
    [5, 'AD2010', 'Derecho Empresarial', 3, ['AD1102', 'AD1101']],
    [5, 'HH2101', 'Electivo de HACS I', 3, []],
    // Ciclo 6 (19 cr)
    [6, 'BA3002', 'Ingeniería y Arquitectura de Datos para Business Analytics', 3, ['CS3040']],
    [6, 'BA3003', 'Investigación de Operaciones I: Modelos Determinísticos', 4, ['BA3001']],
    [6, 'AD4005', 'Gestión de Proyectos', 3, ['PI1102']],
    [6, 'GH2001', 'Emprendedurismo', 3, ['AD3002']],
    [6, 'AD3001', 'Análisis de Estados Financieros', 3, ['AD2003']],
    [6, 'HH2102', 'Electivo de HACS II', 3, ['HH2101']],
    // Ciclo 7 (21 cr)
    [7, 'BA4001', 'Visual Analytics & Storytelling', 3, ['CS2041', 'HH1102']],
    [7, 'AD4091', 'Electivo de Liderazgo y Organización I', 3, []],
    [7, 'BA4002', 'Analítica Probabilística para Decisiones de Negocios', 3, ['BA3003']],
    [7, 'BA4003', 'Data Product Management', 3, ['BA3002', 'CS2014']],
    [7, 'HH3101', 'Electivo de HACS III', 3, ['BA3003']],
    [7, 'PI3101', 'Electivo de Proyectos Interdisciplinarios', 3, ['PI1102']],
    [7, 'BA4091', 'Electivo de Negocios, Datos e Inteligencia Artificial I', 3, []],
    // Ciclo 8 (19 cr)
    [8, 'BA4004', 'Inteligencia Artificial para la Toma de Decisiones', 3, ['CS3015']],
    [8, 'BA4005', 'Gobierno y Seguridad de Datos e IA', 3, ['BA3002']],
    [8, 'AD5091', 'Electivo de Liderazgo y Organización II', 3, []],
    [8, 'BA4006', 'Diseño de Experimentos y A/B Testing para Negocios', 3, ['BA4002']],
    [8, 'PR4010', 'Proyecto Preprofesional', 4, ['AD4005']],
    [8, 'BA4092', 'Electivo de Negocios, Datos e Inteligencia Artificial II', 3, []],
    // Ciclo 9 (20 cr)
    [9, 'GH5010', 'Ética y Tecnología', 3, ['BA4005']],
    [9, 'BA5001', 'Series de Tiempo en Business Analytics', 3, ['BA3001']],
    [9, 'BA5002', 'Proyecto Final de Business Analytics I', 4, ['BA4006']],
    [9, 'BA5003', 'Inferencia Causal para Decisiones de Negocios', 3, ['BA4002']],
    [9, 'BA5004', 'Deep Learning & MLOps para Negocios', 3, ['BA4004']],
    [9, 'BA5091', 'Electivo de Tecnología', 4, []],
    // Ciclo 10 (18 cr)
    [10, 'BA5005', 'Proyecto Final de Business Analytics II', 4, ['BA5002']],
    [10, 'BA5092', 'Electivo de Negocios, Datos e Inteligencia Artificial III', 3, []],
    [10, 'BA5093', 'Electivo de Negocios, Datos e Inteligencia Artificial IV', 3, []],
    [10, 'EL5001', 'Electivo Libre I', 3, []],
    [10, 'EL5002', 'Electivo Libre II', 3, []],
    [10, 'EL5003', 'Electivo Libre III', 2, []]
  ],

  // ===========================================================================
  // 3. CIENCIA DE LA COMPUTACIÓN (200 cr: 20, 20, 20, 20, 20, 22, 21, 16, 22, 19)
  // ===========================================================================
  cs: [
    // Ciclo 1 (20 cr)
    [1, 'PI1101', 'Proyectos Interdisciplinarios I', 3, []],
    [1, 'HH1101', 'Comunicación Integral I', 3, []],
    [1, 'CS1040', 'Matemáticas Discretas I', 4, []],
    [1, 'CS1111', 'Programación I', 4, []],
    [1, 'CS1000', 'Introducción a Ciencia de la Computación', 3, []],
    [1, 'MA1001', 'Fundamentos del Cálculo', 3, []],
    // Ciclo 2 (20 cr)
    [2, 'PI1102', 'Proyectos Interdisciplinarios II', 2, ['PI1101']],
    [2, 'MA1002', 'Cálculo de una Variable', 4, ['MA1001']],
    [2, 'MA1010', 'Álgebra Lineal', 3, []],
    [2, 'CS1042', 'Matemáticas Discretas II', 4, ['CS1040']],
    [2, 'HH1102', 'Comunicación Integral II', 3, ['HH1101']],
    [2, 'CS1112', 'Programación II', 4, ['CS1111']],
    // Ciclo 3 (20 cr)
    [3, 'CS2013', 'Desarrollo Basado en Plataformas I', 2, ['CS1112']],
    [3, 'CS2041', 'Bases de Datos I', 4, ['CS1112', 'CS1040']],
    [3, 'MA2001', 'Cálculo Multivariable', 3, ['MA1002']],
    [3, 'IN2005', 'Estadística y Probabilidades I', 4, ['CS1111', 'MA1002']],
    [3, 'HH2101', 'Electivo de HACS I', 3, []],
    [3, 'CS2031', 'Teoría de la Computación', 4, ['CS1042']],
    // Ciclo 4 (20 cr)
    [4, 'CS2032', 'Programación Funcional', 4, ['CS2031']],
    [4, 'CS2014', 'Desarrollo Basado en Plataformas II', 2, ['CS2013']],
    [4, 'CS2023', 'Algoritmos y Estructuras de Datos', 4, ['CS1112']],
    [4, 'CS2020', 'Fundamentos Matemáticos de Computación', 3, ['MA2001', 'CS1042', 'MA1010']],
    [4, 'DS2010', 'Análisis Numérico', 4, ['MA2001', 'MA1010']],
    [4, 'GH2001', 'Emprendimiento I', 3, []],
    // Ciclo 5 (20 cr)
    [5, 'CS3015', 'Machine Learning', 4, ['CS1112', 'IN2005', 'MA1010']],
    [5, 'CS3040', 'Cloud Computing', 3, ['CS2014']],
    [5, 'CS3042', 'Bases de Datos II', 3, ['CS2041']],
    [5, 'CS3024', 'Análisis y Diseño de Algoritmos', 4, ['CS2020', 'CS2023']],
    [5, 'CS3022', 'Arquitectura de Computadores', 4, ['CS1042']],
    [5, 'CS3045', 'Desarrollo Basado en Agentes', 2, ['CS2014']],
    // Ciclo 6 (22 cr)
    [6, 'HH2102', 'Electivo de HACS II', 3, ['HH2101']],
    [6, 'CS3025', 'Sistemas Operativos', 4, ['CS3022']],
    [6, 'CS3051', 'Ingeniería de Software', 4, ['CS3040', 'CS2032']],
    [6, 'CS3091', 'Electivo de Carrera I', 4, []],
    [6, 'CS3060', 'Deep Learning', 4, ['CS3015']],
    [6, 'CS3026', 'Estructuras de Datos Avanzadas', 3, ['CS3024']],
    // Ciclo 7 (21 cr)
    [7, 'CS4014', 'Redes y Comunicaciones', 3, ['CS3025']],
    [7, 'CS4022', 'Computación Gráfica', 4, ['CS3026']],
    [7, 'CS4012', 'Programación Competitiva', 3, ['CS3024']],
    [7, 'CS4091', 'Electivo de Carrera II', 4, []],
    [7, 'GH3010', 'Finanzas Empresariales', 3, []],
    [7, 'CS4010', 'Computación Paralela y Distribuida', 4, ['CS3024']],
    // Ciclo 8 (16 cr)
    [8, 'CS4080', 'Metodología de la Investigación', 2, ['CS3026']],
    [8, 'PI3101', 'Electivo de Proyectos Interdisciplinarios', 3, ['PI1102']],
    [8, 'GH4010', 'Emprendimiento II', 3, ['GH2001', 'GH3010']],
    [8, 'CS4092', 'Electivo de Carrera III', 4, []],
    [8, 'PR4010', 'Proyecto Preprofesional', 4, ['CS3051']],
    // Ciclo 9 (22 cr)
    [9, 'CS5091', 'Electivo de Computación e Ingeniería I', 4, []],
    [9, 'EL5001', 'Electivo Libre I', 4, []],
    [9, 'EL5002', 'Electivo Libre II', 4, []],
    [9, 'CS5010', 'Trabajo de Investigación en Ciencia de la Computación I', 4, ['CS4080']],
    [9, 'GH5010', 'Ética en Computación', 3, []],
    [9, 'HH3101', 'Electivo de HACS III', 3, ['HH2102']],
    // Ciclo 10 (19 cr)
    [10, 'GH5020', 'Electivo de Gestión', 3, []],
    [10, 'EL5003', 'Electivo Libre III', 4, []],
    [10, 'CS5092', 'Electivo de Computación e Ingeniería II', 4, []],
    [10, 'CS5090', 'Trabajo de Investigación en Ciencia de la Computación II', 4, ['CS5010']],
    [10, 'CS5093', 'Electivo de Computación e Ingeniería III', 4, []]
  ],

  // ===========================================================================
  // 4. CIENCIA DE DATOS E INTELIGENCIA ARTIFICIAL (200 cr: 20, 20, 19, 19, 21, 22, 19, 16, 22, 22)
  // ===========================================================================
  cdia: [
    // Ciclo 1 (20 cr)
    [1, 'MA1001', 'Fundamentos del Cálculo', 3, []],
    [1, 'CS1111', 'Programación I', 4, []],
    [1, 'CS1040', 'Matemáticas Discretas I', 4, []],
    [1, 'DS1001', 'Introducción a Ciencia de Datos e Inteligencia Artificial', 3, []],
    [1, 'HH1101', 'Comunicación Integral I', 3, []],
    [1, 'PI1101', 'Proyectos Interdisciplinarios I', 3, []],
    // Ciclo 2 (20 cr)
    [2, 'MA1002', 'Cálculo de una Variable', 4, ['MA1001']],
    [2, 'MA1010', 'Álgebra Lineal', 3, []],
    [2, 'CS1112', 'Programación II', 4, ['CS1111']],
    [2, 'CS1042', 'Matemáticas Discretas II', 4, ['CS1040']],
    [2, 'HH1102', 'Comunicación Integral II', 3, ['HH1101']],
    [2, 'PI1102', 'Proyectos Interdisciplinarios II', 2, ['PI1101']],
    // Ciclo 3 (19 cr)
    [3, 'HH2101', 'Electivo de HACS I', 3, []],
    [3, 'GH2001', 'Emprendimiento I', 3, []],
    [3, 'MA2001', 'Cálculo Multivariable', 3, ['MA1002']],
    [3, 'IN2005', 'Estadística y Probabilidades I', 4, ['CS1111', 'MA1002']],
    [3, 'CS2041', 'Bases de Datos I', 4, ['CS1040', 'CS1111']],
    [3, 'CS2013', 'Desarrollo Basado en Plataformas I', 2, ['CS1112']],
    // Ciclo 4 (19 cr)
    [4, 'DS2010', 'Análisis Numérico', 4, ['MA2001', 'MA1010']],
    [4, 'CS2023', 'Algoritmos y Estructuras de Datos', 4, ['CS1112']],
    [4, 'CS2020', 'Fundamentos Matemáticos de Computación', 3, ['MA2001', 'CS1042', 'MA1010']],
    [4, 'CS2014', 'Desarrollo Basado en Plataformas II', 2, ['CS2013']],
    [4, 'DS2012', 'Optimización', 4, ['MA1010', 'MA2001']],
    [4, 'DS2030', 'Datos y Negocios', 2, ['CS2041']],
    // Ciclo 5 (21 cr)
    [5, 'CS3040', 'Cloud Computing', 3, ['CS2014']],
    [5, 'CS3024', 'Análisis y Diseño de Algoritmos', 4, ['CS2020', 'CS2023']],
    [5, 'CS3015', 'Machine Learning', 4, ['CS1112', 'IN2005', 'MA1010']],
    [5, 'DS3012', 'Análisis Computacional de Datos', 3, ['IN2005', 'CS2023', 'DS2012']],
    [5, 'DS3020', 'Data Storytelling', 3, ['DS2030']],
    [5, 'IN2006', 'Estadística y Probabilidades II', 4, ['IN2005']],
    // Ciclo 6 (22 cr)
    [6, 'HH2102', 'Electivo de HACS II', 3, ['HH2101']],
    [6, 'DS3091', 'Electivo de Carrera I', 4, []],
    [6, 'GH3010', 'Finanzas Empresariales', 3, []],
    [6, 'CS3060', 'Deep Learning', 4, ['CS3015']],
    [6, 'DS3040', 'Ética y Seguridad de los Datos', 4, ['CS2041', 'CS3040']],
    [6, 'DS3050', 'Big Data', 4, ['DS3012', 'IN2006', 'DS3020']],
    // Ciclo 7 (19 cr)
    [7, 'HH3101', 'Electivo de HACS III', 3, ['HH2102']],
    [7, 'DS4091', 'Electivo de Carrera II', 4, []],
    [7, 'DS4010', 'Desarrollo de Productos de Datos', 4, ['CS3040', 'CS3060', 'DS3050']],
    [7, 'DS4040', 'Gobernanza de Datos', 2, ['DS3040']],
    [7, 'DS4020', 'Análisis de Series de Tiempo', 3, ['CS3060']],
    [7, 'DS4030', 'Ingeniería y Arquitectura de Datos', 3, ['DS3050']],
    // Ciclo 8 (16 cr)
    [8, 'PI3101', 'Electivo de Proyectos Interdisciplinarios', 3, ['PI1102']],
    [8, 'DS4092', 'Electivo de Carrera III', 4, []],
    [8, 'GH4010', 'Emprendimiento II', 3, ['GH2001', 'GH3010']],
    [8, 'DS4080', 'Metodología de la Investigación', 2, ['CS3024', 'DS4010', 'DS4020', 'DS4030']],
    [8, 'PR4010', 'Proyecto Preprofesional', 4, ['DS4010']],
    // Ciclo 9 (22 cr)
    [9, 'CS5091', 'Electivo de Computación e Ingeniería I', 4, []],
    [9, 'EL5001', 'Electivo Libre I', 4, []],
    [9, 'EL5002', 'Electivo Libre II', 4, []],
    [9, 'DS5001', 'Trabajo de Investigación en Ciencia de Datos e IA I', 4, ['DS4080']],
    [9, 'DS5010', 'MLOps', 3, ['CS3015']],
    [9, 'GH5010', 'Ética en Computación', 3, []],
    // Ciclo 10 (22 cr)
    [10, 'EL5003', 'Electivo Libre III', 4, []],
    [10, 'CS5092', 'Electivo de Computación e Ingeniería II', 4, []],
    [10, 'CS5093', 'Electivo de Computación e Ingeniería III', 4, []],
    [10, 'GH5020', 'Electivo de Gestión', 3, []],
    [10, 'DS5002', 'Trabajo de Investigación en Ciencia de Datos e IA II', 4, ['DS5001']],
    [10, 'DS5020', 'Ciencia de Datos Computacionales', 3, ['CS3060']]
  ],

  // ===========================================================================
  // 5. SISTEMAS DE INFORMACIÓN (200 cr: 20, 20, 20, 19, 21, 19, 21, 16, 22, 22)
  // ===========================================================================
  si: [
    // Ciclo 1 (20 cr)
    [1, 'PI1101', 'Proyectos Interdisciplinarios I', 3, []],
    [1, 'MA1001', 'Fundamentos del Cálculo', 3, []],
    [1, 'HH1101', 'Comunicación Integral I', 3, []],
    [1, 'CS1040', 'Matemáticas Discretas I', 4, []],
    [1, 'SI1001', 'Introducción a Sistemas de Información', 3, []],
    [1, 'CS1111', 'Programación I', 4, []],
    // Ciclo 2 (20 cr)
    [2, 'CS1042', 'Matemáticas Discretas II', 4, ['CS1040']],
    [2, 'MA1010', 'Álgebra Lineal', 3, []],
    [2, 'MA1002', 'Cálculo de una Variable', 4, ['MA1001']],
    [2, 'HH1102', 'Comunicación Integral II', 3, ['HH1101']],
    [2, 'CS1112', 'Programación II', 4, ['CS1111']],
    [2, 'PI1102', 'Proyectos Interdisciplinarios II', 2, ['PI1101']],
    // Ciclo 3 (20 cr)
    [3, 'SI2010', 'Comunicación Técnica y Empresarial', 3, ['HH1102', 'SI1001']],
    [3, 'HH2101', 'Electivo de HACS I', 3, []],
    [3, 'SI2020', 'Sistemas Computacionales', 4, ['CS1042']],
    [3, 'CS2041', 'Bases de Datos I', 4, ['CS1111', 'CS1040']],
    [3, 'MA2001', 'Cálculo Multivariable', 3, ['MA1002']],
    [3, 'CS2013', 'Desarrollo Basado en Plataformas I', 3, ['CS1112']],
    // Ciclo 4 (19 cr)
    [4, 'DS2012', 'Optimización', 4, ['MA1010', 'MA2001']],
    [4, 'SI2050', 'Redes y Comunicaciones', 3, ['SI2020']],
    [4, 'IN2005', 'Estadística y Probabilidades I', 4, ['CS1111', 'MA1002']],
    [4, 'CS2014', 'Desarrollo Basado en Plataformas II', 2, ['CS2013']],
    [4, 'GH2001', 'Emprendimiento I', 3, []],
    [4, 'SI2060', 'Liderazgo en Tecnología', 3, ['SI2010']],
    // Ciclo 5 (21 cr)
    [5, 'IN2006', 'Estadística y Probabilidades II', 4, ['IN2005']],
    [5, 'CS3040', 'Cloud Computing', 3, ['CS2014']],
    [5, 'CS3015', 'Machine Learning', 4, ['CS1112', 'IN2005', 'MA1010']],
    [5, 'SI3015', 'Introducción a Business Analytics', 3, ['IN2005', 'CS2041']],
    [5, 'SI3025', 'Gestión de la Transformación Digital', 3, ['SI2060']],
    [5, 'CS2023', 'Algoritmos y Estructuras de Datos', 4, ['CS1112']],
    // Ciclo 6 (19 cr)
    [6, 'HH2102', 'Electivo de HACS II', 3, ['HH2101']],
    [6, 'SI3030', 'Gestión de Proyectos Tecnológicos', 3, ['CS2014', 'SI3025']],
    [6, 'GH3010', 'Finanzas Empresariales', 3, []],
    [6, 'SI3045', 'User Experience Research', 3, ['IN2006']],
    [6, 'CS3051', 'Ingeniería de Software', 4, ['CS3040']],
    [6, 'SI3091', 'Electivo de Carrera I', 3, []],
    // Ciclo 7 (21 cr)
    [7, 'SI4010', 'Diseño e Implementación de Sistemas Empresariales', 4, ['SI2050', 'SI3030', 'CS2023']],
    [7, 'SI4030', 'Fintech', 3, ['CS3015']],
    [7, 'SI4035', 'Process Mining', 3, ['SI3015', 'DS2012']],
    [7, 'SI4020', 'DevOps', 4, ['CS3040', 'SI2050']],
    [7, 'SI4050', 'Diseño de Software Centrado en el Usuario', 3, ['CS3051', 'SI3045']],
    [7, 'SI4091', 'Electivo de Carrera II', 4, []],
    // Ciclo 8 (16 cr)
    [8, 'SI4080', 'Metodología de la Investigación', 2, ['SI4010']],
    [8, 'GH4010', 'Emprendimiento II', 3, ['GH2001', 'GH3010']],
    [8, 'PR4010', 'Proyecto Preprofesional', 4, ['SI4010']],
    [8, 'SI4092', 'Electivo de Carrera III', 4, []],
    [8, 'PI3101', 'Electivo de Proyectos Interdisciplinarios', 3, ['PI1102']],
    // Ciclo 9 (22 cr)
    [9, 'GH5010', 'Ética en Computación', 3, []],
    [9, 'EL5001', 'Electivo Libre I', 4, []],
    [9, 'SI5010', 'Trabajo de Investigación en Sistemas de Información I', 4, ['SI4080']],
    [9, 'HH3101', 'Electivo de HACS III', 3, ['HH2102']],
    [9, 'CS5091', 'Electivo de Computación e Ingeniería I', 4, []],
    [9, 'CS5092', 'Electivo de Computación e Ingeniería II', 4, []],
    // Ciclo 10 (22 cr)
    [10, 'EL5002', 'Electivo Libre II', 4, []],
    [10, 'EL5003', 'Electivo Libre III', 4, []],
    [10, 'GH5020', 'Electivo de Gestión', 3, []],
    [10, 'SI5020', 'Trabajo de Investigación en Sistemas de Información II', 4, ['SI5010']],
    [10, 'SI5030', 'Digital Media Marketing', 3, ['SI3045', 'SI3015']],
    [10, 'CS5093', 'Electivo de Computación e Ingeniería III', 4, ['SI3045', 'SI3015']]
  ],

  // ===========================================================================
  // 6. CIBERSEGURIDAD (200 cr: 20, 20, 18, 21, 19, 22, 19, 16, 22, 22)
  // ===========================================================================
  cib: [
    // Ciclo 1 (20 cr)
    [1, 'CB1001', 'Introducción a Ciberseguridad', 3, []],
    [1, 'MA1001', 'Fundamentos del Cálculo', 3, []],
    [1, 'CS1111', 'Programación I', 4, []],
    [1, 'HH1101', 'Comunicación Integral I', 3, []],
    [1, 'CS1040', 'Matemáticas Discretas I', 4, []],
    [1, 'PI1101', 'Proyectos Interdisciplinarios I', 3, []],
    // Ciclo 2 (20 cr)
    [2, 'MA1010', 'Álgebra Lineal', 3, []],
    [2, 'CS1042', 'Matemáticas Discretas II', 4, ['CS1040']],
    [2, 'MA1002', 'Cálculo de una Variable', 4, ['MA1001']],
    [2, 'CS1112', 'Programación II', 3, ['CS1111']],
    [2, 'PI1102', 'Proyectos Interdisciplinarios II', 2, ['PI1101']],
    [2, 'HH1102', 'Comunicación Integral II', 4, ['HH1101']],
    // Ciclo 3 (18 cr)
    [3, 'CS2041', 'Bases de Datos I', 4, ['CS1040', 'CS1111']],
    [3, 'GH2001', 'Emprendimiento I', 3, []],
    [3, 'CS3022', 'Arquitectura de Computadores', 3, ['CS1042']],
    [3, 'MA2001', 'Cálculo Multivariable', 3, ['MA1002']],
    [3, 'CS2013', 'Desarrollo Basado en Plataformas I', 2, ['CS1112']],
    [3, 'HH2101', 'Electivo de HACS I', 3, []],
    // Ciclo 4 (21 cr)
    [4, 'CB2010', 'Sistemas Operativos', 4, ['CS3022']],
    [4, 'CS2014', 'Desarrollo Basado en Plataformas II', 2, ['CS2013']],
    [4, 'IN2005', 'Estadística y Probabilidades I', 4, ['CS1111', 'MA1002']],
    [4, 'CB2020', 'Fundamentos Matemáticos de Computación', 3, ['MA2001', 'CS1042']],
    [4, 'CB2040', 'Aspectos Legales y Éticos de Ciberseguridad', 4, ['CB1001']],
    [4, 'CS2023', 'Algoritmos y Estructuras de Datos', 4, ['CS1112']],
    // Ciclo 5 (19 cr)
    [5, 'CB3040', 'Estrategia y Gobernanza de Ciberseguridad', 3, ['CB2040']],
    [5, 'CS3040', 'Cloud Computing', 3, ['CS2014']],
    [5, 'CB2030', 'Redes y Comunicaciones', 3, ['CB2010']],
    [5, 'CB3010', 'Criptografía', 4, ['CB2020', 'CS2023']],
    [5, 'CS3015', 'Machine Learning', 4, ['CS1112', 'IN2005', 'MA1010']],
    [5, 'CS3045', 'Desarrollo Basado en Agentes', 2, ['CS2014']],
    // Ciclo 6 (22 cr)
    [6, 'CB3060', 'Ciberseguridad Aplicada a la IA', 4, ['CS3015', 'CB3010']],
    [6, 'CB3020', 'Seguridad de Redes y Comunicaciones', 4, ['CB2030', 'CB3010']],
    [6, 'CB3030', 'Software y Seguridad', 4, ['CB3010', 'CS2014']],
    [6, 'GH3010', 'Finanzas Empresariales', 3, []],
    [6, 'HH2102', 'Electivo de HACS II', 3, ['HH2101']],
    [6, 'CB3091', 'Electivo de Carrera I', 4, []],
    // Ciclo 7 (19 cr)
    [7, 'CB4010', 'IA Aplicada a la Ciberseguridad', 4, ['CB3060']],
    [7, 'CB4015', 'DevSecOps', 4, ['CS2014', 'CB2030']],
    [7, 'CB4020', 'Hacking Ético', 4, ['CB3030', 'CB3020', 'CB2040']],
    [7, 'CB4091', 'Electivo de Carrera II', 4, []],
    [7, 'HH3101', 'Electivo de HACS III', 3, ['HH2102']],
    // Ciclo 8 (16 cr)
    [8, 'PI3101', 'Electivo de Proyectos Interdisciplinarios', 3, ['PI1102']],
    [8, 'PR4010', 'Proyecto Preprofesional', 4, ['CB4020']],
    [8, 'GH4010', 'Emprendimiento II', 3, ['GH2001', 'GH3010']],
    [8, 'CB4092', 'Electivo de Carrera III', 4, []],
    [8, 'CB4080', 'Metodología de la Investigación', 2, ['CB4020', 'CB3040']],
    // Ciclo 9 (22 cr)
    [9, 'EL5001', 'Electivo Libre I', 4, []],
    [9, 'CB5005', 'Análisis Forense', 3, ['CB4020']],
    [9, 'CB5010', 'Trabajo de Investigación en Ciberseguridad I', 4, ['CB4080']],
    [9, 'GH5010', 'Ética en Computación', 3, []],
    [9, 'CS5091', 'Electivo de Computación e Ingeniería I', 4, []],
    [9, 'CS5092', 'Electivo de Computación e Ingeniería II', 4, []],
    // Ciclo 10 (22 cr)
    [10, 'CB5020', 'Seguridad de IoT y Tecnología Operativa', 3, ['CB3020']],
    [10, 'CS5093', 'Electivo de Computación e Ingeniería III', 4, []],
    [10, 'CB5090', 'Trabajo de Investigación en Ciberseguridad II', 4, ['CB5010']],
    [10, 'EL5002', 'Electivo Libre II', 4, []],
    [10, 'EL5003', 'Electivo Libre III', 4, []],
    [10, 'GH5020', 'Electivo de Gestión', 3, []]
  ],

  // ===========================================================================
  // 7. INGENIERÍA INDUSTRIAL (200 cr: 20, 20, 21, 20, 22, 21, 21, 16, 19, 20)
  // ===========================================================================
  ind: [
    // Ciclo 1 (20 cr)
    [1, 'CS1111', 'Programación I', 4, []],
    [1, 'MA1001', 'Fundamentos del Cálculo', 3, []],
    [1, 'QU1001', 'Química General y Experimental', 4, []],
    [1, 'HH1101', 'Comunicación Integral I', 3, []],
    [1, 'PI1101', 'Proyectos Interdisciplinarios I', 3, []],
    [1, 'IN1001', 'Introducción a la Ingeniería Industrial', 3, []],
    // Ciclo 2 (20 cr)
    [2, 'CS1112', 'Programación Orientada a Objetos', 4, ['CS1111']],
    [2, 'HH1102', 'Comunicación Integral II', 3, ['HH1101']],
    [2, 'MA1002', 'Cálculo de una Variable', 4, ['MA1001']],
    [2, 'MA1010', 'Álgebra Lineal', 3, []],
    [2, 'IN2001', 'Fundamentos de Operaciones', 4, ['MA1001', 'IN1001']],
    [2, 'IN2002', 'Data, Visualization & Storytelling', 2, []],
    // Ciclo 3 (21 cr)
    [3, 'HH2101', 'Electivo de HACS I', 3, []],
    [3, 'MA2001', 'Cálculo Multivariable', 3, ['MA1002']],
    [3, 'ME1002', 'Introducción a la Mecánica', 4, ['MA1001']],
    [3, 'IN2005', 'Estadística y Probabilidades I', 4, ['MA1002', 'CS1111']],
    [3, 'CS1040', 'Matemáticas Discreta I', 4, ['MA1001']],
    [3, 'IN2003', 'Gestión de Costos', 3, ['IN2001']],
    // Ciclo 4 (20 cr)
    [4, 'MA2015', 'Ecuaciones Diferenciales', 3, ['MA2001']],
    [4, 'PI1102', 'Proyectos Interdisciplinarios II', 2, ['PI1101']],
    [4, 'CS3015', 'IA: Introducción a Machine Learning', 3, ['MA1010', 'CS1112', 'IN2005']],
    [4, 'IN2004', 'Sistemas Integrados de Gestión', 4, ['IN2005', 'IN2001']],
    [4, 'IN2006', 'Estadística Aplicada y Diseño de Experimentos', 4, ['IN2005']],
    [4, 'IN2007', 'Investigación de Operaciones I: Modelos Determinísticos', 4, ['CS1040']],
    // Ciclo 5 (22 cr)
    [5, 'GH2001', 'Emprendimiento I', 3, []],
    [5, 'IN3001', 'Human Performance & Wellbeing', 3, ['IN2001']],
    [5, 'IN3002', 'Gestión de Cadenas de Suministro I', 4, ['IN2003', 'IN2005']],
    [5, 'IN3003', 'Investigación de Operaciones II: Modelos Probabilísticos', 4, ['IN2006']],
    [5, 'IN3004', 'Ingeniería Financiera', 4, ['MA1001']],
    [5, 'FI2030', 'Fundamentos de Electricidad y Magnetismo', 4, ['ME1002']],
    // Ciclo 6 (21 cr)
    [6, 'HH2102', 'Electivo de HACS II', 3, ['HH2101']],
    [6, 'IN3005', 'Lean Six Sigma', 3, ['IN2004', 'IN2006']],
    [6, 'IN3006', 'Gestión de Cadenas de Suministro II', 4, ['IN3002', 'IN2007']],
    [6, 'IN3007', 'Simulación de Operaciones', 3, ['IN3003']],
    [6, 'IN3091', 'Electivo de Carrera I', 4, []],
    [6, 'IN3092', 'Electivo de Carrera II', 4, []],
    // Ciclo 7 (21 cr)
    [7, 'PI3101', 'Electivo de Proyectos Interdisciplinarios', 3, ['PI1102']],
    [7, 'AD3008', 'Finanzas Corporativas', 3, ['IN3004']],
    [7, 'IN4001', 'Cadenas de Suministro en la Economía Circular', 4, ['IN3006']],
    [7, 'IN4002', 'Econometría & Estadística Multivariada', 3, ['IN2006']],
    [7, 'IN4091', 'Electivo de Carrera III', 4, []],
    [7, 'CS5091', 'Electivo de Ingeniería y Computación I', 4, []],
    // Ciclo 8 (16 cr)
    [8, 'PR4010', 'Proyecto Preprofesional', 4, ['IN3006']],
    [8, 'GH4010', 'Emprendimiento II', 3, ['GH2001', 'IN3004']],
    [8, 'IN4080', 'Introducción a Trabajo de Investigación en Ingeniería Industrial', 2, ['IN3007', 'IN3005', 'IN3006']],
    [8, 'IN4003', 'Decisiones Dinámicas e Inteligencia Artificial', 3, ['IN3007', 'IN3002']],
    [8, 'CS5092', 'Electivo de Ingeniería y Computación II', 4, []],
    // Ciclo 9 (19 cr)
    [9, 'HH3101', 'Electivo de HACS III', 3, ['HH2102']],
    [9, 'IN5001', 'Proyecto de Diseño Mayor en Ingeniería Industrial', 2, ['IN3005']],
    [9, 'IN5002', 'Proyecto Final de Ingeniería Industrial I', 3, ['IN4080']],
    [9, 'IN5003', 'Decisiones y Juegos Estratégicos', 3, ['IN4003']],
    [9, 'CS5093', 'Electivo de Ingeniería y Computación III', 4, []],
    [9, 'EL5001', 'Electivo Libre I', 4, []],
    // Ciclo 10 (20 cr)
    [10, 'GH5010', 'Ética y Tecnología', 3, []],
    [10, 'GH5020', 'Electivo de Gestión', 3, []],
    [10, 'IN5004', 'Proyecto Final de Ingeniería Industrial II', 3, ['IN5002']],
    [10, 'IN5005', 'Gestión Estratégica de Cadenas de Suministro', 3, ['IN3006']],
    [10, 'EL5002', 'Electivo Libre II', 4, []],
    [10, 'EL5003', 'Electivo Libre III', 4, []]
  ],

  // ===========================================================================
  // 8. BIOINGENIERÍA (200 cr: 20, 21, 20, 19, 17, 22, 21, 19, 19, 22)
  // ===========================================================================
  bio: [
    // Ciclo 1 (20 cr)
    [1, 'CS1111', 'Programación I', 4, []],
    [1, 'MA1001', 'Fundamentos del Cálculo', 3, []],
    [1, 'QU1001', 'Química General y Experimental', 4, []],
    [1, 'HH1101', 'Comunicación Integral I', 3, []],
    [1, 'PI1101', 'Proyectos Interdisciplinarios I', 3, []],
    [1, 'BI1001', 'Introducción a la Bioingeniería', 3, []],
    // Ciclo 2 (21 cr)
    [2, 'CS1112', 'Programación II', 4, ['CS1111']],
    [2, 'BI1002', 'Biología para Ingenieros', 3, []],
    [2, 'MA1002', 'Cálculo de una Variable', 4, ['MA1001']],
    [2, 'MA1010', 'Álgebra Lineal', 3, []],
    [2, 'ME1002', 'Introducción a la Mecánica', 4, ['MA1001']],
    [2, 'QU1002', 'Química Aplicada', 3, ['QU1001']],
    // Ciclo 3 (20 cr)
    [3, 'ME2001', 'Ingeniería de Materiales', 4, ['QU1001', 'ME1002']],
    [3, 'MA2001', 'Cálculo Multivariable', 3, ['MA1002']],
    [3, 'FI2030', 'Fundamentos de Electricidad y Magnetismo', 4, ['ME1002']],
    [3, 'IN2005', 'Estadística y Probabilidades I', 4, ['MA1002', 'CS1111']],
    [3, 'QU2001', 'Fisicoquímica', 2, ['QU1002']],
    [3, 'BI2001', 'Macromoléculas', 3, ['BI1002']],
    // Ciclo 4 (19 cr)
    [4, 'MA2015', 'Ecuaciones Diferenciales', 3, ['MA2001']],
    [4, 'CS3015', 'IA: Introducción a Machine Learning', 3, ['MA1010', 'CS1112', 'IN2005']],
    [4, 'ME2002', 'Fundamentos de Termodinámica', 2, ['ME1002', 'QU1002']],
    [4, 'EL2001', 'Circuitos Eléctricos y Electrónicos I', 4, ['FI2030', 'MA2001']],
    [4, 'BI2002', 'Biología Celular y Molecular', 4, ['BI2001']],
    [4, 'HH1102', 'Comunicación Integral II', 3, ['HH1101']],
    // Ciclo 5 (17 cr)
    [5, 'DS2010', 'Métodos Numéricos', 3, ['MA2015', 'MA1010']],
    [5, 'BI3001', 'Termodinámica en Bioingeniería', 2, ['ME2002']],
    [5, 'BI3002', 'Fundamentos de Biofísica', 4, ['ME2001']],
    [5, 'EL3001', 'Modelado y Simulación', 3, ['FI2030', 'MA2015']],
    [5, 'PI1102', 'Proyectos Interdisciplinarios II', 2, ['PI1101']],
    [5, 'HH2101', 'Electivo de HACS I', 3, []],
    // Ciclo 6 (22 cr)
    [6, 'GH2001', 'Emprendimiento I', 3, []],
    [6, 'BI3003', 'Análisis de Señales y Sistemas para Bioingeniería', 4, ['DS2010', 'EL2001']],
    [6, 'BI3091', 'Electivo de Carrera I', 4, []],
    [6, 'BI3092', 'Electivo de Carrera II', 4, []],
    [6, 'BI3004', 'Principios de Biomecánica', 4, ['BI3002']],
    [6, 'BI3005', 'Fenómenos de Transporte', 3, ['BI3001']],
    // Ciclo 7 (21 cr)
    [7, 'HH2102', 'Electivo de HACS II', 3, ['HH2101']],
    [7, 'BI4001', 'Biodiseño', 4, ['BI3004']],
    [7, 'BI4002', 'Bioinformática', 4, ['CS3015']],
    [7, 'BI4091', 'Electivo de Carrera III', 4, []],
    [7, 'BI4003', 'Fisiología y Fisiopatología', 3, ['BI2002']],
    [7, 'BI4004', 'Biotransporte', 3, ['BI3005']],
    // Ciclo 8 (19 cr)
    [8, 'GH3010', 'Finanzas Empresariales', 3, []],
    [8, 'PR4010', 'Proyecto Preprofesional', 4, ['BI4001']],
    [8, 'BI4080', 'Introducción a Trabajo de Investigación en Bioingeniería', 2, ['BI4001']],
    [8, 'PI3101', 'Electivo de Proyectos Interdisciplinarios', 3, ['PI1102']],
    [8, 'HH3101', 'Electivo de HACS III', 3, ['HH2102']],
    [8, 'EL5001', 'Electivo Libre I', 4, []],
    // Ciclo 9 (19 cr)
    [9, 'BI5001', 'Proyecto Final de Bioingeniería I', 3, ['BI4080']],
    [9, 'GH4010', 'Emprendimiento II', 3, ['GH2001', 'GH3010']],
    [9, 'GH5010', 'Ética y Tecnología', 3, []],
    [9, 'BI5002', 'Proyecto de Diseño Mayor en Bioingeniería', 2, ['BI4001']],
    [9, 'CS5091', 'Electivo de Ingeniería y Computación I', 4, []],
    [9, 'EL5002', 'Electivo Libre II', 4, []],
    // Ciclo 10 (22 cr)
    [10, 'GH5020', 'Electivo de Gestión', 3, []],
    [10, 'BI5003', 'Proyecto Final de Bioingeniería II', 3, ['BI5001']],
    [10, 'CS5092', 'Electivo de Ingeniería y Computación II', 4, []],
    [10, 'CS5093', 'Electivo de Ingeniería y Computación III', 4, []],
    [10, 'BI5004', 'Instrumentación Biomédica', 4, ['BI4003', 'BI3003']],
    [10, 'EL5003', 'Electivo Libre III', 4, []]
  ],

  // ===========================================================================
  // 9. INGENIERÍA DE LA ENERGÍA (200 cr: 20, 22, 21, 20, 21, 21, 23, 14, 20, 18)
  // ===========================================================================
  ene: [
    // Ciclo 1 (20 cr)
    [1, 'CS1111', 'Programación I', 4, []],
    [1, 'MA1001', 'Fundamentos del Cálculo', 3, []],
    [1, 'QU1001', 'Química General y Experimental', 4, []],
    [1, 'HH1101', 'Comunicación Integral I', 3, []],
    [1, 'PI1101', 'Proyectos Interdisciplinarios I', 3, []],
    [1, 'EN1001', 'Introducción a la Ingeniería de la Energía', 3, []],
    // Ciclo 2 (22 cr)
    [2, 'CS1112', 'Programación II', 4, ['CS1111']],
    [2, 'HH1102', 'Comunicación Integral II', 3, ['HH1101']],
    [2, 'MA1002', 'Cálculo de una Variable', 4, ['MA1001']],
    [2, 'MA1010', 'Álgebra Lineal', 3, []],
    [2, 'ME1002', 'Introducción a la Mecánica', 4, ['MA1001']],
    [2, 'ME1003', 'Dibujo para Ingeniería', 4, []],
    // Ciclo 3 (21 cr)
    [3, 'MA2001', 'Cálculo Multivariable', 3, ['MA1002']],
    [3, 'FI2030', 'Fundamentos de Electricidad y Magnetismo', 4, ['ME1002']],
    [3, 'IN2005', 'Estadística y Probabilidades I', 4, ['MA1002', 'CS1111']],
    [3, 'EN2001', 'Energía y Medioambiente', 3, ['QU1001']],
    [3, 'HH2101', 'Electivo de HACS I', 3, []],
    [3, 'ME2003', 'Termodinámica Aplicada', 4, ['QU1001']],
    // Ciclo 4 (20 cr)
    [4, 'MA2015', 'Ecuaciones Diferenciales', 3, ['MA2001']],
    [4, 'GH2001', 'Emprendimiento I', 3, []],
    [4, 'PI1102', 'Proyectos Interdisciplinarios II', 2, ['PI1101']],
    [4, 'HH2102', 'Electivo de HACS II', 3, ['HH2101']],
    [4, 'EN2002', 'Ingeniería Eléctrica', 5, ['FI2030']],
    [4, 'EN2003', 'Marco Legal y Política Energética', 4, []],
    // Ciclo 5 (21 cr)
    [5, 'CS3015', 'IA: Introducción a Machine Learning', 3, ['MA1010', 'CS1112', 'IN2005']],
    [5, 'DS2010', 'Métodos Numéricos', 3, ['MA2015', 'MA1010']],
    [5, 'EN3001', 'Máquinas Eléctricas', 4, ['FI2030']],
    [5, 'EN3002', 'Centrales Eólicas e Hidráulicas', 4, ['EN2002']],
    [5, 'ME3001', 'Mecánica de Fluidos', 4, ['ME2003']],
    [5, 'HH3101', 'Electivo de HACS III', 3, ['HH2102']],
    // Ciclo 6 (21 cr)
    [6, 'EN3003', 'Sistemas Eléctricos y Electrónicos de Potencia', 4, ['EN3001']],
    [6, 'EN3004', 'Automatización de Sistemas', 4, ['EN3001']],
    [6, 'GH3010', 'Finanzas Empresariales', 3, []],
    [6, 'GH4010', 'Emprendimiento II', 3, ['GH2001', 'GH3010']],
    [6, 'ME3002', 'Transferencia de Calor y Masa', 4, ['ME3001']],
    [6, 'EN3005', 'Planificación y Economía de la Energía', 3, ['EN2003', 'EN3002']],
    // Ciclo 7 (23 cr)
    [7, 'PI3101', 'Electivo de Proyectos Interdisciplinarios', 3, ['PI1102']],
    [7, 'EN4001', 'Gemelos Digitales y SmartGrid', 4, ['EN3004']],
    [7, 'EN4091', 'Electivo de Carrera I', 4, []],
    [7, 'EL5001', 'Electivo Libre I', 4, []],
    [7, 'EN4002', 'Sistemas y Centrales Térmicas', 4, ['ME3002']],
    [7, 'EN4003', 'Ingeniería del Petróleo', 4, ['ME3002']],
    // Ciclo 8 (14 cr)
    [8, 'EN4080', 'Introducción al Proyecto Final de Ingeniería de la Energía', 2, ['EN4002']],
    [8, 'EN4092', 'Electivo de Carrera II', 4, []],
    [8, 'EL5002', 'Electivo Libre II', 4, []],
    [8, 'PR4010', 'Proyecto Preprofesional', 4, ['EN4001']],
    // Ciclo 9 (20 cr)
    [9, 'EN5001', 'Proyecto Final de Ingeniería de la Energía I', 3, ['EN4080']],
    [9, 'EN5091', 'Electivo de Carrera III', 4, []],
    [9, 'EL5003', 'Electivo Libre III', 4, []],
    [9, 'CS5091', 'Electivo de Ingeniería y Computación I', 4, []],
    [9, 'EN5002', 'Proyecto de Diseño Mayor en Ingeniería de la Energía', 2, ['EN4001']],
    [9, 'GH5010', 'Ética y Tecnología', 3, []],
    // Ciclo 10 (18 cr)
    [10, 'GH5020', 'Electivo de Gestión', 3, []],
    [10, 'EN5003', 'Proyecto Final de Ingeniería de la Energía II', 3, ['EN5001']],
    [10, 'EN5092', 'Electivo de Carrera IV', 4, []],
    [10, 'CS5092', 'Electivo de Ingeniería y Computación II', 4, []],
    [10, 'CS5093', 'Electivo de Ingeniería y Computación III', 4, []]
  ],

  // ===========================================================================
  // 10. INGENIERÍA MECÁNICA (200 cr: 20, 22, 21, 20, 22, 22, 21, 14, 20, 18)
  // ===========================================================================
  mec: [
    // Ciclo 1 (20 cr)
    [1, 'CS1111', 'Programación I', 4, []],
    [1, 'MA1001', 'Fundamentos del Cálculo', 3, []],
    [1, 'QU1001', 'Química General y Experimental', 4, []],
    [1, 'HH1101', 'Comunicación Integral I', 3, []],
    [1, 'PI1101', 'Proyectos Interdisciplinarios I', 3, []],
    [1, 'ME1001', 'Introducción a la Ingeniería Mecánica', 3, []],
    // Ciclo 2 (22 cr)
    [2, 'CS1112', 'Programación II', 4, ['CS1111']],
    [2, 'HH1102', 'Comunicación Integral II', 3, ['HH1101']],
    [2, 'MA1002', 'Cálculo de una Variable', 4, ['MA1001']],
    [2, 'MA1010', 'Álgebra Lineal', 3, []],
    [2, 'ME1002', 'Introducción a la Mecánica', 4, ['MA1001']],
    [2, 'ME1003', 'Dibujo para Ingeniería', 4, []],
    // Ciclo 3 (21 cr)
    [3, 'MA2001', 'Cálculo Multivariable', 3, ['MA1002']],
    [3, 'FI2030', 'Fundamentos de Electricidad y Magnetismo', 4, ['ME1002']],
    [3, 'IN2005', 'Estadística y Probabilidades I', 4, ['MA1002', 'CS1111']],
    [3, 'ME2004', 'Ciencia de los Materiales', 3, ['QU1001', 'ME1002']],
    [3, 'HH2101', 'Electivo de HACS I', 3, []],
    [3, 'ME2003', 'Termodinámica Aplicada', 4, ['QU1001']],
    // Ciclo 4 (20 cr)
    [4, 'MA2015', 'Ecuaciones Diferenciales', 3, ['MA2001']],
    [4, 'GH2001', 'Emprendimiento I', 3, []],
    [4, 'PI1102', 'Proyectos Interdisciplinarios II', 2, ['PI1101']],
    [4, 'ME2005', 'Estática', 4, ['ME1002', 'MA2001']],
    [4, 'ME2001', 'Ingeniería de Materiales', 4, ['ME1002']],
    [4, 'EN3001', 'Máquinas Eléctricas', 4, ['FI2030']],
    // Ciclo 5 (22 cr)
    [5, 'CS3015', 'IA: Introducción a Machine Learning', 3, ['MA1010', 'CS1112', 'IN2005']],
    [5, 'DS2010', 'Métodos Numéricos', 3, ['MA2015', 'MA1010']],
    [5, 'ME3001', 'Mecánica de Fluidos', 4, ['ME2003']],
    [5, 'ME3003', 'Mecánica de Materiales', 4, ['ME2005']],
    [5, 'ME3004', 'Dinámica', 4, ['ME2005']],
    [5, 'EN3004', 'Automatización de Sistemas', 4, ['EN3001']],
    // Ciclo 6 (22 cr)
    [6, 'GH3010', 'Finanzas Empresariales', 3, []],
    [6, 'HH2102', 'Electivo de HACS II', 3, ['HH2101']],
    [6, 'ME3005', 'Procesos de Manufactura', 4, ['ME1003', 'ME2001']],
    [6, 'ME3006', 'Diseño Mecánico I', 4, ['ME3004', 'ME3003']],
    [6, 'ME3007', 'Gestión de Proyectos y Contratos', 4, ['ME3003']],
    [6, 'ME3002', 'Transferencia de Calor y Masa', 4, ['ME3001']],
    // Ciclo 7 (21 cr)
    [7, 'GH4010', 'Emprendimiento II', 3, ['GH2001', 'GH3010']],
    [7, 'HH3101', 'Electivo de HACS III', 3, ['HH2102']],
    [7, 'PI3101', 'Electivo de Proyectos Interdisciplinarios', 3, ['PI1102']],
    [7, 'EN4002', 'Sistemas y Centrales Térmicas', 4, ['ME3002']],
    [7, 'ME4091', 'Electivo de Carrera I', 4, []],
    [7, 'EL5001', 'Electivo Libre I', 4, []],
    // Ciclo 8 (14 cr)
    [8, 'ME4080', 'Introducción al Proyecto Final de Ingeniería Mecánica', 2, ['ME3006']],
    [8, 'ME4092', 'Electivo de Carrera II', 4, []],
    [8, 'EL5002', 'Electivo Libre II', 4, []],
    [8, 'PR4010', 'Proyecto Preprofesional', 4, ['ME3006']],
    // Ciclo 9 (20 cr)
    [9, 'ME5001', 'Proyecto Final de Ingeniería Mecánica I', 3, ['ME4080']],
    [9, 'ME5091', 'Electivo de Carrera III', 4, []],
    [9, 'EL5003', 'Electivo Libre III', 4, []],
    [9, 'CS5091', 'Electivo de Ingeniería y Computación I', 4, []],
    [9, 'ME5002', 'Proyecto de Diseño Mayor en Ingeniería Mecánica', 2, ['ME3006']],
    [9, 'GH5010', 'Ética y Tecnología', 3, []],
    // Ciclo 10 (18 cr)
    [10, 'GH5020', 'Electivo de Gestión', 3, []],
    [10, 'ME5003', 'Proyecto Final de Ingeniería Mecánica II', 3, ['ME5001']],
    [10, 'ME5092', 'Electivo de Carrera IV', 4, []],
    [10, 'CS5092', 'Electivo de Ingeniería y Computación II', 4, []],
    [10, 'CS5093', 'Electivo de Ingeniería y Computación III', 4, []]
  ],

  // ===========================================================================
  // 11. INGENIERÍA QUÍMICA (200 cr: 20, 22, 21, 19, 18, 21, 22, 19, 18, 20)
  // ===========================================================================
  iqu: [
    // Ciclo 1 (20 cr)
    [1, 'CS1111', 'Programación I', 4, []],
    [1, 'MA1001', 'Fundamentos del Cálculo', 3, []],
    [1, 'QU1001', 'Química General y Experimental', 4, []],
    [1, 'HH1101', 'Comunicación Integral I', 3, []],
    [1, 'PI1101', 'Proyectos Interdisciplinarios I', 3, []],
    [1, 'IQ1001', 'Introducción a la Ingeniería Química', 3, []],
    // Ciclo 2 (22 cr)
    [2, 'IQ1002', 'Química Avanzada', 4, ['QU1001']],
    [2, 'HH1102', 'Comunicación Integral II', 3, ['HH1101']],
    [2, 'MA1002', 'Cálculo de una Variable', 4, ['MA1001']],
    [2, 'MA1010', 'Álgebra Lineal', 3, []],
    [2, 'ME1002', 'Introducción a la Mecánica', 4, ['MA1001']],
    [2, 'CS1112', 'Programación II', 4, ['CS1111']],
    // Ciclo 3 (21 cr)
    [3, 'HH2101', 'Electivo de HACS I', 3, []],
    [3, 'MA2001', 'Cálculo Multivariable', 3, ['MA1002']],
    [3, 'FI2030', 'Fundamentos de Electricidad y Magnetismo', 4, ['ME1002']],
    [3, 'QU2001', 'Fisicoquímica', 2, ['IQ1002']],
    [3, 'IN2005', 'Estadística y Probabilidades I', 4, ['MA1002', 'CS1111']],
    [3, 'IQ2001', 'Química Orgánica Aplicada', 5, ['IQ1001', 'IQ1002']],
    // Ciclo 4 (19 cr)
    [4, 'ME2004', 'Ciencia de los Materiales', 3, ['QU1001', 'ME1002']],
    [4, 'MA2015', 'Ecuaciones Diferenciales', 3, ['MA2001']],
    [4, 'PI1102', 'Proyectos Interdisciplinarios II', 2, ['PI1101']],
    [4, 'IQ2002', 'Análisis Químico para Ingeniería', 5, ['IQ2001', 'IN2005']],
    [4, 'IQ2003', 'Análisis de Procesos Químicos', 4, ['MA1010', 'IQ1002']],
    [4, 'ME2002', 'Fundamentos de Termodinámica', 2, ['ME1002', 'IQ1002']],
    // Ciclo 5 (18 cr)
    [5, 'HH2102', 'Electivo de HACS II', 3, ['HH2101']],
    [5, 'GH2001', 'Emprendimiento I', 3, []],
    [5, 'DS2010', 'Métodos Numéricos', 3, ['MA2015', 'MA1010']],
    [5, 'IQ3001', 'Fenómenos de Transporte', 3, ['ME2002', 'IQ2001', 'CS1111']],
    [5, 'IQ3002', 'Mecánica de Fluidos para Ingeniería Química', 3, ['ME2002', 'MA2015']],
    [5, 'IQ3003', 'Termodinámica Química', 3, ['ME2002', 'IQ2001', 'QU2001', 'CS1111']],
    // Ciclo 6 (21 cr)
    [6, 'EL5001', 'Electivo Libre I', 4, []],
    [6, 'GH3010', 'Finanzas Empresariales', 3, []],
    [6, 'IQ3091', 'Electivo de Carrera I', 4, []],
    [6, 'IQ3092', 'Electivo de Carrera II', 4, []],
    [6, 'IQ3004', 'Transferencia de Masa', 3, ['IQ2003', 'IQ3001']],
    [6, 'IQ3005', 'Transferencia de Calor', 3, ['FI2030', 'IQ3002']],
    // Ciclo 7 (22 cr)
    [7, 'EL5002', 'Electivo Libre II', 4, []],
    [7, 'IQ4001', 'Ingeniería Química como Profesión', 2, ['IQ3001']],
    [7, 'IQ4002', 'Operaciones Unitarias', 5, ['IQ3003', 'IQ3002', 'IQ2003']],
    [7, 'IQ4003', 'Diseño de Reactores Químicos', 4, ['IQ2003', 'IQ3001']],
    [7, 'IQ4091', 'Electivo de Carrera III', 4, []],
    [7, 'CS3015', 'IA: Introducción a Machine Learning', 3, ['MA1010', 'CS1112', 'IN2005']],
    // Ciclo 8 (19 cr)
    [8, 'HH3101', 'Electivo de HACS III', 3, ['HH2102']],
    [8, 'IQ4004', 'Modelamiento y Simulación de Procesos Aplicado', 4, ['IQ3004', 'IQ3005']],
    [8, 'GH4010', 'Emprendimiento II', 3, ['GH2001', 'GH3010']],
    [8, 'PI3101', 'Electivo de Proyectos Interdisciplinarios', 3, ['PI1102']],
    [8, 'PR4010', 'Proyecto Preprofesional', 4, ['IQ4002']],
    [8, 'IQ4080', 'Introducción al Proyecto Final de Ingeniería Química', 2, ['GH2001', 'IQ3005', 'PI1102']],
    // Ciclo 9 (18 cr)
    [9, 'GH5010', 'Ética y Tecnología', 3, []],
    [9, 'IQ5001', 'Control de Procesos Químicos', 3, ['IQ4004', 'IQ4003']],
    [9, 'IQ5002', 'Proyecto de Diseño Mayor en Ingeniería Química', 2, ['IQ4004', 'IQ4001']],
    [9, 'IQ5003', 'Diseño de Plantas de Procesos', 3, ['IQ4002', 'IQ4003', 'IQ4004']],
    [9, 'CS5091', 'Electivo de Computación e Ingeniería I', 4, []],
    [9, 'IQ5004', 'Proyecto Final de Ingeniería Química I', 3, ['IQ4080']],
    // Ciclo 10 (20 cr)
    [10, 'GH5020', 'Electivo de Gestión', 3, []],
    [10, 'IQ5005', 'Ingeniería de Seguridad de Procesos', 2, ['IQ5003', 'IQ5001']],
    [10, 'EL5003', 'Electivo Libre III', 4, []],
    [10, 'CS5092', 'Electivo de Ingeniería y Computación II', 4, []],
    [10, 'CS5093', 'Electivo de Ingeniería y Computación III', 4, []],
    [10, 'IQ5006', 'Proyecto Final de Ingeniería Química II', 3, ['IQ5004', 'IQ5003']]
  ],

  // ===========================================================================
  // 12. INGENIERÍA AMBIENTAL (200 cr: 20, 21, 21, 16, 21, 22, 22, 15, 20, 22)
  // ===========================================================================
  amb: [
    // Ciclo 1 (20 cr)
    [1, 'CS1111', 'Programación I', 4, []],
    [1, 'MA1001', 'Fundamentos del Cálculo', 3, []],
    [1, 'QU1001', 'Química General y Experimental', 4, []],
    [1, 'AM1001', 'Introducción a la Ingeniería Ambiental', 3, []],
    [1, 'HH1101', 'Comunicación Integral I', 3, []],
    [1, 'PI1101', 'Proyectos Interdisciplinarios I', 3, []],
    // Ciclo 2 (21 cr)
    [2, 'CS1112', 'Programación Orientada a Objetos', 4, ['CS1111']],
    [2, 'MA1002', 'Cálculo de una Variable', 4, ['MA1001']],
    [2, 'MA1010', 'Álgebra Lineal', 3, []],
    [2, 'AM1002', 'Química Orgánica e Inorgánica', 4, ['QU1001']],
    [2, 'AM1003', 'Herramientas Computacionales Aplicadas a Ing. Ambiental', 3, []],
    [2, 'HH1102', 'Comunicación Integral II', 3, ['HH1101']],
    // Ciclo 3 (21 cr)
    [3, 'MA2001', 'Cálculo Multivariable', 3, ['MA1002']],
    [3, 'IN2005', 'Estadística y Probabilidades I', 4, ['MA1002', 'CS1111']],
    [3, 'ME1002', 'Introducción a la Mecánica', 4, ['MA1001']],
    [3, 'AM2001', 'Química Ambiental', 4, ['AM1002']],
    [3, 'AM2002', 'Introducción a Sistemas de la Tierra', 3, []],
    [3, 'HH2101', 'Electivo de HACS I', 3, []],
    // Ciclo 4 (16 cr)
    [4, 'MA2015', 'Ecuaciones Diferenciales', 3, ['MA2001']],
    [4, 'ME2003', 'Termodinámica', 4, ['QU1001', 'ME1002']],
    [4, 'CS3015', 'IA: Introducción a Machine Learning', 3, ['MA1010', 'CS1112', 'IN2005']],
    [4, 'AM2003', 'Mecánica de Fluidos Aplicada', 4, ['ME1002']],
    [4, 'PI1102', 'Proyectos Interdisciplinarios II', 2, ['PI1101']],
    // Ciclo 5 (21 cr)
    [5, 'DS2010', 'Métodos Numéricos', 3, ['MA2015', 'MA1010']],
    [5, 'GH2001', 'Emprendimiento I', 3, []],
    [5, 'AM3001', 'Hidrología', 4, ['ME1002']],
    [5, 'AM3002', 'Contaminación Atmosférica y Sonora', 4, ['AM2003']],
    [5, 'AM3003', 'Biología, Ecología y Recursos Naturales', 4, ['AM2002']],
    [5, 'AM3004', 'Teledetección e Inteligencia Artificial Aplicada', 3, ['AM1003', 'CS3015']],
    // Ciclo 6 (22 cr)
    [6, 'HH2102', 'Electivo de HACS II', 3, ['HH2101']],
    [6, 'GH3010', 'Finanzas Empresariales', 3, []],
    [6, 'AM3005', 'Ciencia de Datos Ambientales', 4, ['AM3004']],
    [6, 'AM3006', 'Transición Energética y Sostenibilidad', 4, ['ME2003']],
    [6, 'AM3007', 'Microbiología Ambiental', 4, ['AM2001', 'AM2003']],
    [6, 'AM3091', 'Electivo de Carrera I', 4, []],
    // Ciclo 7 (22 cr)
    [7, 'HH3101', 'Electivo de HACS III', 3, ['HH2102']],
    [7, 'PI3101', 'Electivo de Proyectos Interdisciplinarios', 3, ['PI1102']],
    [7, 'AM4001', 'Monitoreo Ambiental', 5, ['AM3001', 'AM3002', 'AM3003']],
    [7, 'AM4002', 'Cambio Climático', 3, ['AM2003', 'AM3001']],
    [7, 'AM4091', 'Electivo de Carrera II', 4, []],
    [7, 'AM4092', 'Electivo de Carrera III', 4, []],
    // Ciclo 8 (15 cr)
    [8, 'PR4010', 'Proyecto Preprofesional', 4, ['AM4001']],
    [8, 'GH4010', 'Emprendimiento II', 3, ['GH2001', 'GH3010']],
    [8, 'AM4003', 'Leyes y Derechos Ambientales', 3, ['AM4001']],
    [8, 'AM4004', 'Gestión Ambiental', 3, ['AM4001']],
    [8, 'AM4080', 'Introducción al Proyecto Final de Ingeniería Ambiental', 2, ['AM4001', 'AM3005']],
    // Ciclo 9 (20 cr)
    [9, 'GH5010', 'Ética y Tecnología', 3, []],
    [9, 'AM5001', 'Proyecto Final en Ingeniería Ambiental I', 3, ['AM4080']],
    [9, 'AM5002', 'Proyecto de Diseño Mayor en Ingeniería Ambiental', 2, ['AM4001']],
    [9, 'CS5091', 'Electivo de Ingeniería y Computación I', 4, []],
    [9, 'CS5092', 'Electivo de Ingeniería y Computación II', 4, []],
    [9, 'EL5001', 'Electivo Libre I', 4, []],
    // Ciclo 10 (22 cr)
    [10, 'GH5020', 'Electivo de Gestión', 3, []],
    [10, 'AM5003', 'Proyecto Final en Ingeniería Ambiental II', 3, ['AM5001']],
    [10, 'AM5004', 'Estudios de Impacto Ambiental', 4, ['AM4001']],
    [10, 'CS5093', 'Electivo de Ingeniería y Computación III', 4, []],
    [10, 'EL5002', 'Electivo Libre II', 4, []],
    [10, 'EL5003', 'Electivo Libre III', 4, []]
  ],

  // ===========================================================================
  // 13. INGENIERÍA CIVIL (200 cr: 20, 22, 20, 22, 22, 22, 18, 13, 19, 22)
  // ===========================================================================
  civ: [
    // Ciclo 1 (20 cr)
    [1, 'CS1111', 'Programación I', 4, []],
    [1, 'MA1001', 'Fundamentos del Cálculo', 3, []],
    [1, 'QU1001', 'Química General y Experimental', 4, []],
    [1, 'CV1001', 'Introducción a la Ingeniería Civil', 3, []],
    [1, 'HH1101', 'Comunicación Integral I', 3, []],
    [1, 'PI1101', 'Proyectos Interdisciplinarios I', 3, []],
    // Ciclo 2 (22 cr)
    [2, 'CS1112', 'Programación Orientada a Objetos', 4, ['CS1111']],
    [2, 'MA1002', 'Cálculo de una Variable', 4, ['MA1001']],
    [2, 'MA1010', 'Álgebra Lineal', 3, []],
    [2, 'ME1002', 'Introducción a la Mecánica', 4, ['MA1001']],
    [2, 'CV1002', 'Diseño Gráfico Ingenieril y Modelado 3D', 4, []],
    [2, 'HH1102', 'Comunicación Integral II', 3, ['HH1101']],
    // Ciclo 3 (20 cr)
    [3, 'MA2001', 'Cálculo Multivariable', 3, ['MA1002']],
    [3, 'IN2005', 'Estadística y Probabilidades I', 4, ['MA1002', 'CS1111']],
    [3, 'PI1102', 'Proyectos Interdisciplinarios II', 2, ['PI1101']],
    [3, 'CV2001', 'Mecánica Vectorial para Estructuras', 5, ['ME1002']],
    [3, 'CV2002', 'Tecnologías Aplicadas en Proyectos de Construcción', 3, ['CV1002']],
    [3, 'HH2101', 'Electivo de HACS I', 3, []],
    // Ciclo 4 (22 cr)
    [4, 'MA2015', 'Ecuaciones Diferenciales', 3, ['MA2001']],
    [4, 'ME2003', 'Termodinámica', 4, ['QU1001', 'ME1002']],
    [4, 'CS3015', 'IA: Introducción a Machine Learning', 3, ['MA1010', 'CS1112', 'IN2005']],
    [4, 'CV2003', 'Geomática Aplicada', 4, ['CV1002']],
    [4, 'CV2004', 'Mecánica Estructural', 4, ['CV2001']],
    [4, 'CV2005', 'Geología Aplicada', 4, []],
    // Ciclo 5 (22 cr)
    [5, 'DS2010', 'Métodos Numéricos', 3, ['MA2015', 'MA1010']],
    [5, 'GH2001', 'Emprendimiento I', 3, []],
    [5, 'CV3001', 'Mecánica de Suelos', 4, ['CV2005', 'ME1002']],
    [5, 'CV3002', 'Tecnología de los Materiales de Construcción', 4, ['CV2002', 'CV2004']],
    [5, 'CV3003', 'Planeamiento e Ingeniería Urbana', 4, ['CV2003']],
    [5, 'AM2003', 'Mecánica de Fluidos Aplicada', 4, ['ME1002']],
    // Ciclo 6 (22 cr)
    [6, 'HH2102', 'Electivo de HACS II', 3, ['HH2101']],
    [6, 'GH3010', 'Finanzas Empresariales', 3, []],
    [6, 'CV3004', 'Gestión de la Planificación en la Construcción', 3, ['CV2002']],
    [6, 'CV3005', 'Análisis Estructural', 5, ['CV2004']],
    [6, 'CV3006', 'Tecnología del Concreto', 4, ['CV3002']],
    [6, 'AM3001', 'Hidrología', 4, ['ME1002']],
    // Ciclo 7 (18 cr)
    [7, 'HH3101', 'Electivo de HACS III', 3, ['HH2102']],
    [7, 'PI3101', 'Electivo de Proyectos Interdisciplinarios', 3, ['PI1102']],
    [7, 'CV4091', 'Electivo de Carrera I', 4, []],
    [7, 'CV4092', 'Electivo de Carrera II', 4, []],
    [7, 'CV4093', 'Electivo de Carrera III', 4, []],
    // Ciclo 8 (13 cr)
    [8, 'PR4010', 'Proyecto Preprofesional', 4, ['CV3004']],
    [8, 'GH4010', 'Emprendimiento II', 3, ['GH2001', 'GH3010']],
    [8, 'CV4094', 'Electivo de Carrera IV', 4, []],
    [8, 'CV4080', 'Introducción al Proyecto Final de Ingeniería Civil', 2, ['CV3004']],
    // Ciclo 9 (19 cr)
    [9, 'GH5010', 'Ética y Tecnología', 3, []],
    [9, 'CV5001', 'Proyecto Final de Ingeniería Civil I', 3, ['CV4080']],
    [9, 'CV5002', 'Proyecto de Diseño Mayor en Ingeniería Civil', 2, ['CV3005']],
    [9, 'CV5003', 'Gestión del Presupuesto en la Construcción', 3, ['CV3004']],
    [9, 'CS5091', 'Electivo de Ingeniería y Computación I', 4, []],
    [9, 'EL5001', 'Electivo Libre I', 4, []],
    // Ciclo 10 (22 cr)
    [10, 'GH5020', 'Electivo de Gestión', 3, []],
    [10, 'CV5004', 'Proyecto Final de Ingeniería Civil II', 3, ['CV5001']],
    [10, 'CS5092', 'Electivo de Ingeniería y Computación II', 4, []],
    [10, 'EL5002', 'Electivo Libre II', 4, []],
    [10, 'CS5093', 'Electivo de Ingeniería y Computación III', 4, []],
    [10, 'EL5003', 'Electivo Libre III', 4, []]
  ],

  // ===========================================================================
  // 14. INGENIERÍA ELECTRÓNICA (200 cr: 20, 20, 22, 20, 21, 21, 19, 16, 19, 22)
  // ===========================================================================
  ele: [
    // Ciclo 1 (20 cr)
    [1, 'MA1001', 'Fundamentos del Cálculo', 3, []],
    [1, 'QU1001', 'Química General y Experimental', 4, []],
    [1, 'CS1111', 'Programación I', 4, []],
    [1, 'HH1101', 'Comunicación Integral I', 3, []],
    [1, 'PI1101', 'Proyectos Interdisciplinarios I', 3, []],
    [1, 'EL1001', 'Introducción a la Ingeniería Electrónica', 3, []],
    // Ciclo 2 (20 cr)
    [2, 'MA1002', 'Cálculo de una Variable', 4, ['MA1001']],
    [2, 'MA1010', 'Álgebra Lineal', 3, []],
    [2, 'ME1002', 'Introducción a la Mecánica', 4, ['MA1001']],
    [2, 'CS1112', 'Programación II', 4, ['CS1111']],
    [2, 'HH1102', 'Comunicación Integral II', 3, ['HH1101']],
    [2, 'PI1102', 'Proyectos Interdisciplinarios II', 2, ['PI1101']],
    // Ciclo 3 (22 cr)
    [3, 'MA2001', 'Cálculo Multivariable', 3, ['MA1002']],
    [3, 'IN2005', 'Estadística y Probabilidades I', 4, ['MA1002', 'CS1111']],
    [3, 'FI2030', 'Fundamentos de Electricidad y Magnetismo', 4, ['ME1002']],
    [3, 'ME2003', 'Termodinámica', 4, ['QU1001', 'ME1002']],
    [3, 'EL2013', 'Circuitos Digitales', 4, ['CS1111', 'EL1001']],
    [3, 'HH2101', 'Electivo de HACS I', 3, []],
    // Ciclo 4 (20 cr)
    [4, 'MA2015', 'Ecuaciones Diferenciales', 3, ['MA2001']],
    [4, 'CS3015', 'IA: Introducción a Machine Learning', 3, ['MA1010', 'CS1112', 'IN2005']],
    [4, 'EL2002', 'Computación en la Nube', 2, ['CS1112']],
    [4, 'EL2003', 'Circuitos Eléctricos', 5, ['MA2001', 'FI2030']],
    [4, 'EL2004', 'Redes de Computadoras', 4, ['EL2013']],
    [4, 'GH2001', 'Emprendimiento I', 3, []],
    // Ciclo 5 (21 cr)
    [5, 'EL3002', 'Cálculo Numérico, Series y Transformadas', 4, ['MA2015', 'MA1010']],
    [5, 'EL3001', 'Modelado y Simulación', 3, ['FI2030', 'MA2015']],
    [5, 'EL3003', 'Diseño de Computadoras', 4, ['EL2013']],
    [5, 'EL3004', 'Circuitos Analógicos I', 4, ['EL2003']],
    [5, 'PI3101', 'Electivo de Proyectos Interdisciplinarios', 3, ['PI1102']],
    [5, 'HH2102', 'Electivo de HACS II', 3, ['HH2101']],
    // Ciclo 6 (21 cr)
    [6, 'EL3005', 'Procesamiento Digital de Señales', 4, ['EL3002', 'EL3001']],
    [6, 'EL3006', 'Control Automático', 4, ['EL3001']],
    [6, 'EL3007', 'Introducción a Sistemas Embebidos', 5, ['EL2013']],
    [6, 'EL3008', 'Circuitos Analógicos II', 4, ['EL3004']],
    [6, 'EL3009', 'Sensores y Actuadores', 4, ['EL3004', 'EL2013']],
    // Ciclo 7 (19 cr)
    [7, 'EL4001', 'Telecomunicaciones', 4, ['EL3008', 'EL3005']],
    [7, 'EL4002', 'Electrónica de Potencia', 4, ['EL3008', 'EL3002']],
    [7, 'EL4003', 'Internet de las Cosas', 3, ['EL3007']],
    [7, 'EL4091', 'Electivo de Carrera I', 4, []],
    [7, 'EL4092', 'Electivo de Carrera II', 4, []],
    // Ciclo 8 (16 cr)
    [8, 'PR4010', 'Proyecto Preprofesional', 4, ['EL3007']],
    [8, 'EL4080', 'Introducción al Proyecto Final de Ingeniería Electrónica', 2, ['EL3007']],
    [8, 'EL4093', 'Electivo de Carrera III', 4, []],
    [8, 'GH3010', 'Finanzas Empresariales', 3, []],
    [8, 'HH3101', 'Electivo de HACS III', 3, ['HH2102']],
    // Ciclo 9 (19 cr)
    [9, 'EL5010', 'Proyecto Final de Ingeniería Electrónica I', 3, ['EL4080', 'EL3006']],
    [9, 'GH4010', 'Emprendimiento II', 3, ['GH2001', 'GH3010']],
    [9, 'GH5010', 'Ética y Tecnología', 3, []],
    [9, 'EL5011', 'Proyecto de Diseño Mayor en Ingeniería Electrónica', 2, ['EL3007']],
    [9, 'CS5091', 'Electivo de Ingeniería y Computación I', 4, []],
    [9, 'EL5001', 'Electivo Libre I', 4, []],
    // Ciclo 10 (22 cr)
    [10, 'GH5020', 'Electivo de Gestión', 3, []],
    [10, 'EL5012', 'Proyecto Final de Ingeniería Electrónica II', 3, ['EL5010']],
    [10, 'CS5092', 'Electivo de Ingeniería y Computación II', 4, []],
    [10, 'CS5093', 'Electivo de Ingeniería y Computación III', 4, []],
    [10, 'EL5002', 'Electivo Libre II', 4, []],
    [10, 'EL5003', 'Electivo Libre III', 4, []]
  ],

  // ===========================================================================
  // 15. INGENIERÍA MECATRÓNICA (200 cr: 20, 20, 21, 20, 22, 21, 19, 16, 19, 22)
  // ===========================================================================
  mtr: [
    // Ciclo 1 (20 cr)
    [1, 'MA1001', 'Fundamentos del Cálculo', 3, []],
    [1, 'QU1001', 'Química General y Experimental', 4, []],
    [1, 'CS1111', 'Programación I', 4, []],
    [1, 'HH1101', 'Comunicación Integral I', 3, []],
    [1, 'PI1101', 'Proyectos Interdisciplinarios I', 3, []],
    [1, 'MT1001', 'Introducción a la Ingeniería Mecatrónica', 3, []],
    // Ciclo 2 (20 cr)
    [2, 'MA1002', 'Cálculo de una Variable', 4, ['MA1001']],
    [2, 'MA1010', 'Álgebra Lineal', 3, []],
    [2, 'ME1002', 'Introducción a la Mecánica', 4, ['MA1001']],
    [2, 'CS1112', 'Programación II', 4, ['CS1111']],
    [2, 'HH1102', 'Comunicación Integral II', 3, ['HH1101']],
    [2, 'PI1102', 'Proyectos Interdisciplinarios II', 2, ['PI1101']],
    // Ciclo 3 (21 cr)
    [3, 'MA2001', 'Cálculo Multivariable', 3, ['MA1002']],
    [3, 'IN2005', 'Estadística y Probabilidades I', 4, ['MA1002', 'CS1111']],
    [3, 'FI2030', 'Fundamentos de Electricidad y Magnetismo', 4, ['ME1002']],
    [3, 'ME2003', 'Termodinámica', 4, ['QU1001', 'ME1002']],
    [3, 'ME2004', 'Ciencia de los Materiales', 3, ['QU1001', 'ME1002']],
    [3, 'HH2101', 'Electivo de HACS I', 3, []],
    // Ciclo 4 (20 cr)
    [4, 'MA2015', 'Ecuaciones Diferenciales', 3, ['MA2001']],
    [4, 'CS3015', 'IA: Introducción a Machine Learning', 3, ['MA1010', 'CS1112', 'IN2005']],
    [4, 'MT2001', 'Estática', 3, ['MA2001', 'ME1002']],
    [4, 'MT2002', 'Diseño Mecánico', 4, ['ME1002']],
    [4, 'EL2001', 'Circuitos Eléctricos y Electrónicos I', 4, ['MA2001', 'FI2030']],
    [4, 'GH2001', 'Emprendimiento I', 3, []],
    // Ciclo 5 (22 cr)
    [5, 'EL3002', 'Cálculo Numérico, Series y Transformadas', 4, ['MA2015', 'MA1010']],
    [5, 'MT3001', 'Dinámica de Cuerpos Rígidos', 4, ['MT2001']],
    [5, 'MT3002', 'Circuitos Eléctricos y Electrónicos II', 4, ['EL2001']],
    [5, 'EL2013', 'Circuitos Digitales', 4, ['CS1111', 'EL2001']],
    [5, 'EL3001', 'Modelado y Simulación', 3, ['FI2030', 'MA2015']],
    [5, 'HH2102', 'Electivo de HACS II', 3, ['HH2101']],
    // Ciclo 6 (21 cr)
    [6, 'EL3005', 'Procesamiento Digital de Señales', 4, ['EL3002', 'EL3001']],
    [6, 'EL3006', 'Control Automático', 4, ['EL3001']],
    [6, 'EL3009', 'Sensores y Actuadores', 4, ['MT3002', 'EL2013']],
    [6, 'EL3007', 'Introducción a Sistemas Embebidos', 5, ['EL2013']],
    [6, 'ME3003', 'Mecánica de Materiales', 4, ['MT2001']],
    // Ciclo 7 (19 cr)
    [7, 'MT4001', 'Fundamentos de Robótica', 4, ['MT3001', 'EL3006']],
    [7, 'MT4002', 'Control Avanzado de Sistemas Dinámicos', 4, ['EL3006', 'EL3002']],
    [7, 'MT4091', 'Electivo de Carrera I', 4, []],
    [7, 'MT4092', 'Electivo de Carrera II', 4, []],
    [7, 'PI3101', 'Electivo de Proyectos Interdisciplinarios', 3, ['PI1102']],
    // Ciclo 8 (16 cr)
    [8, 'PR4010', 'Proyecto Preprofesional', 4, ['EL3007']],
    [8, 'MT4080', 'Introducción a Trabajo de Investigación en Ing. Mecatrónica', 2, ['EL3007']],
    [8, 'MT4093', 'Electivo de Carrera III', 4, []],
    [8, 'GH3010', 'Finanzas Empresariales', 3, []],
    [8, 'HH3101', 'Electivo de HACS III', 3, ['HH2102']],
    // Ciclo 9 (19 cr)
    [9, 'MT5001', 'Proyecto Final de Ingeniería Mecatrónica I', 3, ['MT4080', 'MT4001']],
    [9, 'GH4010', 'Emprendimiento II', 3, ['GH2001', 'GH3010']],
    [9, 'GH5010', 'Ética y Tecnología', 3, []],
    [9, 'MT5002', 'Proyecto de Diseño Mayor en Ingeniería Mecatrónica', 2, ['EL3007', 'MT4001']],
    [9, 'CS5091', 'Electivo de Ingeniería y Computación I', 4, []],
    [9, 'EL5001', 'Electivo Libre I', 4, []],
    // Ciclo 10 (22 cr)
    [10, 'GH5020', 'Electivo de Gestión', 3, []],
    [10, 'MT5003', 'Proyecto Final de Ingeniería Mecatrónica II', 3, ['MT5001']],
    [10, 'CS5092', 'Electivo de Ingeniería y Computación II', 4, []],
    [10, 'CS5093', 'Electivo de Ingeniería y Computación III', 4, []],
    [10, 'EL5002', 'Electivo Libre II', 4, []],
    [10, 'EL5003', 'Electivo Libre III', 4, []]
  ],

  // ===========================================================================
  // 16. FÍSICA (200 cr: 20, 20, 21, 21, 20, 20, 21, 21, 18, 18)
  // ===========================================================================
  fis: [
    // Ciclo 1 (20 cr)
    [1, 'MA1001', 'Fundamentos del Cálculo', 3, []],
    [1, 'QU1001', 'Química General y Experimental', 4, []],
    [1, 'CS1111', 'Programación I', 4, []],
    [1, 'HH1101', 'Comunicación Integral I', 3, []],
    [1, 'PI1101', 'Proyectos Interdisciplinarios I', 3, []],
    [1, 'FI1001', 'Introducción a la Física', 3, []],
    // Ciclo 2 (20 cr)
    [2, 'MA1002', 'Cálculo de una Variable', 4, ['MA1001']],
    [2, 'MA1010', 'Álgebra Lineal', 3, []],
    [2, 'ME1002', 'Introducción a la Mecánica', 4, ['MA1001']],
    [2, 'CS1112', 'Programación II', 4, ['CS1111']],
    [2, 'HH1102', 'Comunicación Integral II', 3, ['HH1101']],
    [2, 'PI1102', 'Proyectos Interdisciplinarios II', 2, ['PI1101']],
    // Ciclo 3 (21 cr)
    [3, 'HH2101', 'Electivo de HACS I', 3, []],
    [3, 'IN2005', 'Estadística y Probabilidades I', 4, ['MA1002', 'CS1111']],
    [3, 'FI2030', 'Fundamentos de Electricidad y Magnetismo', 4, ['ME1002']],
    [3, 'FI2020', 'Física Térmica', 5, ['QU1001', 'MA1002']],
    [3, 'FI2010', 'Cálculo Vectorial', 5, ['MA1010', 'MA1002']],
    // Ciclo 4 (21 cr)
    [4, 'GH2001', 'Emprendimiento I', 3, []],
    [4, 'CS3015', 'Introducción a Machine Learning', 3, ['MA1010', 'CS1112', 'IN2005']],
    [4, 'FI3010', 'Mecánica Clásica I', 5, ['ME1002', 'FI2010']],
    [4, 'FI3020', 'Oscilaciones y Ondas', 5, ['FI2030', 'FI2010']],
    [4, 'FI3030', 'Matemáticas para la Física I', 5, ['FI2010']],
    // Ciclo 5 (20 cr)
    [5, 'FI3045', 'Mecánica Clásica II', 4, ['FI3010', 'FI3020']],
    [5, 'FI3040', 'Electrodinámica I', 4, ['FI2030', 'FI3030']],
    [5, 'FI3050', 'Física Moderna', 4, ['FI3020', 'FI2020']],
    [5, 'FI3055', 'Introducción a la Medición', 3, ['IN2005', 'FI3020']],
    [5, 'FI3060', 'Matemáticas para la Física II', 5, ['FI3030']],
    // Ciclo 6 (20 cr)
    [6, 'HH2102', 'Electivo de HACS II', 3, ['HH2101']],
    [6, 'FI4010', 'Mecánica Cuántica I', 5, ['FI3045', 'FI3060']],
    [6, 'FI4015', 'Electrodinámica II', 5, ['FI3020', 'FI3040']],
    [6, 'FI4030', 'Física Experimental I', 3, ['FI3050', 'FI3055']],
    [6, 'FI4091', 'Electivo de Carrera I', 4, []],
    // Ciclo 7 (21 cr)
    [7, 'GH5010', 'Ética y Tecnología', 3, []],
    [7, 'FI4092', 'Electivo de Carrera II', 4, []],
    [7, 'FI4080', 'Seminario de Investigación', 2, ['FI4010', 'FI4015']],
    [7, 'FI4025', 'Mecánica Cuántica II', 5, ['FI4010', 'FI4015']],
    [7, 'FI4020', 'Mecánica Estadística', 4, ['FI2020', 'FI4010']],
    [7, 'GH3010', 'Finanzas Empresariales', 3, []],
    // Ciclo 8 (21 cr)
    [8, 'HH3101', 'Electivo de HACS III', 3, ['HH2102']],
    [8, 'PR4010', 'Proyecto Preprofesional', 4, ['FI4080']],
    [8, 'FI4093', 'Electivo de Carrera III', 4, []],
    [8, 'FI4050', 'Análisis de Datos y Métodos Estadísticos en Física', 3, ['FI4010', 'CS3015']],
    [8, 'FI4040', 'Física del Estado Sólido', 4, ['FI4025', 'FI4020']],
    [8, 'FI4060', 'Física Experimental II', 3, ['FI4010', 'FI4030']],
    // Ciclo 9 (18 cr)
    [9, 'HH4101', 'Electivo de HACS IV', 3, ['HH3101']],
    [9, 'FI5010', 'Proyecto de Tesis I', 3, ['FI4025', 'FI4020']],
    [9, 'FI5091', 'Electivo de Especialización I', 4, []],
    [9, 'FI5092', 'Electivo de Especialización II', 4, []],
    [9, 'EL5001', 'Electivo Libre I', 4, []],
    // Ciclo 10 (18 cr)
    [10, 'FI5090', 'Proyecto de Tesis II', 3, ['FI5010']],
    [10, 'FI5093', 'Electivo de Especialización III', 4, []],
    [10, 'EL5002', 'Electivo Libre II', 4, []],
    [10, 'EL5003', 'Electivo Libre III', 4, []],
    [10, 'GH5020', 'Electivo de Gestión', 3, []]
  ]
} as const satisfies Record<string, readonly [CycleNumber, string, string, number, readonly string[]][]>;

function inferCourseArea(code: string): 'core' | 'math' | 'science' | 'humanities' {
  if (
    code.startsWith('MA') ||
    code === 'IN2005' ||
    code === 'IN2006' ||
    code === 'CS1040' ||
    code === 'CS1042' ||
    code === 'CS2020' ||
    code === 'CB2020' ||
    code === 'DS2010' ||
    code === 'DS2012' ||
    code === 'FI2010' ||
    code === 'FI3030' ||
    code === 'FI3060' ||
    code === 'EL3002'
  ) {
    return 'math';
  }
  if (code.startsWith('QU') || code === 'BI1002' || code === 'FI2030') {
    return 'science';
  }
  if (code.startsWith('HH') || code.startsWith('PI') || code.startsWith('GH')) {
    return 'humanities';
  }
  return 'core';
}

function mapRawToCourses(
  rawList: readonly [CycleNumber, string, string, number, readonly string[]][]
): CurricularCourseNode[] {
  return rawList.map(([cycle, code, name, credits, prereqs]) => ({
    cycle,
    code,
    name,
    credits,
    prereqs: [...prereqs],
    area: inferCourseArea(code),
  }));
}

export const UTEC_16_CAREERS: CareerCurriculum[] = [
  // =========================================================================
  // FACULTAD DE COMPUTACIÓN (4)
  // =========================================================================
  {
    id: 'ciencia-computacion',
    rawKey: 'cs',
    name: 'Ciencia de la Computación',
    shortCode: 'CS',
    facultyId: 'computacion',
    facultyName: 'Facultad de Computación',
    defaultSelectedCode: 'CS1042',
    totalCredits: 200,
    courses: mapRawToCourses(RAW_UTEC_16_CURRICULA.cs),
  },
  {
    id: 'ciencia-datos-ia',
    rawKey: 'cdia',
    name: 'Ciencia de Datos e Inteligencia Artificial',
    shortCode: 'DS',
    facultyId: 'computacion',
    facultyName: 'Facultad de Computación',
    defaultSelectedCode: 'CS1042',
    totalCredits: 200,
    courses: mapRawToCourses(RAW_UTEC_16_CURRICULA.cdia),
  },
  {
    id: 'sistemas-informacion',
    rawKey: 'si',
    name: 'Sistemas de Información',
    shortCode: 'SI',
    facultyId: 'computacion',
    facultyName: 'Facultad de Computación',
    defaultSelectedCode: 'CS1042',
    totalCredits: 200,
    courses: mapRawToCourses(RAW_UTEC_16_CURRICULA.si),
  },
  {
    id: 'ciberseguridad',
    rawKey: 'cib',
    name: 'Ciberseguridad',
    shortCode: 'CB',
    facultyId: 'computacion',
    facultyName: 'Facultad de Computación',
    defaultSelectedCode: 'CS1042',
    totalCredits: 200,
    courses: mapRawToCourses(RAW_UTEC_16_CURRICULA.cib),
  },

  // =========================================================================
  // FACULTAD DE NEGOCIOS (2)
  // =========================================================================
  {
    id: 'administracion-negocios-digitales',
    rawKey: 'and',
    name: 'Administración y Negocios Digitales',
    shortCode: 'AD',
    facultyId: 'negocios',
    facultyName: 'Facultad de Negocios',
    defaultSelectedCode: 'AD2008',
    totalCredits: 200,
    courses: mapRawToCourses(RAW_UTEC_16_CURRICULA.and),
  },
  {
    id: 'business-analytics',
    rawKey: 'ba',
    name: 'Business Analytics',
    shortCode: 'BA',
    facultyId: 'negocios',
    facultyName: 'Facultad de Negocios',
    defaultSelectedCode: 'BA3001',
    totalCredits: 200,
    courses: mapRawToCourses(RAW_UTEC_16_CURRICULA.ba),
  },

  // =========================================================================
  // FACULTAD DE INGENIERÍA (9)
  // =========================================================================
  {
    id: 'ingenieria-industrial',
    rawKey: 'ind',
    name: 'Ingeniería Industrial',
    shortCode: 'IN',
    facultyId: 'ingenieria',
    facultyName: 'Facultad de Ingeniería',
    defaultSelectedCode: 'IN2001',
    totalCredits: 200,
    courses: mapRawToCourses(RAW_UTEC_16_CURRICULA.ind),
  },
  {
    id: 'bioingenieria',
    rawKey: 'bio',
    name: 'Bioingeniería',
    shortCode: 'BI',
    facultyId: 'ingenieria',
    facultyName: 'Facultad de Ingeniería',
    defaultSelectedCode: 'BI2001',
    totalCredits: 200,
    courses: mapRawToCourses(RAW_UTEC_16_CURRICULA.bio),
  },
  {
    id: 'ingenieria-energia',
    rawKey: 'ene',
    name: 'Ingeniería de la Energía',
    shortCode: 'EN',
    facultyId: 'ingenieria',
    facultyName: 'Facultad de Ingeniería',
    defaultSelectedCode: 'EN2002',
    totalCredits: 200,
    courses: mapRawToCourses(RAW_UTEC_16_CURRICULA.ene),
  },
  {
    id: 'ingenieria-mecanica',
    rawKey: 'mec',
    name: 'Ingeniería Mecánica',
    shortCode: 'ME',
    facultyId: 'ingenieria',
    facultyName: 'Facultad de Ingeniería',
    defaultSelectedCode: 'ME2005',
    totalCredits: 200,
    courses: mapRawToCourses(RAW_UTEC_16_CURRICULA.mec),
  },
  {
    id: 'ingenieria-quimica',
    rawKey: 'iqu',
    name: 'Ingeniería Química',
    shortCode: 'IQ',
    facultyId: 'ingenieria',
    facultyName: 'Facultad de Ingeniería',
    defaultSelectedCode: 'IQ2001',
    totalCredits: 200,
    courses: mapRawToCourses(RAW_UTEC_16_CURRICULA.iqu),
  },
  {
    id: 'ingenieria-ambiental',
    rawKey: 'amb',
    name: 'Ingeniería Ambiental',
    shortCode: 'AM',
    facultyId: 'ingenieria',
    facultyName: 'Facultad de Ingeniería',
    defaultSelectedCode: 'AM2001',
    totalCredits: 200,
    courses: mapRawToCourses(RAW_UTEC_16_CURRICULA.amb),
  },
  {
    id: 'ingenieria-civil',
    rawKey: 'civ',
    name: 'Ingeniería Civil',
    shortCode: 'CV',
    facultyId: 'ingenieria',
    facultyName: 'Facultad de Ingeniería',
    defaultSelectedCode: 'CV2001',
    totalCredits: 200,
    courses: mapRawToCourses(RAW_UTEC_16_CURRICULA.civ),
  },
  {
    id: 'ingenieria-electronica',
    rawKey: 'ele',
    name: 'Ingeniería Electrónica',
    shortCode: 'EL',
    facultyId: 'ingenieria',
    facultyName: 'Facultad de Ingeniería',
    defaultSelectedCode: 'EL2013',
    totalCredits: 200,
    courses: mapRawToCourses(RAW_UTEC_16_CURRICULA.ele),
  },
  {
    id: 'ingenieria-mecatronica',
    rawKey: 'mtr',
    name: 'Ingeniería Mecatrónica',
    shortCode: 'MT',
    facultyId: 'ingenieria',
    facultyName: 'Facultad de Ingeniería',
    defaultSelectedCode: 'MT2001',
    totalCredits: 200,
    courses: mapRawToCourses(RAW_UTEC_16_CURRICULA.mtr),
  },

  // =========================================================================
  // FACULTAD DE CIENCIAS BÁSICAS (1)
  // =========================================================================
  {
    id: 'fisica',
    rawKey: 'fis',
    name: 'Física',
    shortCode: 'FI',
    facultyId: 'ciencias',
    facultyName: 'Facultad de Ciencias Básicas',
    defaultSelectedCode: 'FI2010',
    totalCredits: 200,
    courses: mapRawToCourses(RAW_UTEC_16_CURRICULA.fis),
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
