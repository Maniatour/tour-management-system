import type { SupabaseClient } from '@supabase/supabase-js'

import type { CrudCell } from '@/lib/admin-site-access-tree'
import { SITE_ACCESS_PERSONAS, type SiteAccessPersona } from '@/lib/site-access-persona'

export type SiteAccessCrudPatch = Partial<Pick<CrudCell, 'read' | 'write' | 'update' | 'delete'>>

export type SiteAccessMatrixOverrideRow = {
  node_id: string
  persona: SiteAccessPersona
  patch: SiteAccessCrudPatch
  updated_at: string
}

/** node_id -> persona -> patch (빈 객체는 상속) */
export type SiteAccessPatchMap = Map<string, Map<SiteAccessPersona, SiteAccessCrudPatch>>

const CRUD_KEYS: (keyof CrudCell)[] = ['read', 'write', 'update', 'delete']

/** 원격 DB에 마이그레이션 미적용 시 PostgREST 404 / PGRST205 */
function isOverridesTableUnavailable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  if (err.code === 'PGRST205') return true
  const m = (err.message ?? '').toLowerCase()
  return (
    (m.includes('schema cache') || m.includes('could not find')) && m.includes('site_access_matrix_overrides')
  )
}

function normalizePatch(raw: unknown): SiteAccessCrudPatch {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const out: SiteAccessCrudPatch = {}
  for (const k of CRUD_KEYS) {
    if (k in o && typeof o[k] === 'boolean') out[k] = o[k] as boolean
  }
  return out
}

export function rowsToPatchMap(rows: readonly SiteAccessMatrixOverrideRow[]): SiteAccessPatchMap {
  const m: SiteAccessPatchMap = new Map()
  for (const r of rows) {
    const patch = normalizePatch(r.patch)
    if (Object.keys(patch).length === 0) continue
    let inner = m.get(r.node_id)
    if (!inner) {
      inner = new Map()
      m.set(r.node_id, inner)
    }
    inner.set(r.persona, patch)
  }
  return m
}

export function mergePersonaCrudWithPatches(
  base: Record<SiteAccessPersona, CrudCell>,
  nodeId: string,
  patches: SiteAccessPatchMap
): Record<SiteAccessPersona, CrudCell> {
  const perNode = patches.get(nodeId)
  if (!perNode) return base
  const next: Record<SiteAccessPersona, CrudCell> = { ...base }
  for (const persona of SITE_ACCESS_PERSONAS) {
    const patch = perNode.get(persona)
    if (!patch || Object.keys(patch).length === 0) continue
    const b = base[persona]
    next[persona] = {
      read: patch.read !== undefined ? patch.read : b.read,
      write: patch.write !== undefined ? patch.write : b.write,
      update: patch.update !== undefined ? patch.update : b.update,
      delete: patch.delete !== undefined ? patch.delete : b.delete,
    }
  }
  return next
}

export async function fetchSiteAccessMatrixOverrides(
  supabase: SupabaseClient
): Promise<{ rows: SiteAccessMatrixOverrideRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('site_access_matrix_overrides')
    .select('node_id, persona, patch, updated_at')

  if (error) {
    if (isOverridesTableUnavailable(error)) {
      return { rows: [], error: null }
    }
    return { rows: [], error: new Error(error.message) }
  }
  const rows = (data ?? []).map((r) => ({
    node_id: r.node_id as string,
    persona: r.persona as SiteAccessPersona,
    patch: normalizePatch(r.patch),
    updated_at: r.updated_at as string,
  }))
  return { rows, error: null }
}

export async function upsertSiteAccessMatrixPatch(
  supabase: SupabaseClient,
  nodeId: string,
  persona: SiteAccessPersona,
  patch: SiteAccessCrudPatch
): Promise<{ error: Error | null }> {
  const clean: Record<string, boolean> = {}
  for (const k of CRUD_KEYS) {
    if (patch[k] !== undefined) clean[k] = patch[k]!
  }
  if (Object.keys(clean).length === 0) {
    return deleteSiteAccessMatrixOverride(supabase, nodeId, persona)
  }
  const { error } = await supabase
    .from('site_access_matrix_overrides')
    .upsert(
      {
        node_id: nodeId,
        persona,
        patch: clean,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'node_id,persona' }
    )
  if (error && isOverridesTableUnavailable(error)) {
    return {
      error: new Error(
        'site_access_matrix_overrides 테이블이 없습니다. Supabase에 마이그레이션 20260620120000_site_access_matrix_overrides.sql 을 적용하세요.'
      ),
    }
  }
  return { error: error ? new Error(error.message) : null }
}

export async function deleteSiteAccessMatrixOverride(
  supabase: SupabaseClient,
  nodeId: string,
  persona: SiteAccessPersona
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('site_access_matrix_overrides').delete().eq('node_id', nodeId).eq('persona', persona)
  if (error && isOverridesTableUnavailable(error)) {
    return {
      error: new Error(
        'site_access_matrix_overrides 테이블이 없습니다. Supabase에 마이그레이션 20260620120000_site_access_matrix_overrides.sql 을 적용하세요.'
      ),
    }
  }
  return { error: error ? new Error(error.message) : null }
}
