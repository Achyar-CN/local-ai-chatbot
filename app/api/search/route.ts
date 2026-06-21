import { NextResponse } from "next/server";
import { searchConversations } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    return NextResponse.json({ hits: await searchConversations(q) });
  } catch (err) {
    console.error("Search error:", err);
    return NextResponse.json({ hits: [] });
  }
}
