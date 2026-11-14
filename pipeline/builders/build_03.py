"""Builds and executes pipeline/notebooks/03_risk_models_xgb_iforest_nlp.ipynb."""
from interp_03 import INTERP
from nb import build, code, md


def bi(key):
    return md("**Business interpretation.** " + INTERP[key])


cells = [
    md("""
# Notebook 03 - Risk engines: XGBoost + SHAP, Isolation Forest, NLP

**PharmaShield GCC** - Group 3, AI in Operations, SP Jain Dubai. Academic prototype for a hypothetical UAE GPO.

| Item | Value |
|---|---|
| Build steps covered | Build step 4 - Predict disruption (C2, Q3); Build step 5 - Price and freight anomalies (C3, Q3); Build step 6 - Document NLP (C4 input, Q4) |
| Inputs | data/processed/scms_clean.csv, data/processed/scoring_panel_carboplatin.csv, data/processed/fda_matched_inspections.csv, FDA Data Dashboard citations, pipeline/reference/synthetic_contracts |
| Outputs | data/processed/model_outputs_carboplatin.csv, data/processed/model_metrics.json, shap_summary.json, iforest_anomalies.json, nlp_summary.json, contract_clauses.json, figures/fig_07 to fig_12 |
| Random seed | 42 everywhere |
"""),
    md("""
## 1. Objective

**Section intro.** Three AI engines each produce one column of the supplier decision matrix:
- **C2 delivery risk (Build step 4).** An XGBoost classifier predicts the probability that a shipment arrives late. It is trained on SCMS lines scheduled up to 2013 and tested on 2014-2015, compared with a logistic regression baseline, and explained with SHAP. It is then applied to each 2026 maker's own profile: plant country, air mode, origin freight profile and site prior.
- **C3 price integrity (Build step 5).** An Isolation Forest flags unusual price and freight lines within each product group. C3 is the share of a maker's lines flagged, where real invoice lines exist.
- **C4 document NLP (Build step 6).** A TF-IDF plus logistic regression classifier reads FDA inspection citation text (Form 483 observations, our public proxy for warning letters) and tags the violation type. A rule-based extractor reads synthetic supply contracts and flags risky clauses (demonstration only).
"""),
    code("""
import sys, json, re
from pathlib import Path

sys.path.insert(0, str(Path.cwd().parents[0]))

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import shap
import xgboost as xgb
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import IsolationForest
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (roc_auc_score, average_precision_score, recall_score, precision_score, f1_score,
                             confusion_matrix, roc_curve, classification_report)
from sklearn.model_selection import KFold, train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from src.common import RAW, PROCESSED, REFERENCE, RANDOM_STATE, PALETTE, style, save_fig, shape

style()
np.random.seed(RANDOM_STATE)
print("xgboost", xgb.__version__, "| shap", shap.__version__, "| random_state", RANDOM_STATE)
"""),
    md("""
**Section summary.** Libraries are pinned and the seed is fixed, so the scores below can be reproduced exactly with pipeline/run_all.py.
"""),
    md("""
## 2. Exploratory data analysis

**Section intro.** We check the two training sets before modelling: the class balance of the SCMS target in each time split, and the size and label coverage of the FDA citation corpus.
"""),
    code("""
scms = pd.read_csv(PROCESSED / "scms_clean.csv", parse_dates=["Scheduled Delivery Date", "Delivered to Client Date"])
panel = pd.read_csv(PROCESSED / "scoring_panel_carboplatin.csv", index_col="manufacturer_id")
shape("SCMS clean", scms)
shape("2026 carboplatin panel", panel)
train_mask = scms["sched_year"] <= 2013
print(f"Train (to 2013): {train_mask.sum():,} lines, late {scms.loc[train_mask, 'late'].mean():.2%}")
print(f"Test (2014-2015): {(~train_mask).sum():,} lines, late {scms.loc[~train_mask, 'late'].mean():.2%}")
print("Late share by origin in train (countries with 30+ train lines):")
tr = scms[train_mask]
by_origin = tr.groupby("origin_country")["late"].agg(["size", "mean"]).query("size >= 30").sort_values("mean", ascending=False)
print(by_origin.round(3).to_string())
"""),
    bi("eda_scms"),
    code("""
cit_raw = pd.read_excel(RAW / "fda_dashboard_citations_20261114.xlsx")
shape("FDA citations (all programmes)", cit_raw)
cit = cit_raw[cit_raw["Program Area"].eq("Drugs") & cit_raw["Act/CFR Number"].astype(str).str.startswith("21 CFR 211")].copy()
shape("Drug citations under 21 CFR 211 (current good manufacturing practice)", cit)
cit["section"] = cit["Act/CFR Number"].str.extract(r"211\\.(\\d+)")[0].astype(int)
print("Most cited sections:", cit["section"].value_counts().head(10).to_dict())
print("Text length (characters):", cit["Long Description"].str.len().describe()[["mean", "50%", "max"]].round(0).to_dict())
"""),
    bi("eda_cit"),
    md("""
**Section summary.** The SCMS target is imbalanced and drifts upward in the test years, and the citation corpus is large (tens of thousands of observations) with a clear legal label (the CFR section) on every row. Both facts drive the preprocessing choices below.
"""),
    md("""
## 3. Preprocessing

### 3.1 Delivery model features and a leakage-safe site prior

**Section intro.** Features are exactly the five named in override 2: origin country, shipment mode, freight-to-value ratio, shipment weight (log kg) and a **site prior**. Insurance ratio and line value are left out: they describe the commercial terms of a line, not lane behaviour, and the insurance rate in SCMS changes with the calendar year, which would let the model learn the period instead of the lane. The site prior is: the smoothed historical late rate of the manufacturing site. To avoid leakage, the prior for a training line is computed out-of-fold (5 folds) from other training lines, and the prior for a test line uses training years only. Smoothing pulls small sites toward the overall rate: prior = (late lines + 20 x overall rate) / (lines + 20). Origin countries with fewer than 30 training lines are grouped as "Other".
"""),
    code("""
SMOOTH = 20
shape("Before feature preparation", scms)
train = scms[train_mask].copy()
test = scms[~train_mask].copy()
global_rate = train["late"].mean()

def site_prior_table(frame):
    g = frame.groupby("Manufacturing Site")["late"].agg(["sum", "size"])
    return (g["sum"] + SMOOTH * global_rate) / (g["size"] + SMOOTH)

train["site_prior"] = np.nan
for fit_idx, enc_idx in KFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE).split(train):
    table = site_prior_table(train.iloc[fit_idx])
    train.iloc[enc_idx, train.columns.get_loc("site_prior")] = train.iloc[enc_idx]["Manufacturing Site"].map(table).fillna(global_rate).values
full_prior = site_prior_table(train)
test["site_prior"] = test["Manufacturing Site"].map(full_prior).fillna(global_rate)

keep_origins = train["origin_country"].value_counts()
keep_origins = sorted(keep_origins[keep_origins >= 30].index)
for frame in (train, test):
    frame["origin_group"] = np.where(frame["origin_country"].isin(keep_origins), frame["origin_country"], "Other")

CAT = ["origin_group", "shipment_mode"]
NUM = ["freight_to_value", "log_weight_kg", "site_prior"]  # override 2: origin, mode, freight ratio, weight, site prior
encoder = OneHotEncoder(handle_unknown="ignore", sparse_output=False).fit(train[CAT])
def matrix(frame):
    X = pd.DataFrame(encoder.transform(frame[CAT]), columns=encoder.get_feature_names_out(CAT), index=frame.index)
    return pd.concat([X, frame[NUM]], axis=1)
X_train, X_test = matrix(train), matrix(test)
y_train, y_test = train["late"].values, test["late"].values
shape("X_train", X_train)
shape("X_test", X_test)
print("Origin groups kept:", keep_origins)
print(f"Overall train late rate (prior centre): {global_rate:.4f}")
"""),
    bi("prep_xgb"),
    md("""
### 3.2 Class imbalance

**Section intro.** We handle the imbalance explicitly rather than by resampling, which would distort the time order. XGBoost uses `scale_pos_weight` = on-time lines / late lines in training; the logistic baseline uses `class_weight="balanced"`, which applies the same reweighting. Because reweighting inflates predicted probabilities, C2 is reported after an exact prior correction: p = s / (s + (1 - s) x w), where s is the reweighted score and w the weight.
"""),
    code("""
neg, pos = (y_train == 0).sum(), (y_train == 1).sum()
SPW = neg / pos
print(f"Training lines: {neg:,} on time, {pos:,} late, scale_pos_weight = {SPW:.3f}")
def prior_correct(score, w=SPW):
    return score / (score + (1 - score) * w)
print(f"Example: a reweighted score of 0.50 corresponds to a late probability of {prior_correct(0.5):.3f}")
"""),
    bi("imbalance"),
    md("""
### 3.3 Citation text preparation for the NLP classifier

**Section intro.** Labels come from the CFR section cited (weak labels, assumption A20). The CFR number is removed from the text so the model must learn from the words, not the legal reference. Exact duplicate texts are collapsed before the train/test split, otherwise the same sentence could sit on both sides.
"""),
    code("""
LABELS = {
    "Data integrity": [68, 180, 186, 188, 194],
    "Sterility and contamination": [28, 42, 46, 56, 67, 113],
    "Process validation": [100, 110],
    "Quality unit": [22, 192, 198],
}
section_to_label = {s: lab for lab, secs in LABELS.items() for s in secs}
shape("Before labelling", cit)
cit["label"] = cit["section"].map(section_to_label).fillna("Other GMP")
cit["text"] = (cit["Long Description"].fillna("").str.replace(r"21\\s*CFR\\s*[\\d\\.\\(\\)a-z]+", " ", regex=True)
               .str.replace(r"\\s+", " ", regex=True).str.strip())
cit = cit[cit["text"].str.len() >= 20]
shape("After labelling and text cleaning", cit)
corpus = cit.drop_duplicates(subset=["text", "label"])[["text", "label"]]
conflict = corpus["text"].duplicated(keep=False)
corpus = corpus[~conflict]
shape("Unique texts with one consistent label", corpus)
print(f"Texts dropped because the same sentence carried two labels: {conflict.sum()}")
print(corpus["label"].value_counts().to_string())
"""),
    bi("prep_nlp"),
    md("""
**Section summary.** Both training sets are now leakage-safe: the delivery model never sees test-year outcomes in its site prior, and the NLP model never sees the same sentence in train and test.
"""),
    md("""
## 4. Modelling

### 4.1 Build step 4 - Predict disruption (C2): XGBoost vs logistic regression

**Section intro.** We tune only the tree depth, on an inner time split (train to 2012, validate on 2013), so the 2014-2015 test set stays untouched. Then both models are fitted on all training years.
"""),
    code("""
inner_tr = (train["sched_year"] <= 2012).values
xgb_params = dict(n_estimators=300, learning_rate=0.05, subsample=0.8, colsample_bytree=0.8, min_child_weight=5,
                  eval_metric="logloss", random_state=RANDOM_STATE, n_jobs=4)
depth_scores = {}
for depth in [3, 4, 5]:
    m = xgb.XGBClassifier(max_depth=depth, scale_pos_weight=neg / pos, **xgb_params).fit(X_train[inner_tr], y_train[inner_tr])
    depth_scores[depth] = roc_auc_score(y_train[~inner_tr], m.predict_proba(X_train[~inner_tr])[:, 1])
best_depth = max(depth_scores, key=depth_scores.get)
print("Inner validation ROC-AUC by depth (2013):", {k: round(float(v), 4) for k, v in depth_scores.items()}, "| chosen depth:", best_depth)

xgb_model = xgb.XGBClassifier(max_depth=best_depth, scale_pos_weight=SPW, **xgb_params).fit(X_train, y_train)
logit = make_pipeline(SimpleImputer(strategy="median"), StandardScaler(),
                      LogisticRegression(class_weight="balanced", max_iter=2000, random_state=RANDOM_STATE)).fit(X_train, y_train)
scores = {"XGBoost": xgb_model.predict_proba(X_test)[:, 1], "Logistic regression": logit.predict_proba(X_test)[:, 1]}
rows = []
for name, s in scores.items():
    pred = (s >= 0.5).astype(int)
    rows.append({"model": name, "roc_auc": roc_auc_score(y_test, s), "pr_auc": average_precision_score(y_test, s),
                 "recall_late": recall_score(y_test, pred), "precision_late": precision_score(y_test, pred),
                 "f1_late": f1_score(y_test, pred), "flagged_share": pred.mean()})
metrics = pd.DataFrame(rows).set_index("model")
# Fair comparison: recall of each model when both flag the same share of lines as XGBoost does at 0.5
xgb_share = metrics.loc["XGBoost", "flagged_share"]
for name, s in scores.items():
    cut = np.quantile(s, 1 - xgb_share)
    metrics.loc[name, "recall_at_equal_flag_share"] = recall_score(y_test, (s >= cut).astype(int))
print(f"Test set: {len(y_test):,} lines, {y_test.sum()} late ({y_test.mean():.2%}); a random model has PR-AUC = {y_test.mean():.3f}")
metrics.round(4)
"""),
    bi("metrics"),
    code("""
fig, axes = plt.subplots(1, 3, figsize=(15, 4.4))
for (name, s), color in zip(scores.items(), [PALETTE[0], PALETTE[1]]):
    fpr, tpr, _ = roc_curve(y_test, s)
    axes[0].plot(fpr, tpr, color=color, label=f"{name} (AUC {roc_auc_score(y_test, s):.3f})")
axes[0].plot([0, 1], [0, 1], color="#999999", linestyle="--", label="Random (AUC 0.500)")
axes[0].set_title("ROC curve on 2014-2015 test lines")
axes[0].set_xlabel("False positive rate (share of on-time lines flagged)")
axes[0].set_ylabel("True positive rate (recall of late lines)")
axes[0].legend(loc="lower right", fontsize=8)
cms = {}
for ax, (name, s) in zip(axes[1:], scores.items()):
    cm = confusion_matrix(y_test, (s >= 0.5).astype(int))
    cms[name] = cm
    sns.heatmap(cm, annot=True, fmt=",d", cmap="Blues", cbar=False, ax=ax,
                xticklabels=["Predicted on time", "Predicted late"], yticklabels=["Actual on time", "Actual late"])
    ax.set_title(f"Confusion matrix: {name} (threshold 0.5)")
    ax.set_xlabel("Model prediction")
    ax.set_ylabel("Actual outcome")
save_fig(fig, "fig_07_c2_roc_confusion", "USAID SCMS, train 2006-2013 (7,779 lines), test 2014-2015 (2,545 lines); class weights = on-time/late ratio")
plt.show()
"""),
    bi("fig07"),
    code("""
explainer = shap.TreeExplainer(xgb_model)
shap_test = explainer.shap_values(X_test)
def group_of(col):
    if col.startswith("origin_group_"):
        return "Origin country"
    if col.startswith("shipment_mode_"):
        return "Shipment mode"
    return {"freight_to_value": "Freight-to-value ratio", "log_weight_kg": "Shipment weight", "site_prior": "Site history (prior late rate)"}[col]
groups = [group_of(c) for c in X_test.columns]
shap_grouped = pd.DataFrame(shap_test, columns=X_test.columns).T.groupby(groups).sum().T
importance = shap_grouped.abs().mean().sort_values(ascending=False).rename("mean_abs_shap")
fig, ax = plt.subplots(figsize=(8.5, 4))
ax.barh(importance.index[::-1], importance.values[::-1], color=PALETTE[0])
ax.set_title("What drives predicted late delivery (XGBoost, SHAP)")
ax.set_xlabel("Mean absolute SHAP value (log-odds of late delivery)")
ax.set_ylabel("Feature group")
save_fig(fig, "fig_08_c2_shap_drivers", "XGBoost on USAID SCMS 2014-2015 test lines; one-hot columns summed into feature groups")
plt.show()
importance.round(4)
"""),
    bi("shap"),
    md("""
### 4.2 Apply the delivery model to the 11 carboplatin makers (C2)

**Section intro.** Each maker gets one feature row built from its own evidence: plant country (notebook 02), air mode (assumption A25: oncology injectables reach the GCC by air), and the median freight ratio and weight of SCMS air lines from that country. The site prior uses the maker's parent sites where SCMS history exists (Eugia via Aurobindo, Gland Pharma), and the overall training rate otherwise. SHAP gives the top 3 reasons for each score in plain English.
"""),
    code("""
air_train = train[train["shipment_mode"].isin(["Air", "Air Charter"])]
profile = air_train.groupby("origin_country")[["freight_to_value", "log_weight_kg"]].median()
parent_sites = {"EUGIA": ["Aurobindo Unit III, India", "Aurobindo Unit VII, IN"],
                "GLAND": ["Gland Pharma Ltd Pally Factory", "Gland Pharma, Hyderabad, IN"]}
site_lines = train.groupby("Manufacturing Site").size()
rows = []
for maker, r in panel.iterrows():
    country = r["manufacturing_country"]
    sites = [s for s in parent_sites.get(maker, []) if s in full_prior.index]
    prior = float(np.average(full_prior[sites], weights=site_lines[sites])) if sites else global_rate
    rows.append({"manufacturer_id": maker, "origin_group": country if country in keep_origins else "Other", "shipment_mode": "Air",
                 **profile.loc[country].to_dict(), "site_prior": prior, "site_prior_source": "parent SCMS sites" if sites else "overall training rate"})
makers = pd.DataFrame(rows).set_index("manufacturer_id")
X_makers = matrix(makers)
shape("Maker feature matrix", X_makers)
raw_score = xgb_model.predict_proba(X_makers)[:, 1]
makers["c2_reweighted_score"] = raw_score
makers["C2_delivery_risk"] = prior_correct(raw_score)
shap_makers = pd.DataFrame(explainer.shap_values(X_makers), columns=X_makers.columns, index=X_makers.index)
shap_makers_grouped = shap_makers.T.groupby(groups).sum().T

def reason_text(group, value, row):
    direction = "raises" if value > 0 else "lowers"
    if group == "Origin country":
        detail = f"Plant country {row['origin_group']}"
    elif group == "Shipment mode":
        detail = "Air shipment mode"
    elif group == "Freight-to-value ratio":
        detail = f"Freight cost at {row['freight_to_value']:.1%} of value (origin median)"
    elif group == "Shipment weight":
        detail = f"Typical air consignment of {np.expm1(row['log_weight_kg']):,.0f} kg from this origin"
    else:
        detail = f"Site history: {row['site_prior']:.1%} prior late rate ({row['site_prior_source']})"
    return f"{detail} {direction} delay risk"

top3 = {}
for maker in makers.index:
    s = shap_makers_grouped.loc[maker]
    order = s.abs().sort_values(ascending=False).index[:3]
    top3[maker] = [{"feature": g, "shap_log_odds": round(float(s[g]), 4), "reason": reason_text(g, s[g], makers.loc[maker])} for g in order]
makers["shap_top3_reasons"] = [json.dumps(top3[m]) for m in makers.index]
makers[["origin_group", "site_prior", "site_prior_source", "c2_reweighted_score", "C2_delivery_risk"]].sort_values("C2_delivery_risk").round(4)
"""),
    bi("c2_makers"),
    code("""
for maker in ["EUGIA", "HOSPIRA", "APOTEX"]:
    print(maker, "| C2 =", round(float(makers.loc[maker, "C2_delivery_risk"]), 4))
    for item in top3[maker]:
        print(f"   {item['reason']} ({item['shap_log_odds']:+.3f} log-odds)")
"""),
    bi("reasons"),
    md("""
### 4.3 Build step 5 - Price and freight anomalies (C3): Isolation Forest

**Section intro.** Prices are only comparable within the same product, so one Isolation Forest is fitted per molecule and dosage form group with at least 50 lines (assumption A26, Phase 0 fix F14). Features are relative to the group: log of unit price over the group median, freight-to-value ratio (missing values filled with the group median) and log of line value over the group median. Contamination is 0.05, as the plan specifies, with random_state 42.
"""),
    code("""
scms["group"] = scms["Molecule/Test Type"] + " | " + scms["Dosage Form"]
group_size = scms["group"].value_counts()
eligible = group_size[group_size >= 50].index
iso = scms[scms["group"].isin(eligible) & (scms["Unit Price"] > 0) & (scms["Line Item Value"] > 0)].copy()
shape("Lines before group filter", scms)
shape("Lines in groups with 50+ lines and positive price", iso)
print(f"Groups modelled: {iso['group'].nunique()}")
parts = []
for g, frame in iso.groupby("group"):
    f = pd.DataFrame(index=frame.index)
    f["rel_unit_price"] = np.log(frame["Unit Price"] / frame["Unit Price"].median())
    f["freight_filled"] = frame["freight_to_value"].fillna(frame["freight_to_value"].median()).fillna(0)
    f["rel_line_value"] = np.log(frame["Line Item Value"] / frame["Line Item Value"].median())
    forest = IsolationForest(n_estimators=200, contamination=0.05, random_state=RANDOM_STATE).fit(f)
    f["anomaly_score"] = -forest.score_samples(f)
    f["flagged"] = forest.predict(f[["rel_unit_price", "freight_filled", "rel_line_value"]]) == -1
    parts.append(f)
flags = pd.concat(parts)
iso = iso.join(flags)
population_rate = iso["flagged"].mean()
print(f"Lines flagged: {iso['flagged'].sum():,} of {len(iso):,} = {population_rate:.2%}")
"""),
    bi("iforest"),
    code("""
top = iso.sort_values("anomaly_score", ascending=False).head(3)
examples = []
for idx, r in top.iterrows():
    grp_med_price = iso.loc[iso["group"] == r["group"], "Unit Price"].median()
    grp_med_freight = iso.loc[iso["group"] == r["group"], "freight_to_value"].median()
    examples.append({"line_id": int(r["ID"]), "product_group": r["group"], "vendor": r["Vendor"], "origin_country": r["origin_country"],
                     "year": int(r["sched_year"]), "unit_price_usd": round(float(r["Unit Price"]), 4),
                     "group_median_unit_price_usd": round(float(grp_med_price), 4),
                     "price_vs_median_x": round(float(r["Unit Price"] / grp_med_price), 2),
                     "freight_to_value": None if pd.isna(r["freight_to_value"]) else round(float(r["freight_to_value"]), 4),
                     "group_median_freight_to_value": round(float(grp_med_freight), 4),
                     "line_value_usd": round(float(r["Line Item Value"]), 2), "anomaly_score": round(float(r["anomaly_score"]), 4)})
anomalies = pd.DataFrame(examples)
anomalies
"""),
    bi("anomalies"),
    code("""
show_group = iso["group"].value_counts().index[0]
g = iso[iso["group"] == show_group]
fig, ax = plt.subplots(figsize=(9, 4.6))
ax.scatter(g.loc[~g.flagged, "rel_unit_price"], g.loc[~g.flagged, "freight_filled"], s=10, alpha=0.4, color=PALETTE[0], label="Normal line")
ax.scatter(g.loc[g.flagged, "rel_unit_price"], g.loc[g.flagged, "freight_filled"], s=22, alpha=0.9, color=PALETTE[1], label="Flagged by Isolation Forest")
ax.set_title(f"Price and freight anomalies in the largest group: {show_group}")
ax.set_xlabel("Unit price relative to group median (log ratio; 0 = median)")
ax.set_ylabel("Freight cost / line value (ratio, group median if missing)")
ax.legend(loc="upper right")
save_fig(fig, "fig_09_c3_iforest_scatter", f"USAID SCMS; Isolation Forest per product group, contamination 0.05, n = {len(g):,} lines in this group")
plt.show()
"""),
    bi("fig09"),
    code("""
parent_patterns = {"EUGIA": r"\\bAurobindo\\b", "GLAND": r"\\bGland\\b"}
c3_rows = []
for maker in panel.index:
    pattern = parent_patterns.get(maker)
    if pattern:
        lines = iso[iso["Manufacturing Site"].str.contains(pattern, case=False, regex=True)]
        all_lines = scms[scms["Manufacturing Site"].str.contains(pattern, case=False, regex=True)]
    else:
        lines, all_lines = iso.iloc[0:0], scms.iloc[0:0]
    if len(lines) > 0:
        c3_rows.append({"manufacturer_id": maker, "c3_lines_scored": len(lines), "c3_lines_flagged": int(lines["flagged"].sum()),
                        "C3_price_integrity": lines["flagged"].mean(), "c3_status": "scored from SCMS invoice lines"})
    else:
        reason = "no invoice history" if len(all_lines) == 0 else "invoice lines outside modelled groups"
        c3_rows.append({"manufacturer_id": maker, "c3_lines_scored": 0, "c3_lines_flagged": 0,
                        "C3_price_integrity": population_rate, "c3_status": reason})
c3 = pd.DataFrame(c3_rows).set_index("manufacturer_id")
print(f"Makers without scored lines receive the population flag rate ({population_rate:.4f}) as a neutral value, labelled with the reason.")
c3.round(4)
"""),
    bi("c3"),
    md("""
### 4.4 Build step 6a - NLP violation classifier (C4 input)

**Section intro.** TF-IDF turns each citation into word and two-word phrase weights; a multinomial logistic regression with balanced class weights predicts one of five classes. We compare it with a simple keyword baseline so the value of learning is visible. The split is stratified 80/20 with random_state 42.
"""),
    code("""
X_txt_tr, X_txt_te, y_txt_tr, y_txt_te = train_test_split(corpus["text"], corpus["label"], test_size=0.2,
                                                          stratify=corpus["label"], random_state=RANDOM_STATE)
print(f"NLP train: {len(X_txt_tr):,} texts | test: {len(X_txt_te):,} texts")
tfidf = TfidfVectorizer(ngram_range=(1, 2), min_df=3, max_features=50000, sublinear_tf=True, stop_words="english")
Xt_tr = tfidf.fit_transform(X_txt_tr)
Xt_te = tfidf.transform(X_txt_te)
nlp = LogisticRegression(class_weight="balanced", max_iter=3000, C=4.0, random_state=RANDOM_STATE).fit(Xt_tr, y_txt_tr)
pred_te = nlp.predict(Xt_te)

KEYWORDS = {"Data integrity": ["record", "data", "computer", "audit trail", "electronic"],
            "Sterility and contamination": ["steril", "aseptic", "microb", "contamina", "clean", "environmental monitoring"],
            "Process validation": ["validat", "process control", "production and process"],
            "Quality unit": ["quality control unit", "quality unit", "investigat", "complaint"]}
def keyword_rule(text):
    t = text.lower()
    for label, words in KEYWORDS.items():
        if any(w in t for w in words):
            return label
    return "Other GMP"
pred_kw = X_txt_te.map(keyword_rule)
nlp_metrics = pd.DataFrame({
    "macro_f1": [f1_score(y_txt_te, pred_te, average="macro"), f1_score(y_txt_te, pred_kw, average="macro")],
    "accuracy": [(pred_te == y_txt_te).mean(), (pred_kw == y_txt_te).mean()]}, index=["TF-IDF + logistic regression", "Keyword rules baseline"])
print(classification_report(y_txt_te, pred_te, digits=3))
nlp_metrics.round(4)
"""),
    bi("nlp_metrics"),
    code("""
labels_order = ["Data integrity", "Sterility and contamination", "Process validation", "Quality unit", "Other GMP"]
cm_txt = confusion_matrix(y_txt_te, pred_te, labels=labels_order, normalize="true")
fig, axes = plt.subplots(1, 2, figsize=(14, 4.8))
dist = corpus["label"].value_counts().reindex(labels_order)
axes[0].barh(dist.index[::-1], dist.values[::-1], color=PALETTE[3])
axes[0].set_title("NLP training corpus by violation class")
axes[0].set_xlabel("Unique citation texts (count)")
axes[0].set_ylabel("Violation class (from CFR section)")
sns.heatmap(cm_txt, annot=True, fmt=".2f", cmap="Purples", ax=axes[1], xticklabels=[l.replace(" and ", " & ") for l in labels_order],
            yticklabels=labels_order, cbar_kws={"label": "Share of true class"})
axes[1].set_title("NLP confusion matrix on held-out texts (row-normalised)")
axes[1].set_xlabel("Predicted class")
axes[1].set_ylabel("True class (CFR label)")
axes[1].tick_params(axis="x", rotation=30)
save_fig(fig, "fig_10_nlp_classes_confusion", "FDA Data Dashboard inspection citations, drugs, 21 CFR 211 (export 14 Nov 2026); weak labels from CFR section")
plt.show()
"""),
    bi("fig10"),
    md("""
**Hand-check of a random sample.** The weak labels come from the legal section, not from a person reading the text. To test whether they make sense, 12 random held-out citations are printed below with the CFR label and the model prediction. Each one was read and judged; the verdicts are recorded in the table after the output.
"""),
    code("""
sample = pd.DataFrame({"text": X_txt_te, "cfr_label": y_txt_te, "model_prediction": pred_te}).sample(12, random_state=RANDOM_STATE)
for i, r in enumerate(sample.itertuples(), 1):
    print(f"[{i}] CFR label: {r.cfr_label} | model: {r.model_prediction}")
    print(f"    {r.text[:260]}")
"""),
    md(INTERP["handcheck"]),
    code("""
term_rows = []
for k, label in enumerate(nlp.classes_):
    top_idx = np.argsort(nlp.coef_[k])[::-1][:6]
    term_rows.append({"class": label, "top_terms": ", ".join(tfidf.get_feature_names_out()[top_idx])})
pd.DataFrame(term_rows)
"""),
    bi("terms"),
    md("""
### 4.5 NLP severity per carboplatin maker

**Section intro.** We score every citation linked to a maker's FDA inspections in the last 5 years. Each class has a severity weight (assumption A24): data integrity 1.0, sterility and contamination 1.0, quality unit 0.8, process validation 0.7, other GMP 0.4. A citation's severity is the probability-weighted sum; a maker's NLP severity is the mean over its citations. Makers with no citations score 0 with the label "no citations in 5 years".
"""),
    code("""
SEVERITY = {"Data integrity": 1.0, "Sterility and contamination": 1.0, "Quality unit": 0.8, "Process validation": 0.7, "Other GMP": 0.4}
matched = pd.read_csv(PROCESSED / "fda_matched_inspections.csv", parse_dates=["Inspection End Date"])
recent_ids = matched[matched["Inspection End Date"] >= pd.Timestamp("2021-11-14")][["maker_id", "Inspection ID"]]
maker_cit = cit_raw.merge(recent_ids, on="Inspection ID", how="inner")
maker_cit = maker_cit[maker_cit["Program Area"].eq("Drugs")].copy()
shape("Citations linked to carboplatin makers (5 years)", maker_cit)
maker_cit["text"] = (maker_cit["Long Description"].fillna("").str.replace(r"21\\s*CFR\\s*[\\d\\.\\(\\)a-z]+", " ", regex=True)
                     .str.replace(r"\\s+", " ", regex=True).str.strip())
proba = nlp.predict_proba(tfidf.transform(maker_cit["text"]))
weights = np.array([SEVERITY[c] for c in nlp.classes_])
maker_cit["severity"] = proba @ weights
maker_cit["predicted_class"] = nlp.classes_[proba.argmax(axis=1)]
sev = maker_cit.groupby("maker_id").agg(nlp_citations_5yr=("severity", "size"), nlp_severity=("severity", "mean"))
class_mix = maker_cit.groupby(["maker_id", "predicted_class"]).size().unstack(fill_value=0)
sev = panel[[]].join(sev).join(class_mix)
sev["nlp_citations_5yr"] = sev["nlp_citations_5yr"].fillna(0).astype(int)
sev["nlp_severity"] = sev["nlp_severity"].fillna(0.0)
sev["nlp_status"] = np.where(sev["nlp_citations_5yr"] > 0, "scored from FDA citations", "no citations in 5 years")
sev = sev.fillna(0)
sev.round(3)
"""),
    bi("severity"),
    md("""
### 4.6 Build step 6b - Contract clause extraction (synthetic contracts, demonstration only)

**Section intro.** Three short supply contracts were written with GenAI for this demo and are clearly labelled SYNTHETIC [GENAI] (pipeline/reference/synthetic_contracts). A transparent rule-based extractor (Phase 0 fix F19, chosen over a live LLM call so the result is reproducible and costs nothing) finds five clause types and scores contract risk from 0 to 1. Because the contracts are synthetic, these scores are **not** used in the supplier ranking (decision D9).
"""),
    code("""
def extract_clauses(text):
    t = text.lower()
    out = {}
    m = re.search(r"within (\\d+) days of the order date", t)
    out["lead_time_days"] = int(m.group(1)) if m else None
    out["lead_time_firm"] = bool(re.search(r"shall deliver", t))
    m = re.search(r"(\\d+(?:\\.\\d+)?)% of the order value per week", t)
    out["late_penalty_pct_per_week"] = float(m.group(1)) if m else 0.0
    fm = re.search(r"force majeure\\.(.*?)(?:clause \\d+\\.|$)", t, re.S)
    fm_text = fm.group(1) if fm else ""
    out["force_majeure_covers_route_closure"] = bool(re.search(r"strait|shipping route|airspace|blockade", fm_text))
    out["force_majeure_requires_mitigation"] = bool(re.search(r"alternative route|substitute plant|reasonable efforts", fm_text)) and not re.search(r"no obligation", fm_text)
    out["sole_source_commitment"] = bool(re.search(r"100% of its requirement|sole source", t))
    m = re.search(r"at least (\\d+)% of its requirement", t)
    out["minimum_volume_commitment_pct"] = int(m.group(1)) if m else (100 if out["sole_source_commitment"] else 0)
    out["price_revisable_on_notice"] = bool(re.search(r"may revise prices", t))
    return out

def contract_risk(c):
    score = 0.0
    score += 0.25 if (c["lead_time_days"] or 999) > 60 or not c["lead_time_firm"] else 0.0
    score += 0.25 if c["late_penalty_pct_per_week"] == 0 else 0.0
    score += 0.25 if c["force_majeure_covers_route_closure"] and not c["force_majeure_requires_mitigation"] else 0.0
    score += 0.15 if c["minimum_volume_commitment_pct"] >= 100 else (0.05 if c["minimum_volume_commitment_pct"] > 50 else 0.0)
    score += 0.10 if c["price_revisable_on_notice"] else 0.0
    return round(score, 2)

contract_rows = []
for path in sorted((REFERENCE / "synthetic_contracts").glob("contract_*.txt")):
    text = path.read_text(encoding="utf-8")
    assert text.startswith("SYNTHETIC CONTRACT"), "Only synthetic contracts may be processed in this demo"
    c = extract_clauses(text)
    contract_rows.append({"contract": path.stem, "synthetic": True, **c, "contract_risk": contract_risk(c)})
contracts = pd.DataFrame(contract_rows).set_index("contract")
contracts.T
"""),
    bi("contracts"),
    md("""
**Section summary.** All three engines produce one value per maker: C2 from the delivery model with SHAP reasons, C3 where real invoice lines exist (with an explicit status otherwise), and an NLP severity for C4 built from real FDA citation text. The contract extractor is shown working on synthetic contracts only.
"""),
    md("""
## 5. Evaluation summary and saved outputs

**Section intro.** We collect the evaluation numbers in one table, check that every maker has a value for every engine, and save the outputs that notebook 04 and the web app read.
"""),
    code("""
out = panel[[]].join(makers[["C2_delivery_risk", "c2_reweighted_score", "site_prior", "site_prior_source", "shap_top3_reasons"]]).join(c3).join(sev[["nlp_citations_5yr", "nlp_severity", "nlp_status"]])
assert out[["C2_delivery_risk", "C3_price_integrity", "nlp_severity"]].notna().all().all()
out.index.name = "manufacturer_id"
out.to_csv(PROCESSED / "model_outputs_carboplatin.csv")
shape("Saved data/processed/model_outputs_carboplatin.csv", out)

xgb_row, lr_row = metrics.loc["XGBoost"], metrics.loc["Logistic regression"]
model_metrics = {
    "c2": {"train_period": "scheduled 2006-2013", "test_period": "scheduled 2014-2015", "train_lines": int(len(y_train)), "test_lines": int(len(y_test)),
           "test_late_lines": int(y_test.sum()), "test_late_rate": round(float(y_test.mean()), 4), "scale_pos_weight": round(float(SPW), 4),
           "chosen_max_depth": int(best_depth), "inner_validation_auc_by_depth": {str(k): round(v, 4) for k, v in depth_scores.items()},
           "models": {name: {k: round(float(v), 6) for k, v in metrics.loc[name].items()} for name in metrics.index},
           "confusion_matrices": {name: {"tn": int(cm[0, 0]), "fp": int(cm[0, 1]), "fn": int(cm[1, 0]), "tp": int(cm[1, 1])} for name, cm in cms.items()},
           "threshold": 0.5},
    "c3": {"groups_modelled": int(iso["group"].nunique()), "lines_scored": int(len(iso)), "lines_flagged": int(iso["flagged"].sum()),
           "population_flag_rate": round(float(population_rate), 4), "contamination": 0.05},
    "nlp": {"train_texts": int(len(X_txt_tr)), "test_texts": int(len(X_txt_te)), "classes": labels_order,
            "macro_f1": round(float(nlp_metrics.loc["TF-IDF + logistic regression", "macro_f1"]), 4),
            "accuracy": round(float(nlp_metrics.loc["TF-IDF + logistic regression", "accuracy"]), 4),
            "baseline_macro_f1": round(float(nlp_metrics.loc["Keyword rules baseline", "macro_f1"]), 4),
            "per_class_f1": {l: round(float(f1_score(y_txt_te, pred_te, labels=[l], average="macro")), 4) for l in labels_order}},
}
(PROCESSED / "model_metrics.json").write_text(json.dumps(model_metrics, indent=2), encoding="utf-8")
(PROCESSED / "shap_summary.json").write_text(json.dumps({"global_importance": {k: round(float(v), 4) for k, v in importance.items()},
    "per_maker": top3, "unit": "mean absolute SHAP value, log-odds of late delivery"}, indent=2), encoding="utf-8")
(PROCESSED / "iforest_anomalies.json").write_text(json.dumps({"examples": examples, "population_flag_rate": round(float(population_rate), 4)}, indent=2), encoding="utf-8")
samples = maker_cit.sort_values("severity", ascending=False).groupby("maker_id").head(2)
(PROCESSED / "nlp_summary.json").write_text(json.dumps({
    "corpus_class_counts": {k: int(v) for k, v in dist.items()}, "severity_weights": SEVERITY,
    "per_maker": {m: {"citations_5yr": int(r["nlp_citations_5yr"]), "severity": round(float(r["nlp_severity"]), 4), "status": r["nlp_status"],
                      "class_counts": {c: int(r[c]) for c in labels_order if c in sev.columns}} for m, r in sev.iterrows()},
    "examples": [{"maker_id": r["maker_id"], "predicted_class": r["predicted_class"], "severity": round(float(r["severity"]), 3),
                  "text": r["text"][:300]} for _, r in samples.iterrows()]}, indent=2), encoding="utf-8")
(PROCESSED / "contract_clauses.json").write_text(json.dumps({"synthetic": True, "note": "SYNTHETIC [GENAI] contracts for demonstration only; not used in the ranking",
    "contracts": contracts.reset_index().to_dict(orient="records")}, indent=2, default=str), encoding="utf-8")
print("Saved model_metrics.json, shap_summary.json, iforest_anomalies.json, nlp_summary.json, contract_clauses.json")
pd.DataFrame({"engine": ["C2 XGBoost", "C2 logistic baseline", "C3 Isolation Forest", "C4 NLP TF-IDF + LR", "C4 NLP keyword baseline"],
              "headline_metric": [f"ROC-AUC {xgb_row.roc_auc:.3f}, recall {xgb_row.recall_late:.3f}", f"ROC-AUC {lr_row.roc_auc:.3f}, recall {lr_row.recall_late:.3f}",
                                  f"{iso['flagged'].sum():,} of {len(iso):,} lines flagged ({population_rate:.2%})",
                                  f"macro F1 {model_metrics['nlp']['macro_f1']:.3f}", f"macro F1 {model_metrics['nlp']['baseline_macro_f1']:.3f}"]})
"""),
    bi("summary"),
    code("""
fig, axes = plt.subplots(1, 2, figsize=(13, 4.4))
order = out.sort_values("C2_delivery_risk").index
axes[0].barh(order, out.loc[order, "C2_delivery_risk"] * 100, color=[PALETTE[1] if s == "parent SCMS sites" else PALETTE[0] for s in out.loc[order, "site_prior_source"]])
axes[0].set_title("C2: predicted probability of late delivery per maker")
axes[0].set_xlabel("Probability of a late shipment (%, prior-corrected)")
axes[0].set_ylabel("Maker")
from matplotlib.patches import Patch
axes[0].legend(handles=[Patch(color=PALETTE[1], label="Site prior from parent SCMS sites"), Patch(color=PALETTE[0], label="Overall training prior")], loc="lower right", fontsize=8)
order2 = out.sort_values("nlp_severity").index
axes[1].barh(order2, out.loc[order2, "nlp_severity"], color=PALETTE[3])
for i, m in enumerate(order2):
    axes[1].text(out.loc[m, "nlp_severity"] + 0.01, i, f"n={out.loc[m, 'nlp_citations_5yr']}", va="center", fontsize=8)
axes[1].set_title("C4 input: NLP severity of FDA citations (5 years)")
axes[1].set_xlabel("Mean citation severity (0 to 1)")
axes[1].set_ylabel("Maker")
save_fig(fig, "fig_11_c2_c4_per_maker", "XGBoost on SCMS applied to maker profiles; NLP on FDA Data Dashboard citations linked via notebook 02 matches")
plt.show()
"""),
    bi("fig11"),
    md("""
**Section summary.** The delivery model beats the baseline on the untouched test years, the anomaly engine flags a controlled 5% of lines with three explainable examples, and the NLP classifier reads violation types far better than keyword rules. Every output is saved for notebook 04.
"""),
    md("""
## 6. Conclusion
"""),
    md(INTERP["conclusion"]),
    md("""
**End of notebook 03.** Next: notebook 04 combines all criteria with AHP, entropy, TOPSIS and the MILP order split.
"""),
]

if __name__ == "__main__":
    print("built", build("03_risk_models_xgb_iforest_nlp.ipynb", cells))
