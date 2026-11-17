use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const DAY_MASK_60: u64 = (1u64 << 60) - 1;
const MORNING_MASK: u64 = (1u64 << 20) - 1; // slots 0..20 (07:00 - 12:00)
const AFTERNOON_MASK: u64 = DAY_MASK_60 ^ MORNING_MASK; // slots 20..60 (12:00 - 22:00)

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LunchConfig {
    pub enabled: bool,
    pub start_time: String,
    pub end_time: String,
    pub duration_minutes: u32,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OptimizerOptionsRust {
    pub targets: Vec<String>,
    pub lunch_config: Option<LunchConfig>,
}

#[derive(Deserialize, Clone)]
pub struct SectionRust {
    pub homochronous_sections: Vec<String>,
    pub mask: Vec<u64>,
}

#[derive(Deserialize, Clone)]
pub struct PreprocessedCourseRust {
    pub course_code: String,
    pub sections: Vec<SectionRust>,
}

#[derive(Serialize)]
#[allow(non_snake_case)]
pub struct ScheduleMetricsRust {
    pub totalGapMinutes: u32,
    pub gapHours: f64,
    pub activeDaysCount: u32,
    pub totalHours: f64,
    pub earliestStartMinutes: u32,
    pub latestEndMinutes: u32,
    pub morningScore: f64,
    pub afternoonScore: f64,
    pub lunchScore: f64,
    pub dayGaps: u32,
}

#[derive(Serialize)]
#[allow(non_snake_case)]
pub struct GeneratedScheduleResultRust {
    pub id: String,
    pub selectedSections: HashMap<String, Vec<String>>,
    pub metrics: ScheduleMetricsRust,
    pub score: f64,
}

#[derive(Clone)]
struct SectionInternal {
    homochronous_sections: Vec<String>,
    mask: [u64; 7],
}

struct CourseInternal {
    course_code: String,
    sections: Vec<SectionInternal>,
    max_section_bonus: f64,
}

struct CandidateResult {
    score: f64,
    metrics: ScheduleMetricsRust,
    choices: Vec<(usize, usize)>,
}

struct SearchState<'a> {
    candidates: Vec<CandidateResult>,
    current_threshold: f64,
    cutoff_200: f64,
    nodes_evaluated: usize,
    tick_counter: usize,
    last_check_ticks: usize,
    last_emit_ms: f64,
    on_progress: &'a mut dyn FnMut(usize, f64),
}

impl<'a> SearchState<'a> {
    #[inline]
    fn tick_combo(&mut self) {
        self.nodes_evaluated += 1;
        self.tick_progress();
    }

    #[inline]
    fn tick_progress(&mut self) {
        self.tick_counter += 1;
        if self.tick_counter - self.last_check_ticks >= 8192 {
            self.last_check_ticks = self.tick_counter;
            let now = current_time_ms();
            if now - self.last_emit_ms >= 80.0 {
                self.last_emit_ms = now;
                (self.on_progress)(self.nodes_evaluated, now);
            }
        }
    }

    fn compact(&mut self) {
        self.candidates.sort_unstable_by(|a, b| {
            b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal)
        });
        if self.candidates.len() >= 50 {
            self.current_threshold = self.candidates[49].score;
        }
        if self.candidates.len() > 200 {
            self.candidates.truncate(200);
        }
        if self.candidates.len() >= 200 {
            self.cutoff_200 = self.candidates[199].score;
        }
    }

    #[inline]
    fn maybe_push(&mut self, score: f64, metrics: ScheduleMetricsRust, choices: Vec<(usize, usize)>) {
        self.candidates.push(CandidateResult { score, metrics, choices });
        let len = self.candidates.len();
        if len >= 1000 {
            self.compact();
        } else if len >= 50 && len % 50 == 0 {
            self.candidates.sort_unstable_by(|a, b| {
                b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal)
            });
            self.current_threshold = self.candidates[49].score;
            if len >= 200 {
                self.cutoff_200 = self.candidates[199].score;
            }
        }
    }
}

#[inline]
fn current_time_ms() -> f64 {
    #[cfg(target_arch = "wasm32")]
    {
        js_sys::Date::now()
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        0.0
    }
}

#[inline]
fn mask_arrays_overlap(a: &[u64; 7], b: &[u64; 7]) -> bool {
    ((a[0] & b[0])
        | (a[1] & b[1])
        | (a[2] & b[2])
        | (a[3] & b[3])
        | (a[4] & b[4])
        | (a[5] & b[5])
        | (a[6] & b[6]))
        != 0
}

#[wasm_bindgen]
pub struct QuantumEngine {
    courses: Vec<CourseInternal>,
    code_to_idx: HashMap<String, usize>,
    n_courses: usize,
    conflicts: Vec<bool>, // flattened n_courses x n_courses conflict graph precomputed in INIT
    pinned_indices: Vec<usize>,
    pool_indices: Vec<usize>,
    blocked_mask: [u64; 7],
    is_strict_mode: bool,

    target_min_gaps: bool,
    target_min_days: bool,
    target_min_day_gaps: bool,
    target_morning: bool,
    target_afternoon: bool,
    has_lunch_target: bool,
    lunch_window_mask: u64,
    lunch_duration_slots: usize,
}

#[wasm_bindgen]
impl QuantumEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(
        courses_js: JsValue,
        options_js: JsValue,
        pinned_codes_js: JsValue,
        pool_codes_js: JsValue,
        pinned_sections_js: JsValue,
        blocked_times_js: JsValue,
        is_strict_mode: bool,
    ) -> Result<QuantumEngine, JsValue> {
        let raw_courses: Vec<PreprocessedCourseRust> = serde_wasm_bindgen::from_value(courses_js)?;
        let options: OptimizerOptionsRust = serde_wasm_bindgen::from_value(options_js)?;
        let pinned_codes: Vec<String> = serde_wasm_bindgen::from_value(pinned_codes_js).unwrap_or_default();
        let pool_codes: Vec<String> = serde_wasm_bindgen::from_value(pool_codes_js).unwrap_or_default();
        let pinned_sections_map: HashMap<String, String> =
            serde_wasm_bindgen::from_value(pinned_sections_js).unwrap_or_default();
        let blocked_times: Vec<u64> =
            serde_wasm_bindgen::from_value(blocked_times_js).unwrap_or_default();

        Ok(Self::from_raw(
            raw_courses,
            options,
            &pinned_codes,
            &pool_codes,
            &pinned_sections_map,
            &blocked_times,
            is_strict_mode,
        ))
    }

    pub fn compute_chunk(
        &self,
        needed_from_pool: usize,
        prefix_codes_js: JsValue,
        start_idx: usize,
        max_nodes_limit: usize,
        section_filters_js: JsValue,
        progress_callback: js_sys::Function,
    ) -> Result<JsValue, JsValue> {
        let prefix_codes: Vec<String> = serde_wasm_bindgen::from_value(prefix_codes_js).unwrap_or_default();
        let section_filters_map: HashMap<String, Vec<String>> =
            serde_wasm_bindgen::from_value(section_filters_js).unwrap_or_default();

        let mut on_progress = |nodes: usize, _now: f64| {
            let _ = progress_callback.call1(&JsValue::NULL, &JsValue::from_f64(nodes as f64));
        };

        let results = self.compute_chunk_internal(
            needed_from_pool,
            &prefix_codes,
            start_idx,
            max_nodes_limit,
            &section_filters_map,
            &mut on_progress,
        );

        let serializer = serde_wasm_bindgen::Serializer::new().serialize_maps_as_objects(true);
        results.serialize(&serializer).map_err(|e| e.into())
    }
}

impl QuantumEngine {
    fn from_raw(
        raw_courses: Vec<PreprocessedCourseRust>,
        options: OptimizerOptionsRust,
        pinned_codes: &[String],
        pool_codes: &[String],
        pinned_sections_map: &HashMap<String, String>,
        blocked_times: &[u64],
        is_strict_mode: bool,
    ) -> QuantumEngine {
        let target_min_gaps = options.targets.contains(&"min_gaps".to_string());
        let target_min_days = options.targets.contains(&"min_days".to_string());
        let target_min_day_gaps = options.targets.contains(&"min_day_gaps".to_string());
        let target_morning = options.targets.contains(&"morning".to_string());
        let target_afternoon = options.targets.contains(&"afternoon".to_string());

        let has_lunch_target = options.lunch_config.as_ref().map(|c| c.enabled).unwrap_or(false);
        let mut lunch_start_slot = 0usize;
        let mut lunch_end_slot = 0usize;
        let mut lunch_duration_slots = 0usize;

        if has_lunch_target {
            if let Some(ref config) = options.lunch_config {
                let start_mins = Self::time_to_minutes(&config.start_time);
                let end_mins = Self::time_to_minutes(&config.end_time);
                lunch_start_slot = (start_mins.saturating_sub(420) / 15) as usize;
                lunch_end_slot = ((end_mins.saturating_sub(420) + 14) / 15) as usize;
                lunch_duration_slots = (config.duration_minutes / 15) as usize;
            }
        }

        let ls = lunch_start_slot.min(60);
        let le = lunch_end_slot.min(60);
        let lunch_window_mask = if ls < le {
            ((1u64 << le) - 1) ^ ((1u64 << ls) - 1)
        } else {
            0
        };

        let mut blocked_mask = [0u64; 7];
        for (i, &v) in blocked_times.iter().take(7).enumerate() {
            blocked_mask[i] = v & DAY_MASK_60;
        }

        let mut courses: Vec<CourseInternal> = Vec::with_capacity(raw_courses.len());
        let mut code_to_idx: HashMap<String, usize> = HashMap::with_capacity(raw_courses.len());

        for rc in raw_courses {
            let pinned_sec = pinned_sections_map.get(&rc.course_code);
            let mut filtered_sections = Vec::with_capacity(rc.sections.len());
            let mut max_bonus = 0.0_f64;

            for sec in rc.sections {
                if let Some(pinned) = pinned_sec {
                    if !sec.homochronous_sections.contains(pinned) {
                        continue;
                    }
                }
                let mut mask = [0u64; 7];
                for d in 0..7 {
                    mask[d] = sec.mask.get(d).copied().unwrap_or(0) & DAY_MASK_60;
                }
                if is_strict_mode && mask_arrays_overlap(&mask, &blocked_mask) {
                    continue;
                }

                let mut m_slots = 0u32;
                let mut a_slots = 0u32;
                for d in 0..7 {
                    m_slots += (mask[d] & MORNING_MASK).count_ones();
                    a_slots += (mask[d] & AFTERNOON_MASK).count_ones();
                }

                let mut sec_bonus = 0.0;
                if target_morning {
                    sec_bonus += m_slots as f64 * 20.0;
                }
                if target_afternoon {
                    sec_bonus += a_slots as f64 * 20.0;
                }
                if sec_bonus > max_bonus {
                    max_bonus = sec_bonus;
                }

                filtered_sections.push(SectionInternal {
                    homochronous_sections: sec.homochronous_sections,
                    mask,
                });
            }

            let idx = courses.len();
            code_to_idx.insert(rc.course_code.clone(), idx);
            courses.push(CourseInternal {
                course_code: rc.course_code,
                sections: filtered_sections,
                max_section_bonus: max_bonus,
            });
        }

        let n_courses = courses.len();
        let mut conflicts = vec![false; n_courses * n_courses];
        for i in 0..n_courses {
            for j in (i + 1)..n_courses {
                let mut possible = false;
                for sec_a in &courses[i].sections {
                    for sec_b in &courses[j].sections {
                        if !mask_arrays_overlap(&sec_a.mask, &sec_b.mask) {
                            possible = true;
                            break;
                        }
                    }
                    if possible {
                        break;
                    }
                }
                if !possible {
                    conflicts[i * n_courses + j] = true;
                    conflicts[j * n_courses + i] = true;
                }
            }
        }

        let mut pinned_indices = Vec::with_capacity(pinned_codes.len());
        for code in pinned_codes {
            if let Some(&idx) = code_to_idx.get(code) {
                pinned_indices.push(idx);
            }
        }

        let mut pool_indices = Vec::with_capacity(pool_codes.len());
        for code in pool_codes {
            if let Some(&idx) = code_to_idx.get(code) {
                pool_indices.push(idx);
            }
        }

        QuantumEngine {
            courses,
            code_to_idx,
            n_courses,
            conflicts,
            pinned_indices,
            pool_indices,
            blocked_mask,
            is_strict_mode,
            target_min_gaps,
            target_min_days,
            target_min_day_gaps,
            target_morning,
            target_afternoon,
            has_lunch_target,
            lunch_window_mask,
            lunch_duration_slots,
        }
    }

    fn time_to_minutes(time_str: &str) -> u32 {
        let mut parts = time_str.split(':');
        if let (Some(h_str), Some(m_str)) = (parts.next(), parts.next()) {
            let h: u32 = h_str.parse().unwrap_or(0);
            let m: u32 = m_str.parse().unwrap_or(0);
            h * 60 + m
        } else {
            0
        }
    }

    fn compute_chunk_internal(
        &self,
        needed_from_pool: usize,
        prefix_codes: &[String],
        start_idx: usize,
        explicit_node_limit: usize,
        section_filters_map: &HashMap<String, Vec<String>>,
        on_progress: &mut dyn FnMut(usize, f64),
    ) -> Vec<GeneratedScheduleResultRust> {
        // Resolve prefix codes to course indices
        let mut current_combo: Vec<usize> = Vec::with_capacity(needed_from_pool);
        for code in prefix_codes {
            match self.code_to_idx.get(code) {
                Some(&idx) => current_combo.push(idx),
                None => return Vec::new(),
            }
        }

        // Resolve optional section filters (used to shard Normal Mode across workers)
        let mut allowed_sec_masks: Vec<Option<u128>> = vec![None; self.n_courses];
        if !section_filters_map.is_empty() {
            for (code, reps) in section_filters_map {
                if let Some(&c_idx) = self.code_to_idx.get(code) {
                    let secs = &self.courses[c_idx].sections;
                    let mut bitset = 0u128;
                    let mut all_fit = secs.len() <= 128;
                    if all_fit {
                        for (s_idx, sec) in secs.iter().enumerate() {
                            if sec.homochronous_sections.iter().any(|h| reps.iter().any(|r| r == h)) {
                                bitset |= 1u128 << s_idx;
                            }
                        }
                        if bitset == 0 {
                            return Vec::new();
                        }
                        allowed_sec_masks[c_idx] = Some(bitset);
                    } else {
                        all_fit = false;
                    }
                    let _ = all_fit;
                }
            }
        }

        // Compute max_nodes_limit matching original C(100, needed) / pool_len cap if not overridden
        let max_nodes_limit = if explicit_node_limit > 0 {
            explicit_node_limit
        } else {
            let mut max_combos_100 = 1_usize;
            for i in 1..=needed_from_pool {
                max_combos_100 = max_combos_100.saturating_mul(100 - i + 1) / i;
            }
            max_combos_100 / std::cmp::max(1, self.pool_indices.len())
        };

        // Bail fast if any pinned course conflicts with another pinned course or has 0 sections
        for &p_idx in &self.pinned_indices {
            if self.courses[p_idx].sections.is_empty() {
                return Vec::new();
            }
        }
        for i in 0..self.pinned_indices.len() {
            for j in (i + 1)..self.pinned_indices.len() {
                let a = self.pinned_indices[i];
                let b = self.pinned_indices[j];
                if self.conflicts[a * self.n_courses + b] {
                    return Vec::new();
                }
            }
        }

        let mut state = SearchState {
            candidates: Vec::with_capacity(256),
            current_threshold: f64::NEG_INFINITY,
            cutoff_200: f64::NEG_INFINITY,
            nodes_evaluated: 0,
            tick_counter: 0,
            last_check_ticks: 0,
            last_emit_ms: current_time_ms(),
            on_progress,
        };

        self.dfs_course_combinations(
            &mut current_combo,
            start_idx,
            needed_from_pool,
            max_nodes_limit,
            &allowed_sec_masks,
            &mut state,
        );

        state.compact();

        state
            .candidates
            .into_iter()
            .enumerate()
            .map(|(idx, cand)| {
                let mut selected_sections = HashMap::with_capacity(cand.choices.len());
                for (c_idx, sec_idx) in cand.choices {
                    let course = &self.courses[c_idx];
                    selected_sections.insert(
                        course.course_code.clone(),
                        course.sections[sec_idx].homochronous_sections.clone(),
                    );
                }
                GeneratedScheduleResultRust {
                    id: format!("gen_0_{}", idx),
                    selectedSections: selected_sections,
                    metrics: cand.metrics,
                    score: cand.score,
                }
            })
            .collect()
    }

    fn dfs_course_combinations(
        &self,
        current_combo: &mut Vec<usize>,
        start_idx: usize,
        needed_from_pool: usize,
        max_nodes_limit: usize,
        allowed_sec_masks: &[Option<u128>],
        state: &mut SearchState<'_>,
    ) {
        state.tick_combo();
        if state.nodes_evaluated > max_nodes_limit {
            return;
        }

        if current_combo.len() == needed_from_pool {
            let total_courses = self.pinned_indices.len() + current_combo.len();
            if total_courses == 0 {
                return;
            }
            let mut course_set: Vec<usize> = Vec::with_capacity(total_courses);
            course_set.extend_from_slice(&self.pinned_indices);
            course_set.extend_from_slice(current_combo);

            // Sort ascending by section count (most constrained variable first)
            course_set.sort_unstable_by_key(|&c_idx| self.courses[c_idx].sections.len());

            // Bail early if any course has 0 valid sections
            if self.courses[course_set[0]].sections.is_empty() {
                return;
            }

            // Compute suffix_max_bonus for branch & bound
            let k = course_set.len();
            let mut suffix_max_bonus = vec![0.0_f64; k];
            let mut acc = 0.0_f64;
            for idx in (0..k).rev() {
                let c_idx = course_set[idx];
                acc += self.courses[c_idx].max_section_bonus;
                suffix_max_bonus[idx] = acc;
            }

            let mut sec_combo = vec![0usize; k];
            self.backtrack_sections(
                0,
                &[0u64; 7],
                &course_set,
                &suffix_max_bonus,
                &mut sec_combo,
                allowed_sec_masks,
                state,
            );
            return;
        }

        let remaining_needed = needed_from_pool - current_combo.len();
        let pool_len = self.pool_indices.len();
        if pool_len < start_idx + remaining_needed {
            return;
        }
        let max_start = pool_len - remaining_needed;

        for pos in start_idx..=max_start {
            if state.nodes_evaluated > max_nodes_limit {
                return;
            }
            let cand_idx = self.pool_indices[pos];
            if self.courses[cand_idx].sections.is_empty() {
                continue;
            }

            let row_offset = cand_idx * self.n_courses;
            let mut conflict = false;
            for &prev_idx in current_combo.iter() {
                if self.conflicts[row_offset + prev_idx] {
                    conflict = true;
                    break;
                }
            }
            if !conflict {
                for &pin_idx in &self.pinned_indices {
                    if self.conflicts[row_offset + pin_idx] {
                        conflict = true;
                        break;
                    }
                }
            }
            if conflict {
                continue;
            }

            current_combo.push(cand_idx);
            self.dfs_course_combinations(
                current_combo,
                pos + 1,
                needed_from_pool,
                max_nodes_limit,
                allowed_sec_masks,
                state,
            );
            current_combo.pop();
        }
    }

    fn backtrack_sections(
        &self,
        index: usize,
        current_mask: &[u64; 7],
        course_set: &[usize],
        suffix_max_bonus: &[f64],
        sec_combo: &mut [usize],
        allowed_sec_masks: &[Option<u128>],
        state: &mut SearchState<'_>,
    ) {
        let k = course_set.len();
        if index == k {
            self.evaluate_leaf(current_mask, course_set, sec_combo, state);
            return;
        }
        state.tick_progress();

        let c_idx = course_set[index];
        let sections = &self.courses[c_idx].sections;
        let allowed_mask = allowed_sec_masks[c_idx];

        for (sec_i, sec) in sections.iter().enumerate() {
            if let Some(m) = allowed_mask {
                if (m & (1u128 << sec_i)) == 0 {
                    continue;
                }
            }
            if mask_arrays_overlap(current_mask, &sec.mask) {
                continue;
            }

            let next_mask = [
                current_mask[0] | sec.mask[0],
                current_mask[1] | sec.mask[1],
                current_mask[2] | sec.mask[2],
                current_mask[3] | sec.mask[3],
                current_mask[4] | sec.mask[4],
                current_mask[5] | sec.mask[5],
                current_mask[6] | sec.mask[6],
            ];

            if state.current_threshold > f64::NEG_INFINITY {
                let mut days = 0u32;
                if self.target_min_days {
                    for d in 0..7 {
                        if next_mask[d] != 0 {
                            days += 1;
                        }
                    }
                }
                let mut inevitable_penalty = 0.0;
                if self.target_min_days {
                    inevitable_penalty -= (days * 500) as f64;
                }
                let max_future_bonus = if index + 1 < k {
                    suffix_max_bonus[index + 1]
                } else {
                    0.0
                };
                let upper_bound_score =
                    inevitable_penalty + max_future_bonus + if self.has_lunch_target { 1000.0 } else { 0.0 };

                if upper_bound_score < state.current_threshold {
                    continue;
                }
            }

            // Zero-allocation Forward Checking for remaining courses
            let mut is_viable = true;
            for future_idx in (index + 1)..k {
                let f_c_idx = course_set[future_idx];
                let f_allowed = allowed_sec_masks[f_c_idx];
                let mut has_valid = false;
                for (f_sec_i, f_sec) in self.courses[f_c_idx].sections.iter().enumerate() {
                    if let Some(fm) = f_allowed {
                        if (fm & (1u128 << f_sec_i)) == 0 {
                            continue;
                        }
                    }
                    if !mask_arrays_overlap(&f_sec.mask, &next_mask) {
                        has_valid = true;
                        break;
                    }
                }
                if !has_valid {
                    is_viable = false;
                    break;
                }
            }
            if !is_viable {
                continue;
            }

            sec_combo[index] = sec_i;
            self.backtrack_sections(
                index + 1,
                &next_mask,
                course_set,
                suffix_max_bonus,
                sec_combo,
                allowed_sec_masks,
                state,
            );
        }
    }

    #[inline]
    fn evaluate_leaf(
        &self,
        current_mask: &[u64; 7],
        course_set: &[usize],
        sec_combo: &[usize],
        state: &mut SearchState<'_>,
    ) {
        let mut total_gap_slots: i32 = 0;
        let mut active_days_count: u32 = 0;
        let mut morning_slots: u32 = 0;
        let mut afternoon_slots: u32 = 0;
        let mut lunch_score: u32 = 0;
        let mut active_slots: u32 = 0;
        let mut global_earliest_slot: i32 = 60;
        let mut global_latest_slot: i32 = -1;
        let mut active_mon_sat_bits: u8 = 0;

        for d in 0..7 {
            let day_mask = current_mask[d] & DAY_MASK_60;
            if day_mask == 0 {
                continue;
            }
            active_days_count += 1;
            if d < 6 {
                active_mon_sat_bits |= 1u8 << d;
            }

            let first_slot = day_mask.trailing_zeros() as i32;
            let last_slot = (63 - day_mask.leading_zeros()) as i32;
            let slots_count = day_mask.count_ones() as i32;

            morning_slots += (day_mask & MORNING_MASK).count_ones();
            afternoon_slots += (day_mask & AFTERNOON_MASK).count_ones();

            let gaps = (last_slot - first_slot + 1) - slots_count;
            if gaps > 0 {
                total_gap_slots += gaps;
            }

            if self.has_lunch_target {
                if self.lunch_duration_slots == 0 {
                    lunch_score += 1;
                } else if self.lunch_window_mask != 0 {
                    let mut free = (!day_mask) & self.lunch_window_mask;
                    for _ in 1..self.lunch_duration_slots {
                        free &= free >> 1;
                        if free == 0 {
                            break;
                        }
                    }
                    if free != 0 {
                        lunch_score += 1;
                    }
                }
            }

            active_slots += slots_count as u32;
            if first_slot < global_earliest_slot {
                global_earliest_slot = first_slot;
            }
            if last_slot > global_latest_slot {
                global_latest_slot = last_slot;
            }
        }

        let bridge_days: u32 = if active_mon_sat_bits == 0 {
            0
        } else {
            let first_d = active_mon_sat_bits.trailing_zeros();
            let last_d = 7 - active_mon_sat_bits.leading_zeros();
            let span = last_d - first_d + 1;
            span - active_mon_sat_bits.count_ones()
        };

        let total_gap_minutes = (total_gap_slots * 15) as u32;
        let morning_score_bonus = morning_slots as f64 * 20.0;
        let afternoon_score_bonus = afternoon_slots as f64 * 20.0;
        let normalized_lunch_score = if active_days_count > 0 {
            lunch_score as f64 / active_days_count as f64
        } else {
            0.0
        };

        let mut raw_score = 0.0;
        if self.target_min_gaps {
            raw_score -= total_gap_minutes as f64;
        }
        if self.target_min_days {
            raw_score -= (active_days_count * 500) as f64;
        }
        if self.target_min_day_gaps {
            raw_score -= (bridge_days * 1000) as f64;
        }
        if self.target_morning {
            raw_score += morning_score_bonus;
        }
        if self.target_afternoon {
            raw_score += afternoon_score_bonus;
        }
        if self.has_lunch_target {
            raw_score += normalized_lunch_score * 1000.0;
        }

        if !self.is_strict_mode {
            let mut overlap_blocks = 0u32;
            for d in 0..7 {
                overlap_blocks += (current_mask[d] & self.blocked_mask[d]).count_ones();
            }
            raw_score -= (overlap_blocks as f64) * 100.0;
        }

        // Skip building result structs completely if strictly worse than the 200th best kept
        if state.candidates.len() >= 200 && raw_score < state.cutoff_200 {
            return;
        }

        let gap_hours = (total_gap_minutes as f64) / 60.0;
        let total_hours = ((active_slots * 15) as f64) / 60.0;
        let earliest_start_minutes = if global_earliest_slot == 60 {
            0
        } else {
            420 + (global_earliest_slot as u32 * 15)
        };
        let latest_end_minutes = if global_latest_slot == -1 {
            0
        } else {
            420 + ((global_latest_slot as u32 + 1) * 15)
        };

        let metrics = ScheduleMetricsRust {
            totalGapMinutes: total_gap_minutes,
            gapHours: gap_hours,
            activeDaysCount: active_days_count,
            totalHours: total_hours,
            earliestStartMinutes: earliest_start_minutes,
            latestEndMinutes: latest_end_minutes,
            morningScore: morning_score_bonus,
            afternoonScore: afternoon_score_bonus,
            lunchScore: normalized_lunch_score,
            dayGaps: bridge_days,
        };

        let mut choices = Vec::with_capacity(course_set.len());
        for i in 0..course_set.len() {
            choices.push((course_set[i], sec_combo[i]));
        }

        state.maybe_push(raw_score, metrics, choices);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn reference_leaf_metrics(
        current_mask: &[u64; 7],
        has_lunch_target: bool,
        lunch_start_slot: usize,
        lunch_end_slot: usize,
        lunch_duration_slots: usize,
    ) -> (i32, u32, u32, u32, u32, u32, i32, i32, u32) {
        let mut total_gap_slots: i32 = 0;
        let mut active_days_count: u32 = 0;
        let mut morning_slots: u32 = 0;
        let mut afternoon_slots: u32 = 0;
        let mut lunch_score: u32 = 0;
        let mut active_slots: u32 = 0;
        let mut global_earliest_slot: i32 = 60;
        let mut global_latest_slot: i32 = -1;

        for d in 0..7 {
            let day_mask = current_mask[d];
            if day_mask == 0 {
                continue;
            }
            active_days_count += 1;

            let mut first_slot: i32 = -1;
            let mut last_slot: i32 = -1;
            let mut slots_count: i32 = 0;
            let mut lunch_free_slots: usize = 0;
            let mut max_lunch_free: usize = 0;

            for i in 0..60 {
                let bit = (day_mask & (1 << i)) != 0;
                if bit {
                    if first_slot == -1 {
                        first_slot = i as i32;
                    }
                    last_slot = i as i32;
                    slots_count += 1;
                    if i < 20 {
                        morning_slots += 1;
                    } else {
                        afternoon_slots += 1;
                    }
                    if has_lunch_target {
                        lunch_free_slots = 0;
                    }
                } else if has_lunch_target && i >= lunch_start_slot && i < lunch_end_slot {
                    lunch_free_slots += 1;
                    if lunch_free_slots > max_lunch_free {
                        max_lunch_free = lunch_free_slots;
                    }
                }
            }

            let gaps = (last_slot - first_slot + 1) - slots_count;
            if gaps > 0 {
                total_gap_slots += gaps;
            }
            if has_lunch_target && max_lunch_free >= lunch_duration_slots {
                lunch_score += 1;
            }
            active_slots += slots_count as u32;
            if first_slot != -1 && first_slot < global_earliest_slot {
                global_earliest_slot = first_slot;
            }
            if last_slot != -1 && last_slot > global_latest_slot {
                global_latest_slot = last_slot;
            }
        }

        let mut bridge_days: u32 = 0;
        let mut first_active_day: i32 = -1;
        let mut last_active_day: i32 = -1;
        for d in 0..6 {
            if current_mask[d] != 0 {
                if first_active_day == -1 {
                    first_active_day = d as i32;
                }
                last_active_day = d as i32;
            }
        }
        if first_active_day != -1 && last_active_day != -1 {
            for d in (first_active_day + 1)..last_active_day {
                if current_mask[d as usize] == 0 {
                    bridge_days += 1;
                }
            }
        }

        (
            total_gap_slots,
            active_days_count,
            morning_slots,
            afternoon_slots,
            lunch_score,
            active_slots,
            global_earliest_slot,
            global_latest_slot,
            bridge_days,
        )
    }

    #[test]
    fn bitwise_leaf_metrics_match_reference_on_random_masks() {
        let lunch_configs = [
            (false, "12:00", "15:00", 60u32),
            (true, "12:00", "15:00", 60u32),
            (true, "12:30", "14:30", 45u32),
            (true, "13:00", "13:00", 0u32),
            (true, "07:00", "22:00", 90u32),
        ];

        let mut rng: u64 = 0x9E37_79B9_7F4A_7C15;
        let mut next_u64 = || {
            rng ^= rng << 13;
            rng ^= rng >> 7;
            rng ^= rng << 17;
            rng
        };

        for &(enabled, start, end, dur) in &lunch_configs {
            let options = OptimizerOptionsRust {
                targets: vec![
                    "min_gaps".into(),
                    "min_days".into(),
                    "min_day_gaps".into(),
                    "morning".into(),
                    "afternoon".into(),
                ],
                lunch_config: Some(LunchConfig {
                    enabled,
                    start_time: start.into(),
                    end_time: end.into(),
                    duration_minutes: dur,
                }),
            };

            let engine = QuantumEngine::from_raw(
                Vec::new(),
                options,
                &[],
                &[],
                &HashMap::new(),
                &[],
                false,
            );

            let ls = (QuantumEngine::time_to_minutes(start).saturating_sub(420) / 15) as usize;
            let le = ((QuantumEngine::time_to_minutes(end).saturating_sub(420) + 14) / 15) as usize;
            let ld = (dur / 15) as usize;

            for iter in 0..2000 {
                let mut mask = [0u64; 7];
                for d in 0..7 {
                    if next_u64() % 3 != 0 {
                        mask[d] = (next_u64() ^ (next_u64() >> (iter % 19))) & DAY_MASK_60;
                    }
                }

                let (
                    ref_gaps,
                    ref_days,
                    ref_morn,
                    ref_aft,
                    ref_lunch,
                    ref_active,
                    ref_early,
                    ref_late,
                    ref_bridge,
                ) = reference_leaf_metrics(&mask, enabled, ls, le, ld);

                let mut state = SearchState {
                    candidates: Vec::new(),
                    current_threshold: f64::NEG_INFINITY,
                    cutoff_200: f64::NEG_INFINITY,
                    nodes_evaluated: 0,
                    tick_counter: 0,
                    last_check_ticks: 0,
                    last_emit_ms: 0.0,
                    on_progress: &mut |_, _| {},
                };

                engine.evaluate_leaf(&mask, &[], &[], &mut state);
                assert_eq!(state.candidates.len(), 1);
                let m = &state.candidates[0].metrics;

                assert_eq!(m.totalGapMinutes, (ref_gaps * 15) as u32, "gaps mismatch");
                assert_eq!(m.activeDaysCount, ref_days, "days mismatch");
                assert_eq!(m.morningScore, ref_morn as f64 * 20.0, "morning mismatch");
                assert_eq!(m.afternoonScore, ref_aft as f64 * 20.0, "afternoon mismatch");
                let expected_lunch = if ref_days > 0 {
                    ref_lunch as f64 / ref_days as f64
                } else {
                    0.0
                };
                assert!((m.lunchScore - expected_lunch).abs() < 1e-12, "lunch mismatch");
                assert!((m.totalHours - (ref_active as f64 * 15.0) / 60.0).abs() < 1e-12);
                let expected_early = if ref_early == 60 { 0 } else { 420 + ref_early as u32 * 15 };
                let expected_late = if ref_late == -1 { 0 } else { 420 + (ref_late as u32 + 1) * 15 };
                assert_eq!(m.earliestStartMinutes, expected_early);
                assert_eq!(m.latestEndMinutes, expected_late);
                assert_eq!(m.dayGaps, ref_bridge, "bridge_days mismatch");
            }
        }
    }

    #[test]
    fn normal_mode_and_section_sharding_partition_cleanly() {
        let courses = vec![
            PreprocessedCourseRust {
                course_code: "C1".into(),
                sections: vec![
                    SectionRust { homochronous_sections: vec!["1".into()], mask: vec![0b0011, 0, 0, 0, 0, 0, 0] },
                    SectionRust { homochronous_sections: vec!["2".into()], mask: vec![0b1100, 0, 0, 0, 0, 0, 0] },
                ],
            },
            PreprocessedCourseRust {
                course_code: "C2".into(),
                sections: vec![
                    SectionRust { homochronous_sections: vec!["1".into()], mask: vec![0b0011, 0, 0, 0, 0, 0, 0] },
                    SectionRust { homochronous_sections: vec!["2".into()], mask: vec![0b110000, 0, 0, 0, 0, 0, 0] },
                ],
            },
        ];

        let options = OptimizerOptionsRust {
            targets: vec!["min_gaps".into()],
            lunch_config: None,
        };
        let pinned = vec!["C1".into(), "C2".into()];
        let engine = QuantumEngine::from_raw(
            courses,
            options,
            &pinned,
            &[],
            &HashMap::new(),
            &[],
            false,
        );

        let full = engine.compute_chunk_internal(0, &[], 0, 0, &HashMap::new(), &mut |_, _| {});
        assert_eq!(full.len(), 3); // (C1=1,C2=2), (C1=2,C2=1), (C1=2,C2=2)

        let mut f1 = HashMap::new();
        f1.insert("C1".into(), vec!["1".into()]);
        let shard1 = engine.compute_chunk_internal(0, &[], 0, 0, &f1, &mut |_, _| {});
        assert_eq!(shard1.len(), 1);
        assert_eq!(shard1[0].selectedSections.get("C1").unwrap(), &vec!["1".to_string()]);

        let mut f2 = HashMap::new();
        f2.insert("C1".into(), vec!["2".into()]);
        let shard2 = engine.compute_chunk_internal(0, &[], 0, 0, &f2, &mut |_, _| {});
        assert_eq!(shard2.len(), 2);
        assert!(shard2.iter().all(|r| r.selectedSections.get("C1").unwrap() == &vec!["2".to_string()]));
    }
}
