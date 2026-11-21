/**
 * CSV writing with a formula-injection guard: a cell that starts with = + - @
 * (or a tab / carriage return, which some spreadsheet apps also treat as a
 * formula start) is prefixed with a single quote so it is shown as text.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (FORMULA_START.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(header: readonly string[], rows: ReadonlyArray<readonly unknown[]>): string {
  const lines = [header, ...rows].map((r) => r.map(escapeCsvCell).join(","));
  // CRLF line endings per RFC 4180; a BOM so spreadsheet apps detect UTF-8.
  return "﻿" + lines.join("\r\n") + "\r\n";
}
