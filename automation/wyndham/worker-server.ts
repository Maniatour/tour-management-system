/**
 * Long-running Wyndham Playwright worker for production (Vercel cannot run Chromium).
 *
 * Office PC / VPS:
 *   npm run wyndham:worker
 *
 * Required env (worker host):
 *   HOTEL_WYNDHAM_LIVE=1
 *   WYNDHAM_WORKER_SELF=1
 *   WYNDHAM_WORKER_SECRET=<same as Vercel>
 *   WYNDHAM_WORKER_PORT=8791   (optional)
 *   WYNDHAM_HEADLESS=1
 *
 * Vercel:
 *   WYNDHAM_WORKER_URL=https://your-worker.example.com
 *   WYNDHAM_WORKER_SECRET=<same>
 *   HOTEL_WYNDHAM_LIVE=1
 *
 * Do NOT set WYNDHAM_WORKER_URL on the worker itself.
 */
import http from 'node:http'
import { createWyndhamProvider } from '../../src/lib/hotels/suppliers/wyndham/wyndham-provider'
import { WyndhamAutomationError } from '../../src/lib/hotels/suppliers/wyndham/session'
import type { RateQueryParams } from '../../src/lib/hotels/types'

process.env.WYNDHAM_WORKER_SELF = '1'
process.env.HOTEL_WYNDHAM_LIVE = process.env.HOTEL_WYNDHAM_LIVE || '1'
delete process.env.WYNDHAM_WORKER_URL

const PORT = Number(process.env.WYNDHAM_WORKER_PORT || 8791)
const SECRET = process.env.WYNDHAM_WORKER_SECRET?.trim() || ''

/**
 * Limited Chromium concurrency (default 2).
 * Survey runs Page+Kanab (and multiple nights) in parallel — serial queue
 * made “약 8회” take ~4 minutes even when the API asked for parallel scrapes.
 */
const MAX_CONCURRENT = Math.max(
  1,
  Number(process.env.WYNDHAM_WORKER_CONCURRENCY || 2)
)
let activeJobs = 0
const waitQueue: Array<() => void> = []

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = () => {
      activeJobs += 1
      fn()
        .then(resolve, reject)
        .finally(() => {
          activeJobs -= 1
          const next = waitQueue.shift()
          if (next) next()
        })
    }
    if (activeJobs < MAX_CONCURRENT) start()
    else waitQueue.push(start)
  })
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function json(
  res: http.ServerResponse,
  status: number,
  body: Record<string, unknown>
) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function unauthorized(res: http.ServerResponse) {
  json(res, 401, { error: 'Unauthorized' })
}

function checkAuth(req: http.IncomingMessage): boolean {
  if (!SECRET) return false
  const header = req.headers.authorization || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return Boolean(match && match[1] === SECRET)
}

const provider = createWyndhamProvider({ live: true })

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`)
  const method = req.method || 'GET'

  if (method === 'GET' && url.pathname === '/health') {
    json(res, 200, {
      ok: true,
      service: 'wyndham-worker',
      mode: 'public',
      secretConfigured: Boolean(SECRET),
      live: process.env.HOTEL_WYNDHAM_LIVE === '1',
      self: process.env.WYNDHAM_WORKER_SELF === '1',
      concurrency: MAX_CONCURRENT,
      activeJobs,
      queued: waitQueue.length,
    })
    return
  }

  if (method === 'POST' && url.pathname === '/v1/wyndham/get-rates') {
    if (!checkAuth(req)) {
      unauthorized(res)
      return
    }

    try {
      const raw = await readBody(req)
      const body = JSON.parse(raw || '{}') as { params?: RateQueryParams }
      const params = body.params

      if (
        !params?.supplierHotelId ||
        !params.checkIn ||
        !params.checkOut
      ) {
        json(res, 400, {
          error: 'params.supplierHotelId, checkIn, checkOut are required',
        })
        return
      }

      console.log(
        `[wyndham-worker] getRates ${params.destination || params.supplierHotelId} ${params.checkIn}→${params.checkOut}`
      )

      const quotes = await enqueue(() => provider.getRates(params))
      console.log(`[wyndham-worker] ok quotes=${quotes.length}`)
      json(res, 200, { quotes })
    } catch (error) {
      const message =
        error instanceof WyndhamAutomationError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error)
      const code =
        error instanceof WyndhamAutomationError && error.kind === 'needs_manual'
          ? 422
          : 500
      console.error(`[wyndham-worker] error: ${message}`)
      json(res, code, { error: message })
    }
    return
  }

  json(res, 404, { error: 'Not found' })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(
    `[wyndham-worker] listening on http://0.0.0.0:${PORT} concurrency=${MAX_CONCURRENT}`
  )
  if (!SECRET) {
    console.warn(
      '[wyndham-worker] WARNING: WYNDHAM_WORKER_SECRET is empty — all rate requests will be rejected'
    )
  }
})
