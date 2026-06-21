import mammoth from "mammoth";
import type { PageText } from "./chunk";
import { ocrImage } from "./ocr";

const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp", "bmp", "tiff", "gif"];

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
  if (IMAGE_EXTS.includes(ext) || mime.startsWith("image/")) {
    const text = await ocrImage(buffer);
    return [{ page: 1, text }];
  }
  if (["txt", "md", "markdown", "csv", "json"].includes(ext) || mime.startsWith("text/")) {
    return [{ page: 1, text: buffer.toString("utf8") }];
  }

  throw new Error(`Unsupported format: .${ext}. Use PDF, DOCX, image, TXT, or MD.`);
}

async function parsePdf(buffer: Buffer): Promise<PageText[]> {
  // pdf-parse v2 ships ESM; import dynamically so it stays out of the bundle.
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    const pages = result.pages
      .map((p) => ({ page: p.num, text: p.text }))
      .filter((p) => p.text.trim().length > 0);

    // Looks like a scanned PDF (little or no extractable text): OCR the pages.
    const totalChars = pages.reduce((n, p) => n + p.text.length, 0);
    if (totalChars < 64) {
      const ocred = await ocrPdf(parser);
      if (ocred.length > 0) return ocred;
    }
    return pages;
  } finally {
    await parser.destroy();
  }
}

/** Render each PDF page to an image and OCR it (for scanned documents). */
async function ocrPdf(parser: {
  getScreenshot: (p: { imageBuffer: boolean; scale: number }) => Promise<{
    pages: { pageNumber: number; data?: Uint8Array }[];
  }>;
}): Promise<PageText[]> {
  try {
    const shot = await parser.getScreenshot({ imageBuffer: true, scale: 2 });
    const out: PageText[] = [];
    for (const p of shot.pages) {
      if (!p.data) continue;
      const text = await ocrImage(p.data);
      if (text.trim()) out.push({ page: p.pageNumber, text });
    }
    return out;
  } catch (err) {
    console.error("PDF OCR failed:", err);
    return [];
  }
}

export const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
];
