import path from "node:path";
import fs from "node:fs";
import { createWorker, type Worker } from "tesseract.js";

const TESSDATA = path.resolve(process.cwd(), "tessdata");
const hasLocalData = fs.existsSync(path.join(TESSDATA, "eng.traineddata.gz"));

// Skip inputs too small to plausibly contain readable text. This also avoids a
// tesseract worker quirk where unreadable/degenerate images raise async errors.
const MIN_BYTES = 1024;

/**
 * OCR a single image buffer to plain text. Creates and terminates a worker per
 * call so a bad input can never poison a shared instance. Returns "" on failure.
 */
export async function ocrImage(buffer: Buffer | Uint8Array): Promise<string> {
  if (!buffer || buffer.byteLength < MIN_BYTES) return "";

  let worker: Worker | null = null;
  try {
    const options = hasLocalData
      ? { langPath: TESSDATA, gzip: true, cachePath: TESSDATA, logger: () => {}, errorHandler: () => {} }
      : { logger: () => {}, errorHandler: () => {} };
    worker = await createWorker("eng+ind", 1, options);
    const { data } = await worker.recognize(Buffer.from(buffer));
    return (data.text ?? "").replace(/\s+\n/g, "\n").trim();
  } catch (err) {
    console.error("OCR failed:", err instanceof Error ? err.message : err);
    return "";
  } finally {
    try {
      await worker?.terminate();
    } catch {
      /* ignore */
    }
  }
}
