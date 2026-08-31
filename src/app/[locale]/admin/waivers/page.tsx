'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

type Row = {
  reservationId: string
  bookingNumber: string
  tourDate: string
  tourName: string
  guestCount: number
  required: string[]
  docTotals: Record<string, number>
  completeGuests: number
  overall: string
  participants: Array<{ id: string; name: string; complete: boolean; perDoc: Record<string, boolean> }>
}

export default function AdminWaiversPage() {
  const params = useParams()
  const locale = String(params.locale ?? 'ko')
  const isKo = locale.startsWith('ko')
  const [q, setQ] = useState('')
  const [tourDate, setTourDate] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (opts?: { today?: boolean }) => {
    setLoading(true)
    const sp = new URLSearchParams()
    if (opts?.today) sp.set('today', '1')
    if (q) sp.set('q', q)
    if (tourDate && !opts?.today) sp.set('tourDate', tourDate)
    const res = await fetch(`/api/admin/waivers?${sp.toString()}`)
    const data = await res.json()
    setRows(data.rows ?? [])
    setLoading(false)
  }, [q, tourDate])

  useEffect(() => {
    void load({ today: true })
    // Initial operational view only — search is explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function copyLink(reservationId: string) {
    const res = await fetch('/api/admin/waivers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'copy-link', reservationId }),
    })
    const data = await res.json()
    if (!res.ok || !data.url) {
      toast.error(data.error || (isKo ? '링크를 만들 수 없습니다' : 'Could not create link'))
      return
    }
    await navigator.clipboard.writeText(data.url)
    toast.success(
      isKo
        ? '면책 동의 링크를 복사했습니다. 이전에 공유한 링크는 더 이상 사용할 수 없습니다.'
        : 'Waiver link copied. Previously shared links no longer work.'
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{isKo ? '면책 동의' : 'Waivers'}</h1>
          <p className="mt-1 text-muted-foreground">
            {isKo ? '참가자별 서명 현황 · 투어 출발 전 확인' : 'Per-participant signing status before departure'}
          </p>
        </div>
        <Button variant="outline" className="h-11 rounded-xl" onClick={() => void load({ today: true })}>
          {isKo ? '오늘의 투어' : "Today's tours"}
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-xl">
          <Link href={`/${locale}/admin/waivers/documents`}>{isKo ? '문서 수정' : 'Edit documents'}</Link>
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-xl">
          <Link href={`/${locale}/admin/waivers/documents/preview?source=live&docs=LAS_VEGAS_MANIA,ANTELOPE_CANYON_X`} target="_blank">
            {isKo ? '고객 화면 미리보기' : 'Preview customer page'}
          </Link>
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="h-12 rounded-lg pl-9"
            placeholder={isKo ? '예약번호 · 참가자 이름' : 'Booking number · participant name'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Input type="date" className="h-12 w-[180px] rounded-lg" value={tourDate} onChange={(e) => setTourDate(e.target.value)} />
        <Button className="h-12 rounded-xl" onClick={() => void load()}>
          {isKo ? '검색' : 'Search'}
        </Button>
      </div>

      {loading ? <p className="text-muted-foreground">{isKo ? '불러오는 중…' : 'Loading…'}</p> : null}

      <div className="space-y-4">
        {rows.map((row) => (
          <article key={row.reservationId} className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{row.tourDate}</p>
                <h2 className="text-lg font-semibold tracking-tight">{row.bookingNumber}</h2>
                <p className="text-sm text-muted-foreground">
                  {row.tourName} · {row.guestCount} {isKo ? '명' : 'guests'}
                </p>
              </div>
              <span
                className={`rounded-lg px-3 py-1 text-sm font-medium ${
                  row.overall === 'COMPLETE' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
                }`}
              >
                {row.overall === 'COMPLETE' ? (isKo ? '완료' : 'COMPLETE') : (isKo ? '미완료' : 'INCOMPLETE')}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              {row.required.map((code) => (
                <span key={code}>
                  {code.replaceAll('_', ' ')}: {row.docTotals[code] ?? 0} / {row.guestCount}
                </span>
              ))}
              <span>
                {isKo ? '전체' : 'Overall'}: {row.completeGuests} / {row.guestCount}
              </span>
            </div>
            <ul className="mt-4 space-y-2">
              {row.participants.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{p.name}</span>
                  <span className={p.complete ? 'text-emerald-700' : 'font-medium text-amber-800'}>
                    {p.complete ? (isKo ? '준비됨' : 'READY') : (isKo ? '서명 필요' : 'WAIVER REQUIRED')}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild variant="outline" className="h-11 rounded-xl">
                <Link href={`/${locale}/admin/waivers/${row.reservationId}`}>{isKo ? '상세' : 'View'}</Link>
              </Button>
              <Button variant="outline" className="h-11 rounded-xl" onClick={() => void copyLink(row.reservationId)}>
                {isKo ? '링크 복사' : 'Copy waiver link'}
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-xl">
                <Link href={`/${locale}/admin/waivers/${row.reservationId}/print?packet=canyon-x`} target="_blank">
                  {isKo ? '캐년 X 양식 인쇄' : 'Print Canyon X form'}
                </Link>
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
