"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OPEN_PALETTE_EVENT } from "./CommandPalette";
import { toggleTheme, useIsDark } from "./useTheme";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/scorecard", label: "Scorecard" },
  { href: "/scenario", label: "Scenario & Split" },
  { href: "/alerts", label: "Live Alerts" },
  { href: "/evidence", label: "Model Evidence" },
  { href: "/approval", label: "Approval & Audit" },
];

export default function Nav() {
  const path = usePathname();
  const dark = useIsDark();
  if (path.startsWith("/boardroom")) return null;
  return (
    <header className="no-print z-30 border-b border-line bg-surface/95 backdrop-blur md:sticky md:top-0">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2" title="PharmaShield GCC home">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm font-bold text-surface">PS</span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-sm font-semibold text-ink">PharmaShield GCC</span>
            <span className="block text-[11px] text-muted">Supplier risk cockpit</span>
          </span>
        </Link>
        <nav aria-label="Main" className="no-scrollbar flex min-w-0 flex-1 gap-0.5 overflow-x-auto">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm ${
                  active ? "bg-accent-soft font-semibold text-accent-ink" : "text-muted hover:bg-raised hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
            className="hidden items-center gap-2 rounded-md border border-line px-2 py-1 text-xs text-muted hover:text-ink lg:flex"
            title="Open the command palette"
          >
            Search <kbd className="rounded bg-raised px-1 font-mono text-[10px]">Ctrl K</kbd>
          </button>
          <button onClick={toggleTheme} className="btn btn-ghost px-2" aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>
            {dark ? "Light" : "Dark"}
          </button>
          <Link href="/boardroom" className="btn btn-primary hidden sm:inline-flex">
            Boardroom
          </Link>
        </div>
      </div>
    </header>
  );
}
