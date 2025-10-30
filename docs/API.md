# 🌐 API Reference

Base URL: `http://localhost:4001`

---

### GET `/v1/summary/poly`
Polymarket summary for the last 24 hours.

```json
{
  "activeMarkets": 1116,
  "totalVolume24h": 20371577.351,
  "totalOpenInterest": 43949742.0,
  "byPlatform": {
    "polymarket": { "active": 1116, "vol24h": 20371577.351, "oi": 43949742.0 }
  },
  "byCategory": [
    { "category": "Politics", "vol24h": 7200000, "count": 212 }
  ]
}
GET /v1/markets/poly
List of markets with current stats.

json
Copy code
{
  "id": "poly_642622",
  "platform": "polymarket",
  "question": "Will Ethereum be above $4,600 on October 28?",
  "category": "Crypto",
  "yesPrice": 0.34,
  "noPrice": 0.66,
  "volume24h": 34516.27,
  "openInterest": 10293.5,
  "lastTradeTs": "2025-10-28T23:52:00Z"
}
GET /v1/summary
Combined summary (across platforms).

GET /healthz
Health check:

json
Copy code
{ "ok": true }