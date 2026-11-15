"use client";

import { useState } from "react";
import Chart from "@/components/Chart";
import ModeTabs from "@/components/ModeTabs";
import { Assumption, Badge, PageTitle, pct, usd } from "@/components/ui";
import { CRITERIA } from "@/lib/engine";
import { c5For, makerById, MODE_LABEL, rankings, suppliers, weights, type Mode } from "@/lib/data";

const CRITERION_LABEL: Record<string, string> = {
  C1: "C1 Landed cost",
  C2: "C2 Delivery risk",
  C3: "C3 Price integrity",
  C4: "C4 Compliance",
  C5: "C5 Route exposure",
};

export default function Scorecard() {
  const [mode, setMode] = useState<Mode>("normal");
  const rows = rankings[mode];
  const [selected, setSelected] = useState<string>(rows[0].id);
  const m = makerById[selected];
  const fw = weights[mode].final_weights;
  const values = [m.criteria.C1, m.criteria.C2, m.criteria.C3, m.criteria.C4, c5For(m, mode)];
  const estRank: Record<string, number> = {};
  rows.filter((r) => !makerById[r.id].is_probation).forEach((r, i) => (estRank[r.id] = i + 1));

  return (
    <div>
      <PageTitle title="Supplier Scorecard" question="Q1 Q6">
        Eleven qualified makers of carboplatin injection, ranked by TOPSIS closeness S (higher is better; composite risk = 1 - S). The overall
        rank includes probation makers, which can only receive a 5-15% trial; &quot;Est. rank&quot; orders the 5 established makers that can be primary or
        backup. Makers above the compliance gate (C4 above {suppliers.compliance_gate.toFixed(2)}, assumption A34) are flagged and cannot be primary or backup.
        Click a row to see its five criteria and the reasons behind its delivery-risk score.
      </PageTitle>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <ModeTabs mode={mode} onChange={setMode} />
        <span className="text-xs text-slate-500">Weights change with the mode; badges never do.</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="card overflow-x-auto p-0 lg:col-span-3">
          <table className="table-clean w-full">
            <thead>
              <tr>
                <th>Rank</th>
                <th title="Rank among the 5 established (incumbent) makers that can be primary or backup">Est. rank</th>
                <th>Maker</th>
                <th>S score</th>
                <th>Composite risk</th>
                <th>OAI (5y)</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const mk = makerById[r.id];
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r.id)}
                    className={`cursor-pointer ${selected === r.id ? "bg-navy-50" : "hover:bg-slate-50"}`}
                  >
                    <td className="font-semibold">{r.rank}</td>
                    <td className="font-mono text-slate-600">{estRank[r.id] ?? "-"}</td>
                    <td>
                      <div className="font-medium text-navy-900">{mk.name}</div>
                      <div className="text-xs text-slate-500">
                        {mk.parent} - plant country {mk.country}
                      </div>
                    </td>
                    <td className="font-mono">{r.S.toFixed(3)}</td>
                    <td>
                      <div className="h-2 w-24 rounded bg-slate-100">
                        <div className="h-2 rounded bg-red-600" style={{ width: `${r.composite_risk * 100}%` }} />
                      </div>
                      <span className="font-mono text-xs">{r.composite_risk.toFixed(3)}</span>
                    </td>
                    <td className="font-mono">{mk.oai_count_5yr}</td>
                    <td className="space-x-1 space-y-1">
                      {mk.is_probation ? (
                        <Badge tone="amber" title="Not a current incumbent (assumption A23); trial share 5-15% only">
                          Probation - capped at trial share (5-15%)
                        </Badge>
                      ) : null}
                      {mk.compliance_gated ? (
                        <Badge tone="red" title={`C4 compliance risk ${mk.criteria.C4.toFixed(3)} is above the ${suppliers.compliance_gate.toFixed(2)} gate (assumption A34): cannot be primary or backup while an alternative exists`}>
                          Gated (C4 &gt; {suppliers.compliance_gate.toFixed(2)})
                        </Badge>
                      ) : null}
                      {mk.c1_imputed ? (
                        <Badge tone="slate" title="No Medicaid 2025 price: median price used (assumption A4)">
                          C1 imputed
                        </Badge>
                      ) : null}
                      {mk.active_fda_shortage ? (
                        <Badge tone="red" title="Current openFDA shortage record (US data)">
                          Active shortage
                        </Badge>
                      ) : null}
                      {mk.c4_evidence_status !== "observed" ? (
                        <Badge tone="purple" title={mk.c4_evidence_status}>
                          Thin evidence
                        </Badge>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <div className="card">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="h-section">{m.name}</h2>
                <p className="text-xs text-slate-500">
                  {m.parent} - {m.country} - landed cost {usd(m.landed_cost, 2)} per vial
                  {m.c1_imputed ? <Assumption>imputed</Assumption> : null}
                </p>
              </div>
              <Badge tone="blue">{MODE_LABEL[mode]}</Badge>
            </div>
            <Chart
              height={220}
              data={[
                {
                  type: "bar",
                  orientation: "h",
                  y: CRITERIA.map((c) => CRITERION_LABEL[c]),
                  x: values,
                  marker: { color: ["#1f4e79", "#c0504d", "#4f8f4f", "#8064a2", "#f39c12"] },
                  text: values.map((v) => v.toFixed(3)),
                  textposition: "outside",
                  hovertemplate: "%{y}: %{x:.3f}<extra></extra>",
                },
              ]}
              layout={{
                margin: { l: 130, r: 40, t: 10, b: 40 },
                xaxis: { range: [0, 1.15], title: { text: "Criterion value (0 to 1, lower is better)" } },
                yaxis: { autorange: "reversed" },
              }}
            />
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <dt className="text-slate-500">Delivery risk (C2)</dt>
              <dd>{pct(m.criteria.C2, 2)} chance a shipment is late</dd>
              <dt className="text-slate-500">Price integrity (C3)</dt>
              <dd>{m.c3_status}</dd>
              <dt className="text-slate-500">Compliance evidence (C4)</dt>
              <dd>
                {m.inspections_5yr} inspections, {m.oai_count_5yr} OAI, {m.class_i_ii_5yr} Class I/II recalls, {m.nlp_citations_5yr} citations (5 years)
              </dd>
              <dt className="text-slate-500">C4 evidence status</dt>
              <dd>{m.c4_evidence_status}</dd>
              <dt className="text-slate-500">Route (C5)</dt>
              <dd>
                {pct(m.hormuz_air_share, 0)} of volume via Hormuz or Gulf air, LPI {m.lpi}
                <Assumption>A8</Assumption>
              </dd>
            </dl>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-navy-900">Top 3 reasons for the delivery-risk score (SHAP)</h3>
            <ol className="mt-2 space-y-2 text-sm">
              {m.shap_top3.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className={`mt-0.5 font-mono text-xs ${s.shap_log_odds > 0 ? "text-red-700" : "text-emerald-700"}`}>
                    {s.shap_log_odds > 0 ? "+" : ""}
                    {s.shap_log_odds.toFixed(2)}
                  </span>
                  <span>{s.reason}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-slate-500">Values are SHAP contributions in log-odds, compared with the average training shipment.</p>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-navy-900">Final blended weights - {MODE_LABEL[mode]}</h3>
            <table className="table-clean mt-2 w-full">
              <thead>
                <tr>
                  <th>Criterion</th>
                  <th>AHP</th>
                  <th>Final (50% AHP + 50% entropy)</th>
                </tr>
              </thead>
              <tbody>
                {CRITERIA.map((c) => (
                  <tr key={c}>
                    <td>{CRITERION_LABEL[c]}</td>
                    <td className="font-mono">{weights[mode].ahp_weights[c].toFixed(3)}</td>
                    <td className="font-mono font-semibold">{fw[c].toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate-500">
              AHP consistency ratio {weights[mode].cr.toFixed(4)} (below 0.10). Entropy applies to C1, C2, C4 only (data-derived).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
