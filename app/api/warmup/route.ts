import { NextResponse } from "next/server";
import { config, DEFAULT_CHAT_MODEL } from "@/lib/config";

export const runtime = "nodejs";

/** Preload models into Ollama so the first real request streams instantly. */
export async function POST(req: Request) {
  const { model }: { model?: string } = await req.json().catch(() => ({}));
  const chat = model || DEFAULT_CHAT_MODEL;
  const base = config.ollamaBaseURL;

  const warm = [
    fetch(`${base}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: chat, keep_alive: config.keepAlive }),
    }),
    fetch(`${base}/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: config.embedModel, input: "warmup", keep_alive: config.keepAlive }),
    }),
  ];

  try {
    await Promise.allSettled(warm);
  } catch {
    /* best effort */
  }
  return NextResponse.json({ ok: true });
}
