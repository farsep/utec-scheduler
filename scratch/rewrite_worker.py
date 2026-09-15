import re

with open('src/utils/scheduleWorker.ts', 'r') as f:
    code = f.read()

# Replace TASK handler with one that calls compute_chunk
old_task = r"if \(msg.type === 'TASK'\) \{.*?break;\s*\}"
new_task = """if (msg.type === 'TASK') {
      const task = msg.data as WorkerTask;
      
      try {
        if (!wasmEngine) return;
        
        const rustResults = wasmEngine.compute_chunk(
            workerPinned,
            workerPoolBase,
            workerNeededFromPool,
            task.prefix,
            task.startIdx
        );
        
        if (rustResults && rustResults.length > 0) {
           rustResults.forEach((r: any) => {
              const keys = Object.keys(r.selectedSections);
              const expandHelper = (idx: number, currentSelections: Record<string, string>) => {
                if (idx === keys.length) {
                   topResults.push({
                     id: `gen_${Date.now()}_${topResults.length}`,
                     selectedSections: { ...currentSelections },
                     metrics: r.metrics,
                     score: r.score
                   });
                   
                   // Periodically sort to keep top results
                   if (topResults.length >= 2000) {
                     topResults.sort((a, b) => (b.score || 0) - (a.score || 0));
                     topResults = topResults.slice(0, 200);
                   }
                   return;
                }
                const courseCode = keys[idx];
                const sectionArray = r.selectedSections[courseCode] as string[];
                for (const sec of sectionArray) {
                  currentSelections[courseCode] = sec;
                  expandHelper(idx + 1, currentSelections);
                }
              };
              
              expandHelper(0, {});
           });
        }
        
        // Progress will be reported at the end of the chunk
        // since compute_chunk blocks and executes synchronously
        self.postMessage({ 
          type: 'PROGRESS', 
          evaluated: estimatedTotal, // Or whatever
          total: estimatedTotal,
          validFound: topResults.length
        } as WorkerMessage);

      } catch (e) {
        console.error("Error in compute_chunk", e);
      }
      
      self.postMessage({
        type: 'DONE',
        results: topResults,
        workerId: task.workerId
      } as WorkerMessage);
      
      break;
    }"""

code = re.sub(old_task, new_task, code, flags=re.DOTALL)

with open('src/utils/scheduleWorker.ts', 'w') as f:
    f.write(code)

