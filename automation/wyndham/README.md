# Wyndham Playwright automation

This folder holds **runtime artifacts only**. Application logic lives in:

`src/lib/hotels/suppliers/wyndham/`

## Setup

```bash
npm install -D playwright
npx playwright install chromium
```

## Environment

```
HOTEL_WYNDHAM_LIVE=0          # set 1 only on a browser-capable worker
WYNDHAM_LOGIN_USERNAME=
WYNDHAM_LOGIN_PASSWORD=
WYNDHAM_AUTH_STATE_PATH=automation/wyndham/auth-state/storage.json
WYNDHAM_ARTIFACTS_DIR=automation/wyndham/artifacts
WYNDHAM_HEADLESS=1
```

## Notes

- CAPTCHA / login failures → reservation status `needs_manual` + screenshot under `artifacts/`
- Do not run live Wyndham automation on typical Vercel serverless — use a worker host
- Expedia TAAP and Hotelbeds are separate adapters under `src/lib/hotels/suppliers/`
