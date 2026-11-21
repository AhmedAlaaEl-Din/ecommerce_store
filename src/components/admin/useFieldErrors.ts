"use client";

import { useState } from "react";

/**
 * Server field errors that disappear as soon as their field is edited, and come
 * back fresh with the next server response (tracked per response object, so no
 * effect is needed to reset them).
 */
export function useFieldErrors(state: { fieldErrors?: Record<string, string> }) {
  const [edited, setEdited] = useState<{ for: object; keys: Set<string> }>({
    for: state,
    keys: new Set(),
  });
  const keys = edited.for === state ? edited.keys : new Set<string>();
  return {
    error: (k: string) => (keys.has(k) ? undefined : state.fieldErrors?.[k]),
    touch: (k: string) => setEdited({ for: state, keys: new Set(keys).add(k) }),
  };
}
