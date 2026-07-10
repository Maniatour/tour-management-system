import type { LegalPageSlug } from '@/lib/customerSiteRoutes'
import {
  getDefaultLegalPageContent,
  normalizeLegalPageContent,
  type LegalPageContent,
} from '@/lib/legalContent'
import { supabase } from '@/lib/supabase'

export const LEGAL_PAGES_NAMESPACE = 'legal_pages'
export const LEGAL_PAGE_LOCALES = ['ko', 'en'] as const
export type LegalPageLocale = (typeof LEGAL_PAGE_LOCALES)[number]

const contentCache = new Map<string, LegalPageContent>()

function cacheKey(slug: LegalPageSlug, locale: string): string {
  return `${slug}:${locale === 'en' ? 'en' : 'ko'}`
}

export function resolveLegalPageLocale(locale: string): LegalPageLocale {
  return locale === 'en' ? 'en' : 'ko'
}

export function getCachedLegalPageContent(
  slug: LegalPageSlug,
  locale: string
): LegalPageContent | null {
  return contentCache.get(cacheKey(slug, locale)) ?? null
}

export function setCachedLegalPageContent(
  slug: LegalPageSlug,
  locale: string,
  content: LegalPageContent
): void {
  contentCache.set(cacheKey(slug, locale), normalizeLegalPageContent(content, slug, locale))
}

export async function fetchLegalPageContent(
  slug: LegalPageSlug,
  locale: string
): Promise<LegalPageContent> {
  const resolvedLocale = resolveLegalPageLocale(locale)
  const fallback = getDefaultLegalPageContent(slug, resolvedLocale)

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
    .eq('namespace', LEGAL_PAGES_NAMESPACE)
    .eq('key_path', slug)
    .maybeSingle()

  if (error) {
    console.error('[legalContent] fetch failed:', error.message)
    return fallback
  }

  const values = (data?.translation_values ?? []) as Array<{ locale: string; value: unknown }>
  const raw = values.find((value) => value.locale === resolvedLocale)?.value

  if (typeof raw !== 'string' || !raw.trim()) {
    return fallback
  }

  try {
    const parsed = normalizeLegalPageContent(JSON.parse(raw), slug, resolvedLocale)
    contentCache.set(cacheKey(slug, resolvedLocale), parsed)
    return parsed
  } catch {
    return fallback
  }
}

export async function fetchAllLegalPageContents(): Promise<
  Record<LegalPageSlug, Record<LegalPageLocale, LegalPageContent>>
> {
  const slugs = [
    'terms',
    'privacy-policy',
    'sms-terms',
    'cancellation-refund-policy',
    'cookie-policy',
  ] as const

  const result = {} as Record<LegalPageSlug, Record<LegalPageLocale, LegalPageContent>>

  for (const slug of slugs) {
    result[slug] = {
      ko: await fetchLegalPageContent(slug, 'ko'),
      en: await fetchLegalPageContent(slug, 'en'),
    }
  }

  return result
}

async function upsertLegalPageValue(
  slug: LegalPageSlug,
  locale: LegalPageLocale,
  content: LegalPageContent
): Promise<void> {
  const normalized = normalizeLegalPageContent(content, slug, locale)
  const json = JSON.stringify(normalized)

  const { data: existingTrans, error: findError } = await supabase
    .from('translations')
    .select('id')
    .eq('namespace', LEGAL_PAGES_NAMESPACE)
    .eq('key_path', slug)
    .maybeSingle()

  if (findError) throw findError

  let translationId = existingTrans?.id as string | undefined

  if (!translationId) {
    const { data: inserted, error: insertTransError } = await supabase
      .from('translations')
      .insert({
        id: crypto.randomUUID(),
        namespace: LEGAL_PAGES_NAMESPACE,
        key_path: slug,
        is_system: true,
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
      .update({ value: json, updated_at: new Date().toISOString() })
      .eq('id', existingValue.id)
    if (updateError) throw updateError
  } else {
    const { error: insertValueError } = await supabase.from('translation_values').insert({
      id: crypto.randomUUID(),
      translation_id: translationId,
      locale,
      value: json,
    })
    if (insertValueError) throw insertValueError
  }

  setCachedLegalPageContent(slug, locale, normalized)
}

export async function persistLegalPageContent(
  slug: LegalPageSlug,
  locale: LegalPageLocale,
  content: LegalPageContent
): Promise<void> {
  await upsertLegalPageValue(slug, locale, content)
}

export async function persistLegalPageContents(
  slug: LegalPageSlug,
  contents: Record<LegalPageLocale, LegalPageContent>
): Promise<void> {
  await Promise.all(
    LEGAL_PAGE_LOCALES.map((locale) => persistLegalPageContent(slug, locale, contents[locale]))
  )
}
