# MatricuLAB 2.0 - Technical Changelog

Welcome to MatricuLAB version 2.0. This release introduces fundamental architectural changes to the schedule optimization engine, significant improvements to the UI, and powerful PDF parsing capabilities. 

## Legacy Features Retained (v1.0)
Before this update, MatricuLAB served as a manual scheduling utility with the following core functionalities:
- **Manual Grid Scheduling:** Visual timetable generation using mock data for manual course placements.
- **Parallel PDF Filtering:** Support for uploading the "Cursos Habilitados" PDF to automatically map and filter courses (Eligible, Mandatory, Elective) against the database.
- **Google Calendar Export:** Full integration to export a processed "Consolidado de Matrícula" or "Horario" PDF directly to the user's Google Calendar account.

## Major Technical Updates (v2.0)

### 1. Algorithmic Evolution: From Brute Force to CSP & Bitmasks
The legacy approach (v1.0) relied on computationally heavy brute-force loops and raw string comparisons (`if (a.day === b.day && a.start < b.end)`). This $O(n^2)$ approach per schedule permutation resulted in severe bottlenecks.
We completely rewrote the "Generate Schedule" core engine (`ScheduleOptimizerModal.tsx` and `scheduleWorker.ts`) to use advanced optimization techniques:
- **Constraint Satisfaction Problem (CSP) & MRV Heuristic:** Instead of evaluating permutations blindly, courses are structured in a hierarchical tree sorted by the **Minimum Remaining Values (MRV)** heuristic. The algorithm places courses with the fewest available sections (highly constrained) first. If a highly constrained course creates a conflict, the engine prunes the entire branch early, skipping millions of invalid combinations without having to compute them.
- **Hashes & Bitmasks Collision Detection:** String comparisons were stripped out. The 7-day week is now mapped into integer representations (Hashes) and **Bitmasks**. Each 30-minute block is a bit in a binary string. Conflict detection is now resolved in $O(1)$ time complexity using a simple bitwise AND operation (`scheduleMask & sessionMask`), vastly accelerating the validation phase.
- **Advanced Mode (N-choose-K Combinatorics):** Users can define a broad pool of potential courses (filtering by eligibles, electives, etc.) and specify a target course count (e.g., "Choose 5 out of 10"). The engine computes $C(n, k)$ subsets and evaluates all nested section permutations across the entire subset space.
- **Scoring System:** Valid schedules are ranked using heuristics based on user preferences (Morning vs Afternoon, minimum gaps, minimum attendance days, lunch break enforcement).
- **UI Tracking:** Added absolute scoring (`pts`) visualization for transparency over penalty application.

### 2. Web Worker Swarm (Map-Reduce Architecture)
The schedule combinatorics engine was previously bottlenecked by JavaScript's single-threaded nature.
- **Implementation:** The main thread computes the initial combinations domain and chunks the array into `N` parts based on `navigator.hardwareConcurrency`.
- **Concurrency:** We instantiate `N` independent `Worker` instances (a Swarm). Each worker independently solves its chunk of the CSP problem in parallel.
- **Aggregation:** The main thread acts as a reducer, aggregating `PROGRESS` events for a unified UI progress bar, and reducing `COMPLETE` events to merge the Top 200 schedules from all threads into a single globally sorted array. 

### 3. 'Day Gaps' CSP Penalty
Users can now penalize "Day Gaps" (e.g., having classes on Mon and Wed, but an empty Tue).
- **Metric Tracking:** `calculateMetricsFromSessions` computes the active span. The mathematical day gap is `span - activeDaysCount`.
- **Heuristic Weighting:** A severe penalty of `-1000` points per gap day is applied in the worker, ensuring fragmented schedules are immediately discarded. 

### 4. Grid UI Redesign
The manual scheduling grid (`TimetableGrid.tsx`) received a major facelift. Course block cards now feature a modern, high-contrast aesthetic with rounded corners, drop shadows, and better typographic hierarchy for rapid reading of locations and sections.

### 5. PDF Parsing Robustness (`pdfParser.ts`)
The regex parsing logic for UTEC PDFs has been heavily refactored.
- **Student Name Extraction:** Corrected the lookahead regex (`Alumno`). It now successfully breaks on `Programa`, `Carrera`, or `Malla`, preventing greediness.
- **Location Normalization:** Improved `formatLocation` utility to properly clean `UTEC-BA` location tags, even with arbitrary spacing.
- **Section Parsing & Parent Identification:** Resolved recursive section label duplication. Additionally, we implemented intelligent **parent section identification based on vacancy counts**, correctly grouping complex course structures (like *Química General* in the Excel parser and *Álgebra Lineal* in the PDF) by linking `Laboratorio` and `Teoría` sub-groups to their true parent section without errors.
