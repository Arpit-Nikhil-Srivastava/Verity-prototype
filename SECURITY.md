# Security notes

Verity is a prototype. This file lists what is demo-grade so nobody mistakes it for production.

## Known limits

- **`/api/*` is open unless you set `VERITY_ADMIN_TOKEN`.** With the token set, the app and management routes need a cookie from `/?token=...`. The token travels once in the URL, so it can appear in browser history and logs, and there is no per-user login or built-in HTTPS. Without the token, anyone who can reach the server can read state, change rules, create or revoke keys, and reset data. `/v1/*` always uses API keys. Run on localhost or behind a trusted proxy.
- **Demo keys are public.** `verity-demo-key` and the other seeded keys are in the source.
- **Default signing secret.** Receipts and webhook signatures use `verity-demo-secret` unless `VERITY_SECRET` is set. A production system would use a managed secret with rotation.
- **Open CORS** (`*`) so the checkout demo and SDK work from any page. Production would allow named origins only.
- **Client-side PIN and auto-lock** use a short non-cryptographic hash in the browser. They deter casual misuse only. Real approvals need server-side authentication.
- **Service worker** caches only static files. API calls are never cached, but a shared device keeps the cached app shell.
- **Single-file JSON storage** with no encryption at rest.
- **In-memory rate limits and idempotency cache** reset on restart and do not work across several servers.

## What is done properly

- API keys can be scoped to one category and a maximum amount, and revoked.
- Receipts are HMAC-SHA256 signed and chained, so edits to past decisions are detected.
- Webhook bodies are signed with HMAC-SHA256 (`x-verity-signature`). Delivery is retried twice (after 1 s and 3 s) on server errors or no answer, and each attempt is logged.
- Data retention can delete decisions older than a chosen number of days. Held items are kept, and the receipt chain is checked from the oldest receipt kept.
- Imported data is parsed in the browser and not sent anywhere unless you use the gateway items import or the playground.

## Before any real deployment

Authenticate every route, move to a real database, manage secrets and keys properly, restrict CORS, add audit logging and a privacy review for the purchase data Verity handles.

## Reporting

This is a student project. Open an issue on the repository.
