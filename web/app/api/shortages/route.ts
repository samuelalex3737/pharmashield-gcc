// Live openFDA carboplatin shortage feed with a 5-second timeout, hourly revalidation and a cached fallback.
import { NextResponse } from "next/server";
import cache from "@/data/shortages_cache.json";

export const revalidate = 3600;

const URL_OPENFDA = 'https://api.fda.gov/drug/shortages.json?search=generic_name:"carboplatin"&limit=100';

interface ShortageRecord {
  company_name?: string;
  status?: string;
  presentation?: string;
  package_ndc?: string;
  shortage_reason?: string;
  update_date?: string;
  initial_posting_date?: string;
}

export async function GET() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(URL_OPENFDA, { signal: controller.signal, next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`openFDA returned ${res.status}`);
    const body = (await res.json()) as { results?: ShortageRecord[] };
    const results = (body.results ?? []).map((r) => ({
      company_name: r.company_name,
      status: r.status,
      presentation: r.presentation,
      package_ndc: r.package_ndc,
      shortage_reason: r.shortage_reason,
      update_date: r.update_date,
      initial_posting_date: r.initial_posting_date,
    }));
    return NextResponse.json({ served_from: "live", retrieved_utc: new Date().toISOString(), total: results.length, results, disclaimer: cache.disclaimer });
  } catch (err) {
    return NextResponse.json({
      served_from: "cache",
      cached_on: cache.cached_on,
      retrieved_utc: cache.retrieved_utc,
      total: cache.total,
      results: cache.results,
      disclaimer: cache.disclaimer,
      error: err instanceof Error ? err.message : "live call failed",
    });
  } finally {
    clearTimeout(timer);
  }
}
