# GenAI Prompt Log - Group 3, PharmaShield GCC

Course: AI in Operations (Dr. Sandip Kumar Roy), SP Jain School of Global Management, Dubai, MAIB.
Purpose: the professor's rule says GenAI-generated content must be circled on the slides and the prompts shared separately. This log is that separate record. It is submitted on Blackboard with the deck.

How to read this log:
- One entry per prompt given to a GenAI tool.
- "Exact prompt" is copied verbatim.
- "Output produced" says what the tool created.
- "Where used" says which file, notebook cell, dashboard page or slide uses it. Anything marked [GENAI] in deck/slides_content.md traces back to an entry here.

---

## Entry 1

| Field | Value |
|---|---|
| Date | 14 Nov 2026 |
| Phase | Phase 0 - Audit and setup plan (no code) |
| Team member | Sam |
| Tool | Claude Code (Anthropic, model Claude Opus 5.5), desktop app |
| Output produced | (1) Phase 0 audit report in chat: 10-line project summary, ranked list of gaps and risks in the implementation plan with fixes, manual setup steps, time estimate per phase. (2) This prompt log file. |
| Where used | Internal planning only. The audit decisions shape all later notebooks, the dashboard and the deck. No Phase 0 text goes onto a slide. |

### Exact prompt

````text
# MASTERS-LEVEL ASSESSED GROUP PROJECT - FULL-MARKS TARGET
SP Jain School of Global Management, Dubai | MAIB | AI in Operations (Dr. Sandip Kumar Roy)
Group 3: AI for Supplier Selection & Risk Management
Presentation: Tue 17 Nov 2026, 9:30 am (10 min + peer Q&A) | BB submission: 11:59 pm same day
This work is graded. Treat every output as submission-grade.

You are my technical lead and build partner. I am Sam. We build this project end to end, in phases, with a hard stop after each phase.

---------------------------------------------------------------------
## 0. SOURCE OF TRUTH - READ FIRST
---------------------------------------------------------------------
Files in this folder:
1. "Group 3 Implementation Plan - AI for Pharma Supplier Selection & Risk (GCC).docx" - the agreed plan. Follow it. If you disagree with something, flag it; do not silently change it.
2. "Screenshot 2026-11-13 112046.png" - the brief (scope, 7-slide PPT limit, boardroom framing to C-suite: business model shifts, tech investment, ecosystem integration, operational risks).
3. "Screenshot 2026-11-13 112106.png" - the rubric (10 marks: Content Quality, Application of Techniques, Presentation Skills, Team Collaboration) + GenAI rule: GenAI content must be circled on slides and prompts shared separately.
4. "Screenshot 2026-11-13 112119.png" - Group 3's 7 key questions (Q1 to Q7). Every one must be answered visibly.

Note: the plan's diagrams may not have survived the .docx export. The pipeline is also described in text and tables (sections "Proposed AI solution", "Technical pipeline", "Unit of analysis", "Drug criticality tiers", "Feature dictionary"). Rebuild the logic from those.

---------------------------------------------------------------------
## 1. PROJECT SUMMARY (must match the plan)
---------------------------------------------------------------------
"PharmaShield GCC": an AI supplier-risk and selection MVP pitched to the C-suite of a hypothetical UAE healthcare group purchasing organisation (GPO). Our team pitches; the professor and class play the board. Do not present the client as any real company.

Data layers:
- Training layer: USAID SCMS Delivery History (Kaggle "Supply Chain Shipment Pricing Data", 2006-2015) teaches how suppliers behave.
- Scoring layer: real 2026 manufacturers from openFDA (drug shortages + NDC directory), plus FDA inspections (NAI/VAI/OAI) and recalls.
- Scenario layer: Hormuz / Gulf-airspace route exposure, clearly labelled as an assumption.

Pipeline, everything rolled up to MANUFACTURER x SKU:
- C1 Landed cost (price + freight + insurance per unit)
- C2 Delivery risk = XGBoost P(late), volume-weighted, SHAP explained; probation suppliers get the category average
- C3 Price integrity = share of line items flagged by Isolation Forest
- C4 Compliance risk = 0 to 1 severity from NLP on FDA warning letters + OAI + recall class
- C5 Route exposure = share on Hormuz sea / Gulf air lanes x (1 - LPI/5)
Then: qualification filter (only makers authorised for the molecule and form), drug criticality tier (1 life-critical, 2 essential, 3 routine), weights = 50% AHP (team role-plays the GPO expert panel) + 50% entropy, TOPSIS ranking per SKU, PuLP order split (70-80% cap per maker, 5-10% trial share for probation suppliers, capacity as a hard constraint), and a Streamlit dashboard with one-click Normal / Crisis / Cost focus modes.

Demo SKU: carboplatin injection (Tier 1 oncology). It is NOT cold-chain; never call it that.

---------------------------------------------------------------------
## 2. RUBRIC-TO-TECHNIQUE MAPPING (every artefact must trace to this)
---------------------------------------------------------------------
| Rubric criterion | How we earn 85-100% | Where it shows |
|---|---|---|
| Content Quality | Real 2026 GCC crisis, cited evidence, all 7 key questions answered | Slides 1-7, notebook conclusions |
| Application of Techniques | ML (XGBoost+SHAP), anomaly detection (Isolation Forest), NLP, MCDM (AHP, entropy, TOPSIS), optimisation (LP), all on real data | Notebooks 03-04, dashboard |
| Presentation Skills | One message per slide, live/recorded demo, clear board ask | Deck content, speaker script |
| Team Collaboration | One owner per workstream, everyone presents | Contribution table in appendix |

Key-question coverage: Q1 and Q5 = TOPSIS + weights; Q2 = feature dictionary and data fusion; Q3 = XGBoost + Isolation Forest; Q4 = NLP; Q6 = ethics, PDPL, human approval, probation fairness; Q7 = dashboard, alerts, dual sourcing.

---------------------------------------------------------------------
## 3. NON-NEGOTIABLE RULES
---------------------------------------------------------------------
Notebooks:
- A markdown cell before AND after every section. Zero placeholders, TODOs, "..." or skeleton code.
- Structure for every notebook: Objective, EDA, Preprocessing, Modelling/Method, Evaluation, Conclusion (recommendation + future improvements).
- Label every task explicitly with the plan's build step number (e.g. "Build step 4 - Predict disruption (Q3)").
- Print shape before and after every preprocessing step.
- Justify every decision with actual numbers from the data (no "we chose X because it is common").
- After every output block, add a plain-English "Business interpretation" markdown cell written for a C-suite reader.
- All plots fully labelled (title, axis labels with units, legend, source note).

Data integrity:
- Never invent numbers. Every figure on a slide must come from notebook output or a cited source.
- Verify the real SCMS column names after loading. The plan lists them from memory.
- Cache every openFDA response to data/raw/ with the retrieval date in the filename. openFDA is unvalidated data; never use it for medical claims.
- Label every assumption as an assumption, in code comments and on slides (route exposure, AHP judgements, KPI targets).
- random_state = 42 everywhere. Time-based train/test split for XGBoost (train to 2013, test 2014-2015). Check class balance and handle imbalance explicitly.

Visualisation discipline:
- Notebooks: matplotlib and seaborn only (static, export-safe).
- Streamlit app: Plotly only (interactive).

Writing style:
- Never use long dashes in any output. Use short hyphens only.
- Plain business English. Short sentences.

GenAI disclosure (professor's rule):
- Maintain docs/prompt_log.md from now on: date, phase, the exact prompt I gave, what you produced, where it is used. Log THIS prompt as entry 1.
- In the deck content, mark every GenAI-generated element as [GENAI] so we can circle it on the slides.

---------------------------------------------------------------------
## 4. FILE AND FOLDER CONVENTIONS
---------------------------------------------------------------------
Group 3 project/
  data/raw/            scms_shipment_pricing.csv, openfda_*_YYYYMMDD.json
  data/processed/      scms_clean.csv, scoring_panel_carboplatin.csv, criteria_matrix_carboplatin.csv
  notebooks/           01_scms_eda_cleaning.ipynb
                       02_scoring_panel_2026.ipynb
                       03_risk_models_xgb_iforest_nlp.ipynb
                       04_mcdm_topsis_lp.ipynb
  app/                 app.py (+ pages/ if needed), requirements.txt
  figures/             fig_01_<name>.png, fig_02_<name>.png ...
  outputs/             topsis_ranking_<sku>_<mode>.csv, lp_allocation_<sku>_<mode>.csv
  deck/                slides_content.md, speaker_script.md, qa_prep.md, peer_questions.md
  docs/                prompt_log.md, assumptions.md, README.md

---------------------------------------------------------------------
## 5. PHASED WORKFLOW
---------------------------------------------------------------------
Each phase ends with: what was built, key numbers, anything that failed, the self-check result, then:
⛔ STOP. ⏸ Wait for my reply. Continue only when I write "✅ Phase N approved".

PHASE 0 - Audit and setup plan (NO CODE)
- Read all 4 files. Give me: (a) a 10-line summary proving you understood the project; (b) every gap, contradiction or risk in the plan, ranked by severity, each with a concrete fix; (c) the exact manual steps I must do (Kaggle download, Python version, packages, virtual environment; recommend keeping the venv outside OneDrive); (d) time estimate per phase against the deadline.
⛔ ⏸

PHASE 1 - Environment and data acquisition (build steps 1 and 3, data part)
- requirements.txt, folder scaffold, README.
- Load SCMS, print real columns, confirm against the plan's feature dictionary.
- Pull and cache openFDA: carboplatin shortages, carboplatin NDC labelers, recalls for those firms. Note what FDA inspection data must be downloaded manually from the FDA Data Dashboard, and give me exact steps.
⛔ ⏸

PHASE 2 - Notebook 01: SCMS EDA, cleaning, features (build steps 1-2)
⛔ ⏸

PHASE 3 - Notebook 02: 2026 scoring panel for carboplatin (build step 3)
- Qualification filter, fuzzy matching with rapidfuzz (show match table for manual checking), C4 inputs, C5 assumptions.
⛔ ⏸

PHASE 4 - Notebook 03: XGBoost + SHAP vs logistic baseline, Isolation Forest, warning-letter NLP (build steps 4-6)
- Report ROC-AUC, recall, confusion matrix, top SHAP drivers. Show 3 flagged anomalies. Show NLP class distribution and a severity score per firm.
⛔ ⏸

PHASE 5 - Notebook 04: aggregation to manufacturer x SKU, criticality tier, AHP (with consistency ratio) + entropy weights, TOPSIS, PuLP allocation, Normal vs Crisis comparison (build steps 7-8)
⛔ ⏸

PHASE 6 - Streamlit dashboard (build step 9)
- Pages: Supplier scorecard, Live alerts (openFDA with cached fallback), Scenario (one-click modes), Contract analyser (optional, cut first if short on time).
⛔ ⏸

PHASE 7 - Deck content, speaker script, Q&A prep, peer questions for Groups 1, 2 and 4
- 7 slides exactly as in the plan's "7-slide deck plan" section, with [GENAI] markers and slide-level citations.
⛔ ⏸

PHASE 8 - Validation (build step 10)
- Re-run every notebook top to bottom, cross-check every slide number against outputs, finalise prompt_log.md and assumptions.md.
⛔ ⏸

---------------------------------------------------------------------
## 6. SELF-CHECK BEFORE DELIVERING ANY PHASE
---------------------------------------------------------------------
[ ] Runs top to bottom with no errors
[ ] No placeholders, TODOs or skeleton code
[ ] Markdown before/after every section; business interpretation after every output
[ ] Every number traceable to code output or a cited source
[ ] Assumptions labelled
[ ] Plots fully labelled; correct library for notebook vs app
[ ] Mapped to rubric criterion and key question(s)
[ ] No long dashes anywhere
[ ] prompt_log.md updated

Start with PHASE 0 now.
````

---

## Entry 2

| Field | Value |
|---|---|
| Date | 14 Nov 2026 |
| Phase | Phase 1 - Environment and data acquisition (build steps 1 and 3, data part) |
| Team member | Sam |
| Tool | Claude Code (Anthropic, model Claude Opus 5.5), desktop app |
| Output produced | Folder scaffold; app/requirements.txt (pinned versions); app/openfda_client.py (openFDA client with dated cache and live-or-cache fallback for the dashboard); app/fetch_medicaid_sdud.py (C1 price proxy); cached raw data in data/raw/ (openFDA carboplatin shortages, oncology shortages, carboplatin NDC labelers, recalls for 11 finished-dose firms plus 2 aliases, Medicaid SDUD 2025 carboplatin, World Bank LPI 2023 edition); docs/README.md (setup, sources, manual download steps); docs/assumptions.md (assumptions register A1 to A18). |
| Where used | Data acquisition for notebooks 01 to 04; openfda_client.py is reused by the dashboard Live alerts page; README and assumptions register go into the submission pack. |

### Exact prompt

````text
✅ Phase 0 approved
````

---

## Entry 3

| Field | Value |
|---|---|
| Date | 14 Nov 2026 |
| Phase | Phase 1 - Environment and data acquisition (continued) |
| Team member | Sam |
| Tool | Claude Code (Anthropic, model Claude Opus 5.5), desktop app, including its built-in browser |
| Output produced | Downloaded the three sources first listed as manual steps: SCMS CSV from Kaggle's public dataset endpoint; FDA Data Dashboard "Entire Inspections Dataset" and "Entire Citations Dataset" exports. Verified file integrity, row and column counts, and the SCMS columns against the plan's feature dictionary. Restarted a stalled package install. Updated docs/README.md and docs/assumptions.md (A19, A20). |
| Where used | data/raw inputs for notebooks 01 to 04. |

### Exact prompt

````text
i want you to do it
````

---

## Entry 4

| Field | Value |
|---|---|
| Date | 14 Nov 2026 |
| Phase | Phase 1 - Environment and data acquisition (close-out) |
| Team member | Sam |
| Tool | Claude Code (Anthropic, model Claude Opus 5.5), desktop app |
| Output produced | Completed the Python 3.11 environment at C:\venvs\pharmashield (142 packages downloaded over IPv4, SHA-256 checked against PyPI, installed offline); Smart App Control import and compute test passed; Jupyter kernel "PharmaShield (3.11)" registered; app/requirements-lock.txt written; every data file re-read with pandas to confirm shapes; README updated; Phase 1 report delivered in chat. |
| Where used | Environment for all notebooks and the dashboard; Phase 1 report (internal). |

### Exact prompt

````text
ok, finish the install and send the phase 1 report
````

---

## Entry 5

| Field | Value |
|---|---|
| Date | 15 Nov 2026 |
| Phase | Phases 2 to 10 - autonomous build to completion (mode change) |
| Team member | Sam |
| Tool | Claude Code (Anthropic, model Claude Opus 5.5), desktop app |
| Output produced | Read the master plan PDF; built notebooks 01 to 04 and pipeline/src modules; exported web/data JSON; built the Next.js dashboard with parity tests; deployment files; deck source pack, speaker script, Q&A prep, peer questions, demo script; docs/decisions.md, docs/progress.md, docs/number_trace.md. |
| Where used | Entire project from Phase 2 onward. |

### Exact prompt

````text
i have provided the pdf at: "C:\Users\samue\OneDrive\Desktop\AI-Operations\Group 3 project\PharmaShield GCC Master Implementation Plan.pdf"

✅ Phase 1 approved. New instructions for the rest of the project - read fully before continuing.

# MODE CHANGE: AUTONOMOUS BUILD TO COMPLETION
I am now building the WHOLE project myself (all 5 layers), and the web app will be deployed on VERCEL instead of Streamlit.
Do NOT wait for my approval between phases. Work continuously through every phase below, make the best decision at each fork, log it, and keep going until everything is done, tested and deployed.
Stop ONLY for things you cannot do yourself: logins or credentials (Vercel, GitHub), creating paid or cloud resources, or anything destructive outside this project folder. When you need me, batch every request into one message with exact steps, then continue with whatever does not depend on it.
Hard deadline: MVP frozen by Sun 15 Nov 2026, 11:59 pm Dubai time. Presentation Tue 17 Nov, 9:30 am.

# SOURCES OF TRUTH (in priority order)
1. The OVERRIDES section of this message (wins over everything).
2. PharmaShield_GCC_Master_Implementation_Plan.pdf (new, in the project root) - the team's master spec: formulas C1-C5, locked schema for suppliers_matrix.csv, TOPSIS/LP spec, tiers, governance, 7-slide plan, Q&A matrix. Read it fully now.
3. Your Phase 1 findings and docs/assumptions.md (A1-A20).
4. The earlier .docx plan and the 3 brief screenshots.
Where the PDF and Phase 1 facts conflict, Phase 1 facts win (e.g. 11 finished-injection makers, not 18). Log every such correction in docs/assumptions.md and docs/decisions.md.

# OVERRIDES (fix these flaws in the PDF)
1. Qualification filter: only finished-injection, human prescription listings (dosage form injection, not bulk ingredient). Use 11 makers everywhere; never write "18 labelers". Cipla and Hetero are bulk-only: remove them from any scoring-panel claim.
2. SCMS "Country" is the DESTINATION. Parse the manufacturing country from "Manufacturing Site" and train C2 on origin country, shipment mode, freight-to-value ratio, weight (Kilograms) and site priors. Drop the PO-sent lead-time feature (over half missing).
3. Entity resolution must map subsidiaries to parents (e.g. Eugia -> Aurobindo, Hospira -> Pfizer, Sicor -> Teva), using a reviewed mapping table, before matching to SCMS/FDA. Report the real overlap count.
4. Probation: define it with a labelled scenario (e.g. the GPO's current incumbents = N established makers, chosen and justified from the data; everyone else = probation candidates), not "fewer than 5 SCMS shipments". At most 2 probation suppliers per order.
5. The order split uses binary selection variables, so it is a MILP (PuLP + CBC). Say "MILP" in code, notebook and slides. Set lambda explicitly (default 1.0) and include a sensitivity table. Demand (10,000 vials) and capacities are assumptions in assumptions.md.
6. C1: makers without a Medicaid price are imputed; flag them (c1_imputed column) and show the flag in the app.
7. Entropy: compute only on data-derived columns (C2, C4, and C1 for non-imputed makers); guard all-zero/constant columns. If you think a different entropy treatment is better, justify it with numbers in the notebook.
8. C3: compute where real SCMS line items exist after parent mapping; for others, label "no invoice history" (not a silent 0.0) and explain how TOPSIS treats it.
9. Show FINAL blended weights (not just the AHP half) for every mode.
10. Fairness wording: "plant- and lane-level evidence where available, country-level otherwise" - do not claim "never by country".
11. Claims: openFDA is US data ("84 current US oncology shortage records covering 8 drugs"); "reduce" not "eliminate" stock-outs; do not claim 80% of GCC drugs come from FDA-inspected sites.
12. WGI: either use it in C5 with a stated formula or remove it from the inventory. Decide and log.

# ARCHITECTURE (Vercel-compatible)
- pipeline/ (Python, local): notebooks 01-04 + src/ modules do all ML and OR. Final step exports compact JSON to web/data/: suppliers.json, rankings_{normal,crisis,cost}.json, allocations_{mode}.json, weights_{mode}.json, shap.json, nlp_letters.json, contract_clauses.json, model_metrics.json, shortages_cache.json, meta.json (run timestamp, data versions).
- web/ (Next.js App Router + TypeScript + Tailwind, deployed on Vercel): reads web/data/*.json. Charts: Plotly via react-plotly.js with dynamic import (ssr false).
- Live recompute in TypeScript: port entropy blending and TOPSIS; port the order split with a JS LP/MILP solver if feasible. Write parity tests (vitest) that load the Python-exported inputs and must match Python outputs (TOPSIS scores within 1e-6, allocations within 1 vial). If parity fails, the UI uses the precomputed Python outputs for the 3 modes and the live path is disabled.
- /api/shortages route: live openFDA call with 5-second timeout and revalidation; fall back to shortages_cache.json and show "cached on <date>".
- Audit log: Vercel storage (Upstash Redis or Neon Postgres from the Vercel Marketplace) via environment variables. If not configured, fall back to browser localStorage and show a "local demo log" label. Ask me to create the store only when everything else is done.
- Never ship raw data to Vercel or GitHub: data/raw and large files are in .gitignore and .vercelignore. Respect GitHub's 100 MB file limit.
- Footer on every page: "Academic prototype - Group 3, AI in Operations, SP Jain. openFDA data is unvalidated and not for medical decisions. Assumptions labelled."

# APP PAGES (C-suite grade, fast, clean)
1. Overview: the 2026 GCC problem in 3 KPI tiles, and the 5-layer pipeline diagram.
2. Supplier Scorecard (Q1, Q6): ranked table, S score, composite risk, probation badge, c1_imputed flag, active shortage flag, OAI count; per-supplier C1-C5 breakdown and plain-English top-3 SHAP reasons; final weights for the current mode.
3. Scenario & Order Split (Q5, Q7): one-click Normal / Crisis (Hormuz) / Cost focus; rank-change arrows; MILP allocation by role (primary, backup, probation, spot buy); KPI tiles.
4. Live Alerts (Q7): openFDA carboplatin shortages, live or cached.
5. Model Evidence (Q3, Q4): XGBoost vs logistic baseline (ROC-AUC, recall, confusion matrix), top SHAP features, 3 Isolation Forest anomalies, NLP violation classes, contract clause extraction.
6. Approval & Audit (Q6): approve or override (override needs a reason and shares summing to 100%), log with timestamp, mode, final weights and allocation; CSV download; "No order is sent automatically."

# NOTEBOOK RULES (unchanged, non-negotiable)
Markdown before and after every section; Objective, EDA, Preprocessing, Modelling, Evaluation, Conclusion (recommendation + future improvements); build-step labels; print shapes before and after every preprocessing step; decisions justified with real numbers; a "Business interpretation" cell after every output; fully labelled matplotlib/seaborn plots saved to figures/; random_state 42; time-based split (train to 2013, test 2014-2015); explicit class-imbalance handling. No placeholders, TODOs or "...". No long dashes anywhere - short hyphens only. Never invent numbers.

# PHASES (run continuously; after each, append a short report to docs/progress.md: built, key numbers, issues, self-check)
2. Notebook 01: SCMS cleaning and features.
3. Notebook 02: 2026 scoring panel (qualification filter, parent mapping, matching table, C1/C4/C5 inputs, probation scenario).
4. Notebook 03: XGBoost + SHAP vs baseline, Isolation Forest, warning-letter NLP (zero-shot or rule-based labels, hand-check a sample, then TF-IDF + logistic regression), contract clause extraction on synthetic contracts (clearly labelled synthetic; cache outputs).
5. Notebook 04: aggregation to manufacturer x SKU, tiers, AHP (show CR) + entropy, TOPSIS for 3 modes, MILP allocation, lambda sensitivity; export suppliers_matrix.csv (locked schema plus agreed extra columns) and all web/data JSON.
6. pipeline/run_all.py: runs notebooks 01-04 headless and re-exports JSON in one command; validate_contract.py checks every JSON against its schema.
7. Next.js app: all 6 pages, parity tests, lint and type-check clean, Lighthouse performance 90+ on desktop.
8. Deploy: git init, .gitignore and .vercelignore, then ask me once for GitHub/Vercel login; deploy, verify every page on the live URL, then ask me to create the audit-log store and redeploy.
9. Deliverables: deck/notebooklm_source_pack.md (exactly 7 slides: headline, 3-4 bullets, exact numbers with sources, figure file, ~80-second speaker notes, key questions answered, [GENAI] markers, "Do not change" list); deck/notebooklm_prompt.md; deck/speaker_script.md; deck/qa_prep.md (update the PDF's Q&A matrix with the overrides); deck/peer_questions.md (2 questions each for Groups 1, 2 and 4); docs/demo_script.md (30-second click path) and a checklist for recording the backup video.
10. Final validation: re-run run_all.py from scratch, all tests pass, every number in the source pack traced to an output file (docs/number_trace.md), prompt_log.md and assumptions.md complete. Final report: live URL, what is done, what was cut and why, open risks.

# SELF-CHECK BEFORE CLOSING EACH PHASE
Runs clean; no placeholders; every number traceable; assumptions labelled; plots labelled; no long dashes; prompt_log.md updated (log this prompt as the next entry); progress.md updated.

If time gets tight, cut in this order: live TypeScript MILP (keep precomputed), contract clause extraction (keep cached), GHSC-PSM retest, Lighthouse tuning. Never cut notebooks 01-04, TOPSIS, the MILP, the scorecard, scenario or approval pages.

Start Phase 2 now.
````
