"use client";

import { useEffect, useMemo, useState } from "react";
import ModeTabs from "@/components/ModeTabs";
import { Badge, PageTitle, pct } from "@/components/ui";
import { allocations, makerById, MODE_LABEL, suppliers, weights, type Mode } from "@/lib/data";

interface Entry {
  timestamp_utc: string;
  decision: "approved" | "overridden";
  mode: Mode;
  lambda: number;
  approver: string;
  reason: string;
  final_weights: Record<string, number>;
  allocation: Record<string, number>;
  recommended: Record<string, number>;
  server_timestamp_utc?: string;
}

const LOCAL_KEY = "pharmashield_local_audit_log";

function readLocal(): Entry[] {
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "[]") as Entry[];
  } catch {
    return [];
  }
}

function toCsv(entries: Entry[]): string {
  const ids = suppliers.makers.map((m) => m.id);
  const header = ["timestamp_utc", "decision", "mode", "lambda", "approver", "reason", ...["C1", "C2", "C3", "C4", "C5"].map((c) => `weight_${c}`), ...ids.map((i) => `share_${i}`)];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = entries.map((e) =>
    [e.timestamp_utc, e.decision, e.mode, e.lambda, e.approver, e.reason, ...["C1", "C2", "C3", "C4", "C5"].map((c) => e.final_weights[c].toFixed(4)), ...ids.map((i) => (e.allocation[i] ?? 0).toFixed(4))]
      .map(esc)
      .join(","),
  );
  return [header.map(esc).join(","), ...lines].join("\n");
}

export default function Approval() {
  const [mode, setMode] = useState<Mode>("normal");
  const rec = allocations[mode];
  const recommended = useMemo(() => Object.fromEntries(rec.rows.map((r) => [r.id, r.share])), [rec]);
  const [override, setOverride] = useState(false);
  const [shares, setShares] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [approver, setApprover] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [remote, setRemote] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setShares(Object.fromEntries(suppliers.makers.map((m) => [m.id, Math.round((recommended[m.id] ?? 0) * 100)])));
  }, [recommended]);

  useEffect(() => {
    fetch("/api/audit")
      .then((r) => r.json())
      .then((d: { configured: boolean; entries: Entry[] }) => {
        setRemote(d.configured);
        setEntries(d.configured ? d.entries : readLocal());
      })
      .catch(() => {
        setRemote(false);
        setEntries(readLocal());
      });
  }, []);

  const total = Object.values(shares).reduce((a, b) => a + b, 0);
  const overrideValid = total === 100 && reason.trim().length >= 10;
  const canSubmit = approver.trim().length >= 2 && (!override || overrideValid);

  async function submit() {
    const allocation = override ? Object.fromEntries(Object.entries(shares).filter(([, v]) => v > 0).map(([k, v]) => [k, v / 100])) : recommended;
    const entry: Entry = {
      timestamp_utc: new Date().toISOString(),
      decision: override ? "overridden" : "approved",
      mode,
      lambda: rec.lambda,
      approver: approver.trim(),
      reason: override ? reason.trim() : "Approved as recommended",
      final_weights: weights[mode].final_weights,
      allocation,
      recommended,
    };
    let storedRemote = false;
    if (remote) {
      const res = await fetch("/api/audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry) });
      storedRemote = res.ok;
    }
    if (!storedRemote) {
      const next = [entry, ...readLocal()].slice(0, 200);
      try {
        window.localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
      } catch {
        // storage may be blocked (private window); the entry still shows for this session
      }
      setEntries(next);
    } else {
      setEntries([entry, ...entries]);
    }
    setMessage(`Decision logged (${entry.decision}). No order has been sent.`);
    setReason("");
    setOverride(false);
  }

  function download() {
    const blob = new Blob([toCsv(entries)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "pharmashield_audit_log.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <PageTitle title="Approval & Audit" question="Q6">
        A category manager approves or overrides the recommended split. Every decision is logged with its timestamp, mode, final weights and
        allocation.
      </PageTitle>
      <div className="mb-6 rounded-lg border-2 border-navy-700 bg-navy-50 px-4 py-3 text-sm font-semibold text-navy-900">
        No order is sent automatically. This tool recommends; a human decides.
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="card lg:col-span-3">
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <ModeTabs mode={mode} onChange={setMode} />
            <span className="text-xs text-slate-500">lambda {rec.lambda} (precomputed MILP, status {rec.status})</span>
          </div>
          <table className="table-clean w-full">
            <thead>
              <tr>
                <th>Maker</th>
                <th>Recommended</th>
                <th>{override ? "Your share (%)" : "Role"}</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.makers.map((m) => {
                const r = rec.rows.find((x) => x.id === m.id)!;
                if (!override && r.vials === 0) return null;
                return (
                  <tr key={m.id}>
                    <td>
                      <span className="font-medium">{m.name}</span> {m.is_probation ? <Badge tone="amber">Probation</Badge> : null}
                    </td>
                    <td className="font-mono">{pct(r.share, 0)}</td>
                    <td>
                      {override ? (
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={5}
                          value={shares[m.id] ?? 0}
                          onChange={(e) => setShares({ ...shares, [m.id]: Math.max(0, Math.min(100, Number(e.target.value))) })}
                          className="w-20 rounded border border-slate-300 px-2 py-1 font-mono text-sm"
                          aria-label={`Share for ${m.name}`}
                        />
                      ) : (
                        r.role
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-4 space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
              Override the recommendation
            </label>
            {override ? (
              <>
                <div className={`text-sm font-medium ${total === 100 ? "text-emerald-700" : "text-red-700"}`}>Shares total {total}% (must equal 100%)</div>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for override (required, at least 10 characters)"
                  className="h-20 w-full rounded border border-slate-300 p-2 text-sm"
                />
              </>
            ) : null}
            <input
              value={approver}
              onChange={(e) => setApprover(e.target.value)}
              placeholder="Approver role or initials (no personal contact details)"
              className="w-full rounded border border-slate-300 p-2 text-sm"
            />
            <button className="btn btn-primary disabled:opacity-40" disabled={!canSubmit} onClick={submit}>
              {override ? "Log override" : "Approve and log"}
            </button>
            {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          </div>
        </div>

        <div className="card lg:col-span-2">
          <h3 className="text-sm font-semibold text-navy-900">Final weights logged with this decision ({MODE_LABEL[mode]})</h3>
          <ul className="mt-2 grid grid-cols-5 gap-2 text-center text-xs">
            {Object.entries(weights[mode].final_weights).map(([c, w]) => (
              <li key={c} className="rounded bg-slate-50 p-2">
                <div className="font-semibold">{c}</div>
                <div className="font-mono">{w.toFixed(3)}</div>
              </li>
            ))}
          </ul>
          <h3 className="mt-5 text-sm font-semibold text-navy-900">Governance controls</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
            <li>Every score shows its top 3 SHAP reasons (Scorecard).</li>
            <li>Probation makers receive a capped 5-15% trial, and only if they pass the safety gate (no OAI and no Class I recall in 3 years).</li>
            <li>Evidence is plant- and lane-level where available, country-level otherwise.</li>
            <li>The log stores business decisions only, not personal data (UAE PDPL data minimisation).</li>
          </ul>
        </div>
      </div>

      <div className="card mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="h-section">Decision log</h2>
            {remote === null ? null : remote ? <Badge tone="green">Shared audit store</Badge> : <Badge tone="amber">Local demo log (this browser only)</Badge>}
          </div>
          <button className="btn btn-ghost" onClick={download} disabled={entries.length === 0}>
            Download CSV
          </button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="table-clean w-full">
            <thead>
              <tr>
                <th>Time (UTC)</th>
                <th>Decision</th>
                <th>Mode</th>
                <th>Approver</th>
                <th>Allocation</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-slate-500">
                    No decisions logged yet.
                  </td>
                </tr>
              ) : (
                entries.map((e, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap font-mono text-xs">{e.timestamp_utc.replace("T", " ").slice(0, 19)}</td>
                    <td>
                      <Badge tone={e.decision === "approved" ? "green" : "amber"}>{e.decision}</Badge>
                    </td>
                    <td>{MODE_LABEL[e.mode]}</td>
                    <td>{e.approver}</td>
                    <td className="text-xs">
                      {Object.entries(e.allocation)
                        .filter(([, v]) => v > 0)
                        .map(([k, v]) => `${makerById[k]?.id ?? k} ${pct(v, 0)}`)
                        .join(", ")}
                    </td>
                    <td className="text-xs">{e.reason}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
