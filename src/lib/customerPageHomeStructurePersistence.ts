import { supabase } from '@/lib/supabase'
import {
  DEFAULT_HOME_PAGE_STRUCTURE,
  getActiveHomePageStructure,
  normalizeHomePageStructure,
  setActiveHomePageStructure,
  type HomePageStructure,
} from '@/lib/customerPageHomeStructure'

export const CUSTOMER_PAGE_HOME_STRUCTURE_NAMESPACE = 'customer_page_home_structure'
export const CUSTOMER_PAGE_HOME_STRUCTURE_LOCALE = 'config'
export const CUSTOMER_PAGE_HOME_STRUCTURE_KEY = 'active'

export function loadCustomerPageHomeStructure(): HomePageStructure {
  return { ...getActiveHomePageStructure() }
}

export async function fetchCustomerPageHomeStructure(): Promise<HomePageStructure> {
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
    .eq('namespace', CUSTOMER_PAGE_HOME_STRUCTURE_NAMESPACE)
    .eq('key_path', CUSTOMER_PAGE_HOME_STRUCTURE_KEY)
    .maybeSingle()

  if (error) throw error

  const values = (data?.translation_values ?? []) as Array<{ locale: string; value: unknown }>
  const raw = values.find((value) => value.locale === CUSTOMER_PAGE_HOME_STRUCTURE_LOCALE)?.value

  let structure = DEFAULT_HOME_PAGE_STRUCTURE
  if (typeof raw === 'string' && raw.trim()) {
    try {
      structure = normalizeHomePageStructure(JSON.parse(raw))
    } catch {
      structure = DEFAULT_HOME_PAGE_STRUCTURE
    }
  }

  setActiveHomePageStructure(structure)
  return structure
}

async function upsertHomeStructureJson(structure: HomePageStructure): Promise<void> {
  const { data: existingTrans, error: findError } = await supabase
    .from('translations')
    .select('id')
    .eq('namespace', CUSTOMER_PAGE_HOME_STRUCTURE_NAMESPACE)
    .eq('key_path', CUSTOMER_PAGE_HOME_STRUCTURE_KEY)
    .maybeSingle()

  if (findError) throw findError

  let translationId = existingTrans?.id as string | undefined

  if (!translationId) {
    const { data: inserted, error: insertTransError } = await supabase
      .from('translations')
      .insert({
        id: crypto.randomUUID(),
        namespace: CUSTOMER_PAGE_HOME_STRUCTURE_NAMESPACE,
        key_path: CUSTOMER_PAGE_HOME_STRUCTURE_KEY,
        is_system: true,
      })
      .select('id')
      .single()

    if (insertTransError) throw insertTransError
    translationId = inserted.id as string
  }

  const json = JSON.stringify(structure)

  const { data: existingValue, error: valueFindError } = await supabase
    .from('translation_values')
    .select('id')
    .eq('translation_id', translationId)
    .eq('locale', CUSTOMER_PAGE_HOME_STRUCTURE_LOCALE)
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
    locale: CUSTOMER_PAGE_HOME_STRUCTURE_LOCALE,
    value: json,
  })
  if (insertValueError) throw insertValueError
}

export async function persistCustomerPageHomeStructure(structure: HomePageStructure): Promise<void> {
  const normalized = normalizeHomePageStructure(structure)
  setActiveHomePageStructure(normalized)
  await upsertHomeStructureJson(normalized)
}
