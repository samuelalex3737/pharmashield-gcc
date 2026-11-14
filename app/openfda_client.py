"""openFDA client with a local cache.

Used twice:
1. Phase 1 data acquisition (run this file directly) - pulls and caches the raw
   responses that notebooks 02 to 04 read.
2. The Streamlit "Live alerts" page - tries a live call first and falls back to
   the newest cached file if the API or the network is down.

Every response is saved to data/raw/openfda_<name>_YYYYMMDD.json together with
the exact query URL and the retrieval timestamp, so every number can be traced.

Data caveat (from openFDA terms): openFDA data is not validated for clinical or
production use. We use it only as a supplier-risk signal, never for medical claims.
"""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

API_ROOT = "https://api.fda.gov"
PAGE_LIMIT = 1000          # openFDA maximum records per request
MAX_SKIP = 25000           # openFDA maximum skip value for paging
PAUSE_SECONDS = 0.3        # stays well under the 240 requests per minute limit without an API key
TIMEOUT_SECONDS = 30

PROJECT_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = PROJECT_ROOT / "data" / "raw"


def _get_all_pages(endpoint: str, search: str, sort: str | None = None) -> dict:
    """Return every record that matches `search`, paging through results.

    A 404 from openFDA means "no matches", so it returns an empty result
    instead of raising an error.
    """
    url = f"{API_ROOT}/{endpoint}.json"
    records: list[dict] = []
    pages_meta: list[dict] = []
    skip = 0
    total = None
    while True:
        params = {"search": search, "limit": PAGE_LIMIT, "skip": skip}
        if sort:
            params["sort"] = sort
        response = requests.get(url, params=params, timeout=TIMEOUT_SECONDS)
        if response.status_code == 404:
            total = 0
            pages_meta.append({"request_url": response.url, "status": 404})
            break
        response.raise_for_status()
        payload = response.json()
        meta = payload.get("meta", {})
        total = meta.get("results", {}).get("total", 0)
        records.extend(payload.get("results", []))
        pages_meta.append({"request_url": response.url, "status": response.status_code, "meta": meta})
        skip += PAGE_LIMIT
        if skip >= total or skip > MAX_SKIP:
            break
        time.sleep(PAUSE_SECONDS)
    return {"total_reported": total, "records": records, "pages": pages_meta}


def fetch_and_cache(name: str, endpoint: str, search: str, sort: str | None = None,
                    raw_dir: Path = RAW_DIR) -> Path:
    """Query openFDA and write the full response to data/raw with today's date."""
    raw_dir.mkdir(parents=True, exist_ok=True)
    retrieved = datetime.now(timezone.utc)
    result = _get_all_pages(endpoint, search, sort)
    document = {
        "source": "openFDA",
        "endpoint": f"{API_ROOT}/{endpoint}.json",
        "search": search,
        "sort": sort,
        "retrieved_utc": retrieved.isoformat(timespec="seconds"),
        "total_reported": result["total_reported"],
        "records_saved": len(result["records"]),
        "pages": result["pages"],
        "disclaimer": "openFDA data is not validated for clinical or production use.",
        "results": result["records"],
    }
    path = raw_dir / f"openfda_{name}_{retrieved.strftime('%Y%m%d')}.json"
    path.write_text(json.dumps(document, indent=1, ensure_ascii=False), encoding="utf-8")
    return path


def fetch_many_and_cache(name: str, endpoint: str, searches: dict[str, str],
                         raw_dir: Path = RAW_DIR) -> Path:
    """Run several searches (one per firm) and save them in one dated cache file."""
    raw_dir.mkdir(parents=True, exist_ok=True)
    retrieved = datetime.now(timezone.utc)
    by_query = {}
    for label, search in searches.items():
        result = _get_all_pages(endpoint, search)
        by_query[label] = {
            "search": search,
            "total_reported": result["total_reported"],
            "records_saved": len(result["records"]),
            "pages": result["pages"],
            "results": result["records"],
        }
        time.sleep(PAUSE_SECONDS)
    document = {
        "source": "openFDA",
        "endpoint": f"{API_ROOT}/{endpoint}.json",
        "retrieved_utc": retrieved.isoformat(timespec="seconds"),
        "disclaimer": "openFDA data is not validated for clinical or production use.",
        "queries": by_query,
    }
    path = raw_dir / f"openfda_{name}_{retrieved.strftime('%Y%m%d')}.json"
    path.write_text(json.dumps(document, indent=1, ensure_ascii=False), encoding="utf-8")
    return path


def load_latest_cache(name: str, raw_dir: Path = RAW_DIR) -> dict | None:
    """Return the newest cached response for `name`, or None if none exists."""
    files = sorted(raw_dir.glob(f"openfda_{name}_*.json"))
    if not files:
        return None
    document = json.loads(files[-1].read_text(encoding="utf-8"))
    document["cache_file"] = files[-1].name
    return document


def fetch_live_or_cache(name: str, endpoint: str, search: str, sort: str | None = None) -> dict:
    """Dashboard helper: live call first, newest cache on any failure."""
    try:
        path = fetch_and_cache(name, endpoint, search, sort)
        document = json.loads(path.read_text(encoding="utf-8"))
        document["cache_file"] = path.name
        document["served_from"] = "live"
        return document
    except (requests.RequestException, ValueError):
        document = load_latest_cache(name)
        if document is None:
            raise
        document["served_from"] = "cache"
        return document


# Queries used in Phase 1. Names become the cache file names.
CARBOPLATIN_SHORTAGES = ("shortages_carboplatin", "drug/shortages", 'generic_name:"carboplatin"')
ONCOLOGY_SHORTAGES = ("shortages_oncology", "drug/shortages", 'therapeutic_category:"Oncology"')
CARBOPLATIN_NDC = ("ndc_carboplatin", "drug/ndc", 'generic_name:"carboplatin"')

# Recall history window: 10 years up to the retrieval date.
RECALL_WINDOW = "recall_initiation_date:[20161114 TO 20261114]"

# One recall search per finished-dose carboplatin labeler in the NDC cache (Phase 1, 14 Nov 2026).
# Search terms are the distinctive part of each labeler name. "AuroMedics" is the former US name
# of Eugia US LLC and "Sicor" is a Teva injectables entity; both are ASSUMED aliases that the
# Phase 3 manual match check must confirm or reject. Bulk-ingredient (API) labelers are excluded
# because they do not sell finished carboplatin injection to a hospital buyer.
CARBOPLATIN_FIRM_RECALL_SEARCHES = {
    "AVYXA Pharma": 'recalling_firm:"Avyxa"',
    "Accord Healthcare": 'recalling_firm:"Accord Healthcare"',
    "Apotex": 'recalling_firm:"Apotex"',
    "BPI Labs": 'recalling_firm:"BPI Labs"',
    "Eugia US": 'recalling_firm:"Eugia"',
    "AuroMedics (former Eugia US name)": 'recalling_firm:"AuroMedics"',
    "Fresenius Kabi USA": 'recalling_firm:"Fresenius Kabi"',
    "Gland Pharma": 'recalling_firm:"Gland Pharma"',
    "Hospira": 'recalling_firm:"Hospira"',
    "Natco Pharma": 'recalling_firm:"Natco"',
    "Teva": 'recalling_firm:"Teva"',
    "Sicor (Teva entity)": 'recalling_firm:"Sicor"',
    "Teyro Labs": 'recalling_firm:"Teyro"',
}


if __name__ == "__main__":
    for query_name, query_endpoint, query_search in (CARBOPLATIN_SHORTAGES, ONCOLOGY_SHORTAGES, CARBOPLATIN_NDC):
        saved = fetch_and_cache(query_name, query_endpoint, query_search)
        cached = load_latest_cache(query_name)
        print(f"{query_name}: total reported {cached['total_reported']}, saved {cached['records_saved']} -> {saved.name}")

    windowed = {firm: f"{search} AND {RECALL_WINDOW}" for firm, search in CARBOPLATIN_FIRM_RECALL_SEARCHES.items()}
    saved = fetch_many_and_cache("recalls_carboplatin_firms", "drug/enforcement", windowed)
    cached = load_latest_cache("recalls_carboplatin_firms")
    for firm, block in cached["queries"].items():
        print(f"recalls {firm}: total reported {block['total_reported']}, saved {block['records_saved']}")
    print(f"-> {saved.name}")
