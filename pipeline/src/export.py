"""Exports compact JSON files for the Next.js app (web/data). Called at the end of notebook 04."""
import json
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from .common import RAW, WEB_DATA, PROCESSED


def _clean(obj):
    if isinstance(obj, dict):
        return {str(k): _clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_clean(v) for v in obj]
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating, float)):
        return None if np.isnan(obj) else float(obj)
    if isinstance(obj, pd.Timestamp):
        return None if pd.isna(obj) else obj.strftime("%Y-%m-%d")
    return obj


def write(name, payload):
    path = WEB_DATA / name
    path.write_text(json.dumps(_clean(payload), indent=1, ensure_ascii=False), encoding="utf-8")
    return path


def shortages_cache():
    doc = json.loads((RAW / "openfda_shortages_carboplatin_20261114.json").read_text(encoding="utf-8"))
    rows = []
    for r in doc["results"]:
        rows.append({"company_name": r.get("company_name"), "status": r.get("status"), "presentation": r.get("presentation"),
                     "package_ndc": r.get("package_ndc"), "shortage_reason": r.get("shortage_reason"),
                     "update_date": r.get("update_date"), "initial_posting_date": r.get("initial_posting_date")})
    return {"source": "openFDA Drug Shortages API, generic_name carboplatin", "retrieved_utc": doc.get("retrieved_utc"),
            "cached_on": "2026-11-14", "total": len(rows), "results": rows,
            "disclaimer": "openFDA data is not validated for clinical or production use. US data, used only as a supplier-risk signal."}


def processed_json(name):
    return json.loads((PROCESSED / name).read_text(encoding="utf-8"))


def oncology_shortages():
    """Summary of the openFDA oncology shortage cache used on the Overview page (US data, counts of records)."""
    doc = json.loads((RAW / "openfda_shortages_oncology_20261114.json").read_text(encoding="utf-8"))
    df = pd.DataFrame(doc["results"])
    current = df[df["status"].eq("Current")]
    by_drug = current["generic_name"].str.strip().str.title().value_counts()
    return {"source": "openFDA Drug Shortages API, therapeutic_category Oncology", "retrieved_utc": doc.get("retrieved_utc"),
            "records": int(len(df)), "current_records": int(len(current)), "current_drugs": int(by_drug.size),
            "current_by_drug": {k: int(v) for k, v in by_drug.items()}}


def meta(extra):
    files = sorted(p.name for p in RAW.iterdir() if p.is_file())
    return {"run_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "data_cutoff": "2026-11-14",
            "raw_files": files, "oncology_shortages": oncology_shortages(), **extra}
