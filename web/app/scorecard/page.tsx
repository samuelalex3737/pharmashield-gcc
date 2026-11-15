"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import Chart, { CHART_COLORS } from "@/components/Chart";
import ModeTabs from "@/components/ModeTabs";
import SupplierDrawer from "@/components/SupplierDrawer";
import { Badge, EngineChip, InfoTip, PageTitle } from "@/components/ui";
import { useQueryParam, useReducedMotion } from "@/components/useTheme";
import { allocations, makerById, MODE_LABEL, MODES, rankings, suppliers, weights, type Mode } from "@/lib/data";
import { CRITERIA, type Weights } from "@/lib/engine";
import { pct, usd } from "@/lib/format";
import { criterionValue, CRITERION_LABEL, establishedRanks } from "@/lib/insights";
import { liveScores, parityCheck } from "@/lib/live";

const PARITY = parityCheck();
const COMPARE_COLORS = [CHART_COLORS.accent, CHART_COLORS.brand, CHART_COLORS.warn];

// Keep weights summing to 1: when one slider moves, the others are rescaled in proportion.
function rebalance(w: Weights, key: keyof Weights, value: number): Weights {
  const others = CRITERIA.filter((c) => c !== key);
  const rest = others.reduce((a, c) => a + w[c], 0);
  const target = 1 - value;
  const next = { ...w, [key]: value } as Weights;
  for (const c of others) next[c] = rest > 0 ? (w[c] / rest) * target : target / others.length;
  return next;
}

export default function Scorecard() {
  const reduced = useReducedMotion();
  const qMaker = useQueryParam("maker");
  const qMode = useQueryParam("mode");
  const [mode, setMode] = useState<Mode>("normal");
  const [custom, setCustom] = useState<Weights | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);

  useEffect(() => {
    if (qMaker && makerById[qMaker]) setSelected(qMaker);
  }, [qMaker]);
  useEffect(() => {
    if (qMode && (MODES as string[]).includes(qMode)) setMode(qMode as Mode);
  }, [qMode]);

  const preset = weights[mode].final_weights;
  const activeWeights = custom ?? preset;
  const live = PARITY.ok;

  const ranked = useMemo(() => {
    const scores: Record<string, number> =
      custom && live ? liveScores(mode, custom) : Object.fromEntries(rankings[mode].map((r) => [r.id, r.S]));
    return Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .map(([id, S], i) => ({ id, S, rank: i + 1 }));
  }, [mode, custom, live]);
  const estRank = establishedRanks(ranked.map((r) => r.id));
  const rankOf = Object.fromEntries(ranked.map((r) => [r.id, r.rank]));
  const allocRow = (id: string) => allocations[mode].rows.find((r) => r.id === id);

  const toggleCompare = (id: string) =>
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 3 ? [...c.slice(1), id] : [...c, id]));

  return (
    <div>
      <PageTitle title="Supplier Scorecard" question="Q1 Q6" actions={<EngineChip live={live} />}>
        Eleven qualified makers of carboplatin injection, ranked by TOPSIS closeness S. The overall rank includes probation makers, which can only
        receive a 5-15% trial; &quot;Est. rank&quot; orders the 5 established makers that can be primary or backup. Makers above the compliance gate (C4
        above {suppliers.compliance_gate.toFixed(2)}, assumption A34) cannot be primary or backup. Click any row for the full drill-down.
      </PageTitle>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <ModeTabs
          mode={mode}
          onChange={(m) => {
            setMode(m);
            setCustom(null);
          }}
        />
        <button className="btn btn-ghost" onClick={() => setCustom(custom ? null : { ...preset })} aria-expanded={!!custom}>
          {custom ? "Close custom weights" : "Custom weights"}
        </button>
        {compare.length ? (
          <span className="text-xs text-muted">
            Comparing {compare.length} of 3: {compare.join(", ")}{" "}
            <button className="underline" onClick={() => setCompare([])}>
              clear
            </button>
          </span>
        ) : (
          <span className="text-xs text-muted">Tick up to 3 makers to compare them side by side.</span>
        )}
      </div>

      {custom ? (
        <div className="card mb-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="h-section">
              Custom weights (sum to 1)
              <InfoTip text="Move a slider and the other weights rescale so the total stays 1. The ranking re-sorts live in your browser. The order split on the Scenario page keeps the board's preset weights." />
            </h2>
            <div className="flex items-center gap-2 text-xs text-muted">
              Preset: {MODE_LABEL[mode]} (AHP CR {weights[mode].cr.toFixed(4)}
              <InfoTip term="CR" />)
              <button className="btn btn-ghost" onClick={() => setCustom({ ...preset })}>
                Reset to AHP preset
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-5">
            {CRITERIA.map((c) => (
              <label key={c} className="text-xs">
                <span className="flex items-center justify-between font-medium text-ink">
                  <span>
                    {c} {CRITERION_LABEL[c]}
                  </span>
                  <span className="tnum">{activeWeights[c].toFixed(3)}</span>
                </span>
                <input
                  type="range"
                  min={0.01}
                  max={0.9}
                  step={0.01}
                  value={activeWeights[c]}
                  onChange={(e) => setCustom(rebalance(activeWeights, c, Number(e.target.value)))}
                  className="mt-1 w-full accent-teal-600"
                  aria-label={`Weight for ${CRITERION_LABEL[c]}`}
                />
                <span className="text-[10px] text-muted">preset {preset[c].toFixed(3)}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="card overflow-x-auto p-0">
        <table className="table-clean w-full min-w-[760px]">
          <thead>
            <tr>
              <th>Rank</th>
              <th title="Rank among the 5 established makers that can be primary or backup">Est. rank</th>
              <th>Maker</th>
              <th>
                S score
                <InfoTip term="S" />
              </th>
              <th>
                Composite risk
                <InfoTip term="risk" />
              </th>
              <th>OAI (5y)</th>
              <th>Flags</th>
              <th>Compare</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r) => {
              const mk = makerById[r.id];
              const risk = 1 - r.S;
              return (
                <motion.tr
                  key={r.id}
                  layout={!reduced}
                  transition={{ duration: 0.35 }}
                  onClick={() => setSelected(r.id)}
                  className="cursor-pointer hover:bg-raised"
                >
                  <td className="text-base font-bold">{r.rank}</td>
                  <td className="tnum text-muted">{estRank[r.id] ?? "-"}</td>
                  <td>
                    <button className="text-left font-medium text-ink hover:underline" onClick={() => setSelected(r.id)}>
                      {mk.name}
                    </button>
                    <div className="text-xs text-muted">
                      {mk.parent} - {mk.country}
                    </div>
                  </td>
                  <td className="tnum font-semibold">{r.S.toFixed(3)}</td>
                  <td>
                    <div className="h-1.5 w-24 rounded bg-raised">
                      <div className="h-1.5 rounded bg-risk" style={{ width: `${risk * 100}%` }} />
                    </div>
                    <span className="tnum text-xs">{risk.toFixed(3)}</span>
                  </td>
                  <td className="tnum">{mk.oai_count_5yr}</td>
                  <td>
                    <div className="flex max-w-xs flex-wrap gap-1">
                      {mk.is_probation ? (
                        <Badge tone="warn" title="Not a current incumbent (A23)">
                          Probation - capped at trial share (5-15%)
                        </Badge>
                      ) : null}
                      {mk.compliance_gated ? (
                        <Badge tone="risk" title={`C4 ${mk.criteria.C4.toFixed(3)} is above the ${suppliers.compliance_gate.toFixed(2)} gate (A34)`}>
                          Gated (C4 &gt; {suppliers.compliance_gate.toFixed(2)})
                        </Badge>
                      ) : null}
                      {mk.c1_imputed ? <Badge title="No Medicaid price; median used (A4)">Imputed</Badge> : null}
                      {mk.active_fda_shortage ? (
                        <Badge tone="risk" title="Current openFDA shortage record (US data)">
                          Shortage
                        </Badge>
                      ) : null}
                      {mk.c4_evidence_status !== "observed" ? (
                        <Badge tone="brand" title={mk.c4_evidence_status}>
                          Thin evidence
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={compare.includes(r.id)} onChange={() => toggleCompare(r.id)} aria-label={`Compare ${mk.name}`} />
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="card lg:col-span-2">
          <h2 className="h-section">{custom ? "Custom weights in use" : `Final blended weights - ${MODE_LABEL[mode]}`}</h2>
          <table className="table-clean mt-2 w-full">
            <thead>
              <tr>
                <th>Criterion</th>
                <th>AHP</th>
                <th>{custom ? "Custom" : "Final"}</th>
              </tr>
            </thead>
            <tbody>
              {CRITERIA.map((c) => (
                <tr key={c}>
                  <td>
                    {c} {CRITERION_LABEL[c]}
                    <InfoTip term={c} />
                  </td>
                  <td className="tnum">{weights[mode].ahp_weights[c].toFixed(3)}</td>
                  <td className="tnum font-semibold">{activeWeights[c].toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="caption mt-2">AHP consistency ratio {weights[mode].cr.toFixed(4)} (below 0.10). Entropy applies to C1, C2 and C4 only.</p>
        </div>

        <div className="card lg:col-span-3">
          <h2 className="h-section">Supplier comparison</h2>
          {compare.length < 2 ? (
            <p className="mt-3 text-sm text-muted">Tick 2 or 3 makers in the table to compare them on every criterion.</p>
          ) : (
            <>
              <Chart
                label={`Comparison of ${compare.join(", ")} on five criteria`}
                height={230}
                data={compare.map((id, i) => ({
                  type: "bar",
                  name: id,
                  x: CRITERIA.map((c) => CRITERION_LABEL[c]),
                  y: CRITERIA.map((c) => criterionValue(makerById[id], c, mode)),
                  marker: { color: COMPARE_COLORS[i] },
                }))}
                layout={{
                  barmode: "group",
                  margin: { l: 45, r: 10, t: 10, b: 40 },
                  yaxis: { range: [0, 1.05], title: { text: "Value (lower is better)" } },
                  legend: { orientation: "h", y: 1.15 },
                }}
              />
              <div className="overflow-x-auto">
                <table className="table-clean mt-2 w-full">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      {compare.map((id) => (
                        <th key={id}>{id}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ["Overall rank", (id: string) => String(rankOf[id])],
                        ["S score", (id: string) => (ranked.find((r) => r.id === id)?.S ?? 0).toFixed(3)],
                        ["Landed cost / vial", (id: string) => usd(makerById[id].landed_cost, 2)],
                        ["Late-delivery probability", (id: string) => pct(makerById[id].criteria.C2, 2)],
                        ["C4 compliance", (id: string) => makerById[id].criteria.C4.toFixed(3)],
                        ["OAI / Class I-II recalls (5y)", (id: string) => `${makerById[id].oai_count_5yr} / ${makerById[id].class_i_ii_5yr}`],
                        ["Plant country", (id: string) => makerById[id].country],
                        [
                          "Role eligibility",
                          (id: string) => (makerById[id].is_probation ? "Probation trial only" : makerById[id].compliance_gated ? "Gated" : "Primary or backup"),
                        ],
                        ["Share this month", (id: string) => pct(allocRow(id)?.share ?? 0, 0)],
                      ] as [string, (id: string) => string][]
                    ).map(([label, fn]) => (
                      <tr key={label}>
                        <td className="text-muted">{label}</td>
                        {compare.map((id) => (
                          <td key={id} className="tnum">
                            {fn(id)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {selected ? (
        <SupplierDrawer
          id={selected}
          mode={mode}
          rank={rankOf[selected]}
          row={allocRow(selected)}
          gateRelaxed={allocations[mode].gate_relaxed}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
