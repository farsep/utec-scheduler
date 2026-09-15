import re

with open('wasm-engine/src/lib.rs', 'r') as f:
    code = f.read()

# Replace compute_for_courses with compute_chunk
old_compute = r"pub fn compute_for_courses.*?(?=fn backtrack)"
new_compute = """pub fn compute_chunk(
        &self,
        pinned_codes_js: JsValue,
        pool_codes_js: JsValue,
        needed_from_pool: usize,
        prefix_codes_js: JsValue,
        start_idx: usize,
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
        
        self.generate_course_combinations(
            &mut current_combo,
            start_idx,
            &pool_courses,
            needed_from_pool,
            &pool_conflicts,
            &pinned_courses,
            &mut top_results,
            &mut current_threshold,
        );

        let serializer = serde_wasm_bindgen::Serializer::new().serialize_maps_as_objects(true);
        top_results.serialize(&serializer).map_err(|e| e.into())
    }

    fn generate_course_combinations<'a>(
        &self,
        current_combo: &mut Vec<&'a PreprocessedCourseRust>,
        start_idx: usize,
        pool_courses: &Vec<&'a PreprocessedCourseRust>,
        needed_from_pool: usize,
        pool_conflicts: &Vec<Vec<bool>>,
        pinned_courses: &Vec<&'a PreprocessedCourseRust>,
        top_results: &mut Vec<GeneratedScheduleResultRust>,
        current_threshold: &mut f64,
    ) {
        if current_combo.len() == needed_from_pool {
            let mut final_course_set = pinned_courses.clone();
            final_course_set.extend(current_combo.iter().copied());
            self.compute_sections_for_courses(&final_course_set, top_results, current_threshold);
            return;
        }

        for i in start_idx..pool_courses.len() {
            let candidate = pool_courses[i];
            let mut conflict = false;
            
            for prev in current_combo.iter() {
                if let Some(prev_idx) = pool_courses.iter().position(|&p| p.course_code == prev.course_code) {
                    if pool_conflicts[prev_idx][i] {
                        conflict = true;
                        break;
                    }
                }
            }
            if conflict { continue; }

            current_combo.push(candidate);
            self.generate_course_combinations(current_combo, i + 1, pool_courses, needed_from_pool, pool_conflicts, pinned_courses, top_results, current_threshold);
            current_combo.pop();
        }
    }

    fn compute_sections_for_courses(
        &self,
        selected_courses: &Vec<&PreprocessedCourseRust>,
        top_results: &mut Vec<GeneratedScheduleResultRust>,
        current_threshold: &mut f64,
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
        );
    }

    """

code = re.sub(old_compute, new_compute, code, flags=re.DOTALL)

# Modify backtrack signature and `&selected_courses[i]` usage
code = code.replace(
    "selected_courses: &Vec<PreprocessedCourseRust>",
    "selected_courses: &Vec<&PreprocessedCourseRust>"
)

with open('wasm-engine/src/lib.rs', 'w') as f:
    f.write(code)

