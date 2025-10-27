import "dotenv/config";
import express from "express";
import { createClient } from "redis";
import { Pool } from "pg";

const app = express();
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // dev-only; lock down later
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

const redis = createClient({ url: process.env.REDIS_URL });

// tiny interface so TS doesn't widen
type QueryablePool = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
  end: () => Promise<void>;
};

const pool = new Pool({
  connectionString: process.env.PG_URL!,
}) as unknown as QueryablePool;

const cacheJSON = (k: string) => async (_req: any, res: any) => {
  const v = await redis.get(k);
  if (v) return res.json(JSON.parse(v));

  if (k.includes(":summary")) {
    const { rows } = await pool.query(
      "select platform, count(*) as c from markets group by platform"
    );
    return res.json({ platforms: rows });
  }
  res.status(503).json({ error: "warming up" });
};

app.get("/v1/summary",        cacheJSON("hot:combined:summary"));
app.get("/v1/summary/poly",   cacheJSON("hot:poly:summary"));
app.get("/v1/summary/kalshi", cacheJSON("hot:kalshi:summary"));

app.get("/v1/markets",        cacheJSON("hot:combined:markets"));
app.get("/v1/markets/poly",   cacheJSON("hot:poly:markets"));
app.get("/v1/markets/kalshi", cacheJSON("hot:kalshi:markets"));

app.get("/healthz", (_req,res)=> res.json({ ok:true }));

async function main() {
  try {
    await redis.connect();
  } catch (e) {
    console.error("Redis connect failed:", e);
  }

  console.log("PG_URL =", process.env.PG_URL || "(unset)");
  try {
    const probe = await pool.query(
      `select current_database() as db,
              inet_server_addr() as host,
              inet_server_port() as port`
    );
    console.log("PG_CONNECT =", probe.rows[0]);
  } catch (e: any) {
    // 3D000 = “database does not exist” — log but keep API up
    console.warn("PG probe failed:", e.code || e.message);
  }

  app.listen(4001, () => console.log("API listening on :4001"));
}


main();
