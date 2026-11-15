"""Checks every JSON file in web/data against its contract.

The contract lists required keys and their types, plus business rules that the web app
relies on (11 makers, weights summing to 1, allocations summing to demand, and so on).
Run on its own with: python pipeline/validate_contract.py
"""
import json
import math
import sys
from pathlib import Path

WEB_DATA = Path(__file__).resolve().parents[1] / "web" / "data"
MODES = ["normal", "crisis", "cost"]
NUM = (int, float)

CONTRACTS = {
    "meta.json": {"run_utc": str, "data_cutoff": str, "raw_files": list, "sku_id": str, "demand": int, "lambda_default": NUM, "modes": list, "makers": int},
    "suppliers.json": {"sku_id": str, "sku_label": str, "tier": dict, "demand": int, "lambda_default": NUM, "mode_lambda": dict, "compliance_gate": NUM,
                       "data_criteria": list, "makers": list},
    "shap.json": {"global_importance": dict, "per_maker": dict, "unit": str},
    "model_metrics.json": {"c2": dict, "c3": dict, "nlp": dict, "robustness": dict},
    "nlp_letters.json": {"corpus_class_counts": dict, "severity_weights": dict, "per_maker": dict, "examples": list},
    "contract_clauses.json": {"synthetic": bool, "note": str, "contracts": list},
    "shortages_cache.json": {"source": str, "cached_on": str, "total": int, "results": list, "disclaimer": str},
}
for m in MODES:
    CONTRACTS[f"weights_{m}.json"] = {"mode": str, "ahp_matrix": list, "ahp_weights": dict, "cr": NUM, "entropy_weights": dict,
                                      "data_criteria": list, "final_weights": dict, "plan_target": dict, "c5_column": str}
    CONTRACTS[f"rankings_{m}.json"] = {"mode": str, "rows": list}
    CONTRACTS[f"allocations_{m}.json"] = {"mode": str, "demand": int, "lambda": NUM, "status": str, "spot_buy_vials": int,
                                          "gated_blocked": list, "gate_relaxed": list, "kpis": dict, "rows": list, "lambda_sensitivity": list}

MAKER_KEYS = {"id": str, "name": str, "country": str, "is_probation": bool, "trial_gate_pass": bool, "c1_imputed": bool,
              "landed_cost": NUM, "capacity": int, "active_fda_shortage": bool, "oai_count_5yr": int, "criteria": dict, "shap_top3": list,
              "c3_status": str, "nlp_status": str, "c4_evidence_status": str, "compliance_gated": bool}


def check_types(obj, spec, where, errors):
    for key, typ in spec.items():
        if key not in obj:
            errors.append(f"{where}: missing key '{key}'")
        elif not isinstance(obj[key], typ) or (typ is int and isinstance(obj[key], bool)):
            errors.append(f"{where}: key '{key}' has type {type(obj[key]).__name__}")


def business_rules(name, doc, errors):
    if name == "suppliers.json":
        if len(doc["makers"]) != 11:
            errors.append("suppliers.json: expected 11 qualified makers")
        for mk in doc["makers"]:
            check_types(mk, MAKER_KEYS, f"suppliers.json maker {mk.get('id')}", errors)
            for c, v in mk.get("criteria", {}).items():
                if not (0 <= v <= 1):
                    errors.append(f"suppliers.json {mk['id']} {c} = {v} outside [0, 1]")
            if len(mk.get("shap_top3", [])) != 3:
                errors.append(f"suppliers.json {mk['id']}: needs 3 SHAP reasons")
    if name.startswith("weights_"):
        if not math.isclose(sum(doc["final_weights"].values()), 1.0, abs_tol=1e-9):
            errors.append(f"{name}: final weights do not sum to 1")
        if doc["cr"] >= 0.10:
            errors.append(f"{name}: AHP consistency ratio {doc['cr']} is not below 0.10")
    if name.startswith("rankings_"):
        if len(doc["rows"]) != 11 or sorted(r["rank"] for r in doc["rows"]) != list(range(1, 12)):
            errors.append(f"{name}: ranks must be 1 to 11")
        if any(not (0 <= r.get("S_risk", -1) <= 1) for r in doc["rows"]):
            errors.append(f"{name}: every row needs S_risk in [0, 1]")
    if name.startswith("allocations_"):
        total = sum(r["vials"] for r in doc["rows"]) + doc["spot_buy_vials"]
        if total != doc["demand"]:
            errors.append(f"{name}: vials sum to {total}, demand is {doc['demand']}")
        if doc["status"] != "Optimal":
            errors.append(f"{name}: MILP status {doc['status']}")
        if sum(r["role"] == "probation trial" for r in doc["rows"]) > 2:
            errors.append(f"{name}: more than 2 probation suppliers")
        sup = json.loads((WEB_DATA / "suppliers.json").read_text(encoding="utf-8"))
        gated = {m["id"] for m in sup["makers"] if m["compliance_gated"] and not m["is_probation"]}
        for r in doc["rows"]:
            if r["id"] in gated and r["vials"] > 0 and r["id"] not in doc["gate_relaxed"]:
                errors.append(f"{name}: gated maker {r['id']} has volume without a gate relaxation flag")
        if doc["lambda"] != sup["mode_lambda"][doc["mode"]]:
            errors.append(f"{name}: lambda does not match the mode profile")
    if name == "contract_clauses.json" and doc["synthetic"] is not True:
        errors.append("contract_clauses.json must be flagged synthetic")


def validate_all():
    errors = []
    for name, spec in CONTRACTS.items():
        path = WEB_DATA / name
        if not path.exists():
            errors.append(f"{name}: file missing")
            continue
        doc = json.loads(path.read_text(encoding="utf-8"))
        check_types(doc, spec, name, errors)
        if not any(e.startswith(name) for e in errors):
            business_rules(name, doc, errors)
    extra = sorted({p.name for p in WEB_DATA.glob("*.json")} - set(CONTRACTS))
    if extra:
        errors.append(f"Files without a contract: {extra}")
    try:
        def split(m):
            d = json.loads((WEB_DATA / f"allocations_{m}.json").read_text(encoding="utf-8"))
            return [(r["id"], r["vials"]) for r in d["rows"] if r["vials"] > 0]
        if split("normal") == split("crisis"):
            errors.append("Normal and Crisis must produce different splits (review fix 1)")
    except FileNotFoundError:
        pass
    if errors:
        print("Contract validation FAILED:")
        for e in errors:
            print("  -", e)
        return False
    print(f"Contract validation passed: {len(CONTRACTS)} JSON files in web/data")
    return True


if __name__ == "__main__":
    sys.exit(0 if validate_all() else 1)
