import { supabase } from '@/lib/supabase'
import { articleBodyToDocument, hubCategoryLabel, type KnowledgeArticleRow } from '@/lib/operationsHub'
import { KNOWLEDGE_ARTICLE_SELECT } from '@/lib/knowledgeArticleForm'
import type { SopDocument, SopEditLocale, OperationsHubCategory } from '@/types/sopStructure'
import { sopText } from '@/types/sopStructure'

export type HubArticleLinkOption = {
  id: string
  slug: string
  title_ko: string
  title_en: string
  hub_category: OperationsHubCategory
  is_published: boolean
}

const HUB_ARTICLE_LINK_SELECT =
  'id, slug, title_ko, title_en, hub_category, is_published, sort_order' as const

export function hubArticleLinkLabel(
  article: Pick<HubArticleLinkOption, 'id' | 'slug' | 'title_ko' | 'title_en'>,
  lang: SopEditLocale
): string {
  return sopText(article.title_ko, article.title_en, lang).trim() || article.slug || article.id
}

export function hubArticleLinkMeta(
  article: HubArticleLinkOption,
  lang: SopEditLocale
): string {
  const cat = hubCategoryLabel(article.hub_category, lang)
  const draft = article.is_published ? '' : lang === 'en' ? ' · Draft' : ' · 초안'
  return `${cat}${draft}`
}

export async function fetchHubArticlesForManualLink(): Promise<HubArticleLinkOption[]> {
  const { data, error } = await supabase
    .from('company_knowledge_articles')
    .select(HUB_ARTICLE_LINK_SELECT)
    .order('sort_order')
    .order('slug')

  if (error || !data) return []

  return (data as HubArticleLinkOption[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    title_ko: row.title_ko,
    title_en: row.title_en,
    hub_category: row.hub_category,
    is_published: row.is_published,
  }))
}

export async function fetchHubArticleDocumentById(
  articleId: string
): Promise<{ doc: SopDocument; row: KnowledgeArticleRow } | null> {
  const { data, error } = await supabase
    .from('company_knowledge_articles')
    .select(KNOWLEDGE_ARTICLE_SELECT)
    .eq('id', articleId)
    .maybeSingle()

  if (error || !data) return null

  const row = data as KnowledgeArticleRow
  const doc = articleBodyToDocument(row)
  if (!doc) return null
  return { doc, row }
}
