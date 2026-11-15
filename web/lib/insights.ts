// Derived, data-only helpers shared by pages: established rank, exposure shares and the plain-English
// "why this rank / why this share" sentences. Every value comes from web/data or the live engine.
import { c5For, makerById, suppliers, type Maker, type Mode } from "./data";
import { CRITERIA } from "./engine";
import { pct, usd } from "./format";

export const CRITERION_LABEL: Record<string, string> = {
  C1: "Landed cost",
  C2: "Delivery risk",
  C3: "Price integrity",
  C4: "Compliance",
  C5: "Route exposure",
};

export function criterionValue(m: Maker, c: string, mode: Mode): number {
  if (c === "C5") return c5For(m, mode);
  return m.criteria[c as "C1" | "C2" | "C3" | "C4"];
}

export function panelMedian(c: string, mode: Mode): number {
  const v = suppliers.makers.map((m) => criterionValue(m, c, mode)).sort((a, b) => a - b);
  const n = v.length;
  return n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
}

export function establishedRanks(order: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  order.filter((id) => !makerById[id].is_probation).forEach((id, i) => (out[id] = i + 1));
  return out;
}

export interface SplitRow {
  id: string;
  vials: number;
  share: number;
  role: string;
}

// Route plan of a split (same rule as notebook 04, assumption A36): Hormuz sea and Gulf air shares, with the
// east-coast reroute (Fujairah / Khor Fakkan, outside the Strait) applied in Crisis mode.
export function routePlan(rows: SplitRow[], mode: Mode) {
  const demand = suppliers.demand;
  const used = rows.filter((r) => r.vials > 0);
  const share = (k: "sea_hormuz_share" | "air_gulf_share" | "sea_gulf_of_oman_share") =>
    used.reduce((a, r) => a + r.vials * makerById[r.id][k], 0) / demand;
  const sea = share("sea_hormuz_share");
  const ec = suppliers.east_coast_reroute;
  const rerouted = ec.applies_in.includes(mode) ? sea : 0;
  const reroutedVials = Math.round(rerouted * demand);
  return {
    hormuzSeaBefore: sea,
    hormuzSea: sea - rerouted,
    gulfAir: share("air_gulf_share"),
    eastCoast: share("sea_gulf_of_oman_share") + rerouted,
    reroutedVials,
    reroutePremium: reroutedVials * ec.cost_premium_usd_per_vial,
    leadTimeDays: reroutedVials > 0 ? ec.lead_time_premium_days : 0,
  };
}

export function splitMetrics(rows: SplitRow[], mode: Mode) {
  const demand = suppliers.demand;
  const used = rows.filter((r) => r.vials > 0);
  const cost = used.reduce((a, r) => a + r.vials * makerById[r.id].landed_cost, 0);
  const route = routePlan(rows, mode);
  return {
    route,
    totalCost: cost + route.reroutePremium,
    cost,
    costPerVial: cost / demand,
    lateShare: used.reduce((a, r) => a + r.vials * makerById[r.id].criteria.C2, 0) / demand,
    indiaShare: used.filter((r) => makerById[r.id].country === "India").reduce((a, r) => a + r.vials, 0) / demand,
    routeExposure: used.reduce((a, r) => a + r.vials * c5For(makerById[r.id], mode), 0) / demand,
    suppliersUsed: used.length,
  };
}

// One sentence on why a maker sits where it does in the ranking.
export function whyRank(m: Maker, rank: number, mode: Mode): string {
  // Relative distance from the panel median per criterion; the two largest on each side are named.
  const dev = CRITERIA.map((c) => {
    const med = panelMedian(c, mode);
    const v = criterionValue(m, c, mode);
    return { c, rel: med > 0 ? (v - med) / med : v > 0 ? 1 : 0 };
  });
  const strengths = dev.filter((d) => d.rel < -0.15).sort((a, b) => a.rel - b.rel).slice(0, 2).map((d) => CRITERION_LABEL[d.c].toLowerCase());
  const weaknesses = dev.filter((d) => d.rel > 0.15).sort((a, b) => b.rel - a.rel).slice(0, 2).map((d) => CRITERION_LABEL[d.c].toLowerCase());
  const s = strengths.length ? `better than the panel median on ${strengths.join(" and ")}` : "close to the panel median on most criteria";
  const w = weaknesses.length ? `${strengths.length ? ", but" : " and"} worse on ${weaknesses.join(" and ")}` : "";
  return `Ranked ${rank} of ${suppliers.makers.length}: ${s}${w}.`;
}

// One sentence on why a maker gets the share it gets in the order split.
export function whyShare(m: Maker, row: SplitRow | undefined, gateRelaxed: string[] = []): string {
  const share = row?.share ?? 0;
  if (m.compliance_gated && !m.is_probation && share === 0)
    return `No volume: its compliance risk (C4 ${m.criteria.C4.toFixed(3)}) is above the ${suppliers.compliance_gate.toFixed(2)} gate, so it cannot be primary or backup while an alternative exists.`;
  if (gateRelaxed.includes(m.id)) return `Receives ${pct(share)} only because no feasible split exists without it; it is above the compliance gate.`;
  if (m.is_probation && !m.trial_gate_pass) return "No volume: as a probation maker it fails the safety gate (an OAI inspection or Class I recall in the last 3 years).";
  if (m.is_probation && share > 0)
    return `Probation trial of ${pct(share)}: probation makers are capped at 5-15% until their delivery record is proven.`;
  if (m.is_probation) return "No volume this month: another probation maker gives a better price and risk balance (at most 2 trials per order).";
  if (row?.role === "primary") return `Primary at ${pct(share)}: the best price and risk balance among eligible established makers, capped at 70% (Tier 1).`;
  if (row?.role === "backup") return `Warm backup at ${pct(share)}: keeps a second qualified established source live (dual sourcing, at least 10%).`;
  return `No volume: at ${usd(m.landed_cost, 2)} a vial its price and risk balance is beaten by the selected makers.`;
}
