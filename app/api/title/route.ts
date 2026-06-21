import { NextResponse } from "next/server";
import { generateText } from "ai";
import { ollama } from "@/lib/ollama";
import { config } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { text } = (await req.json()) as { text?: string };
    const snippet = (text ?? "").slice(0, 500).trim();
    if (!snippet) return NextResponse.json({ title: "Percakapan baru" });

    const { text: out } = await generateText({
      model: ollama(config.chatModelFast),
      temperature: 0.2,
      maxOutputTokens: 24,
      system:
        "Buat judul SANGAT singkat (maks 6 kata) untuk percakapan ini. Tanpa tanda kutip, tanpa titik, tanpa awalan 'Judul:'. Pakai bahasa pesan pengguna.",
      prompt: snippet,
    });

    const title = out.replace(/^["']|["'.]+$/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
    return NextResponse.json({ title: title || "Percakapan baru" });
  } catch (err) {
    console.error("Title gen error:", err);
    return NextResponse.json({ title: "Percakapan baru" });
  }
}
