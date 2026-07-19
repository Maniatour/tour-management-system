/**
 * Host → operator_id for customer-site SaaS routing (Phase 5e).
 * Safe default is always Kovegas. Does not change booking/checkout behavior.
 */
import {
  KOVEgAS_OPERATOR_ID,
  KOVEgAS_OPERATOR_SLUG,
} from '@/lib/operatorConstants'
import type { PublicOperatorSource } from '@/lib/operators/publicOperatorHeaders'

export type ResolvedPublicOperator = {
  operatorId: string
  subdomain: string | null
  source: PublicOperatorSource
}

type CacheEntry = {
  value: ResolvedPublicOperator | null
  expiresAt: number
}

const CACHE_TTL_MS = 60_000
const subdomainCache = new Map<string, CacheEntry>()

function kovegas(source: PublicOperatorSource): ResolvedPublicOperator {
  return {
    operatorId: KOVEgAS_OPERATOR_ID,
    subdomain: KOVEgAS_OPERATOR_SLUG,
    source,
  }
}

/** Strip port and lowercase. */
export function normalizeHostname(raw: string | null | undefined): string {
  const h = (raw || '').trim().toLowerCase()
  if (!h) return ''
  const first = h.split(',')[0]?.trim() || ''
  return first.replace(/:\d+$/, '')
}

export function parseHostnameFromHeaders(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-host')
  const host = headers.get('host')
  return normalizeHostname(forwarded || host || '')
}

function getApexHosts(): Set<string> {
  const fromEnv = (process.env.SAAS_APEX_HOSTS || '')
    .split(',')
    .map((s) => normalizeHostname(s))
    .filter(Boolean)
  const defaults = [
    'kovegas.com',
    'www.kovegas.com',
    'maniatour.com',
    'www.maniatour.com',
  ]
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (site) {
    try {
      const u = new URL(site.includes('://') ? site : `https://${site}`)
      const hn = normalizeHostname(u.hostname)
      if (hn) {
        defaults.push(hn)
        if (!hn.startsWith('www.')) defaults.push(`www.${hn}`)
      }
    } catch {
      /* ignore */
    }
  }
  return new Set([...defaults, ...fromEnv])
}

function getPlatformRootDomain(): string {
  return normalizeHostname(process.env.SAAS_PLATFORM_ROOT_DOMAIN || '')
}

/** `acme:uuid,demo:uuid` pilot map (no DB). */
function lookupEnvSubdomainMap(sub: string): string | null {
  const raw = process.env.SAAS_SUBDOMAIN_OPERATOR_MAP || ''
  if (!raw.trim()) return null
  for (const part of raw.split(',')) {
    const [k, v] = part.split(':').map((s) => (s || '').trim())
    if (k && v && k.toLowerCase() === sub) return v
  }
  return null
}

/**
 * Extract tenant label from `{sub}.{platformRoot}` or `{sub}.localhost`.
 * Returns null for apex / bare localhost.
 */
export function extractSubdomainLabel(
  hostname: string,
  platformRoot: string
): string | null {
  if (!hostname) return null
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null

  if (hostname.endsWith('.localhost')) {
    const label = hostname.slice(0, -'.localhost'.length)
    if (!label || label.includes('.')) return null
    return label
  }

  if (platformRoot && (hostname === platformRoot || hostname === `www.${platformRoot}`)) {
    return null
  }

  if (platformRoot && hostname.endsWith(`.${platformRoot}`)) {
    const label = hostname.slice(0, -(platformRoot.length + 1))
    if (!label || label.includes('.')) return null
    if (label === 'www') return null
    return label
  }

  return null
}

async function resolveSubdomainLabel(label: string): Promise<ResolvedPublicOperator | null> {
  const key = label.toLowerCase()
  const cached = subdomainCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  const envId = lookupEnvSubdomainMap(key)
  if (envId) {
    const value: ResolvedPublicOperator = {
      operatorId: envId,
      subdomain: key,
      source: 'env_map',
    }
    subdomainCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
    return value
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!supabaseUrl || !anonKey) {
    subdomainCache.set(key, { value: null, expiresAt: Date.now() + CACHE_TTL_MS })
    return null
  }

  try {
    // SECURITY DEFINER RPC — anon cannot SELECT operators.* (Connect secrets)
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/lookup_operator_id_by_subdomain`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_sub: key }),
      cache: 'no-store',
    })
    if (!res.ok) {
      console.warn('[resolveOperatorFromHost] subdomain RPC failed', res.status)
      subdomainCache.set(key, { value: null, expiresAt: Date.now() + 5_000 })
      return null
    }
    const raw = await res.json()
    const id = raw == null || raw === '' ? null : String(raw)
    const value: ResolvedPublicOperator | null = id
      ? { operatorId: id, subdomain: key, source: 'subdomain' }
      : null
    subdomainCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
    return value
  } catch (err) {
    console.warn('[resolveOperatorFromHost] subdomain RPC error', err)
    subdomainCache.set(key, { value: null, expiresAt: Date.now() + 5_000 })
    return null
  }
}

/**
 * Resolve public operator from a hostname (no headers).
 */
export async function resolveOperatorFromHost(
  hostnameRaw: string
): Promise<ResolvedPublicOperator> {
  const hostname = normalizeHostname(hostnameRaw)
  if (!hostname) return kovegas('fallback')

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return kovegas('localhost')
  }

  const apex = getApexHosts()
  if (apex.has(hostname)) {
    return kovegas('apex')
  }

  const platformRoot = getPlatformRootDomain()
  if (platformRoot && (hostname === platformRoot || hostname === `www.${platformRoot}`)) {
    return kovegas('apex')
  }

  const label = extractSubdomainLabel(hostname, platformRoot)
  if (!label) {
    return kovegas('fallback')
  }

  if (label === KOVEgAS_OPERATOR_SLUG) {
    return kovegas('subdomain')
  }
  if (label === 'www' || label === 'admin') {
    return kovegas('fallback')
  }

  const resolved = await resolveSubdomainLabel(label)
  if (resolved) return resolved

  if (process.env.NODE_ENV === 'development') {
    console.warn('[resolveOperatorFromHost] unknown subdomain → Kovegas', label)
  }
  return kovegas('fallback')
}

export async function resolveOperatorFromRequestHeaders(
  headers: Headers
): Promise<ResolvedPublicOperator> {
  return resolveOperatorFromHost(parseHostnameFromHeaders(headers))
}

/** Test helper: clear subdomain lookup cache */
export function clearPublicOperatorHostCache(): void {
  subdomainCache.clear()
}
