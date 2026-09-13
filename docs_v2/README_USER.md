# MatricuLAB 2.0 - Guía para el Usuario

¡Bienvenido a la nueva era de **MatricuLAB**! Esta herramienta ha evolucionado para convertirse en tu asistente definitivo para la organización y optimización de tus horarios en UTEC.

## ¿Qué hacía la versión anterior? (v1.0)
Si ya usabas MatricuLAB, recordarás sus funciones clave iniciales:
- **Armado Manual de Horario:** Podías agregar cursos a tu grilla utilizando datos de prueba (mock data) para organizar visualmente tu semana.
- **Integración del PDF de Cursos Habilitados:** Podías subir tu PDF de "Carga Hábil" para filtrar rápidamente qué cursos estaban habilitados, cuáles eran electivos o cuáles obligatorios.
- **Exportación a Google Calendar:** Si subías tu "Consolidado de Matrícula" o "Horario", la aplicación te permitía exportar toda tu semana de clases automáticamente a Google Calendar con un solo clic.

## ¿Qué hay de nuevo en MatricuLAB 2.0?

En esta actualización masiva, hemos introducido algoritmos de optimización avanzada y automatización extrema.

### 1. ¡Nuevo Optimizador Automático! ("Generar Horario")
Ya no tienes que jugar a las rompecabezas intentando cruzar decenas de cursos. Hemos añadido la función de **Generar Horario**. Simplemente selecciona los cursos que quieres llevar y MatricuLAB iterará por todas las permutaciones posibles buscando los horarios perfectos que no crucen ninguna clase.
- **Modo Básico:** Selecciona exactamente los cursos que quieres (ej. 5 cursos) y te armará el horario.
- **Modo Avanzado:** Selecciona una "bolsa" gigante de cursos que estarías dispuesto a llevar (puedes ayudarte filtrando por electivos, habilitados u obligatorios). Luego dile a la aplicación "Quiero llevar 5 cursos de esta lista". El algoritmo no solo buscará que no haya cruces, sino que evaluará **todas las combinaciones posibles** de cursos de tu bolsa para darte las mejores opciones basadas en tus caprichos (filtros).

### 2. Filtros y Penalizaciones Avanzadas (Sin días puente)
Ahora tienes el poder de decirle a la máquina cómo quieres tu semana ideal a través de filtros en el Optimizador:
- **⚡ Menos huecos:** Junta tus clases.
- **📅 Menos días:** Compacta todo en 3 o 4 días.
- **🌅 Mañanas / 🌇 Tardes:** Prioriza madrugar o dormir más.
- **🚫 Sin días puente (huecos):** Nueva penalidad masiva (-1000 puntos) que elimina los horarios que dejan un día libre sándwich en tu semana (ej. clases Lunes y Miércoles, pero nada el Martes).

### 3. Velocidad Suprema (Multihilo)
El Optimizador utiliza toda la fuerza de tu procesador computacional (todos sus núcleos a la vez). Si hay millones o billones de combinaciones, MatricuLAB despliega "clones" paralelos (Web Workers) para explorar el 100% de la CPU en segundo plano, dándote tus horarios ideales en pocos segundos.

### 4. El Cerebro detrás de la Velocidad (Evolución del Algoritmo)
Antes, de manera experimental, MatricuLAB funcionaba con fuerza bruta: comparaba textos y horas uno por uno para ver si los cursos chocaban. Era muy lento y torpe.
Ahora, hemos rediseñado el "cerebro" del sistema aplicando técnicas matemáticas avanzadas:
- **Mapas de Bits (Bitmasks) y Hashes:** Transformamos los horarios de texto a representaciones matemáticas de ceros y unos. Esto permite a la computadora detectar choques en microsegundos.
- **Jerarquía Inteligente (CSP y MRV):** Antes de probar combinaciones a ciegas, el sistema ordena los cursos de los más difíciles de cuadrar (los que tienen menos secciones) a los más fáciles. Si un curso difícil choca, el algoritmo descarta automáticamente millones de combinaciones inservibles de un solo golpe sin tener que calcularlas.

### 5. Rediseño Visual de la Grilla
El clásico "Armador de Horario Manual" tiene un rostro completamente nuevo. Hemos rediseñado las tarjetas (cards) de los cursos en la grilla visual, haciéndolas mucho más modernas, elegantes y fáciles de leer.

### 6. Lectura Perfecta de tu Carga Hábil (PDF)
El motor de lectura de PDF es más inteligente. 
- Extrae tu nombre y datos (Carrera, Malla) de forma exacta.
- Arreglamos la ubicación: ahora verás claramente "A804" o "Virtual" sin el molesto prefijo técnico "UTEC-BA".
- **Identificación Inteligente de Secciones:** Ahora el sistema utiliza la cantidad de vacantes para agrupar sin errores las sub-secciones complejas. Esto soluciona de raíz los problemas que ocurrían con cursos pesados (como *Álgebra Lineal* o *Química General*) donde las sesiones de Laboratorio y Teoría se mezclaban o separaban mal.
- Puntuación (Pts) exacta y transparente para cada horario que se te ofrece.

---

¡Disfruta organizando tu semestre como nunca antes! Si tu computadora suena fuerte al buscar horarios, es MatricuLAB usando todo su poder para hacerte la vida más fácil.
