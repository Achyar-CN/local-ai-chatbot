import mammoth from "mammoth";
import type { PageText } from "./chunk";

/** Parse a supported file into page-segmented text. */
export async function parseFile(
  buffer: Buffer,
  filename: string,
  mime: string,
): Promise<PageText[]> {
  const ext = filename.toLowerCase().split(".").pop() ?? "";

  if (ext === "pdf" || mime === "application/pdf") {
    return parsePdf(buffer);
  }
  if (
    ext === "docx" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const { value } = await mammoth.extractRawText({ buffer });
    return [{ page: 1, text: value }];
  }
  if (["txt", "md", "markdown", "csv", "json"].includes(ext) || mime.startsWith("text/")) {
    return [{ page: 1, text: buffer.toString("utf8") }];
  }

  throw new Error(`Format tidak didukung: .${ext}. Gunakan PDF, DOCX, TXT, atau MD.`);
}

async function parsePdf(buffer: Buffer): Promise<PageText[]> {
  // pdf-parse v2 ships ESM; import dynamically so it stays out of the bundle.
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.pages
      .map((p) => ({ page: p.num, text: p.text }))
      .filter((p) => p.text.trim().length > 0);
  } finally {
    await parser.destroy();
  }
}

export const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".csv", ".json"];
