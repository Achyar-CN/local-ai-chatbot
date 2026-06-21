import { NextResponse } from "next/server";
import { generateText } from "ai";
import { ollama } from "@/lib/ollama";
import { config } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { text } = (await req.json()) as { text?: string };
    const snippet = (text ?? "").slice(0, 500).trim();
    if (!snippet) return NextResponse.json({ title: "New conversation" });

    const { text: out } = await generateText({
      model: ollama(config.chatModelFast),
      temperature: 0.2,
      maxOutputTokens: 24,
      system:
        "Write a VERY short title (max 6 words) for this conversation. No quotes, no trailing period, no 'Title:' prefix, no dashes. Match the language of the user's message.",
      prompt: snippet,
    });

    const title = out
      .replace(/^["']|["'.]+$/g, "")
      .replace(/[—–-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);
    return NextResponse.json({ title: title || "New conversation" });
  } catch (err) {
    console.error("Title gen error:", err);
    return NextResponse.json({ title: "New conversation" });
  }
}
