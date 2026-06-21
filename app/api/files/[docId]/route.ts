import { getDocument } from "@/lib/rag/vectorstore";
import { readOriginal } from "@/lib/rag/files";

export const runtime = "nodejs";

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  markdown: "text/markdown; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  json: "application/json; charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function GET(_req: Request, { params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  const doc = await getDocument(docId);
  if (!doc?.ext) return new Response("Not found", { status: 404 });

  const buffer = await readOriginal(docId, doc.ext);
  if (!buffer) return new Response("Not found", { status: 404 });

  const type = doc.mime || MIME_BY_EXT[doc.ext] || "application/octet-stream";
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.name)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
