import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import { matchesHubTargetRoles } from '@/lib/operationsHub'

export type HubAcknowledgmentMode = 'none' | 'signature'

export type HubArticleSignStatus = {
  versionId: string
  versionNumber: number
  signed: boolean
  pdfPath: string | null
}

export type PendingHubArticleSign = {
  versionId: string
  versionNumber: number
  title: string
}

export function normalizeAcknowledgmentMode(raw: unknown): HubAcknowledgmentMode {
  return raw === 'signature' ? 'signature' : 'none'
}

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null)
}

export async function ensureHubArticleSignVersion(opts: {
  articleId: string
  publishedBy: string | null
  title: string
  bodyStructure: Json
  bumpIfChanged: boolean
}): Promise<{ ok: true; versionId: string; created: boolean } | { ok: false; error: string }> {
  const { data: latest, error: latestErr } = await supabase
    .from('company_knowledge_article_sign_versions')
    .select('id, version_number, title, body_structure')
    .eq('article_id', opts.articleId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestErr) return { ok: false, error: latestErr.message }

  const row = latest as {
    id: string
    version_number: number
    title: string
    body_structure: Json
  } | null

  if (row && !opts.bumpIfChanged) {
    return { ok: true, versionId: row.id, created: false }
  }

  if (
    row &&
    stableJson(row.body_structure) === stableJson(opts.bodyStructure) &&
    (row.title || '') === opts.title
  ) {
    return { ok: true, versionId: row.id, created: false }
  }

  const nextNumber = row ? row.version_number + 1 : 1
  const { data: inserted, error: insertErr } = await supabase
    .from('company_knowledge_article_sign_versions')
    .insert({
      article_id: opts.articleId,
      version_number: nextNumber,
      title: opts.title,
      body_structure: opts.bodyStructure,
      published_by: opts.publishedBy,
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    return { ok: false, error: insertErr?.message || 'sign version insert failed' }
  }

  return { ok: true, versionId: (inserted as { id: string }).id, created: true }
}

export async function fetchHubArticleSignStatus(
  articleId: string,
  userId: string
): Promise<HubArticleSignStatus | null> {
  const { data: latest, error } = await supabase
    .from('company_knowledge_article_sign_versions')
    .select('id, version_number')
    .eq('article_id', articleId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !latest) return null

  const version = latest as { id: string; version_number: number }
  const { data: sig } = await supabase
    .from('company_knowledge_article_signatures')
    .select('pdf_storage_path')
    .eq('version_id', version.id)
    .eq('user_id', userId)
    .maybeSingle()

  const pdfPath = (sig as { pdf_storage_path?: string } | null)?.pdf_storage_path ?? null
  return {
    versionId: version.id,
    versionNumber: version.version_number,
    signed: Boolean(pdfPath),
    pdfPath,
  }
}

export async function fetchFirstPendingHubArticleSign(
  userId: string,
  userPosition: string | null
): Promise<PendingHubArticleSign | null> {
  const { data: articles, error: articleErr } = await supabase
    .from('company_knowledge_articles')
    .select('id, title_ko, title_en, target_roles')
    .eq('is_published', true)
    .eq('acknowledgment_mode', 'signature')

  if (articleErr || !articles?.length) return null

  const eligible = (articles as Array<{
    id: string
    title_ko: string
    title_en: string
    target_roles: string[] | null
  }>).filter((row) => matchesHubTargetRoles(row.target_roles, userPosition))

  if (eligible.length === 0) return null

  const ids = eligible.map((row) => row.id)
  const { data: versions, error: versionErr } = await supabase
    .from('company_knowledge_article_sign_versions')
    .select('id, article_id, version_number, title')
    .in('article_id', ids)
    .order('version_number', { ascending: false })

  if (versionErr || !versions?.length) return null

  const latestByArticle = new Map<
    string,
    { id: string; article_id: string; version_number: number; title: string }
  >()
  for (const raw of versions as Array<{
    id: string
    article_id: string
    version_number: number
    title: string
  }>) {
    if (!latestByArticle.has(raw.article_id)) {
      latestByArticle.set(raw.article_id, raw)
    }
  }

  const latestList = [...latestByArticle.values()]
  if (latestList.length === 0) return null

  const { data: sigs } = await supabase
    .from('company_knowledge_article_signatures')
    .select('version_id')
    .eq('user_id', userId)
    .in(
      'version_id',
      latestList.map((v) => v.id)
    )

  const signed = new Set(
    ((sigs || []) as Array<{ version_id: string }>).map((s) => s.version_id)
  )

  const pending = latestList.find((v) => !signed.has(v.id))
  if (!pending) return null

  const article = eligible.find((row) => row.id === pending.article_id)
  const title =
    pending.title.trim() ||
    article?.title_ko?.trim() ||
    article?.title_en?.trim() ||
    ''

  return {
    versionId: pending.id,
    versionNumber: pending.version_number,
    title,
  }
}
