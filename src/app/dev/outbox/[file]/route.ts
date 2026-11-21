/** Development only: serves one outbox email (file names are validated, no traversal). */
import { readOutboxFile } from "@/lib/orders/outbox";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/dev/outbox/[file]">) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const { file } = await ctx.params;
  const html = await readOutboxFile(file);
  if (html === null) return new Response("Not found", { status: 404 });
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      // The email is our own escaped HTML; lock it down anyway.
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:",
      "x-robots-tag": "noindex",
    },
  });
}
