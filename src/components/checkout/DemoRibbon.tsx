import { InfoIcon } from "../icons";

/** Shown on checkout pages while the mock payment provider is active. */
export function DemoRibbon() {
  return (
    <p
      className="bg-ink flex items-center justify-center gap-2 px-4 py-2 text-center text-sm font-medium text-white"
      data-testid="demo-ribbon"
    >
      <InfoIcon size={16} />
      Demo mode: mock payments. No real payment provider is used.
    </p>
  );
}
