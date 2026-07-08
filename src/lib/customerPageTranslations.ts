import { supabase } from '@/lib/supabase'
import koMessages from '@/i18n/locales/ko.json'
import enMessages from '@/i18n/locales/en.json'

export type TranslationFieldDef = {
  key: string
  label: string
  multiline?: boolean
}

export type TranslationLocaleValues = Record<string, string>

export type TranslationFormState = Record<string, TranslationLocaleValues>

const FILE_MESSAGES: Record<string, Record<string, unknown>> = {
  ko: koMessages as Record<string, unknown>,
  en: enMessages as Record<string, unknown>,
}

export const CUSTOMER_PAGE_TRANSLATION_LOCALES = ['ko', 'en'] as const

function readFileDefault(namespace: string, key: string, locale: string): string {
  const root = FILE_MESSAGES[locale]?.[namespace]
  if (!root || typeof root !== 'object' || root === null || Array.isArray(root)) return ''
  const value = (root as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

export function buildEmptyTranslationForm(
  fields: TranslationFieldDef[],
  locales: readonly string[] = CUSTOMER_PAGE_TRANSLATION_LOCALES
): TranslationFormState {
  const form: TranslationFormState = {}
  for (const field of fields) {
    form[field.key] = {}
    for (const locale of locales) {
      form[field.key][locale] = ''
    }
  }
  return form
}

export async function loadCustomerPageTranslations(
  namespace: string,
  fields: TranslationFieldDef[],
  locales: readonly string[] = CUSTOMER_PAGE_TRANSLATION_LOCALES
): Promise<TranslationFormState> {
  const form = buildEmptyTranslationForm(fields, locales)
  const keys = fields.map((f) => f.key)
  if (keys.length === 0) return form

  const { data: translationRows, error } = await supabase
    .from('translations')
    .select(`
      id,
      key_path,
      translation_values (
        locale,
        value
      )
    `)
    .eq('namespace', namespace)
    .in('key_path', keys)

  if (error) throw error

  for (const row of translationRows ?? []) {
    const keyPath = row.key_path as string
    if (!form[keyPath]) continue
    const values = (row.translation_values ?? []) as Array<{ locale: string; value: unknown }>
    for (const locale of locales) {
      const dbValue = values.find((v) => v.locale === locale)?.value
      if (typeof dbValue === 'string' && dbValue.trim() !== '') {
        form[keyPath][locale] = dbValue
      } else {
        form[keyPath][locale] = readFileDefault(namespace, keyPath, locale)
      }
    }
  }

  for (const field of fields) {
    for (const locale of locales) {
      if (!form[field.key][locale]) {
        form[field.key][locale] = readFileDefault(namespace, field.key, locale)
      }
    }
  }

  return form
}

async function upsertTranslationValue(
  namespace: string,
  keyPath: string,
  locale: string,
  value: string
): Promise<void> {
  const trimmed = value.trim()

  const { data: existingTrans, error: findError } = await supabase
    .from('translations')
    .select('id')
    .eq('namespace', namespace)
    .eq('key_path', keyPath)
    .maybeSingle()

  if (findError) throw findError

  let translationId = existingTrans?.id as string | undefined

  if (!translationId) {
    const { data: inserted, error: insertTransError } = await supabase
      .from('translations')
      .insert({
        id: crypto.randomUUID(),
        namespace,
        key_path: keyPath,
        is_system: false,
      })
      .select('id')
      .single()

    if (insertTransError) throw insertTransError
    translationId = inserted.id as string
  }

  const { data: existingValue, error: valueFindError } = await supabase
    .from('translation_values')
    .select('id')
    .eq('translation_id', translationId)
    .eq('locale', locale)
    .maybeSingle()

  if (valueFindError) throw valueFindError

  if (existingValue?.id) {
    const { error: updateError } = await supabase
      .from('translation_values')
      .update({
        value: trimmed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingValue.id)

    if (updateError) throw updateError
    return
  }

  const { error: insertValueError } = await supabase.from('translation_values').insert({
    id: crypto.randomUUID(),
    translation_id: translationId,
    locale,
    value: trimmed,
  })

  if (insertValueError) throw insertValueError
}

export async function saveCustomerPageTranslations(
  namespace: string,
  form: TranslationFormState,
  locales: readonly string[] = CUSTOMER_PAGE_TRANSLATION_LOCALES
): Promise<void> {
  for (const [keyPath, localeValues] of Object.entries(form)) {
    for (const locale of locales) {
      await upsertTranslationValue(namespace, keyPath, locale, localeValues[locale] ?? '')
    }
  }
}

export async function invalidateTranslationCache(): Promise<void> {
  await fetch('/api/i18n/invalidate-cache', { method: 'POST' })
}
