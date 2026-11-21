"use client";

import { useActionState, useState } from "react";
import { adjustStockAction, type AdjustState } from "@/app/admin/(panel)/inventory/actions";
import { AlertIcon, CheckIcon } from "../icons";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

const REASONS = [
  { value: "received", label: "Received (adds stock)" },
  { value: "return", label: "Customer return (adds stock)" },
  { value: "damaged", label: "Damaged (removes stock)" },
  { value: "correction", label: "Correction (add or remove)" },
];

export function StockAdjustForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState<AdjustState, FormData>(adjustStockAction, {});
  const [reason, setReason] = useState("received");
  return (
    <form action={action} className="flex flex-col gap-3" data-testid="adjust-form" key={state.ok ?? "form"}>
      <input type="hidden" name="productId" value={productId} />
      {state.error && (
        <p role="alert" className="bg-danger-soft text-danger flex gap-2 rounded-md p-2.5 text-sm" data-testid="adjust-error">
          <AlertIcon size={18} className="mt-0.5 shrink-0" /> {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="bg-primary-soft text-primary flex gap-2 rounded-md p-2.5 text-sm" data-testid="adjust-ok">
          <CheckIcon size={18} className="mt-0.5 shrink-0" /> {state.ok}
        </p>
      )}
      <Select label="Reason" name="reason" options={REASONS} value={reason} onChange={(e) => setReason(e.target.value)} />
      {reason === "correction" && (
        <fieldset className="flex gap-4 text-sm">
          <legend className="mb-1 text-sm font-medium">Direction</legend>
          <label className="inline-flex min-h-11 items-center gap-2">
            <input type="radio" name="direction" value="add" defaultChecked className="accent-primary size-4" /> Add
          </label>
          <label className="inline-flex min-h-11 items-center gap-2">
            <input type="radio" name="direction" value="remove" className="accent-primary size-4" /> Remove
          </label>
        </fieldset>
      )}
      <Input label="Quantity" name="quantity" inputMode="numeric" required maxLength={6} />
      <Input label="Note (optional)" name="note" maxLength={200} hint="For example a delivery reference. No customer details." />
      <div>
        <Button type="submit" loading={pending} data-testid="adjust-save">
          Save adjustment
        </Button>
      </div>
    </form>
  );
}
