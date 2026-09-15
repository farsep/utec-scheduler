import re

with open('wasm-engine/src/lib.rs', 'r') as f:
    code = f.read()

# Add nodes_evaluated to compute_chunk
old_compute_start = """        let mut current_combo = prefix_courses;
        
        self.generate_course_combinations(
            &mut current_combo,
            start_idx,
            &pool_courses,
            needed_from_pool,
            &pool_conflicts,
            &pinned_courses,
            &mut top_results,
            &mut current_threshold,
        );"""
new_compute_start = """        let mut current_combo = prefix_courses;
        let mut nodes_evaluated = 0;
        
        self.generate_course_combinations(
            &mut current_combo,
            start_idx,
            &pool_courses,
            needed_from_pool,
            &pool_conflicts,
            &pinned_courses,
            &mut top_results,
            &mut current_threshold,
            &mut nodes_evaluated,
        );"""

code = code.replace(old_compute_start, new_compute_start)

# Add nodes_evaluated parameter to generate_course_combinations
old_gen_sig = """        top_results: &mut Vec<GeneratedScheduleResultRust>,
        current_threshold: &mut f64,
    ) {"""
new_gen_sig = """        top_results: &mut Vec<GeneratedScheduleResultRust>,
        current_threshold: &mut f64,
        nodes_evaluated: &mut usize,
    ) {"""

code = code.replace(old_gen_sig, new_gen_sig)

# Add max nodes check inside generate_course_combinations
old_gen_body_start = """    ) {
        if current_combo.len() == needed_from_pool {"""
new_gen_body_start = """    ) {
        *nodes_evaluated += 1;
        if *nodes_evaluated > 2_000_000 {
            return; // Hard limit to prevent freezing on massive pools
        }

        if current_combo.len() == needed_from_pool {"""

code = code.replace(old_gen_body_start, new_gen_body_start)

# Add nodes_evaluated to the recursive call
old_rec_call = """            self.generate_course_combinations(current_combo, i + 1, pool_courses, needed_from_pool, pool_conflicts, pinned_courses, top_results, current_threshold);"""
new_rec_call = """            self.generate_course_combinations(current_combo, i + 1, pool_courses, needed_from_pool, pool_conflicts, pinned_courses, top_results, current_threshold, nodes_evaluated);"""

code = code.replace(old_rec_call, new_rec_call)

with open('wasm-engine/src/lib.rs', 'w') as f:
    f.write(code)

