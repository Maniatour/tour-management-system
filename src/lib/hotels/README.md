# Hotel Management Module

Internal tour-ops hotel procurement — **not** a customer booking engine.

## Architecture

```
HotelManager  →  HotelSupplier (interface)  →  Wyndham | Expedia TAAP | Hotelbeds | manual
                     ↑
              StayAPI = metadata only (images/amenities) — never bookings/cost
```

## Key paths

| Path | Role |
|------|------|
| `src/lib/hotels/suppliers/` | Adapter interface + registry |
| `src/lib/hotels/suppliers/wyndham/` | Playwright automation (isolated) |
| `src/lib/hotels/suppliers/expedia-taap/` | TAAP API-ready stub |
| `src/lib/hotels/suppliers/hotelbeds/` | Hotelbeds stub |
| `src/lib/hotels/metadata/` | StayAPI enrichment only |
| `src/lib/hotels/hotel-manager.ts` | Orchestration |
| `src/app/[locale]/admin/hotels` | Admin UI |
| `supabase/migrations/20260805020000_hotel_management_module.sql` | Schema |

## Env flags

```
HOTEL_WYNDHAM_LIVE=0
HOTEL_EXPEDIA_TAAP_LIVE=0
HOTEL_HOTELBEDS_LIVE=0
STAYAPI_API_KEY=
WYNDHAM_LOGIN_USERNAME=
WYNDHAM_LOGIN_PASSWORD=
CRON_SECRET=

# Production (Vercel): forward scrapes to a Playwright worker
# WYNDHAM_WORKER_URL=https://worker.example.com
# WYNDHAM_WORKER_SECRET=<shared>
# WYNDHAM_WORKER_TIMEOUT_MS=120000

# Worker host only:
# WYNDHAM_WORKER_SELF=1
# WYNDHAM_WORKER_PORT=8791
```

## Production Wyndham rates

Vercel cannot run Playwright. Use:

1. Vercel env: `WYNDHAM_WORKER_URL` + `WYNDHAM_WORKER_SECRET` + `HOTEL_WYNDHAM_LIVE=1`
2. Office PC/VPS: `npm run wyndham:worker` (see `automation/wyndham/README.md`)

Locally, leave `WYNDHAM_WORKER_URL` empty so Chromium runs in-process.

Tour hotel price-check (업무 TODO) and 호텔 관리 rates both read/write `hotel_rates`
via the same Wyndham catalog hotels — refresh keeps badges after scrape.

## Crons

- `GET /api/cron/hotel-rate-check` — daily 06:00 UTC
- `GET /api/cron/hotel-reservation-monitor` — every 4 hours

## Existing ops ledger

`tour_hotel_bookings.hotel_reservation_id` links supplier reservations to the current Booking HQ hotel tab.
