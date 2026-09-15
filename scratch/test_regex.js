const r = /Semana\s+General\s+(Lun\w*|Mar\w*|Mi[eé]\w*|Jue\w*|Vie\w*|S[aá]b\w*|Dom\w*)\.?\s+(Teor[íi]a|Lab\w*|Pr[aá]c\w*|Tall\w*)\s*(Virtual)?\s*:?\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*(.*)/i;
console.log("Test 1:", r.test("Semana General Mar. Laboratorio:15:00-17:00 M802"));
