"""Builds and executes pipeline/notebooks/02_scoring_panel_2026.ipynb."""
from interp_02 import INTERP
from nb import build, code, md


def bi(key):
    return md("**Business interpretation.** " + INTERP[key])


cells = [
    md("""
# Notebook 02 - 2026 carboplatin scoring panel

**PharmaShield GCC** - Group 3, AI in Operations, SP Jain Dubai. Academic prototype for a hypothetical UAE GPO.

| Item | Value |
|---|---|
| Build step covered | Build step 3 - Build the 2026 oncology scoring panel |
| Key questions served | Q1 (who can we buy from), Q2 (data fusion and entity resolution), Q6 (probation fairness) |
| Inputs | openFDA NDC, Drug Shortages and Enforcement caches (14 Nov 2026); FDA Data Dashboard inspections; Medicaid State Drug Utilization Data 2025; World Bank LPI 2023 edition; notebook 01 outputs |
| Outputs | data/processed/scoring_panel_carboplatin.csv, data/processed/fda_match_table.csv, data/processed/fda_matched_inspections.csv, figures/fig_05 to fig_07 |
| Demo SKU | CARBOPLATIN_INJ_10MG_ML, carboplatin injection 10 mg/mL, Tier 1 (life-critical oncology). Not a cold-chain product. |
"""),
    md("""
## 1. Objective

**Section intro.** The GPO can only buy from makers that are authorised to sell finished carboplatin injection. This notebook builds that list and attaches real 2026 evidence to every maker:
1. **Qualification filter**: keep only finished-injection, human prescription listings; drop bulk-ingredient (API) labelers (override 1).
2. **Entity resolution**: map each US labeler to the company that makes the product and to its corporate parent, using a reviewed mapping table, then match to FDA and SCMS records with rapidfuzz (override 3).
3. **Criteria inputs**: C1 price (Medicaid 2025 proxy plus a data-based freight markup), C4 compliance inputs (inspections, recalls, shortages), C5 route exposure (labelled route-mix assumption times World Bank LPI).
4. **Probation scenario**: who the GPO's current incumbents are, justified from market data (override 4).
"""),
    code("""
import sys, json
from pathlib import Path

sys.path.insert(0, str(Path.cwd().parents[0]))

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from rapidfuzz import fuzz, process

from src.common import RAW, PROCESSED, REFERENCE, RANDOM_STATE, PALETTE, style, save_fig, shape

style()
RUN_DATE = pd.Timestamp("2026-11-14")          # data cut-off: date of every cached API pull
WINDOW_5Y = RUN_DATE - pd.DateOffset(years=5)  # plan: OAI and recalls over the past 5 years
WINDOW_3Y = RUN_DATE - pd.DateOffset(years=3)  # assumption A13: probation trial gate
SKU_ID = "CARBOPLATIN_INJ_10MG_ML"
print("Data cut-off", RUN_DATE.date(), "| 5-year window from", WINDOW_5Y.date(), "| 3-year window from", WINDOW_3Y.date())
"""),
    md("""
**Section summary.** All evidence is read from dated caches in data/raw, so the panel can be rebuilt exactly. Windows are fixed relative to the 14 Nov 2026 data cut-off.
"""),
    md("""
## 2. Exploratory data analysis

**Section intro.** We first look at the raw NDC listings: who appears for carboplatin, with which dosage form and marketing category. This is where the plan's "18 labelers" came from.
"""),
    code("""
ndc_doc = json.loads((RAW / "openfda_ndc_carboplatin_20261114.json").read_text(encoding="utf-8"))
ndc = pd.DataFrame(ndc_doc["results"])
shape("openFDA NDC carboplatin listings", ndc)
listing = (ndc.groupby(["labeler_name", "dosage_form", "marketing_category", "product_type"]).size()
              .rename("listings").reset_index().sort_values(["product_type", "labeler_name"]))
print(f"Distinct labelers: {ndc['labeler_name'].nunique()}")
listing
"""),
    bi("ndc"),
    code("""
short_doc = json.loads((RAW / "openfda_shortages_carboplatin_20261114.json").read_text(encoding="utf-8"))
short = pd.DataFrame(short_doc["results"])
short["labeler_code"] = short["package_ndc"].astype(str).str.split("-").str[0].str.zfill(4)
shape("openFDA carboplatin shortage records", short)
print(short["status"].value_counts().to_string())
link = short.groupby(["company_name", "labeler_code"]).agg(records=("status", "size"),
        current=("status", lambda s: (s == "Current").sum())).reset_index()
link
"""),
    bi("shortages"),
    md("""
**Section summary.** The raw listings mix finished injection with bulk powder, and the shortage file names the company that makes a product, which is not always the labeler. Both facts shape the next section.
"""),
    md("""
## 3. Preprocessing

### 3.1 Qualification filter (override 1)

**Section intro.** A hospital buyer can only order a finished, human prescription injection. Bulk-ingredient listings are raw material for other factories (assumption A14).
"""),
    code("""
shape("Before qualification filter (listings)", ndc)
qualified = ndc[ndc["product_type"].eq("HUMAN PRESCRIPTION DRUG")
                & ndc["dosage_form"].str.contains("INJECTION", na=False)
                & ndc["marketing_category"].isin(["ANDA", "NDA", "BLA"])].copy()
shape("After qualification filter (listings)", qualified)
excluded = sorted(set(ndc["labeler_name"]) - set(qualified["labeler_name"]))
print(f"Qualified makers: {qualified['labeler_name'].nunique()} | Excluded bulk-ingredient labelers: {len(excluded)}")
print("Excluded:", "; ".join(excluded))
"""),
    bi("qualification"),
    md("""
### 3.2 Reviewed entity map: labeler, maker and parent (override 3)

**Section intro.** The NDC labeler is the company on the US label. The plant may belong to another company, and the corporate parent may appear in other data under its own name. The table below was reviewed by hand; each row states its evidence. Two links come straight from the shortage data (BPI Labs products are listed under Gland Pharma; Natco products are listed under Teyro Labs).
"""),
    code("""
entity = pd.read_csv(REFERENCE / "maker_entity_map.csv", dtype=str).fillna("")
shape("Reviewed entity map", entity)
code_to_maker = {c: row.maker_id for row in entity.itertuples() for c in row.labeler_codes.split(";")}
qualified["labeler_code"] = qualified["product_ndc"].str.split("-").str[0].str.zfill(4)
qualified["maker_id"] = qualified["labeler_code"].map(code_to_maker)
assert qualified["maker_id"].notna().all(), "A qualified labeler code is missing from the entity map"
assert set(entity["labeler_name_fda"]) == set(qualified["labeler_name"]), "Entity map and qualified labelers differ"
entity[["maker_id", "labeler_name_fda", "labeler_codes", "parent_group", "fda_aliases"]]
"""),
    bi("entity"),
    md("""
### 3.3 Fuzzy matching to FDA inspection records (rapidfuzz)

**Section intro.** FDA spells firm names many ways ("EUGIA Pharma Specialities Limited", "Eugia Pharma Specialities Limited"). We normalise legal suffixes, then score every drug-inspection firm name against each maker's aliases with `token_sort_ratio`. The plan's rule was "score of 88 or more". On its own that rule is unsafe here: generic words such as "Pharmaceuticals" carry most of the score, so "Ionis Pharmaceuticals" scores 90.5 against "Intas Pharmaceuticals". We add a second test: the distinctive first word of the name (Intas, Eugia, Hospira) must itself score 90 or more. The full candidate table, including every rejection and its reason, is saved for manual review. We also show why a plain text search is unsafe.
"""),
    code("""
insp_raw = pd.read_excel(RAW / "fda_dashboard_inspections_20261114.xlsx")
shape("FDA inspections (all product types)", insp_raw)
insp = insp_raw[insp_raw["Product Type"].eq("Drugs")].copy()
shape("FDA inspections (drugs only)", insp)

SUFFIXES = {"inc", "llc", "ltd", "limited", "private", "pvt", "corp", "corporation", "co", "company", "sa", "de", "cv",
            "gmbh", "srl", "plc", "the", "kg", "ag", "spa", "bv", "pty"}

def normalise(name):
    tokens = "".join(ch.lower() if ch.isalnum() else " " for ch in str(name)).split()
    return " ".join(t for t in tokens if t not in SUFFIXES)

names = pd.Series(insp["Legal Name"].dropna().unique())
norm_names = names.map(normalise)
rows = []
for m in entity.itertuples():
    for alias in m.fda_aliases.split(";"):
        hits = process.extract(normalise(alias), norm_names.tolist(), scorer=fuzz.token_sort_ratio, limit=8, score_cutoff=75)
        key = normalise(alias).split()[0]
        for _, score, idx in hits:
            key_score = fuzz.ratio(key, norm_names.iloc[idx].split()[0]) if norm_names.iloc[idx] else 0
            if score < 88:
                decision = "reject (below 88)"
            elif key_score < 90:
                decision = "reject (distinctive name differs)"
            else:
                decision = "accept"
            rows.append({"maker_id": m.maker_id, "alias": alias, "fda_legal_name": names.iloc[idx], "score": round(score, 1),
                         "distinctive_name_score": round(key_score, 1), "decision": decision})
match_table = pd.DataFrame(rows).drop_duplicates(["maker_id", "fda_legal_name"]).sort_values(["maker_id", "score"], ascending=[True, False])
match_table.to_csv(PROCESSED / "fda_match_table.csv", index=False)
print(match_table["decision"].value_counts().to_string())
match_table
"""),
    bi("match"),
    code("""
naive = insp[insp["Legal Name"].str.lower().str.contains("gland", na=False)]["Legal Name"].value_counts()
accepted_gland = set(match_table.query("maker_id == 'GLAND' and decision == 'accept'")["fda_legal_name"])
naive_table = naive.rename("inspections").to_frame()
naive_table["fuzzy_decision"] = ["accept" if n in accepted_gland else "reject" for n in naive_table.index]
naive_table
"""),
    bi("naive"),
    code("""
accepted = match_table[match_table["decision"].eq("accept")][["maker_id", "fda_legal_name"]]
shape("Inspections before linking to makers", insp)
linked = insp.merge(accepted, left_on="Legal Name", right_on="fda_legal_name", how="inner")
shape("Inspections linked to a carboplatin maker", linked)
linked["cls"] = linked["Classification"].str.extract(r"\\((\\w+)\\)")[0]
linked[["maker_id", "FEI Number", "Legal Name", "Country/Area", "Inspection ID", "Inspection End Date", "cls"]].to_csv(
    PROCESSED / "fda_matched_inspections.csv", index=False)
recent = linked[linked["Inspection End Date"] >= WINDOW_5Y]
insp_summary = linked.groupby("maker_id").agg(inspections_all=("Inspection ID", "size"),
                                              plant_country=("Country/Area", lambda s: s.value_counts().index[0]))
insp_5y = recent.groupby("maker_id").agg(inspections_5yr=("Inspection ID", "size"),
                                         oai_count_5yr=("cls", lambda s: int((s == "OAI").sum())),
                                         vai_count_5yr=("cls", lambda s: int((s == "VAI").sum())),
                                         last_inspection=("Inspection End Date", "max"))
oai_3y = linked[(linked["Inspection End Date"] >= WINDOW_3Y) & linked["cls"].eq("OAI")].groupby("maker_id").size().rename("oai_count_3yr")
insp_features = entity[["maker_id"]].set_index("maker_id").join([insp_summary, insp_5y, oai_3y])
for col in ["inspections_all", "inspections_5yr", "oai_count_5yr", "vai_count_5yr", "oai_count_3yr"]:
    insp_features[col] = insp_features[col].fillna(0).astype(int)
insp_features
"""),
    bi("inspections"),
    md("""
### 3.4 SCMS overlap after parent mapping

**Section intro.** We look for each maker's corporate parent in the SCMS manufacturing sites and vendors. This is the real overlap between the training layer and the 2026 panel (override 3).
"""),
    code("""
scms = pd.read_csv(PROCESSED / "scms_clean.csv")
shape("SCMS clean lines", scms)
overlap = []
for m in entity.itertuples():
    keys = [k for k in [m.scms_parent_key] if k] + [a.split()[0] for a in m.fda_aliases.split(";")]
    keys = sorted(set(k for k in keys if len(k) >= 4))
    mask = np.zeros(len(scms), dtype=bool)
    for k in keys:
        pattern = rf"\\b{k}\\b"
        mask |= scms["Manufacturing Site"].str.contains(pattern, case=False, regex=True) | scms["Vendor"].str.contains(pattern, case=False, regex=True)
    overlap.append({"maker_id": m.maker_id, "search_keys": ", ".join(keys), "scms_lines": int(mask.sum()),
                    "scms_sites": "; ".join(sorted(scms.loc[mask, "Manufacturing Site"].unique()))})
overlap = pd.DataFrame(overlap).set_index("maker_id")
overlap.loc[overlap.index == "BPI", ["scms_lines", "scms_sites"]] = [0, ""]  # Gland is BPI's contract maker, not its parent: no SCMS history is inherited
print(f"Makers with any SCMS history after parent mapping: {(overlap.scms_lines > 0).sum()} of {len(overlap)}")
overlap
"""),
    bi("overlap"),
    md("""
**Section summary.** Eleven makers qualify. Each one now has a reviewed link to its plant owner and parent, an FDA inspection history from fuzzy matching with a visible review table, and a real count of SCMS history.
"""),
    md("""
## 4. Criteria inputs for the 2026 panel

### 4.1 C1 landed cost: Medicaid 2025 price plus a data-based freight markup (assumption A4)

**Section intro.** No public GCC tender prices exist by maker. We use what US Medicaid paid per unit in 2025 for each labeler code (national totals, non-suppressed rows) as a relative price signal. Landed cost per vial = price per mL x 45 mL (the 450 mg/45 mL vial, assumption A21) x (1 + origin freight ratio + origin insurance ratio). The markups are the SCMS medians for air lines from the same origin country (notebook 01). Makers with no Medicaid rows receive the median price and are flagged `c1_imputed` (override 6).
"""),
    code("""
med_doc = json.loads((RAW / "medicaid_sdud2025_carboplatin_20261114.json").read_text(encoding="utf-8"))
med = pd.DataFrame(med_doc["results"])
shape("Medicaid SDUD 2025 carboplatin rows", med)
for c in ["units_reimbursed", "total_amount_reimbursed", "number_of_prescriptions"]:
    med[c] = pd.to_numeric(med[c], errors="coerce")
med = med[med["suppression_used"].eq("false")].copy()
shape("After removing suppressed rows", med)
med["labeler_code"] = med["labeler_code"].str.lstrip("0").str.zfill(4)
price = med.groupby("labeler_code").agg(units_2025=("units_reimbursed", "sum"), usd_2025=("total_amount_reimbursed", "sum"))
price["price_per_ml_usd"] = price["usd_2025"] / price["units_2025"]
price["maker_id"] = price.index.map(code_to_maker)
not_qualified = price[price["maker_id"].isna()]
print("Labeler codes with Medicaid rows but not in the qualified panel:", not_qualified.index.tolist(), "(50742 = Ingenus, listed only in the shortage file as To Be Discontinued)")
price = price.dropna(subset=["maker_id"]).set_index("maker_id")
price["unit_share_2025"] = price["units_2025"] / price["units_2025"].sum()
price.sort_values("units_2025", ascending=False).round(4)
"""),
    bi("medicaid"),
    code("""
air = scms[scms["shipment_mode"].isin(["Air", "Air Charter"])]
markup = air.groupby("origin_country").agg(air_lines=("ID", "size"), freight_ratio=("freight_to_value", "median"),
                                           insurance_ratio=("insurance_to_value", "median"))
plant_country = insp_features["plant_country"].copy()
plant_country = plant_country.fillna("United States")  # ASSUMPTION A22: no FDA inspection on file, so the labeler's home country is used
VIAL_ML = 45  # ASSUMPTION A21: the order unit is the 450 mg / 45 mL vial
c1 = pd.DataFrame({"plant_country": plant_country})
c1 = c1.join(price[["price_per_ml_usd", "units_2025", "unit_share_2025"]])
c1["c1_imputed"] = c1["price_per_ml_usd"].isna()
median_price = c1.loc[~c1["c1_imputed"], "price_per_ml_usd"].median()
c1["price_per_ml_usd"] = c1["price_per_ml_usd"].fillna(median_price)
c1 = c1.join(markup[["freight_ratio", "insurance_ratio"]], on="plant_country")
c1["landed_cost_per_vial_usd"] = c1["price_per_ml_usd"] * VIAL_ML * (1 + c1["freight_ratio"] + c1["insurance_ratio"])
print(f"Median observed price used for imputation: {median_price:.4f} USD per mL")
print(markup.loc[sorted(c1['plant_country'].unique())].round(4).to_string())
c1.sort_values("landed_cost_per_vial_usd").round(4)
"""),
    bi("c1"),
    md("""
### 4.2 C4 inputs: recalls and active shortages

**Section intro.** Recalls come from openFDA Enforcement, searched by recalling firm (assumption A15). The plan's C4 formula counts Class I and II recalls in the past 5 years, capped at 2. Fresenius Kabi Compounding is a separate business and is removed. The active-shortage flag comes from the shortage file through the labeler code in each record's package NDC, so a shortage filed under Gland Pharma for a BPI Labs NDC counts for BPI Labs.
"""),
    code("""
rec_doc = json.loads((RAW / "openfda_recalls_carboplatin_firms_20261114.json").read_text(encoding="utf-8"))
query_to_maker = {"AVYXA Pharma": "AVYXA", "Accord Healthcare": "ACCORD", "Apotex": "APOTEX", "BPI Labs": "BPI", "Eugia US": "EUGIA",
                  "AuroMedics (former Eugia US name)": "EUGIA", "Fresenius Kabi USA": "FRESENIUS", "Gland Pharma": "GLAND",
                  "Hospira": "HOSPIRA", "Natco Pharma": "NATCO", "Teva": "TEVA", "Sicor (Teva entity)": "TEVA", "Teyro Labs": "TEYRO"}
rec = pd.DataFrame([{"maker_id": query_to_maker[q], "firm": r.get("recalling_firm"), "cls": r.get("classification"),
                     "date": pd.to_datetime(r.get("recall_initiation_date"))} for q, v in rec_doc["queries"].items() for r in v["results"]])
shape("Recall records, all firms, 10 years", rec)
rec = rec[~rec["firm"].str.contains("Compounding", case=False)]
shape("After removing Fresenius Kabi Compounding", rec)
rec5 = rec[rec["date"] >= WINDOW_5Y]
shape("Recalls in the 5-year window", rec5)
recall_features = rec5.assign(class_i=rec5["cls"].eq("Class I"), class_i_ii=rec5["cls"].isin(["Class I", "Class II"])).groupby("maker_id").agg(
    recalls_5yr=("cls", "size"), class_i_ii_5yr=("class_i_ii", "sum"), class_i_5yr=("class_i", "sum"))
class_i_3y = rec[(rec["date"] >= WINDOW_3Y) & rec["cls"].eq("Class I")].groupby("maker_id").size().rename("class_i_3yr")
recall_features = entity[["maker_id"]].set_index("maker_id").join([recall_features, class_i_3y]).fillna(0).astype(int)
active = short[short["status"].eq("Current")].assign(maker_id=lambda d: d["labeler_code"].map(code_to_maker)).dropna(subset=["maker_id"])
recall_features["active_fda_shortage"] = recall_features.index.isin(active["maker_id"])
recall_features["current_shortage_records"] = active.groupby("maker_id").size().reindex(recall_features.index).fillna(0).astype(int)
recall_features
"""),
    bi("recalls"),
    md("""
### 4.3 C5 route exposure: route-mix assumption x World Bank LPI (assumption A8)

**Section intro.** C5 = min(1, StressFactor x share of volume on the Hormuz sea lane or Gulf airspace) x (1 - LPI/5). StressFactor is 1.0 in Normal mode and 1.5 in Crisis mode. The route mix by origin country is a labelled scenario assumption (pipeline/reference/route_mix_assumptions.csv); the LPI is the World Bank 2023 edition. The Worldwide Governance Indicators (WGI) are removed from the inventory: a political-stability score for the origin country would add a second country-level penalty on top of LPI without any lane evidence (decision D7).
"""),
    code("""
lpi_doc = json.loads((RAW / "worldbank_lpi2023edition_20261114.json").read_text(encoding="utf-8"))
lpi = pd.Series({r["country"]["value"]: r["value"] for r in lpi_doc[1] if r["value"] is not None}, name="lpi_2023")
routes = pd.read_csv(REFERENCE / "route_mix_assumptions.csv").set_index("origin_country")
routes["hormuz_air_share"] = routes["air_gulf_share"] + routes["sea_hormuz_share"]
routes = routes.join(lpi)
routes["c5_normal"] = np.minimum(1.0, 1.0 * routes["hormuz_air_share"]) * (1 - routes["lpi_2023"] / 5)
routes["c5_crisis"] = np.minimum(1.0, 1.5 * routes["hormuz_air_share"]) * (1 - routes["lpi_2023"] / 5)
routes[["air_gulf_share", "sea_hormuz_share", "sea_gulf_of_oman_share", "hormuz_air_share", "lpi_2023", "c5_normal", "c5_crisis"]].round(4)
"""),
    bi("c5"),
    md("""
### 4.4 Probation scenario (override 4)

**Section intro.** The plan defined probation as "fewer than 5 SCMS shipments". That rule would put 9 of 11 makers on probation because SCMS holds ARV shipments, not oncology. Instead we define a labelled scenario (assumption A23): the GPO's current incumbents are the makers that already hold a material share of real 2026 carboplatin supply, measured by their share of 2025 Medicaid units. A threshold of 5% of units separates the panel cleanly. Everyone else is a probation candidate. A probation candidate may receive a trial order only if it passes the safety gate (assumption A13): no OAI inspection and no Class I recall in the last 3 years.
"""),
    code("""
panel = entity[["maker_id", "labeler_name_fda", "parent_group"]].set_index("maker_id")
panel = panel.join(c1).join(insp_features.drop(columns="plant_country")).join(recall_features).join(overlap[["scms_lines"]])
panel["unit_share_2025"] = panel["unit_share_2025"].fillna(0.0)
INCUMBENT_SHARE = 0.05  # ASSUMPTION A23
panel["is_probation"] = panel["unit_share_2025"] < INCUMBENT_SHARE
panel["trial_gate_pass"] = (panel["oai_count_3yr"] == 0) & (panel["class_i_3yr"] == 0)
incumbent_cover = panel.loc[~panel["is_probation"], "unit_share_2025"].sum()
print(f"Incumbents: {(~panel.is_probation).sum()} makers covering {incumbent_cover:.1%} of 2025 Medicaid units; probation candidates: {panel.is_probation.sum()}")
print("Largest share below the threshold:", f"{panel.loc[panel.is_probation, 'unit_share_2025'].max():.1%}", "| smallest share above:", f"{panel.loc[~panel.is_probation, 'unit_share_2025'].min():.1%}")
panel[["unit_share_2025", "is_probation", "oai_count_3yr", "class_i_3yr", "trial_gate_pass"]].sort_values("unit_share_2025", ascending=False).round(4)
"""),
    bi("probation"),
    code("""
fig, axes = plt.subplots(1, 2, figsize=(12.5, 4.4))
order = panel.sort_values("unit_share_2025", ascending=True).index
colors = [PALETTE[1] if panel.loc[m, "is_probation"] else PALETTE[0] for m in order]
axes[0].barh(order, panel.loc[order, "unit_share_2025"] * 100, color=colors)
axes[0].axvline(INCUMBENT_SHARE * 100, color="#333333", linestyle="--", linewidth=1)
axes[0].text(INCUMBENT_SHARE * 100 + 0.5, 0.2, "5% incumbent threshold (A23)", fontsize=8)
axes[0].set_title("2025 Medicaid carboplatin units by maker")
axes[0].set_xlabel("Share of units reimbursed in 2025 (%)")
axes[0].set_ylabel("Maker")
from matplotlib.patches import Patch
axes[0].legend(handles=[Patch(color=PALETTE[0], label="Incumbent"), Patch(color=PALETTE[1], label="Probation candidate")], loc="lower right")
order2 = panel.sort_values("landed_cost_per_vial_usd").index
colors2 = [PALETTE[6] if panel.loc[m, "c1_imputed"] else PALETTE[2] for m in order2]
axes[1].bar(order2, panel.loc[order2, "landed_cost_per_vial_usd"], color=colors2)
axes[1].set_title("C1 input: estimated landed cost per 45 mL vial")
axes[1].set_xlabel("Maker")
axes[1].set_ylabel("Landed cost (USD per vial)")
axes[1].tick_params(axis="x", rotation=45)
axes[1].legend(handles=[Patch(color=PALETTE[2], label="Medicaid 2025 price"), Patch(color=PALETTE[6], label="Imputed (median price)")], loc="upper left")
save_fig(fig, "fig_05_panel_share_and_cost", "Medicaid State Drug Utilization Data 2025 (national, non-suppressed); SCMS air freight medians; assumptions A4, A21, A23")
plt.show()
"""),
    bi("fig05"),
    md("""
**Section summary.** Every maker now has C1, C4 and C5 inputs from real 2026 data or a labelled assumption, and a probation status that follows from market data rather than from an ARV dataset.
"""),
    md("""
## 5. Evaluation of the panel

**Section intro.** We check the panel for completeness and print the fused 360-degree view of one maker (Q2). The C2 delivery-risk inputs (plant country, air mode, origin freight profile and the SCMS site prior) are used by the model in notebook 03.
"""),
    code("""
panel["sku_id"] = SKU_ID
panel["criticality_tier"] = 1
panel["manufacturing_country"] = panel["plant_country"]
assert len(panel) == 11, "The panel must contain the 11 qualified makers"
assert panel["landed_cost_per_vial_usd"].notna().all()
check = pd.DataFrame({"filled": panel.notna().sum(), "missing": panel.isna().sum()})
print("Columns with missing values:")
print(check[check["missing"] > 0].to_string() if (check["missing"] > 0).any() else "none")
fused = panel.loc["EUGIA"]
print("\\n360-degree view: Eugia US LLC")
print(fused.to_string())
"""),
    bi("eval"),
    code("""
fig, ax = plt.subplots(figsize=(11, 4.2))
heat = panel[["oai_count_5yr", "vai_count_5yr", "class_i_ii_5yr", "class_i_5yr", "current_shortage_records", "scms_lines"]].copy()
heat.columns = ["OAI inspections (5y)", "VAI inspections (5y)", "Class I/II recalls (5y)", "Class I recalls (5y)", "Current shortage records", "SCMS lines (parent)"]
sns.heatmap(np.log1p(heat), annot=heat, fmt="d", cmap="Reds", cbar_kws={"label": "log(1 + count)"}, ax=ax)
ax.set_title("Evidence fused per carboplatin maker (counts)")
ax.set_xlabel("Evidence type")
ax.set_ylabel("Maker")
save_fig(fig, "fig_06_panel_evidence_heatmap", "FDA Data Dashboard inspections; openFDA Enforcement and Drug Shortages (cached 14 Nov 2026); USAID SCMS")
plt.show()
"""),
    bi("fig06"),
    code("""
out_cols = ["sku_id", "criticality_tier", "labeler_name_fda", "parent_group", "manufacturing_country", "is_probation", "trial_gate_pass",
            "unit_share_2025", "price_per_ml_usd", "c1_imputed", "freight_ratio", "insurance_ratio", "landed_cost_per_vial_usd",
            "inspections_all", "inspections_5yr", "oai_count_5yr", "vai_count_5yr", "oai_count_3yr", "last_inspection",
            "recalls_5yr", "class_i_ii_5yr", "class_i_5yr", "class_i_3yr", "active_fda_shortage", "current_shortage_records", "scms_lines"]
panel_out = panel[out_cols].join(routes[["hormuz_air_share", "lpi_2023", "c5_normal", "c5_crisis"]], on="manufacturing_country")
panel_out.index.name = "manufacturer_id"
panel_out.to_csv(PROCESSED / "scoring_panel_carboplatin.csv")
shape("Saved data/processed/scoring_panel_carboplatin.csv", panel_out)
panel_out[["manufacturing_country", "is_probation", "c1_imputed", "landed_cost_per_vial_usd", "oai_count_5yr", "class_i_ii_5yr", "active_fda_shortage", "c5_normal", "c5_crisis"]].round(3)
"""),
    bi("saved"),
    md("""
**Section summary.** The panel is complete for 11 makers with no missing criteria inputs. Two values are imputed or assumed and are flagged in the data: C1 for makers without Medicaid rows, and the plant country for the one maker with no FDA inspection on file.
"""),
    md("""
## 6. Conclusion
"""),
    md(INTERP["conclusion"]),
    md("""
**End of notebook 02.** Next: notebook 03 trains the delivery-risk, anomaly and NLP models.
"""),
]

if __name__ == "__main__":
    print("built", build("02_scoring_panel_2026.ipynb", cells))
