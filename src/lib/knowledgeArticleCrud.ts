import type { Json } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import {
  ensureHubArticleSlug,
  normalizeBodyLayout,
  normalizeContentType,
  normalizeHubCategory,
} from '@/lib/operationsHub'
import type { KnowledgeArticleDraftForm } from '@/lib/knowledgeArticleForm'
import { KNOWLEDGE_ARTICLE_SELECT } from '@/lib/knowledgeArticleForm'
import { sopDocumentToJson } from '@/types/sopStructure'

export type SaveKnowledgeArticleResult =
  | { ok: true; slug: string; id: string; updated_at: string | null }
  | {
      ok: false
      error: string
      conflict?: boolean
      serverUpdatedAt?: string | null
    }

export async function saveKnowledgeArticle(
  form: KnowledgeArticleDraftForm,
  userId: string | null,
  options?: {
    metadataOnly?: boolean
    /** 열었을 때의 updated_at — 다르면 충돌로 거절 */
    expectedUpdatedAt?: string | null
    /** 충돌이어도 덮어쓰기 */
    force?: boolean
  }
): Promise<SaveKnowledgeArticleResult> {
  const slugSource = form.slug.trim() || form.title_en.trim() || form.title_ko.trim()
  if (!slugSource) {
    return { ok: false, error: 'slug or title required' }
  }
  const slug = ensureHubArticleSlug(slugSource, form.id ?? undefined)
  if (!form.title_ko.trim() && !form.title_en.trim()) {
    return { ok: false, error: 'title required' }
  }

  const basePayload = {
    slug,
    title_ko: form.title_ko.trim(),
    title_en: form.title_en.trim(),
    summary_ko: form.summary_ko.trim(),
    summary_en: form.summary_en.trim(),
    hub_category: normalizeHubCategory(form.hub_category),
    content_type: normalizeContentType(form.content_type),
    target_roles: form.target_roles,
    sort_order: form.sort_order,
    is_published: form.is_published,
    body_layout: normalizeBodyLayout(form.body_layout),
    published_at: form.is_published ? new Date().toISOString() : null,
    updated_by: userId,
  }

  if (form.id) {
    const updatePayload =
      options?.metadataOnly
        ? basePayload
        : {
            ...basePayload,
            body_structure: sopDocumentToJson(form.bodyDoc) as Json,
          }

    let query = supabase
      .from('company_knowledge_articles')
      .update(updatePayload)
      .eq('id', form.id)

    if (options?.expectedUpdatedAt && !options.force) {
      query = query.eq('updated_at', options.expectedUpdatedAt)
    }

    const { data, error } = await query.select('id, updated_at').maybeSingle()
    if (error) return { ok: false, error: error.message }

    if (!data) {
      if (options?.expectedUpdatedAt && !options.force) {
        const { data: server } = await supabase
          .from('company_knowledge_articles')
          .select('updated_at')
          .eq('id', form.id)
          .maybeSingle()
        return {
          ok: false,
          error: 'conflict',
          conflict: true,
          serverUpdatedAt: (server as { updated_at?: string } | null)?.updated_at ?? null,
        }
      }
      return { ok: false, error: 'article not found' }
    }

    return {
      ok: true,
      slug,
      id: form.id,
      updated_at: (data as { updated_at?: string }).updated_at ?? null,
    }
  }

  const insertPayload = {
    ...basePayload,
    body_structure: sopDocumentToJson(form.bodyDoc) as Json,
  }

  const { data, error } = await supabase
    .from('company_knowledge_articles')
    .insert(insertPayload)
    .select('id, updated_at')
    .single()
  if (error) return { ok: false, error: error.message }
  const row = data as { id: string; updated_at?: string }
  return { ok: true, slug, id: row.id, updated_at: row.updated_at ?? null }
}

export async function deleteKnowledgeArticle(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from('company_knowledge_articles').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function fetchKnowledgeArticleBySlug(slug: string) {
  return supabase
    .from('company_knowledge_articles')
    .select(KNOWLEDGE_ARTICLE_SELECT)
    .eq('slug', slug)
    .maybeSingle()
}
