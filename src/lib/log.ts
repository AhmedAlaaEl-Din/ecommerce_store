/** Log helpers that never print full personal data. */

/** "mona@example.com" -> "m***@e***.com" */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  return `${local[0]}***@${host[0] ?? ""}***${tld}`;
}

/** Keeps only the first character of each word: "Mona Example" -> "M. E." */
export function maskName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${w[0]}.`)
    .join(" ");
}

export function logInfo(scope: string, message: string, fields: Record<string, unknown> = {}) {
  console.log(`[${scope}] ${message}`, Object.keys(fields).length ? fields : "");
}

export function logError(scope: string, message: string, err?: unknown) {
  console.error(`[${scope}] ${message}`, err instanceof Error ? err.message : (err ?? ""));
}
