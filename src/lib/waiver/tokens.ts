import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto'

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

function getWaiverSigningSecret(): string {
  return (
    process.env.WAIVER_TOKEN_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    'kovegas-waiver-signing-dev'
  )
}

function compactUuid(id: string): string | null {
  const compact = id.replace(/-/g, '').toLowerCase()
  return /^[0-9a-f]{32}$/.test(compact) ? compact : null
}

function expandCompactUuid(compact: string): string {
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`
}

/** Reconstructable signing token tied to an invitation id. Old random tokens still work. */
export function buildStableWaiverSigningToken(invitationId: string): string {
  const compact = compactUuid(invitationId)
  if (!compact) throw new Error('Invalid invitation id')
  const sig = createHmac('sha256', getWaiverSigningSecret())
    .update(`waiver-invite:${invitationId.toLowerCase()}`)
    .digest('base64url')
  return `${compact}${sig}`
}

export function parseStableWaiverSigningToken(raw: string): string | null {
  if (!isPlausibleWaiverToken(raw) || raw.length < 54) return null
  const compact = raw.slice(0, 32).toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(compact)) return null
  const invitationId = expandCompactUuid(compact)
  let expected: string
  try {
    expected = buildStableWaiverSigningToken(invitationId)
  } catch {
    return null
  }
  if (!waiverTokensEqual(raw, expected)) return null
  return invitationId
}
