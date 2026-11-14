import type { ReactNode } from "react";

export function Kpi({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: ReactNode; tone?: "default" | "alert" | "good" }) {
  const color = tone === "alert" ? "text-risk-high" : tone === "good" ? "text-risk-low" : "text-navy-900";
  return (
    <div className="card">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold xl:text-3xl ${color}`}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
    </div>
  );
}

export function Badge({ children, tone = "slate", title }: { children: ReactNode; tone?: "slate" | "amber" | "red" | "blue" | "green" | "purple"; title?: string }) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    blue: "bg-navy-50 text-navy-800 ring-navy-100",
    green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    purple: "bg-violet-50 text-violet-800 ring-violet-200",
  };
  return (
    <span title={title} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function PageTitle({ title, question, children }: { title: string; question?: string; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-navy-900">{title}</h1>
        {question ? <Badge tone="blue">{question}</Badge> : null}
      </div>
      {children ? <p className="mt-2 max-w-4xl text-sm text-slate-600">{children}</p> : null}
    </div>
  );
}

export function Assumption({ children }: { children: ReactNode }) {
  return <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold uppercase text-amber-800">{children}</span>;
}

export const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
export const usd = (v: number, d = 0) => `USD ${v.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d })}`;
