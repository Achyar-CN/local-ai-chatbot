import { NextResponse } from "next/server";
import { getConversation, deleteConversation, renameConversation } from "@/lib/store";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) {
    return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });
  }
  return NextResponse.json({ conversation });
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const { title } = (await req.json()) as { title?: string };
  if (!title?.trim()) {
    return NextResponse.json({ error: "title wajib diisi." }, { status: 400 });
  }
  await renameConversation(id, title.trim());
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  await deleteConversation(id);
  return NextResponse.json({ ok: true });
}
