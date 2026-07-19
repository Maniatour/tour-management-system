/**
 * Resolve (and optionally ensure) the Direct Web / Homepage channel
 * for a public SaaS operator (Phase 5e.2).
 *
 * Kovegas always uses M00001. Other operators get a Website/Homepage channel
 * scoped by operator_id (auto-created if missing).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'

/** Kovegas Direct Web — must stay M00001 (seeded homepage channel). */
export const KOVEgAS_DIRECT_CHANNEL_ID = 'M00001' as const

type Db = SupabaseClient<Database>

export type PublicDirectChannelResolution = {
  operatorId: string
  channelId: string
  created: boolean
  source: 'kovegas_m00001' | 'existing' | 'ensured'
}

function directChannelIdForSlug(slug: string): string {
  const safe = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
  const base = safe || 'op'
  return `DW-${base}`.slice(0, 32)
}

async function findExistingDirectChannel(
  db: Db,
  operatorId: string
): Promise<string | null> {
  const { data, error } = await db
    .from('channels')
    .select('id, name, type, category')
    .eq('operator_id', operatorId)
    .or(
      [
        'type.ilike.website',
        'type.ilike.%direct%',
        'name.ilike.%homepage%',
        'name.ilike.%홈페이지%',
        'name.ilike.%direct web%',
        'id.eq.M00001',
      ].join(',')
    )
    .order('created_at', { ascending: true })
    .limit(20)

  if (error) {
    console.warn('[resolvePublicDirectChannel] lookup failed', error.message)
    return null
  }

  const rows = data || []
  if (rows.length === 0) return null

  // Prefer explicit Homepage / Website / Own
  const scored = rows
    .map((row) => {
      const name = String(row.name || '').toLowerCase()
      const type = String(row.type || '').toLowerCase()
      const category = String(row.category || '').toLowerCase()
      let score = 0
      if (row.id === KOVEgAS_DIRECT_CHANNEL_ID) score += 100
      if (name.includes('homepage') || name.includes('홈페이지')) score += 50
      if (type === 'website' || type.includes('direct')) score += 30
      if (category === 'own' || category === 'self') score += 10
      return { id: row.id, score }
    })
    .sort((a, b) => b.score - a.score)

  return scored[0]?.id || null
}

/**
 * Resolve Direct channel for operator. Ensures a channel row for non-Kovegas.
 * Requires a privileged client (service role) for ensure/insert.
 */
export async function resolvePublicDirectChannel(
  db: Db,
  operatorIdRaw?: string | null,
  opts?: { ensure?: boolean }
): Promise<PublicDirectChannelResolution> {
  const operatorId = resolveOperatorId(operatorIdRaw)
  const ensure = opts?.ensure !== false

  if (operatorId === KOVEgAS_OPERATOR_ID) {
    return {
      operatorId,
      channelId: KOVEgAS_DIRECT_CHANNEL_ID,
      created: false,
      source: 'kovegas_m00001',
    }
  }

  const existing = await findExistingDirectChannel(db, operatorId)
  if (existing) {
    return {
      operatorId,
      channelId: existing,
      created: false,
      source: 'existing',
    }
  }

  if (!ensure) {
    throw new Error(
      'Direct Web channel is not configured for this operator. Create a Homepage/Website channel in admin.'
    )
  }

  const { data: opRow, error: opErr } = await db
    .from('operators')
    .select('id, slug, name')
    .eq('id', operatorId)
    .maybeSingle()

  if (opErr || !opRow) {
    throw new Error('Operator not found for Direct channel ensure')
  }

  const channelId = directChannelIdForSlug(String(opRow.slug || 'op'))
  const { error: insertErr } = await db.from('channels').insert({
    id: channelId,
    name: 'Homepage',
    type: 'Website',
    category: 'Own',
    status: 'active',
    operator_id: operatorId,
    pricing_type: 'separate',
    description: `Auto-created Direct Web channel for ${opRow.name || opRow.slug}`,
  })

  if (insertErr) {
    // Race: another request created it
    const again = await findExistingDirectChannel(db, operatorId)
    if (again) {
      return {
        operatorId,
        channelId: again,
        created: false,
        source: 'existing',
      }
    }
    throw new Error(`Failed to ensure Direct channel: ${insertErr.message}`)
  }

  console.info('[resolvePublicDirectChannel] ensured', { operatorId, channelId })
  return {
    operatorId,
    channelId,
    created: true,
    source: 'ensured',
  }
}
