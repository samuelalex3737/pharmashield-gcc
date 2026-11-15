// TypeScript port of pipeline/src/mcdm.py: entropy blending, TOPSIS and the MILP order split.
// Parity with the Python outputs is tested in tests/parity.test.ts and checked again at runtime
// (see lib/live.ts). If parity fails, the app falls back to the precomputed Python results.
import solver from "javascript-lp-solver";

export const TIE_BREAK = 1e-3;
export const CRITERIA = ["C1", "C2", "C3", "C4", "C5"] as const;
export type Criterion = (typeof CRITERIA)[number];
export type Weights = Record<Criterion, number>;

export function entropyWeights(columns: Record<string, number[]>): {
  weights: Record<string, number> | null;
  divergence: Record<string, number>;
} {
  const divergence: Record<string, number> = {};
  for (const [name, raw] of Object.entries(columns)) {
    const x = raw.filter((v) => !Number.isNaN(v));
    const sum = x.reduce((a, b) => a + b, 0);
    const constant = x.every((v) => Math.abs(v - x[0]) <= 1e-8 + 1e-5 * Math.abs(x[0]));
    if (x.length < 2 || sum <= 0 || constant) {
      divergence[name] = 0;
      continue;
    }
    let e = 0;
    for (const v of x) {
      const p = v / sum;
      if (p > 0) e -= p * Math.log(p);
    }
    e /= Math.log(x.length);
    divergence[name] = Math.max(0, 1 - e);
  }
  const total = Object.values(divergence).reduce((a, b) => a + b, 0);
  if (total <= 0) return { weights: null, divergence };
  const weights: Record<string, number> = {};
  for (const [k, v] of Object.entries(divergence)) weights[k] = v / total;
  return { weights, divergence };
}

export function blendWeights(
  ahp: Weights,
  entropy: Record<string, number> | null,
  dataCriteria: string[],
  share = 0.5,
): Weights {
  const w = { ...ahp };
  if (!entropy) return w;
  const mass = dataCriteria.reduce((a, c) => a + ahp[c as Criterion], 0);
  for (const c of dataCriteria) {
    w[c as Criterion] = share * ahp[c as Criterion] + (1 - share) * mass * entropy[c];
  }
  return w;
}

export function topsis(matrix: number[][], weights: number[]): number[] {
  const n = matrix.length;
  const m = weights.length;
  const norm = Array.from({ length: m }, (_, j) => Math.sqrt(matrix.reduce((a, row) => a + row[j] ** 2, 0)));
  const v = matrix.map((row) => row.map((x, j) => (norm[j] > 0 ? x / norm[j] : 0) * weights[j]));
  const best = Array.from({ length: m }, (_, j) => Math.min(...v.map((r) => r[j])));
  const worst = Array.from({ length: m }, (_, j) => Math.max(...v.map((r) => r[j])));
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let dp = 0;
    let dm = 0;
    for (let j = 0; j < m; j++) {
      dp += (v[i][j] - best[j]) ** 2;
      dm += (v[i][j] - worst[j]) ** 2;
    }
    dp = Math.sqrt(dp);
    dm = Math.sqrt(dm);
    out.push(dm / (dp + dm + 1e-12));
  }
  return out;
}

export interface MilpMaker {
  id: string;
  landedCost: number;
  S: number;
  isProbation: boolean;
  trialGatePass: boolean;
  capacity: number;
  gated?: boolean; // compliance gate (C4 above the threshold, assumption A34)
}

export interface MilpRow {
  id: string;
  vials: number;
  share: number;
  role: "primary" | "backup" | "probation trial" | "not selected";
  unitObjectiveCost: number;
}

export interface MilpResult {
  feasible: boolean;
  rows: MilpRow[];
  spotBuyVials: number;
  purchaseCost: number;
  gatedBlocked: string[];
  gateRelaxed: string[];
}

export const MILP_DEFAULTS = { primaryCap: 0.7, trialMin: 0.05, trialMax: 0.15, trialMaxRelaxed: 0.3, backupMin: 0.1, maxProbation: 2, minEstablished: 2, bigM: 1e6 };

// Same logic as pipeline/src/mcdm.py allocate_milp: solve with the compliance gate; if that needs a spot buy
// or is infeasible (no feasible alternative), re-solve without the gate and report which gated makers got volume.
export function allocateMilp(makers: MilpMaker[], demand: number, lambda = 1.0, compliance = true, opts = MILP_DEFAULTS): MilpResult {
  const blocked = compliance ? makers.filter((m) => m.gated && !m.isProbation).map((m) => m.id) : [];
  const first = solveMilp(makers, demand, lambda, new Set(blocked), opts);
  if (blocked.length && (!first.feasible || first.spotBuyVials > 0)) {
    const relaxed = solveMilp(makers, demand, lambda, new Set(), opts);
    return { ...relaxed, gatedBlocked: [], gateRelaxed: blocked.filter((id) => (relaxed.rows.find((r) => r.id === id)?.vials ?? 0) > 0) };
  }
  return { ...first, gatedBlocked: blocked, gateRelaxed: [] };
}

function solveMilp(makers: MilpMaker[], demand: number, lambda: number, blocked: Set<string>, opts = MILP_DEFAULTS): Omit<MilpResult, "gatedBlocked" | "gateRelaxed"> {
  const meanCost = makers.reduce((a, m) => a + m.landedCost, 0) / makers.length;
  const unitCost: Record<string, number> = {};
  // Tie-break identical to pipeline/src/mcdm.py: higher S wins when landed costs are equal.
  for (const m of makers) unitCost[m.id] = m.landedCost + lambda * meanCost * (1 - m.S) + TIE_BREAK * (1 - m.S);
  const est = makers.filter((m) => !m.isProbation);
  const prob = makers.filter((m) => m.isProbation);
  const eligible = prob.filter((m) => m.trialGatePass);
  const trialCap = est.length >= 2 ? opts.trialMax : opts.trialMaxRelaxed;

  const constraints: Record<string, { min?: number; max?: number; equal?: number }> = { demand: { equal: demand } };
  const variables: Record<string, Record<string, number>> = { spot: { cost: opts.bigM, demand: 1 } };
  const binaries: Record<string, 1> = {};
  for (const m of makers) {
    const x: Record<string, number> = { cost: unitCost[m.id], demand: 1, [`cap_${m.id}`]: 1 };
    const y: Record<string, number> = { cost: 0, [`cap_${m.id}`]: -m.capacity, [`ub_${m.id}`]: 1 };
    constraints[`cap_${m.id}`] = { max: 0 };
    constraints[`ub_${m.id}`] = { max: 1 };
    if (!m.isProbation) {
      x[`conc_${m.id}`] = 1;
      y[`conc_${m.id}`] = -opts.primaryCap * demand;
      x[`wb_${m.id}`] = 1;
      y[`wb_${m.id}`] = -opts.backupMin * demand;
      y.estCount = 1;
      constraints[`conc_${m.id}`] = { max: 0 };
      constraints[`wb_${m.id}`] = { min: 0 };
      if (blocked.has(m.id)) {
        y[`cgate_${m.id}`] = 1;
        constraints[`cgate_${m.id}`] = { max: 0 };
      }
    } else {
      y.probCount = 1;
      if (m.trialGatePass) {
        x[`tmin_${m.id}`] = 1;
        y[`tmin_${m.id}`] = -opts.trialMin * demand;
        x[`tmax_${m.id}`] = 1;
        y[`tmax_${m.id}`] = -trialCap * demand;
        y.trialAtLeast = 1;
        constraints[`tmin_${m.id}`] = { min: 0 };
        constraints[`tmax_${m.id}`] = { max: 0 };
      } else {
        y[`gate_${m.id}`] = 1;
        constraints[`gate_${m.id}`] = { max: 0 };
      }
    }
    variables[`x_${m.id}`] = x;
    variables[`y_${m.id}`] = y;
    binaries[`y_${m.id}`] = 1;
  }
  constraints.probCount = { max: opts.maxProbation };
  constraints.estCount = { min: Math.min(opts.minEstablished, est.filter((m) => m.capacity > 0).length) };
  if (eligible.length) constraints.trialAtLeast = { min: 1 };

  const result = solver.Solve({ optimize: "cost", opType: "min", constraints, variables, binaries }) as Record<string, number | boolean>;
  const feasible = Boolean(result.feasible);
  const rows: MilpRow[] = makers.map((m) => {
    const vials = Math.round(Number(result[`x_${m.id}`] ?? 0));
    return { id: m.id, vials, share: vials / demand, role: "not selected", unitObjectiveCost: unitCost[m.id] };
  });
  const estRows = rows.filter((r) => !makers.find((m) => m.id === r.id)!.isProbation && r.vials > 0).sort((a, b) => b.vials - a.vials);
  estRows.forEach((r, i) => (r.role = i === 0 ? "primary" : "backup"));
  rows.filter((r) => makers.find((m) => m.id === r.id)!.isProbation && r.vials > 0).forEach((r) => (r.role = "probation trial"));
  const spotBuyVials = Math.round(Number(result.spot ?? 0));
  const purchaseCost = rows.reduce((a, r) => a + r.vials * makers.find((m) => m.id === r.id)!.landedCost, 0);
  rows.sort((a, b) => b.vials - a.vials);
  return { feasible, rows, spotBuyVials, purchaseCost };
}
