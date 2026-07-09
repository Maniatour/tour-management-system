import { supabase } from '@/lib/supabase'
import type { CustomerPageZone } from '@/lib/customerPageZones'
import type { BasicFieldKey } from '@/lib/customerPageZoneEditMap'
import type { DetailBindingKey } from '@/lib/customerPageFieldBindings'

export const CUSTOMER_PAGE_BINDINGS_NAMESPACE = 'customer_page_bindings'
export const CUSTOMER_PAGE_BINDINGS_LOCALE = 'config'

export type ZoneBindingsPayload = {
  basic?: Record<string, BasicFieldKey>
  detail?: Record<string, DetailBindingKey>
}

const memoryCache: Record<string, ZoneBindingsPayload> = {}

export function getCustomerPageBindingsCache(): Readonly<Record<string, ZoneBindingsPayload>> {
  return memoryCache
}

export function setCustomerPageBindingsCache(
  zone: CustomerPageZone,
  payload: ZoneBindingsPayload
): void {
  memoryCache[zone] = {
    ...memoryCache[zone],
    ...payload,
  }
}

export async function fetchAllCustomerPageBindings(): Promise<Record<string, ZoneBindingsPayload>> {
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
    .eq('namespace', CUSTOMER_PAGE_BINDINGS_NAMESPACE)

  if (error) throw error

  const out: Record<string, ZoneBindingsPayload> = {}

  for (const row of data ?? []) {
    const keyPath = row.key_path as string
    const values = (row.translation_values ?? []) as Array<{ locale: string; value: unknown }>
    const raw = values.find((v) => v.locale === CUSTOMER_PAGE_BINDINGS_LOCALE)?.value
    if (typeof raw !== 'string' || !raw.trim()) continue
    try {
      out[keyPath] = JSON.parse(raw) as ZoneBindingsPayload
    } catch {
      // ignore corrupt rows
    }
  }

  for (const [zone, payload] of Object.entries(out)) {
    memoryCache[zone] = payload
  }

  return out
}

async function upsertBindingJson(zone: CustomerPageZone, payload: ZoneBindingsPayload): Promise<void> {
  const { data: existingTrans, error: findError } = await supabase
    .from('translations')
    .select('id')
    .eq('namespace', CUSTOMER_PAGE_BINDINGS_NAMESPACE)
    .eq('key_path', zone)
    .maybeSingle()

  if (findError) throw findError

  let translationId = existingTrans?.id as string | undefined

  if (!translationId) {
    const { data: inserted, error: insertTransError } = await supabase
      .from('translations')
      .insert({
        id: crypto.randomUUID(),
        namespace: CUSTOMER_PAGE_BINDINGS_NAMESPACE,
        key_path: zone,
        is_system: true,
      })
      .select('id')
      .single()

    if (insertTransError) throw insertTransError
    translationId = inserted.id as string
  }

  const json = JSON.stringify(payload)

  const { data: existingValue, error: valueFindError } = await supabase
    .from('translation_values')
    .select('id')
    .eq('translation_id', translationId)
    .eq('locale', CUSTOMER_PAGE_BINDINGS_LOCALE)
    .maybeSingle()

  if (valueFindError) throw valueFindError

  if (existingValue?.id) {
    const { error: updateError } = await supabase
      .from('translation_values')
      .update({
        value: json,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingValue.id)
    if (updateError) throw updateError
    return
  }

  const { error: insertValueError } = await supabase.from('translation_values').insert({
    id: crypto.randomUUID(),
    translation_id: translationId,
    locale: CUSTOMER_PAGE_BINDINGS_LOCALE,
    value: json,
  })
  if (insertValueError) throw insertValueError
}

export async function persistCustomerPageZoneBindings(
  zone: CustomerPageZone,
  patch: ZoneBindingsPayload
): Promise<void> {
  const merged: ZoneBindingsPayload = {
    ...memoryCache[zone],
    ...patch,
  }
  if (patch.basic) merged.basic = { ...memoryCache[zone]?.basic, ...patch.basic }
  if (patch.detail) merged.detail = { ...memoryCache[zone]?.detail, ...patch.detail }

  memoryCache[zone] = merged
  await upsertBindingJson(zone, merged)
}
