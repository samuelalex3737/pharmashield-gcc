// Typed access to the JSON exported by pipeline/notebooks/04_mcdm_topsis_milp.ipynb.
import suppliersJson from "@/data/suppliers.json";
import metaJson from "@/data/meta.json";
import weightsNormal from "@/data/weights_normal.json";
import weightsCrisis from "@/data/weights_crisis.json";
import weightsCost from "@/data/weights_cost.json";
import rankingsNormal from "@/data/rankings_normal.json";
import rankingsCrisis from "@/data/rankings_crisis.json";
import rankingsCost from "@/data/rankings_cost.json";
import allocNormal from "@/data/allocations_normal.json";
import allocCrisis from "@/data/allocations_crisis.json";
import allocCost from "@/data/allocations_cost.json";
import type { Weights } from "./engine";

export type Mode = "normal" | "crisis" | "cost";
export const MODES: Mode[] = ["normal", "crisis", "cost"];
export const MODE_LABEL: Record<Mode, string> = { normal: "Normal", crisis: "Crisis (Hormuz)", cost: "Cost focus" };

export interface ShapReason {
  feature: string;
  shap_log_odds: number;
  reason: string;
}

export interface Maker {
  id: string;
  name: string;
  parent: string;
  country: string;
  is_probation: boolean;
  trial_gate_pass: boolean;
  c1_imputed: boolean;
  landed_cost: number;
  price_per_ml: number;
  unit_share_2025: number;
  capacity: number;
  active_fda_shortage: boolean;
  compliance_gated: boolean;
  current_shortage_records: number;
  oai_count_5yr: number;
  vai_count_5yr: number;
  inspections_5yr: number;
  class_i_ii_5yr: number;
  class_i_5yr: number;
  nlp_citations_5yr: number;
  nlp_severity: number;
  nlp_status: string;
  c3_status: string;
  c3_lines_scored: number;
  c4_evidence_status: string;
  scms_lines: number;
  site_prior_source: string;
  hormuz_air_share: number;
  lpi: number;
  criteria: { C1: number; C2: number; C3: number; C4: number; C5_normal: number; C5_crisis: number };
  shap_top3: ShapReason[];
  c4_parts: { inspection: number; recalls: number; nlp: number; shortage: number };
  air_gulf_share: number;
  sea_hormuz_share: number;
  sea_gulf_of_oman_share: number;
  last_inspection: string | null;
  labeler_codes: string[];
  recalls_5yr: number;
  c2_site_prior: number;
}

export interface WeightsDoc {
  mode: Mode;
  ahp_matrix: number[][];
  ahp_weights: Weights;
  lambda_max: number;
  ci: number;
  cr: number;
  entropy_weights: Record<string, number>;
  entropy_divergence: Record<string, number>;
  data_criteria: string[];
  final_weights: Weights;
  plan_target: Weights;
  c5_column: "C5_normal" | "C5_crisis";
}

export interface RankingRow {
  id: string;
  S: number;
  composite_risk: number;
  rank: number;
  rank_normal: number;
  rank_change_vs_normal: number;
  S_ahp_only: number;
  S_risk: number;
}

export interface AllocationRow {
  id: string;
  vials: number;
  share: number;
  role: "primary" | "backup" | "probation trial" | "not selected";
  unit_objective_cost: number;
}

export interface Kpis {
  hormuz_sea_share_before_reroute: number;
  hormuz_sea_share: number;
  gulf_air_share: number;
  east_coast_sea_share: number;
  rerouted_vials: number;
  reroute_premium_usd: number;
  reroute_lead_time_premium_days: number;
  total_cost_usd: number;
  purchase_cost_usd: number;
  cost_per_vial_usd: number;
  expected_late_share: number;
  route_exposure_weighted: number;
  india_made_share: number;
  primary_share: number;
  suppliers_used: number;
  probation_trial_share: number;
  warm_backup_share: number;
  spot_buy_vials: number;
}

export interface SensitivityRow {
  lambda: number;
  split: string;
  purchase_cost_usd: number;
  expected_late_share: number;
  india_made_share: number;
  route_exposure_weighted: number;
}

export interface AllocationDoc {
  mode: Mode;
  demand: number;
  lambda: number;
  status: string;
  objective: number;
  gated_blocked: string[];
  gate_relaxed: string[];
  spot_buy_vials: number;
  kpis: Kpis;
  rows: AllocationRow[];
  lambda_sensitivity: SensitivityRow[];
}

export const suppliers = suppliersJson as unknown as {
  sku_id: string;
  sku_label: string;
  tier: { tier: number; basis: string; primary_cap: number; min_established_makers: number; trial_share: number[] };
  demand: number;
  lambda_default: number;
  mode_lambda: Record<Mode, number>;
  compliance_gate: number;
  data_criteria: string[];
  route_mix: { origin_country: string; air_gulf_share: number; sea_hormuz_share: number; sea_gulf_of_oman_share: number }[];
  route_mix_note: string;
  east_coast_reroute: { ports: string; cost_premium_usd_per_vial: number; lead_time_premium_days: number; applies_in: Mode[]; note: string };
  lambda_switches: { mode: Mode; from_lambda: number; split: string }[];
  makers: Maker[];
};
export const meta = metaJson as unknown as { run_utc: string; data_cutoff: string; raw_files: string[]; oncology_shortages?: OncologySummary };
export interface OncologySummary {
  records: number;
  current_records: number;
  current_drugs: number;
  current_by_drug: Record<string, number>;
}

export const weights: Record<Mode, WeightsDoc> = {
  normal: weightsNormal as unknown as WeightsDoc,
  crisis: weightsCrisis as unknown as WeightsDoc,
  cost: weightsCost as unknown as WeightsDoc,
};
export const rankings: Record<Mode, RankingRow[]> = {
  normal: (rankingsNormal as unknown as { rows: RankingRow[] }).rows,
  crisis: (rankingsCrisis as unknown as { rows: RankingRow[] }).rows,
  cost: (rankingsCost as unknown as { rows: RankingRow[] }).rows,
};
export const allocations: Record<Mode, AllocationDoc> = {
  normal: allocNormal as unknown as AllocationDoc,
  crisis: allocCrisis as unknown as AllocationDoc,
  cost: allocCost as unknown as AllocationDoc,
};

export const makerById: Record<string, Maker> = Object.fromEntries(suppliers.makers.map((m) => [m.id, m]));

export function c5For(m: Maker, mode: Mode): number {
  return mode === "crisis" ? m.criteria.C5_crisis : m.criteria.C5_normal;
}
