import json

path = "/home/charmcast/Coding/Utec/Matricula/src/components/ScheduleOptimizerModal.tsx"
with open(path, "r") as f:
    content = f.read()

transcript_path = "/home/charmcast/.gemini/antigravity-ide/brain/9a8bae53-ce1a-442e-b31b-45e9f666dff4/.system_generated/logs/transcript_full.jsonl"
with open(transcript_path, "r") as f:
    for line in f:
        try:
            data = json.loads(line)
            step_idx = data.get("step_index", 0)
            if step_idx > 1000:
                continue
            if data.get("type") == "PLANNER_RESPONSE":
                for tc in data.get("tool_calls", []):
                    args = tc.get("args", {})
                    target = args.get("TargetFile", "")
                    if "ScheduleOptimizerModal.tsx" in target:
                        name = tc.get("name")
                        if name == "replace_file_content":
                            target_c = args.get("TargetContent", "")
                            repl_c = args.get("ReplacementContent", "")
                            if target_c in content:
                                content = content.replace(target_c, repl_c)
                        elif name == "multi_replace_file_content":
                            chunks = args.get("ReplacementChunks", [])
                            for chunk in chunks:
                                target_c = chunk.get("TargetContent", "")
                                repl_c = chunk.get("ReplacementContent", "")
                                if target_c in content:
                                    content = content.replace(target_c, repl_c)
        except Exception as e:
            pass

with open("restored.tsx", "w") as f:
    f.write(content)
