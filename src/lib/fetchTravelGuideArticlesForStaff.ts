import { supabase } from '@/lib/supabase'
import type { TravelGuideArticle, TravelGuideArticleRow } from '@/lib/travelGuideArticles'

async function fetchTravelGuideStaffJson(
  accessToken: string,
  locale?: string
): Promise<{ ok?: boolean; articles?: unknown[] } | null> {
  const params = new URLSearchParams()
  if (locale) params.set('locale', locale)
  const query = params.toString()

  const response = await fetch(query ? `/api/travel-guide?${query}` : '/api/travel-guide', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) return null

  return (await response.json()) as { ok?: boolean; articles?: unknown[] }
}

export async function fetchTravelGuideArticlesForStaff(): Promise<TravelGuideArticleRow[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) return []

  try {
    const payload = await fetchTravelGuideStaffJson(session.access_token)
    return payload?.ok ? ((payload.articles ?? []) as TravelGuideArticleRow[]) : []
  } catch (error) {
    console.error('[fetchTravelGuideArticlesForStaff]', error)
    return []
  }
}

/** Staff listing cards — localized titles/excerpts plus author display names. */
export async function fetchTravelGuideListingForStaff(
  locale: string
): Promise<TravelGuideArticle[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) return []

  try {
    const payload = await fetchTravelGuideStaffJson(session.access_token, locale)
    return payload?.ok ? ((payload.articles ?? []) as TravelGuideArticle[]) : []
  } catch (error) {
    console.error('[fetchTravelGuideListingForStaff]', error)
    return []
  }
}
