import { supabase } from '@/lib/supabase'
import type { CustomerPageZone } from '@/lib/customerPageZones'
import type { ZoneUiStylePatch } from '@/lib/customerPageZoneUiStyle'
export const CUSTOMER_PAGE_UI_STYLES_NAMESPACE = 'customer_page_ui_styles'
export const CUSTOMER_PAGE_UI_STYLES_LOCALE = 'config'

const memoryCache: Record<string, ZoneUiStylePatch> = {}

export function getCustomerPageUiStylesCache(): Readonly<Record<string, ZoneUiStylePatch>> {
  return memoryCache
}

export function setCustomerPageUiStyleCache(
  zone: CustomerPageZone,
  patch: ZoneUiStylePatch
): void {
  memoryCache[zone] = patch
}

export async function fetchAllCustomerPageUiStyles(): Promise<Record<string, ZoneUiStylePatch>> {
  const { data, error } = await supabase
    .from('translations')
    .select(
      `
      key_path,
      translation_values (
        locale,
        value
      )
    `
    )
    .eq('namespace', CUSTOMER_PAGE_UI_STYLES_NAMESPACE)

  if (error) throw error

  const out: Record<string, ZoneUiStylePatch> = {}

  for (const row of data ?? []) {
    const keyPath = row.key_path as string
    const values = (row.translation_values ?? []) as Array<{ locale: string; value: unknown }>
    const raw = values.find((v) => v.locale === CUSTOMER_PAGE_UI_STYLES_LOCALE)?.value
    if (typeof raw !== 'string' || !raw.trim()) continue
    try {
      out[keyPath] = JSON.parse(raw) as ZoneUiStylePatch
      memoryCache[keyPath] = out[keyPath]
    } catch {
      // ignore
    }
  }

  return out
}

async function upsertUiStyleJson(zone: CustomerPageZone, patch: ZoneUiStylePatch): Promise<void> {
  const { data: existingTrans, error: findError } = await supabase
    .from('translations')
    .select('id')
    .eq('namespace', CUSTOMER_PAGE_UI_STYLES_NAMESPACE)
    .eq('key_path', zone)
    .maybeSingle()

  if (findError) throw findError

  let translationId = existingTrans?.id as string | undefined

  if (!translationId) {
    const { data: inserted, error: insertTransError } = await supabase
      .from('translations')
      .insert({
        id: crypto.randomUUID(),
        namespace: CUSTOMER_PAGE_UI_STYLES_NAMESPACE,
        key_path: zone,
        is_system: true,
      })
      .select('id')
      .single()

    if (insertTransError) throw insertTransError
    translationId = inserted.id as string
  }

  const json = JSON.stringify(patch)

  const { data: existingValue, error: valueFindError } = await supabase
    .from('translation_values')
    .select('id')
    .eq('translation_id', translationId)
    .eq('locale', CUSTOMER_PAGE_UI_STYLES_LOCALE)
    .maybeSingle()

  if (valueFindError) throw valueFindError

  if (existingValue?.id) {
    const { error: updateError } = await supabase
      .from('translation_values')
      .update({ value: json, updated_at: new Date().toISOString() })
      .eq('id', existingValue.id)
    if (updateError) throw updateError
    return
  }

  const { error: insertValueError } = await supabase.from('translation_values').insert({
    id: crypto.randomUUID(),
    translation_id: translationId,
    locale: CUSTOMER_PAGE_UI_STYLES_LOCALE,
    value: json,
  })
  if (insertValueError) throw insertValueError
}

export async function persistCustomerPageZoneUiStyle(
  zone: CustomerPageZone,
  patch: ZoneUiStylePatch
): Promise<void> {
  memoryCache[zone] = patch
  await upsertUiStyleJson(zone, patch)
}

export function loadZoneUiStylePatch(zone: CustomerPageZone): ZoneUiStylePatch {
  return memoryCache[zone] ?? {}
}

export function clearCustomerPageUiStylesMemoryCache(): void {
  for (const key of Object.keys(memoryCache)) {
    delete memoryCache[key]
  }
}

/** 전체 테마 변경 시 영역별 UI 커스텀 제거 */
export async function clearAllCustomerPageZoneUiStyles(): Promise<void> {
  clearCustomerPageUiStylesMemoryCache()

  const { data, error } = await supabase
    .from('translations')
    .select('id')
    .eq('namespace', CUSTOMER_PAGE_UI_STYLES_NAMESPACE)

  if (error) throw error

  const translationIds = (data ?? []).map((row) => row.id as string)
  if (translationIds.length === 0) return

  const { error: deleteValuesError } = await supabase
    .from('translation_values')
    .delete()
    .in('translation_id', translationIds)

  if (deleteValuesError) throw deleteValuesError

  const { error: deleteTranslationsError } = await supabase
    .from('translations')
    .delete()
    .eq('namespace', CUSTOMER_PAGE_UI_STYLES_NAMESPACE)

  if (deleteTranslationsError) throw deleteTranslationsError
}
