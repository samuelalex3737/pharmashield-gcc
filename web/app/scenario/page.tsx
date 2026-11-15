"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import AllocationBar, { ROLE_DOT } from "@/components/AllocationBar";
import ModeTabs from "@/components/ModeTabs";
import SupplierDrawer from "@/components/SupplierDrawer";
import { Assumption, Badge, EngineChip, InfoTip, Kpi, PageTitle } from "@/components/ui";
import { useQueryParam } from "@/components/useTheme";
import { allocations, makerById, MODE_LABEL, MODES, rankings, suppliers, type Mode } from "@/lib/data";
import { pct, signedPts, signedUsd, usd } from "@/lib/format";
import { splitMetrics, type SplitRow } from "@/lib/insights";
import { liveAllocation, liveScores, parityCheck } from "@/lib/live";

const RouteMap = dynamic(() => import("@/components/RouteMap"), { ssr: false, loading: () => <div className="skeleton h-[420px]" /> });
const PARITY = parityCheck();

export default function Scenario() {
  const qMode = useQueryParam("mode");
  const [mode, setMode] = useState<Mode>("normal");
  const [lambda, setLambda] = useState<number>(suppliers.mode_lambda.normal);
  const [factor, setFactor] = useState<Record<string, number>>({});
  const [showMap, setShowMap] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const live = PARITY.ok;
  const demand = suppliers.demand;

  useEffect(() => {
    if (qMode && (MODES as string[]).includes(qMode)) {
      setMode(qMode as Mode);
      setLambda(suppliers.mode_lambda[qMode as Mode]);
    }
  }, [qMode]);

  // Each mode is a full profile: AHP weights + C5 stress factor + lambda. Switching mode resets lambda to the profile value.
  const changeMode = (m: Mode) => {
    setMode(m);
    setLambda(suppliers.mode_lambda[m]);
  };
  const disrupted = Object.values(factor).some((f) => f < 1);

  const base = useMemo(() => {
    if (!live) {
      const a = allocations[mode];
      return { rows: a.rows as SplitRow[], spot: a.spot_buy_vials, gateRelaxed: a.gate_relaxed, feasible: true };
    }
    const r = liveAllocation(mode, lambda);
    return { rows: r.rows as SplitRow[], spot: r.spotBuyVials, gateRelaxed: r.gateRelaxed, feasible: r.feasible };
  }, [mode, lambda, live]);

  const after = useMemo(() => {
    if (!live || !disrupted) return base;
    const r = liveAllocation(mode, lambda, { capacityFactor: factor });
    return { rows: r.rows as SplitRow[], spot: r.spotBuyVials, gateRelaxed: r.gateRelaxed, feasible: r.feasible };
  }, [mode, lambda, live, disrupted, factor, base]);

  const scores = useMemo(() => (live ? liveScores(mode) : Object.fromEntries(rankings[mode].map((r) => [r.id, r.S]))), [mode, live]);
  const mBase = splitMetrics(base.rows, mode);
  const mAfter = splitMetrics(after.rows, mode);
  const normalRef = allocations.normal.kpis;
  const ranked = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([id, S], i) => ({ id, S, rank: i + 1, normalRank: rankings.normal.find((r) => r.id === id)!.rank }));
  const topProbation = ranked.find((r) => makerById[r.id].is_probation);
  const sens = allocations[mode === "cost" ? "normal" : mode].lambda_sensitivity;
  const rowOf = (id: string) => after.rows.find((r) => r.id === id);

  return (
    <div>
      <PageTitle title="Scenario & Order Split" question="Q5 Q7" actions={<EngineChip live={live} />}>
        One click switches the whole decision profile: the board&apos;s weights, the route stress and lambda, the price of risk. A mixed-integer
        linear program (MILP) then splits {demand.toLocaleString("en-US")} vials under Tier 1 rules: at least 2 established makers, primary capped at
        70%, 5-15% probation trials, a compliance gate and capacity limits.
      </PageTitle>

      <div className="card mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <ModeTabs mode={mode} onChange={changeMode} showLambda />
        <label className="flex items-center gap-3 text-sm">
          <span className="flex items-center font-medium text-ink">
            Lambda
            <InfoTip term="lambda" />
            <Assumption>A35</Assumption>
          </span>
          <input
            type="range"
            min={0}
            max={5}
            step={0.5}
            value={lambda}
            disabled={!live}
            onChange={(e) => setLambda(Number(e.target.value))}
            className="w-40 accent-teal-600"
            aria-label="Lambda, the price of risk"
          />
          <span className="tnum w-8 font-semibold">{lambda.toFixed(1)}</span>
          {lambda !== suppliers.mode_lambda[mode] ? (
            <button className="text-xs text-accent-ink underline" onClick={() => setLambda(suppliers.mode_lambda[mode])}>
              reset to profile
            </button>
          ) : null}
        </label>
        <span className="text-xs text-muted">
          Profile: AHP weights + C5 stress {mode === "crisis" ? "1.5" : "1.0"} + lambda {suppliers.mode_lambda[mode].toFixed(1)}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Monthly purchase cost"
          value={usd(mAfter.cost)}
          delta={disrupted ? signedUsd(mAfter.cost - mBase.cost) : mode !== "normal" ? signedUsd(mAfter.cost - normalRef.purchase_cost_usd) : undefined}
          deltaTone="neutral"
          sub={disrupted ? "change vs no disruption" : mode !== "normal" ? "change vs Normal profile" : `${usd(mAfter.costPerVial, 2)} per vial`}
          source={live ? "Live engine" : "notebook 04"}
        />
        <Kpi
          label="Expected late shipments"
          term="C2"
          value={pct(mAfter.lateShare, 2)}
          delta={disrupted ? signedPts(mAfter.lateShare - mBase.lateShare, 2) : undefined}
          deltaTone={mAfter.lateShare <= mBase.lateShare ? "good" : "risk"}
          sub="volume-weighted XGBoost C2"
          source="XGBoost + MILP"
        />
        <Kpi
          label="Hormuz-exposed share"
          term="hormuz"
          value={pct(mAfter.hormuzShare)}
          delta={disrupted ? signedPts(mAfter.hormuzShare - mBase.hormuzShare) : undefined}
          deltaTone={mAfter.hormuzShare <= mBase.hormuzShare ? "good" : "risk"}
          sub={`India-made volume ${pct(mAfter.indiaShare, 0)}`}
          source="Route mix A8"
        />
        <Kpi
          label="Spot buy needed"
          value={`${after.spot.toLocaleString("en-US")} vials`}
          tone={after.spot > 0 ? "alert" : "good"}
          sub={`${mAfter.suppliersUsed} suppliers used`}
          source="MILP slack"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="card lg:col-span-3">
          <h2 className="h-section">
            MILP allocation by role - {MODE_LABEL[mode]}, lambda {lambda.toFixed(1)}
            {disrupted ? " (after disruption)" : ""}
          </h2>
          <div className="mt-3">
            <AllocationBar rows={after.rows} spot={after.spot} demand={demand} label={`Order split in ${MODE_LABEL[mode]} mode`} />
          </div>
          <div className="overflow-x-auto">
            <table className="table-clean mt-3 w-full">
              <thead>
                <tr>
                  <th>Maker</th>
                  <th>Role</th>
                  <th>Vials</th>
                  <th>Share</th>
                  <th>Landed cost / vial</th>
                  <th>Plant</th>
                </tr>
              </thead>
              <tbody>
                {after.rows
                  .filter((r) => r.vials > 0)
                  .map((r) => (
                    <tr key={r.id} className="cursor-pointer hover:bg-raised" onClick={() => setSelected(r.id)}>
                      <td className="font-medium">
                        {makerById[r.id].name}
                        {after.gateRelaxed.includes(r.id) ? <Badge tone="risk">Gate relaxed</Badge> : null}
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: ROLE_DOT[r.role] }} />
                          {r.role}
                        </span>
                      </td>
                      <td className="tnum">{r.vials.toLocaleString("en-US")}</td>
                      <td className="tnum">{pct(r.share)}</td>
                      <td className="tnum">
                        {usd(makerById[r.id].landed_cost, 2)}
                        {makerById[r.id].c1_imputed ? <Assumption>imputed</Assumption> : null}
                      </td>
                      <td>{makerById[r.id].country}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {after.gateRelaxed.length ? (
            <p className="mt-3 rounded-lg border border-risk/40 bg-risk-soft p-2.5 text-sm font-semibold text-risk">
              Compliance gate relaxed for {after.gateRelaxed.join(", ")}: C4 above {suppliers.compliance_gate.toFixed(2)}, used only because no feasible split
              exists without it.
            </p>
          ) : (
            <p className="caption mt-3">
              Compliance gate active: {suppliers.makers.filter((m) => m.compliance_gated && !m.is_probation).map((m) => m.id).join(", ")} cannot be primary or
              backup (C4 above {suppliers.compliance_gate.toFixed(2)}, assumption A34).
            </p>
          )}
          {topProbation ? (
            <p className="mt-2 text-sm text-ink">
              Why does a top-ranked maker get a small share? {makerById[topProbation.id].name} ranks {topProbation.rank} on the evidence available, but it is a
              probation maker, so the MILP caps it at a 5-15% trial until its delivery record is proven. This month it receives {pct(rowOf(topProbation.id)?.share ?? 0)}.
            </p>
          ) : null}
          <p className="caption mt-2">
            Demand<Assumption>A11</Assumption> and capacities<Assumption>A27-A28</Assumption> are scenario assumptions. Recommendation only: a category manager
            approves it on the Approval page.
          </p>
        </div>

        <div className="card lg:col-span-2">
          <h2 className="h-section">Disruption simulator: what if a supplier fails?</h2>
          <p className="caption mt-1">Shut a plant or cut its capacity. The MILP re-solves live in your browser.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-ghost" onClick={() => setFactor({ TEVA: 0 })} disabled={!live}>
              Primary (Teva) plant fails
            </button>
            <button className="btn btn-ghost" onClick={() => setFactor({ HOSPIRA: 0.25 })} disabled={!live}>
              Hospira at 25% capacity
            </button>
            <button className="btn btn-ghost" onClick={() => setFactor({})} disabled={!disrupted}>
              Reset
            </button>
          </div>
          <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
            {suppliers.makers.map((m) => {
              const f = factor[m.id] ?? 1;
              return (
                <li key={m.id} className="text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-medium ${f === 0 ? "text-risk line-through" : "text-ink"}`}>{m.id}</span>
                    <label className="flex min-h-6 cursor-pointer items-center gap-1.5 px-1 text-muted">
                      <input
                        className="h-4 w-4"
                        type="checkbox"
                        checked={f === 0}
                        disabled={!live}
                        onChange={(e) => setFactor({ ...factor, [m.id]: e.target.checked ? 0 : 1 })}
                        aria-label={`Shut down ${m.name}`}
                      />
                      shutdown
                    </label>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={f}
                    disabled={!live}
                    onChange={(e) => setFactor({ ...factor, [m.id]: Number(e.target.value) })}
                    className="w-full accent-teal-600"
                    aria-label={`Capacity of ${m.name}`}
                  />
                  <span className="tnum text-[10px] text-muted">
                    capacity {Math.round(m.capacity * f).toLocaleString("en-US")} of {m.capacity.toLocaleString("en-US")} vials
                  </span>
                </li>
              );
            })}
          </ul>
          {disrupted ? (
            <div className="mt-4 rounded-lg border border-line bg-raised p-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">Before</div>
              <AllocationBar rows={base.rows} spot={base.spot} demand={demand} label="Order split before the disruption" />
              <div className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted">After</div>
              <AllocationBar rows={after.rows} spot={after.spot} demand={demand} label="Order split after the disruption" />
              <dl className="mt-3 grid grid-cols-2 gap-1 text-xs">
                <dt className="text-muted">Cost change</dt>
                <dd className="tnum font-semibold">{signedUsd(mAfter.cost - mBase.cost)} a month</dd>
                <dt className="text-muted">Hormuz-exposed share</dt>
                <dd className="tnum font-semibold">
                  {pct(mBase.hormuzShare)} to {pct(mAfter.hormuzShare)}
                </dd>
                <dt className="text-muted">Expected late share</dt>
                <dd className="tnum font-semibold">
                  {pct(mBase.lateShare, 2)} to {pct(mAfter.lateShare, 2)}
                </dd>
                <dt className="text-muted">Spot buy</dt>
                <dd className="tnum font-semibold">{after.spot.toLocaleString("en-US")} vials</dd>
              </dl>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="card lg:col-span-2">
          <h2 className="h-section">Ranking and change vs Normal</h2>
          <table className="table-clean mt-2 w-full">
            <thead>
              <tr>
                <th>#</th>
                <th>Maker</th>
                <th>
                  S<InfoTip term="S" />
                </th>
                <th>vs Normal</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => {
                const delta = r.normalRank - r.rank;
                return (
                  <tr key={r.id} className="cursor-pointer hover:bg-raised" onClick={() => setSelected(r.id)}>
                    <td className="font-semibold">{r.rank}</td>
                    <td>
                      {r.id} {makerById[r.id].is_probation ? <Badge tone="warn">P</Badge> : null}
                      {makerById[r.id].compliance_gated ? <Badge tone="risk">G</Badge> : null}
                    </td>
                    <td className="tnum">{r.S.toFixed(3)}</td>
                    <td className={`font-semibold ${delta > 0 ? "text-good" : delta < 0 ? "text-risk" : "text-faint"}`}>
                      {delta > 0 ? `▲ ${delta}` : delta < 0 ? `▼ ${-delta}` : "="}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="caption mt-2">P = probation (5-15% trial only), G = compliance-gated.</p>
        </div>

        <div className="card lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="h-section">
              Supply lanes to the UAE <Assumption>A8</Assumption>
            </h2>
            <button className="btn btn-ghost" onClick={() => setShowMap(!showMap)} aria-expanded={showMap}>
              {showMap ? "Hide route map" : "Show route map"}
            </button>
          </div>
          <p className="caption mt-1">
            Lane width = share of volume by route from each plant country (scenario assumption A8, not observed data). In Crisis mode the Hormuz sea and Gulf air
            lanes are highlighted in red.
          </p>
          {showMap ? <RouteMap crisis={mode === "crisis"} /> : <div className="mt-3 rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">The map loads on request to keep the page fast.</div>}
        </div>
      </div>

      <div className="card mt-6">
        <h2 className="h-section">
          Lambda sensitivity ({mode === "cost" ? "Normal" : MODE_LABEL[mode]})
          <InfoTip term="lambda" />
        </h2>
        <p className="caption mt-1">Precomputed by the Python MILP (notebook 04) and re-checked by the parity tests. The highlighted row is the current lambda.</p>
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
                <tr key={s.lambda} className={s.lambda === lambda ? "bg-accent-soft" : ""}>
                  <td className="tnum">{s.lambda.toFixed(1)}</td>
                  <td>{s.split}</td>
                  <td className="tnum">{usd(s.purchase_cost_usd)}</td>
                  <td className="tnum">{pct(s.expected_late_share, 2)}</td>
                  <td className="tnum">{pct(s.india_made_share, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected ? (
        <SupplierDrawer
          id={selected}
          mode={mode}
          rank={ranked.find((r) => r.id === selected)?.rank ?? 0}
          row={rowOf(selected)}
          gateRelaxed={after.gateRelaxed}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
