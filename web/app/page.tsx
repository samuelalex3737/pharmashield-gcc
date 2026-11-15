"use client";

import Link from "next/link";
import { useState } from "react";
import AllocationBar from "@/components/AllocationBar";
import { Badge, Kpi } from "@/components/ui";
import { allocations, meta, suppliers } from "@/lib/data";
import { pct, usd } from "@/lib/format";
import metrics from "@/data/model_metrics.json";

const LAYERS = [
  {
    n: 1,
    title: "Multi-source data",
    technique: "Data fusion of 7 public feeds: USAID SCMS (10,324 shipment lines), openFDA NDC, Shortages and Recalls, FDA inspections and citations, Medicaid 2025 prices, World Bank LPI.",
    question: "Q2 What data sources profile supplier risk?",
    href: "/evidence",
    proof: "Model Evidence",
  },
  {
    n: 2,
    title: "Qualify and resolve",
    technique: "Qualification filter (finished injection only: 11 of 18 labelers) and entity resolution with a reviewed labeler-to-maker-to-parent map and two-test fuzzy matching.",
    question: "Q2 How are sources joined into one profile?",
    href: "/scorecard",
    proof: "Supplier Scorecard",
  },
  {
    n: 3,
    title: "AI risk engines",
    technique: `XGBoost + SHAP delivery risk (ROC-AUC ${metrics.c2.models.XGBoost.roc_auc.toFixed(3)}), Isolation Forest price anomalies, TF-IDF NLP on FDA citations (macro F1 ${metrics.nlp.macro_f1.toFixed(3)}).`,
    question: "Q3 Q4 Can ML predict disruption and fraud? What does NLP add?",
    href: "/evidence",
    proof: "Model Evidence",
  },
  {
    n: 4,
    title: "Rank and split",
    technique: "50% AHP + 50% entropy weights, TOPSIS ranking per mode, and a MILP order split with dual sourcing, probation trials and a compliance gate.",
    question: "Q1 Q5 How does AI support multi-criteria selection?",
    href: "/scenario",
    proof: "Scenario & Order Split",
  },
  {
    n: 5,
    title: "Human approval",
    technique: "Category manager reviews SHAP reasons, approves or overrides the split, and every decision is logged. No order is sent automatically.",
    question: "Q6 Q7 Ethics, compliance, transparency and resilience",
    href: "/approval",
    proof: "Approval & Audit",
  },
];

export default function Overview() {
  const [active, setActive] = useState(3);
  const onc = meta.oncology_shortages!;
  const affected = suppliers.makers.filter((m) => m.active_fda_shortage).length;
  const n = allocations.normal;
  const c = allocations.crisis;
  const layer = LAYERS[active];

  return (
    <div>
      <section className="relative overflow-hidden rounded-2xl border border-line bg-brand px-6 py-10 text-white dark:bg-raised dark:text-ink sm:px-10">
        <div className="max-w-3xl">
          <Badge tone="accent">Carboplatin injection 10 mg/mL - Tier 1 oncology</Badge>
          <h1 className="text-display mt-4">When Hormuz closes, a GCC hospital buyer has days, not 25, to find a safe second supplier of chemotherapy.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/80 dark:text-muted">
            PharmaShield GCC ranks every qualified maker of a life-critical drug on five risk criteria and recommends a dual-source order split that a human
            buyer approves. Hypothetical UAE group purchasing organisation; academic prototype.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/boardroom" className="btn border-accent bg-accent px-4 py-2 text-white hover:brightness-110 dark:text-bg">
              Start boardroom demo
            </Link>
            <Link href="/scenario" className="btn border-white/30 bg-white/10 px-4 py-2 text-white hover:bg-white/20 dark:border-line dark:bg-surface dark:text-ink">
              Open scenario and order split
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Current US oncology shortage records"
          value={String(onc.current_records)}
          sub={`covering ${onc.current_drugs} drugs`}
          tone="alert"
          source={`openFDA, cached ${meta.data_cutoff}`}
        />
        <Kpi
          label="Carboplatin makers with a current shortage"
          value={`${affected} of ${suppliers.makers.length}`}
          sub="qualified finished-injection makers"
          tone="alert"
          source="openFDA Drug Shortages"
          term="shortage"
        />
        <Kpi label="Days to onboard a replacement supplier" value="25" sub="74% face shortages in the transition" source="Ivalua via Supply Chain Dive, Jul 2026" />
        <Kpi label="Qualified makers" value={`${suppliers.makers.length} of 18`} sub="7 listed labelers sell bulk ingredient only" source="openFDA NDC Directory" />
      </div>

      <section className="card mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="h-section">Five-layer pipeline</h2>
          <span className="caption">Hover or focus a layer to see its technique and where the app proves it.</span>
        </div>
        <ol className="mt-4 grid gap-3 md:grid-cols-5">
          {LAYERS.map((l, i) => (
            <li key={l.n}>
              <button
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                aria-pressed={active === i}
                className={`h-full w-full rounded-xl border p-4 text-left transition ${
                  active === i ? "border-accent bg-accent-soft shadow" : "border-line bg-raised hover:border-accent/50"
                }`}
              >
                <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${active === i ? "bg-accent text-white dark:text-bg" : "bg-surface text-muted"}`}>
                  {l.n}
                </span>
                <span className="mt-2 block text-sm font-semibold text-ink">{l.title}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="mt-4 rounded-xl border border-line bg-raised p-4" aria-live="polite">
          <div className="text-xs font-semibold uppercase tracking-wider text-accent-ink">{layer.question}</div>
          <p className="mt-1 text-sm text-ink">{layer.technique}</p>
          <Link href={layer.href} className="mt-2 inline-block text-sm font-semibold text-accent-ink underline">
            See it on the {layer.proof} page
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="flex items-center justify-between">
            <h2 className="h-section">Normal profile (lambda {n.lambda.toFixed(1)})</h2>
            <span className="tnum text-sm font-semibold">{usd(n.kpis.purchase_cost_usd)} / month</span>
          </div>
          <div className="mt-3">
            <AllocationBar rows={n.rows} demand={n.demand} label="Normal mode order split" />
          </div>
          <p className="caption mt-2">India-made volume {pct(n.kpis.india_made_share, 0)}; expected late shipments {pct(n.kpis.expected_late_share, 2)}.</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <h2 className="h-section">Crisis profile (lambda {c.lambda.toFixed(1)})</h2>
            <span className="tnum text-sm font-semibold">{usd(c.kpis.purchase_cost_usd)} / month</span>
          </div>
          <div className="mt-3">
            <AllocationBar rows={c.rows} demand={c.demand} label="Crisis mode order split" />
          </div>
          <p className="caption mt-2">
            India-made volume {pct(c.kpis.india_made_share, 0)}; expected late shipments {pct(c.kpis.expected_late_share, 2)}. Awaiting human approval.
          </p>
        </div>
      </section>
    </div>
  );
}
