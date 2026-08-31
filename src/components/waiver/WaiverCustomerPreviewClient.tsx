'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import WaiverSigningClient from '@/components/waiver/WaiverSigningClient'
import { WAIVER_PREVIEW_DRAFT_KEY, type WaiverPreviewDraft } from '@/lib/waiver/previewDraft'
import { isConfiguredWaiverCode } from '@/lib/waiver/types'
import type { WaiverDocumentCode, WaiverDocumentContent, WaiverLocale } from '@/lib/waiver/types'
import { normalizeWaiverLocale } from '@/lib/waiver/locales'

type PreviewDoc = {
  code: string
  status: string
  requiredForSigning: boolean
  displayName: string
  operatorName: string
  content: WaiverDocumentContent | null
}

function mockSession(docs: PreviewDoc[], isKo: boolean) {
  const required = docs.filter((d) => d.requiredForSigning).length
  const participants = [
    { id: 'preview-guest-1', slotIndex: 0, label: isKo ? '게스트 1' : 'Guest 1', type: 'ADULT' as const, signed: false, completedCount: 0, requiredCount: required },
    { id: 'preview-guest-2', slotIndex: 1, label: isKo ? '게스트 2' : 'Guest 2', type: 'ADULT' as const, signed: false, completedCount: 0, requiredCount: required },
    { id: 'preview-guest-3', slotIndex: 2, label: isKo ? '게스트 3 (미성년)' : 'Guest 3 (minor)', type: 'MINOR' as const, signed: false, completedCount: 0, requiredCount: required },
  ]
  return {
    bookingNumber: 'BR-PREVIEW',
    tourDate: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }),
    tourName: isKo ? '미리보기 투어' : 'Preview tour',
    guestCount: 3,
    requiredWaivers: docs.map((d) => ({ code: d.code, status: d.status, requiredForSigning: d.requiredForSigning })),
    participants,
    completedCount: 0,
    requiredCount: required,
  }
}

function pickContent(
  contents: Partial<Record<WaiverLocale, WaiverDocumentContent>> | undefined,
  lang: WaiverLocale
) {
  if (!contents) return null
  return contents[lang] ?? contents.en ?? null
}

export default function WaiverCustomerPreviewClient() {
  const params = useParams()
  const search = useSearchParams()
  const locale = String(params.locale ?? 'ko')
  const isKo = locale.startsWith('ko')
  const source = search.get('source') === 'draft' ? 'draft' : 'live'
  const docsQuery = search.get('docs') || 'LAS_VEGAS_MANIA'
  const requestedCodes = useMemo(() => {
    const codes = docsQuery
      .split(',')
      .map((v) => v.trim())
      .filter(isConfiguredWaiverCode)
    return codes.length ? codes : (['LAS_VEGAS_MANIA'] as WaiverDocumentCode[])
  }, [docsQuery])
  const [lang, setLang] = useState<WaiverLocale>(normalizeWaiverLocale(locale))
  const [draft, setDraft] = useState<WaiverPreviewDraft | null>(null)
  const [liveByCode, setLiveByCode] = useState<
    Partial<Record<WaiverDocumentCode, { displayName: string; operatorName: string; status: string; contents: Partial<Record<WaiverLocale, WaiverDocumentContent>> }>>
  >({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (source !== 'draft') return
    try {
      const raw = sessionStorage.getItem(WAIVER_PREVIEW_DRAFT_KEY)
      setDraft(raw ? (JSON.parse(raw) as WaiverPreviewDraft) : null)
    } catch {
      setDraft(null)
    }
  }, [source])

  const loadLive = useCallback(async () => {
    if (source !== 'live') return
    const entries = await Promise.all(
      requestedCodes.map(async (code) => {
        const res = await fetch(`/api/admin/waivers/documents?code=${encodeURIComponent(code)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'load failed')
        return [
          code,
          {
            displayName: data.document.displayName as string,
            operatorName: data.document.operatorName as string,
            status: data.document.status as string,
            contents: data.contents as Partial<Record<WaiverLocale, WaiverDocumentContent>>,
          },
        ] as const
      })
    )
    setLiveByCode(Object.fromEntries(entries))
  }, [requestedCodes, source])

  useEffect(() => {
    void loadLive().catch(() => setError(isKo ? '미리보기를 불러오지 못했습니다' : 'Could not load preview'))
  }, [isKo, loadLive])

  const documents = useMemo(() => {
    const codes = source === 'draft' ? draft?.codes ?? requestedCodes : requestedCodes
    return codes.map((code) => {
      if (source === 'draft' && draft) {
        const content = pickContent(draft.contentsByCode[code], lang)
        return {
          code,
          status: content ? 'ACTIVE' : 'NOT_CONFIGURED',
          requiredForSigning: Boolean(content),
          displayName: draft.displayNames[code] || code,
          operatorName: draft.operatorNames[code] || '',
          content,
        }
      }
      const live = liveByCode[code]
      const content = pickContent(live?.contents, lang)
      return {
        code,
        status: live?.status || 'NOT_CONFIGURED',
        requiredForSigning: live?.status === 'ACTIVE',
        displayName: live?.displayName || code,
        operatorName: live?.operatorName || '',
        content,
      }
    })
  }, [draft, lang, liveByCode, requestedCodes, source])

  const session = useMemo(() => mockSession(documents, isKo), [documents, isKo])

  if (error) {
    return <p className="p-8 text-center text-muted-foreground">{error}</p>
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="no-print flex items-center justify-between gap-3 border-b bg-white px-4 py-3">
        <p className="text-sm font-medium">
          {isKo ? '고객 화면 미리보기' : 'Customer page preview'}
          {source === 'draft' ? (isKo ? ' · 작성 중' : ' · draft') : isKo ? ' · 현재 발행본' : ' · live'}
        </p>
        <Link href={`/${locale}/admin/waivers/documents`} className="text-sm text-muted-foreground">
          {isKo ? '문서 관리로' : 'Back to documents'}
        </Link>
      </div>
      <WaiverSigningClient
        preview
        initialLang={lang}
        previewSession={session}
        previewDocuments={documents}
        onPreviewLangChange={setLang}
      />
    </div>
  )
}
