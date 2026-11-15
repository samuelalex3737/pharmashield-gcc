"use client";

import { motion } from "framer-motion";
import { makerById } from "@/lib/data";
import { pct } from "@/lib/format";
import { useReducedMotion } from "./useTheme";

export const ROLE_COLOR: Record<string, string> = {
  primary: "bg-brand dark:bg-sky-300",
  backup: "bg-accent",
  "probation trial": "bg-warn",
  "spot buy": "bg-risk",
};

export const ROLE_DOT: Record<string, string> = {
  primary: "#1f4e79",
  backup: "#0d9488",
  "probation trial": "#b45309",
  "spot buy": "#be123c",
};

interface Row {
  id: string;
  vials: number;
  share: number;
  role: string;
}

// Animated stacked bar of the order split. Segments slide to their new widths when the mode or a disruption changes.
export default function AllocationBar({ rows, spot = 0, demand, label }: { rows: Row[]; spot?: number; demand: number; label: string }) {
  const reduced = useReducedMotion();
  const segs = [...rows.filter((r) => r.vials > 0)];
  if (spot > 0) segs.push({ id: "SPOT", vials: spot, share: spot / demand, role: "spot buy" });
  return (
    <div>
      <div className="flex h-11 w-full overflow-hidden rounded-lg border border-line bg-raised" role="img" aria-label={label}>
        {segs.map((r) => (
          <motion.div
            key={r.id}
            layout={!reduced}
            initial={false}
            animate={{ width: `${r.share * 100}%` }}
            transition={{ duration: reduced ? 0 : 0.5, ease: "easeInOut" }}
            className={`flex items-center justify-center overflow-hidden whitespace-nowrap border-r border-surface/40 text-[11px] font-semibold text-white dark:text-bg ${ROLE_COLOR[r.role]}`}
            title={`${r.id === "SPOT" ? "Spot buy" : makerById[r.id].name}: ${pct(r.share)} (${r.role})`}
          >
            {r.share >= 0.08 ? `${r.id === "SPOT" ? "SPOT" : r.id} ${pct(r.share, 0)}` : ""}
          </motion.div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        {Object.entries(ROLE_DOT).map(([role, color]) => (
          <span key={role} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            {role}
          </span>
        ))}
      </div>
    </div>
  );
}
