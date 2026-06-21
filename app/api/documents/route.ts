import { NextResponse } from "next/server";
import { listDocuments, deleteDocument } from "@/lib/rag/vectorstore";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ documents: await listDocuments() });
  } catch (err) {
    console.error("List documents error:", err);
    return NextResponse.json({ documents: [] });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id wajib diisi." }, { status: 400 });
  }
  try {
    await deleteDocument(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Hapus gagal.";
    console.error("Delete document error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
