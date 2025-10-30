# ADR 001 — Normalize First Design Decision
**Date:** 2025-10-28  **Status:** Accepted

---

## Context
Polymarket exposes multiple heterogeneous data sources:
- Gamma REST API → market metadata  
- Goldsky GraphQL → trade + OI data  

These use inconsistent field names and formats.  
To join and aggregate accurately, data must first be normalized.

---

## Decision
Adopt a **normalize-first** pattern:

1. Fetch raw data from upstreams.  
2. Normalize to a canonical `MarketNorm` shape.  
3. Enrich with 24 h trades and open interest.  
4. Persist normalized rows → DB & Redis.

---

## Consequences
- ✅ Consistent schema for all downstream consumers.  
- ✅ Easy cross-source joins (Gamma, Goldsky).  
- ✅ Future sources (Kalshi, PredictIt) reuse same format.  
- ⚠️ Adds a transform layer but greatly simplifies analytics.

---

## Implementation
Defined in `/packages/core/schema.ts`:

```ts
export const normalizePolymarket = (payload: any): MarketNorm[] => { … }
Produces:

ts
Copy code
{
  id: "poly_<id>",
  platform: "polymarket",
  question: "...",
  category: "...",
  yesPrice: number | null,
  noPrice: number | null,
  volume24h: number | null,
  openInterest: number | null,
  lastTradeTs: string | null,
  raw: Record<string, any>
}
Downstream workers (ingest-polymarket, compute-metrics) consume this canonical structure.