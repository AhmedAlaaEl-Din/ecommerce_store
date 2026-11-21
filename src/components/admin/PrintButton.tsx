"use client";

import { PrinterIcon } from "../icons";
import { Button } from "../ui/Button";

export function PrintButton() {
  return (
    <Button size="sm" onClick={() => window.print()} icon={<PrinterIcon size={18} />} data-testid="print">
      Print
    </Button>
  );
}
