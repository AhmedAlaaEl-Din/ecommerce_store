"use client";

import { useActionState } from "react";
import {
  addNoteAction,
  fulfilmentAction,
  type OrderActionState,
} from "@/app/admin/(panel)/orders/actions";
import { cn } from "@/lib/cn";
import type { FulfilmentStatus } from "@/lib/admin/order-rules";
import { AlertIcon } from "../icons";
import { Button } from "../ui/Button";
import { fieldClasses, Input } from "../ui/Input";

function ErrorLine({ error, testId }: { error?: string; testId: string }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className="bg-danger-soft text-danger flex gap-2 rounded-md p-2.5 text-sm"
      data-testid={testId}
    >
      <AlertIcon size={18} className="mt-0.5 shrink-0" /> {error}
    </p>
  );
}

const LABELS: Record<Exclude<FulfilmentStatus, "unfulfilled">, string> = {
  packed: "Mark as packed",
  shipped: "Mark as shipped",
  delivered: "Mark as delivered",
};

/** The one next fulfilment step; "shipped" asks for the carrier and tracking number. */
export function FulfilmentForm({
  orderId,
  next,
}: {
  orderId: string;
  next: Exclude<FulfilmentStatus, "unfulfilled">;
}) {
  const [state, action, pending] = useActionState<OrderActionState, FormData>(fulfilmentAction, {});
  return (
    <form action={action} className="flex flex-col gap-3" data-testid="fulfilment-form">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="to" value={next} />
      <ErrorLine error={state.error} testId="fulfilment-error" />
      {next === "shipped" && (
        <>
          <Input
            label="Carrier"
            name="carrier"
            required
            maxLength={60}
            placeholder="e.g. Nile Post"
          />
          <Input
            label="Tracking number"
            name="trackingNumber"
            required
            maxLength={60}
            spellCheck={false}
          />
        </>
      )}
      <div>
        <Button type="submit" loading={pending} data-testid={`mark-${next}`}>
          {LABELS[next]}
        </Button>
      </div>
    </form>
  );
}

export function NoteForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<OrderActionState, FormData>(addNoteAction, {});
  return (
    <form action={action} className="flex flex-col gap-2" data-testid="note-form">
      <input type="hidden" name="orderId" value={orderId} />
      <ErrorLine error={state.error} testId="note-error" />
      <label htmlFor="note-body" className="text-sm font-medium">
        Add an internal note
      </label>
      <textarea
        id="note-body"
        name="body"
        rows={3}
        maxLength={1000}
        required
        className={cn(fieldClasses.replace("h-11", ""), "min-h-20 py-2 leading-6")}
        aria-describedby="note-hint"
      />
      <p id="note-hint" className="text-muted text-xs">
        Only staff see notes. They are never shown to the customer.
      </p>
      <div>
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          loading={pending}
          data-testid="note-save"
        >
          Add note
        </Button>
      </div>
    </form>
  );
}
