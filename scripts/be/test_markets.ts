// scripts/be/test_markets.ts
import "dotenv/config";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { normalizePolymarket } from "../../packages/core/schema"; // keep your current path

const POLY_URL = "https://gamma-api.polymarket.com/markets?active=true&closed=false&archived=false&order=updatedAt&ascending=false&limit=1000";
const REFRESH = process.argv.includes("--refresh");

// ---------- helpers ----------
const CACHE_ROOT = path.resolve(".cache");
const TEST_ROOT  = path.join(CACHE_ROOT, "tests", "markets");
fs.mkdirSync(CACHE_ROOT, { recursive: true });
fs.mkdirSync(TEST_ROOT, { recursive: true });

function nowStamp() {
  const d = new Date();
  return d.toISOString().replace(/[:.]/g, "-");
}

async function cacheJSON<T = any>(name: string, url: string, refresh = REFRESH): Promise<T> {
  const f = path.join(CACHE_ROOT, name);
  if (!refresh && fs.existsSync(f)) {
    return JSON.parse(fs.readFileSync(f, "utf8")) as unknown as T;
  }
  const r = await fetch(url);
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`${url} -> ${r.status} ${r.statusText} :: ${txt.slice(0, 300)}`);
  }
  const p = (await r.json()) as unknown as T;
  fs.writeFileSync(f, JSON.stringify(p));
  return p;
}

const asNum = (x: any) => (Number.isFinite(Number(x)) ? Number(x) : null);

// try to pull numeric IDs we’ll join on later
function srcIds(raw: any) {
  const sId =
    raw?.id ??
    raw?.marketId ??
    (typeof raw?.slug === "string" ? (raw.slug.match(/(\d+)(?!.*\d)/)?.[1] ?? null) : null);
  const source_market_id = asNum(sId);
  const event_id = asNum(raw?.eventId ?? raw?.event?.id);
  const condition_id = raw?.conditionId ?? raw?.condition_id ?? null;
  return { source_market_id, event_id, condition_id };
}

// ---------- main ----------
async function main() {
  if (!POLY_URL) throw new Error("POLY_URL not set");
  console.log(`[cache] ${CACHE_ROOT}  (use --refresh to refetch)`);

  // raw + normalized
  const raw = await cacheJSON<any>("markets.json", POLY_URL);
  const list: any[] =
    Array.isArray(raw?.markets?.nodes) ? raw.markets.nodes :
    Array.isArray(raw?.markets)        ? raw.markets :
    Array.isArray(raw)                 ? raw :
    [];
  const items = normalizePolymarket(list);
  console.log(`markets fetched: ${list.length}, normalized: ${items.length}`);

  // compute quick stats
  let volSum = 0, oiSum = 0, withVol = 0, withOi = 0;
  const cat = new Map<string, { vol: number; n: number }>();
  const idCoverage = { source_market_id: 0, event_id: 0, condition_id: 0 };

  for (const m of items) {
    const v = asNum((m as any).volume24h);
    const oi = asNum((m as any).openInterest);
    if (v != null) { volSum += v; withVol++; }
    if (oi != null) { oiSum += oi; withOi++; }

    const c = (m.category ?? "uncategorized") as string;
    const prev = cat.get(c) ?? { vol: 0, n: 0 };
    prev.vol += v ?? 0;
    prev.n += 1;
    cat.set(c, prev);

    const ids = srcIds(m.raw);
    if (ids.source_market_id != null) idCoverage.source_market_id++;
    if (ids.event_id != null)         idCoverage.event_id++;
    if (ids.condition_id != null)     idCoverage.condition_id++;
  }

  // build sample CSV of ids for joining with /trades later
  const stamp = nowStamp();
  const OUT = path.join(TEST_ROOT, stamp);
  fs.mkdirSync(OUT, { recursive: true });

  const idsCsv = [
    ["arbinge_id","source_market_id","event_id","condition_id","category","question"].join(","),
    ...items.map(m => {
      const ids = srcIds(m.raw);
      const q = String(m.question ?? "").replace(/"/g, '""');
      return [
        m.id,
        ids.source_market_id ?? "",
        ids.event_id ?? "",
        (ids.condition_id ?? "").toString().replace(/,/g, ";"),
        (m.category ?? "").toString().replace(/,/g, ";"),
        `"${q}"`
      ].join(",");
    })
  ].join("\n");
  fs.writeFileSync(path.join(OUT, "market_ids.csv"), idsCsv);

  // write summary.json
  const summary = {
    counts: {
      normalized: items.length,
      withVolumeField: withVol,
      withOiField: withOi,
      idCoverage,
    },
    sums: {
      volumeFieldSum: volSum,
      oiFieldSum: oiSum,
    },
    categoryBreakdown: [...cat].map(([k,v]) => ({ category: k, vol: v.vol, count: v.n }))
                               .sort((a,b)=> b.vol - a.vol).slice(0, 20),
    notes: {
      volumeFieldName: "volume24h",
      oiFieldName: "openInterest",
      hint: "Per-market 24h volume from trades will overwrite volume24h; per-market OI kept from Gamma unless you find a breakdown endpoint."
    }
  };
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));

  // write small sample for eyeballing
  const sample = items.slice(0, 5).map(m => ({
    id: m.id,
    question: m.question,
    category: m.category,
    yesPrice: m.yesPrice,
    noPrice:  m.noPrice,
    volume24h: m.volume24h,
    openInterest: m.openInterest,
    ids: srcIds(m.raw),
  }));
  fs.writeFileSync(path.join(OUT, "sample.json"), JSON.stringify(sample, null, 2));

  console.log(`\nWrote probe files to: ${OUT}`);
  console.log("- market_ids.csv  (join keys for trades/OI)")
  console.log("- summary.json    (coverage, sums, top categories)")
  console.log("- sample.json     (first 5 normalized rows + ids)");
}

main().catch(e => { console.error(e); process.exit(1); });
