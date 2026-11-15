# Progress Log - PharmaShield GCC

One short report per phase: what was built, key numbers, issues, self-check. All numbers come from notebook outputs or files in web/data.

## Phase 2 - Notebook 01: SCMS cleaning and features (15 Nov 2026)

- **Built:** pipeline/notebooks/01_scms_eda_cleaning.ipynb (builder pipeline/builders/build_01.py), pipeline/reference/site_country_map.csv (88 sites: 72 explicit, 16 inferred), data/processed/scms_clean.csv, site_features.csv, figures fig_01 to fig_03.
- **Key numbers:**
  - 10,324 lines kept, 0 dropped; 1,186 late (11.49%).
  - Train to 2013: 7,779 lines, 10.7% late. Test 2014-2015: 2,545 lines, 14.0% late.
  - Freight usable on 96.5% of lines (was 60.0%) after resolving 2,445 "See other line" references.
  - PO-sent date unusable on 55.5% of lines, so it was dropped.
  - India makes 69% of lines and is late 14.5% of the time.
- **Issues:** one site name had a Unicode variant (Weifa, Oslo), fixed in the map. Feature list reduced to the override 2 set in Phase 4 (decision D2).
- **Self-check:** runs top to bottom; no placeholders; markdown before and after each section; business interpretation after each output; shapes printed; plots labelled with source notes; no long dashes.

## Phase 3 - Notebook 02: 2026 scoring panel (15 Nov 2026)

- **Built:** 02_scoring_panel_2026.ipynb; maker_entity_map.csv (reviewed), route_mix_assumptions.csv; data/processed/scoring_panel_carboplatin.csv, fda_match_table.csv, fda_matched_inspections.csv; fig_05, fig_06.
- **Key numbers:**
  - 18 labelers listed, 7 bulk-only, so 11 qualified.
  - 78 fuzzy candidates: 25 accepted, 7 false matches stopped by the distinctive-name test; 286 inspections linked.
  - SCMS overlap after parent mapping: 2 of 11 makers.
  - Landed cost from 122.38 USD (Accord) to 329.88 USD (Apotex) per vial; 5 makers have imputed prices.
  - 8 of 11 makers have a current US shortage record.
  - 5 incumbents hold 98.3% of 2025 Medicaid units; 6 probation candidates, 5 of which pass the trial gate.
- **Issues:** the plan's single fuzzy threshold produced false matches, so a second test was added (D3). The shortage file revealed contract-manufacturing links (BPI Labs made by Gland; Natco and Apotex products listed under Teyro Labs).
- **Self-check:** passed (same checklist as Phase 2).

## Phase 4 - Notebook 03: risk engines (15 Nov 2026)

- **Built:** 03_risk_models_xgb_iforest_nlp.ipynb; synthetic contracts [GENAI] in pipeline/reference/synthetic_contracts; model_outputs_carboplatin.csv, model_metrics.json, shap_summary.json, iforest_anomalies.json, nlp_summary.json, contract_clauses.json; fig_07 to fig_11.
- **Key numbers:**
  - XGBoost test ROC-AUC 0.716 vs 0.627 for the logistic baseline. Recall 71.9% at a 40.9% flag rate; the baseline gets 47.2% at the same flag rate.
  - C2 ranges from 1.59% (US-made) to 9.19% (Eugia).
  - Isolation Forest flags 475 of 9,207 lines (5.16%); Eugia 4.64%.
  - NLP macro F1 0.987 vs 0.657 for keyword rules; a 12-sample hand-check found 83% label agreement.
  - Contract risk scores: A 0.00, B 1.00, C 0.05.
- **Issues:** insurance ratio removed from C2 (D2). Contract extractor bug fixed: it read "no obligation to use alternative routes" as mitigation.
- **Self-check:** passed.

## Phase 5 - Notebook 04: decision engine (15 Nov 2026)

- **Built:** 04_mcdm_topsis_milp.ipynb; src/mcdm.py (AHP, entropy, TOPSIS, MILP), src/export.py; suppliers_matrix.csv (16 locked + 9 extra columns); outputs/topsis_ranking_*.csv and lp_allocation_*.csv for 3 modes; 16 JSON files in web/data; fig_12 to fig_15.
- **Key numbers:**
  - AHP CR 0.0040 / 0.0008 / 0.0022.
  - Final Normal weights: C1 0.137, C2 0.318, C3 0.050, C4 0.234, C5 0.261.
  - MILP split 70/25/5 (Teva, Accord, AVYXA) in all modes at lambda 1.0; cost 1,435,069 USD a month.
  - In Crisis at lambda 1.5, India-made share goes from 25% to 0% for +8.7% cost.
  - Teva stays top established maker in 98.3% of 1,000 weight perturbations.
- **Issues:** missing evidence made AVYXA look cleanest. Fixed with the neutral-evidence rule (A31, D10).
- **Self-check:** passed.

## Phase 6 - run_all.py and contract validation (15 Nov 2026)

- **Built:** pipeline/run_all.py (executes notebooks 01 to 04 headless in order, then validates), pipeline/validate_contract.py (types plus business rules: 11 makers, criteria in [0, 1], 3 SHAP reasons, weights sum to 1, CR < 0.10, ranks 1 to 11, vials sum to demand, MILP Optimal, at most 2 probation suppliers, contracts flagged synthetic).
- **Key numbers:** 16 JSON files validated.
- **Self-check:** passed; the full re-run is repeated in Phase 10.

## Phase 7 - Next.js dashboard (15 Nov 2026)

- **Built:** web/ (Next.js 15 App Router, TypeScript, Tailwind, Plotly via react-plotly.js with dynamic import and ssr false).
  - Six pages: Overview, Supplier Scorecard, Scenario & Order Split, Live Alerts, Model Evidence, Approval & Audit.
  - API routes: /api/shortages (live openFDA, 5-second timeout, hourly revalidation, cached fallback with date) and /api/audit (Upstash Redis REST when configured, otherwise "local demo log").
  - lib/engine.ts ports entropy, blending, TOPSIS and the MILP (javascript-lp-solver, binary variables). lib/live.ts runs a parity check at load and falls back to the precomputed Python results if it fails.
  - The footer text is on every page.
- **Key numbers:**
  - 14 parity tests pass: weights within 1e-9, TOPSIS within 1e-6, allocations exact at every lambda in the sensitivity table.
  - Lint and type-check are clean. Production build first-load JS is 105-128 kB per page.
- **Issues:**
  - The parity tests found a solver tie at lambda 0 (four makers share the same imputed price), fixed with a tie-break in both engines (D18).
  - javascript-lp-solver imports Node built-ins, so a webpack fallback was added.
  - npm replaced the node_modules junction, so build folders stay in the project (D19).
  - The baseline ROC-AUC showed as 0.626 in the app against 0.627 in the notebook. Metrics are now exported unrounded.
- **Self-check:** passed. The Lighthouse result is in Phase 10.

## Phase 8 - Deployment preparation (15 Nov 2026)

- **Built:** git repository (branch main; data/raw, *.xlsx, node_modules and .next ignored; largest tracked file 3.6 MB), web/.vercelignore, .claude/launch.json for local preview.
- **Waiting on Sam:** GitHub and Vercel sign-in (no CLI or credentials are available to the build assistant), then creation of the Upstash audit store. Exact steps are in the final report.

## Phase 9 - Deliverables (15 Nov 2026)

- **Built:**
  - deck/notebooklm_source_pack.md (7 slides with headline, bullets, exact numbers with sources, figure, about 80-second notes, key questions, [GENAI] markers, "Do not change" list).
  - deck/notebooklm_prompt.md.
  - deck/speaker_script.md (generated from the source pack; 165-185 words a slide).
  - deck/qa_prep.md (the plan's 9 questions updated for the overrides, plus 9 new ones).
  - deck/peer_questions.md (2 each for Groups 1, 2 and 4).
  - docs/demo_script.md (30-second click path and backup video checklist).
- **Self-check:** no long dashes; every slide number traced in docs/number_trace.md.

## Phase 10 - Final validation (15 Nov 2026, 01:05 Dubai time)

- pipeline/run_all.py re-ran notebooks 01 to 04 headless with no errors (4 s, 56 s, 41 s, 6 s) and validated all 16 JSON files. Generated files were overwritten in place; a bulk delete before the run was blocked by a safety check and was not done.
- pipeline/check_numbers.py: 60 of 60 computed slide numbers PASS (docs/number_trace.md). The 3 external figures on slide 1 are cited sources the team must confirm (F10).
- Web: 14 of 14 parity tests pass; type-check and lint are clean; the production build passes.
- Lighthouse desktop (local production build):
  - Performance 100 (Overview), 99 (Scorecard), 100 (Scenario), 99 (Evidence).
  - Accessibility 96 to 100; best practices 96.
- Scans: no long dashes in any .md, .py, .ts, .tsx, .json, .csv, .txt or .ipynb file; no ellipsis in any notebook output; no TODO or placeholder text.
- **Open items:** Vercel and GitHub sign-in, live-URL verification, Upstash audit store, backup video, team names, and the professor's answer on the title slide (F18).

## Phase 8 (continued) - Live deployment (15 Nov 2026, about 01:25 Dubai time)

- **Live URL:** https://pharmashield-gcc.vercel.app (Vercel project pharmashield-gcc, deployed with Vercel CLI 65.9.0 from web/).
- **Issues:**
  - Vercel CLI 39 uses a login flow that Vercel retired in February 2026, so we moved to CLI 65.9.0 (device-code login).
  - PowerShell blocks npx.ps1 on this laptop; npx.cmd works without changing the execution policy.
  - Vercel refused the first build because Next.js 15.1.6 has known vulnerabilities. We upgraded to Next.js 15.5.28, React 19.0.9 and eslint-config-next 15.5.28 (D20). After the upgrade, the 14 parity tests, type-check, lint and build all passed again.
- **Verified on the live URL:**
  - All 6 pages load with the footer and no console errors.
  - The Scenario page shows the parity badge "verified". Crisis at lambda 1.5 gives USD 1,559,745, India-made 0% and expected late shipments 1.59%, matching notebook 04.
  - Live Alerts serves the openFDA feed (35 records, 29 current, 8 of 11 makers).
  - The Approval page shows "No order is sent automatically" and the local demo log. /api/audit reports configured false until the Upstash store is added.
- **Still open:**
  - Upstash Redis audit store, then a redeploy.
  - GitHub push (repo URL needed).
  - Backup video recording.

## Phase 8 (continued) - Audit store and GitHub (15 Nov 2026, about 01:40 Dubai time)

- **Audit store:** Upstash for Redis store `pharmashield-audit` created through the Vercel Marketplace.
  - Free plan, auto-upgrade off, so it cannot start billing.
  - Region iad1, connected to Production and Preview.
  - After redeploying, the live /api/audit reports configured true. A test approval made on the live Approval page was stored and read back with the 70/25/5 allocation, and the page shows "Shared audit store".
  - Two test entries with approver "BUILD TEST" remain in the log as evidence of the check.
- **GitHub:** public repo https://github.com/samuelalex3737/pharmashield-gcc created.
  - The local history was folded into one clean commit before the first push.
  - Not published: raw data, *.xlsx, .env files and the lecture-slide screenshots (instructor material).
- **UX fix:** on narrow screens the two-line navigation bar no longer sticks to the top, because it covered form fields. It stays sticky on desktop.
- **GitHub push:** done. The GitHub CLI was authorized through a device code and the repo is public on branch main. A check of the remote tree found 154 entries and none matching screenshots, .env, .xlsx or data/raw.

## Second-review fixes (15 Nov 2026)

- **Fix 1, mode profiles:** Normal lambda 1.0, Crisis 2.0, Cost focus 0.5 (A35). The reviewer's Crisis 1.5 gave the same split as Normal, so Crisis uses 2.0 (D22).
  - Normal: Teva 7,000, AVYXA 1,500, Hospira 1,000, Gland 500; USD 1,648,949; India-made 5%.
  - Crisis: Teva 7,000, Hospira 1,500, AVYXA 1,500; USD 1,672,430 (+1.4%); India-made 0%.
- **Fix 2, cost counted once:** the MILP uses S_risk (TOPSIS on C2-C5, weights renormalised; D23), in Python and TypeScript.
- **Fix 3, compliance gate:** C4 above 0.80 (A34) blocks Accord, Eugia and Fresenius Kabi from primary or backup. A fallback with a red flag applies when no alternative exists, and the parity tests cover it (D24).
- **Fix 4, scorecard clarity:** "Est. rank" column, the "Probation - capped at trial share (5-15%)" label, the "Gated" badge, and a Scenario sentence explaining the small probation share (D25).
- **Fix 5, admin clear:** DELETE /api/audit protected by AUDIT_ADMIN_KEY (Vercel secret, plus the git-ignored web/.env.local). It returns 401 for a wrong key. The 2 BUILD TEST entries were cleared, and the live log is empty (D26).
- **Checks:**
  - run_all.py clean; contract validation passed (new rules: S_risk present, gate respected, lambda matches the profile, Normal differs from Crisis).
  - Number trace 64 of 64 PASS.
  - 20 of 20 parity tests pass; type-check and lint are clean; the build passes.
  - Redeployed and verified on the live URL.
- **Updated:** source pack (slides 3, 6, 7 and the "Do not change" list), speaker script (regenerated, 165-190 words a slide), Q&A prep (questions 4, 9, 10, 11, 15 and new 19, 20), demo script, assumptions A12, A34, A35, decisions D21-D26.

## Phase 11 - Design and interactivity (15 Nov 2026)

- **Built:**
  - Design system: Inter, navy and teal tokens, light and dark themes, KPI tiles with deltas and source chips, badges, glossary tooltips, skeletons, empty states, Framer Motion.
  - Overview redesign: hero, 4 KPI tiles with sources, interactive 5-layer pipeline, "Start boardroom demo".
  - Disruption simulator (hero demo).
  - Custom weights.
  - Supplier drill-down drawer.
  - Supplier comparison.
  - Route map.
  - Boardroom mode: 6 steps, arrow keys, Esc to exit.
  - Board decision memo: printable A4, linked from approvals.
  - Command palette (Ctrl+K).
  - 10 screenshots in docs/screenshots.
- **Cut:** nothing. All 8 features from the brief are built.
- **Checks:**
  - 20 of 20 parity tests pass; lint and type-check are clean; production build passes.
  - First-load JS is 103-172 kB per page, under the 200 kB budget.
  - No horizontal scroll at 375 px on any page.
  - WCAG AA contrast passes in both themes.
- **Lighthouse desktop on the live URL:**
  - Performance 99-100 on all 8 pages (Overview 99; Scorecard, Scenario, Alerts, Evidence, Approval, Memo, Boardroom 100).
  - Accessibility 100 and best practices 100 on all 8.
- **Verified on the live URL (Normal and Crisis):**
  - Normal: 1,648,949 USD.
  - Crisis: 1,672,430 USD.
  - Teva failure in Crisis: 1,761,473 USD, with the gate relaxed for Fresenius Kabi.
  - Command palette jump to a maker, theme toggle, memo.
- **Docs:** demo_script.md now uses Boardroom mode; the source pack figure list uses the screenshots; prompt log entries 6-14; decisions D27-D30.

## Third-review fixes (15 Nov 2026)

- **Fix 1, route exposure split:**
  - Route exposure is now reported as Hormuz sea share and Gulf air share (plus east-coast sea) in the data, KPI tiles, memo, route map and Boardroom mode.
  - East-coast reroute assumption A36: Fujairah or Khor Fakkan, 3.00 USD per vial, 3 extra days, applied in Crisis mode.
  - Normal: Hormuz sea 10.0%, Gulf air 85.0%.
  - Crisis: Hormuz sea 0.0% (1,000 vials rerouted for 3,000 USD a month), Gulf air 85.0%.
- **Fix 2, Tier 1 backup rule (A37):** probation at most 15%, backup at least the probation total. Added to the Python and TypeScript MILP, validate_contract.py and the parity tests (now 22).
  - New split in every mode: Teva 7,000, Hospira 1,500, AVYXA 1,500; 1,672,430 USD a month.
  - Normal and Crisis now differ in the route plan, not the supplier split (D32).
- **Fix 3, A35 justification:** "a crisis doubles the price of risk because a stock-out costs more than the price premium", plus a fine lambda scan. The split changes at lambda 0.06 (Normal) and 0.05 (Crisis) and is stable from there up to 5 (D33).
- **Updated:** source pack (slides 3 and 7, "Do not change" list), speaker script (165-187 words a slide), Q&A prep (questions 4, 9, 11 and new 21, 22), demo script, assumptions A35-A37, decisions D31-D33, number trace, screenshots.
- **Also fixed:** the board memo date is now set in the browser (D34). Live check: Normal and Crisis values match notebook 04. Lighthouse desktop gives 100 for performance, accessibility and best practices on all 8 pages. 10 screenshots were recaptured from the live URL.
