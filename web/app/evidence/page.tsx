import Chart from "@/components/Chart";
import { Badge, PageTitle, pct } from "@/components/ui";
import metrics from "@/data/model_metrics.json";
import shap from "@/data/shap.json";
import nlp from "@/data/nlp_letters.json";
import contracts from "@/data/contract_clauses.json";

type ModelRow = { roc_auc: number; pr_auc: number; recall_late: number; precision_late: number; f1_late: number; flagged_share: number; recall_at_equal_flag_share: number };
type Cm = { tn: number; fp: number; fn: number; tp: number };

function Confusion({ title, cm }: { title: string; cm: Cm }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-muted">{title}</div>
      <table className="w-full border-collapse text-center text-sm">
        <thead>
          <tr className="text-[11px] text-muted">
            <th />
            <th className="p-1">Predicted on time</th>
            <th className="p-1">Predicted late</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th className="p-1 text-[11px] font-medium text-muted">Actual on time</th>
            <td className="border bg-good-soft p-2 font-mono">{cm.tn.toLocaleString("en-US")}</td>
            <td className="border bg-warn-soft p-2 font-mono">{cm.fp.toLocaleString("en-US")}</td>
          </tr>
          <tr>
            <th className="p-1 text-[11px] font-medium text-muted">Actual late</th>
            <td className="border bg-risk-soft p-2 font-mono">{cm.fn.toLocaleString("en-US")}</td>
            <td className="border bg-good-soft p-2 font-mono">{cm.tp.toLocaleString("en-US")}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function Evidence() {
  const c2 = metrics.c2;
  const models = c2.models as Record<string, ModelRow>;
  const cms = c2.confusion_matrices as Record<string, Cm>;
  const imp = shap.global_importance as Record<string, number>;
  const impKeys = Object.keys(imp).reverse();
  const classes = nlp.corpus_class_counts as Record<string, number>;
  const perMaker = nlp.per_maker as Record<string, { citations_5yr: number; severity: number; status: string }>;
  const examples = metrics.c3.examples as Array<Record<string, string | number | null>>;
  const rows = contracts.contracts as Array<Record<string, string | number | boolean | null>>;

  return (
    <div>
      <PageTitle title="Model Evidence" question="Q3 Q4">
        How well each AI engine works on data it never saw, and what it found. All numbers come from notebook 03; the delivery-risk model is
        tested on SCMS lines {String(metrics.c2.test_period)}.
      </PageTitle>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="h-section">C2 delivery risk: XGBoost vs logistic baseline</h2>
          <p className="mt-1 text-xs text-muted">
            Trained on SCMS lines scheduled 2006-2013 ({c2.train_lines.toLocaleString("en-US")}), tested on 2014-2015 ({c2.test_lines.toLocaleString("en-US")} lines,{" "}
            {pct(c2.test_late_rate)} late). Class imbalance handled with scale_pos_weight {c2.scale_pos_weight.toFixed(2)}.
          </p>
          <div className="overflow-x-auto">
          <table className="table-clean mt-3 w-full">
            <thead>
              <tr>
                <th>Model</th>
                <th>ROC-AUC</th>
                <th>PR-AUC</th>
                <th>Recall (late)</th>
                <th>Recall at equal flag share</th>
                <th>Lines flagged</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(models).map(([name, m]) => (
                <tr key={name}>
                  <td className="font-medium">{name}</td>
                  <td className="font-mono">{m.roc_auc.toFixed(3)}</td>
                  <td className="font-mono">{m.pr_auc.toFixed(3)}</td>
                  <td className="font-mono">{pct(m.recall_late)}</td>
                  <td className="font-mono">{pct(m.recall_at_equal_flag_share)}</td>
                  <td className="font-mono">{pct(m.flagged_share)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {Object.entries(cms).map(([name, cm]) => (
              <Confusion key={name} title={`${name} (threshold 0.5)`} cm={cm} />
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="h-section">What drives late delivery (SHAP)</h2>
          <Chart
            label="Mean absolute SHAP value by feature group for late delivery"
            height={300}
            data={[
              {
                type: "bar",
                orientation: "h",
                y: impKeys,
                x: impKeys.map((k) => imp[k]),
                marker: { color: "#0d9488" },
                hovertemplate: "%{y}: %{x:.3f}<extra></extra>",
              },
            ]}
            layout={{ margin: { l: 190, r: 20, t: 10, b: 45 }, xaxis: { title: { text: "Mean absolute SHAP (log-odds of late delivery)" } } }}
          />
          <p className="text-xs text-muted">Plant history and the shape of the consignment matter more than the country alone.</p>
        </div>
      </section>

      <section className="card mt-6">
        <h2 className="h-section">C3 price integrity: 3 anomalies flagged by the Isolation Forest</h2>
        <p className="mt-1 text-xs text-muted">
          {metrics.c3.lines_flagged} of {metrics.c3.lines_scored.toLocaleString("en-US")} SCMS lines flagged ({pct(metrics.c3.population_flag_rate, 2)}) across{" "}
          {metrics.c3.groups_modelled} product groups; contamination {metrics.c3.contamination}.
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          {examples.map((e) => (
            <div key={String(e.line_id)} className="rounded-lg border border-risk/40 bg-risk-soft p-4 text-sm">
              <div className="flex items-center justify-between">
                <Badge tone="red">Line {String(e.line_id)}</Badge>
                <span className="text-xs text-muted">{String(e.year)}</span>
              </div>
              <div className="mt-2 font-medium">{String(e.product_group)}</div>
              <div className="text-xs text-muted">
                {String(e.vendor)} - {String(e.origin_country)}
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                <li>
                  Unit price {Number(e.price_vs_median_x).toFixed(2)} x group median ({String(e.unit_price_usd)} vs {String(e.group_median_unit_price_usd)} USD)
                </li>
                <li>
                  Freight {Number(e.freight_to_value).toFixed(2)} x line value (group median {Number(e.group_median_freight_to_value).toFixed(2)})
                </li>
                <li>Line value USD {Number(e.line_value_usd).toLocaleString("en-US")}</li>
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="h-section">C4 NLP: violation classes in FDA inspection citations</h2>
          <p className="mt-1 text-xs text-muted">
            TF-IDF + logistic regression, macro F1 {metrics.nlp.macro_f1.toFixed(3)} vs {metrics.nlp.baseline_macro_f1.toFixed(3)} for keyword rules on{" "}
            {metrics.nlp.test_texts} held-out texts. A hand-check found the CFR-based labels match a human reading in 10 of 12 samples (about 83%), so tags are
            auditor pointers, not verdicts.
          </p>
          <Chart
            label="Unique FDA citation texts by violation class"
            height={240}
            data={[
              {
                type: "bar",
                x: Object.keys(classes),
                y: Object.values(classes),
                marker: { color: "#8064a2" },
                hovertemplate: "%{x}: %{y} texts<extra></extra>",
              },
            ]}
            layout={{ margin: { l: 55, r: 10, t: 10, b: 70 }, yaxis: { title: { text: "Unique citation texts" } } }}
          />
        </div>
        <div className="card overflow-x-auto">
          <h2 className="h-section">NLP severity per carboplatin maker (5 years)</h2>
          <div className="overflow-x-auto">
          <table className="table-clean mt-3 w-full">
            <thead>
              <tr>
                <th>Maker</th>
                <th>Citations</th>
                <th>Mean severity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(perMaker)
                .sort((a, b) => b[1].severity - a[1].severity)
                .map(([id, p]) => (
                  <tr key={id}>
                    <td className="font-medium">{id}</td>
                    <td className="font-mono">{p.citations_5yr}</td>
                    <td className="font-mono">{p.severity.toFixed(3)}</td>
                    <td className="text-xs">{p.status}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          </div>
        </div>
      </section>

      <section className="card mt-6 overflow-x-auto">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="h-section">Contract clause extraction</h2>
          <Badge tone="amber">SYNTHETIC [GENAI] contracts - demonstration only, not used in any score</Badge>
        </div>
        <div className="overflow-x-auto">
        <table className="table-clean mt-3 w-full">
          <thead>
            <tr>
              <th>Contract</th>
              <th>Lead time</th>
              <th>Late penalty / week</th>
              <th>Force majeure covers route closure</th>
              <th>Mitigation required</th>
              <th>Volume commitment</th>
              <th>Price revisable</th>
              <th>Clause risk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={String(c.contract)}>
                <td className="font-medium">{String(c.contract)}</td>
                <td>
                  {String(c.lead_time_days)} days {c.lead_time_firm ? "(firm)" : "(best efforts)"}
                </td>
                <td>{String(c.late_penalty_pct_per_week)}%</td>
                <td>{c.force_majeure_covers_route_closure ? "Yes" : "No"}</td>
                <td>{c.force_majeure_requires_mitigation ? "Yes" : "No"}</td>
                <td>{String(c.minimum_volume_commitment_pct)}%</td>
                <td>{c.price_revisable_on_notice ? "Yes" : "No"}</td>
                <td>
                  <Badge tone={Number(c.contract_risk) >= 0.5 ? "red" : "green"}>{Number(c.contract_risk).toFixed(2)}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
    </div>
  );
}
