"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AllocationBar from "@/components/AllocationBar";
import { Badge, EngineChip } from "@/components/ui";
import { allocations, makerById, meta, rankings, suppliers } from "@/lib/data";
import { pct, signedUsd, usd } from "@/lib/format";
import { establishedRanks, splitMetrics, type SplitRow } from "@/lib/insights";
import { liveAllocation, parityCheck } from "@/lib/live";

const PARITY = parityCheck();
const STEPS = ["The problem", "The ranking", "The crisis click", "A supplier fails", "The recommended split", "Human approval"];

export default function Boardroom() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") setStep((s) => Math.min(s + 1, STEPS.length - 1));
      if (e.key === "ArrowLeft" || e.key === "PageUp") setStep((s) => Math.max(s - 1, 0));
      if (e.key === "Escape") router.push("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const onc = meta.oncology_shortages!;
  const n = allocations.normal;
  const c = allocations.crisis;
  const nM = splitMetrics(n.rows, "normal");
  const cM = splitMetrics(c.rows, "crisis");
  const failure = useMemo(() => {
    if (!PARITY.ok) return null;
    const r = liveAllocation("crisis", suppliers.mode_lambda.crisis, { capacityFactor: { TEVA: 0 } });
    return { rows: r.rows as SplitRow[], spot: r.spotBuyVials, relaxed: r.gateRelaxed, m: splitMetrics(r.rows as SplitRow[], "crisis") };
  }, []);
  const top = rankings.normal.slice(0, 6);
  const est = establishedRanks(rankings.normal.map((r) => r.id));
  const affected = suppliers.makers.filter((m) => m.active_fda_shortage).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-bg text-ink">
      <header className="flex items-center justify-between border-b border-line px-6 py-3">
        <div className="text-sm font-semibold">
          PharmaShield GCC <span className="text-muted">- Boardroom mode</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          <EngineChip live={PARITY.ok} />
          <span>Arrow keys to move, Esc to exit</span>
          <Link href="/" className="btn btn-ghost">
            Exit
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-8">
        <div className="text-sm font-semibold uppercase tracking-widest text-accent-ink">
          Step {step + 1} of {STEPS.length} - {STEPS[step]}
        </div>

        {step === 0 ? (
          <section className="mt-4">
            <h1 className="text-4xl font-bold leading-tight sm:text-5xl">A failed oncology supplier takes 25 days to replace. Carboplatin is already short.</h1>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              <Big value={String(onc.current_records)} label={`current US oncology shortage records, ${onc.current_drugs} drugs (openFDA)`} tone="risk" />
              <Big value={`${affected} of ${suppliers.makers.length}`} label="qualified carboplatin makers with a current shortage (openFDA)" tone="risk" />
              <Big value="25 days" label="to onboard a replacement supplier (Ivalua via Supply Chain Dive, Jul 2026)" />
            </div>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="mt-4">
            <h1 className="text-4xl font-bold leading-tight">Eleven qualified makers, ranked on five risks.</h1>
            <p className="mt-3 text-lg text-muted">TOPSIS on landed cost, delivery risk (XGBoost), price integrity, compliance and route exposure.</p>
            <ol className="mt-8 space-y-3">
              {top.map((r) => {
                const m = makerById[r.id];
                return (
                  <li key={r.id} className="flex items-center gap-4 rounded-xl border border-line bg-surface px-5 py-3">
                    <span className="w-8 text-2xl font-bold">{r.rank}</span>
                    <span className="flex-1 text-xl font-semibold">{m.name}</span>
                    <span className="tnum text-xl">S {r.S.toFixed(3)}</span>
                    <span className="w-56 text-right">
                      {m.is_probation ? <Badge tone="warn">Probation - trial 5-15%</Badge> : <Badge tone="brand">Established rank {est[r.id]}</Badge>}{" "}
                      {m.compliance_gated ? <Badge tone="risk">Gated</Badge> : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="mt-4">
            <h1 className="text-4xl font-bold leading-tight">Hormuz closes. One click re-splits the order.</h1>
            <p className="mt-3 text-lg text-muted">Crisis mode changes the weights, the route stress and the price of risk together.</p>
            <div className="mt-8 space-y-6">
              <Split title={`Normal (lambda ${n.lambda.toFixed(1)})`} rows={n.rows} demand={n.demand} note={`${usd(nM.cost)} a month, India-made ${pct(nM.indiaShare, 0)}`} />
              <Split title={`Crisis (lambda ${c.lambda.toFixed(1)})`} rows={c.rows} demand={c.demand} note={`${usd(cM.cost)} a month, India-made ${pct(cM.indiaShare, 0)}`} />
            </div>
            <p className="mt-6 text-2xl font-semibold">
              India-made volume {pct(nM.indiaShare, 0)} to {pct(cM.indiaShare, 0)} for {signedUsd(cM.cost - nM.cost)} a month (
              {pct(cM.cost / nM.cost - 1)}).
            </p>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="mt-4">
            <h1 className="text-4xl font-bold leading-tight">And if the primary plant fails?</h1>
            <p className="mt-3 text-lg text-muted">Teva shut down in Crisis mode. The MILP re-solves live in the browser.</p>
            {failure ? (
              <div className="mt-8 space-y-6">
                <Split title="Before" rows={c.rows} demand={c.demand} note={`${usd(cM.cost)} a month`} />
                <Split title="After: Teva plant down" rows={failure.rows} spot={failure.spot} demand={c.demand} note={`${usd(failure.m.cost)} a month`} />
                <p className="text-2xl font-semibold">
                  Cost {signedUsd(failure.m.cost - cM.cost)} a month; spot buy {failure.spot.toLocaleString("en-US")} vials; Hormuz-exposed share{" "}
                  {pct(cM.hormuzShare)} to {pct(failure.m.hormuzShare)}.
                </p>
                {failure.relaxed.length ? (
                  <p className="rounded-xl border border-risk/40 bg-risk-soft p-4 text-lg font-semibold text-risk">
                    Compliance gate relaxed for {failure.relaxed.join(", ")}: no feasible split exists without {failure.relaxed.length > 1 ? "them" : "it"}, so the buyer sees a red flag.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-8 text-lg text-muted">Live engine unavailable; see the Scenario page.</p>
            )}
          </section>
        ) : null}

        {step === 4 ? (
          <section className="mt-4">
            <h1 className="text-4xl font-bold leading-tight">The recommendation for this month (Crisis profile).</h1>
            <div className="mt-8">
              <AllocationBar rows={c.rows} demand={c.demand} label="Recommended Crisis split" />
            </div>
            <div className="mt-8 grid gap-6 sm:grid-cols-4">
              <Big value={usd(cM.cost)} label="monthly purchase cost" />
              <Big value={pct(cM.lateShare, 2)} label="expected late shipments" />
              <Big value={pct(cM.indiaShare, 0)} label="India-made volume" />
              <Big value={`${c.spot_buy_vials}`} label="vials bought on the spot market" />
            </div>
            <p className="mt-6 text-lg text-muted">
              Compliance gate: {c.gated_blocked.join(", ")} cannot be primary or backup (C4 above {suppliers.compliance_gate.toFixed(2)}).
            </p>
          </section>
        ) : null}

        {step === 5 ? (
          <section className="mt-4">
            <h1 className="text-4xl font-bold leading-tight">The AI recommends. A category manager decides.</h1>
            <p className="mt-6 text-2xl">No order is sent automatically. Every approval or override is logged with its weights and allocation.</p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link href="/approval" className="btn btn-primary px-6 py-3 text-lg">
                Go to Approval & Audit
              </Link>
              <Link href="/memo?mode=crisis" className="btn btn-ghost px-6 py-3 text-lg">
                Open the board decision memo
              </Link>
            </div>
          </section>
        ) : null}
      </main>

      <footer className="flex items-center justify-between border-t border-line px-6 py-3">
        <button className="btn btn-ghost" onClick={() => setStep((s) => Math.max(s - 1, 0))} disabled={step === 0}>
          Previous
        </button>
        <div className="flex gap-2" aria-label="Progress">
          {STEPS.map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(i)}
              aria-label={`Go to step ${i + 1}: ${s}`}
              aria-current={i === step ? "step" : undefined}
              className="grid h-6 w-6 place-items-center rounded-full"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${i === step ? "bg-accent" : "bg-line"}`} />
            </button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={() => setStep((s) => Math.min(s + 1, STEPS.length - 1))} disabled={step === STEPS.length - 1}>
          Next
        </button>
      </footer>
    </div>
  );
}

function Big({ value, label, tone }: { value: string; label: string; tone?: "risk" }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <div className={`tnum text-4xl font-bold sm:text-5xl ${tone === "risk" ? "text-risk" : "text-ink"}`}>{value}</div>
      <div className="mt-2 text-base text-muted">{label}</div>
    </div>
  );
}

function Split({ title, rows, demand, note, spot = 0 }: { title: string; rows: SplitRow[]; demand: number; note: string; spot?: number }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xl font-semibold">{title}</span>
        <span className="tnum text-lg text-muted">{note}</span>
      </div>
      <AllocationBar rows={rows} spot={spot} demand={demand} label={`${title} order split`} />
    </div>
  );
}
