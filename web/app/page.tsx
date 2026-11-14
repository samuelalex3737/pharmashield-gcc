import Link from "next/link";
import { Assumption, Badge, Kpi, PageTitle } from "@/components/ui";
import { allocations, meta, suppliers } from "@/lib/data";

const LAYERS = [
  {
    n: 1,
    title: "Multi-source data ingestion",
    body: "USAID SCMS (10,324 shipment lines), openFDA NDC, Shortages and Recalls, FDA inspections and citations, Medicaid 2025 prices, World Bank LPI.",
    q: "Q2",
  },
  {
    n: 2,
    title: "Qualification filter and entity resolution",
    body: "Finished-injection listings only: 11 qualified makers. Reviewed labeler-to-maker-to-parent map plus two-test fuzzy matching.",
    q: "Q2",
  },
  {
    n: 3,
    title: "Three AI risk engines plus cost and route",
    body: "C1 landed cost, C2 XGBoost + SHAP delivery risk, C3 Isolation Forest price integrity, C4 FDA + NLP compliance, C5 route exposure.",
    q: "Q3 Q4",
  },
  {
    n: 4,
    title: "Ranking and order split",
    body: "50% AHP + 50% entropy weights, TOPSIS per mode, MILP order split with dual sourcing and probation trials.",
    q: "Q1 Q5",
  },
  {
    n: 5,
    title: "Human-in-the-loop governance",
    body: "Category manager reviews SHAP reasons, approves or overrides the split, every decision is logged. No order is sent automatically.",
    q: "Q6 Q7",
  },
];

export default function Overview() {
  const onc = meta.oncology_shortages!;
  const affected = suppliers.makers.filter((m) => m.active_fda_shortage).length;
  const rec = allocations.normal;
  return (
    <div>
      <PageTitle title="Why the GPO needs this now">
        PharmaShield GCC ranks every qualified maker of a life-critical drug on five risk criteria and recommends a dual-source order split
        that a human buyer approves. Demo SKU: {suppliers.sku_label}, Tier 1 oncology.
      </PageTitle>

      <div className="grid gap-4 md:grid-cols-3">
        <Kpi
          label="Current US oncology shortage records"
          value={String(onc.current_records)}
          sub={`covering ${onc.current_drugs} drugs (openFDA, US data, cached ${meta.data_cutoff})`}
          tone="alert"
        />
        <Kpi
          label="Carboplatin makers with a current US shortage"
          value={`${affected} of ${suppliers.makers.length}`}
          sub="qualified finished-injection makers (openFDA Drug Shortages)"
          tone="alert"
        />
        <Kpi
          label="Days to onboard a replacement supplier"
          value="25"
          sub="average; 74% face shortages in the transition (Ivalua survey via Supply Chain Dive, Jul 2026, n = 800)"
        />
      </div>

      <div className="mt-8 card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="h-section">Five-layer pipeline</h2>
          <span className="text-xs text-slate-500">Every model produces one column of the decision matrix that drives the order split.</span>
        </div>
        <ol className="grid gap-3 md:grid-cols-5">
          {LAYERS.map((l, i) => (
            <li key={l.n} className="relative rounded-lg border border-navy-100 bg-navy-50/60 p-4">
              <div className="flex items-center justify-between">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-navy-700 text-xs font-bold text-white">{l.n}</span>
                <Badge tone="blue">{l.q}</Badge>
              </div>
              <div className="mt-2 text-sm font-semibold text-navy-900">{l.title}</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{l.body}</p>
              {i < LAYERS.length - 1 ? (
                <span aria-hidden className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-lg text-navy-600 md:block">
                  &#8250;
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="h-section">Today&apos;s recommendation (Normal mode)</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {rec.rows
              .filter((r) => r.vials > 0)
              .map((r) => (
                <li key={r.id} className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span>
                    <span className="font-semibold">{r.id}</span> <span className="text-slate-500">({r.role})</span>
                  </span>
                  <span className="font-mono">
                    {r.vials.toLocaleString("en-US")} vials ({(r.share * 100).toFixed(0)}%)
                  </span>
                </li>
              ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Demand {rec.demand.toLocaleString("en-US")} vials a month<Assumption>A11</Assumption>, lambda {rec.lambda}. Awaiting human approval.
          </p>
          <Link href="/scenario" className="btn btn-primary mt-4">
            Open scenario and order split
          </Link>
        </div>
        <div className="card">
          <h2 className="h-section">What the data says</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
            <li>18 carboplatin labelers are listed in the US, but only 11 sell finished injection; 7 sell bulk ingredient only.</li>
            <li>Only 2 of the 11 makers appear in the SCMS training data after parent mapping, so delivery risk is scored from features, not supplier names.</li>
            <li>
              Carboplatin alone accounts for {onc.current_by_drug["Carboplatin Injection"]} of the {onc.current_records} current oncology shortage records.
            </li>
            <li>Every score is explained, every assumption is labelled, and a human approves every order split.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
