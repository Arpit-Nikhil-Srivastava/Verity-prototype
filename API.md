# API

Base URL: `http://localhost:3000`. Send the key in `x-agent-key` (or `Authorization: Bearer <key>`). Rate limit: 60 checks per minute per key. Errors: `400` bad payload, `401` bad or revoked key, `429` rate limit.

## POST /v1/check

Accepts either the native shape or a marketplace listing shape.

**Native**

```json
{ "title": "Buy earbuds", "cat": "Electronics", "pick": 0, "dry_run": true,
  "opts": [ { "n": "BoomBuds", "price": 2999, "mrp": 7999, "rating": 4.1, "days": 2, "margin": 24, "spons": true },
            { "n": "SoundCore", "price": 2499, "rating": 4.4, "days": 3, "margin": 10 } ] }
```

Optional option fields: `reviews`, `urgent`, `surge`, `addon`, `dflt`, `hidden`, `hist` (past prices), `returnRate`, `lateRate`. Categories: Shopping, Travel, Subscriptions, Dining, Electronics, Groceries, Fashion, Bills.

**Listing shape** (field names are placeholders, mapped by `fromListing`)

```json
{ "intent": "Buy running shoes", "category": "Fashion", "chosen": "A",
  "listings": [ { "id": "A", "title": "StrideMax", "sellingPrice": 6499, "mrp": 12999, "rating": 4.2,
                  "ratingCount": 61, "deliveryDays": 2, "sponsored": true, "commissionPct": 18,
                  "priceHistory30d": [6399, 6499, 6499, 6399, 6599], "returnRatePct": 24 },
                { "id": "B", "title": "Nimbus", "sellingPrice": 4799, "rating": 4.5, "ratingCount": 8200, "deliveryDays": 3 } ] }
```

**Response**

```json
{ "decision": "hold", "why": ["Looks influenced (fit 0%)"], "fit": 0, "risk": "high",
  "signals": ["Discount is measured against an inflated list price", "24% of buyers return this item"],
  "receipt": { "id": "VR-00007", "hash": "…" }, "api_version": "v1" }
```

`dry_run: true` returns the decision without recording it and without a receipt. Add `Idempotency-Key: <id>` to make retries safe; a repeat returns the first answer with `"replay": true`.

## POST /v1/check/batch

`{ "items": [ …up to 20 checks… ], "dry_run": true }`. Dry run is the default. One invalid item fails the whole request with `400`; check items one at a time to isolate it.

## GET /v1/audit?since=<epoch ms>

Latest 100 signed receipts with agent, category, item, price, verdict and outcome.

## GET /v1/receipts/verify?id=VR-00007

Returns `valid` (this receipt's signature) and `chain_ok` (the whole chain). No key needed.

## Webhooks

Held and blocked actions are POSTed to the webhook URL with `x-verity-signature: sha256=<hex>`, the HMAC-SHA256 of the raw body.

```js
const crypto = require("crypto");
const ok = (raw, header, secret) => {
  const mac = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  return header.length === mac.length && crypto.timingSafeEqual(Buffer.from(header), Buffer.from(mac));
};
```

## SDK

```js
Verity.base = "http://localhost:3000"; Verity.key = "verity-demo-key";
const r = await Verity.check({ /* payload */ }, { idempotencyKey: "order-1042" });
```
