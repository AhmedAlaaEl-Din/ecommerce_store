import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MEDIA_FILE_RE, uploadsDir } from "@/lib/admin/images";

/**
 * Serves uploaded product images from public/uploads/products/. `next start`
 * only serves public/ files that existed at build time, so uploads made later
 * need this route. Only generated names are accepted (no path traversal).
 */
export async function GET(_req: Request, ctx: RouteContext<"/media/products/[file]">) {
  const { file } = await ctx.params;
  if (!MEDIA_FILE_RE.test(file)) return new Response("Not found", { status: 404 });
  try {
    const bytes = await readFile(join(/*turbopackIgnore: true*/ uploadsDir(), file));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
