import { supabase } from '@/lib/supabase'
import {
  DEFAULT_CUSTOMER_PAGE_TEMPLATE_ID,
  getActiveCustomerPageTemplateId,
  getCustomerPageTemplateById,
  normalizeCustomerPageTemplateId,
  setActiveCustomerPageTemplateId,
} from '@/lib/customerPageTemplate'
import { normalizeHomePageLayout } from '@/lib/customerPageHomeLayout'
import { applyTemplateStructureToSections } from '@/lib/customerPageHomeSectionCatalog'
import { persistCustomerPageHomeLayout } from '@/lib/customerPageLayoutPersistence'
import { persistCustomerPageHomeStructure } from '@/lib/customerPageHomeStructurePersistence'
import { upsertGlobalThemeJsonOnly } from '@/lib/customerPageGlobalThemePersistence'
import { clearAllCustomerPageZoneUiStyles } from '@/lib/customerPageUiStylePersistence'
import { setActiveGlobalThemeId } from '@/lib/customerPageGlobalTheme'

export const CUSTOMER_PAGE_TEMPLATE_NAMESPACE = 'customer_page_template'
export const CUSTOMER_PAGE_TEMPLATE_LOCALE = 'config'
export const CUSTOMER_PAGE_TEMPLATE_KEY = 'active'

export type CustomerPageTemplateConfig = {
  templateId: string | null
}

export function loadCustomerPageTemplateId(): string | null {
  return getActiveCustomerPageTemplateId()
}

export async function fetchCustomerPageTemplate(): Promise<string | null> {
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
    .eq('namespace', CUSTOMER_PAGE_TEMPLATE_NAMESPACE)
    .eq('key_path', CUSTOMER_PAGE_TEMPLATE_KEY)
    .maybeSingle()

  if (error) throw error

  const values = (data?.translation_values ?? []) as Array<{ locale: string; value: unknown }>
  const raw = values.find((value) => value.locale === CUSTOMER_PAGE_TEMPLATE_LOCALE)?.value

  if (typeof raw !== 'string' || !raw.trim()) {
    setActiveCustomerPageTemplateId(DEFAULT_CUSTOMER_PAGE_TEMPLATE_ID)
    return DEFAULT_CUSTOMER_PAGE_TEMPLATE_ID
  }

  try {
    const parsed = JSON.parse(raw) as CustomerPageTemplateConfig
    if (!parsed.templateId) {
      setActiveCustomerPageTemplateId(null)
      return null
    }
    const templateId = normalizeCustomerPageTemplateId(parsed.templateId)
    setActiveCustomerPageTemplateId(templateId)
    return templateId
  } catch {
    setActiveCustomerPageTemplateId(DEFAULT_CUSTOMER_PAGE_TEMPLATE_ID)
    return DEFAULT_CUSTOMER_PAGE_TEMPLATE_ID
  }
}

async function upsertTemplateJson(templateId: string | null): Promise<void> {
  const { data: existingTrans, error: findError } = await supabase
    .from('translations')
    .select('id')
    .eq('namespace', CUSTOMER_PAGE_TEMPLATE_NAMESPACE)
    .eq('key_path', CUSTOMER_PAGE_TEMPLATE_KEY)
    .maybeSingle()

  if (findError) throw findError

  let translationId = existingTrans?.id as string | undefined

  if (!translationId) {
    const { data: inserted, error: insertTransError } = await supabase
      .from('translations')
      .insert({
        id: crypto.randomUUID(),
        namespace: CUSTOMER_PAGE_TEMPLATE_NAMESPACE,
        key_path: CUSTOMER_PAGE_TEMPLATE_KEY,
        is_system: true,
      })
      .select('id')
      .single()

    if (insertTransError) throw insertTransError
    translationId = inserted.id as string
  }

  const json = JSON.stringify({ templateId } satisfies CustomerPageTemplateConfig)

  const { data: existingValue, error: valueFindError } = await supabase
    .from('translation_values')
    .select('id')
    .eq('translation_id', translationId)
    .eq('locale', CUSTOMER_PAGE_TEMPLATE_LOCALE)
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
    locale: CUSTOMER_PAGE_TEMPLATE_LOCALE,
    value: json,
  })
  if (insertValueError) throw insertValueError
}

export async function clearCustomerPageTemplateTracking(): Promise<void> {
  setActiveCustomerPageTemplateId(null)
  await upsertTemplateJson(null)
}

/** 템플릿 적용 — 테마 + 홈 섹션 구성 + UI 커스텀 초기화 */
export async function persistCustomerPageTemplate(templateId: string): Promise<void> {
  const template = getCustomerPageTemplateById(templateId)
  const normalizedId = normalizeCustomerPageTemplateId(template.id)

  setActiveGlobalThemeId(template.themeId)
  await upsertGlobalThemeJsonOnly(template.themeId)
  await clearAllCustomerPageZoneUiStyles()
  const normalizedLayout = normalizeHomePageLayout(template.homeLayout)
  const layoutWithStructure = {
    sections: applyTemplateStructureToSections(normalizedLayout.sections, template.structure),
  }
  await persistCustomerPageHomeLayout(layoutWithStructure)
  await persistCustomerPageHomeStructure(template.structure)

  setActiveCustomerPageTemplateId(normalizedId)
  await upsertTemplateJson(normalizedId)
}
