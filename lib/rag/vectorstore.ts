import path from "node:path";
import fs from "node:fs/promises";
import * as lancedb from "@lancedb/lancedb";
import { Schema, Field, Float32, FixedSizeList, Utf8, Int32 } from "apache-arrow";
import { config } from "../config";

const TABLE = "chunks";
const DB_DIR = path.resolve(process.cwd(), config.lancedbPath);
const MANIFEST = path.join(DB_DIR, "manifest.json");

export interface ChunkRow {
  id: string;
  docId: string;
  docName: string;
  page: number;
  chunkIndex: number;
  text: string;
  vector: number[];
}

export interface RetrievedChunk {
  id: string;
  docId: string;
  docName: string;
  page: number;
  text: string;
  score: number;
}

export interface DocumentMeta {
  id: string;
  name: string;
  size: number;
  chunks: number;
  createdAt: string;
}

function vectorField(dim: number) {
  return new Field("vector", new FixedSizeList(dim, new Field("item", new Float32(), true)), true);
}

const schema = new Schema([
  new Field("id", new Utf8(), false),
  new Field("docId", new Utf8(), false),
  new Field("docName", new Utf8(), false),
  new Field("page", new Int32(), false),
  new Field("chunkIndex", new Int32(), false),
  new Field("text", new Utf8(), false),
  vectorField(config.embedDim),
]);

let dbPromise: Promise<lancedb.Connection> | null = null;
function getDB() {
  if (!dbPromise) dbPromise = lancedb.connect(DB_DIR);
  return dbPromise;
}

async function getTable() {
  const db = await getDB();
  const names = await db.tableNames();
  if (names.includes(TABLE)) return db.openTable(TABLE);
  return db.createEmptyTable(TABLE, schema);
}

// --- chunks --------------------------------------------------------------

export async function addChunks(rows: ChunkRow[]) {
  if (rows.length === 0) return;
  const table = await getTable();
  await table.add(rows as unknown as Record<string, unknown>[]);
}

export async function searchChunks(
  queryVector: number[],
  k = config.topK,
): Promise<RetrievedChunk[]> {
  const table = await getTable();
  if ((await table.countRows()) === 0) return [];
  // Note: no .select() projection so LanceDB keeps returning `_distance`
  // (selecting explicit columns triggers a deprecation around scoring autoprojection).
  const results = await table
    .query()
    .nearestTo(queryVector)
    .distanceType("cosine")
    .limit(k)
    .toArray();

  return results.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    docId: r.docId as string,
    docName: r.docName as string,
    page: r.page as number,
    text: r.text as string,
    score: 1 - (r._distance as number), // cosine distance -> similarity
  }));
}

// --- document manifest ---------------------------------------------------

async function readManifest(): Promise<DocumentMeta[]> {
  try {
    return JSON.parse(await fs.readFile(MANIFEST, "utf8"));
  } catch {
    return [];
  }
}

async function writeManifest(docs: DocumentMeta[]) {
  await fs.mkdir(DB_DIR, { recursive: true });
  await fs.writeFile(MANIFEST, JSON.stringify(docs, null, 2), "utf8");
}

export async function listDocuments(): Promise<DocumentMeta[]> {
  return (await readManifest()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function registerDocument(doc: DocumentMeta) {
  const docs = await readManifest();
  await writeManifest([...docs.filter((d) => d.id !== doc.id), doc]);
}

export async function deleteDocument(docId: string) {
  const table = await getTable();
  await table.delete(`docId = '${docId.replace(/'/g, "''")}'`);
  const docs = await readManifest();
  await writeManifest(docs.filter((d) => d.id !== docId));
}
