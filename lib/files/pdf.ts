/** Extract text from a PDF buffer using pdfjs-dist (server-side, no worker). */
export async function extractPdfText(data: Uint8Array): Promise<string> {
  // Use the legacy build which works in Node without a DOM.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Disable the worker — run on the main thread in the server runtime.
  (pdfjs as any).GlobalWorkerOptions.workerSrc = "";
  const loadingTask = (pdfjs as any).getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  const maxPages = Math.min(pdf.numPages, 50);
  const parts: string[] = [];
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((it: any) => ("str" in it ? it.str : ""));
    parts.push(strings.join(" "));
  }
  if (pdf.numPages > maxPages) {
    parts.push(`\n[... ${pdf.numPages - maxPages} more pages truncated ...]`);
  }
  return parts.join("\n\n").trim();
}
