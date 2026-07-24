import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeSiteLocale } from '@/lib/siteLocales'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'

export const DEFAULT_PRODUCT_DETAILS_VARIANT_KEY = 'default'

type SupabaseErrorShape = {
  message?: string
  details?: string
  hint?: string
  code?: string
}

export function formatSupabaseError(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error)
  const e = error as SupabaseErrorShape
  return [e.message, e.details, e.hint, e.code].filter(Boolean).join(' · ')
}

function isEmptyDetailsField(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === 'string') {
    return value.replace(/<[^>]*>/g, '').trim() === ''
  }
  return false
}

/**
 * Merge channel-specific rows for one locale (shared null-channel row first, then fill empty
 * fields from channel rows). Matches customer-page field merge within a locale.
 */
export function mergeSameLocaleDetailRows(
  rows: Array<Record<string, unknown>>
): Record<string, unknown> | null {
  if (rows.length === 0) return null

  const sorted = [...rows].sort((a, b) => {
    const aShared = a.channel_id == null ? 0 : 1
    const bShared = b.channel_id == null ? 0 : 1
    if (aShared !== bShared) return aShared - bShared
    return String(a.channel_id ?? '').localeCompare(String(b.channel_id ?? ''))
  })

  const merged: Record<string, unknown> = { ...sorted[0] }
  const keys = new Set<string>()
  for (const row of sorted) {
    Object.keys(row).forEach((key) => keys.add(key))
  }

  for (const key of keys) {
    if (key === 'id' || key === 'language_code' || key === 'product_id') continue
    for (const row of sorted) {
      if (!isEmptyDetailsField(row[key])) {
        merged[key] = row[key]
        break
      }
    }
  }

  const sharedRow = sorted.find((row) => row.channel_id == null)
  if (sharedRow?.id) merged.id = sharedRow.id

  return merged
}

/**
 * Admin/customer-page edits target the shared default row (no channel, default variant).
 * Falls back to channel-specific rows when no shared row exists — matches customer page load.
 */
export async function fetchDefaultProductDetailsRowForAdmin(
  client: SupabaseClient,
  productId: string,
  locale: string
): Promise<Record<string, unknown> | null> {
  const languageCode = normalizeSiteLocale(locale)

  const queryForLocale = () =>
    fromUntypedTable(client, 'product_details_multilingual')
      .select('*')
      .eq('product_id', productId)
      .eq('language_code', languageCode)

  const { data: defaultVariantRows, error: defaultVariantError } = await queryForLocale().eq(
    'variant_key',
    DEFAULT_PRODUCT_DETAILS_VARIANT_KEY
  )

  if (defaultVariantError) throw defaultVariantError
  const mergedDefault = mergeSameLocaleDetailRows(
    (defaultVariantRows ?? []) as Array<Record<string, unknown>>
  )
  if (mergedDefault) return mergedDefault

  const { data: sharedRows, error: sharedError } = await queryForLocale()
    .is('channel_id', null)
    .limit(1)

  if (sharedError) throw sharedError
  if (sharedRows?.[0]) return sharedRows[0] as Record<string, unknown>

  const { data: anyRows, error: anyError } = await queryForLocale().limit(1)
  if (anyError) throw anyError
  return (anyRows?.[0] as Record<string, unknown> | undefined) ?? null
}

export function parseCustomerPageVisibilityRecord(
  raw: unknown
): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  return {}
}

/** Merge visibility keys onto the default admin row for the locale. */
export async function fetchDefaultProductDetailsCustomerPageVisibility(
  client: SupabaseClient,
  productId: string,
  locale: string,
  existingRowId?: string | null
): Promise<Record<string, unknown>> {
  if (existingRowId) {
    const { data, error } = await fromUntypedTable(client, 'product_details_multilingual')
      .select('customer_page_visibility')
      .eq('id', existingRowId)
      .maybeSingle()

    if (error && (error as SupabaseErrorShape).code !== 'PGRST116') {
      throw error
    }

    const visibility = parseCustomerPageVisibilityRecord(
      (data as { customer_page_visibility?: unknown } | null)?.customer_page_visibility
    )
    if (Object.keys(visibility).length > 0) return visibility
  }

  const defaultRow = await fetchDefaultProductDetailsRowForAdmin(client, productId, locale)
  return parseCustomerPageVisibilityRecord(defaultRow?.customer_page_visibility)
}

type UpsertDefaultProductDetailsParams = {
  productId: string
  languageCode: string
  patch: Record<string, unknown>
  /** Cached row id from the last load — revalidated before write. */
  existingRowId?: string | null
}

/**
 * Insert or update the default product_details_multilingual row for admin edits.
 * Handles duplicate-key races (23505) by falling back to update.
 */
export async function upsertDefaultProductDetailsMultilingual(
  client: SupabaseClient,
  params: UpsertDefaultProductDetailsParams
): Promise<{ id: string }> {
  const languageCode = normalizeSiteLocale(params.languageCode)
  const baseKeys = {
    product_id: params.productId,
    language_code: languageCode,
    channel_id: null,
    variant_key: DEFAULT_PRODUCT_DETAILS_VARIANT_KEY,
  }

  const patchWithTimestamp = {
    ...params.patch,
    updated_at: new Date().toISOString(),
  }

  const findExistingRowId = async (): Promise<string | null> => {
    const { data, error } = await fromUntypedTable(client, 'product_details_multilingual')
      .select('id')
      .eq('product_id', params.productId)
      .eq('language_code', languageCode)
      .is('channel_id', null)
      .eq('variant_key', DEFAULT_PRODUCT_DETAILS_VARIANT_KEY)
      .maybeSingle()

    if (error && (error as SupabaseErrorShape).code !== 'PGRST116') {
      throw error
    }

    return data?.id ? String(data.id) : null
  }

  const updateById = async (rowId: string) => {
    const { error } = await fromUntypedTable(client, 'product_details_multilingual')
      .update(patchWithTimestamp)
      .eq('id', rowId)

    if (error) throw error
    return rowId
  }

  let rowId = params.existingRowId?.trim() || null

  if (rowId) {
    const verifiedId = await findExistingRowId()
    if (verifiedId && verifiedId !== rowId) {
      rowId = verifiedId
    }
    if (rowId) {
      return { id: await updateById(rowId) }
    }
  }

  rowId = await findExistingRowId()
  if (rowId) {
    return { id: await updateById(rowId) }
  }

  const { data, error } = await fromUntypedTable(client, 'product_details_multilingual')
    .insert([{ ...baseKeys, ...patchWithTimestamp }])
    .select('id')
    .single()

  if (!error && data?.id) {
    return { id: String(data.id) }
  }

  if (error && (error as SupabaseErrorShape).code === '23505') {
    rowId = await findExistingRowId()
    if (rowId) {
      return { id: await updateById(rowId) }
    }
  }

  throw error
}
