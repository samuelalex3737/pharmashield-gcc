// Parity tests: the TypeScript engine must reproduce the Python pipeline outputs exported in web/data.
// TOPSIS scores within 1e-6, final weights within 1e-9, MILP allocations within 1 vial.
import { describe, expect, it } from "vitest";
import { CRITERIA, entropyWeights, topsis } from "@/lib/engine";
import { allocations, MODES, rankings, suppliers, weights } from "@/lib/data";
import { liveAllocation, liveRiskScores, liveScores, liveWeights, parityCheck } from "@/lib/live";

describe("entropy and blended weights", () => {
  it("match the Python entropy weights", () => {
    const makers = suppliers.makers;
    const { weights: ent } = entropyWeights({
      C1: makers.filter((m) => !m.c1_imputed).map((m) => m.landed_cost),
      C2: makers.map((m) => m.criteria.C2),
      C4: makers.map((m) => m.criteria.C4),
    });
    for (const c of ["C1", "C2", "C4"]) expect(Math.abs(ent![c] - weights.normal.entropy_weights[c])).toBeLessThan(1e-9);
  });

  for (const mode of MODES) {
    it(`final weights match and sum to 1 (${mode})`, () => {
      const fw = liveWeights(mode);
      let sum = 0;
      for (const c of CRITERIA) {
        expect(Math.abs(fw[c] - weights[mode].final_weights[c])).toBeLessThan(1e-9);
        sum += fw[c];
      }
      expect(Math.abs(sum - 1)).toBeLessThan(1e-12);
    });
  }

  it("returns null when every column is constant (guard)", () => {
    const { weights: w } = entropyWeights({ A: [1, 1, 1], B: [0, 0, 0] });
    expect(w).toBeNull();
  });
});

describe("TOPSIS", () => {
  for (const mode of MODES) {
    it(`closeness scores match Python within 1e-6 (${mode})`, () => {
      const s = liveScores(mode);
      for (const r of rankings[mode]) expect(Math.abs(s[r.id] - r.S)).toBeLessThan(1e-6);
    });
  }

  for (const mode of MODES) {
    it(`S_risk (C2-C5 only) matches Python within 1e-6 (${mode})`, () => {
      const s = liveRiskScores(mode);
      for (const r of rankings[mode]) expect(Math.abs(s[r.id] - r.S_risk)).toBeLessThan(1e-6);
    });
  }

  it("treats a zero column as zero, not NaN", () => {
    const s = topsis([[0, 1], [0, 2], [0, 3]], [0.5, 0.5]);
    expect(s.every((v) => Number.isFinite(v))).toBe(true);
    expect(s[0]).toBeGreaterThan(s[2]);
  });
});

describe("MILP order split", () => {
  for (const mode of MODES) {
    it(`allocations match Python within 1 vial (${mode})`, () => {
      const live = liveAllocation(mode, allocations[mode].lambda);
      expect(live.feasible).toBe(true);
      for (const r of allocations[mode].rows) {
        const lv = live.rows.find((x) => x.id === r.id)!;
        expect(Math.abs(lv.vials - r.vials)).toBeLessThanOrEqual(1);
        expect(lv.role).toBe(r.role);
      }
      expect(live.spotBuyVials).toBe(allocations[mode].spot_buy_vials);
      expect(live.gatedBlocked.sort()).toEqual([...allocations[mode].gated_blocked].sort());
      expect(live.gateRelaxed).toEqual(allocations[mode].gate_relaxed);
    });
  }

  it("uses the mode lambda profile and gives different Normal and Crisis splits", () => {
    expect(allocations.normal.lambda).toBe(suppliers.mode_lambda.normal);
    expect(allocations.crisis.lambda).toBe(suppliers.mode_lambda.crisis);
    const key = (m: "normal" | "crisis") => allocations[m].rows.filter((r) => r.vials > 0).map((r) => `${r.id}:${r.vials}`).join(",");
    expect(key("normal")).not.toBe(key("crisis"));
  });

  it("never gives a compliance-gated maker a primary or backup role while an alternative exists", () => {
    for (const mode of MODES) {
      const live = liveAllocation(mode, allocations[mode].lambda);
      for (const r of live.rows) {
        const m = suppliers.makers.find((x) => x.id === r.id)!;
        if (m.compliance_gated && !m.is_probation) expect(r.vials).toBe(0);
      }
    }
  });

  it("relaxes the gate and flags the maker when no feasible alternative exists", () => {
    // Shut down Teva and Hospira: only gated established makers remain, so the gate must be relaxed.
    const live = liveAllocation("normal", 1.0, { capacityFactor: { TEVA: 0, HOSPIRA: 0 } });
    expect(live.gateRelaxed.length).toBeGreaterThan(0);
    expect(live.spotBuyVials).toBe(0);
  });

  it("respects Tier 1 rules at every lambda in the sensitivity table", () => {
    for (const mode of ["normal", "crisis"] as const) {
      for (const row of allocations[mode].lambda_sensitivity) {
        const live = liveAllocation(mode, row.lambda);
        const used = live.rows.filter((r) => r.vials > 0);
        const split = used.map((r) => `${r.id} ${r.vials.toLocaleString("en-US")}`).join(", ");
        expect(split).toBe(row.split);
        expect(live.rows.reduce((a, r) => a + r.vials, 0) + live.spotBuyVials).toBe(suppliers.demand);
        expect(Math.max(...live.rows.map((r) => r.share))).toBeLessThanOrEqual(0.7 + 1e-9);
        expect(used.filter((r) => r.role === "probation trial").length).toBeLessThanOrEqual(2);
      }
    }
  });

  it("runtime parity check passes", () => {
    expect(parityCheck().ok).toBe(true);
  });
});
