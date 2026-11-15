import type { ReactNode } from "react";
import { GLOSSARY } from "@/lib/glossary";

export { usd, pct } from "@/lib/format";

type Tone = "neutral" | "accent" | "risk" | "warn" | "good" | "brand";

const TONE: Record<Tone, string> = {
  neutral: "bg-raised text-muted ring-line",
  accent: "bg-accent-soft text-accent-ink ring-accent/30",
  risk: "bg-risk-soft text-risk ring-risk/30",
  warn: "bg-warn-soft text-warn ring-warn/30",
  good: "bg-good-soft text-good ring-good/30",
  brand: "bg-raised text-brand ring-line",
};

// Map the older tone names used in a few places onto the design-system tones.
const LEGACY: Record<string, Tone> = { slate: "neutral", amber: "warn", red: "risk", blue: "accent", green: "good", purple: "brand" };

export function Badge({ children, tone = "neutral", title }: { children: ReactNode; tone?: Tone | keyof typeof LEGACY; title?: string }) {
  const t = (LEGACY[tone as string] ?? tone) as Tone;
  return (
    <span
      title={title}
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONE[t]}`}
    >
      {children}
    </span>
  );
}

// Accessible tooltip: shows on hover and on keyboard focus.
export function InfoTip({ term, text }: { term?: keyof typeof GLOSSARY | string; text?: string }) {
  const body = text ?? (term ? GLOSSARY[term] : "");
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={`What is ${term ?? "this"}?`}
        className="ml-1 grid h-4 w-4 place-items-center rounded-full border border-line text-[10px] font-semibold text-muted hover:border-accent hover:text-accent-ink"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-6 z-40 hidden w-64 -translate-x-1/2 rounded-lg border border-line bg-surface p-2.5 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-ink shadow-xl group-focus-within:block group-hover:block"
      >
        {body}
      </span>
    </span>
  );
}

export function SourceChip({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded bg-raised px-1.5 py-0.5 text-[10px] font-medium text-muted ring-1 ring-inset ring-line">{children}</span>;
}

export function Kpi({
  label,
  value,
  sub,
  delta,
  deltaTone = "neutral",
  source,
  tone = "default",
  term,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  delta?: string;
  deltaTone?: "good" | "risk" | "neutral";
  source?: string;
  tone?: "default" | "alert" | "good";
  term?: string;
}) {
  const color = tone === "alert" ? "text-risk" : tone === "good" ? "text-good" : "text-ink";
  const dColor = deltaTone === "good" ? "text-good" : deltaTone === "risk" ? "text-risk" : "text-muted";
  return (
    <div className="card flex flex-col gap-1">
      <div className="flex items-center text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
        {term ? <InfoTip term={term} /> : null}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className={`kpi-value whitespace-nowrap text-2xl font-bold tracking-tight ${color}`}>{value}</span>
        {delta ? <span className={`text-xs font-semibold ${dColor}`}>{delta}</span> : null}
      </div>
      {sub ? <div className="text-xs text-muted">{sub}</div> : null}
      {source ? (
        <div className="mt-auto pt-1">
          <SourceChip>{source}</SourceChip>
        </div>
      ) : null}
    </div>
  );
}

export function PageTitle({ title, question, children, actions }: { title: string; question?: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
          {question ? <Badge tone="accent">{question}</Badge> : null}
        </div>
        {children ? <p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted">{children}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Assumption({ children }: { children: ReactNode }) {
  return (
    <span className="ml-1 rounded bg-warn-soft px-1 text-[10px] font-semibold uppercase text-warn" title="Labelled assumption, see docs/assumptions.md">
      {children}
    </span>
  );
}

export function EngineChip({ live }: { live: boolean }) {
  return (
    <Badge tone={live ? "good" : "warn"} title={live ? "Recomputed in your browser by the TypeScript engine, checked against the Python pipeline" : "Python results exported by notebook 04"}>
      {live ? "Live engine (parity verified)" : "Precomputed (Python)"}
    </Badge>
  );
}

export function Skeleton({ className = "h-40" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line p-6 text-center">
      <div className="text-sm font-medium text-ink">{title}</div>
      {children ? <div className="mt-1 text-xs text-muted">{children}</div> : null}
    </div>
  );
}
