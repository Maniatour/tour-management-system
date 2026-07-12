import { supabase } from '@/lib/supabase'
import {
  DEFAULT_CUSTOMER_PAGE_HOME_CONTENT,
  normalizeCustomerPageHomeContent,
  type CustomerPageHomeContent,
} from '@/lib/customerPageHomeContent'

export const CUSTOMER_PAGE_HOME_CONTENT_NAMESPACE = 'customer_page_home_content'
export const CUSTOMER_PAGE_HOME_CONTENT_LOCALE = 'config'
export const CUSTOMER_PAGE_HOME_CONTENT_KEY = 'active'

let homeContentCache: CustomerPageHomeContent = {
  ...DEFAULT_CUSTOMER_PAGE_HOME_CONTENT,
  destinations: [...DEFAULT_CUSTOMER_PAGE_HOME_CONTENT.destinations],
  adventureCategories: [...DEFAULT_CUSTOMER_PAGE_HOME_CONTENT.adventureCategories],
}

export function loadCustomerPageHomeContent(): CustomerPageHomeContent {
  return homeContentCache
}

export function setCustomerPageHomeContentCache(content: CustomerPageHomeContent): void {
  homeContentCache = normalizeCustomerPageHomeContent(content)
}

export async function fetchCustomerPageHomeContent(): Promise<CustomerPageHomeContent> {
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
    .eq('namespace', CUSTOMER_PAGE_HOME_CONTENT_NAMESPACE)
    .eq('key_path', CUSTOMER_PAGE_HOME_CONTENT_KEY)
    .maybeSingle()

  if (error) throw error

  const values = (data?.translation_values ?? []) as Array<{ locale: string; value: unknown }>
  const raw = values.find((value) => value.locale === CUSTOMER_PAGE_HOME_CONTENT_LOCALE)?.value

  if (typeof raw !== 'string' || !raw.trim()) {
    setCustomerPageHomeContentCache(DEFAULT_CUSTOMER_PAGE_HOME_CONTENT)
    return loadCustomerPageHomeContent()
  }

  try {
    const parsed = normalizeCustomerPageHomeContent(JSON.parse(raw))
    setCustomerPageHomeContentCache(parsed)
    return parsed
  } catch {
    setCustomerPageHomeContentCache(DEFAULT_CUSTOMER_PAGE_HOME_CONTENT)
    return loadCustomerPageHomeContent()
  }
}

async function upsertHomeContentJson(content: CustomerPageHomeContent): Promise<void> {
  const { data: existingTrans, error: findError } = await supabase
    .from('translations')
    .select('id')
    .eq('namespace', CUSTOMER_PAGE_HOME_CONTENT_NAMESPACE)
    .eq('key_path', CUSTOMER_PAGE_HOME_CONTENT_KEY)
    .maybeSingle()

  if (findError) throw findError

  let translationId = existingTrans?.id as string | undefined

  if (!translationId) {
    const { data: inserted, error: insertTransError } = await supabase
      .from('translations')
      .insert({
        id: crypto.randomUUID(),
        namespace: CUSTOMER_PAGE_HOME_CONTENT_NAMESPACE,
        key_path: CUSTOMER_PAGE_HOME_CONTENT_KEY,
        is_system: true,
      })
      .select('id')
      .single()

    if (insertTransError) throw insertTransError
    translationId = inserted.id as string
  }

  const json = JSON.stringify(content)

  const { data: existingValue, error: valueFindError } = await supabase
    .from('translation_values')
    .select('id')
    .eq('translation_id', translationId)
    .eq('locale', CUSTOMER_PAGE_HOME_CONTENT_LOCALE)
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
    locale: CUSTOMER_PAGE_HOME_CONTENT_LOCALE,
    value: json,
  })
  if (insertValueError) throw insertValueError
}

export async function persistCustomerPageHomeContent(content: CustomerPageHomeContent): Promise<void> {
  const normalized = normalizeCustomerPageHomeContent(content)
  setCustomerPageHomeContentCache(normalized)
  await upsertHomeContentJson(normalized)
}
