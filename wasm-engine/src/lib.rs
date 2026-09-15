use gloo_timers::future::sleep;
use std::time::Duration;
use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Deserialize, Clone)]
pub struct LunchConfig {
    pub enabled: bool,
    pub start_time: String,
    pub end_time: String,
    pub duration_minutes: u32,
}

#[derive(Deserialize, Clone)]
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
pub struct GeneratedScheduleResultRust {
    pub id: String,
    pub selectedSections: HashMap<String, Vec<String>>,
    pub metrics: ScheduleMetricsRust,
    pub score: f64,
}

#[wasm_bindgen]
pub struct QuantumEngine {
    courses: Vec<PreprocessedCourseRust>,
    options: OptimizerOptionsRust,
    suffix_max_bonus: Vec<f64>,
    
    target_min_gaps: bool,
    target_min_days: bool,
    target_min_day_gaps: bool,
    target_morning: bool,
    target_afternoon: bool,
    has_lunch_target: bool,
    lunch_start_slot: usize,
    lunch_end_slot: usize,
    lunch_duration_slots: usize,
}

#[wasm_bindgen]
impl QuantumEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(courses_js: JsValue, options_js: JsValue) -> Result<QuantumEngine, JsValue> {
        let mut courses: Vec<PreprocessedCourseRust> = serde_wasm_bindgen::from_value(courses_js)?;
        let options: OptimizerOptionsRust = serde_wasm_bindgen::from_value(options_js)?;
        
        courses.sort_by(|a, b| a.sections.len().cmp(&b.sections.len()));

        let target_min_gaps = options.targets.contains(&"min_gaps".to_string());
        let target_min_days = options.targets.contains(&"min_days".to_string());
        let target_min_day_gaps = options.targets.contains(&"min_day_gaps".to_string());
        let target_morning = options.targets.contains(&"morning".to_string());
        let target_afternoon = options.targets.contains(&"afternoon".to_string());
        
        let has_lunch_target = options.lunch_config.as_ref().map(|c| c.enabled).unwrap_or(false);
        let mut lunch_start_slot = 0;
        let mut lunch_end_slot = 0;
        let mut lunch_duration_slots = 0;
        
        if has_lunch_target {
            if let Some(ref config) = options.lunch_config {
                let start_mins = Self::time_to_minutes(&config.start_time);
                let end_mins = Self::time_to_minutes(&config.end_time);
                lunch_start_slot = (start_mins.saturating_sub(420)) / 15;
                lunch_end_slot = (end_mins.saturating_sub(420) + 14) / 15;
                lunch_duration_slots = config.duration_minutes / 15;
            }
        }

        let mut suffix_max_bonus = vec![0.0; courses.len()];
        let mut i = (courses.len() as i32) - 1;
        while i >= 0 {
            let idx = i as usize;
            let mut max_bonus_for_course = 0.0;
            
            for sec in &courses[idx].sections {
                let mut m_slots = 0;
                let mut a_slots = 0;
                for day in 0..7 {
                    let day_mask = sec.mask[day];
                    for slot in 0..60 {
                        if (day_mask & (1 << slot)) != 0 {
                            if slot < 20 { m_slots += 1; }
                            else { a_slots += 1; }
                        }
                    }
                }
                let mut sec_bonus = 0.0;
                if target_morning { sec_bonus += (m_slots as f64 * 15.0) / 5.0; }
                if target_afternoon { sec_bonus += (a_slots as f64 * 15.0) / 5.0; }
                
                if sec_bonus > max_bonus_for_course { max_bonus_for_course = sec_bonus; }
            }
            
            let future_bonus = if idx < courses.len() - 1 { suffix_max_bonus[idx + 1] } else { 0.0 };
            suffix_max_bonus[idx] = max_bonus_for_course + future_bonus;
            i -= 1;
        }

        Ok(QuantumEngine {
            courses,
            options,
            suffix_max_bonus,
            target_min_gaps,
            target_min_days,
            target_min_day_gaps,
            target_morning,
            target_afternoon,
            has_lunch_target,
            lunch_start_slot: lunch_start_slot as usize,
            lunch_end_slot: lunch_end_slot as usize,
            lunch_duration_slots: lunch_duration_slots as usize,
        })
    }

    fn time_to_minutes(time_str: &str) -> u32 {
        let parts: Vec<&str> = time_str.split(':').collect();
        if parts.len() == 2 {
            let h: u32 = parts[0].parse().unwrap_or(0);
            let m: u32 = parts[1].parse().unwrap_or(0);
            h * 60 + m
        } else {
            0
        }
    }

    pub async fn compute_chunk(
        &self,
        pinned_codes_js: JsValue,
        pool_codes_js: JsValue,
        needed_from_pool: usize,
        prefix_codes_js: JsValue,
        start_idx: usize,
        progress_callback: js_sys::Function,
    ) -> Result<JsValue, JsValue> {
        let pinned_codes: Vec<String> = serde_wasm_bindgen::from_value(pinned_codes_js)?;
        let pool_codes: Vec<String> = serde_wasm_bindgen::from_value(pool_codes_js)?;
        let prefix_codes: Vec<String> = serde_wasm_bindgen::from_value(prefix_codes_js)?;

        let mut pinned_courses = Vec::new();
        for code in &pinned_codes {
            if let Some(c) = self.courses.iter().find(|c| &c.course_code == code) {
                pinned_courses.push(c);
            }
        }
        let mut pool_courses = Vec::new();
        for code in &pool_codes {
            if let Some(c) = self.courses.iter().find(|c| &c.course_code == code) {
                pool_courses.push(c);
            }
        }
        
        let mut prefix_courses = Vec::new();
        for code in &prefix_codes {
            if let Some(c) = self.courses.iter().find(|c| &c.course_code == code) {
                prefix_courses.push(c);
            }
        }

        let mut pool_conflicts = vec![vec![false; pool_courses.len()]; pool_courses.len()];
        for i in 0..pool_courses.len() {
            for j in (i + 1)..pool_courses.len() {
                let course_a = pool_courses[i];
                let course_b = pool_courses[j];
                let mut possible = false;
                for sec_a in &course_a.sections {
                    for sec_b in &course_b.sections {
                        let mut no_overlap = true;
                        for d in 0..7 {
                            if (sec_a.mask[d] & sec_b.mask[d]) != 0 {
                                no_overlap = false;
                                break;
                            }
                        }
                        if no_overlap {
                            possible = true;
                            break;
                        }
                    }
                    if possible { break; }
                }
                if !possible {
                    pool_conflicts[i][j] = true;
                    pool_conflicts[j][i] = true;
                }
            }
        }

        let mut top_results: Vec<GeneratedScheduleResultRust> = Vec::with_capacity(200);
        let mut current_threshold = f64::NEG_INFINITY;

        let mut current_combo = prefix_courses;
        let mut nodes_evaluated = 0;
        
        let mut max_combos_100 = 1_usize;
        for i in 1..=needed_from_pool {
            max_combos_100 = (max_combos_100 * (100 - i + 1)) / i;
        }
        let max_nodes_limit = max_combos_100 / std::cmp::max(1, pool_courses.len());
        
        self.generate_course_combinations_async(
            current_combo,
            start_idx,
            &pool_courses,
            needed_from_pool,
            &pool_conflicts,
            &pinned_courses,
            &mut top_results,
            &mut current_threshold,
            max_nodes_limit,
            progress_callback,
        ).await;

        let serializer = serde_wasm_bindgen::Serializer::new().serialize_maps_as_objects(true);
        top_results.serialize(&serializer).map_err(|e| e.into())
    }

    async fn generate_course_combinations_async<'a>(
        &self,
        initial_combo: Vec<&'a PreprocessedCourseRust>,
        initial_start_idx: usize,
        pool_courses: &Vec<&'a PreprocessedCourseRust>,
        needed_from_pool: usize,
        pool_conflicts: &Vec<Vec<bool>>,
        pinned_courses: &Vec<&'a PreprocessedCourseRust>,
        top_results: &mut Vec<GeneratedScheduleResultRust>,
        current_threshold: &mut f64,
        max_nodes_limit: usize,
        progress_callback: js_sys::Function,
    ) {
        let mut stack = Vec::new();
        stack.push((initial_combo, initial_start_idx));
        
        let mut nodes_evaluated = 0;
        let mut last_yield_nodes = 0;

        while let Some((mut current_combo, start_idx)) = stack.pop() {
            nodes_evaluated += 1;
            
            // Yield to browser event loop every 10,000 nodes to keep UI responsive at 60 FPS
            if nodes_evaluated - last_yield_nodes >= 10_000 {
                last_yield_nodes = nodes_evaluated;
                let _ = progress_callback.call1(&JsValue::NULL, &JsValue::from_f64(nodes_evaluated as f64));
                sleep(Duration::from_millis(0)).await;
            }

            if nodes_evaluated > max_nodes_limit {
                break; // Hard limit to prevent freezing on massive pools
            }

            if current_combo.len() == needed_from_pool {
                let mut final_course_set = pinned_courses.clone();
                for c in &current_combo {
                    final_course_set.push(*c);
                }
                
                self.compute_sections_for_courses(&final_course_set, top_results, current_threshold, &mut nodes_evaluated);
                continue;
            }

            // We must push in reverse order so that start_idx is evaluated first (LIFO)
            // But since we want to explore lexicographically (or whatever order), 
            // pushing i from start_idx..len in reverse ensures 'start_idx' is popped first.
            let mut i = pool_courses.len() as i32 - 1;
            while i >= start_idx as i32 {
                let idx = i as usize;
                i -= 1;

                let candidate = pool_courses[idx];
                let mut conflict = false;
                for prev in current_combo.iter() {
                    if let Some(prev_idx) = pool_courses.iter().position(|&p| p.course_code == prev.course_code) {
                        if pool_conflicts[prev_idx][idx] {
                            conflict = true;
                            break;
                        }
                    }
                }
                if conflict { continue; }

                let mut next_combo = current_combo.clone();
                next_combo.push(candidate);
                stack.push((next_combo, idx + 1));
            }
        }
    }

    fn compute_sections_for_courses(
        &self,
        selected_courses: &Vec<&PreprocessedCourseRust>,
        top_results: &mut Vec<GeneratedScheduleResultRust>,
        current_threshold: &mut f64,
        nodes_evaluated: &mut usize,
    ) {
        let mut sorted_courses = selected_courses.clone();
        sorted_courses.sort_by(|a, b| a.sections.len().cmp(&b.sections.len()));

        let mut suffix_max_bonus = vec![0.0; sorted_courses.len()];
        let mut i = (sorted_courses.len() as i32) - 1;
        while i >= 0 {
            let idx = i as usize;
            let mut max_bonus_for_course = 0.0;
            
            for sec in &sorted_courses[idx].sections {
                let mut m_slots = 0;
                let mut a_slots = 0;
                for day in 0..7 {
                    let day_mask = sec.mask[day];
                    for slot in 0..60 {
                        if (day_mask & (1 << slot)) != 0 {
                            if slot < 20 { m_slots += 1; }
                            else { a_slots += 1; }
                        }
                    }
                }
                let mut sec_bonus = 0.0;
                if self.target_morning { sec_bonus += (m_slots as f64 * 15.0) / 5.0; }
                if self.target_afternoon { sec_bonus += (a_slots as f64 * 15.0) / 5.0; }
                
                if sec_bonus > max_bonus_for_course { max_bonus_for_course = sec_bonus; }
            }
            
            let future_bonus = if idx < sorted_courses.len() - 1 { suffix_max_bonus[idx + 1] } else { 0.0 };
            suffix_max_bonus[idx] = max_bonus_for_course + future_bonus;
            i -= 1;
        }

        let mut current_combo = vec![0; sorted_courses.len()];
        
        self.backtrack(
            0,
            &[0; 7],
            &mut current_combo,
            &sorted_courses,
            &suffix_max_bonus,
            top_results,
            current_threshold,
            nodes_evaluated,
        );
    }

    fn backtrack(
        &self,
        index: usize,
        current_mask: &[u64; 7],
        current_combo: &mut Vec<usize>,
        selected_courses: &Vec<&PreprocessedCourseRust>,
        suffix_max_bonus: &Vec<f64>,
        top_results: &mut Vec<GeneratedScheduleResultRust>,
        current_threshold: &mut f64,
        nodes_evaluated: &mut usize,
    ) {
        if index == selected_courses.len() {
            let mut total_gap_slots = 0;
            let mut active_days_count = 0;
            let mut morning_slots = 0;
            let mut afternoon_slots = 0;
            let mut lunch_score = 0;
            let mut active_slots = 0;
            let mut global_earliest_slot = 60;
            let mut global_latest_slot: i32 = -1;
            
            for d in 0..7 {
                let day_mask = current_mask[d];
                if day_mask == 0 { continue; }
                active_days_count += 1;
                
                let mut first_slot: i32 = -1;
                let mut last_slot: i32 = -1;
                let mut slots_count = 0;
                let mut lunch_free_slots = 0;
                let mut max_lunch_free = 0;

                for i in 0..60 {
                    let bit = (day_mask & (1 << i)) != 0;
                    if bit {
                        if first_slot == -1 { first_slot = i as i32; }
                        last_slot = i as i32;
                        slots_count += 1;
                        
                        if i < 20 { morning_slots += 1; }
                        else { afternoon_slots += 1; }
                        
                        if self.has_lunch_target { lunch_free_slots = 0; }
                    } else {
                        if self.has_lunch_target && i >= self.lunch_start_slot && i < self.lunch_end_slot {
                            lunch_free_slots += 1;
                            if lunch_free_slots > max_lunch_free { max_lunch_free = lunch_free_slots; }
                        }
                    }
                }
                
                let gaps = (last_slot - first_slot + 1) - slots_count as i32;
                if gaps > 0 { total_gap_slots += gaps; }
                if self.has_lunch_target && max_lunch_free >= self.lunch_duration_slots { lunch_score += 1; }
                active_slots += slots_count;
                if first_slot != -1 && first_slot < global_earliest_slot { global_earliest_slot = first_slot; }
                if last_slot != -1 && last_slot > global_latest_slot { global_latest_slot = last_slot; }
            }

            let mut bridge_days = 0;
            let mut first_active_day: i32 = -1;
            let mut last_active_day: i32 = -1;
            for d in 0..6 {
                if current_mask[d] != 0 {
                    if first_active_day == -1 { first_active_day = d as i32; }
                    last_active_day = d as i32;
                }
            }
            if first_active_day != -1 && last_active_day != -1 {
                for d in (first_active_day + 1)..last_active_day {
                    if current_mask[d as usize] == 0 { bridge_days += 1; }
                }
            }
            
            let total_gap_minutes = (total_gap_slots * 15) as u32;
            let gap_hours = (total_gap_minutes as f64) / 60.0;
            let total_hours = ((active_slots * 15) as f64) / 60.0;
            let earliest_start_minutes = if global_earliest_slot == 60 { 0 } else { 420 + (global_earliest_slot as u32 * 15) };
            let latest_end_minutes = if global_latest_slot == -1 { 0 } else { 420 + ((global_latest_slot as u32 + 1) * 15) };
            
            let morning_score_min = morning_slots as f64 * 15.0;
            let afternoon_score_min = afternoon_slots as f64 * 15.0;
            let normalized_lunch_score = if active_days_count > 0 { lunch_score as f64 / active_days_count as f64 } else { 0.0 };

            let mut raw_score = 0.0;
            if self.target_min_gaps { raw_score -= total_gap_minutes as f64; }
            if self.target_min_days { raw_score -= (active_days_count * 500) as f64; }
            if self.target_min_day_gaps { raw_score -= (bridge_days * 1000) as f64; }
            if self.target_morning { raw_score += morning_score_min / 5.0; }
            if self.target_afternoon { raw_score += afternoon_score_min / 5.0; }
            if self.has_lunch_target { raw_score += normalized_lunch_score * 1000.0; }

            let metrics = ScheduleMetricsRust {
                totalGapMinutes: total_gap_minutes,
                gapHours: gap_hours,
                activeDaysCount: active_days_count,
                totalHours: total_hours,
                earliestStartMinutes: earliest_start_minutes,
                latestEndMinutes: latest_end_minutes,
                morningScore: morning_score_min,
                afternoonScore: afternoon_score_min,
                lunchScore: normalized_lunch_score,
                dayGaps: bridge_days as u32,
            };

            let mut selected_sections = HashMap::new();
            for (i, &sec_idx) in current_combo.iter().enumerate() {
                let course = &selected_courses[i];
                let sec = &course.sections[sec_idx];
                selected_sections.insert(course.course_code.clone(), sec.homochronous_sections.clone());
            }

            top_results.push(GeneratedScheduleResultRust {
                id: format!("gen_{}_{}", 0, top_results.len()),
                selectedSections: selected_sections,
                metrics,
                score: raw_score,
            });
            
            if top_results.len() >= 2000 {
                top_results.sort_unstable_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
                top_results.truncate(200);
                *current_threshold = if top_results.len() >= 50 { top_results[49].score } else { f64::NEG_INFINITY };
            } else if top_results.len() >= 50 && top_results.len() % 50 == 0 {
                top_results.sort_unstable_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
                *current_threshold = top_results[49].score;
            }
            
            return;
        }

        let course = &selected_courses[index];
        for (sec_idx, section) in course.sections.iter().enumerate() {
            let mut conflict = false;
            for d in 0..7 {
                if (current_mask[d] & section.mask[d]) != 0 {
                    conflict = true;
                    break;
                }
            }
            if conflict { continue; }
            
            let mut next_mask = [0; 7];
            let mut days = 0;
            for d in 0..7 {
                next_mask[d] = current_mask[d] | section.mask[d];
                if next_mask[d] != 0 { days += 1; }
            }
            
            let mut inevitable_penalty = 0.0;
            if self.target_min_days { inevitable_penalty -= (days * 500) as f64; }
            let max_future_bonus = if index + 1 < selected_courses.len() { suffix_max_bonus[index + 1] } else { 0.0 };
            let upper_bound_score = inevitable_penalty + max_future_bonus + if self.has_lunch_target { 1000.0 } else { 0.0 };
            
            if upper_bound_score < *current_threshold {
                continue;
            }
            
            let mut is_viable = true;
            for future_idx in (index + 1)..selected_courses.len() {
                let mut has_valid_section = false;
                for future_sec in &selected_courses[future_idx].sections {
                    let mut fc_conflict = false;
                    for d in 0..7 {
                        if (future_sec.mask[d] & next_mask[d]) != 0 {
                            fc_conflict = true;
                            break;
                        }
                    }
                    if !fc_conflict {
                        has_valid_section = true;
                        break;
                    }
                }
                if !has_valid_section {
                    is_viable = false;
                    break;
                }
            }
            if !is_viable { continue; }
            
            current_combo[index] = sec_idx;
            self.backtrack(index + 1, &next_mask, current_combo, selected_courses, suffix_max_bonus, top_results, current_threshold, nodes_evaluated);
        }
    }
}
