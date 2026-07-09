import { supabase } from '@/lib/supabase'
import {
  DEFAULT_HOME_PAGE_LAYOUT,
  normalizeHomePageLayout,
  type HomePageLayout,
} from '@/lib/customerPageHomeLayout'

export const CUSTOMER_PAGE_LAYOUTS_NAMESPACE = 'customer_page_layouts'
export const CUSTOMER_PAGE_LAYOUTS_LOCALE = 'config'
export const HOME_PAGE_LAYOUT_KEY = 'home'

let homeLayoutCache: HomePageLayout = {
  sections: DEFAULT_HOME_PAGE_LAYOUT.sections.map((section) => ({ ...section })),
}

export function getCustomerPageHomeLayoutCache(): HomePageLayout {
  return homeLayoutCache
}

export function setCustomerPageHomeLayoutCache(layout: HomePageLayout): void {
  homeLayoutCache = normalizeHomePageLayout(layout)
}

export function loadCustomerPageHomeLayout(): HomePageLayout {
  return homeLayoutCache
}

export async function fetchCustomerPageHomeLayout(): Promise<HomePageLayout> {
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
    .eq('namespace', CUSTOMER_PAGE_LAYOUTS_NAMESPACE)
    .eq('key_path', HOME_PAGE_LAYOUT_KEY)
    .maybeSingle()

  if (error) throw error

  const values = (data?.translation_values ?? []) as Array<{ locale: string; value: unknown }>
  const raw = values.find((value) => value.locale === CUSTOMER_PAGE_LAYOUTS_LOCALE)?.value

  if (typeof raw !== 'string' || !raw.trim()) {
    homeLayoutCache = normalizeHomePageLayout(null)
    return homeLayoutCache
  }

  try {
    homeLayoutCache = normalizeHomePageLayout(JSON.parse(raw))
  } catch {
    homeLayoutCache = normalizeHomePageLayout(null)
  }

  return homeLayoutCache
}

async function upsertHomeLayoutJson(layout: HomePageLayout): Promise<void> {
  const { data: existingTrans, error: findError } = await supabase
    .from('translations')
    .select('id')
    .eq('namespace', CUSTOMER_PAGE_LAYOUTS_NAMESPACE)
    .eq('key_path', HOME_PAGE_LAYOUT_KEY)
    .maybeSingle()

  if (findError) throw findError

  let translationId = existingTrans?.id as string | undefined

  if (!translationId) {
    const { data: inserted, error: insertTransError } = await supabase
      .from('translations')
      .insert({
        id: crypto.randomUUID(),
        namespace: CUSTOMER_PAGE_LAYOUTS_NAMESPACE,
        key_path: HOME_PAGE_LAYOUT_KEY,
        is_system: true,
      })
      .select('id')
      .single()

    if (insertTransError) throw insertTransError
    translationId = inserted.id as string
  }

  const json = JSON.stringify(layout)

  const { data: existingValue, error: valueFindError } = await supabase
    .from('translation_values')
    .select('id')
    .eq('translation_id', translationId)
    .eq('locale', CUSTOMER_PAGE_LAYOUTS_LOCALE)
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
    locale: CUSTOMER_PAGE_LAYOUTS_LOCALE,
    value: json,
  })
  if (insertValueError) throw insertValueError
}

export async function persistCustomerPageHomeLayout(layout: HomePageLayout): Promise<void> {
  const normalized = normalizeHomePageLayout(layout)
  homeLayoutCache = normalized
  await upsertHomeLayoutJson(normalized)
}
