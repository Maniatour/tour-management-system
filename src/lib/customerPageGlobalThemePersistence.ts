import { supabase } from '@/lib/supabase'
import {
  DEFAULT_GLOBAL_THEME_ID,
  getActiveGlobalThemeId,
  normalizeGlobalThemeId,
  setActiveGlobalThemeId,
} from '@/lib/customerPageGlobalTheme'
import { clearAllCustomerPageZoneUiStyles } from '@/lib/customerPageUiStylePersistence'
import { clearCustomerPageTemplateTracking } from '@/lib/customerPageTemplatePersistence'

export const CUSTOMER_PAGE_GLOBAL_THEME_NAMESPACE = 'customer_page_global_theme'
export const CUSTOMER_PAGE_GLOBAL_THEME_LOCALE = 'config'
export const CUSTOMER_PAGE_GLOBAL_THEME_KEY = 'active'

export type CustomerPageGlobalThemeConfig = {
  themeId: string
}

export function loadCustomerPageGlobalThemeId(): string {
  return getActiveGlobalThemeId()
}

export async function fetchCustomerPageGlobalTheme(): Promise<string> {
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
    .eq('namespace', CUSTOMER_PAGE_GLOBAL_THEME_NAMESPACE)
    .eq('key_path', CUSTOMER_PAGE_GLOBAL_THEME_KEY)
    .maybeSingle()

  if (error) throw error

  const values = (data?.translation_values ?? []) as Array<{ locale: string; value: unknown }>
  const raw = values.find((value) => value.locale === CUSTOMER_PAGE_GLOBAL_THEME_LOCALE)?.value

  if (typeof raw !== 'string' || !raw.trim()) {
    setActiveGlobalThemeId(DEFAULT_GLOBAL_THEME_ID)
    return DEFAULT_GLOBAL_THEME_ID
  }

  try {
    const parsed = JSON.parse(raw) as CustomerPageGlobalThemeConfig
    const themeId = normalizeGlobalThemeId(parsed.themeId)
    setActiveGlobalThemeId(themeId)
    return themeId
  } catch {
    setActiveGlobalThemeId(DEFAULT_GLOBAL_THEME_ID)
    return DEFAULT_GLOBAL_THEME_ID
  }
}

async function upsertGlobalThemeJson(themeId: string): Promise<void> {
  const { data: existingTrans, error: findError } = await supabase
    .from('translations')
    .select('id')
    .eq('namespace', CUSTOMER_PAGE_GLOBAL_THEME_NAMESPACE)
    .eq('key_path', CUSTOMER_PAGE_GLOBAL_THEME_KEY)
    .maybeSingle()

  if (findError) throw findError

  let translationId = existingTrans?.id as string | undefined

  if (!translationId) {
    const { data: inserted, error: insertTransError } = await supabase
      .from('translations')
      .insert({
        id: crypto.randomUUID(),
        namespace: CUSTOMER_PAGE_GLOBAL_THEME_NAMESPACE,
        key_path: CUSTOMER_PAGE_GLOBAL_THEME_KEY,
        is_system: true,
      })
      .select('id')
      .single()

    if (insertTransError) throw insertTransError
    translationId = inserted.id as string
  }

  const json = JSON.stringify({ themeId } satisfies CustomerPageGlobalThemeConfig)

  const { data: existingValue, error: valueFindError } = await supabase
    .from('translation_values')
    .select('id')
    .eq('translation_id', translationId)
    .eq('locale', CUSTOMER_PAGE_GLOBAL_THEME_LOCALE)
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
    locale: CUSTOMER_PAGE_GLOBAL_THEME_LOCALE,
    value: json,
  })
  if (insertValueError) throw insertValueError
}

export async function upsertGlobalThemeJsonOnly(themeId: string): Promise<void> {
  await upsertGlobalThemeJson(normalizeGlobalThemeId(themeId))
}

/** 전체 테마 저장 — 영역별 UI 커스텀은 초기화되어 테마가 일관 적용됩니다 */
export async function persistCustomerPageGlobalTheme(themeId: string): Promise<void> {
  const normalized = normalizeGlobalThemeId(themeId)
  setActiveGlobalThemeId(normalized)
  await upsertGlobalThemeJson(normalized)
  await clearAllCustomerPageZoneUiStyles()
  await clearCustomerPageTemplateTracking()
}
