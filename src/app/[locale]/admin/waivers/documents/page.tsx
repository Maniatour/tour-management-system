'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'

type DocRow = {
  code: string
  displayName: string
  operatorName: string
  status: string
  currentVersion: string | null
  versionCount: number
}

export default function AdminWaiverDocumentsPage() {
  const params = useParams()
  const locale = String(params.locale ?? 'ko')
  const isKo = locale.startsWith('ko')
  const [rows, setRows] = useState<DocRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetch('/api/admin/waivers/documents')
      .then((r) => r.json())
      .then((data) => setRows(data.documents ?? []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link href={`/${locale}/admin/waivers`} className="text-sm text-muted-foreground">
        ← {isKo ? '서명 현황' : 'Signing status'}
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        {isKo ? '면책 문서 버전' : 'Waiver document versions'}
      </h1>
      <p className="mt-1 text-muted-foreground">
        {isKo
          ? '이미 서명된 기록은 그대로 두고, 수정 내용은 새 버전으로만 발행됩니다.'
          : 'Signed records stay frozen. Edits are published as a new version only.'}
      </p>

      {loading ? <p className="mt-8 text-muted-foreground">{isKo ? '불러오는 중…' : 'Loading…'}</p> : null}

      <div className="mt-8 space-y-4">
        {rows.map((row) => (
          <article key={row.code} className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">{row.displayName}</h2>
                <p className="text-sm text-muted-foreground">
                  {row.operatorName || (row.status === 'NOT_CONFIGURED' ? (isKo ? '미설정' : 'Not configured') : '')}
                </p>
                <p className="mt-2 text-sm">
                  {row.status} · {row.currentVersion || (isKo ? '버전 없음' : 'No version')} · {row.versionCount}{' '}
                  {isKo ? '개 버전' : 'versions'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild className="h-11 rounded-xl">
                  <Link href={`/${locale}/admin/waivers/documents/${row.code}`}>{isKo ? '수정 · 새 버전' : 'Edit · new version'}</Link>
                </Button>
                <Button asChild variant="outline" className="h-11 rounded-xl">
                  <Link href={`/${locale}/admin/waivers/documents/preview?source=live&docs=${row.code}`} target="_blank">
                    {isKo ? '고객 화면' : 'Customer preview'}
                  </Link>
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-8">
        <Button asChild variant="outline" className="h-11 rounded-xl">
          <Link
            href={`/${locale}/admin/waivers/documents/preview?source=live&docs=LAS_VEGAS_MANIA,ANTELOPE_CANYON_X`}
            target="_blank"
          >
            {isKo ? 'Mania + Canyon X 고객 화면' : 'Preview Mania + Canyon X'}
          </Link>
        </Button>
      </div>
    </div>
  )
}
