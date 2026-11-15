// Audit log storage. Uses Upstash Redis (Vercel Marketplace) through its REST API when the environment
// variables are set; otherwise reports "not configured" and the page keeps a local demo log in the browser.
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";

const URL_ENV = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const TOKEN_ENV = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const KEY = "pharmashield:audit_log";
const MAX_ENTRY_BYTES = 20_000;

async function redis(command: (string | number)[]) {
  const res = await fetch(URL_ENV!, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN_ENV}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis REST error ${res.status}`);
  return (await res.json()) as { result: unknown };
}

export async function GET() {
  if (!URL_ENV || !TOKEN_ENV) return NextResponse.json({ configured: false, entries: [] });
  try {
    const { result } = await redis(["LRANGE", KEY, 0, 199]);
    const entries = (result as string[]).map((s) => JSON.parse(s));
    return NextResponse.json({ configured: true, entries });
  } catch (err) {
    return NextResponse.json({ configured: true, entries: [], error: err instanceof Error ? err.message : "read failed" }, { status: 502 });
  }
}

export async function POST(req: Request) {
  if (!URL_ENV || !TOKEN_ENV) return NextResponse.json({ configured: false }, { status: 503 });
  const text = await req.text();
  if (text.length > MAX_ENTRY_BYTES) return NextResponse.json({ error: "entry too large" }, { status: 413 });
  let entry: Record<string, unknown>;
  try {
    entry = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (typeof entry.decision !== "string" || typeof entry.mode !== "string") {
    return NextResponse.json({ error: "decision and mode are required" }, { status: 400 });
  }
  const stored = { ...entry, server_timestamp_utc: new Date().toISOString() };
  try {
    await redis(["LPUSH", KEY, JSON.stringify(stored)]);
    await redis(["LTRIM", KEY, 0, 999]);
    return NextResponse.json({ configured: true, stored });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "write failed" }, { status: 502 });
  }
}

// Admin-only: clear the whole audit log. Requires the passcode in the x-admin-key header to equal AUDIT_ADMIN_KEY.
export async function DELETE(req: Request) {
  const adminKey = process.env.AUDIT_ADMIN_KEY;
  if (!adminKey) return NextResponse.json({ error: "admin clearing is not configured" }, { status: 503 });
  const given = req.headers.get("x-admin-key") ?? "";
  if (given.length !== adminKey.length || !timingSafeEqual(Buffer.from(given), Buffer.from(adminKey))) {
    return NextResponse.json({ error: "wrong admin passcode" }, { status: 401 });
  }
  if (!URL_ENV || !TOKEN_ENV) return NextResponse.json({ configured: false }, { status: 503 });
  try {
    const { result } = await redis(["LLEN", KEY]);
    await redis(["DEL", KEY]);
    return NextResponse.json({ cleared: Number(result) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "clear failed" }, { status: 502 });
  }
}
