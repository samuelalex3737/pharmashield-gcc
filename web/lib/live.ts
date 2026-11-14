// Live recompute path: weights -> TOPSIS -> MILP in the browser, for any mode and lambda.
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

export function liveScores(mode: Mode): Record<string, number> {
  const fw = liveWeights(mode);
  const matrix = suppliers.makers.map((m) => [m.criteria.C1, m.criteria.C2, m.criteria.C3, m.criteria.C4, c5For(m, mode)]);
  const s = topsis(matrix, CRITERIA.map((c) => fw[c]));
  return Object.fromEntries(suppliers.makers.map((m, i) => [m.id, s[i]]));
}

export function liveAllocation(mode: Mode, lambda: number): MilpResult {
  const S = liveScores(mode);
  return allocateMilp(
    suppliers.makers.map((m) => ({
      id: m.id,
      landedCost: m.landed_cost,
      S: S[m.id],
      isProbation: m.is_probation,
      trialGatePass: m.trial_gate_pass,
      capacity: m.capacity,
    })),
    suppliers.demand,
    lambda,
  );
}

export interface ParityReport {
  ok: boolean;
  maxScoreDiff: number;
  maxVialDiff: number;
  maxWeightDiff: number;
}

export function parityCheck(): ParityReport {
  let maxScoreDiff = 0;
  let maxVialDiff = 0;
  let maxWeightDiff = 0;
  for (const mode of MODES) {
    const fw = liveWeights(mode);
    for (const c of CRITERIA) maxWeightDiff = Math.max(maxWeightDiff, Math.abs(fw[c] - weights[mode].final_weights[c]));
    const s = liveScores(mode);
    for (const r of rankings[mode]) maxScoreDiff = Math.max(maxScoreDiff, Math.abs(s[r.id] - r.S));
    const live = liveAllocation(mode, allocations[mode].lambda);
    for (const r of allocations[mode].rows) {
      const lv = live.rows.find((x) => x.id === r.id)?.vials ?? 0;
      maxVialDiff = Math.max(maxVialDiff, Math.abs(lv - r.vials));
    }
    if (!live.feasible) maxVialDiff = Infinity;
  }
  return { ok: maxScoreDiff <= 1e-6 && maxVialDiff <= 1 && maxWeightDiff <= 1e-9, maxScoreDiff, maxVialDiff, maxWeightDiff };
}
