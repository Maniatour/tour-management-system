import type { Json } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import {
  ensureHubArticleSlug,
  normalizeContentType,
  normalizeHubCategory,
} from '@/lib/operationsHub'
import type { KnowledgeArticleDraftForm } from '@/lib/knowledgeArticleForm'
import { KNOWLEDGE_ARTICLE_SELECT } from '@/lib/knowledgeArticleForm'
import { sopDocumentToJson } from '@/types/sopStructure'

export async function saveKnowledgeArticle(
  form: KnowledgeArticleDraftForm,
  userId: string | null,
  options?: { metadataOnly?: boolean }
): Promise<{ ok: true; slug: string; id: string } | { ok: false; error: string }> {
  const slugSource = form.slug.trim() || form.title_en.trim() || form.title_ko.trim()
  if (!slugSource) {
    return { ok: false, error: 'slug or title required' }
  }
  const slug = ensureHubArticleSlug(slugSource, form.id ?? undefined)
  if (!form.title_ko.trim() && !form.title_en.trim()) {
    return { ok: false, error: 'title required' }
  }

  const payload = {
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
    published_at: form.is_published ? new Date().toISOString() : null,
    updated_by: userId,
    ...(options?.metadataOnly && form.id
      ? {}
      : { body_structure: sopDocumentToJson(form.bodyDoc) as Json }),
  }

  if (form.id) {
    const { error } = await supabase
      .from('company_knowledge_articles')
      .update(payload)
      .eq('id', form.id)
    if (error) return { ok: false, error: error.message }
    return { ok: true, slug, id: form.id }
  }

  const { data, error } = await supabase
    .from('company_knowledge_articles')
    .insert(payload)
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, slug, id: (data as { id: string }).id }
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
