"use client";

import { useMemo, useState } from "react";
import Chart from "@/components/Chart";
import ModeTabs from "@/components/ModeTabs";
import { Assumption, Badge, Kpi, PageTitle, pct, usd } from "@/components/ui";
import { allocations, c5For, makerById, MODE_LABEL, rankings, suppliers, type Mode } from "@/lib/data";
import { liveAllocation, liveScores, parityCheck } from "@/lib/live";

const PARITY = parityCheck();
const ROLE_COLOR: Record<string, string> = { primary: "#1f4e79", backup: "#4f8f4f", "probation trial": "#f39c12", "spot buy": "#b42318" };

export default function Scenario() {
  const [mode, setMode] = useState<Mode>("normal");
  const [lambda, setLambda] = useState<number>(suppliers.lambda_default);
  const live = PARITY.ok;
  const demand = suppliers.demand;

  const { rows, spot, scores } = useMemo(() => {
    if (!live) {
      const a = allocations[mode];
      return {
        rows: a.rows.map((r) => ({ id: r.id, vials: r.vials, share: r.share, role: r.role })),
        spot: a.spot_buy_vials,
        scores: Object.fromEntries(rankings[mode].map((r) => [r.id, r.S])),
      };
    }
    const res = liveAllocation(mode, lambda);
    return { rows: res.rows, spot: res.spotBuyVials, scores: liveScores(mode) };
  }, [mode, lambda, live]);

  const used = rows.filter((r) => r.vials > 0);
  const cost = used.reduce((a, r) => a + r.vials * makerById[r.id].landed_cost, 0);
  const lateShare = used.reduce((a, r) => a + r.vials * makerById[r.id].criteria.C2, 0) / demand;
  const india = used.filter((r) => makerById[r.id].country === "India").reduce((a, r) => a + r.vials, 0) / demand;
  const exposure = used.reduce((a, r) => a + r.vials * c5For(makerById[r.id], mode), 0) / demand;
  const base = allocations.normal.kpis;

  const ranked = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([id, S], i) => ({ id, S, rank: i + 1, normalRank: rankings.normal.find((r) => r.id === id)!.rank }));

  const sens = allocations[mode === "cost" ? "normal" : mode].lambda_sensitivity;

  return (
    <div>
      <PageTitle title="Scenario & Order Split" question="Q5 Q7">
        One click switches the board&apos;s priorities. The ranking is recomputed (AHP + entropy weights, TOPSIS) and a mixed-integer linear
        program (MILP) splits {demand.toLocaleString("en-US")} vials across makers under Tier 1 rules: at least 2 established makers, primary
        capped at 70%, 5-15% probation trial, capacity limits.
      </PageTitle>

      <div className="card mb-6 flex flex-wrap items-center gap-6">
        <ModeTabs mode={mode} onChange={setMode} />
        <label className="flex items-center gap-3 text-sm">
          <span className="font-medium text-slate-700">
            Lambda (price of risk) <Assumption>A12</Assumption>
          </span>
          <input
            type="range"
            min={0}
            max={5}
            step={0.5}
            value={lambda}
            disabled={!live}
            onChange={(e) => setLambda(Number(e.target.value))}
            className="w-40 accent-navy-700"
            aria-label="Lambda"
          />
          <span className="w-10 font-mono">{lambda.toFixed(1)}</span>
        </label>
        <Badge tone={live ? "green" : "amber"}>
          {live ? "Live recompute in browser (parity with Python verified)" : "Precomputed Python results (live path disabled)"}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Monthly purchase cost" value={usd(cost)} sub={`${usd(cost / demand, 2)} per vial; Normal at lambda 1: ${usd(base.purchase_cost_usd)}`} />
        <Kpi label="Expected late shipments" value={pct(lateShare, 2)} sub="volume-weighted C2 (XGBoost)" tone={lateShare <= base.expected_late_share + 1e-9 ? "good" : "default"} />
        <Kpi label="Volume from India-made plants" value={pct(india, 0)} sub={`route exposure ${exposure.toFixed(3)} (C5, volume-weighted)`} />
        <Kpi label="Spot buy needed" value={`${spot.toLocaleString("en-US")} vials`} sub={`${used.length} suppliers used`} tone={spot > 0 ? "alert" : "good"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="card lg:col-span-3">
          <h2 className="h-section">MILP allocation by role - {MODE_LABEL[mode]}, lambda {lambda.toFixed(1)}</h2>
          <Chart
            height={170}
            data={[
              ...used.map((r) => ({
                type: "bar",
                orientation: "h",
                name: `${r.id} (${r.role})`,
                y: ["Order"],
                x: [r.share * 100],
                marker: { color: ROLE_COLOR[r.role] },
                text: [`${r.id} ${(r.share * 100).toFixed(0)}%`],
                textposition: "inside",
                insidetextanchor: "middle",
                hovertemplate: `${r.id}: %{x:.0f}% (${r.vials.toLocaleString("en-US")} vials)<extra>${r.role}</extra>`,
              })),
              ...(spot > 0
                ? [{ type: "bar", orientation: "h", name: "Spot buy", y: ["Order"], x: [(spot / demand) * 100], marker: { color: ROLE_COLOR["spot buy"] } }]
                : []),
            ]}
            layout={{ barmode: "stack", showlegend: false, margin: { l: 50, r: 10, t: 10, b: 40 }, xaxis: { range: [0, 100], title: { text: "Share of monthly demand (%)" } } }}
          />
          <table className="table-clean mt-2 w-full">
            <thead>
              <tr>
                <th>Maker</th>
                <th>Role</th>
                <th>Vials</th>
                <th>Share</th>
                <th>Landed cost / vial</th>
                <th>Plant country</th>
              </tr>
            </thead>
            <tbody>
              {used.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{makerById[r.id].name}</td>
                  <td>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: ROLE_COLOR[r.role] }} />
                      {r.role}
                    </span>
                  </td>
                  <td className="font-mono">{r.vials.toLocaleString("en-US")}</td>
                  <td className="font-mono">{pct(r.share, 0)}</td>
                  <td className="font-mono">
                    {usd(makerById[r.id].landed_cost, 2)}
                    {makerById[r.id].c1_imputed ? <Assumption>imputed</Assumption> : null}
                  </td>
                  <td>{makerById[r.id].country}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-500">
            Demand<Assumption>A11</Assumption> and capacities<Assumption>A27-A28</Assumption> are scenario assumptions. Recommendation only: a
            category manager approves it on the Approval page.
          </p>
        </div>

        <div className="card lg:col-span-2">
          <h2 className="h-section">Ranking and change vs Normal</h2>
          <table className="table-clean mt-2 w-full">
            <thead>
              <tr>
                <th>#</th>
                <th>Maker</th>
                <th>S</th>
                <th>vs Normal</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => {
                const delta = r.normalRank - r.rank;
                return (
                  <tr key={r.id}>
                    <td className="font-semibold">{r.rank}</td>
                    <td>
                      {r.id} {makerById[r.id].is_probation ? <Badge tone="amber">P</Badge> : null}
                    </td>
                    <td className="font-mono">{r.S.toFixed(3)}</td>
                    <td className={`font-semibold ${delta > 0 ? "text-emerald-700" : delta < 0 ? "text-red-700" : "text-slate-400"}`}>
                      {delta > 0 ? `▲ ${delta}` : delta < 0 ? `▼ ${-delta}` : "="}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mt-6">
        <h2 className="h-section">Lambda sensitivity ({mode === "cost" ? "Normal" : MODE_LABEL[mode]})</h2>
        <p className="mt-1 text-xs text-slate-500">Precomputed by the Python MILP (notebook 04) and re-checked by the parity tests.</p>
        <div className="overflow-x-auto">
          <table className="table-clean mt-2 w-full">
            <thead>
              <tr>
                <th>Lambda</th>
                <th>Split (vials)</th>
                <th>Purchase cost</th>
                <th>Expected late share</th>
                <th>India-made share</th>
              </tr>
            </thead>
            <tbody>
              {sens.map((s) => (
                <tr key={s.lambda} className={s.lambda === lambda ? "bg-navy-50" : ""}>
                  <td className="font-mono">{s.lambda.toFixed(1)}</td>
                  <td>{s.split}</td>
                  <td className="font-mono">{usd(s.purchase_cost_usd)}</td>
                  <td className="font-mono">{pct(s.expected_late_share, 2)}</td>
                  <td className="font-mono">{pct(s.india_made_share, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
