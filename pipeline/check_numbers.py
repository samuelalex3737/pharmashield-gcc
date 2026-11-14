"""Traces every number in deck/notebooklm_source_pack.md to an output file and checks it.

    python pipeline/check_numbers.py

Writes docs/number_trace.md: one row per number with the value quoted on the slides, the file it
comes from, the value recomputed from that file, and PASS or FAIL. Also checks that each quoted
value really appears in the source pack text. Exit code 1 if any check fails.
"""
import json
import re
import sys
from pathlib import Path

import nbformat
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web" / "data"
PROC = ROOT / "data" / "processed"
RAW = ROOT / "data" / "raw"
PACK = (ROOT / "deck" / "notebooklm_source_pack.md").read_text(encoding="utf-8")


def j(name):
    return json.loads((WEB / name).read_text(encoding="utf-8"))


def nb_text(name):
    nb = nbformat.read(ROOT / "pipeline" / "notebooks" / name, as_version=4)
    parts = []
    for cell in nb.cells:
        for out in cell.get("outputs", []):
            parts.append(out.get("text") or out.get("data", {}).get("text/plain", ""))
    return "\n".join(parts)


def run():
    sup = j("suppliers.json")
    meta = j("meta.json")
    met = j("model_metrics.json")
    shap = j("shap.json")
    nlp = j("nlp_letters.json")
    con = j("contract_clauses.json")
    short = j("shortages_cache.json")
    w = {m: j(f"weights_{m}.json") for m in ["normal", "crisis", "cost"]}
    an = j("allocations_normal.json")
    ac = j("allocations_crisis.json")
    scms = pd.read_csv(PROC / "scms_clean.csv")
    panel = pd.read_csv(PROC / "scoring_panel_carboplatin.csv", index_col=0)
    match = pd.read_csv(PROC / "fda_match_table.csv")
    linked = pd.read_csv(PROC / "fda_matched_inspections.csv")
    ndc = pd.DataFrame(json.loads((RAW / "openfda_ndc_carboplatin_20261114.json").read_text(encoding="utf-8"))["results"])
    nb3 = nb_text("03_risk_models_xgb_iforest_nlp.ipynb")
    nb4 = nb_text("04_mcdm_topsis_milp.ipynb")
    makers = {m["id"]: m for m in sup["makers"]}
    est_min = min(m["landed_cost"] for m in sup["makers"] if not m["is_probation"])
    lam15 = next(r for r in ac["lambda_sensitivity"] if r["lambda"] == 1.5)
    rows_n = {r["id"]: r for r in an["rows"]}
    c2m = met["c2"]["models"]
    cm = met["c2"]["confusion_matrices"]

    def pct1(v):
        return f"{v * 100:.1f}%"

    checks = [
        # (slide, label, value as quoted, source file, recomputed string)
        (1, "Current carboplatin shortage records", "29", "web/data/shortages_cache.json", str(sum(r["status"] == "Current" for r in short["results"]))),
        (1, "Carboplatin shortage records in total", "35", "web/data/shortages_cache.json", str(short["total"])),
        (1, "Qualified makers with a current shortage", "8 of 11", "web/data/suppliers.json", f"{sum(m['active_fda_shortage'] for m in sup['makers'])} of {len(sup['makers'])}"),
        (1, "Current US oncology shortage records", "84", "web/data/meta.json", str(meta["oncology_shortages"]["current_records"])),
        (1, "Drugs covered by those records", "8 drugs", "web/data/meta.json", f"{meta['oncology_shortages']['current_drugs']} drugs"),
        (2, "SCMS lines", "10,324", "data/processed/scms_clean.csv", f"{len(scms):,}"),
        (2, "Carboplatin labelers listed", "18", "data/raw/openfda_ndc_carboplatin_20261114.json", str(ndc["labeler_name"].nunique())),
        (2, "Bulk-only labelers", "7", "data/raw/openfda_ndc_carboplatin_20261114.json", str(ndc.loc[ndc["product_type"].eq("BULK INGREDIENT"), "labeler_name"].nunique())),
        (2, "Qualified makers", "11", "web/data/suppliers.json", str(len(sup["makers"]))),
        (2, "Fuzzy candidate pairs", "78", "data/processed/fda_match_table.csv", str(len(match))),
        (2, "Accepted matches", "25", "data/processed/fda_match_table.csv", str((match["decision"] == "accept").sum())),
        (2, "False matches stopped by the second test", "7", "data/processed/fda_match_table.csv", str(match["decision"].str.contains("distinctive").sum())),
        (2, "FDA inspections linked", "286", "data/processed/fda_matched_inspections.csv", str(len(linked))),
        (2, "Makers with SCMS history after parent mapping", "2 of 11", "data/processed/scoring_panel_carboplatin.csv", f"{(panel['scms_lines'] > 0).sum()} of {len(panel)}"),
        (2, "Eugia SCMS lines via Aurobindo", "3,283", "data/processed/scoring_panel_carboplatin.csv", f"{int(panel.loc['EUGIA', 'scms_lines']):,}"),
        (3, "AHP CR Normal", "0.0040", "web/data/weights_normal.json", f"{w['normal']['cr']:.4f}"),
        (3, "AHP CR Crisis", "0.0008", "web/data/weights_crisis.json", f"{w['crisis']['cr']:.4f}"),
        (3, "AHP CR Cost focus", "0.0022", "web/data/weights_cost.json", f"{w['cost']['cr']:.4f}"),
        (3, "Final Normal weights C1 to C5", "0.137 / 0.318 / 0.050 / 0.234 / 0.261", "web/data/weights_normal.json",
         " / ".join(f"{w['normal']['final_weights'][c]:.3f}" for c in ["C1", "C2", "C3", "C4", "C5"])),
        (3, "Final Crisis weight C5", "0.314", "web/data/weights_crisis.json", f"{w['crisis']['final_weights']['C5']:.3f}"),
        (3, "Split Teva / Accord / AVYXA (vials)", "7,000 / 2,500 / 500", "web/data/allocations_normal.json",
         f"{rows_n['TEVA']['vials']:,} / {rows_n['ACCORD']['vials']:,} / {rows_n['AVYXA']['vials']:,}"),
        (3, "Monthly purchase cost (USD)", "1,435,069", "web/data/allocations_normal.json", f"{an['kpis']['purchase_cost_usd']:,.0f}"),
        (3, "Crisis lambda 1.5 cost (USD)", "1,559,745", "web/data/allocations_crisis.json", f"{lam15['purchase_cost_usd']:,.0f}"),
        (3, "Crisis lambda 1.5 India-made share", "0%", "web/data/allocations_crisis.json", f"{lam15['india_made_share'] * 100:.0f}%"),
        (3, "Crisis premium (USD)", "124,676", "web/data/allocations_crisis.json", f"{lam15['purchase_cost_usd'] - an['kpis']['purchase_cost_usd']:,.0f}"),
        (3, "Crisis premium (%)", "8.7%", "web/data/allocations_crisis.json", pct1(lam15["purchase_cost_usd"] / an["kpis"]["purchase_cost_usd"] - 1)),
        (3, "Robustness: Teva stays top established", "98.3%", "web/data/model_metrics.json", pct1(met["robustness"]["stays_top_share"])),
        (4, "Train lines", "7,779", "web/data/model_metrics.json", f"{met['c2']['train_lines']:,}"),
        (4, "Test lines", "2,545", "web/data/model_metrics.json", f"{met['c2']['test_lines']:,}"),
        (4, "Test late rate", "13.99%", "web/data/model_metrics.json", f"{met['c2']['test_late_rate'] * 100:.2f}%"),
        (4, "ROC-AUC XGBoost vs logistic", "0.716 vs 0.627", "web/data/model_metrics.json", f"{c2m['XGBoost']['roc_auc']:.3f} vs {c2m['Logistic regression']['roc_auc']:.3f}"),
        (4, "PR-AUC XGBoost vs logistic", "0.277 vs 0.211", "web/data/model_metrics.json", f"{c2m['XGBoost']['pr_auc']:.3f} vs {c2m['Logistic regression']['pr_auc']:.3f}"),
        (4, "Recall at equal flag share", "71.9% vs 47.2%", "web/data/model_metrics.json",
         f"{pct1(c2m['XGBoost']['recall_at_equal_flag_share'])} vs {pct1(c2m['Logistic regression']['recall_at_equal_flag_share'])}"),
        (4, "Share of lines flagged by XGBoost", "40.9%", "web/data/model_metrics.json", pct1(c2m["XGBoost"]["flagged_share"])),
        (4, "False alarms", "784 vs 1,590", "web/data/model_metrics.json", f"{cm['XGBoost']['fp']:,} vs {cm['Logistic regression']['fp']:,}"),
        (4, "Late lines caught", "256 vs 304", "web/data/model_metrics.json", f"{cm['XGBoost']['tp']} vs {cm['Logistic regression']['tp']}"),
        (4, "scale_pos_weight", "8.372", "web/data/model_metrics.json", f"{met['c2']['scale_pos_weight']:.3f}"),
        (4, "SHAP site history / freight ratio / weight", "0.444, freight ratio 0.377, weight 0.290", "web/data/shap.json",
         f"{shap['global_importance']['Site history (prior late rate)']:.3f}, freight ratio {shap['global_importance']['Freight-to-value ratio']:.3f}, weight {shap['global_importance']['Shipment weight']:.3f}"),
        (4, "C2 Eugia", "9.19%", "web/data/suppliers.json", f"{makers['EUGIA']['criteria']['C2'] * 100:.2f}%"),
        (4, "C2 US-made makers", "1.59%", "web/data/suppliers.json", f"{makers['HOSPIRA']['criteria']['C2'] * 100:.2f}%"),
        (4, "Lines flagged by Isolation Forest", "475 of 9,207", "web/data/model_metrics.json", f"{met['c3']['lines_flagged']} of {met['c3']['lines_scored']:,}"),
        (4, "Isolation Forest flag rate", "5.16%", "web/data/model_metrics.json", f"{met['c3']['population_flag_rate'] * 100:.2f}%"),
        (4, "Product groups modelled", "36", "web/data/model_metrics.json", str(met["c3"]["groups_modelled"])),
        (4, "Anomaly freight ratio vs group median", "2.36", "web/data/model_metrics.json", f"{met['c3']['examples'][0]['freight_to_value']:.2f}"),
        (4, "Anomaly group median freight ratio", "0.33", "web/data/model_metrics.json", f"{met['c3']['examples'][0]['group_median_freight_to_value']:.2f}"),
        (5, "Drug GMP citations (21 CFR 211)", "40,473", "pipeline/notebooks/03 output", "40,473" if "40,473 rows" in nb3 else "not found"),
        (5, "Unique citation texts", "3,176", "web/data/nlp_letters.json", f"{sum(nlp['corpus_class_counts'].values()):,}"),
        (5, "Macro F1 TF-IDF vs keyword rules", "0.987", "web/data/model_metrics.json", f"{met['nlp']['macro_f1']:.3f}"),
        (5, "Keyword baseline macro F1", "0.657", "web/data/model_metrics.json", f"{met['nlp']['baseline_macro_f1']:.3f}"),
        (5, "Citations linked to makers (5 years)", "94", "web/data/nlp_letters.json", str(sum(v["citations_5yr"] for v in nlp["per_maker"].values()))),
        (5, "Eugia citations", "27", "web/data/nlp_letters.json", str(nlp["per_maker"]["EUGIA"]["citations_5yr"])),
        (5, "Eugia sterility and contamination citations", "11", "web/data/nlp_letters.json", str(nlp["per_maker"]["EUGIA"]["class_counts"]["Sterility and contamination"])),
        (5, "Contract risk A / B / C", "A 0.00, B 1.00, C 0.05", "web/data/contract_clauses.json",
         ", ".join(f"{c['contract'][-1]} {c['contract_risk']:.2f}" for c in con["contracts"])),
        (6, "Probation candidates", "6 probation candidates", "web/data/suppliers.json", f"{sum(m['is_probation'] for m in sup['makers'])} probation candidates"),
        (6, "Probation candidates passing the gate", "5 of 6 pass", "web/data/suppliers.json",
         f"{sum(m['is_probation'] and m['trial_gate_pass'] for m in sup['makers'])} of {sum(m['is_probation'] for m in sup['makers'])} pass"),
        (6, "Incumbent share of 2025 Medicaid units", "98.3%", "web/data/suppliers.json", pct1(sum(m["unit_share_2025"] for m in sup["makers"] if not m["is_probation"]))),
        (6, "AVYXA C4 with the neutral-evidence rule", "0.468", "web/data/suppliers.json", f"{makers['AVYXA']['criteria']['C4']:.3f}"),
        (6, "AVYXA C4 without the rule", "0.200", "pipeline/notebooks/04 output", "0.200" if re.search(r"AVYXA\s+0\.3255\s+0\.0159\s+0\.0516\s+0\.4679\s+0\.2000", nb4) else "not found"),
        (7, "Premium over all-Accord (USD)", "211,311", "web/data/allocations_normal.json + suppliers.json", f"{an['kpis']['purchase_cost_usd'] - est_min * sup['demand']:,.0f}"),
        (7, "Premium over all-Accord (%)", "17.3%", "web/data/allocations_normal.json + suppliers.json", pct1(an["kpis"]["purchase_cost_usd"] / (est_min * sup["demand"]) - 1)),
    ]
    lines = ["# Number Trace - PharmaShield GCC", "",
             "Generated by pipeline/check_numbers.py after pipeline/run_all.py. Every number quoted in deck/notebooklm_source_pack.md is recomputed from the file that produced it. PASS means the recomputed value equals the quoted value and the quoted value appears in the source pack.", "",
             "| Slide | Number | Quoted | Source file | Recomputed | In pack | Result |", "|---|---|---|---|---|---|---|"]
    failures = 0
    for slide, label, quoted, src, value in checks:
        in_pack = quoted in PACK
        ok = (value == quoted) and in_pack
        failures += not ok
        lines.append(f"| {slide} | {label} | {quoted} | {src} | {value} | {'yes' if in_pack else 'NO'} | {'PASS' if ok else 'FAIL'} |")
    external = [
        (1, "GCC pharmaceutical market 23.7 billion USD; about 80% imported", "Think Global Health / CFR, Mar 2026"),
        (1, "Hormuz transits down over 90%", "Khaleej Times, Apr 2026"),
        (1, "25 days to onboard a replacement supplier; 74% face shortages", "Ivalua survey via Supply Chain Dive, Jul 2026, n = 800"),
    ]
    lines += ["", "## External figures (cited, not computed)", "",
              "These come from the sources cited in the team's master plan (section 1.2). They cannot be recomputed from project files. Open each link and confirm before presenting (Phase 0 fix F10).", "",
              "| Slide | Figure | Source |", "|---|---|---|"]
    lines += [f"| {s} | {f} | {src} |" for s, f, src in external]
    lines += ["", f"**Result: {len(checks) - failures} of {len(checks)} computed numbers PASS.**"]
    (ROOT / "docs" / "number_trace.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"number trace: {len(checks) - failures} of {len(checks)} PASS")
    return failures == 0


if __name__ == "__main__":
    sys.exit(0 if run() else 1)
