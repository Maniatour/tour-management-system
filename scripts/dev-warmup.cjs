/**
 * dev 서버가 떠 있는 상태에서 자주 쓰는 라우트를 한 번씩 요청해 webpack 컴파일 캐시를 워밍업한다.
 * 사용: npm run dev  (다른 터미널) → npm run dev:warmup
 */
const http = require('node:http')

const host = process.env.DEV_WARMUP_HOST || 'localhost'
const port = parseInt(process.env.PORT || process.env.DEV_WARMUP_PORT || '3000', 10)
const waitMs = Math.max(5_000, parseInt(process.env.DEV_WARMUP_WAIT_MS || '120000', 10) || 120_000)

const ROUTES = [
  '/ko',
  '/ko/admin',
  '/ko/admin/customer-pages',
  '/ko/admin/reservations',
  '/api/weather-status',
  '/api/messenger-contact-settings',
]

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function requestRoute(pathname) {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const req = http.request(
      {
        hostname: host,
        port,
        path: pathname,
        method: 'GET',
        timeout: 180_000,
      },
      (res) => {
        res.resume()
        res.on('end', () => {
          resolve({
            path: pathname,
            status: res.statusCode ?? 0,
            ms: Date.now() - started,
          })
        })
      }
    )
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`timeout ${pathname}`))
    })
    req.on('error', reject)
    req.end()
  })
}

async function waitForServer() {
  const deadline = Date.now() + waitMs
  while (Date.now() < deadline) {
    try {
      await requestRoute('/ko')
      return true
    } catch {
      process.stdout.write('.')
      await sleep(2000)
    }
  }
  return false
}

async function main() {
  console.log(`[dev:warmup] waiting for http://${host}:${port} (max ${Math.round(waitMs / 1000)}s)...`)
  const ready = await waitForServer()
  if (!ready) {
    console.error(`\n[dev:warmup] server not ready on :${port}. Run npm run dev first.`)
    process.exit(1)
  }
  console.log(`\n[dev:warmup] server ready — warming ${ROUTES.length} routes`)

  for (const route of ROUTES) {
    try {
      const result = await requestRoute(route)
      const ok = result.status >= 200 && result.status < 500
      console.log(
        `[${ok ? 'ok' : 'warn'}] ${result.status} ${(result.ms / 1000).toFixed(1)}s ${route}`
      )
    } catch (err) {
      console.log(`[fail] ${route} — ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log('[dev:warmup] done')
}

main().catch((err) => {
  console.error('[dev:warmup] fatal:', err)
  process.exit(1)
})
