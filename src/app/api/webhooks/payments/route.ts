/**
 * Payment webhook (Stripe and mock). Protected by the signature, not by
 * cookies/Origin (CSRF does not apply: it is server-to-server and must accept
 * Stripe's requests). The raw body is verified before anything is parsed.
 */
import { MAX_WEBHOOK_BODY_BYTES, receiveWebhook } from "@/lib/payments/receive";

export const dynamic = "force-dynamic";

/** Reads the body as UTF-8 text, giving up as soon as it exceeds `limit` bytes. */
async function readCapped(request: Request, limit: number): Promise<string | null> {
  if (Number(request.headers.get("content-length") ?? "0") > limit) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function POST(request: Request) {
  const raw = await readCapped(request, MAX_WEBHOOK_BODY_BYTES);
  const result =
    raw === null
      ? { status: 413, body: { error: "too_large" } }
      : await receiveWebhook(raw, request.headers.get("stripe-signature"));
  return Response.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}
