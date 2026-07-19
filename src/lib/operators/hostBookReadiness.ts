/**
 * Host-book readiness smoke (Phase 6e.2).
 * Read-only preflight before manual Operator B host book / Connect E2E.
 * Does not call checkout, Stripe, or change booking logic.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import {
  clearPublicOperatorHostCache,
  resolveOperatorFromHost,
} from '@/lib/operators/resolveOperatorFromHost'
import {
  KOVEgAS_DIRECT_CHANNEL_ID,
  resolvePublicDirectChannel,
} from '@/lib/operators/resolvePublicDirectChannel'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'

type Db = SupabaseClient<Database>

export type HostBookCheckId =
  | 'subdomainConfigured'
  | 'routingEnvReady'
  | 'hostResolveMatches'
  | 'catalogReadyForHost'
  | 'directChannelReady'
  | 'debugEndpointAvailable'

export type HostBookCheckResult = {
  id: HostBookCheckId
  ok: boolean
  detail: string
}

export type HostBookReadinessReport = {
  operatorId: string
  isKovegas: boolean
  checks: HostBookCheckResult[]
  passedCount: number
  totalCount: number
  allOk: boolean
}

function routingEnvReadyDetail(): { ok: boolean; detail: string } {
  const root = (process.env.SAAS_PLATFORM_ROOT_DOMAIN || '').trim()
  const map = (process.env.SAAS_SUBDOMAIN_OPERATOR_MAP || '').trim()
  const apex = (process.env.SAAS_APEX_HOSTS || '').trim()
  // Local pilot can use `{sub}.localhost` without platform root.
  const ok = true
  const parts = [
    root ? `SAAS_PLATFORM_ROOT_DOMAIN=${root}` : 'SAAS_PLATFORM_ROOT_DOMAIN unset (ok if .localhost pilot)',
    map ? 'SAAS_SUBDOMAIN_OPERATOR_MAP set' : 'SAAS_SUBDOMAIN_OPERATOR_MAP unset',
    apex ? `SAAS_APEX_HOSTS set` : 'SAAS_APEX_HOSTS default',
  ]
  return { ok, detail: parts.join('; ') }
}

export async function evaluateHostBookReadiness(
  db: Db,
  operatorIdRaw?: string | null
): Promise<HostBookReadinessReport> {
  const operatorId = resolveOperatorId(operatorIdRaw)
  const isKovegas = operatorId === KOVEgAS_OPERATOR_ID

  const { data: op, error: opErr } = await db
    .from('operators')
    .select('id, slug, subdomain, status')
    .eq('id', operatorId)
    .maybeSingle()

  const checks: HostBookCheckResult[] = []

  if (opErr || !op) {
    checks.push({
      id: 'subdomainConfigured',
      ok: false,
      detail: opErr?.message || 'Operator not found',
    })
    checks.push({
      id: 'routingEnvReady',
      ok: false,
      detail: 'Skipped — operator missing',
    })
    checks.push({
      id: 'hostResolveMatches',
      ok: false,
      detail: 'Skipped — operator missing',
    })
    checks.push({
      id: 'catalogReadyForHost',
      ok: false,
      detail: 'Skipped — operator missing',
    })
    checks.push({
      id: 'directChannelReady',
      ok: false,
      detail: 'Skipped — operator missing',
    })
    checks.push({
      id: 'debugEndpointAvailable',
      ok: process.env.NODE_ENV !== 'production',
      detail:
        process.env.NODE_ENV !== 'production'
          ? 'GET /api/debug/public-operator available in non-production'
          : 'Debug endpoint disabled in production (expected)',
    })
    const passedCount = checks.filter((c) => c.ok).length
    return {
      operatorId,
      isKovegas,
      checks,
      passedCount,
      totalCount: checks.length,
      allOk: passedCount === checks.length,
    }
  }

  const subdomain = String(op.subdomain || '').trim().toLowerCase()
  const slug = String(op.slug || '').trim().toLowerCase()

  if (isKovegas) {
    checks.push({
      id: 'subdomainConfigured',
      ok: true,
      detail: subdomain
        ? `Kovegas subdomain=${subdomain} (apex host also maps to Tenant #1)`
        : `Kovegas slug=${slug || 'kovegas'} — apex/localhost → Tenant #1`,
    })
  } else {
    checks.push({
      id: 'subdomainConfigured',
      ok: subdomain.length > 0,
      detail: subdomain
        ? `operators.subdomain=${subdomain}`
        : 'operators.subdomain empty — set before host book E2E',
    })
  }

  const env = routingEnvReadyDetail()
  checks.push({
    id: 'routingEnvReady',
    ok: env.ok,
    detail: env.detail,
  })

  clearPublicOperatorHostCache()
  if (isKovegas) {
    const resolved = await resolveOperatorFromHost('localhost')
    checks.push({
      id: 'hostResolveMatches',
      ok: resolved.operatorId === KOVEgAS_OPERATOR_ID,
      detail: `localhost → ${resolved.operatorId} source=${resolved.source} (expect Kovegas)`,
    })
  } else if (!subdomain) {
    checks.push({
      id: 'hostResolveMatches',
      ok: false,
      detail: 'Cannot probe host resolve without operators.subdomain',
    })
  } else {
    const probeHost = `${subdomain}.localhost`
    const resolved = await resolveOperatorFromHost(probeHost)
    const ok = resolved.operatorId === operatorId
    checks.push({
      id: 'hostResolveMatches',
      ok,
      detail: ok
        ? `${probeHost} → ${resolved.operatorId} source=${resolved.source}`
        : `${probeHost} → ${resolved.operatorId} source=${resolved.source} (expected ${operatorId}) — check subdomain RPC / SAAS_SUBDOMAIN_OPERATOR_MAP`,
    })
  }

  const { count: productCount, error: productErr } = await fromUntypedTable(db, 'products')
    .select('id', { count: 'exact', head: true })
    .eq('operator_id', operatorId)

  if (productErr) {
    checks.push({
      id: 'catalogReadyForHost',
      ok: false,
      detail: productErr.message || 'products count failed',
    })
  } else {
    const n = productCount ?? 0
    checks.push({
      id: 'catalogReadyForHost',
      ok: n > 0,
      detail:
        n > 0
          ? `products=${n} for active tenant — host catalog can list offerings`
          : 'products=0 — create B catalog before host book',
    })
  }

  try {
    const direct = await resolvePublicDirectChannel(db, operatorId, { ensure: false })
    const ok = isKovegas
      ? direct.channelId === KOVEgAS_DIRECT_CHANNEL_ID
      : Boolean(direct.channelId)
    checks.push({
      id: 'directChannelReady',
      ok,
      detail: isKovegas
        ? `Direct=${direct.channelId} (expect ${KOVEgAS_DIRECT_CHANNEL_ID})`
        : `B Direct=${direct.channelId} source=${direct.source}`,
    })
  } catch (err) {
    checks.push({
      id: 'directChannelReady',
      ok: false,
      detail:
        err instanceof Error
          ? err.message
          : 'Direct Web channel missing for Operator B',
    })
  }

  checks.push({
    id: 'debugEndpointAvailable',
    ok: true,
    detail:
      process.env.NODE_ENV === 'production'
        ? 'In prod: confirm host via middleware cookies / staff preview; debug route is OFF'
        : 'Dev: open /api/debug/public-operator on B host to confirm middleware stamp',
  })

  const passedCount = checks.filter((c) => c.ok).length
  return {
    operatorId,
    isKovegas,
    checks,
    passedCount,
    totalCount: checks.length,
    allOk: passedCount === checks.length,
  }
}
