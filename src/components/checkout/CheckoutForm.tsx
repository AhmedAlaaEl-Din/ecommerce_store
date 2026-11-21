"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { placeOrderAction, type CheckoutState } from "@/app/(checkout)/checkout/actions";
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

/** Generic message the server sends with field errors (shown as the count instead). */
const VALIDATION_MESSAGE = "Please check the highlighted fields.";

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
  retry = false,
}: {
  initialValues: CheckoutValues;
  countries: ReadonlyArray<{ code: string; name: string }>;
  totalLabel: string;
  providerNote: string;
  /** Coming back from a declined or cancelled payment. */
  retry?: boolean;
}) {
  const [state, formAction, pending] = useActionState<CheckoutState, FormData>(placeOrderAction, {
    values: initialValues,
    errors: {},
    attempt: 0,
  });
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const v = state.values;

  // Fields the shopper has changed since the last submit: their error is hidden
  // straight away (the server validates again on the next submit).
  const [edited, setEdited] = useState<{ attempt: number; fields: CheckoutField[] }>({
    attempt: 0,
    fields: [],
  });
  const editedNow = edited.attempt === state.attempt ? edited.fields : [];
  const e: Partial<Record<CheckoutField, string>> = {};
  for (const f of FIELD_ORDER) {
    if (state.errors[f] && !editedNow.includes(f)) e[f] = state.errors[f];
  }
  const errorFields = FIELD_ORDER.filter((f) => e[f]);
  const showFormError = state.formError && state.formError !== VALIDATION_MESSAGE;

  function onChange(event: FormEvent<HTMLFormElement>) {
    const name = (event.target as HTMLInputElement).name as CheckoutField;
    if (!state.errors[name] || editedNow.includes(name)) return;
    setEdited({ attempt: state.attempt, fields: [...editedNow, name] });
  }

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
      onChange={onChange}
      className="flex flex-col gap-8"
      aria-describedby={state.formError ? "checkout-form-error" : undefined}
      data-testid="checkout-form"
    >
      {(showFormError || errorFields.length > 0) && (
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
            {showFormError
              ? state.formError
              : errorFields.length === 1
                ? "Please check 1 field:"
                : `Please check ${errorFields.length} fields:`}
          </p>
          {errorFields.length > 0 && (
            <ul className="mt-2 ml-7 flex flex-wrap gap-x-4 gap-y-1">
              {errorFields.map((f) => (
                <li key={f}>
                  <a
                    href={`#checkout-${f}`}
                    className="inline-flex min-h-6 items-center underline underline-offset-4"
                  >
                    {FIELD_LABELS[f]}
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
          {pending
            ? "Reserving your items…"
            : `${retry ? "Try payment again" : "Continue to payment"} · ${totalLabel}`}
        </Button>
        <p className="text-muted text-center text-sm">{providerNote}</p>
      </div>
    </form>
  );
}
