import { nanoid } from "nanoid";
import { chunkPages } from "./chunk";
import { parseFile } from "./parse";
import { embedDocuments } from "./embeddings";
import {
  addChunks,
  registerDocument,
  type ChunkRow,
  type DocumentMeta,
} from "./vectorstore";

/** Full ingestion pipeline: parse -> chunk -> embed -> store. */
export async function ingestFile(
  buffer: Buffer,
  filename: string,
  mime: string,
): Promise<DocumentMeta> {
  const pages = await parseFile(buffer, filename, mime);
  const chunks = chunkPages(pages);
  if (chunks.length === 0) {
    throw new Error("Tidak ada teks yang bisa diekstrak dari dokumen ini.");
  }

  const vectors = await embedDocuments(chunks.map((c) => c.text));
  const docId = nanoid();

  const rows: ChunkRow[] = chunks.map((c, i) => ({
    id: `${docId}:${i}`,
    docId,
    docName: filename,
    page: c.page,
    chunkIndex: i,
    text: c.text,
    vector: vectors[i],
  }));

  await addChunks(rows);

  const meta: DocumentMeta = {
    id: docId,
    name: filename,
    size: buffer.length,
    chunks: rows.length,
    createdAt: new Date().toISOString(),
  };
  await registerDocument(meta);
  return meta;
}
