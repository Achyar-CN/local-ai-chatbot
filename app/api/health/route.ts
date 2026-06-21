import { NextResponse } from "next/server";
import { config } from "@/lib/config";

export const runtime = "nodejs";

export async function GET() {
  try {
    const res = await fetch(`${config.ollamaBaseURL}/tags`, {
      signal: AbortSignal.timeout(2500),
    });
    return NextResponse.json({ online: res.ok });
  } catch {
    return NextResponse.json({ online: false });
  }
}
