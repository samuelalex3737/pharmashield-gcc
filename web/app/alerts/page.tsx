"use client";

import { useEffect, useState } from "react";
import { Badge, Kpi, PageTitle } from "@/components/ui";
import { suppliers } from "@/lib/data";
import cache from "@/data/shortages_cache.json";

interface Rec {
  company_name?: string;
  status?: string;
  presentation?: string;
  package_ndc?: string;
  shortage_reason?: string;
  update_date?: string;
}
interface Feed {
  served_from: "live" | "cache";
  retrieved_utc?: string;
  cached_on?: string;
  total: number;
  results: Rec[];
  disclaimer: string;
}

const codeToMaker: Record<string, string> = {
  "83831": "AVYXA", "16729": "ACCORD", "60505": "APOTEX", "54288": "BPI", "55150": "EUGIA", "63323": "FRESENIUS",
  "68083": "GLAND", "61703": "HOSPIRA", "69339": "NATCO", "0703": "TEVA", "82511": "TEYRO",
};

export default function Alerts() {
  // Render the cached pull immediately (stable layout), then replace it with the live feed when it arrives.
  const [feed, setFeed] = useState<Feed>({ ...(cache as unknown as Feed), served_from: "cache" });
  const [checking, setChecking] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch("/api/shortages")
      .then((r) => r.json())
      .then((f: Feed) => setFeed(f))
      .catch(() => setFailed(true))
      .finally(() => setChecking(false));
  }, []);

  const current = feed.results.filter((r) => r.status === "Current");
  const affected = new Set(current.map((r) => codeToMaker[(r.package_ndc ?? "").split("-")[0]]).filter(Boolean));

  return (
    <div>
      <PageTitle title="Live Alerts" question="Q7">
        US carboplatin shortage records from the openFDA Drug Shortages API. The page tries a live call first (5-second timeout) and falls back
        to the cached pull used by the model. openFDA is US data and is not validated for clinical decisions.
      </PageTitle>
      <div
        className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
          checking ? "border-line bg-raised text-muted" : feed.served_from === "live" ? "border-good/40 bg-good-soft text-good" : "border-warn/40 bg-warn-soft text-warn"
        }`}
        aria-live="polite"
      >
        {checking
          ? `Checking the live openFDA feed... showing data cached on ${cache.cached_on} meanwhile`
          : feed.served_from === "live"
            ? `Live feed: retrieved ${new Date(feed.retrieved_utc!).toUTCString()}`
            : `Live call unavailable: showing data cached on ${feed.cached_on ?? cache.cached_on}`}
      </div>
      {failed ? <p className="text-sm text-risk">The alerts service could not be reached.</p> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Kpi label="Carboplatin shortage records" value={String(feed.total)} sub="all statuses" />
        <Kpi label="Current records" value={String(current.length)} tone="alert" sub="status = Current" />
        <Kpi
          label="Qualified makers affected"
          value={`${affected.size} of ${suppliers.makers.length}`}
          sub="matched by labeler code in the package NDC"
          tone="alert"
        />
      </div>

      <div className="card mt-6 overflow-x-auto p-0">
        <table className="table-clean w-full">
          <thead>
            <tr>
              <th>Status</th>
              <th>Company (as reported)</th>
              <th>Panel maker</th>
              <th>Presentation</th>
              <th>Reason</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {feed.results.map((r, i) => (
              <tr key={i}>
                <td>
                  <Badge tone={r.status === "Current" ? "red" : "slate"}>{r.status}</Badge>
                </td>
                <td>{r.company_name}</td>
                <td className="font-medium">{codeToMaker[(r.package_ndc ?? "").split("-")[0]] ?? "not in panel"}</td>
                <td className="max-w-md text-xs">{r.presentation}</td>
                <td className="text-xs">{r.shortage_reason ?? "-"}</td>
                <td className="whitespace-nowrap text-xs">{r.update_date ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">{feed.disclaimer}</p>
    </div>
  );
}
