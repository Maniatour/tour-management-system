import { supabaseAdmin } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import {
  WAIVER_DOCUMENT_CATALOG,
  getGoverningWaiverContent,
  getWaiverContent,
  getWaiverDefinition,
} from '@/lib/waiver/documents/catalog'
import { parseWaiverSnapshot } from '@/lib/waiver/snapshot'
import type {
  WaiverDocumentCode,
  WaiverDocumentContent,
  WaiverDocumentStatus,
  WaiverLocale,
  WaiverSignatureMode,
} from '@/lib/waiver/types'
import { isWaiverLocale } from '@/lib/waiver/locales'

export type LiveWaiverDocumentMeta = {
  code: WaiverDocumentCode
  operatorName: string
  displayName: string
  status: WaiverDocumentStatus
  signatureMode: WaiverSignatureMode
  currentVersion: string | null
}

type VersionRow = {
  version: string
  governing_text: string
  translations: unknown
  is_current: boolean
}

function catalogMeta(code: WaiverDocumentCode): LiveWaiverDocumentMeta {
  const def = getWaiverDefinition(code)
  return {
    code: def.code,
    operatorName: def.operatorName,
    displayName: def.displayName,
    status: def.status,
    signatureMode: def.signatureMode,
    currentVersion: def.currentVersion,
  }
}

function parseTranslations(raw: unknown): Partial<Record<WaiverLocale, WaiverDocumentContent>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Partial<Record<WaiverLocale, WaiverDocumentContent>> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isWaiverLocale(key)) continue
    if (typeof value === 'string') {
      const parsed = parseWaiverSnapshot(value)
      if (parsed) out[key] = parsed
      continue
    }
    if (value && typeof value === 'object' && 'sections' in (value as object)) {
      const parsed = value as WaiverDocumentContent
      if (parsed.code && parsed.version && Array.isArray(parsed.sections)) out[key] = parsed
    }
  }
  return out
}

export function contentsFromVersionRow(row: VersionRow): Partial<Record<WaiverLocale, WaiverDocumentContent>> {
  const governing = parseWaiverSnapshot(row.governing_text)
  const translations = parseTranslations(row.translations)
  const contents: Partial<Record<WaiverLocale, WaiverDocumentContent>> = { ...translations }
  if (governing) contents.en = governing
  return contents
}

export async function loadCurrentVersionRow(code: WaiverDocumentCode): Promise<VersionRow | null> {
  if (!supabaseAdmin) return null
  const { data } = await fromUntypedTable(supabaseAdmin, 'waiver_document_versions')
    .select('version, governing_text, translations, is_current')
    .eq('document_code', code)
    .eq('is_current', true)
    .maybeSingle()
  return (data as VersionRow | null) ?? null
}

export async function loadLiveWaiverMeta(code: WaiverDocumentCode): Promise<LiveWaiverDocumentMeta> {
  const fallback = catalogMeta(code)
  if (!supabaseAdmin) return fallback
  const { data } = await fromUntypedTable(supabaseAdmin, 'waiver_documents')
    .select('code, operator_name, display_name, status, signature_mode')
    .eq('code', code)
    .maybeSingle()
  if (!data) return fallback
  const current = await loadCurrentVersionRow(code)
  return {
    code,
    operatorName: data.operator_name || fallback.operatorName,
    displayName: data.display_name || fallback.displayName,
    status: data.status === 'ACTIVE' || data.status === 'NOT_CONFIGURED' ? data.status : fallback.status,
    signatureMode:
      data.signature_mode === 'SEPARATE_SIGNATURE_REQUIRED' || data.signature_mode === 'SHARED_SESSION_SIGNATURE'
        ? data.signature_mode
        : fallback.signatureMode,
    currentVersion: current?.version ?? fallback.currentVersion,
  }
}

export async function loadLiveWaiverContents(
  code: WaiverDocumentCode
): Promise<Partial<Record<WaiverLocale, WaiverDocumentContent>>> {
  const row = await loadCurrentVersionRow(code)
  if (row) {
    const fromDb = contentsFromVersionRow(row)
    if (fromDb.en) return fromDb
  }
  return WAIVER_DOCUMENT_CATALOG[code].contents
}

export async function getLiveWaiverContent(
  code: WaiverDocumentCode,
  locale: WaiverLocale
): Promise<WaiverDocumentContent | null> {
  const meta = await loadLiveWaiverMeta(code)
  if (meta.status === 'NOT_CONFIGURED') return null
  const contents = await loadLiveWaiverContents(code)
  return contents[locale] ?? contents.en ?? getWaiverContent(code, locale)
}

export async function getLiveGoverningWaiverContent(
  code: WaiverDocumentCode
): Promise<WaiverDocumentContent | null> {
  const meta = await loadLiveWaiverMeta(code)
  if (meta.status === 'NOT_CONFIGURED') return null
  const contents = await loadLiveWaiverContents(code)
  return contents.en ?? getGoverningWaiverContent(code)
}

export async function loadAllDocumentStatusMap(): Promise<
  Map<WaiverDocumentCode, Pick<LiveWaiverDocumentMeta, 'status' | 'signatureMode' | 'operatorName' | 'displayName'>>
> {
  const map = new Map<
    WaiverDocumentCode,
    Pick<LiveWaiverDocumentMeta, 'status' | 'signatureMode' | 'operatorName' | 'displayName'>
  >()
  for (const code of Object.keys(WAIVER_DOCUMENT_CATALOG) as WaiverDocumentCode[]) {
    const def = catalogMeta(code)
    map.set(code, {
      status: def.status,
      signatureMode: def.signatureMode,
      operatorName: def.operatorName,
      displayName: def.displayName,
    })
  }
  if (!supabaseAdmin) return map
  const { data } = await fromUntypedTable(supabaseAdmin, 'waiver_documents').select(
    'code, operator_name, display_name, status, signature_mode'
  )
  for (const row of data ?? []) {
    const code = row.code as WaiverDocumentCode
    if (!map.has(code)) continue
    map.set(code, {
      status: row.status === 'ACTIVE' || row.status === 'NOT_CONFIGURED' ? row.status : map.get(code)!.status,
      signatureMode:
        row.signature_mode === 'SEPARATE_SIGNATURE_REQUIRED' || row.signature_mode === 'SHARED_SESSION_SIGNATURE'
          ? row.signature_mode
          : map.get(code)!.signatureMode,
      operatorName: row.operator_name || map.get(code)!.operatorName,
      displayName: row.display_name || map.get(code)!.displayName,
    })
  }
  return map
}
