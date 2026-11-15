"use client";

import { MODE_LABEL, MODES, suppliers, type Mode } from "@/lib/data";

export default function ModeTabs({ mode, onChange, showLambda = false }: { mode: Mode; onChange: (m: Mode) => void; showLambda?: boolean }) {
  return (
    <div role="tablist" aria-label="Scenario mode" className="inline-flex flex-wrap rounded-lg border border-line bg-raised p-1">
      {MODES.map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              active ? (m === "crisis" ? "bg-risk text-white shadow dark:text-bg" : "bg-accent text-white shadow dark:text-bg") : "text-muted hover:text-ink"
            }`}
          >
            {MODE_LABEL[m]}
            {showLambda ? <span className="ml-1.5 text-[11px] opacity-80">lambda {suppliers.mode_lambda[m].toFixed(1)}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
