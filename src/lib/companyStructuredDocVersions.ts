import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/database.types'

const VERSION_SELECT_WITH_FREEFORM =
  'id, version_number, title, body_md, body_structure, freeform_markdown, published_at' as const
const VERSION_SELECT_BASE =
  'id, version_number, title, body_md, body_structure, published_at' as const

/** PostgREST 400 when select/insert references a column that does not exist yet */
export function isMissingFreeformColumnError(message: string | undefined | null) {
  const m = (message ?? '').toLowerCase()
  return m.includes('freeform_markdown') || (m.includes('column') && m.includes('does not exist'))
}

type VersionTable = 'company_sop_versions' | 'company_employee_contract_versions'

type VersionListRow = {
  id: string
  version_number: number
  title: string
  body_md: string | null
  body_structure: unknown
  freeform_markdown?: string | null
  published_at: string
}

/**
 * 목록 조회: DB에 freeform_markdown 마이그레이션이 없으면 컬럼 없이 재시도.
 */
export async function fetchStructuredDocVersionList(
  sb: SupabaseClient<Database>,
  table: VersionTable
): Promise<{ rows: VersionListRow[]; error: Error | null }> {
  const first = await sb.from(table).select(VERSION_SELECT_WITH_FREEFORM).order('version_number', { ascending: false })
  if (!first.error) {
    return { rows: (first.data ?? []) as VersionListRow[], error: null }
  }
  if (isMissingFreeformColumnError(first.error.message)) {
    const second = await sb.from(table).select(VERSION_SELECT_BASE).order('version_number', { ascending: false })
    if (second.error) {
      return { rows: [], error: new Error(second.error.message) }
    }
    const rows = (second.data ?? []).map((r) => ({
      ...(r as Omit<VersionListRow, 'freeform_markdown'>),
      freeform_markdown: null as string | null,
    }))
    return { rows, error: null }
  }
  return { rows: [], error: new Error(first.error.message) }
}

type InsertVersionPayload = {
  version_number: number
  title: string
  body_md: string
  body_structure: Json
  published_by: string
  freeform_markdown?: string
}

/**
 * 새 버전 insert: freeform 컬럼이 없으면 해당 필드 없이 재시도.
 */
export async function insertStructuredDocVersion(
  sb: SupabaseClient<Database>,
  table: VersionTable,
  payload: InsertVersionPayload
): Promise<{ error: Error | null; insertedId?: string }> {
  const withFf = await sb
    .from(table)
    .insert({
      version_number: payload.version_number,
      title: payload.title,
      body_md: payload.body_md,
      body_structure: payload.body_structure,
      freeform_markdown: payload.freeform_markdown ?? '',
      published_by: payload.published_by,
    })
    .select('id')
    .maybeSingle()
  if (!withFf.error) {
    const id = withFf.data?.id
    return { error: null, insertedId: typeof id === 'string' ? id : undefined }
  }
  if (isMissingFreeformColumnError(withFf.error.message)) {
    const { version_number, title, body_md, body_structure, published_by } = payload
    const noFf = await sb
      .from(table)
      .insert({
        version_number,
        title,
        body_md,
        body_structure,
        published_by,
      })
      .select('id')
      .maybeSingle()
    if (!noFf.error) {
      const id = noFf.data?.id
      return { error: null, insertedId: typeof id === 'string' ? id : undefined }
    }
    return { error: new Error(noFf.error.message) }
  }
  return { error: new Error(withFf.error.message) }
}
