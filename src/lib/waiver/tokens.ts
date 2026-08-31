import { createHash, randomBytes, timingSafeEqual } from 'crypto'

export function generateWaiverRawToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashWaiverToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}

export function waiverTokensEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function isPlausibleWaiverToken(raw: string | null | undefined): boolean {
  if (!raw) return false
  return /^[A-Za-z0-9_-]{32,128}$/.test(raw)
}
