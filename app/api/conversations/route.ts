import { NextResponse } from "next/server";
import type { UIMessage } from "ai";
import { listConversations, saveConversation } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ conversations: await listConversations() });
  } catch (err) {
    console.error("List conversations error:", err);
    return NextResponse.json({ conversations: [] });
  }
}

export async function POST(req: Request) {
  try {
    const { id, messages, title } = (await req.json()) as {
      id: string;
      messages: UIMessage[];
      title?: string;
    };
    if (!id || !Array.isArray(messages)) {
      return NextResponse.json({ error: "id dan messages wajib diisi." }, { status: 400 });
    }
    const meta = await saveConversation(id, messages, title);
    return NextResponse.json({ conversation: meta });
  } catch (err) {
    console.error("Save conversation error:", err);
    return NextResponse.json({ error: "Gagal menyimpan percakapan." }, { status: 500 });
  }
}
