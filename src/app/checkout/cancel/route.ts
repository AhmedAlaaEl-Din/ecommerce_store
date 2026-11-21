/**
 * Stripe's cancel_url (and the mock page's Cancel): releases the reservation
 * and sends the shopper back to the filled-in checkout form. Redirects use the
 * configured SITE_URL, never the request Host header.
 */
import { NextResponse, type NextRequest } from "next/server";
import { cancelPendingOrder } from "@/lib/orders/cancel";
import { PUBLIC_TOKEN_RE } from "@/lib/orders/service";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("order") ?? "";
  if (!PUBLIC_TOKEN_RE.test(token)) {
    return NextResponse.redirect(new URL("/checkout", SITE_URL), 303);
  }
  await cancelPendingOrder(token);
  const to = new URL("/checkout", SITE_URL);
  to.searchParams.set("order", token);
  to.searchParams.set("status", "cancelled");
  return NextResponse.redirect(to, 303);
}
