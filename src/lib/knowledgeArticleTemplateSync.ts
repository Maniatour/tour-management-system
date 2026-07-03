import { supabase } from '@/lib/supabase'
import { defaultKnowledgeArticleSeeds } from '@/lib/operationsHub'
import {
  buildKnowledgeArticleSeedPayload,
  defaultKnowledgeArticleSeedSlugs,
} from '@/lib/operationsHubTemplates'

export type TemplateSyncMode = 'append' | 'overwrite'

export type TemplateSyncResult = {
  inserted: number
  updated: number
  skipped: number
  error?: string
}

export async function syncKnowledgeArticleTemplates(
  mode: TemplateSyncMode,
  updatedBy: string | null
): Promise<TemplateSyncResult> {
  const seeds = defaultKnowledgeArticleSeeds()

  const { data: existing, error: loadErr } = await supabase
    .from('company_knowledge_articles')
    .select('id, slug')
  if (loadErr) {
    return { inserted: 0, updated: 0, skipped: 0, error: loadErr.message }
  }

  const idBySlug = new Map((existing || []).map((r) => [r.slug, r.id]))
  let inserted = 0
  let updated = 0
  let skipped = 0

  for (const seed of seeds) {
    const payload = buildKnowledgeArticleSeedPayload(seed, { updated_by: updatedBy })
    const existingId = idBySlug.get(seed.slug)

    if (existingId) {
      if (mode === 'append') {
        skipped += 1
        continue
      }
      const { error } = await supabase
        .from('company_knowledge_articles')
        .update(payload)
        .eq('id', existingId)
      if (error) return { inserted, updated, skipped, error: error.message }
      updated += 1
    } else {
      const { error } = await supabase.from('company_knowledge_articles').insert(payload)
      if (error) return { inserted, updated, skipped, error: error.message }
      inserted += 1
    }
  }

  return { inserted, updated, skipped }
}

export function templateSyncConfirmMessage(mode: TemplateSyncMode, isEn: boolean): string {
  const n = defaultKnowledgeArticleSeedSlugs().length
  if (mode === 'overwrite') {
    return isEn
      ? `Overwrite ${n} built-in template articles with the latest version?\n\n• Custom articles (other slugs) are kept.\n• Your edits to template slugs will be lost.\n\nContinue?`
      : `내장 템플릿 ${n}개를 최신 내용으로 덮어씁니다.\n\n• 직접 만든 문서(다른 slug)는 유지됩니다.\n• 템플릿 slug에 수정해 둔 내용은 사라집니다.\n\n계속할까요?`
  }
  return ''
}

export function templateSyncResultMessage(
  mode: TemplateSyncMode,
  result: TemplateSyncResult,
  seedCount: number,
  isEn: boolean
): string {
  if (result.error) return result.error
  if (mode === 'append') {
    if (result.inserted === 0) {
      return isEn
        ? `All ${seedCount} templates already exist. Use overwrite to refresh.`
        : `템플릿 ${seedCount}개가 이미 모두 있습니다. 최신화는 「템플릿 덮어쓰기」를 사용하세요.`
    }
    return isEn
      ? `Added ${result.inserted} template(s) (${result.skipped} skipped).`
      : `템플릿 ${result.inserted}개 추가 (${result.skipped}개 기존 유지).`
  }
  return isEn
    ? `Templates synced: ${result.updated} overwritten, ${result.inserted} added.`
    : `템플릿 반영: ${result.updated}개 덮어씀, ${result.inserted}개 신규 추가.`
}
