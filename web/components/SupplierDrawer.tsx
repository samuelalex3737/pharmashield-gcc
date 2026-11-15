"use client";

import { useEffect, useRef } from "react";
import shortages from "@/data/shortages_cache.json";
import Chart, { CHART_COLORS } from "./Chart";
import { Assumption, Badge, InfoTip } from "./ui";
import { makerById, suppliers, type Mode } from "@/lib/data";
import { CRITERIA } from "@/lib/engine";
import { pct, usd } from "@/lib/format";
import { criterionValue, CRITERION_LABEL, panelMedian, whyRank, whyShare, type SplitRow } from "@/lib/insights";

interface ShortageRec {
  status?: string | null;
  presentation?: string | null;
  package_ndc?: string | null;
  update_date?: string | null;
  shortage_reason?: string | null;
}

export default function SupplierDrawer({
  id,
  mode,
  rank,
  row,
  gateRelaxed = [],
  onClose,
}: {
  id: string;
  mode: Mode;
  rank: number;
  row?: SplitRow;
  gateRelaxed?: string[];
  onClose: () => void;
}) {
  const m = makerById[id];
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const recs = (shortages.results as ShortageRec[]).filter((r) => m.labeler_codes.includes((r.package_ndc ?? "").split("-")[0]));
  const values = CRITERIA.map((c) => criterionValue(m, c, mode));
  const medians = CRITERIA.map((c) => panelMedian(c, mode));
  const parts = m.c4_parts;
  const partRows: [string, number][] = [
    ["FDA inspection outcome (OAI 0.30, VAI 0.10)", parts.inspection],
    ["Class I/II recalls (0.20 x min(1, n/2))", parts.recalls],
    ["NLP severity of citations (0.20 x severity)", parts.nlp],
    ["Active US shortage (0.20)", parts.shortage],
  ];

  return (
    <div className="no-print fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Supplier details: ${m.name}`}
        className="h-full w-full max-w-xl overflow-y-auto border-l border-line bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink">{m.name}</h2>
            <p className="text-xs text-muted">
              {m.parent} - plant country {m.country}
              {m.site_prior_source === "parent SCMS sites" ? "" : <Assumption>A22</Assumption>}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {m.is_probation ? <Badge tone="warn">Probation - capped at trial share (5-15%)</Badge> : <Badge tone="brand">Established</Badge>}
              {m.compliance_gated ? <Badge tone="risk">Gated (C4 &gt; {suppliers.compliance_gate.toFixed(2)})</Badge> : null}
              {m.c1_imputed ? <Badge>Imputed price</Badge> : null}
              {m.active_fda_shortage ? <Badge tone="risk">Shortage</Badge> : null}
            </div>
          </div>
          <button ref={closeRef} onClick={onClose} className="btn btn-ghost" aria-label="Close supplier details">
            Close
          </button>
        </div>

        <div className="mt-4 space-y-2 rounded-lg bg-raised p-3 text-sm">
          <p>
            <span className="font-semibold">Why this rank. </span>
            {whyRank(m, rank, mode)}
          </p>
          <p>
            <span className="font-semibold">Why this share. </span>
            {whyShare(m, row, gateRelaxed)}
          </p>
        </div>

        <h3 className="mt-5 text-sm font-semibold text-ink">Five criteria vs panel median (lower is better)</h3>
        <Chart
          label={`${m.name}: five criteria compared with the panel median`}
          height={230}
          data={[
            { type: "bar", orientation: "h", name: m.id, y: CRITERIA.map((c) => CRITERION_LABEL[c]), x: values, marker: { color: CHART_COLORS.accent } },
            { type: "bar", orientation: "h", name: "Panel median", y: CRITERIA.map((c) => CRITERION_LABEL[c]), x: medians, marker: { color: CHART_COLORS.grey } },
          ]}
          layout={{ barmode: "group", margin: { l: 110, r: 10, t: 10, b: 40 }, legend: { orientation: "h", y: -0.25 }, yaxis: { autorange: "reversed" }, xaxis: { range: [0, 1.05] } }}
        />

        <h3 className="mt-4 flex items-center text-sm font-semibold text-ink">
          Top 3 reasons for delivery risk ({pct(m.criteria.C2, 2)})<InfoTip term="SHAP" />
        </h3>
        <ol className="mt-2 space-y-1.5 text-sm">
          {m.shap_top3.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className={`tnum mt-0.5 w-12 shrink-0 text-xs font-semibold ${s.shap_log_odds > 0 ? "text-risk" : "text-good"}`}>
                {s.shap_log_odds > 0 ? "+" : ""}
                {s.shap_log_odds.toFixed(2)}
              </span>
              <span>{s.reason}</span>
            </li>
          ))}
        </ol>

        <h3 className="mt-5 flex items-center text-sm font-semibold text-ink">
          C4 compliance composition ({m.criteria.C4.toFixed(3)})<InfoTip term="C4" />
        </h3>
        <div className="mt-2 space-y-1.5">
          {partRows.map(([label, v]) => (
            <div key={label} className="text-xs">
              <div className="flex justify-between">
                <span className="text-muted">{label}</span>
                <span className="tnum font-semibold">{v.toFixed(3)}</span>
              </div>
              <div className="mt-0.5 h-1.5 rounded bg-raised">
                <div className="h-1.5 rounded bg-risk" style={{ width: `${Math.min(1, v / 0.3) * 100}%` }} />
              </div>
            </div>
          ))}
          <p className="text-[11px] text-muted">{m.c4_evidence_status === "observed" ? "All terms observed." : `${m.c4_evidence_status} (assumption A31).`}</p>
        </div>

        <h3 className="mt-5 text-sm font-semibold text-ink">FDA evidence (5 years)</h3>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <dt className="text-muted">Inspections</dt>
          <dd className="tnum">
            {m.inspections_5yr} ({m.oai_count_5yr} OAI, {m.vai_count_5yr} VAI)
          </dd>
          <dt className="text-muted">Last inspection</dt>
          <dd className="tnum">{m.last_inspection ?? "none on file in 5 years"}</dd>
          <dt className="text-muted">Recalls</dt>
          <dd className="tnum">
            {m.recalls_5yr} ({m.class_i_ii_5yr} Class I/II, {m.class_i_5yr} Class I)
          </dd>
          <dt className="text-muted">Inspection citations (NLP)</dt>
          <dd className="tnum">
            {m.nlp_citations_5yr}, mean severity {m.nlp_severity.toFixed(3)}
          </dd>
        </dl>
        <h4 className="mt-3 text-xs font-semibold text-ink">US shortage records for this labeler ({recs.length})</h4>
        {recs.length ? (
          <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-xs">
            {recs.map((r, i) => (
              <li key={i} className="flex justify-between gap-2 border-b border-line/60 pb-1">
                <span className="text-muted">{r.presentation}</span>
                <span className="tnum shrink-0">
                  <Badge tone={r.status === "Current" ? "risk" : "neutral"}>{r.status}</Badge> {r.update_date}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-muted">No shortage records under this labeler code.</p>
        )}

        <h3 className="mt-5 text-sm font-semibold text-ink">Data coverage</h3>
        <ul className="mt-2 space-y-1 text-xs">
          <li>Price (C1): {m.c1_imputed ? "imputed at the median Medicaid price (A4)" : `Medicaid 2025, ${usd(m.price_per_ml, 2)} per mL`}; landed {usd(m.landed_cost, 2)} per vial</li>
          <li>Delivery history (C2): site prior from {m.site_prior_source} ({pct(m.c2_site_prior)})</li>
          <li>Price integrity (C3): {m.c3_status}</li>
          <li>Citations (C4 NLP): {m.nlp_status}</li>
          <li>SCMS shipment lines (parent): {m.scms_lines.toLocaleString("en-US")}</li>
          <li>
            Route (C5): Gulf air {pct(m.air_gulf_share, 0)}, Hormuz sea {pct(m.sea_hormuz_share, 0)}, Gulf of Oman sea {pct(m.sea_gulf_of_oman_share, 0)}; LPI{" "}
            {m.lpi} <Assumption>A8</Assumption>
          </li>
        </ul>
      </aside>
    </div>
  );
}
