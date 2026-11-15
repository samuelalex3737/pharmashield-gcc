"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { allocations, makerById, MODE_LABEL, MODES, rankings, suppliers, weights, type Mode } from "@/lib/data";
import { CRITERIA } from "@/lib/engine";
import { pct, usd } from "@/lib/format";
import { CRITERION_LABEL, establishedRanks } from "@/lib/insights";

// Printable A4 board decision memo for the selected mode (print CSS in globals.css).
export default function Memo() {
  const [mode, setMode] = useState<Mode>("normal");
  const [logged, setLogged] = useState<string | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const m = q.get("mode");
    if (m && (MODES as string[]).includes(m)) setMode(m as Mode);
    setLogged(q.get("logged"));
  }, []);

  const a = allocations[mode];
  const w = weights[mode];
  const est = establishedRanks(rankings[mode].map((r) => r.id));
  const used = a.rows.filter((r) => r.vials > 0);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <article className="mx-auto max-w-[210mm] rounded-xl border border-line bg-surface p-8 text-ink print:border-0 print:p-0">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {MODES.map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`btn ${m === mode ? "btn-primary" : "btn-ghost"}`}>
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
        <button onClick={() => window.print()} className="btn btn-primary">
          Print or save as PDF
        </button>
      </div>

      <header className="border-b border-line pb-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted">Board decision memo - for approval</div>
        <h1 className="mt-1 text-2xl font-bold">Carboplatin injection 10 mg/mL: monthly order split ({MODE_LABEL[mode]})</h1>
        <p className="mt-1 text-sm text-muted">
          PharmaShield GCC, hypothetical UAE group purchasing organisation. Prepared {today}. Data cut-off 2026-11-14. Recommendation only: no order is sent
          automatically.
          {logged ? ` Linked audit entry: ${logged}.` : ""}
        </p>
      </header>

      <section className="mt-5">
        <h2 className="text-base font-semibold">1. Recommendation</h2>
        <div className="overflow-x-auto">
        <table className="table-clean mt-2 w-full">
          <thead>
            <tr>
              <th>Maker</th>
              <th>Role</th>
              <th>Vials</th>
              <th>Share</th>
              <th>Landed cost / vial</th>
            </tr>
          </thead>
          <tbody>
            {used.map((r) => (
              <tr key={r.id}>
                <td>{makerById[r.id].name}</td>
                <td>{r.role}</td>
                <td className="tnum">{r.vials.toLocaleString("en-US")}</td>
                <td className="tnum">{pct(r.share)}</td>
                <td className="tnum">
                  {usd(makerById[r.id].landed_cost, 2)}
                  {makerById[r.id].c1_imputed ? " (imputed)" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <p className="mt-2 text-sm">
          Monthly purchase cost <strong>{usd(a.kpis.purchase_cost_usd)}</strong> ({usd(a.kpis.cost_per_vial_usd, 2)} per vial). Expected late shipments{" "}
          {pct(a.kpis.expected_late_share, 2)}. India-made volume {pct(a.kpis.india_made_share, 0)}. Spot buy {a.spot_buy_vials} vials. Lambda {a.lambda.toFixed(1)}
          . MILP status {a.status}.
        </p>
      </section>

      <section className="mt-5">
        <h2 className="text-base font-semibold">2. Weights used (final blend of 50% AHP and 50% entropy)</h2>
        <div className="overflow-x-auto">
        <table className="table-clean mt-2 w-full">
          <thead>
            <tr>
              {CRITERIA.map((c) => (
                <th key={c}>
                  {c} {CRITERION_LABEL[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {CRITERIA.map((c) => (
                <td key={c} className="tnum">
                  {w.final_weights[c].toFixed(3)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        </div>
        <p className="mt-1 text-xs text-muted">AHP consistency ratio {w.cr.toFixed(4)} (limit 0.10).</p>
      </section>

      <section className="mt-5">
        <h2 className="text-base font-semibold">3. Ranking (TOPSIS closeness S)</h2>
        <div className="overflow-x-auto">
        <table className="table-clean mt-2 w-full">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Est. rank</th>
              <th>Maker</th>
              <th>S</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rankings[mode].map((r) => {
              const m = makerById[r.id];
              return (
                <tr key={r.id}>
                  <td>{r.rank}</td>
                  <td>{est[r.id] ?? "-"}</td>
                  <td>{m.name}</td>
                  <td className="tnum">{r.S.toFixed(3)}</td>
                  <td className="text-xs">
                    {[m.is_probation ? "probation (5-15% trial)" : "established", m.compliance_gated ? "compliance-gated" : "", m.active_fda_shortage ? "US shortage" : ""]
                      .filter(Boolean)
                      .join(", ")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </section>

      <section className="mt-5">
        <h2 className="text-base font-semibold">4. Risks and controls</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>
            Compliance gate (C4 above {suppliers.compliance_gate.toFixed(2)}): {a.gated_blocked.join(", ") || "none"} blocked from primary and backup roles
            {a.gate_relaxed.length ? `; gate relaxed for ${a.gate_relaxed.join(", ")} because no feasible split exists without them` : ""}.
          </li>
          <li>Probation makers are capped at a 5-15% trial, at most 2 per order, and only after passing the safety gate (no OAI or Class I recall in 3 years).</li>
          <li>
            {suppliers.makers.filter((m) => m.active_fda_shortage).length} of {suppliers.makers.length} qualified makers have a current US shortage record (openFDA, US
            data); their capacity is reduced by 20% in the model.
          </li>
          <li>Delivery-risk model: XGBoost trained on 2006-2013 SCMS shipments, tested on 2014-2015; retrain on the GPO&apos;s own data in the pilot.</li>
        </ul>
      </section>

      <section className="mt-5">
        <h2 className="text-base font-semibold">5. Key assumptions</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>A4: US Medicaid 2025 prices proxy GCC tender prices; makers without a price use the median.</li>
          <li>A8: route mix by origin country is a scenario assumption.</li>
          <li>A11: monthly demand of 10,000 vials (45 mL). A27-A28: capacities 10,000 / 2,000 vials, cut by 20% for makers in shortage.</li>
          <li>A34: compliance gate at C4 = 0.80. A35: lambda 1.0 (Normal), 2.0 (Crisis), 0.5 (Cost focus).</li>
        </ul>
      </section>

      <footer className="mt-8 border-t border-line pt-3 text-xs text-muted">
        Approved by: ____________________ Date: ____________ Decision: approve / override (reason): ______________________
        <div className="mt-3">
          Academic prototype - Group 3, AI in Operations, SP Jain. openFDA data is unvalidated and not for medical decisions. Assumptions labelled.
        </div>
        <div className="no-print mt-3">
          <Link href="/approval" className="underline">
            Back to Approval & Audit
          </Link>
        </div>
      </footer>
    </article>
  );
}
