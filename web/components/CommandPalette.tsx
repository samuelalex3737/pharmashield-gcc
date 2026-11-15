"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { suppliers } from "@/lib/data";
import { toggleTheme } from "./useTheme";

interface Item {
  label: string;
  hint: string;
  run: () => void;
}

export const OPEN_PALETTE_EVENT = "pharmashield:open-palette";

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items: Item[] = useMemo(() => {
    const go = (href: string) => () => router.push(href);
    return [
      { label: "Overview", hint: "Page", run: go("/") },
      { label: "Supplier Scorecard", hint: "Page", run: go("/scorecard") },
      { label: "Scenario & Order Split", hint: "Page", run: go("/scenario") },
      { label: "Live Alerts", hint: "Page", run: go("/alerts") },
      { label: "Model Evidence", hint: "Page", run: go("/evidence") },
      { label: "Approval & Audit", hint: "Page", run: go("/approval") },
      { label: "Normal mode", hint: "Mode", run: go("/scenario?mode=normal") },
      { label: "Crisis mode (Hormuz)", hint: "Mode", run: go("/scenario?mode=crisis") },
      { label: "Cost focus mode", hint: "Mode", run: go("/scenario?mode=cost") },
      { label: "Start boardroom demo", hint: "Action", run: go("/boardroom") },
      { label: "Board decision memo", hint: "Action", run: go("/memo") },
      { label: "Toggle light / dark theme", hint: "Action", run: toggleTheme },
      ...suppliers.makers.map((m) => ({ label: m.name, hint: `Maker - ${m.id}`, run: go(`/scorecard?maker=${m.id}`) })),
    ];
  }, [router]);

  const filtered = items.filter((i) => `${i.label} ${i.hint}`.toLowerCase().includes(q.trim().toLowerCase()));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  if (!open) return null;
  const choose = (i: Item) => {
    setOpen(false);
    i.run();
  };
  return (
    <div className="no-print fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 pt-[12vh]" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-lg overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setIdx(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIdx((i) => Math.min(i + 1, filtered.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIdx((i) => Math.max(i - 1, 0));
            }
            if (e.key === "Enter" && filtered[idx]) choose(filtered[idx]);
          }}
          placeholder="Jump to a page, maker or mode"
          aria-label="Search commands"
          className="w-full border-b border-line bg-surface px-4 py-3 text-sm text-ink outline-none placeholder:text-faint"
        />
        <ul className="max-h-80 overflow-y-auto py-1" role="listbox" aria-label="Commands">
          {filtered.length === 0 ? <li className="px-4 py-3 text-sm text-muted">No matches</li> : null}
          {filtered.map((i, n) => (
            <li key={i.label + i.hint} role="option" aria-selected={n === idx}>
              <button
                onMouseEnter={() => setIdx(n)}
                onClick={() => choose(i)}
                className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${n === idx ? "bg-accent-soft text-accent-ink" : "text-ink"}`}
              >
                <span>{i.label}</span>
                <span className="text-xs text-muted">{i.hint}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-line px-4 py-2 text-[11px] text-muted">Enter to open, arrows to move, Esc to close</div>
      </div>
    </div>
  );
}
