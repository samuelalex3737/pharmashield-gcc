"use client";

import { MODE_LABEL, MODES, type Mode } from "@/lib/data";

export default function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div role="tablist" aria-label="Scenario mode" className="inline-flex rounded-lg border border-slate-300 bg-white p-1">
      {MODES.map((m) => (
        <button
          key={m}
          role="tab"
          aria-selected={mode === m}
          onClick={() => onChange(m)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            mode === m ? (m === "crisis" ? "bg-red-700 text-white" : "bg-navy-700 text-white") : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {MODE_LABEL[m]}
        </button>
      ))}
    </div>
  );
}
