"use client";

import { useEffect } from "react";

/** Opens the print dialog once the report has rendered, with a manual button for a second go. */
export function PrintOnLoad() {
  useEffect(() => {
    const id = setTimeout(() => window.print(), 300);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="mb-4 flex justify-end print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-on-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        Print or save as PDF
      </button>
    </div>
  );
}
