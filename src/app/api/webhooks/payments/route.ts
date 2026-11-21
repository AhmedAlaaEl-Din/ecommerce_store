/**
 * Payment webhook (Stripe and mock). Protected by the signature, not by
 * cookies/Origin (CSRF does not apply: it is server-to-server and must accept
 * Stripe's requests). The raw body is verified before anything is parsed.
 */
import { MAX_WEBHOOK_BODY_BYTES, receiveWebhook } from "@/lib/payments/receive";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? "0");
  const result =
    length > MAX_WEBHOOK_BODY_BYTES
      ? { status: 413, body: { error: "too_large" } }
      : await receiveWebhook(await request.text(), request.headers.get("stripe-signature"));
  return Response.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}
