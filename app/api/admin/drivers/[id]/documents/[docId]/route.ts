import { sql } from "@/lib/db";
import { route, fail, type Ctx } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

export const GET = route(async (_req, ctx: Ctx<{ id: string; docId: string }>) => {
  await requireAdmin();
  const { id, docId } = await ctx.params;
  const [d] = await sql`select filename, mime, bytes from driver_documents where id = ${docId} and driver_id = ${id}`;
  if (!d) throw fail(404, "Document not found", "not_found");
  return new Response(new Uint8Array(d.bytes), {
    headers: {
      "Content-Type": d.mime,
      "Content-Disposition": `inline; filename="${String(d.filename).replace(/[^\w.-]/g, "_")}"`,
      "Content-Security-Policy": "sandbox",
      "Cache-Control": "private, no-store",
    },
  });
});
