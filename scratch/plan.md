# Plan to speed up WASM
1. In `QuantumEngine` in Rust, add `compute_chunk` which takes:
- `pinned_codes: Vec<String>`
- `pool_codes: Vec<String>`
- `needed_from_pool: usize`
- `prefix_codes: Vec<String>`
- `start_idx: usize`
2. Rust builds the `course_conflicts` internally (or we can just do the bitmask overlap check dynamically for course combinations, which is even faster!).
Wait! How did `course_conflicts` get built?
```typescript
        let possible = false;
        for (const secA of courseA.sections) {
          for (const secB of courseB.sections) {
            if ((secA.bitmask & secB.bitmask) === 0n) {
              possible = true;
              break;
            }
          }
          if (possible) break;
        }
```
Rust can just build this boolean matrix `conflict_matrix: Vec<Vec<bool>>` internally in a microsecond!
3. Then Rust runs `generate_course_combinations` recursively, keeping a `Vec<&PreprocessedCourseRust>`.
4. When `current_combo` reaches the target length, it runs the existing section backtracking on it.
5. All results are kept in a single `top_results` vector with a `current_threshold`.
6. At the very end of the chunk, it returns the top 200 results to JS.
