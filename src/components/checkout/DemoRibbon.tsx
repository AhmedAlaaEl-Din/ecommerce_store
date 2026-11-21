import { InfoIcon } from "../icons";

/** Shown on checkout pages while the mock payment provider is active. */
export function DemoRibbon() {
  return (
    <p
      className="bg-ink px-4 py-2 text-center text-sm font-medium text-white"
      data-testid="demo-ribbon"
    >
      <InfoIcon size={16} className="mr-1.5 inline-block align-[-3px]" />
      Demo mode: mock payments.{" "}
      <span className="text-white/80">No real payment provider is used.</span>
    </p>
  );
}
