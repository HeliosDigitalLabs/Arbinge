module.exports = {
  apps: [
    // ✅ Hourly cadence for macro dashboard
    { name: "ingest-poly",    script: "npx", args: "tsx workers/ingest-polymarket.ts", cron_restart: "0 * * * *" },

    // Combine a few minutes after ingest so both caches are fresh
    { name: "compute-metrics", script: "npx", args: "tsx workers/compute-metrics.ts",  cron_restart: "5 * * * *" },

    // API stays always-on (no cron)
    { name: "api",            script: "npx", args: "tsx apps/api/src/index.ts" }
  ]
};
