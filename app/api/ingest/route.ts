import { NextResponse } from "next/server";
import { ingestFile } from "@/lib/rag/ingest";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: "Tidak ada file yang diunggah." }, { status: 400 });
    }

    const results = [];
    for (const file of files) {
      if (file.size > MAX_SIZE) {
        return NextResponse.json(
          { error: `${file.name} terlalu besar (maks 25 MB).` },
          { status: 400 },
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const meta = await ingestFile(buffer, file.name, file.type);
      results.push(meta);
    }

    return NextResponse.json({ documents: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingest gagal.";
    console.error("Ingest error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
