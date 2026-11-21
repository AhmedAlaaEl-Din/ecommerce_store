import { oneOf, param } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/admin/guard";
import { FULFILMENT_STEPS } from "@/lib/admin/order-rules";
import { exportOrdersCsv, ORDER_SORTS } from "@/lib/admin/orders";
import { db } from "@/lib/db";

const PAYMENT = [
  "pending_payment",
  "paid",
  "payment_failed",
  "cancelled",
  "expired",
  "refunded",
] as const;

/** Admins only: the filtered order list as CSV (formula-injection safe). */
export async function GET(req: Request) {
  const { user } = await requireAdmin("admin");
  const sp = Object.fromEntries(new URL(req.url).searchParams.entries());
  const { csv, count } = await exportOrdersCsv(db, user, {
    q: param(sp, "q"),
    status: oneOf(param(sp, "status"), PAYMENT),
    fulfilment: oneOf(param(sp, "fulfilment"), FULFILMENT_STEPS),
    from: param(sp, "from"),
    to: param(sp, "to"),
    sort: oneOf(param(sp, "sort"), ORDER_SORTS),
  });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nile-goods-orders-${stamp}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Row-Count": String(count),
    },
  });
}
