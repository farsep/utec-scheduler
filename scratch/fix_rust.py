import re

with open('wasm-engine/src/lib.rs', 'r') as f:
    code = f.read()

code = code.replace(
    "self.compute_sections_for_courses(&final_course_set, top_results, current_threshold);",
    "self.compute_sections_for_courses(&final_course_set, top_results, current_threshold, nodes_evaluated);"
)

code = code.replace(
    "self.backtrack(\n            0,\n            &[0; 7],\n            &mut current_combo_idx,\n            &selected_courses,\n            &suffix_max_bonus,\n            top_results,\n            current_threshold\n        );",
    "self.backtrack(\n            0,\n            &[0; 7],\n            &mut current_combo_idx,\n            &selected_courses,\n            &suffix_max_bonus,\n            top_results,\n            current_threshold,\n            nodes_evaluated\n        );"
)

code = code.replace(
    "self.backtrack(index + 1, &next_mask, current_combo, selected_courses, suffix_max_bonus, top_results, current_threshold);",
    "self.backtrack(index + 1, &next_mask, current_combo, selected_courses, suffix_max_bonus, top_results, current_threshold, nodes_evaluated);"
)

with open('wasm-engine/src/lib.rs', 'w') as f:
    f.write(code)
