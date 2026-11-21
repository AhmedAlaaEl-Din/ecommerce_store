"use client";

import { useEffect } from "react";

/**
 * Last-resort error page for failures in the root layout itself. It replaces
 * the whole document, so it cannot rely on the layout's fonts or CSS: styles
 * are inline and use the brand tokens' values.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error", error.digest ?? "(no digest)");
  }, [error.digest]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#F7F3EC",
          color: "#1F2A24",
          fontFamily: "Georgia, serif",
          padding: 16,
        }}
      >
        <main style={{ maxWidth: 480, textAlign: "center" }}>
          <title>Something went wrong · Nile Goods</title>
          <p style={{ color: "#9A4A24", fontSize: 12, letterSpacing: "0.12em" }}>NILE GOODS</p>
          <h1 style={{ fontSize: 32, lineHeight: 1.2, margin: "12px 0" }}>
            We dropped something on our side
          </h1>
          <p style={{ color: "#5A635D", fontFamily: "system-ui, sans-serif", lineHeight: 1.5 }}>
            Please try again in a moment.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                height: 44,
                padding: "0 20px",
                borderRadius: 10,
                border: 0,
                background: "#2F5D50",
                color: "#fff",
                font: "500 16px system-ui, sans-serif",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full reload is intended after a fatal error */}
            <a
              href="/"
              style={{
                height: 44,
                padding: "0 20px",
                borderRadius: 10,
                border: "1px solid #8C8577",
                color: "#1F2A24",
                font: "500 16px system-ui, sans-serif",
                display: "inline-flex",
                alignItems: "center",
                textDecoration: "none",
              }}
            >
              Back to home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
