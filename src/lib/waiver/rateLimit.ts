type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export function consumeWaiverRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now()
  const current = buckets.get(key)
  if (!current || now >= current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true }
  }
  if (current.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) }
  }
  current.count += 1
  return { ok: true }
}

export function clientIpFromRequest(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first.slice(0, 64)
  }
  const real = request.headers.get('x-real-ip')?.trim()
  return real ? real.slice(0, 64) : null
}

export function userAgentFromRequest(request: Request): string | null {
  const ua = request.headers.get('user-agent')
  return ua ? ua.slice(0, 500) : null
}
