import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { ROUTING_LOCALES, type SiteLocale } from '@/lib/siteLocales'

/** Keep in sync with LOCALE_READINESS_DETAIL_FIELDS (+ basic name/summary). */
const LOCALE_SYNC_DETAIL_FIELDS = [
  'slogan1',
  'slogan2',
  'slogan3',
  'slogan4',
  'slogan5',
  'description',
  'included',
  'not_included',
  'pickup_drop_info',
  'luggage_info',
  'tour_operation_info',
  'preparation_info',
  'small_group_info',
  'notice_info',
  'vehicle_info',
  'cancellation_policy',
] as const

export type LocaleSyncFieldKey =
  | 'customerName'
  | 'summary'
  | (typeof LOCALE_SYNC_DETAIL_FIELDS)[number]

export const LOCALE_SYNC_SOURCE_LOCALES = ['ko', 'en'] as const
export type LocaleSyncSourceLocale = (typeof LOCALE_SYNC_SOURCE_LOCALES)[number]

/** Languages that need follow-up when KO/EN source copy changes. */
export const LOCALE_SYNC_TARGET_LOCALES: readonly SiteLocale[] = ROUTING_LOCALES.filter(
  (code) => code !== 'ko' && code !== 'en'
)

const DETAIL_FIELD_SET = new Set<string>(LOCALE_SYNC_DETAIL_FIELDS)

const BASIC_FIELD_MAP: Record<string, LocaleSyncFieldKey> = {
  customer_name: 'customerName',
  customerName: 'customerName',
  summary: 'summary',
}

export type ProductLocaleSyncTask = {
  id: string
  product_id: string
  field_key: LocaleSyncFieldKey
  source_locale: LocaleSyncSourceLocale
  source_updated_at: string
  source_updated_by: string | null
  pending_locales: SiteLocale[]
  resolved_at: string | null
  created_at: string
}

export function isLocaleSyncSourceLocale(
  value: string | null | undefined
): value is LocaleSyncSourceLocale {
  return value === 'ko' || value === 'en'
}

export function toLocaleSyncFieldKey(
  raw: string | null | undefined
): LocaleSyncFieldKey | null {
  if (!raw) return null
  if (BASIC_FIELD_MAP[raw]) return BASIC_FIELD_MAP[raw]
  if (DETAIL_FIELD_SET.has(raw)) return raw as LocaleSyncFieldKey
  return null
}

function normalizePendingLocales(value: unknown): SiteLocale[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is SiteLocale =>
    LOCALE_SYNC_TARGET_LOCALES.includes(item as SiteLocale)
  )
}

function clientOrDefault(client?: SupabaseClient) {
  return client ?? supabase
}

function normalizeComparableValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/** Extract readiness field keys whose values actually changed in a details patch. */
export function changedLocaleSyncDetailFields(
  previous: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>
): LocaleSyncFieldKey[] {
  const keys: LocaleSyncFieldKey[] = []
  for (const [rawKey, nextValue] of Object.entries(patch)) {
    const fieldKey = toLocaleSyncFieldKey(rawKey)
    if (!fieldKey) continue
    const prevValue = previous?.[rawKey]
    if (normalizeComparableValue(prevValue) === normalizeComparableValue(nextValue)) continue
    keys.push(fieldKey)
  }
  return keys
}

export async function recordLocaleSourceChanges(params: {
  productId: string
  fieldKeys: LocaleSyncFieldKey[]
  sourceLocale: string
  updatedBy?: string | null
  client?: SupabaseClient
}): Promise<void> {
  if (!isLocaleSyncSourceLocale(params.sourceLocale)) return
  const uniqueKeys = [...new Set(params.fieldKeys.filter(Boolean))]
  if (uniqueKeys.length === 0) return

  const now = new Date().toISOString()
  const pending = [...LOCALE_SYNC_TARGET_LOCALES]
  const rows = uniqueKeys.map((fieldKey) => ({
    product_id: params.productId,
    field_key: fieldKey,
    source_locale: params.sourceLocale,
    source_updated_at: now,
    source_updated_by: params.updatedBy?.trim() || null,
    pending_locales: pending,
    resolved_at: null,
  }))

  const { error } = await fromUntypedTable(
    clientOrDefault(params.client),
    'product_locale_sync_tasks'
  ).upsert(rows, { onConflict: 'product_id,field_key,source_locale' })

  if (error) {
    console.warn('[productLocaleSyncTasks] record failed:', error.message)
  }
}

export async function markLocaleTargetSynced(params: {
  productId: string
  fieldKeys: LocaleSyncFieldKey[]
  targetLocale: string
  client?: SupabaseClient
}): Promise<void> {
  if (!LOCALE_SYNC_TARGET_LOCALES.includes(params.targetLocale as SiteLocale)) return
  const uniqueKeys = [...new Set(params.fieldKeys.filter(Boolean))]
  if (uniqueKeys.length === 0) return

  const db = fromUntypedTable(clientOrDefault(params.client), 'product_locale_sync_tasks')
  const { data, error } = await db
    .select('id, field_key, pending_locales')
    .eq('product_id', params.productId)
    .in('field_key', uniqueKeys)
    .is('resolved_at', null)

  if (error) {
    console.warn('[productLocaleSyncTasks] load for sync clear failed:', error.message)
    return
  }

  const now = new Date().toISOString()
  for (const row of (data || []) as Array<{
    id: string
    pending_locales: unknown
  }>) {
    const pending = normalizePendingLocales(row.pending_locales).filter(
      (code) => code !== params.targetLocale
    )
    const { error: updateError } = await db
      .update({
        pending_locales: pending,
        resolved_at: pending.length === 0 ? now : null,
      })
      .eq('id', row.id)

    if (updateError) {
      console.warn('[productLocaleSyncTasks] clear pending failed:', updateError.message)
    }
  }
}

export async function resolveLocaleSyncTask(params: {
  taskId: string
  client?: SupabaseClient
}): Promise<boolean> {
  const { error } = await fromUntypedTable(
    clientOrDefault(params.client),
    'product_locale_sync_tasks'
  )
    .update({
      pending_locales: [],
      resolved_at: new Date().toISOString(),
    })
    .eq('id', params.taskId)

  if (error) {
    console.warn('[productLocaleSyncTasks] resolve failed:', error.message)
    return false
  }
  return true
}

export async function clearLocaleFromSyncTask(params: {
  taskId: string
  locale: SiteLocale
  client?: SupabaseClient
}): Promise<boolean> {
  const db = fromUntypedTable(clientOrDefault(params.client), 'product_locale_sync_tasks')
  const { data, error } = await db
    .select('id, pending_locales')
    .eq('id', params.taskId)
    .maybeSingle()

  if (error || !data) {
    console.warn('[productLocaleSyncTasks] clear locale load failed:', error?.message)
    return false
  }

  const pending = normalizePendingLocales(
    (data as { pending_locales?: unknown }).pending_locales
  ).filter((code) => code !== params.locale)

  const { error: updateError } = await db
    .update({
      pending_locales: pending,
      resolved_at: pending.length === 0 ? new Date().toISOString() : null,
    })
    .eq('id', params.taskId)

  if (updateError) {
    console.warn('[productLocaleSyncTasks] clear locale failed:', updateError.message)
    return false
  }
  return true
}

export async function fetchOpenLocaleSyncTasks(params: {
  productIds?: string[]
  client?: SupabaseClient
}): Promise<ProductLocaleSyncTask[]> {
  let query = fromUntypedTable(clientOrDefault(params.client), 'product_locale_sync_tasks')
    .select(
      'id, product_id, field_key, source_locale, source_updated_at, source_updated_by, pending_locales, resolved_at, created_at'
    )
    .is('resolved_at', null)
    .order('source_updated_at', { ascending: false })

  if (params.productIds && params.productIds.length > 0) {
    query = query.in('product_id', params.productIds)
  }

  const { data, error } = await query
  if (error) {
    // Table may not exist yet before migration.
    console.warn('[productLocaleSyncTasks] fetch failed:', error.message)
    return []
  }

  return ((data || []) as Array<Record<string, unknown>>)
    .map((row) => {
      const fieldKey = toLocaleSyncFieldKey(String(row.field_key ?? ''))
      const sourceLocale = String(row.source_locale ?? '')
      if (!fieldKey || !isLocaleSyncSourceLocale(sourceLocale)) return null
      const pending = normalizePendingLocales(row.pending_locales)
      if (pending.length === 0) return null
      return {
        id: String(row.id),
        product_id: String(row.product_id),
        field_key: fieldKey,
        source_locale: sourceLocale,
        source_updated_at: String(row.source_updated_at ?? ''),
        source_updated_by:
          typeof row.source_updated_by === 'string' ? row.source_updated_by : null,
        pending_locales: pending,
        resolved_at: typeof row.resolved_at === 'string' ? row.resolved_at : null,
        created_at: String(row.created_at ?? ''),
      } satisfies ProductLocaleSyncTask
    })
    .filter((row): row is ProductLocaleSyncTask => row != null)
}

export async function syncLocaleTasksAfterDetailsWrite(params: {
  productId: string
  languageCode: string
  fieldKeys: LocaleSyncFieldKey[]
  updatedBy?: string | null
  client?: SupabaseClient
}): Promise<void> {
  if (params.fieldKeys.length === 0) return
  if (isLocaleSyncSourceLocale(params.languageCode)) {
    await recordLocaleSourceChanges({
      productId: params.productId,
      fieldKeys: params.fieldKeys,
      sourceLocale: params.languageCode,
      ...(params.updatedBy !== undefined ? { updatedBy: params.updatedBy } : {}),
      ...(params.client !== undefined ? { client: params.client } : {}),
    })
    return
  }
  await markLocaleTargetSynced({
    productId: params.productId,
    fieldKeys: params.fieldKeys,
    targetLocale: params.languageCode,
    ...(params.client !== undefined ? { client: params.client } : {}),
  })
}
