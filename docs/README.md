# PharmaShield GCC - AI for Pharma Supplier Selection and Risk

Group 3, AI in Operations (Dr. Sandip Kumar Roy), SP Jain School of Global Management, Dubai, MAIB.
Presentation: Tue 17 Nov 2026, 9:30 am. Blackboard submission: 11:59 pm the same day.

Live app: https://pharmashield-gcc.vercel.app  
Code: https://github.com/samuelalex3737/pharmashield-gcc (public; raw data and course lecture screenshots are not included)

PharmaShield GCC is a minimum viable product pitched to the C-suite of a hypothetical UAE healthcare group purchasing organisation (GPO). It is not a real company. It scores every qualified maker of a critical drug on five risk criteria, ranks them with TOPSIS, and recommends an order split with a backup supplier. A human buyer approves every recommendation.

Demo SKU: carboplatin injection (Tier 1, injectable oncology). It is not a cold-chain product.

---

## 1. Folder map

| Folder | Contents |
|---|---|
| data/raw/ | Source files exactly as downloaded or returned by an API. Never edited, never committed. File names carry the retrieval date (YYYYMMDD). |
| data/processed/ | Cleaned tables written by the notebooks, including suppliers_matrix.csv (locked schema). |
| pipeline/notebooks/ | 01 SCMS cleaning, 02 2026 scoring panel, 03 risk models, 04 decision engine (AHP, entropy, TOPSIS, MILP) and JSON export. Run in order. |
| pipeline/builders/ | Plain-Python sources of the four notebooks (cells and business interpretations). Run a builder to regenerate and execute its notebook. |
| pipeline/src/ | Shared code: common.py (paths, plot style), mcdm.py (AHP, entropy, TOPSIS, MILP), export.py (web JSON). |
| pipeline/reference/ | Reviewed reference tables: site-to-country map, maker entity map, route-mix assumptions, synthetic contracts [GENAI]. |
| pipeline/run_all.py, validate_contract.py, check_numbers.py | One-command re-run, JSON contract checks, number trace for the deck. |
| app/ | Data clients used in Phase 1 (openFDA, Medicaid) and the pinned Python requirements. |
| web/ | Next.js dashboard deployed on Vercel. Reads web/data/*.json exported by notebook 04. |
| figures/ | Static charts exported by the notebooks (fig_NN_name.png). |
| outputs/ | TOPSIS rankings and MILP allocations per SKU and mode. |
| deck/ | NotebookLM source pack and prompt, speaker script, Q&A prep, peer questions. |
| docs/ | This README, assumptions register, decision log, progress log, number trace, demo script, GenAI prompt log. |

## 2. Environment setup (Windows, PowerShell)

The virtual environment lives outside OneDrive. OneDrive tries to sync thousands of package files, which locks files and slows installs.

```
py -3.11 -m venv C:\venvs\pharmashield
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
C:\venvs\pharmashield\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r app\requirements.txt
python -m ipykernel install --user --name pharmashield --display-name "PharmaShield (3.11)"
```

If pip stalls on a large download (it did on 14 Nov 2026: this network hangs on IPv6 connections to the PyPI CDN), download the wheels over IPv4 with `curl -4`, check each SHA-256 against PyPI, and install offline:

```
pip install --no-index --find-links C:\venvs\wheels -r app\requirements.txt
```

`app/requirements-lock.txt` records the exact version of all 142 installed packages, including dependencies.

Smoke test (must print `ok`):

```
python -c "import pandas, xgboost, shap, sklearn, pulp, rapidfuzz, streamlit, plotly; print('ok')"
```

Note on Windows Smart App Control: on this project's main laptop it is switched on, and it blocked one compiled file in pandas 3.1.1 in the system Python. The pinned versions in requirements.txt were chosen to avoid that. Tested on 14 Nov 2026: all 20 core packages import, XGBoost trains, SHAP explains and the PuLP CBC solver returns Optimal, with Smart App Control on. If an import is still blocked, do not change security settings without deciding consciously. Run the project in WSL2 instead, or turn Smart App Control off yourself after reading the Windows warning.

## 3. Data sources and how each one was obtained

| # | Source | File in data/raw/ | How obtained | Used for |
|---|---|---|---|---|
| 1 | USAID SCMS Delivery History (Kaggle "Supply Chain Shipment Pricing Data", upload by divyeshardeshana) | scms_shipment_pricing.csv | Downloaded 14 Nov 2026 from Kaggle's public dataset endpoint (https://www.kaggle.com/api/v1/datasets/download/divyeshardeshana/supply-chain-shipment-pricing-data), unzipped, file SCMS_Delivery_History_Dataset.csv renamed. 10,324 rows x 33 columns, UTF-8 with byte-order mark. The original USAID portal (data.usaid.gov) no longer resolves. | Training layer: C2 delivery model, C3 anomaly model, supplier behaviour features |
| 2 | openFDA Drug Shortages, carboplatin | openfda_shortages_carboplatin_YYYYMMDD.json | app/openfda_client.py | Shortage status per maker (C4 input), live alerts |
| 3 | openFDA Drug Shortages, oncology category | openfda_shortages_oncology_YYYYMMDD.json | app/openfda_client.py | Context for slide 1 and the alerts page |
| 4 | openFDA NDC Directory, carboplatin | openfda_ndc_carboplatin_YYYYMMDD.json | app/openfda_client.py | Qualification filter: who is authorised to sell finished carboplatin injection |
| 5 | openFDA Drug Enforcement (recalls), per carboplatin firm, last 10 years | openfda_recalls_carboplatin_firms_YYYYMMDD.json | app/openfda_client.py | C4 recall class input |
| 6 | Medicaid State Drug Utilization Data 2025, carboplatin, national totals | medicaid_sdud2025_carboplatin_YYYYMMDD.json | app/fetch_medicaid_sdud.py | C1 price per unit by labeler (proxy, see assumptions) |
| 7 | World Bank Logistics Performance Index, 2023 edition (stored by the API under year 2022) | worldbank_lpi2023edition_YYYYMMDD.json | World Bank API, indicator LP.LPI.OVRL.XQ | C5 route exposure, (1 - LPI/5) term |
| 8 | FDA Data Dashboard, inspections (NAI/VAI/OAI) | fda_dashboard_inspections_YYYYMMDD.xlsx | "Entire Inspections Dataset" export, 14 Nov 2026, no filters. 345,856 rows x 15 columns (FEI Number, Legal Name, City, State, Zip, Country/Area, Fiscal Year, Inspection ID, Posted Citations, Inspection End Date, Classification, Project Area, Product Type, Additional Details, FMD-145 Date). Dates are Excel serial numbers. | C4 inspection outcome |
| 9 | FDA Data Dashboard, inspection citations (Form 483 text with CFR references) | fda_dashboard_citations_YYYYMMDD.xlsx | "Entire Citations Dataset" export, 14 Nov 2026, no filters. 283,360 rows x 8 columns (Inspection ID, FEI Number, Legal Name, Inspection End Date, Program Area, Act/CFR Number, Short Description, Long Description). | NLP corpus for C4 severity (Q4); CFR section gives the training label |

openFDA caveat: openFDA data is not validated for clinical or production use. We use it only as a supplier-risk signal, never for medical claims.

To refresh the API caches (writes new dated files, old ones are kept):

```
python app\openfda_client.py
python app\fetch_medicaid_sdud.py
```

## 4. How to re-download the manual sources

The files in data/raw were obtained on 14 Nov 2026 as described in section 3. Use these steps only to refresh them.

### 4.1 SCMS shipment data (Kaggle)

Quickest route (no sign-in needed for this public dataset): open https://www.kaggle.com/api/v1/datasets/download/divyeshardeshana/supply-chain-shipment-pricing-data, unzip, rename the CSV to `scms_shipment_pricing.csv`. Or through the website:


1. Sign in at kaggle.com.
2. Search for the dataset titled "Supply Chain Shipment Pricing Data" (USAID SCMS delivery history, about 10,300 rows).
3. Click Download. Unzip.
4. Copy the CSV (named `SCMS_Delivery_History_Dataset.csv` or similar) into `data/raw/`.
5. Rename it to `scms_shipment_pricing.csv`. Do not open and re-save it in Excel; Excel changes date formats.

### 4.2 FDA Data Dashboard: inspections and citations

1. Open https://datadashboard.fda.gov/oii/cd/inspections.htm in a browser.
2. Do not set any filters. Click "Clear All" on the black selection bar if any filter is shown.
3. Click "Download Dataset" (top menu). Choose "Entire Inspections Dataset". The file is InspectionsDataset.xlsx.
4. Click "Download Dataset" again. Choose "Entire Citations Dataset". The file is CitationsDataset.xlsx.
5. Move both files into `data/raw/` and rename them with today's date:
   - `fda_dashboard_inspections_YYYYMMDD.xlsx`
   - `fda_dashboard_citations_YYYYMMDD.xlsx`
6. The dashboard is updated weekly and includes final actions only. Record the download date; it goes on slide 2 as the data cut-off.

Note: the dashboard builds each export on its server and hands the browser a temporary link that only works inside the same browser session. A plain command-line download of that link is redirected and returns nothing. Download from the browser.

Why the entire datasets and not filtered ones: firm names in FDA data are spelled many ways. Filtering on the website would silently drop spellings. Notebook 02 does the matching in code with rapidfuzz and shows a match table for manual checking.

## 5. Run order

Python pipeline (about 3 minutes):

```
C:envs\pharmashield\Scripts\python.exe pipeline
un_all.py
C:envs\pharmashield\Scripts\python.exe pipeline\check_numbers.py
```

run_all.py executes notebooks 01 to 04 headless with the "PharmaShield (3.11)" kernel, re-exports web/data, and validates every JSON file. check_numbers.py rewrites docs/number_trace.md. random_state = 42 everywhere.

Web app (Node 20 or later):

```
cd web
npm install
npm test
npm run lint
npm run typecheck
npm run build
npm start
```

npm test runs the parity tests (TypeScript engine against the Python outputs).

Deployment: live at https://pharmashield-gcc.vercel.app (Vercel project pharmashield-gcc, deployed from `web` with `npx.cmd -y vercel@65.9.0 deploy --prod`; on this laptop PowerShell blocks npx.ps1, so use npx.cmd). Optional audit store: an Upstash Redis database from the Vercel Marketplace, which sets UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL and KV_REST_API_TOKEN). Without it, the Approval page keeps a local demo log in the browser.

## 6. Governance

- Every assumption is listed in docs/assumptions.md and labelled on the slides.
- Every GenAI prompt is logged in docs/prompt_log.md. GenAI-generated slide elements are marked [GENAI] in deck/slides_content.md and circled on the slides.
