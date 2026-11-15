// Live recompute path: weights -> TOPSIS -> MILP in the browser, for any mode, lambda, weight set or supplier disruption.
// A runtime parity check against the Python results decides whether the live path is used.
import { allocateMilp, blendWeights, CRITERIA, entropyWeights, topsis, type MilpResult, type Weights } from "./engine";
import { allocations, c5For, MODES, rankings, suppliers, weights, type Mode } from "./data";

export function liveWeights(mode: Mode): Weights {
  const w = weights[mode];
  const makers = suppliers.makers;
  const { weights: ent } = entropyWeights({
    C1: makers.filter((m) => !m.c1_imputed).map((m) => m.landed_cost),
    C2: makers.map((m) => m.criteria.C2),
    C4: makers.map((m) => m.criteria.C4),
  });
  return blendWeights(w.ahp_weights, ent, w.data_criteria);
}

function matrix(mode: Mode): number[][] {
  return suppliers.makers.map((m) => [m.criteria.C1, m.criteria.C2, m.criteria.C3, m.criteria.C4, c5For(m, mode)]);
}

// Five-criteria closeness S, used for the ranking display.
export function liveScores(mode: Mode, override?: Weights): Record<string, number> {
  const fw = override ?? liveWeights(mode);
  const s = topsis(matrix(mode), CRITERIA.map((c) => fw[c]));
  return Object.fromEntries(suppliers.makers.map((m, i) => [m.id, s[i]]));
}

// S_risk: closeness on C2-C5 only (weights renormalised), used in the MILP objective so cost is not counted twice.
export function liveRiskScores(mode: Mode, override?: Weights): Record<string, number> {
  const fw = override ?? liveWeights(mode);
  const keys = ["C2", "C3", "C4", "C5"] as const;
  const total = keys.reduce((a, c) => a + fw[c], 0);
  const s = topsis(
    matrix(mode).map((row) => row.slice(1)),
    keys.map((c) => fw[c] / total),
  );
  return Object.fromEntries(suppliers.makers.map((m, i) => [m.id, s[i]]));
}

export interface Disruption {
  // capacity multiplier per maker id: 0 = plant shutdown, 0.5 = half capacity
  capacityFactor?: Record<string, number>;
}

export function liveAllocation(mode: Mode, lambda: number, disruption?: Disruption, override?: Weights): MilpResult {
  const S = liveRiskScores(mode, override);
  return allocateMilp(
    suppliers.makers.map((m) => ({
      id: m.id,
      landedCost: m.landed_cost,
      S: S[m.id],
      isProbation: m.is_probation,
      trialGatePass: m.trial_gate_pass,
      capacity: Math.round(m.capacity * (disruption?.capacityFactor?.[m.id] ?? 1)),
      gated: m.compliance_gated,
    })),
    suppliers.demand,
    lambda,
  );
}

export interface ParityReport {
  ok: boolean;
  maxScoreDiff: number;
  maxRiskScoreDiff: number;
  maxVialDiff: number;
  maxWeightDiff: number;
}

export function parityCheck(): ParityReport {
  let maxScoreDiff = 0;
  let maxRiskScoreDiff = 0;
  let maxVialDiff = 0;
  let maxWeightDiff = 0;
  for (const mode of MODES) {
    const fw = liveWeights(mode);
    for (const c of CRITERIA) maxWeightDiff = Math.max(maxWeightDiff, Math.abs(fw[c] - weights[mode].final_weights[c]));
    const s = liveScores(mode);
    const sr = liveRiskScores(mode);
    for (const r of rankings[mode]) {
      maxScoreDiff = Math.max(maxScoreDiff, Math.abs(s[r.id] - r.S));
      maxRiskScoreDiff = Math.max(maxRiskScoreDiff, Math.abs(sr[r.id] - r.S_risk));
    }
    const live = liveAllocation(mode, allocations[mode].lambda);
    for (const r of allocations[mode].rows) {
      const lv = live.rows.find((x) => x.id === r.id)?.vials ?? 0;
      maxVialDiff = Math.max(maxVialDiff, Math.abs(lv - r.vials));
    }
    if (!live.feasible) maxVialDiff = Infinity;
  }
  return {
    ok: maxScoreDiff <= 1e-6 && maxRiskScoreDiff <= 1e-6 && maxVialDiff <= 1 && maxWeightDiff <= 1e-9,
    maxScoreDiff,
    maxRiskScoreDiff,
    maxVialDiff,
    maxWeightDiff,
  };
}
