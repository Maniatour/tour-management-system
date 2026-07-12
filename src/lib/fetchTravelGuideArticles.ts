import type { TravelGuideArticle } from '@/lib/travelGuideArticles'

const emptyArticles: TravelGuideArticle[] = []

export async function fetchTravelGuideArticles(options: {
  locale: string
  limit?: number
}): Promise<TravelGuideArticle[]> {
  const params = new URLSearchParams({
    locale: options.locale,
    limit: String(options.limit ?? 24),
  })

  try {
    const response = await fetch(`/api/public/travel-guide?${params.toString()}`)
    if (!response.ok) return emptyArticles

    const payload = (await response.json()) as { ok?: boolean; articles?: TravelGuideArticle[] }
    return payload.ok ? payload.articles ?? emptyArticles : emptyArticles
  } catch (error) {
    console.error('[fetchTravelGuideArticles]', error)
    return emptyArticles
  }
}

export async function fetchTravelGuideArticle(options: {
  locale: string
  slug: string
}): Promise<TravelGuideArticle | null> {
  const params = new URLSearchParams({ locale: options.locale })

  try {
    const response = await fetch(
      `/api/public/travel-guide/${encodeURIComponent(options.slug)}?${params.toString()}`
    )
    if (!response.ok) return null

    const payload = (await response.json()) as { ok?: boolean; article?: TravelGuideArticle }
    return payload.ok ? payload.article ?? null : null
  } catch (error) {
    console.error('[fetchTravelGuideArticle]', error)
    return null
  }
}
