# Sistema de Puntuación de Horarios (MatricuLAB v2)

La asignación de puntos para determinar cuáles son los mejores horarios y qué porcentaje de "perfección" alcanzan se divide en dos procesos técnicos distintos: **Fase 1: Filtrado Heurístico (Web Worker)** y **Fase 2: Recálculo y Normalización Relativa (Frontend)**.

## Fase 1: Filtrado Heurístico Masivo (Web Worker)

Cuando el usuario solicita generar horarios, el sistema evalúa millones de permutaciones mediante operaciones a nivel de bits (Bitwise). Durante este proceso, se genera un **Puntaje Bruto Absoluto (`rawScore`)** para cada combinación válida. 

El único propósito de este puntaje bruto es alimentar una cola de prioridad (`MinMaxHeap`) que retendrá únicamente los **50 mejores horarios en memoria**, descartando el resto. Las reglas matemáticas aplicadas en esta fase son rígidas y priorizan la velocidad de cálculo:

1. **Menos Huecos (`min_gaps`):**
   - Se calculan todos los "slots" (bloques de 15 minutos) vacíos entre la primera y última clase de cada día.
   - Penalización: Se resta el total de minutos de hueco de la semana (`rawScore -= totalGapMinutes`).
2. **Menos Días (`min_days`):**
   - Se cuenta la cantidad de días en la semana con al menos una clase (`activeDaysCount`).
   - Penalización: Se resta un peso muy alto por cada día físico requerido (`rawScore -= activeDaysCount * 500`).
3. **Evitar Días Huecos (`min_day_gaps`):**
   - Se detectan los "días puente", es decir, días libres que están atrapados entre dos días de clases (por ejemplo, tener el martes libre, pero el lunes y miércoles ocupados).
   - Penalización: Castigo masivo por cada día puente (`rawScore -= bridgeDays * 1000`).
4. **Preferir Mañana (`morning`):**
   - Cada bloque de 15 minutos de clase que ocurra **estrictamente antes de las 12:00 PM** suma 1 a `morningSlots`.
   - Bonificación: Se suman los minutos totales matutinos divididos entre 5 (`rawScore += (morningSlots * 15) / 5`).
5. **Preferir Tarde (`afternoon`):**
   - Cada bloque de 15 minutos de clase que ocurra **a partir de las 12:00 PM en adelante** suma 1 a `afternoonSlots`.
   - Bonificación: Se suman los minutos totales vespertinos divididos entre 5 (`rawScore += (afternoonSlots * 15) / 5`).
6. **Garantizar Almuerzo (`lunch`):**
   - Se revisa si dentro de la ventana de almuerzo elegida existe un bloque libre consecutivo mayor o igual a la duración solicitada.
   - Bonificación: Se saca la fracción de días que cumplen el requisito (`días_con_almuerzo / días_totales_de_clase`) y se premia fuertemente (`rawScore += fracción * 1000`).

---

## Fase 2: Recálculo y Normalización Relativa (Frontend)

Una vez que el Web Worker finaliza su ejecución, envía el Top 50 de horarios al Frontend. En este punto, los puntajes brutos (`rawScore`) son descartados, ya que carecen de contexto humano. El Frontend aplica su propia matemática refinada para calcular el **Porcentaje de Afinidad (0% a 100%)** final.

### 2.1. Recálculo Elástico de Mañana y Tarde
El frontend recalcula las métricas de mañana y tarde sesión por sesión para brindar mayor precisión, castigando las clases que invadan el turno contrario:

- **Métrica Mañana (`morningScore`):**
  - Fórmula: `Math.max(0, 720 - hora_de_inicio_en_minutos)`.
  - Significado: Solo dan puntos las clases que inicien antes de las 12:00 PM (720 min). Mientras más temprano inicien (ej. 7:00 AM), mayor es el puntaje (`720 - 420 = 300 puntos`). Cualquier clase desde el mediodía da 0 puntos matutinos.
- **Métrica Tarde (`afternoonScore`):**
  - Fórmula: `Math.max(0, hora_de_inicio_en_minutos - 720)`.
  - Significado: Solo dan puntos las clases que inicien a partir de las 12:00 PM. Mientras más tarde inicien, mayor es el puntaje. Las clases matutinas dan 0 puntos vespertinos.

### 2.2. Cálculo de Interpolación Lineal (Relativo al Top 50)
Para determinar el porcentaje final de un horario, el sistema lo evalúa de forma **relativa frente a los otros 49 competidores**:

1. **Obtención de Límites:** Por cada filtro activado por el usuario, el algoritmo escanea el Top 50 y encuentra el **valor mínimo** y **máximo** absoluto presente.
2. **Normalización por Métrica (0 a 1):** Usando interpolación lineal, se ubica el horario evaluado dentro de los límites:
   `n = (valor_del_horario - mínimo) / (máximo - mínimo)`
   - *Filtros de Reducción (Huecos, Días):* Como se busca que el valor sea lo menor posible, el cálculo se invierte `(1 - n)`. El horario con menos huecos de todo el grupo recibe `1` (100%), y el que tiene más recibe `0` (0%).
   - *Filtros de Maximización (Mañana, Tarde):* El cálculo es directo. El horario con más horas matutinas acumuladas recibe `1` (100%).
   - *Empate Global:* Si en el Top 50 el mínimo es igual al máximo (ej. todos tienen 2 huecos), el sistema asigna una puntuación perfecta de `1` (100%) a todos para esa métrica.
3. **Porcentaje Final (`score`):**
   El sistema saca el **promedio aritmético exacto** de las puntuaciones (de 0 a 1) obtenidas en todos los filtros seleccionados, transformándolo en el porcentaje global final.

### 2.3. Jerarquía de Desempate (Tie-Breakers)
Si tras la normalización dos horarios empatan con el mismo porcentaje exacto (ej. 85.0%), el sistema los ordena en la interfaz aplicando los siguientes desempates físicos (en este orden):
1. Menor cantidad de minutos de hueco en total.
2. Menor cantidad de días de asistencia requeridos.
3. El horario cuya última clase termine más temprano en la semana (`latestEndMinutes`).
