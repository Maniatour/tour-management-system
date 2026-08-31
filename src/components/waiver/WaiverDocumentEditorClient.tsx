'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import WaiverContentLanguageEditor from '@/components/waiver/WaiverContentLanguageEditor'
import { emptyWaiverContent } from '@/lib/waiver/documentEditor'
import { WAIVER_PREVIEW_DRAFT_KEY, type WaiverPreviewDraft } from '@/lib/waiver/previewDraft'
import { WAIVER_LOCALE_LABELS } from '@/lib/waiver/locales'
import {
  WAIVER_LOCALES,
  type WaiverDocumentCode,
  type WaiverDocumentContent,
  type WaiverLocale,
} from '@/lib/waiver/types'

type VersionRow = {
  id: string
  version: string
  effectiveDate: string
  hash: string
  isCurrent: boolean
  createdAt: string
}

export default function WaiverDocumentEditorClient({ code }: { code: WaiverDocumentCode }) {
  const params = useParams()
  const router = useRouter()
  const locale = String(params.locale ?? 'ko')
  const isKo = locale.startsWith('ko')
  const [lang, setLang] = useState<WaiverLocale>('en')
  const [displayName, setDisplayName] = useState('')
  const [operatorName, setOperatorName] = useState('')
  const [status, setStatus] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [version, setVersion] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [contents, setContents] = useState<Partial<Record<WaiverLocale, WaiverDocumentContent>>>({})
  const [versions, setVersions] = useState<VersionRow[]>([])
  const [confirmOfficial, setConfirmOfficial] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (selectedVersion?: string) => {
    setLoading(true)
    const sp = new URLSearchParams({ code })
    if (selectedVersion) sp.set('version', selectedVersion)
    const res = await fetch(`/api/admin/waivers/documents?${sp.toString()}`)
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || (isKo ? '불러오지 못했습니다' : 'Could not load document'))
      setLoading(false)
      return
    }
    setDisplayName(data.document.displayName ?? '')
    setOperatorName(data.document.operatorName ?? '')
    setStatus(data.document.status ?? '')
    setSourceType(data.document.sourceType ?? '')
    setVersion(data.suggestedVersion ?? '')
    setEffectiveDate(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }))
    setContents(data.contents ?? {})
    setVersions(data.versions ?? [])
    setConfirmOfficial(false)
    setLoading(false)
  }, [code, isKo])

  useEffect(() => {
    void load()
  }, [load])

  const current = useMemo(() => {
    return contents[lang] ?? emptyWaiverContent(code, lang)
  }, [code, contents, lang])

  function updateCurrent(next: WaiverDocumentContent) {
    setContents((prev) => ({ ...prev, [lang]: next }))
  }

  function openPreview(source: 'draft' | 'live') {
    if (source === 'draft') {
      const draft: WaiverPreviewDraft = {
        codes: [code],
        contentsByCode: { [code]: contents },
        displayNames: { [code]: displayName },
        operatorNames: { [code]: operatorName },
      }
      sessionStorage.setItem(WAIVER_PREVIEW_DRAFT_KEY, JSON.stringify(draft))
    }
    const url = `/${locale}/admin/waivers/documents/preview?${new URLSearchParams({
      source,
      docs: code,
    }).toString()}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function publish() {
    setSaving(true)
    const res = await fetch('/api/admin/waivers/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'publish',
        code,
        version,
        effectiveDate,
        displayName,
        operatorName,
        contents,
        confirmOfficialOperator: confirmOfficial,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      toast.error(data.error || (isKo ? '발행하지 못했습니다' : 'Could not publish'))
      return
    }
    toast.success(isKo ? `새 버전 ${data.version}을 발행했습니다` : `Published version ${data.version}`)
    void load()
  }

  if (loading) {
    return <p className="p-8 text-muted-foreground">{isKo ? '불러오는 중…' : 'Loading…'}</p>
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link href={`/${locale}/admin/waivers/documents`} className="text-sm text-muted-foreground">
        ← {isKo ? '문서 목록' : 'Documents'}
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{displayName || code}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {code} · {status} · {isKo ? '현재 버전을 고치지 않고 새 버전만 발행합니다' : 'Existing versions stay frozen. Publish a new version.'}
      </p>

      {sourceType === 'OFFICIAL_OPERATOR_FORM' ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {isKo
            ? '타사 공식 양식입니다. 운영자가 새 원문을 제공한 경우에만 수정하세요. 내용을 임의로 다시 쓰지 마세요.'
            : 'This is an official third-party form. Update only when the operator provides a new original. Do not rewrite it.'}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="display-name">
            {isKo ? '표시 이름' : 'Display name'}
          </label>
          <Input id="display-name" className="h-11 rounded-lg" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="operator-name">
            {isKo ? '운영자' : 'Operator'}
          </label>
          <Input id="operator-name" className="h-11 rounded-lg" value={operatorName} onChange={(e) => setOperatorName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="new-version">
            {isKo ? '새 버전' : 'New version'}
          </label>
          <Input id="new-version" className="h-11 rounded-lg" value={version} onChange={(e) => setVersion(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="effective-date">
            {isKo ? '효력 발생일' : 'Effective date'}
          </label>
          <Input id="effective-date" type="date" className="h-11 rounded-lg" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {WAIVER_LOCALES.map((item) => (
          <Button key={item} type="button" variant={lang === item ? 'default' : 'outline'} className="h-10 rounded-lg" onClick={() => setLang(item)}>
            {WAIVER_LOCALE_LABELS[item]}
            {item === 'en' ? (isKo ? ' (원문)' : ' (governing)') : ''}
          </Button>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-white p-6">
        <WaiverContentLanguageEditor content={current} onChange={updateCurrent} isKo={isKo} />
      </div>

      {code === 'ANTELOPE_CANYON_X' ? (
        <label className="mt-6 flex items-start gap-3 text-sm">
          <Checkbox checked={confirmOfficial} onCheckedChange={(v) => setConfirmOfficial(v === true)} />
          <span>
            {isKo
              ? '이 텍스트가 Taadidiin Tours의 공식 영문 양식과 일치함을 확인합니다.'
              : 'I confirm this text matches the official Taadidiin Tours English form.'}
          </span>
        </label>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button className="h-11 rounded-xl" disabled={saving} onClick={() => void publish()}>
          {saving ? (isKo ? '발행 중…' : 'Publishing…') : isKo ? '새 버전 발행' : 'Publish new version'}
        </Button>
        <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => openPreview('draft')}>
          {isKo ? '작성 중 미리보기' : 'Preview draft'}
        </Button>
        <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => openPreview('live')}>
          {isKo ? '현재 고객 화면' : 'Preview live page'}
        </Button>
        <Button type="button" variant="ghost" className="h-11 rounded-xl" onClick={() => router.push(`/${locale}/admin/waivers`)}>
          {isKo ? '서명 현황' : 'Signing status'}
        </Button>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">{isKo ? '이전 버전' : 'Previous versions'}</h2>
        <ul className="mt-4 space-y-2">
          {versions.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-white px-4 py-3 text-sm">
              <span>
                {row.version} {row.isCurrent ? (isKo ? '(현재)' : '(current)') : ''} · {row.effectiveDate}
              </span>
              <Button type="button" variant="outline" className="h-10 rounded-lg" onClick={() => void load(row.version)}>
                {isKo ? '이 버전으로 편집 시작' : 'Start from this version'}
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
