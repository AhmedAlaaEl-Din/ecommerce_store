"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { oneOf } from "@/lib/admin/format";
import type { FulfilmentStatus } from "@/lib/admin/order-rules";
import { addNote, advanceFulfilment, cancelOrder, refundOrder } from "@/lib/admin/orders";
import { db } from "@/lib/db";
import { writeNoticeEmail } from "@/lib/orders/outbox";
import { getPayments } from "@/lib/payments";

export type OrderActionState = { error?: string };

const STEPS = ["packed", "shipped", "delivered"] as const;

function orderPath(id: string) {
  return `/admin/orders/${encodeURIComponent(id)}`;
}

/** Staff and admins: move fulfilment one step (shipped needs carrier + tracking). */
export async function fulfilmentAction(
  _prev: OrderActionState,
  fd: FormData,
): Promise<OrderActionState> {
  const { user } = await requireAdmin();
  const orderId = String(fd.get("orderId") ?? "");
  const to = oneOf(String(fd.get("to") ?? ""), STEPS) as FulfilmentStatus | undefined;
  if (!to) return { error: "Choose the next step." };
  const res = await advanceFulfilment(
    db,
    user,
    orderId,
    to,
    {
      carrier: String(fd.get("carrier") ?? ""),
      trackingNumber: String(fd.get("trackingNumber") ?? ""),
    },
    (id) => writeNoticeEmail(db, id, "shipped"),
  );
  if (!res.ok) return { error: res.error };
  revalidatePath("/admin", "layout");
  revalidatePath("/order", "layout");
  redirect(`${orderPath(orderId)}?done=${to}`);
}

/** Staff and admins: internal note (never shown to customers). */
export async function addNoteAction(
  _prev: OrderActionState,
  fd: FormData,
): Promise<OrderActionState> {
  const { user } = await requireAdmin();
  const orderId = String(fd.get("orderId") ?? "");
  const res = await addNote(db, user, orderId, String(fd.get("body") ?? ""));
  if (!res.ok) return { error: res.error };
  redirect(`${orderPath(orderId)}?done=note#notes`);
}

/** Admins only: cancel an order that is still waiting for payment. */
export async function cancelOrderAction(fd: FormData): Promise<void> {
  const { user } = await requireAdmin("admin");
  const orderId = String(fd.get("orderId") ?? "");
  const res = await cancelOrder(db, user, orderId, getPayments().provider);
  revalidatePath("/admin", "layout");
  redirect(`${orderPath(orderId)}?done=${res.ok ? "cancelled" : "cancel_failed"}`);
}

/** Admins only: full refund through the configured payment provider. */
export async function refundOrderAction(fd: FormData): Promise<void> {
  const { user } = await requireAdmin("admin");
  const orderId = String(fd.get("orderId") ?? "");
  const restock = fd.get("restock") === "on";
  const res = await refundOrder(db, user, orderId, { restock }, getPayments().provider, (id) =>
    writeNoticeEmail(db, id, "refund"),
  );
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
  redirect(`${orderPath(orderId)}?done=${res.ok ? "refunded" : "refund_failed"}`);
}
