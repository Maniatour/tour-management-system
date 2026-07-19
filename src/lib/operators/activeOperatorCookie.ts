/**
 * Active admin tenant cookie/header (Phase 6c.9).
 * Mirrors localStorage so middleware/API can see the header switch.
 * Does NOT lock down staff RLS yet — prep for future JWT/GUC tenancy.
 */

export const ACTIVE_OPERATOR_ID_COOKIE = 'tms_active_operator_id'
export const ACTIVE_OPERATOR_ID_HEADER = 'x-active-operator-id'

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidOperatorIdFormat(value: string | null | undefined): boolean {
  if (!value) return false
  return UUID_RE.test(value.trim())
}

export function parseActiveOperatorId(raw: string | null | undefined): string | null {
  if (!raw) return null
  let value = raw.trim()
  try {
    value = decodeURIComponent(value)
  } catch {
    // keep raw trim
  }
  return isValidOperatorIdFormat(value) ? value.trim() : null
}

/** Client: sync cookie with localStorage on operator switch. */
export function writeActiveOperatorCookie(operatorId: string): void {
  if (typeof document === 'undefined') return
  const id = parseActiveOperatorId(operatorId)
  if (!id) return
  document.cookie = [
    `${ACTIVE_OPERATOR_ID_COOKIE}=${encodeURIComponent(id)}`,
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE_SEC}`,
    'SameSite=Lax',
  ].join('; ')
}

export function readActiveOperatorIdFromRequestLike(input: {
  cookies?: { get: (name: string) => { value: string } | undefined }
  headers?: { get: (name: string) => string | null }
}): string | null {
  const fromHeader = parseActiveOperatorId(input.headers?.get(ACTIVE_OPERATOR_ID_HEADER))
  if (fromHeader) return fromHeader
  return parseActiveOperatorId(input.cookies?.get(ACTIVE_OPERATOR_ID_COOKIE)?.value)
}

/** Stamp x-active-operator-id on middleware request headers from cookie. */
export function stampActiveOperatorRequestHeader(
  requestHeaders: Headers,
  cookies: { get: (name: string) => { value: string } | undefined }
): void {
  const existing = parseActiveOperatorId(requestHeaders.get(ACTIVE_OPERATOR_ID_HEADER))
  if (existing) {
    requestHeaders.set(ACTIVE_OPERATOR_ID_HEADER, existing)
    return
  }
  const fromCookie = parseActiveOperatorId(cookies.get(ACTIVE_OPERATOR_ID_COOKIE)?.value)
  if (fromCookie) {
    requestHeaders.set(ACTIVE_OPERATOR_ID_HEADER, fromCookie)
  }
}
