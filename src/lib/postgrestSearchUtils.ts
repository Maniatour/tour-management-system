import type { SupabaseClient } from '@supabase/supabase-js'

function qIdent(s: string): string {
  return String(s).replace(/"/g, '""')
}

/** PostgREST or() / filter용 ilike 값 (따옴표·와ildcard 이스케이프) */
export function postgrestIlikeQuoted(term: string): string {
  const p = `%${term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')}%`
  return `"${qIdent(p)}"`
}

export function postgrestEqQuoted(val: string): string {
  return `"${qIdent(val)}"`
}

export function collectPostgrestIds(rows: unknown): string[] {
  if (!Array.isArray(rows)) return []
  const out: string[] = []
  for (const r of rows) {
    if (r && typeof r === 'object' && 'id' in r) {
      const id = (r as { id: string }).id
      if (id) out.push(id)
    }
  }
  return [...new Set(out)]
}

export async function safeSelectPaymentMethodIds(
  supabase: SupabaseClient,
  q: string,
  logLabel = 'payment_methods'
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('id')
      .or(`method.ilike.${q},display_name.ilike.${q},id.ilike.${q}`)
      .limit(200)
    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[search] ${logLabel} lookup skipped:`, error.message || error)
      }
      return []
    }
    return collectPostgrestIds(data).slice(0, 200)
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[search] ${logLabel} lookup failed:`, e)
    }
    return []
  }
}

/** 지정 컬럼 ilike OR + id eq(긴 검색어) / ilike */
export function buildTextColumnSearchParts(
  columns: string[],
  raw: string,
  opts?: { idEqMinLen?: number }
): string[] {
  const q = postgrestIlikeQuoted(raw)
  const parts = columns.map((col) => `${col}.ilike.${q}`)
  const minLen = opts?.idEqMinLen ?? 8
  if (raw.length >= minLen && !/\s/.test(raw)) {
    parts.unshift(`id.eq.${postgrestEqQuoted(raw)}`)
  } else {
    parts.push(`id.ilike.${q}`)
  }
  return parts
}
