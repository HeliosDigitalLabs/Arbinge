import "dotenv/config";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const BASE = process.env.POLY_TRADES_URL!;
const CACHE = ".cache"; fs.mkdirSync(CACHE,{recursive:true});

const end = new Date();
const start = new Date(end.getTime() - 6 * 3600 * 1000); // 6h to keep it small
const iso = (d:Date)=> d.toISOString().replace(/\.\d{3}Z$/,"Z");

async function tryUrl(name:string, url:string) {
  try {
    const r = await fetch(url);
    const txt = await r.text();
    fs.writeFileSync(path.join(CACHE, name), txt);
    const ok = r.ok;
    let payload:any; try { payload = JSON.parse(txt); } catch {}
    const arr = Array.isArray(payload?.data) ? payload.data
             : Array.isArray(payload?.results) ? payload.results
             : Array.isArray(payload?.trades) ? payload.trades
             : Array.isArray(payload) ? payload : [];
    const first = arr[0] ?? payload;
    console.log(`[${ok ? "OK" : r.status}] ${url}`);
    console.log(`  array_len=${arr.length} keys=${first? Object.keys(first).slice(0,10).join(","): "(none)"}`);
    return { ok, arrLen: arr.length, keys: first ? Object.keys(first) : [] };
  } catch (e:any) {
    console.log(`[ERR] ${url} -> ${e.message}`);
    return { ok:false, arrLen:0, keys:[] };
  }
}

(async()=>{
  if (!BASE) throw new Error("POLY_TRADES_URL not set");
  const tries = [
    // common parameter styles
    `${BASE}?start=${iso(start)}&end=${iso(end)}`,
    `${BASE}?from=${iso(start)}&to=${iso(end)}`,
    `${BASE}?after=${iso(start)}&before=${iso(end)}`,
    // ms timestamps
    `${BASE}?start=${start.getTime()}&end=${end.getTime()}`,
    `${BASE}?from=${start.getTime()}&to=${end.getTime()}`,
    `${BASE}?after=${start.getTime()}&before=${end.getTime()}`,
    // window-only variants
    `${BASE}?window=24h`,
    `${BASE}?range=24h`,
  ];
  for (const [i,u] of tries.entries()) {
    await tryUrl(`trades_try_${i}.json`, u);
  }
})();
