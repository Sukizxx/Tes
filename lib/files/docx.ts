/** Extract text from a DOCX buffer using mammoth. */
export async function extractDocxText(data: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: data });
  return (result.value ?? "").trim();
}
