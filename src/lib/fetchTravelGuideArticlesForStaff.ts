import { supabase } from '@/lib/supabase'
import type { TravelGuideArticleRow } from '@/lib/travelGuideArticles'

export async function fetchTravelGuideArticlesForStaff(): Promise<TravelGuideArticleRow[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) return []

  try {
    const response = await fetch('/api/travel-guide', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!response.ok) return []

    const payload = (await response.json()) as { ok?: boolean; articles?: TravelGuideArticleRow[] }
    return payload.ok ? payload.articles ?? [] : []
  } catch (error) {
    console.error('[fetchTravelGuideArticlesForStaff]', error)
    return []
  }
}
