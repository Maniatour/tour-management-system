import type { SupabaseClient } from '@supabase/supabase-js'

export type KnowledgeArticleRevisionRow = {
  id: string
  article_id: string
  revision: number
  action: 'save' | 'restore' | 'seed'
  restored_from_id: string | null
  note: string | null
  saved_by_email: string | null
  saved_by_name: string | null
  created_at: string
  title_ko: string
  title_en: string
  body_chars: number
}

export async function listKnowledgeArticleRevisions(
  client: SupabaseClient,
  articleId: string,
  limit = 40
): Promise<KnowledgeArticleRevisionRow[]> {
  const { data, error } = await client.rpc('list_company_knowledge_article_revisions', {
    p_article_id: articleId,
    p_limit: limit,
  })
  if (error) throw error
  return (data ?? []) as KnowledgeArticleRevisionRow[]
}

export async function restoreKnowledgeArticleRevision(
  client: SupabaseClient,
  revisionId: string
): Promise<{ article_id: string; restored_from_id: string; revision: number }> {
  const { data, error } = await client.rpc('restore_company_knowledge_article_revision', {
    p_revision_id: revisionId,
  })
  if (error) throw error
  const row = (data ?? {}) as {
    article_id?: string
    restored_from_id?: string
    revision?: number
  }
  return {
    article_id: String(row.article_id ?? ''),
    restored_from_id: String(row.restored_from_id ?? ''),
    revision: Number(row.revision ?? 0),
  }
}

export function formatKnowledgeRevisionTimestamp(
  iso: string,
  locale: 'ko' | 'en' = 'en',
  timeZone = 'America/Los_Angeles'
): string {
  try {
    return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
      timeZone,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function knowledgeRevisionEditorLabel(row: KnowledgeArticleRevisionRow): string {
  const email = row.saved_by_email || ''
  return (row.saved_by_name || email.split('@')[0] || '—').trim()
}
