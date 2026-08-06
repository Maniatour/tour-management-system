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
WYNDHAM_LOGIN_EMAIL=
WYNDHAM_LOGIN_PASSWORD=
CRON_SECRET=
```

## Crons

- `GET /api/cron/hotel-rate-check` — daily 06:00 UTC
- `GET /api/cron/hotel-reservation-monitor` — every 4 hours

## Existing ops ledger

`tour_hotel_bookings.hotel_reservation_id` links supplier reservations to the current Booking HQ hotel tab.
