"""Builds and executes pipeline/notebooks/01_scms_eda_cleaning.ipynb."""
from interp_01 import INTERP
from nb import build, code, md


def bi(key):
    return md("**Business interpretation.** " + INTERP[key])


cells = [
    md("""
# Notebook 01 - SCMS shipment history: EDA, cleaning and features

**PharmaShield GCC** - Group 3, AI in Operations (Dr. Sandip Kumar Roy), SP Jain School of Global Management, Dubai.
Academic prototype for a hypothetical UAE healthcare group purchasing organisation (GPO). Not a real company.

| Item | Value |
|---|---|
| Build steps covered | Build step 1 - Clean SCMS training data; Build step 2 - Engineer site and corridor features |
| Key questions served | Q2 (data sources), Q3 (disruption prediction, training layer) |
| Input | data/raw/scms_shipment_pricing.csv (USAID SCMS Delivery History, Kaggle copy, assumption A19) |
| Outputs | data/processed/scms_clean.csv, data/processed/site_features.csv, figures/fig_01 to fig_04 |
| Random seed | 42 |
"""),
    md("""
## 1. Objective

**Section intro.** The GPO wants to know which carboplatin makers are most likely to deliver late. It has no shipment history of its own we can use, so we learn the physics of pharmaceutical freight from the public USAID SCMS file: about 10,000 real shipments from 2006 to 2015.

This notebook turns the raw file into a clean, model-ready table. It does four things:
1. Parses dates and builds the target `late` (delivered after the scheduled date).
2. Turns text placeholders in the freight, weight and insurance columns into numbers or explicit missing values.
3. Derives the **origin country** from the manufacturing site. Important: the SCMS column `Country` is the **destination** country, not the origin (override 2).
4. Engineers transferable features (origin country, shipment mode, freight-to-value ratio, weight) and descriptive site statistics.
"""),
    code("""
import sys
from pathlib import Path

sys.path.insert(0, str(Path.cwd().parents[0]))  # pipeline/ on the path, so "src" imports work

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from src.common import RAW, PROCESSED, REFERENCE, RANDOM_STATE, PALETTE, style, save_fig, shape

style()
np.random.seed(RANDOM_STATE)
print("pandas", pd.__version__, "| seaborn", sns.__version__, "| random_state", RANDOM_STATE)
"""),
    md("""
**Section summary.** The environment is fixed: pinned library versions (app/requirements-lock.txt) and one seed, so every number in this notebook is reproducible.
"""),
    md("""
## 2. Exploratory data analysis

**Section intro.** Before cleaning anything we look at what the file really contains: its size, which columns hold text where numbers are expected, how often shipments are late, and how that changes over time and by shipment mode.
"""),
    code("""
scms_raw = pd.read_csv(RAW / "scms_shipment_pricing.csv", encoding="utf-8-sig")
shape("Raw SCMS file", scms_raw)
print("Columns:", list(scms_raw.columns))
"""),
    bi("load"),
    code("""
# Which "numeric" columns contain text, and how much?
check_cols = ["Freight Cost (USD)", "Weight (Kilograms)", "Line Item Insurance (USD)",
              "PO Sent to Vendor Date", "Scheduled Delivery Date", "Delivered to Client Date"]
rows = []
for col in check_cols:
    s = scms_raw[col]
    as_num = pd.to_numeric(s, errors="coerce")
    as_date = pd.to_datetime(s, format="mixed", errors="coerce") if "Date" in col else pd.Series(np.nan, index=s.index)
    text_mask = as_num.isna() & as_date.isna() & s.notna()
    top_text = s[text_mask].astype(str).str.replace(r"See .*", "See <other line>", regex=True).value_counts().head(3)
    rows.append({"column": col, "missing": int(s.isna().sum()), "text_values": int(text_mask.sum()),
                 "top_text_values": "; ".join(f"{k} ({v:,})" for k, v in top_text.items())})
quality = pd.DataFrame(rows)
quality
"""),
    bi("quality"),
    code("""
sched = pd.to_datetime(scms_raw["Scheduled Delivery Date"], format="mixed", errors="coerce")
deliv = pd.to_datetime(scms_raw["Delivered to Client Date"], format="mixed", errors="coerce")
eda = pd.DataFrame({"year": sched.dt.year, "late": (deliv > sched).astype(int),
                    "mode": scms_raw["Shipment Mode"].fillna("Not recorded")})
by_year = eda.groupby("year").agg(shipments=("late", "size"), late_rate=("late", "mean"))
by_mode = eda.groupby("mode").agg(shipments=("late", "size"), late_rate=("late", "mean")).sort_values("shipments", ascending=False)
print(f"Overall late rate: {eda['late'].mean():.1%} of {len(eda):,} lines")
print(by_year.round(3).to_string())
print()
print(by_mode.round(3).to_string())
"""),
    bi("late_rates"),
    code("""
fig, axes = plt.subplots(1, 2, figsize=(12, 4.2))
axes[0].bar(by_year.index.astype(int), by_year["late_rate"] * 100, color=PALETTE[0])
axes[0].axvspan(2013.5, 2015.5, color=PALETTE[1], alpha=0.12, label="Test period (2014-2015)")
axes[0].set_title("Share of SCMS shipment lines delivered late, by scheduled year")
axes[0].set_xlabel("Scheduled delivery year")
axes[0].set_ylabel("Late lines (% of lines)")
axes[0].legend(loc="upper left")
order = by_mode.index.tolist()
axes[1].barh(order, by_mode["late_rate"] * 100, color=PALETTE[2])
for i, (n, r) in enumerate(zip(by_mode["shipments"], by_mode["late_rate"])):
    axes[1].text(r * 100 + 0.3, i, f"n={n:,}", va="center", fontsize=8)
axes[1].set_title("Late share by shipment mode")
axes[1].set_xlabel("Late lines (% of lines)")
axes[1].set_ylabel("Shipment mode")
axes[1].invert_yaxis()
save_fig(fig, "fig_01_scms_late_rate_year_mode", "USAID SCMS Delivery History 2006-2015 (Kaggle copy), n = 10,324 lines; late = delivered after scheduled date")
plt.show()
"""),
    bi("fig01"),
    md("""
**Section summary.** The file is usable but messy: freight, weight and insurance mix numbers with text, dates come in two formats, and the late rate moves a lot between years. Preprocessing must handle each of these explicitly, and the model must be judged on a later period than it is trained on.
"""),
    md("""
## 3. Preprocessing (Build step 1 - Clean SCMS training data)

**Section intro.** Each step below prints the table shape before and after, so nothing is dropped silently. Rules:
- Dates are parsed with `errors="coerce"`; rows without a valid scheduled or delivered date cannot carry a target and are dropped.
- Freight and weight text is resolved, not deleted: "See <line>" references are allocated from the referenced line, "Freight Included in Commodity Cost" becomes zero extra freight, and "Invoiced Separately" or "Weight Captured Separately" become explicit missing values.
- The PO-sent lead-time column is dropped (override 2): over half of it is text.
"""),
    md("""
### 3.1 Parse dates and build the target
"""),
    code("""
df = scms_raw.copy()
shape("Before date parsing", df)
for col in ["Scheduled Delivery Date", "Delivered to Client Date", "Delivery Recorded Date", "PQ First Sent to Client Date"]:
    df[col] = pd.to_datetime(df[col], format="mixed", errors="coerce")
n_before = len(df)
df = df.dropna(subset=["Scheduled Delivery Date", "Delivered to Client Date"]).copy()
df["delay_days"] = (df["Delivered to Client Date"] - df["Scheduled Delivery Date"]).dt.days
df["late"] = (df["delay_days"] > 0).astype(int)
df["sched_year"] = df["Scheduled Delivery Date"].dt.year
shape("After date parsing", df)
print(f"Rows dropped for missing dates: {n_before - len(df)}")
print(f"Target 'late': {df['late'].sum():,} late of {len(df):,} lines = {df['late'].mean():.2%}")
print("Delay days when late: median", df.loc[df.late == 1, "delay_days"].median(), "| 90th percentile", df.loc[df.late == 1, "delay_days"].quantile(0.9))
"""),
    bi("dates"),
    md("""
### 3.2 Resolve freight cost text
"""),
    code("""
import re

shape("Before freight resolution", df)
raw_freight = df["Freight Cost (USD)"].astype(str).str.strip()
freight_num = pd.to_numeric(raw_freight, errors="coerce")
ref_id = raw_freight.str.extract(r"ID#:(\\d+)")[0].astype(float)
df["freight_status"] = np.select(
    [freight_num.notna(), raw_freight.eq("Freight Included in Commodity Cost"), ref_id.notna(), raw_freight.eq("Invoiced Separately")],
    ["numeric", "included_in_commodity", "see_other_line", "invoiced_separately"], default="other_text")
print(df["freight_status"].value_counts().to_string())

# "See ASN-93 (ID#:1281)" means the freight for this line was billed on line ID 1281.
# Allocate that bill across the referenced line and every line pointing to it, in proportion to line value.
df["freight_group"] = np.where(ref_id.notna(), ref_id, df["ID"]).astype(int)
id_to_freight = pd.Series(freight_num.values, index=df["ID"].values)
group_bill = df["freight_group"].map(id_to_freight)
group_value = df.groupby("freight_group")["Line Item Value"].transform("sum")
value_share = np.where(group_value > 0, df["Line Item Value"] / group_value, np.nan)
df["freight_usd"] = np.where(df["freight_status"].eq("included_in_commodity"), 0.0,
                    np.where(df["freight_status"].isin(["numeric", "see_other_line"]), group_bill * value_share, np.nan))
shape("After freight resolution", df)
print(f"Lines with a usable freight value: {df['freight_usd'].notna().sum():,} ({df['freight_usd'].notna().mean():.1%})")
print(f"'See other line' references resolved to a number: {(df['freight_status'].eq('see_other_line') & df['freight_usd'].notna()).sum():,} of {df['freight_status'].eq('see_other_line').sum():,}")
"""),
    bi("freight"),
    md("""
### 3.3 Resolve weight and insurance
"""),
    code("""
shape("Before weight and insurance resolution", df)
raw_weight = df["Weight (Kilograms)"].astype(str).str.strip()
weight_num = pd.to_numeric(raw_weight, errors="coerce")
w_ref = raw_weight.str.extract(r"ID#:(\\d+)")[0].astype(float)
df["weight_group"] = np.where(w_ref.notna(), w_ref, df["ID"]).astype(int)
id_to_weight = pd.Series(weight_num.values, index=df["ID"].values)
w_bill = df["weight_group"].map(id_to_weight)
w_value = df.groupby("weight_group")["Line Item Value"].transform("sum")
w_share = np.where(w_value > 0, df["Line Item Value"] / w_value, np.nan)
df["weight_kg"] = np.where(weight_num.notna() | w_ref.notna(), w_bill * w_share, np.nan)
df.loc[df["weight_kg"] <= 0, "weight_kg"] = np.nan
df["insurance_usd"] = pd.to_numeric(df["Line Item Insurance (USD)"], errors="coerce")
shape("After weight and insurance resolution", df)
print(f"Usable weight: {df['weight_kg'].notna().sum():,} lines ({df['weight_kg'].notna().mean():.1%}); text 'Weight Captured Separately': {raw_weight.eq('Weight Captured Separately').sum():,}")
print(f"Usable insurance: {df['insurance_usd'].notna().sum():,} lines; missing: {df['insurance_usd'].isna().sum():,}")
"""),
    bi("weight"),
    md("""
### 3.4 Origin country from the manufacturing site (override 2)
"""),
    code("""
shape("Before origin mapping", df)
site_map = pd.read_csv(REFERENCE / "site_country_map.csv")
print(f"Reviewed site map: {len(site_map)} sites, {site_map['confidence'].value_counts().to_dict()}")
df = df.merge(site_map[["manufacturing_site", "origin_country", "confidence"]], how="left",
              left_on="Manufacturing Site", right_on="manufacturing_site").drop(columns="manufacturing_site")
unmapped = df["origin_country"].isna().sum()
assert unmapped == 0, f"{unmapped} lines have a site missing from the map"
shape("After origin mapping", df)
origin_counts = df["origin_country"].value_counts()
print("Lines by origin country:")
print(origin_counts.to_string())
print(f"\\nDestination countries (SCMS 'Country' column, not used as a model feature): {df['Country'].nunique()}")
"""),
    bi("origin"),
    md("""
### 3.5 Drop the PO-sent lead-time column and fix the shipment mode
"""),
    code("""
shape("Before column clean-up", df)
po_text = scms_raw["PO Sent to Vendor Date"].isin(["N/A - From RDC", "Date Not Captured"]).mean()
print(f"PO Sent to Vendor Date unusable (text): {po_text:.1%} of raw lines, so the lead-time feature is dropped (override 2)")
df["shipment_mode"] = df["Shipment Mode"].fillna("Not recorded")
drop_cols = ["PO Sent to Vendor Date", "Freight Cost (USD)", "Weight (Kilograms)", "Line Item Insurance (USD)", "Shipment Mode"]
df = df.drop(columns=drop_cols)
shape("After column clean-up", df)
print(df["shipment_mode"].value_counts().to_string())
"""),
    bi("po"),
    md("""
**Section summary.** All 10,324 lines keep a valid target. Text placeholders are now either resolved numbers or explicit missing values with a status flag, so the model can tell "no freight charged" from "freight not recorded". Every line has an origin country from a reviewed, 88-site map.
"""),
    md("""
## 4. Feature engineering (Build step 2 - Engineer site and corridor features)

**Section intro.** The delivery model (C2) uses only features that transfer to 2026 carboplatin makers (assumption A5, override 2): origin country, shipment mode, freight-to-value ratio and weight, plus a site prior built in notebook 03. Insurance-to-value ratio, line value and landed unit cost are also built here because the landed-cost (C1) and anomaly (C3) engines need them. Destination country is excluded because the UAE never appears in SCMS. We also build a descriptive site table (on-time rate, mean and 90th-percentile delay, unit-price variability, air share). The model itself uses site priors computed from the training years only, in notebook 03, to avoid leakage.
"""),
    code("""
shape("Before feature engineering", df)
value = df["Line Item Value"].where(df["Line Item Value"] > 0)
df["freight_to_value"] = (df["freight_usd"] / value).clip(upper=5)
df["insurance_to_value"] = (df["insurance_usd"] / value).clip(upper=1)
df["log_weight_kg"] = np.log1p(df["weight_kg"])
df["log_line_value"] = np.log1p(df["Line Item Value"])
df["is_air"] = df["shipment_mode"].isin(["Air", "Air Charter"]).astype(int)
df["landed_unit_cost"] = (df["Line Item Value"] + df["freight_usd"].fillna(0) + df["insurance_usd"].fillna(0)) / df["Line Item Quantity"]
shape("After feature engineering", df)
feature_summary = df[["freight_to_value", "insurance_to_value", "weight_kg", "Line Item Value", "landed_unit_cost"]].describe(percentiles=[0.5, 0.9]).T
feature_summary[["count", "mean", "50%", "90%", "max"]].round(4)
"""),
    bi("features"),
    code("""
med_ratio = df.groupby("origin_country").agg(lines=("ID", "size"), air_share=("is_air", "mean"),
                                             median_freight_to_value=("freight_to_value", "median"),
                                             median_insurance_to_value=("insurance_to_value", "median"),
                                             late_rate=("late", "mean")).sort_values("lines", ascending=False)
med_ratio.round(4)
"""),
    bi("origin_table"),
    code("""
site = df.groupby("Manufacturing Site").agg(
    origin_country=("origin_country", "first"), lines=("ID", "size"), on_time_rate=("late", lambda s: 1 - s.mean()),
    mean_delay_days=("delay_days", lambda s: s.clip(lower=0).mean()),
    p90_delay_days=("delay_days", lambda s: s.clip(lower=0).quantile(0.9)),
    unit_price_cv=("Unit Price", lambda s: s.std() / s.mean() if s.mean() > 0 else np.nan),
    air_share=("is_air", "mean"), median_freight_to_value=("freight_to_value", "median"),
).sort_values("lines", ascending=False)
shape("Site feature table", site)
site.head(12).round(3)
"""),
    bi("site_table"),
    code("""
top_origins = origin_counts[origin_counts >= 100].index.tolist()
plot_df = df[df["origin_country"].isin(top_origins)]
fig, axes = plt.subplots(1, 2, figsize=(12, 4.4))
rate = plot_df.groupby("origin_country")["late"].mean().sort_values() * 100
axes[0].barh(rate.index, rate.values, color=PALETTE[0])
axes[0].set_title("Late share by origin country (countries with 100+ lines)")
axes[0].set_xlabel("Late lines (% of lines)")
axes[0].set_ylabel("Origin (manufacturing) country")
sns.boxplot(data=plot_df[plot_df["freight_to_value"].notna()], x="freight_to_value", y="shipment_mode", hue="late",
            ax=axes[1], showfliers=False, palette=[PALETTE[2], PALETTE[1]])
axes[1].set_title("Freight-to-value ratio by mode and outcome")
axes[1].set_xlabel("Freight cost / line value (ratio, outliers hidden)")
axes[1].set_ylabel("Shipment mode")
handles, _ = axes[1].get_legend_handles_labels()
axes[1].legend(handles, ["On time", "Late"], title="Outcome", loc="lower right")
save_fig(fig, "fig_02_scms_origin_freight", "USAID SCMS 2006-2015 (Kaggle copy); origin from reviewed site map (pipeline/reference/site_country_map.csv)")
plt.show()
"""),
    bi("fig02"),
    md("""
**Section summary.** The engineered features differ between late and on-time lines and between origin countries, which is what a delivery-risk model needs. All of them can be computed for a 2026 carboplatin maker: we know its plant country, its shipping mode and its freight profile.
"""),
    md("""
## 5. Evaluation of the cleaned data

**Section intro.** Before saving, we check that the cleaned table is fit for modelling: no lost rows, the class balance in each split, the share of missing values in each feature, and that no destination information leaks into the feature list.
"""),
    code("""
FEATURES_FOR_MODEL = ["origin_country", "shipment_mode", "freight_to_value", "log_weight_kg"]  # site prior is added in notebook 03
assert len(df) == len(scms_raw), "Rows were lost during cleaning"
assert "Country" not in FEATURES_FOR_MODEL, "Destination country must not be a model feature"
split = np.where(df["sched_year"] <= 2013, "train (to 2013)", "test (2014-2015)")
balance = df.groupby(split)["late"].agg(lines="size", late="sum", late_rate="mean")
balance["on_time_per_late"] = (balance["lines"] - balance["late"]) / balance["late"]
print(balance.round(3).to_string())
print()
missing = df[FEATURES_FOR_MODEL].isna().mean().rename("missing_share")
print(missing.round(3).to_string())
"""),
    bi("balance"),
    code("""
fig, ax = plt.subplots(figsize=(8, 3.6))
miss_plot = missing.sort_values() * 100
ax.barh(miss_plot.index, miss_plot.values, color=PALETTE[3])
ax.set_title("Missing values per model feature after cleaning")
ax.set_xlabel("Missing (% of 10,324 lines)")
ax.set_ylabel("Model feature")
for i, v in enumerate(miss_plot.values):
    ax.text(v + 0.3, i, f"{v:.1f}%", va="center", fontsize=8)
save_fig(fig, "fig_03_scms_feature_missing", "USAID SCMS 2006-2015 (Kaggle copy), after notebook 01 cleaning")
plt.show()
"""),
    bi("fig03"),
    code("""
keep = ["ID", "Project Code", "Country", "Managed By", "Fulfill Via", "Vendor INCO Term", "shipment_mode", "Scheduled Delivery Date",
        "Delivered to Client Date", "sched_year", "delay_days", "late", "Product Group", "Sub Classification", "Vendor",
        "Molecule/Test Type", "Dosage Form", "Line Item Quantity", "Line Item Value", "Pack Price", "Unit Price",
        "Manufacturing Site", "origin_country", "confidence", "freight_status", "freight_usd", "weight_kg", "insurance_usd",
        "freight_to_value", "insurance_to_value", "log_weight_kg", "log_line_value", "is_air", "landed_unit_cost"]
clean = df[keep].rename(columns={"Country": "destination_country", "confidence": "origin_confidence"})
clean.to_csv(PROCESSED / "scms_clean.csv", index=False)
site.to_csv(PROCESSED / "site_features.csv")
shape("Saved data/processed/scms_clean.csv", clean)
shape("Saved data/processed/site_features.csv", site)
"""),
    bi("saved"),
    md("""
**Section summary.** The cleaned table keeps every row, has a clearly defined target, and contains only transferable features. It is saved for notebook 03 (models) and notebook 02 (the 2026 scoring panel uses the origin-level freight ratios).
"""),
    md("""
## 6. Conclusion

**Section intro.** What we learned and what to do with it.
"""),
    md(INTERP["conclusion"]),
    md("""
**End of notebook 01.** Next: notebook 02 builds the 2026 carboplatin scoring panel.
"""),
]

if __name__ == "__main__":
    path = build("01_scms_eda_cleaning.ipynb", cells)
    print("built", path)
