import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { supabaseAdmin } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { WAIVER_DOCUMENT_CATALOG } from '@/lib/waiver/documents/catalog'
import {
  contentsFromVersionRow,
  loadCurrentVersionRow,
  loadLiveWaiverContents,
  loadLiveWaiverMeta,
} from '@/lib/waiver/liveContent'
import {
  editorContentsFromCatalog,
  isValidWaiverVersionLabel,
  normalizeWaiverContent,
  suggestedWaiverVersion,
  validateGoverningWaiverContent,
} from '@/lib/waiver/documentEditor'
import { hashWaiverContent } from '@/lib/waiver/hash'
import { serializeWaiverSnapshot } from '@/lib/waiver/snapshot'
import { isConfiguredWaiverCode, WAIVER_LOCALES, type WaiverDocumentCode, type WaiverDocumentContent, type WaiverLocale } from '@/lib/waiver/types'
import { ensureCurrentWaiverVersions } from '@/lib/waiver/service'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response
  if (!supabaseAdmin) return NextResponse.json({ error: 'Server not configured' }, { status: 503 })
  const admin = supabaseAdmin

  await ensureCurrentWaiverVersions()

  const codeParam = request.nextUrl.searchParams.get('code')
  const versionParam = request.nextUrl.searchParams.get('version')

  if (codeParam) {
    if (!isConfiguredWaiverCode(codeParam)) {
      return NextResponse.json({ error: 'Unknown document' }, { status: 400 })
    }
    const meta = await loadLiveWaiverMeta(codeParam)
    const { data: versions } = await fromUntypedTable(admin, 'waiver_document_versions')
      .select('id, version, effective_date, governing_text_hash, is_current, created_at, governing_text, translations')
      .eq('document_code', codeParam)
      .order('created_at', { ascending: false })

    const versionRows = versions ?? []
    const selected = versionParam
      ? versionRows.find((row: { version: string }) => row.version === versionParam)
      : versionRows.find((row: { is_current: boolean }) => row.is_current) ?? versionRows[0]

    let contents = editorContentsFromCatalog(codeParam)
    if (selected) {
      const fromRow = contentsFromVersionRow(selected)
      contents = { ...contents, ...fromRow }
    } else {
      contents = { ...contents, ...(await loadLiveWaiverContents(codeParam)) }
    }

    return NextResponse.json({
      document: {
        ...meta,
        sourceType: WAIVER_DOCUMENT_CATALOG[codeParam].sourceType,
      },
      suggestedVersion: suggestedWaiverVersion(versionRows.map((row: { version: string }) => row.version)),
      currentVersion: versionRows.find((row: { is_current: boolean }) => row.is_current)?.version ?? meta.currentVersion,
      contents,
      selectedVersion: selected?.version ?? null,
      versions: versionRows.map((row: {
        id: string
        version: string
        effective_date: string
        governing_text_hash: string
        is_current: boolean
        created_at: string
      }) => ({
        id: row.id,
        version: row.version,
        effectiveDate: row.effective_date,
        hash: row.governing_text_hash,
        isCurrent: row.is_current,
        createdAt: row.created_at,
      })),
    })
  }

  const documents = await Promise.all(
    (Object.keys(WAIVER_DOCUMENT_CATALOG) as WaiverDocumentCode[]).map(async (code) => {
      const meta = await loadLiveWaiverMeta(code)
      const current = await loadCurrentVersionRow(code)
      const { data: versionIds } = await fromUntypedTable(admin, 'waiver_document_versions')
        .select('id')
        .eq('document_code', code)
      return {
        ...meta,
        currentVersion: current?.version ?? meta.currentVersion,
        versionCount: versionIds?.length ?? 0,
      }
    })
  )

  return NextResponse.json({ documents })
}

export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response
  if (!supabaseAdmin) return NextResponse.json({ error: 'Server not configured' }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const action = String(body.action ?? 'publish')
  if (action !== 'publish') return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  const code = String(body.code ?? '')
  if (!isConfiguredWaiverCode(code)) return NextResponse.json({ error: 'Unknown document' }, { status: 400 })

  const version = String(body.version ?? '').trim()
  if (!isValidWaiverVersionLabel(version)) {
    return NextResponse.json({ error: 'Enter a version like 2026-08-31-v2' }, { status: 400 })
  }

  const effectiveDate = String(body.effectiveDate ?? '').trim() || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
    return NextResponse.json({ error: 'effectiveDate must be YYYY-MM-DD' }, { status: 400 })
  }

  const displayName = String(body.displayName ?? '').trim()
  const operatorName = String(body.operatorName ?? '').trim()
  const rawContents = (body.contents ?? {}) as Partial<Record<WaiverLocale, WaiverDocumentContent>>
  const englishRaw = rawContents.en
  if (!englishRaw) return NextResponse.json({ error: 'English governing text is required' }, { status: 400 })

  const english = normalizeWaiverContent(code, version, operatorName, englishRaw)
  const invalid = validateGoverningWaiverContent(english)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  if (code === 'ANTELOPE_CANYON_X' && body.confirmOfficialOperator !== true) {
    return NextResponse.json(
      { error: 'Confirm that this text matches the official Taadidiin Tours form' },
      { status: 400 }
    )
  }

  const translations: Partial<Record<WaiverLocale, WaiverDocumentContent>> = {}
  for (const locale of WAIVER_LOCALES) {
    if (locale === 'en') continue
    const raw = rawContents[locale]
    if (!raw) continue
    const normalized = normalizeWaiverContent(code, version, operatorName || english.operatorName, raw)
    if (!normalized.title && !normalized.sections.length) continue
    translations[locale] = normalized
  }

  const { data: duplicate } = await fromUntypedTable(supabaseAdmin, 'waiver_document_versions')
    .select('id')
    .eq('document_code', code)
    .eq('version', version)
    .maybeSingle()
  if (duplicate) return NextResponse.json({ error: 'That version already exists. Use a new version label.' }, { status: 409 })

  const hash = hashWaiverContent(english)
  await fromUntypedTable(supabaseAdmin, 'waiver_document_versions').update({ is_current: false }).eq('document_code', code)
  const { data: inserted, error } = await fromUntypedTable(supabaseAdmin, 'waiver_document_versions')
    .insert({
      document_code: code,
      version,
      effective_date: effectiveDate,
      governing_text: serializeWaiverSnapshot(english),
      governing_text_hash: hash,
      translations,
      is_current: true,
    })
    .select('id, version')
    .single()
  if (error || !inserted) {
    return NextResponse.json({ error: error?.message || 'Could not publish version' }, { status: 500 })
  }

  const catalog = WAIVER_DOCUMENT_CATALOG[code]
  await fromUntypedTable(supabaseAdmin, 'waiver_documents')
    .update({
      operator_name: operatorName || catalog.operatorName,
      display_name: displayName || catalog.displayName,
      status: 'ACTIVE',
      updated_at: new Date().toISOString(),
    })
    .eq('code', code)

  await fromUntypedTable(supabaseAdmin, 'waiver_audit_events').insert({
    event_type: 'DOCUMENT_VERSION_PUBLISHED',
    actor_type: 'staff',
    actor_id: auth.userEmail,
    metadata: { documentCode: code, version, hash },
  })

  return NextResponse.json({ ok: true, version, hash, id: inserted.id })
}
