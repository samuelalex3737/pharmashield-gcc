INTERP = {
    "eda": "The 11 makers differ a lot in how much evidence stands behind them. Eugia has 7 inspections in 5 years, recalls, 27 citations and 3,283 SCMS lines; AVYXA has no inspection, no citation, no recall and no Medicaid price. A ranking that read missing evidence as a clean record would push the least-known maker to the top, so the next step treats missing evidence as neutral.",
    "criteria": "The neutral-evidence rule changes one maker materially: AVYXA's C4 rises from 0.200 (which would have looked like the cleanest record in the panel) to 0.468, close to the panel middle. Teva Parenteral also has no inspection in 5 years and receives the neutral terms (C4 0.668, driven mainly by 46 Class I/II recalls), and Teyro receives a neutral NLP term because its 2025 inspection has no posted citations yet. Compliance risk is highest for Fresenius Kabi (0.970), Eugia (0.965) and Accord (0.851), and lowest for Teyro (0.268) and Gland (0.284).",
    "tier": "Carboplatin is Tier 1 (life-critical oncology), so the split must use at least 2 established makers, cap the primary at 70% and keep trial volume between 5% and 15%. Capacities are scenario values: 10,000 vials a month for an established maker and 2,000 for a probation maker, cut by 20% when the maker has a current US shortage record. That cut applies to 8 of the 11 makers.",
    "ahp": "All three judgement matrices are consistent: the consistency ratio is 0.0040 (Normal), 0.0008 (Crisis) and 0.0022 (Cost focus), far below the 0.10 limit. The AHP weights land within 0.04 of the plan's targets. The one deliberate gap is Crisis cost: the plan says 0.00, AHP gives 0.048 because a criterion cannot be ignored completely in pairwise comparison (Phase 0 fix F7).",
    "entropy": "Naive entropy over all five columns would give C3 a weight of 0.0009 and C5 0.0131. It would almost delete price integrity and route exposure, not because they do not matter but because one is mostly a neutral fill-in and the other is a scenario assumption. It would also give C1 0.507, inflated by imputed prices and the structural zero of min-max scaling. The data-only version uses observed prices and gives C2 0.501, C4 0.256 and C1 0.243: delivery risk varies most across makers, so it earns the most objective weight.",
    "final_weights": "These are the weights the ranking actually uses, after blending (override 9). In Normal mode: cost 0.137, delivery risk 0.318, price integrity 0.050, compliance 0.234, route exposure 0.261. Crisis mode raises route exposure to 0.314 and lowers cost to 0.102. Cost focus raises cost to 0.180 and lowers route exposure to 0.157. Delivery risk and compliance together carry more than half of the weight in every mode, as a Tier 1 oncology board would expect.",
    "fig12": "The black marks show the AHP-only weights; the bars show the final blend. Blending moves weight from compliance to delivery risk and cost, because delivery risk and price differ more between makers than the compliance scores do. The mode effect on route exposure (0.157 to 0.314) survives the blend.",
    "topsis": "In Normal mode AVYXA ranks first (S 0.829), then Teva (0.810), Hospira (0.764) and Gland (0.744); Eugia is last (0.210), driven by the highest delivery risk and the second-highest compliance risk. The top of the list is mostly probation makers with little evidence, which is exactly why probation makers can only receive a capped trial share. Mode changes move the middle of the list: in Crisis, India-made Accord drops from 8th to 9th; in Cost focus, Gland and Hospira swap. Under AHP-only weights Hospira would rank above Teva in Normal and Crisis mode, so blending in the data mutes the board's preference for Hospira (Phase 0 fix F7). Both versions are exported so the dashboard can show the difference.",
    "fig13": "The left chart shows how little some makers move between modes and how much others do. The right chart explains each Normal-mode position: Eugia's long bar is delivery risk plus compliance, Accord's is compliance, Apotex's is cost. A category manager can see in one glance which weakness would need to be fixed for a maker to move up.",
    "milp": "At lambda 1.0 the MILP finds an optimal split in all three modes: Teva 7,000 vials as primary (70%, the Tier 1 cap), Accord 2,500 as warm backup (25%) and AVYXA 500 as a probation trial (5%). No spot buy is needed. The split is the same in every mode at this lambda because Accord is 17% cheaper per vial than Teva and 24% cheaper than Fresenius Kabi, which outweighs its higher risk at this price of risk.",
    "kpis": "The recommended split costs 1,435,069 USD a month (143.51 USD per vial). That is 211,311 USD (17.3%) more than putting everything on Accord, the cheapest established maker, which would break the Tier 1 rules. The premium buys a primary with lower delivery risk (expected late share 2.31% for the portfolio) and a guaranteed warm backup. In Crisis mode the same split carries a higher route exposure (0.260 against 0.239), which tells the board the portfolio is more exposed than in peacetime even though the volumes have not moved.",
    "fig14": "All three modes produce the same 70/25/5 split at lambda 1.0, which is itself a finding: the recommendation is stable across board priorities at the default price of risk. The next cell shows the lambda value at which a crisis changes the split.",
    "lambda": "Lambda is the real lever. At lambda 0 (price only) the MILP puts Accord as primary (70%) and the India-made share is 75%. At the default lambda 1.0, Teva becomes primary and the India-made share falls to 25%. In Crisis mode, raising lambda to 1.5 replaces India-made Accord with US-made Fresenius Kabi as backup and lifts the AVYXA trial to 15%: India-made share falls from 25% to 0% and expected late share from 2.31% to 1.59%, for 124,676 USD more per month (+8.7%). In Normal mode the same change needs lambda 2.0. In a Hormuz crisis, then, the board needs only a moderate increase in risk appetite to move volume off the more exposed lanes.",
    "fig15": "Cost rises in steps, not smoothly, because the binary choices switch whole suppliers in and out. The India-made share drops to zero at lambda 1.5 in Crisis mode but only at 2.0 in Normal mode. This chart is the board's trade-off: each step to the right buys lower delivery and route risk for a known monthly cost.",
    "robust": "CRITIC, a second objective method, gives C1 0.397, C2 0.268 and C4 0.335 on the six makers with observed prices. It agrees that all three data criteria matter but puts more weight on cost than entropy does. Because objective methods disagree, the board's AHP half anchors the final weights. In the Monte Carlo test, Teva stays the top established maker in 983 of 1,000 random weight changes of up to 20% (98.3%); Hospira takes first place in the other 17. The primary-supplier recommendation is robust.",
    "saved_csv": "The locked-schema table (11 makers, 16 locked columns plus 9 agreed extras) and the per-mode ranking and allocation files are saved. These are the files the team's slides and any spreadsheet checks should cite.",
    "saved_json": "Sixteen JSON files now feed the web app: supplier profiles, weights, rankings and allocations for each mode, model evidence, NLP and contract outputs, the shortage cache and run metadata. Every number on the dashboard is traceable to this run.",
    "conclusion": """**Recommendation for the GPO (carboplatin injection, Tier 1, 10,000 vials a month).**
- Split the order 70/25/5: Teva Parenteral Medicines as primary (7,000 vials), Accord as warm backup (2,500) and AVYXA as a probation trial (500). This costs 1,435,069 USD a month and meets every Tier 1 rule.
- In a Hormuz or Gulf airspace crisis, raise lambda to 1.5. The backup moves from India-made Accord to US-made Fresenius Kabi and the trial to 15%. India-made volume falls from 25% to 0% for 8.7% more cost.
- A human category manager approves every split (dashboard Approval page). No order is sent automatically.

**Why it can be trusted.**
- AHP consistency ratios are below 0.005.
- Entropy is applied only to real data.
- The primary choice survives 98.3% of random weight changes.
- Every imputed or neutral value is flagged.

**Limits.**
- Demand, capacities and the route mix are scenario assumptions (A8, A11, A27, A28).
- Prices are a US Medicaid proxy (A4).
- The ranking's top places include probation makers with thin evidence. The MILP limits their volume, but their scores should be read as provisional.

**Future improvements.**
- Calibrate lambda with the board using past stock-out costs.
- Replace assumed capacities with supplier-confirmed allocations.
- Add a multi-period model that tracks safety stock.
- Re-run monthly as the openFDA and FDA feeds refresh.""",
}

# Review fixes (15 Nov 2026): mode profiles, S_risk in the MILP objective, compliance gate. These texts replace the
# earlier versions of the same keys.
INTERP.update({
    "tier": "Carboplatin is Tier 1 (life-critical oncology), so the split must use at least 2 established makers, cap the primary at 70% and keep trial volume between 5% and 15%. Capacities are scenario values: 10,000 vials a month for an established maker and 2,000 for a probation maker, cut by 20% when the maker has a current US shortage record (8 of 11 makers). The compliance gate (C4 above 0.80, assumption A34) blocks three makers from primary or backup roles: Fresenius Kabi (0.970), Eugia (0.965) and Accord (0.851). That leaves Teva and Hospira as the only established makers eligible for volume.",
    "milp": "Each mode now produces a different decision. Normal (lambda 1.0): Teva 7,000 vials as primary (70%), Hospira 1,000 as warm backup (10%), and two probation trials, AVYXA 1,500 (15%) and Gland 500 (5%). Crisis (lambda 2.0): Teva 7,000, Hospira 1,500 (15%) and AVYXA 1,500; the India-made Gland trial drops out. Cost focus (lambda 0.5) gives the same split as Normal. No spot buy is needed and the compliance gate never had to be relaxed. The two probation trials receive 20% together because their imputed prices (about 189 USD a vial) are below Hospira's (236 USD); the 15% cap per trial maker is what keeps them small.",
    "kpis": "The Normal split costs 1,648,949 USD a month (164.89 USD per vial) with an expected late share of 1.68% and 5% India-made volume. The Crisis split costs 1,672,430 USD (23,481 USD or 1.4% more), cuts the India-made share to 0% and the expected late share to 1.59%, while route exposure rises to 0.240 because Crisis mode stresses every lane. Buying everything from Teva, the cheapest maker that passes the compliance gate, would cost 1,477,380 USD but breaks the Tier 1 rules; the rule-compliant Normal split costs 171,568 USD (11.6%) more. That is the price of dual sourcing plus two qualified trial suppliers.",
    "fig14": "Normal and Cost focus share one split, and Crisis moves volume from the India-made Gland trial to the US-made Hospira backup. The compliance gate is why Accord, the cheapest maker, receives nothing in any mode: its C4 of 0.851 reflects 2 OAI inspections and 101 Class I or II recalls in 5 years.",
    "lambda": "Lambda shows the board where the decision turns. At lambda 0 (price only) the MILP buys from Teva, Hospira and two India-made trials (Gland 15%, Teyro 5%); India-made volume is 20%. From lambda 0.5 to 1.5 the split is Teva 70%, AVYXA 15%, Hospira 10%, Gland 5%. From lambda 2.0 the Gland trial is replaced by more Hospira volume, India-made volume falls to 0%, and expected late shipments fall from 1.68% to 1.59% for 23,481 USD more per month. The review proposed lambda 1.5 for Crisis mode; at 1.5 the Crisis split equals Normal, so the Crisis profile uses 2.0, the first grid value at which the decision changes (decision D22).",
    "fig15": "Cost rises in two steps: a small one when the probation mix changes at lambda 0.5 and a second at lambda 2.0 when the India-made trial is replaced. The right chart shows the India-made share falling from 20% at lambda 0 to 5% and then 0%. Each step buys lower delivery and route risk for a known monthly cost.",
    "saved_csv": "The locked-schema table (11 makers, 16 locked columns plus 10 agreed extras, including the compliance-gate flag) and the per-mode ranking and allocation files are saved. The ranking files now also carry S_risk, the risk-only closeness used by the MILP.",
    "conclusion": """**Recommendation for the GPO (carboplatin injection, Tier 1, 10,000 vials a month).**
- Normal mode (lambda 1.0): Teva Parenteral Medicines as primary (7,000 vials, 70%), Hospira as warm backup (1,000, 10%), and probation trials with AVYXA (1,500, 15%) and Gland (500, 5%). This costs 1,648,949 USD a month and meets every Tier 1 rule.
- Crisis mode (Hormuz or Gulf airspace shock, lambda 2.0): Teva 70%, Hospira 15%, AVYXA 15%. India-made volume falls from 5% to 0% for 1.4% more cost (23,481 USD a month).
- Accord, Eugia and Fresenius Kabi are excluded from primary and backup roles by the compliance gate (C4 above 0.80).
- A human category manager approves every split (dashboard Approval page). No order is sent automatically.

**Why it can be trusted.**
- AHP consistency ratios are below 0.005.
- Entropy is applied only to real data.
- Cost is counted once in the MILP (S_risk excludes C1).
- The top established maker survives 98.3% of random weight changes.
- Every imputed, neutral or gated value is flagged.

**Limits.**
- Demand, capacities, the route mix, the mode lambdas and the 0.80 gate are scenario assumptions (A8, A11, A27, A28, A34, A35).
- Prices are a US Medicaid proxy (A4).
- The two probation trials together take 20% because their prices are imputed at the median.

**Future improvements.**
- Calibrate lambda with the board using past stock-out costs.
- Replace assumed capacities with supplier-confirmed allocations.
- Add a multi-period model that tracks safety stock.
- Re-run monthly as the openFDA and FDA feeds refresh.""",
})
