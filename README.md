# Verity

**Your agent decides. Verity shows why.**

Verity is a decision-audit gateway for personal AI shopping agents. Before an agent buys, books or renews something, it sends the proposed action and the alternatives it considered. Verity scores the choice against the user's own priorities and rules, then answers **allow**, **hold for approval** or **block**, with reasons and a signed receipt.

Built for the Flipkart APM '29 case: *"It's 2040, everyone has a personal AI agent. Outline the ramifications and build a product that protects people from them."* I chose **hidden influence** (sponsored picks, defaults, fake discounts, pressure tactics) as the problem.

> This is a prototype. All data is simulated, nothing connects to a real marketplace, and the review and price checks are heuristics, not trained models. See [Limitations](#limitations) and [SECURITY.md](SECURITY.md).

## Quick start

Requires Node.js 18 or newer. There are no dependencies to install.

```bash
node server.js          # or: npm start
# open http://localhost:3000
npm test                # 24 tests: data lab, HTTP gateway and the admin lock
```

Settings (environment variables): `PORT` (default 3000), `VERITY_DB` (path of the JSON state file, default `db.json`), `VERITY_ADMIN_TOKEN` (optional: locks the app and `/api` behind a sign-in; open `/?token=<token>` once), `VERITY_SECRET` (signing secret for receipts and webhooks; the default is for demos only).

## What is in it

| Area | What it does |
|---|---|
| Decisions, Approvals, Your Call | Feed of agent actions, approve or reject, and decide first before seeing the agent's pick |
| Influence check | Flags sponsored picks, provider defaults, hidden options, margin gaps, inflated list prices, pressure tactics, surge pricing, bundled add-ons, high return or late-delivery rates, and prices above the 30-day median |
| Receipts | Each live decision gets a signed receipt chained to the previous one; tampering is detected |
| Gateway rules | Per-category modes, daily caps, trusted-sellers-only, delivery and rating floors, duplicate guard, away mode, cooling-off, burst guard, autopilot, custom rules, scoped API keys |
| Explore tab | Scenario packs, wallet, renewals, agent report cards, seller ranking, heatmap, digest, orders, price watch, profiles, PIN, backup and restore |
| Data lab | Import CSV, JSON or Excel (.xlsx); analyse spend; backtest your rules on past orders; check reviews and price histories; try the API in a playground |
| Real-user extras | Time-boxed pre-approval passes, monthly and daily caps, approval notifications, installable offline app, public receipt check page (`/verify.html`), downloadable receipts, audit log export |
| Integration | Versioned HTTP API, listing adapter, SDK, OpenAPI outline, checkout demo page, embeddable badge (`verity-badge.js`) |
| Everyday use | Setup checklist, return deadlines and renewals with calendar export (.ics), month-end spend forecast, printable report, glossary of every flag |
| Operations | Per-key API usage, webhook deliveries with retries, data retention, installable offline app (manifest and service worker) |

## Project layout

```
server.js        HTTP server, state, Server-Sent Events, webhooks
integration.js   /v1 API: auth, rate limit, idempotency, adapter, receipts chain
core.js          Scoring, influence signals and the decision rules (shared with the browser)
datalab.js       Parsers and analytics for messy data (shared with the browser)
index.html       App shell        style.css, flipkart.css   Look and feel
app.js           Base app         extras*.js   Feature tabs layered on the base app
verity-sdk.js    Client for agents (browser and Node)
verity-badge.js  Embeddable result badge for marketplace pages
manifest.json, sw.js, icon.svg   Installable app and offline shell
checkout-demo.html   A mock marketplace checkout calling the gateway
tests/           node:test suites and fixtures        docs/   Architecture, API, demo script
```

## Try the API

```bash
curl -X POST http://localhost:3000/v1/check \
  -H "x-agent-key: verity-demo-key" -H "Content-Type: application/json" \
  -d '{"title":"Buy earbuds","cat":"Electronics","pick":0,"dry_run":true,
       "opts":[{"n":"BoomBuds","price":2999,"mrp":7999,"rating":4.1,"days":2,"margin":24,"spons":true},
               {"n":"SoundCore","price":2499,"rating":4.4,"days":3,"margin":10}]}'
```

More in [docs/API.md](docs/API.md). Design notes are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). A recording script is in [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

## Limitations

- The listing field names (`sellingPrice`, `mrp`, `ratingCount` and so on) are placeholders. A real integration maps the marketplace's own catalog in one function, `fromListing` in `integration.js`.
- State is one JSON file, and the management routes under `/api` have no authentication. Run it on localhost only.
- The browser PIN, order tracking and price watch are demo-grade or simulated.
- History imports contain no alternatives, so the backtest checks single-item rules only, not influence.

## License

MIT, see [LICENSE](LICENSE).
