"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/scorecard", label: "Supplier Scorecard" },
  { href: "/scenario", label: "Scenario & Order Split" },
  { href: "/alerts", label: "Live Alerts" },
  { href: "/evidence", label: "Model Evidence" },
  { href: "/approval", label: "Approval & Audit" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <header className="z-20 border-b md:sticky md:top-0 border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy-700 text-sm font-bold text-white">PS</span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold text-navy-900">PharmaShield GCC</span>
            <span className="block text-[11px] text-slate-500">Supplier risk cockpit - carboplatin injection</span>
          </span>
        </Link>
        <nav className="flex flex-wrap gap-1">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 text-sm ${active ? "bg-navy-50 font-semibold text-navy-800" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
