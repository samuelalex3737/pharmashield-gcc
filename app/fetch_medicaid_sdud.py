"""Fetch and cache Medicaid State Drug Utilization Data (SDUD) 2025 rows for carboplatin.

Why: C1 landed cost needs a real, per-manufacturer price for 2026 carboplatin makers.
SCMS has no carboplatin, and the VA FSS price list is no longer published as a download.
SDUD reports units and dollars reimbursed per NDC, and the NDC labeler code identifies
the maker. Dollars reimbursed / units reimbursed = price per unit, by labeler.

Scope: national totals only (state code "XX"), all quarters of 2025, both fee-for-service
(FFSU) and managed-care (MCOU) rows.

ASSUMPTION (labelled on slide 3 and in docs/assumptions.md): US Medicaid reimbursement
per unit is used as a proxy for the relative acquisition price a GCC GPO would pay.
It ranks makers on relative price; it is not a GCC tender price.

Source: data.medicaid.gov, dataset "State Drug Utilization Data 2025",
id 158a1baa-5506-400a-8ec3-97756f0b0536 (public domain).
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import requests

DATASET_ID = "158a1baa-5506-400a-8ec3-97756f0b0536"
API_URL = f"https://data.medicaid.gov/api/1/datastore/query/{DATASET_ID}/0"
PAGE_LIMIT = 500
RAW_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"


def fetch_carboplatin_national() -> Path:
    retrieved = datetime.now(timezone.utc)
    rows: list[dict] = []
    offset = 0
    total = None
    request_urls = []
    while True:
        params = {
            "conditions[0][property]": "product_name",
            "conditions[0][value]": "CARBOPLAT%",
            "conditions[0][operator]": "like",
            "conditions[1][property]": "state",
            "conditions[1][value]": "XX",
            "conditions[1][operator]": "=",
            "limit": PAGE_LIMIT,
            "offset": offset,
            "count": "true",
            "schema": "false",
        }
        response = requests.get(API_URL, params=params, timeout=60)
        response.raise_for_status()
        payload = response.json()
        request_urls.append(response.url)
        total = payload["count"]
        rows.extend(payload["results"])
        offset += PAGE_LIMIT
        if offset >= total:
            break
    document = {
        "source": "Medicaid State Drug Utilization Data 2025 (data.medicaid.gov)",
        "dataset_id": DATASET_ID,
        "filter": "product_name LIKE 'CARBOPLAT%' AND state = 'XX' (national totals)",
        "retrieved_utc": retrieved.isoformat(timespec="seconds"),
        "total_reported": total,
        "records_saved": len(rows),
        "request_urls": request_urls,
        "results": rows,
    }
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    path = RAW_DIR / f"medicaid_sdud2025_carboplatin_{retrieved.strftime('%Y%m%d')}.json"
    path.write_text(json.dumps(document, indent=1), encoding="utf-8")
    return path


if __name__ == "__main__":
    saved_path = fetch_carboplatin_national()
    saved = json.loads(saved_path.read_text(encoding="utf-8"))
    print(f"SDUD 2025 carboplatin national rows: total {saved['total_reported']}, saved {saved['records_saved']} -> {saved_path.name}")
