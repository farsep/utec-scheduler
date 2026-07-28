import * as pdfjsLib from 'pdfjs-dist';

// Set web worker src for client-side PDF parsing
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

export interface PDFParseResult {
  eligibleCourseCodes: Set<string>;
  eligibleCoursesMap: Map<string, { type: 'Obligatorio' | 'Electivo' | string; plan?: string }>;
  extractedText: string;
}

export async function parsePDFFile(arrayBuffer: ArrayBuffer): Promise<PDFParseResult> {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  
  let fullText = '';
  const eligibleCourseCodes = new Set<string>();
  const eligibleCoursesMap = new Map<string, { type: string; plan?: string }>();

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    
    fullText += pageText + '\n';
  }

  // Regex to extract UTEC course codes like CC1103, CS2023, HH5101, AD3108, PI3103, BI4011, IN2004, etc.
  const courseCodeRegex = /\b([A-Z]{2,4}\d{4})\b/g;
  let match;
  while ((match = courseCodeRegex.exec(fullText)) !== null) {
    const code = match[1];
    eligibleCourseCodes.add(code);
  }

  // Detect Obligatorio / Electivo association
  const lines = fullText.split('\n');
  lines.forEach(line => {
    const codeMatch = line.match(/\b([A-Z]{2,4}\d{4})\b/);
    if (codeMatch) {
      const code = codeMatch[1];
      let type = 'Obligatorio';
      if (line.toLowerCase().includes('electivo')) {
        type = 'Electivo';
      }
      let plan = undefined;
      const planMatch = line.match(/(CD-\d{4}-\d)/);
      if (planMatch) {
        plan = planMatch[1];
      }
      eligibleCoursesMap.set(code, { type, plan });
    }
  });

  return {
    eligibleCourseCodes,
    eligibleCoursesMap,
    extractedText: fullText
  };
}
