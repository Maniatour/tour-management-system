import { contentTypeLabel, hubCategoryLabel, articleBodyToDocument, type HubEntry, type KnowledgeArticleRow } from '@/lib/operationsHub'
import type { HubArticleLinkOption } from '@/lib/hubArticleManualLink'
import { buildSopDocumentSearchIndex } from '@/lib/sopDocumentSearch'
import type { SopDocument, SopEditLocale } from '@/types/sopStructure'

export function normalizeHubSearchQuery(query: string): string {
  return query.trim().toLowerCase()
}

function matchesHubSearchText(haystack: string, query: string): boolean {
  const q = normalizeHubSearchQuery(query)
  if (!q) return true
  return haystack.toLowerCase().includes(q)
}

/** SOP/허브 문서 본문·메뉴얼·체크리스트 등을 평문으로 합침 (한·영 모두) */
export function sopDocumentPlainTextBlob(doc: SopDocument): string {
  const parts: string[] = []
  for (const lang of ['ko', 'en'] as const) {
    for (const hit of buildSopDocumentSearchIndex(doc, lang, lang === 'en')) {
      if (hit.plainText) parts.push(hit.plainText)
    }
  }
  return parts.join(' ')
}

export function knowledgeArticleBodySearchBlob(row: KnowledgeArticleRow): string {
  const doc = articleBodyToDocument(row)
  const bodyText = doc ? sopDocumentPlainTextBlob(doc) : ''
  return [row.summary_ko, row.summary_en, bodyText].filter(Boolean).join(' ')
}

export function hubArticleLinkSearchBlob(
  article: HubArticleLinkOption,
  lang: SopEditLocale
): string {
  const altLang: SopEditLocale = lang === 'ko' ? 'en' : 'ko'
  return [
    article.title_ko,
    article.title_en,
    article.slug,
    article.id,
    article.summary_ko ?? '',
    article.summary_en ?? '',
    article.body_search_text ?? '',
    hubCategoryLabel(article.hub_category, lang),
    hubCategoryLabel(article.hub_category, altLang),
  ].join(' ')
}
export function filterHubArticleLinks(
  articles: HubArticleLinkOption[],
  query: string,
  lang: SopEditLocale
): HubArticleLinkOption[] {
  const q = normalizeHubSearchQuery(query)
  if (!q) return articles
  return articles.filter((article) => matchesHubSearchText(hubArticleLinkSearchBlob(article, lang), q))
}

export function hubEntrySearchBlob(entry: HubEntry, lang: SopEditLocale): string {
  const altLang: SopEditLocale = lang === 'ko' ? 'en' : 'ko'
  return [
    entry.title_ko,
    entry.title_en,
    entry.summary_ko,
    entry.summary_en,
    entry.slug ?? '',
    entry.id,
    hubCategoryLabel(entry.hub_category, lang),
    hubCategoryLabel(entry.hub_category, altLang),
    contentTypeLabel(entry.content_type, lang),
    contentTypeLabel(entry.content_type, altLang),
  ].join(' ')
}

export function filterHubEntries(
  entries: HubEntry[],
  query: string,
  lang: SopEditLocale,
  extraSearchTextByEntryId?: ReadonlyMap<string, string>
): HubEntry[] {
  const q = normalizeHubSearchQuery(query)
  if (!q) return entries
  return entries.filter((entry) => {
    const extra = extraSearchTextByEntryId?.get(entry.id) ?? ''
    const blob = `${hubEntrySearchBlob(entry, lang)} ${extra}`
    return matchesHubSearchText(blob, q)
  })
}
