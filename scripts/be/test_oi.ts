import "dotenv/config";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const POLY_URL = process.env.POLY_URL!;
const OI_BASE  = process.env.POLY_OI_URL || "";
const REFRESH  = process.argv.includes("--refresh");

const CACHE = path.resolve(".cache");
fs.mkdirSync(CACHE, { recursive: true });

async function cacheJSON<T = any>(name: string, url: string): Promise<T> {
  const f = path.join(CACHE, name);
  if (!REFRESH && fs.existsSync(f)) {
    // JSON.parse returns any/unknown under strict settings – cast via unknown
    return JSON.parse(fs.readFileSync(f, "utf8")) as unknown as T;
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} -> ${r.status} ${r.statusText}`);
  const p = (await r.json()) as unknown as T;  // <-- fix here
  fs.writeFileSync(f, JSON.stringify(p));
  return p;
}

async function getJSON<T = any>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} -> ${r.status} ${r.statusText}`);
  return (await r.json()) as unknown as T;     // <-- and here if you use getJSON
}


const num = (x:any) => Number.isFinite(Number(x)) ? Number(x) : null;

// ---- markets
async function fetchMarkets() {
  const payload: any = await cacheJSON("markets.json", POLY_URL);
  const list: any[] =
    Array.isArray(payload?.markets?.nodes) ? payload.markets.nodes :
    Array.isArray(payload?.markets)        ? payload.markets :
    Array.isArray(payload)                 ? payload :
    [];
  const map = new Map<number, { id:string; q:string; oiGamma:number|null }>();
  for (const m of list) {
    const rawId = m?.id ?? m?.marketId ?? m?.slug;
    let src = typeof rawId === "number" ? rawId : Number(rawId);
    if (!Number.isFinite(src) && typeof m?.slug === "string") {
      const hit = m.slug.match(/(\d+)(?!.*\d)/); if (hit) src = Number(hit[1]);
    }
    if (!Number.isFinite(src)) continue;
    map.set(src as number, {
      id: `poly_${m.id ?? m.slug ?? m.ticker ?? m.question}`,
      q: String(m.question ?? m.title ?? "(unknown)"),
      oiGamma: num(m.open_interest ?? m.openInterest ?? m.oi),
    });
  }
  return map;
}

function parseOiAny(p:any) {
  const by = new Map<number, number>();
  let total = num(p?.total) ?? num(p?.openInterestTotal) ?? null;

  if (p?.byMarket && typeof p.byMarket === "object") {
    for (const [k,v] of Object.entries(p.byMarket)) {
      const id = Number(k), oi = num(v); if (Number.isFinite(id) && oi!=null) by.set(id, oi);
    }
  } else if (Array.isArray(p?.data)) {
    for (const r of p.data) {
      const id = num(r?.marketId ?? r?.id);
      const oi = num(r?.open_interest ?? r?.openInterest ?? r?.oi ?? r?.value ?? r?.total);
      if (id!=null && oi!=null) by.set(id, oi);
    }
  } else if (Array.isArray(p)) {
    for (const r of p) {
      const id = num(r?.marketId ?? r?.id);
      const oi = num(r?.open_interest ?? r?.openInterest ?? r?.oi ?? r?.value ?? r?.total);
      if (id!=null && oi!=null) by.set(id, oi);
    }
  } else if (p && typeof p === "object") {
    // flat id->value map fallback
    let guessed = 0;
    for (const [k,v] of Object.entries(p)) {
      const id = Number(k), oi = num(v);
      if (Number.isFinite(id) && oi!=null) { by.set(id, oi); guessed++; }
    }
    if (!guessed) by.clear();
  }
  return { by, total };
}

async function main() {
  if (!POLY_URL) throw new Error("POLY_URL not set");
  console.log(`[cache] dir = ${CACHE}  (use --refresh to refetch)`);

  const markets = await fetchMarkets();
  console.log(`markets: ${markets.size}`);

  if (!OI_BASE) {
    console.log("POLY_OI_URL not set; only checked Gamma per-market OI presence.");
    return;
  }

  const candidates = [
    "oi.json",                       OI_BASE,
    "oi_byMarket.json",              `${OI_BASE}?byMarket=1`,
    "oi_breakdown_market.json",      `${OI_BASE}?breakdown=market`,
    "oi_detail_market.json",         `${OI_BASE}?detail=market`,
    "oi_granularity_market.json",    `${OI_BASE}?granularity=market`,
  ];

  let best:{name:string,url:string,size:number,sum:number,total:number|null} | null = null;

  for (let i=0; i<candidates.length; i+=2) {
    const name = candidates[i], url = candidates[i+1];
    try {
      const p = await cacheJSON(name, url);
      const { by, total } = parseOiAny(p);
      const size = by.size;
      const sum = [...by.values()].reduce((s,v)=>s+(v||0),0);
      console.log(`\n[probe] ${url}\n  entries=${size} sum=${Math.round(sum)} total=${total ?? NaN}`);

      // show a couple of matches
      let shown = 0;
      for (const [mid, oi] of by) {
        const m = markets.get(mid);
        if (m) {
          console.log(`    marketId=${mid}  oi≈${Math.round(oi)}  -> ${m.id} "${m.q.slice(0,60)}"`);
          if (++shown>=3) break;
        }
      }
      if (!best || size > best.size) best = { name, url, size, sum, total };
    } catch (e:any) {
      console.log(`\n[probe] ${url} -> ERROR: ${e.message}`);
    }
  }

  if (!best || best.size === 0) {
    console.log("\nResult: no per-market OI breakdown found. Use Gamma per-market `open_interest` when present; keep Data API for platform total.");
    return;
  }

  console.log("\n====== VERDICT ======");
  console.log(`Use this endpoint for per-market OI:\n  ${best.url}`);
  if (best.total != null) {
    const drift = Math.abs(best.sum - best.total) / Math.max(1, best.total);
    console.log(`by-market sum vs platform total drift: ${(drift*100).toFixed(2)}%`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
