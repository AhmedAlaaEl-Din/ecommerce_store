/**
 * Checkout form validation (server side). The country list is invented, like
 * everything else in this demo store.
 */
import { z } from "zod";

export const COUNTRIES = [
  { code: "nilera", name: "Nilera" },
  { code: "deltamar", name: "Deltamar" },
  { code: "sahelia", name: "Sahelia" },
  { code: "oasis-isles", name: "Oasis Isles" },
  { code: "riverland", name: "Riverland" },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]["code"];

export function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

const text = (label: string, min: number, max: number) =>
  z
    .string({ error: `Please enter your ${label}.` })
    .trim()
    .transform((s) => s.replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(min, min <= 1 ? `Please enter your ${label}.` : `Please enter your full ${label}.`)
        .max(max, `That ${label} is too long (max ${max} characters).`),
    );

export const checkoutSchema = z.object({
  email: z
    .string({ error: "Please enter your email address." })
    .trim()
    .toLowerCase()
    .min(1, "Please enter your email address.")
    .max(254, "That email address is too long.")
    .pipe(z.email("Please enter a valid email address, like name@example.com.")),
  name: text("name", 2, 100),
  addressLine1: text("street address", 3, 120),
  addressLine2: z
    .string()
    .trim()
    .max(120, "That address line is too long (max 120 characters).")
    .optional()
    .default(""),
  city: text("town or city", 2, 80),
  postalCode: z
    .string({ error: "Please enter your postal code." })
    .trim()
    .toUpperCase()
    .min(1, "Please enter your postal code.")
    .max(12, "That postal code is too long.")
    .regex(/^[A-Z0-9][A-Z0-9 -]{1,11}$/, "Postal codes use letters, numbers, spaces or dashes."),
  country: z.enum(COUNTRIES.map((c) => c.code) as [CountryCode, ...CountryCode[]], {
    error: "Please choose a country.",
  }),
});

export type CheckoutCustomer = z.output<typeof checkoutSchema>;
export type CheckoutField = keyof CheckoutCustomer;
export const CHECKOUT_FIELDS: CheckoutField[] = [
  "email",
  "name",
  "addressLine1",
  "addressLine2",
  "city",
  "postalCode",
  "country",
];

export type CheckoutValues = Record<CheckoutField, string>;

export const EMPTY_CHECKOUT_VALUES: CheckoutValues = {
  email: "",
  name: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  postalCode: "",
  country: "",
};

/** Reads the form fields as plain strings (anything else becomes ""). */
export function readCheckoutForm(form: FormData): CheckoutValues {
  const out = { ...EMPTY_CHECKOUT_VALUES };
  for (const field of CHECKOUT_FIELDS) {
    const v = form.get(field);
    out[field] = typeof v === "string" ? v.slice(0, 500) : "";
  }
  return out;
}

export type CheckoutFieldErrors = Partial<Record<CheckoutField, string>>;

export function validateCheckout(
  values: CheckoutValues,
): { ok: true; data: CheckoutCustomer } | { ok: false; errors: CheckoutFieldErrors } {
  const parsed = checkoutSchema.safeParse(values);
  if (parsed.success) return { ok: true, data: parsed.data };
  const errors: CheckoutFieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as CheckoutField | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return { ok: false, errors };
}
