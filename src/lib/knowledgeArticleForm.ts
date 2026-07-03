import { articleBodyToDocument, type KnowledgeArticleRow } from '@/lib/operationsHub'
import {
  emptySopDocument,
  prefillSortOrders,
  type SopDocument,
} from '@/types/sopStructure'

export const KNOWLEDGE_ARTICLE_SELECT =
  'id, slug, title_ko, title_en, summary_ko, summary_en, hub_category, content_type, target_roles, body_structure, sort_order, is_published, published_at, updated_at'

export type KnowledgeArticleDraftForm = {
  id: string | null
  slug: string
  title_ko: string
  title_en: string
  summary_ko: string
  summary_en: string
  hub_category: string
  content_type: string
  target_roles: string[]
  sort_order: number
  is_published: boolean
  bodyDoc: SopDocument
}

export function emptyKnowledgeArticleForm(): KnowledgeArticleDraftForm {
  return {
    id: null,
    slug: '',
    title_ko: '',
    title_en: '',
    summary_ko: '',
    summary_en: '',
    hub_category: 'other',
    content_type: 'playbook',
    target_roles: [],
    sort_order: 0,
    is_published: false,
    bodyDoc: prefillSortOrders(emptySopDocument()),
  }
}

export function knowledgeArticleRowToForm(row: KnowledgeArticleRow): KnowledgeArticleDraftForm {
  return {
    id: row.id,
    slug: row.slug,
    title_ko: row.title_ko,
    title_en: row.title_en,
    summary_ko: row.summary_ko,
    summary_en: row.summary_en,
    hub_category: row.hub_category,
    content_type: row.content_type,
    target_roles: row.target_roles ?? [],
    sort_order: row.sort_order,
    is_published: row.is_published,
    bodyDoc: articleBodyToDocument(row) ?? prefillSortOrders(emptySopDocument()),
  }
}
