# PharmaShield GCC - NotebookLM Source Pack (7 slides)

Group 3, AI in Operations (Dr. Sandip Kumar Roy), SP Jain School of Global Management, Dubai. Presentation Tue 17 Nov 2026, 9:30 am, 10 minutes plus peer Q&A.

**How to use this file.** Upload this file plus the figure PNGs named below into NotebookLM, then paste the prompt in deck/notebooklm_prompt.md. Every number here comes from a notebook output or a cited source, and the source is given next to it. Do not let any tool round, reword or "improve" a number: see the "Do not change" list at the end.

**GenAI disclosure.**
- Elements marked [GENAI] were drafted with Claude Code (prompt log entry 5, docs/prompt_log.md) and must be circled on the slides with a red dashed outline. Footnote: "Circled = GenAI-generated; prompts in the Prompt Log".
- Figures are produced by our notebook code, which was written with GenAI assistance; they are marked [GENAI-ASSISTED CODE].
- The team owns the AHP judgements, the KPI targets and the final headline wording (Phase 0 fix F11). Rewriting a headline in your own words removes its [GENAI] mark.

**Framing rules (overrides from 15 Nov 2026).**
- The client is a hypothetical UAE GPO.
- openFDA is US data.
- Say "reduce" stock-outs, never "eliminate".
- Say "11 qualified makers", never "18 labelers".
- The order split is a MILP.
- Carboplatin is Tier 1 oncology and is not a cold-chain product.
- Fairness: "plant- and lane-level evidence where available, country-level otherwise".

---

## Slide 1 - The 2026 GCC chokepoint problem and the 25-day gap (Member 1, Q7 context)

**Headline [GENAI]:** When Hormuz closes, a GCC hospital buyer has days, not 25, to find a safe second supplier of chemotherapy.

**Bullets [GENAI]**
- The GCC pharmaceutical market (23.7 billion USD) relies on imports for roughly 80% of its medicines. Supply moves through two corridors that were disrupted in 2026: the Strait of Hormuz and Gulf airspace. Hormuz transits fell by over 90%.
- Replacing a failed supplier takes 25 days on average, and 74% of firms face shortages during that window.
- Carboplatin injection, a life-critical chemotherapy, has 29 current US shortage records. 8 of its 11 qualified makers are affected.
- Across US oncology there are 84 current shortage records covering 8 drugs.

**Exact numbers and sources**

| Number | Source |
|---|---|
| 23.7 billion USD market; about 80% imported | Think Global Health / CFR, Mar 2026 (as cited in the team master plan, section 1.2; team to confirm the link, Phase 0 fix F10) |
| Hormuz transits down over 90% | Khaleej Times, Apr 2026 (cited in the master plan; confirm link) |
| 25 days to onboard a replacement supplier; 74% face shortages in the transition | Ivalua survey via Supply Chain Dive, Jul 2026, n = 800 (cited in the master plan; confirm link) |
| 29 current carboplatin shortage records (35 in total) | openFDA Drug Shortages, cached 14 Nov 2026: web/data/shortages_cache.json; notebook 02 cell "shortage records" |
| 8 of 11 qualified makers with a current shortage | data/processed/scoring_panel_carboplatin.csv, column active_fda_shortage; notebook 02 section 4.2 |
| 84 current US oncology shortage records covering 8 drugs | web/data/meta.json, oncology_shortages (openFDA, 14 Nov 2026) |

**Figure:** docs/screenshots/01_overview.png (live app hero and KPI tiles) [GENAI-ASSISTED CODE].

**Speaker notes (about 80 seconds) [GENAI]**
Imagine you are the chief procurement officer of a UAE hospital buying group in 2026. About 80% of your medicines are imported, and the two routes they travel, the Strait of Hormuz and Gulf airspace, were both disrupted this year. Hormuz traffic fell by more than 90%. Now one of your oncology suppliers fails. Industry data says it takes 25 days on average to qualify and onboard a replacement, and three quarters of companies run short while they wait. For a chemotherapy drug like carboplatin, 25 days means missed treatment cycles. This is not hypothetical for carboplatin: the US FDA feed lists 29 current shortage records for it, touching 8 of the 11 companies allowed to sell it. Today procurement still picks suppliers mostly on price, once a year, with manual checks. Our proposal, PharmaShield GCC, is a decision cockpit that keeps a ranked, pre-qualified bench of suppliers for every critical drug. It tells the buyer how to split each order before the crisis hits.

**Key questions answered:** context for Q7 (resilience).

---

## Slide 2 - Five risk dimensions from seven real data feeds (Members 2A and 2B, Q2)

**Headline [GENAI]:** We fuse seven public feeds into one risk profile per maker, and we only rank companies that can actually sell the drug.

**Bullets [GENAI]**
- Five criteria per maker, all scored 0 to 1 with lower being better:
  - C1 landed cost.
  - C2 delivery risk (XGBoost).
  - C3 price integrity (Isolation Forest).
  - C4 compliance (FDA inspections, recalls, NLP of citations, active shortage).
  - C5 route exposure (Hormuz and Gulf air share x World Bank LPI).
- Qualification filter: 18 US carboplatin labelers are listed, but 7 sell only bulk powder. That leaves 11 qualified finished-injection makers.
- Entity resolution maps labeler to plant owner to parent (Eugia to Aurobindo, Hospira to Pfizer, Accord to Intas). Two-test fuzzy matching stopped 7 false name matches that the plan's single threshold would have accepted.
- Three-layer data honesty:
  - Training: 10,324 real SCMS shipments, 2006-2015.
  - Scoring: real 2026 makers.
  - Scenario: labelled assumptions.
  - Only 2 of 11 makers appear in SCMS after parent mapping, so we score from features, not names.

**Exact numbers and sources**

| Number | Source |
|---|---|
| 10,324 SCMS lines, 33 columns | notebook 01, section 2 |
| 18 labelers, 7 bulk-only, 11 qualified | notebook 02, section 3.1 |
| 78 candidate name pairs, 25 accepted, 7 false matches stopped | notebook 02, section 3.3; data/processed/fda_match_table.csv |
| 286 FDA inspections linked | notebook 02, section 3.3 |
| 2 of 11 makers with SCMS history (Eugia via Aurobindo, 3,283 lines; Gland, 2 lines) | notebook 02, section 3.4 |
| Data feeds: SCMS, openFDA NDC, openFDA Shortages, openFDA Recalls, FDA Data Dashboard inspections and citations, Medicaid SDUD 2025, World Bank LPI 2023 | docs/README.md, section 3 |

**Figure:** docs/screenshots/03_supplier_drawer.png (one maker's fused profile in the live app) or figures/fig_06_panel_evidence_heatmap.png [GENAI-ASSISTED CODE].

**Speaker notes (about 80 seconds) [GENAI]**
A supplier score is only as good as its data, so we built it from seven public feeds. Training uses 10,324 real pharmaceutical shipments from USAID. The 2026 makers come from the US FDA drug directory, shortage feed and recall feed, plus FDA inspection and citation records, Medicaid prices and the World Bank logistics index. The first lesson came from the data itself. The FDA directory lists 18 carboplatin labelers, but 7 of them sell only bulk powder to other factories. A hospital cannot buy from them, so we rank 11 makers. The second lesson was names. The company on the label is often not the plant: Eugia belongs to Aurobindo, and Hospira belongs to Pfizer. We built a reviewed map from labeler to plant owner to parent and used fuzzy matching with two tests. The single threshold in our original plan would have blamed Accord for inspections of seven unrelated firms. Finally, honesty about overlap: only 2 of the 11 makers appear in the shipment history, so our model scores every maker from its plant, lane and freight profile, not from its name.

**Key questions answered:** Q2 (data sources and fusion); supports Q1.

---

## Slide 3 - Hybrid TOPSIS ranking and the MILP order split, Normal vs Crisis (Member 3, Q1 and Q5)

**Headline [GENAI]:** The board sets priorities once; in a crisis, one click moves the sea volume around the Strait in milliseconds.

**Bullets [GENAI]**
- Weights are 50% board judgement and 50% data. AHP consistency ratios are 0.0040 (Normal), 0.0008 (Crisis) and 0.0022 (Cost focus), all below 0.10. Entropy is applied only to real data (C1, C2, C4).
- Final Normal weights: cost 0.137, delivery 0.318, price integrity 0.050, compliance 0.234, route 0.261. Crisis raises route exposure to 0.314.
- The MILP (PuLP + CBC, binary supplier selection) splits 10,000 vials: Teva 70% primary, Hospira 15% warm backup, AVYXA 15% probation trial, for 1,672,430 USD a month. Tier 1 guardrails: probation at most 15% with the backup at least as large, cost counted once, and a compliance gate (C4 above 0.80) barring Accord, Eugia and Fresenius Kabi.
- One click on Crisis keeps the suppliers and changes the route plan: 1,000 Hormuz-bound sea vials land at Fujairah or Khor Fakkan, so Hormuz sea share falls from 10.0% to 0.0% for 3,000 USD a month and 3 extra days. Gulf air share stays 85.0%: the exposure to watch.
- Crisis lambda 2.0, because a stock-out costs more than the price premium. The split changes only at lambda 0.06 and is stable up to 5; Teva stays the top established maker in 98.3% of 1,000 weight shocks.

**Exact numbers and sources**

| Number | Source |
|---|---|
| CR 0.0040 / 0.0008 / 0.0022 | notebook 04, section 4.1; web/data/weights_<mode>.json, cr |
| Final weights (Normal 0.137, 0.318, 0.050, 0.234, 0.261; Crisis C5 0.314) | notebook 04, section 4.2; web/data/weights_normal.json and weights_crisis.json, final_weights |
| Supplier split in every mode 7,000 / 1,500 / 1,500 vials (Teva, Hospira, AVYXA) | notebook 04, section 4.4; outputs/lp_allocation_carboplatin_normal.csv |
| 1,672,430 USD per month (supply) | web/data/allocations_normal.json, kpis.purchase_cost_usd |
| Hormuz sea share 10.0% to 0.0%; Gulf air share 85.0%; 1,000 vials rerouted; 3,000 USD a month; 3 extra days | notebook 04, section 4.4 KPI table; web/data/allocations_crisis.json, kpis; assumption A36 |
| Lambda at which the split changes: 0.06 (Normal), 0.05 (Crisis) | notebook 04, section 4.5 lambda scan; web/data/suppliers.json, lambda_switches |
| Mode lambdas 1.0 / 2.0 / 0.5; compliance gate C4 above 0.80; Tier 1 backup rule | docs/assumptions.md A34, A35, A37; decisions D21-D24, D31-D33 |
| 98.3% robustness (983 of 1,000) | notebook 04, section 5; web/data/model_metrics.json, robustness |
| Demand 10,000 vials and capacities are assumptions | docs/assumptions.md A11, A27, A28 |

**Figure:** docs/screenshots/05_scenario_crisis.png (live app, Crisis profile) with figures/fig_15_lambda_sensitivity.png as backup [GENAI-ASSISTED CODE]. Label "Demand and capacities: assumptions A11, A27-A28".

**Speaker notes (about 80 seconds) [GENAI]**
Machine learning tells us the risk; the board must decide how much each risk matters. The board compares criteria in pairs once per mode with AHP, blended 50-50 with entropy weights from real data. TOPSIS then ranks the 11 makers on how close each is to the ideal supplier. The ranking becomes an order through a mixed-integer linear program. Binary variables pick the suppliers under Tier 1 rules: dual sourcing, a 70% cap on the primary, a capped trial for new makers, and a compliance gate that keeps the three worst FDA records out of the main roles. For 10,000 vials a month it recommends Teva 70%, Hospira 15% as warm backup and a 15% trial with AVYXA, for 1.67 million dollars; the backup always covers at least the trial. In a Hormuz crisis the buyer clicks Crisis. The suppliers stay, and the sea volume that would cross the Strait lands at Fujairah or Khor Fakkan instead: Hormuz sea share goes from 10% to zero for 3,000 dollars a month. Air freight through Gulf airspace stays at 85%, and that is the risk the board must watch.

**Key questions answered:** Q1 (evaluate and select), Q5 (multi-criteria decision-making).

---

## Slide 4 - Predicting late deliveries and billing outliers before they hit (Member 4A, Q3)

**Headline [GENAI]:** Our delivery model catches 72% of late shipments with half the false alarms of a standard model.

**Bullets [GENAI]**
- XGBoost was trained on shipments scheduled up to 2013 and tested on 2014-2015, which it never saw. ROC-AUC is 0.716 against 0.627 for a logistic regression baseline.
- When both models flag the same 40.9% of lines, XGBoost catches 71.9% of late shipments and the baseline 47.2%. XGBoost raises 784 false alarms; the baseline raises 1,590.
- SHAP explains every score. The strongest drivers are plant history, freight ratio and weight. Eugia's parent sites were late 13.7% of the time, which lifts its risk to 9.19%; US-made supply scores 1.59%.
- The Isolation Forest flags 475 of 9,207 invoice lines (5.16%). Example: a line whose freight was 2.36 times its value, against a group median of 0.33.

**Exact numbers and sources**

| Number | Source |
|---|---|
| Train 7,779 lines (to 2013), test 2,545 lines (2014-2015), 13.99% late | notebook 03, section 2 |
| ROC-AUC 0.716 vs 0.627; PR-AUC 0.277 vs 0.211 | notebook 03, section 4.1; web/data/model_metrics.json, c2.models |
| Recall 71.9% vs 47.2% at equal flag share 40.9% | same |
| 784 vs 1,590 false alarms; 256 vs 304 late lines caught | web/data/model_metrics.json, c2.confusion_matrices |
| scale_pos_weight 8.372 (class imbalance) | notebook 03, section 3.2 |
| SHAP drivers: site history 0.444, freight ratio 0.377, weight 0.290 | web/data/shap.json, global_importance |
| C2 Eugia 9.19%, US-made makers 1.59% | notebook 03, section 4.2; data/processed/model_outputs_carboplatin.csv |
| 475 of 9,207 lines flagged (5.16%); 36 product groups | notebook 03, section 4.3; web/data/model_metrics.json, c3 |
| Anomaly: HIV test kit line, China 2012, freight 2.36 x value vs group median 0.33 | web/data/model_metrics.json, c3.examples[0] |

**Figure:** figures/fig_07_c2_roc_confusion.png and figures/fig_08_c2_shap_drivers.png [GENAI-ASSISTED CODE]; optional figures/fig_09_c3_iforest_scatter.png.

**Speaker notes (about 80 seconds) [GENAI]**
Can AI predict a supplier disruption? We trained XGBoost on real shipments up to 2013 and tested it only on 2014 and 2015. That is a fair test, because the late rate actually rose from 10.7 to 14% between the two periods. Late shipments are rare, about one in nine, so we reweighted them; otherwise a model can look 86% accurate by always saying "on time". XGBoost reaches an ROC-AUC of 0.716 against 0.627 for a standard logistic model. In business terms, if both models raise the same number of alerts, ours catches 72% of late shipments and the baseline 47%. SHAP tells the buyer why: plant history, freight profile and consignment weight. For example, Eugia's parent plants were late 13.7% of the time, which is why its risk is the highest at 9%. For fraud and billing errors we use an Isolation Forest, which needs no labelled fraud cases. It flagged 5% of invoice lines, such as a test-kit order whose freight bill was more than twice the value of the goods.

**Key questions answered:** Q3 (predict disruptions or fraud).

---

## Slide 5 - NLP that reads FDA findings and supply contracts (Member 4B, Q4)

**Headline [GENAI]:** NLP turns 40,473 FDA inspection findings into a compliance signal and flags the contract clause that would let a supplier walk away in a crisis.

**Bullets [GENAI]**
- Corpus: 40,473 FDA drug-manufacturing citations (21 CFR 211), reduced to 3,176 unique texts. Weak labels come from the cited legal section; the CFR number is removed from the text.
- TF-IDF plus logistic regression reaches macro F1 0.987, against 0.657 for keyword rules. An honest hand-check found the labels match a human reading in 10 of 12 samples (about 83%), so tags guide an auditor; they are not verdicts.
- 94 citations are linked to the makers. Eugia has 27, 11 of them about sterility and contamination, the most serious class for an injectable.
- The clause extractor, run on 3 synthetic contracts, scores clause risk from 0.00 to 1.00. Contract B lets the supplier stop delivering when a strait or airspace closes, with no duty to reroute.

**Exact numbers and sources**

| Number | Source |
|---|---|
| 40,473 citations, 3,176 unique texts | notebook 03, sections 2 and 3.3 |
| Macro F1 0.987 vs 0.657 | notebook 03, section 4.4; web/data/model_metrics.json, nlp |
| Hand-check 10 of 12 (about 83%) | notebook 03, hand-check table after section 4.4 |
| 94 citations linked; Eugia 27 (11 sterility and contamination) | notebook 03, section 4.5; web/data/nlp_letters.json |
| Contract risk A 0.00, B 1.00, C 0.05 | notebook 03, section 4.6; web/data/contract_clauses.json |

**Figure:** figures/fig_10_nlp_classes_confusion.png [GENAI-ASSISTED CODE]. Show the contract table from the app's Model Evidence page with the "SYNTHETIC [GENAI]" badge visible.

**Speaker notes (about 80 seconds) [GENAI]**
Most supplier risk is written down, in inspection reports and in contracts, and nobody has time to read it all. We trained an NLP classifier on the FDA's public inspection findings: 40,473 drug-manufacturing citations. Each citation names the regulation it breaks, and we used that as a label, removing the regulation number from the text so the model has to read the words. It sorts findings into data integrity, sterility, process validation, quality unit and other issues. The F1 score is 0.987, against 0.657 for keyword rules. But we checked by hand, and the labels agree with a human reading only about 83% of the time. So we present the tags as pointers for a quality auditor, not as verdicts. Applied to our makers, it shows that 11 of Eugia's 27 recent findings are about sterility, which is what matters for an injectable. On contracts, our extractor reads clauses for lead time, penalties and force majeure. On a synthetic example, it flags a clause that lets the supplier stop delivering if a strait closes, exactly when the GPO needs it most.

**Key questions answered:** Q4 (NLP for documents and contracts).

---

## Slide 6 - Human in the loop, UAE compliance and a 30-second live demo (Member 5, Q6 and Q7)

**Headline [GENAI]:** The AI recommends; a category manager decides, and every decision is logged.

**Bullets [GENAI]**
- No order is sent automatically. The buyer approves or overrides; an override needs a reason and shares that sum to 100%. Every entry stores the time, mode, final weights and allocation, and can be downloaded as CSV.
- Every score shows its top 3 SHAP reasons. Missing evidence is treated as neutral, never as clean or guilty. Fairness: plant- and lane-level evidence where available, country-level otherwise.
- New makers get a fair route in: 6 probation candidates, a 5-15% trial, at most 2 per order, and only if they pass the safety gate (no OAI and no Class I recall in 3 years). 5 of 6 pass. Established makers with a compliance score above 0.80 cannot be primary or backup.
- UAE PDPL (Federal Decree-Law 45 of 2021) data minimisation: the log stores business decisions, not personal contact data. The live dashboard shows the openFDA alert feed and falls back to a dated cache.

**Exact numbers and sources**

| Number | Source |
|---|---|
| 6 probation candidates, 5 pass the gate | notebook 02, section 4.4 |
| 5 incumbents hold 98.3% of 2025 Medicaid units | notebook 02, section 4.4 (assumption A23) |
| Trial 5-15%, at most 2 per order | notebook 04, section 4.4; assumptions A29, A13 |
| Neutral evidence: AVYXA C4 0.200 becomes 0.468 | notebook 04, section 3; assumption A31 |

**Figure:** live demo in Boardroom mode (docs/demo_script.md, 30 seconds), with the backup video ready. Static fallback: docs/screenshots/10_boardroom.png and docs/screenshots/08_approval.png [GENAI-ASSISTED CODE].

**Speaker notes (about 80 seconds) [GENAI]**
An AI that picks suppliers raises three questions: who decides, is it fair, and is it lawful? Who decides: a human. PharmaShield never sends an order. The category manager sees the recommended split and approves it or overrides it. An override needs a written reason, and every decision is logged with its weights and allocation. Is it fair: every score shows its top three reasons, so a supplier can be challenged. Missing data is treated as neutral, so a maker is never punished or rewarded for being unknown. We use plant and lane evidence where we have it, and country-level evidence only where we do not. New makers get a structured path in: a capped 5 to 15% trial, but only after passing a safety gate. Is it lawful: the log holds business decisions only, in line with the UAE data protection law. Let me show you in 30 seconds. Here is the scorecard. I click Crisis, and the order moves off the exposed lane. Then I approve, and the decision is logged.

**Key questions answered:** Q6 (ethics and compliance), Q7 (transparency and resilience).

---

## Slide 7 - The 90-day pilot, KPIs and the ask (Member 1)

**Headline [GENAI]:** A 90-day pilot on 5 Tier 1 oncology drugs to reduce stock-out risk with a pre-qualified bench of suppliers.

**Bullets [GENAI]**
- Days 1-30: connect the GPO's ERP delivery data and Tatmeen scan timestamps, and retrain the delivery model on our own lanes. Days 31-60: run the cockpit in shadow mode next to current buying. Days 61-90: live approvals for carboplatin plus 4 more Tier 1 SKUs.
- Pilot KPIs (team targets, assumption A17):
  - 100% dual-source coverage on pilot SKUs (today's carboplatin split already has it).
  - A pre-qualified backup bench for every pilot SKU (carboplatin today: 5 gate-passing probation makers).
  - On-time-in-full delivery tracked monthly.
  - The false-alarm rate of delivery alerts tracked monthly.
- Trade-off: the risk-balanced split costs 195,049 USD a month (13.2%) more than single-sourcing Teva, the cheapest maker that passes the compliance gate, which breaks Tier 1 rules. In a crisis, the east-coast reroute adds 3,000 USD a month and takes sea volume out of the Strait.
- The ask: approve the 90-day pilot, a data-sharing agreement for ERP and Tatmeen data, and one category manager as product owner.

**Exact numbers and sources**

| Number | Source |
|---|---|
| 195,049 USD (13.2%) premium over all-Teva | notebook 04, section 4.4 (KPI table and reference line) |
| 3,000 USD a month east-coast reroute premium in Crisis | notebook 04, section 4.4; assumption A36 |
| 5 gate-passing probation makers | notebook 02, section 4.4 |
| Pilot scope, phases and KPI targets | team targets (assumption A17), not sourced figures |

**Figure:** simple 90-day timeline (draw in PowerPoint; team-made, no GenAI mark needed if drawn by the team).

**Speaker notes (about 80 seconds) [GENAI]**
We are not asking for a big-bang system. We are asking for 90 days. In the first month we connect the GPO's own delivery records and Tatmeen scan data, and retrain the delivery model on our real lanes instead of the historical proxy. In the second month the cockpit runs in shadow mode next to today's buying, so we can compare its alerts with what actually happens. In the third month buyers use it for live approvals on carboplatin and four more critical oncology drugs. We will judge it on four measures: dual-source coverage on every pilot drug, a pre-qualified backup bench for each one, on-time-in-full delivery, and the false-alarm rate of our alerts. We are transparent about cost. Resilience costs about 13% more than buying everything from the cheapest compliant maker, a split our own Tier 1 rules forbid. In a crisis, 3,000 dollars a month moves the sea volume around the Strait. That is the insurance premium. The aim is to reduce stock-outs, not to promise they disappear. We ask for approval of the pilot, a data-sharing agreement, and one category manager to own it.

**Key questions answered:** Q7 (resilience), roadmap; closes Q1-Q6.

---

## Do not change (exact values and wording)

- "11 qualified makers" (never 18). "7 bulk-ingredient labelers excluded".
- "84 current US oncology shortage records covering 8 drugs".
- "29 current carboplatin shortage records; 8 of 11 makers affected".
- ROC-AUC 0.716 vs 0.627; recall 71.9% vs 47.2% at equal flag share; false alarms 784 vs 1,590.
- Isolation Forest: 475 of 9,207 lines (5.16%).
- NLP: macro F1 0.987 vs 0.657; hand-check about 83% (10 of 12).
- AHP CR 0.0040 / 0.0008 / 0.0022. Final Normal weights 0.137 / 0.318 / 0.050 / 0.234 / 0.261.
- Supplier split in every mode: Teva 7,000 (70%), Hospira 1,500 (15%), AVYXA 1,500 (15%); 1,672,430 USD a month.
- Crisis route plan: Hormuz sea share 10.0% to 0.0%, Gulf air share 85.0%, 1,000 vials rerouted, 3,000 USD a month, 3 extra days (A36).
- Lambda: Normal 1.0, Crisis 2.0, Cost 0.5; split changes only at lambda 0.06 (Normal) and 0.05 (Crisis).
- Tier 1 backup rule: probation at most 15%, backup at least the probation total (A37).
- Compliance gate: C4 above 0.80 (Accord, Eugia, Fresenius Kabi) cannot be primary or backup.
- Robustness 98.3% (983 of 1,000).
- "MILP" (mixed-integer linear program), not "LP".
- "Reduce stock-outs", never "eliminate".
- "Plant- and lane-level evidence where available, country-level otherwise".
- Carboplatin is never called cold-chain.
- Every assumption keeps its label (A-number) on the slide where it is used.
- No long dashes anywhere; use short hyphens.
