import { deriveTravelGuideExcerpt, type TravelGuideArticleRow } from '@/lib/travelGuideArticles'

export function normalizeTravelGuideSearchQuery(query: string): string {
  return query.trim().toLowerCase()
}

function rowSearchHaystack(row: TravelGuideArticleRow): string {
  const bodyPlainEn = deriveTravelGuideExcerpt(row.body_en, 10000)
  const bodyPlainKo = deriveTravelGuideExcerpt(row.body_ko, 10000)

  return [
    row.slug,
    row.title_en,
    row.title_ko,
    row.excerpt_en,
    row.excerpt_ko,
    row.category_en,
    row.category_ko,
    bodyPlainEn,
    bodyPlainKo,
  ]
    .join(' ')
    .toLowerCase()
}

export function travelGuideRowMatchesQuery(row: TravelGuideArticleRow, query: string): boolean {
  const normalized = normalizeTravelGuideSearchQuery(query)
  if (!normalized) return true

  const tokens = normalized.split(/\s+/).filter(Boolean)
  const haystack = rowSearchHaystack(row)

  return tokens.every((token) => haystack.includes(token))
}

export function filterTravelGuideRowsByQuery(
  rows: TravelGuideArticleRow[],
  query: string
): TravelGuideArticleRow[] {
  const normalized = normalizeTravelGuideSearchQuery(query)
  if (!normalized) return rows
  return rows.filter((row) => travelGuideRowMatchesQuery(row, normalized))
}
