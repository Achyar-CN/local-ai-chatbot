import path from "node:path";
import fs from "node:fs/promises";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

export function extOf(filename: string): string {
  return (filename.toLowerCase().split(".").pop() ?? "bin").replace(/[^a-z0-9]/g, "");
}

export function originalPath(docId: string, ext: string): string {
  return path.join(UPLOADS_DIR, `${docId}.${ext}`);
}

export async function saveOriginal(docId: string, ext: string, buffer: Buffer) {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.writeFile(originalPath(docId, ext), buffer);
}

export async function readOriginal(docId: string, ext: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(originalPath(docId, ext));
  } catch {
    return null;
  }
}

export async function deleteOriginal(docId: string, ext: string) {
  await fs.rm(originalPath(docId, ext), { force: true });
}
