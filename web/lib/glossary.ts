// Plain-English definitions shown in tooltips across the app.
export const GLOSSARY: Record<string, string> = {
  S: "S score (TOPSIS closeness): how close a maker is to the ideal supplier on all five criteria, from 0 (worst) to 1 (best).",
  S_risk: "Risk-only closeness on C2 to C5. The order split uses it so cost is not counted twice (cost is already in the price term).",
  risk: "Composite risk = 1 - S. Higher means further from the ideal supplier.",
  C1: "C1 Landed cost: price per 45 mL vial plus freight and insurance, scaled 0 (cheapest) to 1 (most expensive).",
  C2: "C2 Delivery risk: XGBoost probability that a shipment arrives late, from the maker's plant country, mode, freight profile and site history.",
  C3: "C3 Price integrity: share of the maker's past invoice lines flagged as unusual by the Isolation Forest (neutral value if no history).",
  C4: "C4 Compliance risk: FDA inspection outcomes, Class I/II recalls, NLP severity of inspection findings and active US shortages, 0 to 1.",
  C5: "C5 Route exposure: share of volume through Hormuz or Gulf airspace times (1 - LPI/5). Route mix is a scenario assumption (A8).",
  lambda: "Lambda (price of risk): how many multiples of the average landed cost the board would pay to move from the riskiest to the safest supplier.",
  CR: "Consistency ratio of the AHP judgements. Below 0.10 means the board's pairwise comparisons do not contradict each other.",
  SHAP: "SHAP values: how much each factor pushed this maker's delay risk up or down, compared with an average shipment (log-odds).",
  probation: "Probation maker: not a current incumbent (under 5% of 2025 Medicaid units). Can receive only a 5-15% trial, and only if it passes the safety gate.",
  gated: "Compliance gate: C4 above 0.80 (assumption A34). The maker cannot be primary or backup while a feasible alternative exists.",
  imputed: "Imputed price: no Medicaid 2025 price exists for this maker, so the median price is used (assumption A4).",
  shortage: "The maker has at least one current US carboplatin shortage record in openFDA (US data, not validated for clinical use).",
  hormuz: "Hormuz-exposed share: volume-weighted share of supply moving through the Strait of Hormuz or Gulf airspace (route-mix assumption A8).",
};
