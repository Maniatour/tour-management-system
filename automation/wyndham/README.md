# Wyndham Playwright automation

Application logic: `src/lib/hotels/suppliers/wyndham/`

This folder holds runtime artifacts, probes, and the **production scrape worker**.

## Why a worker?

Vercel serverless cannot run Playwright/Chromium reliably. Production rate fetches
go: **Admin UI / API (Vercel)** → **HTTP worker (office PC or VPS)** → Wyndham public rates.

## Local setup (dev machine)

```bash
npm install -D playwright
npx playwright install chromium
```

`.env.local`:

```
HOTEL_WYNDHAM_LIVE=1
WYNDHAM_HEADLESS=1
WYNDHAM_HOME_URL=https://www.wyndhamhotels.com/en-uk
# Leave WYNDHAM_WORKER_URL empty so Playwright runs in-process
```

## Production: Vercel + worker

### 1) Worker host (office PC / VPS — always on while using hotel rates)

`.env.local` (or system env) on the worker machine:

```
HOTEL_WYNDHAM_LIVE=1
WYNDHAM_WORKER_SELF=1
WYNDHAM_WORKER_SECRET=<long-random-shared-secret>
WYNDHAM_WORKER_PORT=8791
WYNDHAM_HEADLESS=1
# Do NOT set WYNDHAM_WORKER_URL here
```

Start:

```bash
npm run wyndham:worker
```

Health check: `GET http://localhost:8791/health`

Expose the port via Tailscale / Cloudflare Tunnel / reverse proxy (HTTPS recommended).
Firewall: only allow Vercel egress or your VPN.

### 2) Vercel project env

```
HOTEL_WYNDHAM_LIVE=1
WYNDHAM_WORKER_URL=https://your-tunnel-or-vps.example.com
WYNDHAM_WORKER_SECRET=<same-as-worker>
# optional: WYNDHAM_WORKER_TIMEOUT_MS=120000
```

Do **not** install Playwright on Vercel. When `WYNDHAM_WORKER_URL` is set,
`getRates` forwards to `POST /v1/wyndham/get-rates`.

## Worker API

| Method | Path | Auth |
|--------|------|------|
| GET | `/health` | none |
| POST | `/v1/wyndham/get-rates` | `Authorization: Bearer <SECRET>` |

Body:

```json
{ "params": { "supplierHotelId": "page-az", "checkIn": "2026-08-20", "checkOut": "2026-08-21", "destination": "Page AZ" } }
```

Response: `{ "quotes": [ ... ] }`

Jobs are serialized (one Chromium scrape at a time).

## Optional / unused for public rates

```
WYNDHAM_LOGIN_USERNAME=
WYNDHAM_LOGIN_PASSWORD=
WYNDHAM_AUTH_STATE_PATH=automation/wyndham/auth-state/storage.json
WYNDHAM_ARTIFACTS_DIR=automation/wyndham/artifacts
```

Rewards login currently hits Rate Support (`improper-route`) — public rates only.

## Notes

- CAPTCHA / scrape failures → API error + screenshots under `artifacts/`
- Expedia TAAP and Hotelbeds are separate adapters under `src/lib/hotels/suppliers/`
