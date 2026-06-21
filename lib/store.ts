import path from "node:path";
import fs from "node:fs/promises";
import type { UIMessage } from "ai";

const DATA_DIR = path.resolve(process.cwd(), ".data");
const CHATS_DIR = path.join(DATA_DIR, "chats");
const INDEX = path.join(DATA_DIR, "conversations.json");

export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface Conversation extends ConversationMeta {
  messages: UIMessage[];
}

async function ensureDirs() {
  await fs.mkdir(CHATS_DIR, { recursive: true });
}

async function readIndex(): Promise<ConversationMeta[]> {
  try {
    return JSON.parse(await fs.readFile(INDEX, "utf8"));
  } catch {
    return [];
  }
}

async function writeIndex(list: ConversationMeta[]) {
  await ensureDirs();
  await fs.writeFile(INDEX, JSON.stringify(list, null, 2), "utf8");
}

function deriveTitle(messages: UIMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  const text =
    firstUser?.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as { text: string }).text)
      .join(" ")
      .trim() ?? "";
  if (!text) return "New conversation";
  return text.length > 48 ? `${text.slice(0, 48)}…` : text;
}

export async function listConversations(): Promise<ConversationMeta[]> {
  return (await readIndex()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getConversation(id: string): Promise<Conversation | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(CHATS_DIR, `${id}.json`), "utf8"));
  } catch {
    return null;
  }
}

export async function saveConversation(
  id: string,
  messages: UIMessage[],
  title?: string,
): Promise<ConversationMeta> {
  await ensureDirs();
  const now = new Date().toISOString();
  const index = await readIndex();
  const existing = index.find((c) => c.id === id);

  const meta: ConversationMeta = {
    id,
    title: title ?? existing?.title ?? deriveTitle(messages),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    messageCount: messages.length,
  };

  const conversation: Conversation = { ...meta, messages };
  await fs.writeFile(
    path.join(CHATS_DIR, `${id}.json`),
    JSON.stringify(conversation, null, 2),
    "utf8",
  );
  await writeIndex([meta, ...index.filter((c) => c.id !== id)]);
  return meta;
}

export async function renameConversation(id: string, title: string) {
  const index = await readIndex();
  const meta = index.find((c) => c.id === id);
  if (!meta) return;
  meta.title = title;
  meta.updatedAt = new Date().toISOString();
  await writeIndex(index);
  const conv = await getConversation(id);
  if (conv) {
    conv.title = title;
    await fs.writeFile(path.join(CHATS_DIR, `${id}.json`), JSON.stringify(conv, null, 2), "utf8");
  }
}

export interface SearchHit {
  id: string;
  title: string;
  snippet: string;
}

function plain(m: UIMessage): string {
  return (m.parts as { type: string; text?: string }[])
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join(" ");
}

/** Search conversation titles and message text. */
export async function searchConversations(query: string): Promise<SearchHit[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const index = await listConversations();
  const hits: SearchHit[] = [];
  for (const meta of index) {
    const conv = await getConversation(meta.id);
    if (!conv) continue;
    const body = conv.messages.map(plain).join("  ");
    const hay = `${meta.title}  ${body}`.toLowerCase();
    const at = hay.indexOf(q);
    if (at < 0) continue;
    const start = Math.max(0, at - 40);
    const snippet = `${start > 0 ? "…" : ""}${`${meta.title}  ${body}`.slice(start, at + q.length + 60).trim()}…`;
    hits.push({ id: meta.id, title: meta.title, snippet });
  }
  return hits;
}

export async function deleteConversation(id: string) {
  const index = await readIndex();
  await writeIndex(index.filter((c) => c.id !== id));
  await fs.rm(path.join(CHATS_DIR, `${id}.json`), { force: true });
}
