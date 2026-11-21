"use client";

import { useActionState, useEffect, useRef } from "react";
import { placeOrderAction, type CheckoutState } from "@/app/checkout/actions";
import type { CheckoutField, CheckoutValues } from "@/lib/orders/checkout-schema";
import { AlertIcon, ShieldIcon } from "../icons";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

const FIELD_ORDER: CheckoutField[] = [
  "email",
  "name",
  "addressLine1",
  "addressLine2",
  "city",
  "postalCode",
  "country",
];

const FIELD_LABELS: Record<CheckoutField, string> = {
  email: "Email",
  name: "Full name",
  addressLine1: "Street address",
  addressLine2: "Apartment, suite, etc.",
  city: "Town or city",
  postalCode: "Postal code",
  country: "Country",
};

export function CheckoutForm({
  initialValues,
  countries,
  totalLabel,
  providerNote,
}: {
  initialValues: CheckoutValues;
  countries: ReadonlyArray<{ code: string; name: string }>;
  totalLabel: string;
  providerNote: string;
}) {
  const [state, formAction, pending] = useActionState<CheckoutState, FormData>(placeOrderAction, {
    values: initialValues,
    errors: {},
    attempt: 0,
  });
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const v = state.values;
  const e = state.errors;
  const errorFields = FIELD_ORDER.filter((f) => e[f]);

  // After a failed submit, move focus to the error summary (or the form error).
  useEffect(() => {
    if (state.attempt > 0) summaryRef.current?.focus();
  }, [state.attempt]);

  return (
    // key: remount after each submit so every field (including the select) shows
    // the values returned by the server; React's automatic form reset would
    // otherwise put the select back to its first default.
    <form
      key={state.attempt}
      ref={formRef}
      action={formAction}
      noValidate
      className="flex flex-col gap-8"
      aria-describedby={state.formError ? "checkout-form-error" : undefined}
      data-testid="checkout-form"
    >
      {(state.formError || errorFields.length > 0) && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          id="checkout-form-error"
          className="border-danger/40 bg-danger-soft text-ink rounded-lg border p-4 text-sm focus:outline-none"
          data-testid="checkout-error"
        >
          <p className="flex items-center gap-2 font-semibold">
            <AlertIcon size={18} className="text-danger shrink-0" />
            {state.formError ?? "Please check the highlighted fields."}
          </p>
          {errorFields.length > 0 && (
            <ul className="mt-2 ml-7 flex list-disc flex-col gap-1">
              {errorFields.map((f) => (
                <li key={f}>
                  <a
                    href={`#checkout-${f}`}
                    className="inline-block min-h-6 py-0.5 underline underline-offset-4"
                  >
                    {FIELD_LABELS[f]}: {e[f]}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <fieldset className="flex flex-col gap-4">
        <legend className="font-display mb-4 text-xl">Contact</legend>
        <Input
          id="checkout-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          label={FIELD_LABELS.email}
          hint="We’ll write your order confirmation to this address (demo: saved as a file, never sent)."
          required
          maxLength={254}
          defaultValue={v.email}
          error={e.email}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="font-display mb-4 text-xl">Shipping address</legend>
        <Input
          id="checkout-name"
          name="name"
          autoComplete="shipping name"
          label={FIELD_LABELS.name}
          required
          maxLength={100}
          defaultValue={v.name}
          error={e.name}
        />
        <Input
          id="checkout-addressLine1"
          name="addressLine1"
          autoComplete="shipping address-line1"
          label={FIELD_LABELS.addressLine1}
          required
          maxLength={120}
          defaultValue={v.addressLine1}
          error={e.addressLine1}
        />
        <Input
          id="checkout-addressLine2"
          name="addressLine2"
          autoComplete="shipping address-line2"
          label={`${FIELD_LABELS.addressLine2} (optional)`}
          maxLength={120}
          defaultValue={v.addressLine2}
          error={e.addressLine2}
        />
        <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
          <Input
            id="checkout-city"
            name="city"
            autoComplete="shipping address-level2"
            label={FIELD_LABELS.city}
            required
            maxLength={80}
            defaultValue={v.city}
            error={e.city}
          />
          <Input
            id="checkout-postalCode"
            name="postalCode"
            autoComplete="shipping postal-code"
            autoCapitalize="characters"
            label={FIELD_LABELS.postalCode}
            required
            maxLength={12}
            defaultValue={v.postalCode}
            error={e.postalCode}
          />
        </div>
        <Select
          id="checkout-country"
          name="country"
          autoComplete="shipping country-name"
          label={FIELD_LABELS.country}
          required
          defaultValue={v.country}
          error={e.country}
          options={[
            { value: "", label: "Choose a country", disabled: true },
            ...countries.map((c) => ({ value: c.code, label: c.name })),
          ]}
        />
      </fieldset>

      <div className="flex flex-col gap-3">
        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={pending}
          icon={<ShieldIcon size={18} />}
          data-testid="place-order"
        >
          {pending ? "Reserving your items…" : `Continue to payment · ${totalLabel}`}
        </Button>
        <p className="text-muted text-center text-sm">{providerNote}</p>
      </div>
    </form>
  );
}
