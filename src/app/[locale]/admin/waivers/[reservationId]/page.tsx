'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import WaiverGuideSignatureForm from '@/components/waiver/WaiverGuideSignatureForm'

type Row = {
  reservationId: string
  bookingNumber: string
  tourDate: string
  tourName: string
  guestCount: number
  required: string[]
  overall: string
  completeGuests: number
  participants: Array<{ id: string; name: string; complete: boolean; perDoc: Record<string, boolean> }>
}

export default function AdminWaiverDetailPage() {
  const params = useParams()
  const locale = String(params.locale ?? 'ko')
  const reservationId = String(params.reservationId ?? '')
  const isKo = locale.startsWith('ko')
  const [row, setRow] = useState<Row | null>(null)
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/waivers?reservationId=${encodeURIComponent(reservationId)}`)
    const data = await res.json()
    setRow(data.rows?.[0] ?? null)
  }, [reservationId])

  useEffect(() => {
    void load()
  }, [load])

  async function copyLink() {
    const res = await fetch('/api/admin/waivers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'copy-link', reservationId }),
    })
    const data = await res.json()
    if (data.url) {
      await navigator.clipboard.writeText(data.url)
      toast.success(isKo ? '링크를 복사했습니다' : 'Link copied')
    }
  }

  async function reissue(participantId: string) {
    const res = await fetch('/api/admin/waivers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reissue',
        participantId,
        reason: reason.trim() || 'Reissued by staff',
      }),
    })
    if (res.ok) {
      toast.success(isKo ? '재발행했습니다' : 'Reissued')
      void load()
    }
  }

  if (!row) {
    return <div className="p-8 text-muted-foreground">{isKo ? '불러오는 중…' : 'Loading…'}</div>
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link href={`/${locale}/admin/waivers`} className="text-sm text-muted-foreground">
        ← {isKo ? '목록' : 'Back'}
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{row.bookingNumber}</h1>
      <p className="mt-1 text-muted-foreground">
        {row.tourName} · {row.tourDate} · {row.guestCount} {isKo ? '명' : 'guests'}
      </p>
      <p className="mt-2 font-medium">{row.overall === 'COMPLETE' ? (isKo ? '투어 준비 완료' : 'READY FOR TOUR') : (isKo ? '미완료' : 'INCOMPLETE')}</p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button className="h-11 rounded-xl" onClick={() => void copyLink()}>
          {isKo ? '서명 링크 복사' : 'Copy waiver link'}
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-xl">
          <Link href={`/${locale}/admin/waivers/${reservationId}/print?packet=full`} target="_blank">
            {isKo ? '전체 패킷 인쇄' : 'Print full packet'}
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-xl">
          <Link href={`/${locale}/admin/waivers/${reservationId}/print?packet=canyon-x`} target="_blank">
            {isKo ? '캐년 X 운영자 패킷' : 'Canyon X operator packet'}
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-xl">
          <Link href={`/${locale}/admin/waivers/${reservationId}/print?packet=mania`} target="_blank">
            {isKo ? '마니아 면책만' : 'Mania waivers only'}
          </Link>
        </Button>
      </div>

      <div className="mt-8 space-y-3">
        {row.participants.map((p) => (
          <div key={p.id} className="rounded-xl border border-border bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{p.name}</p>
              <span className={p.complete ? 'text-emerald-700' : 'text-amber-800'}>
                {p.complete ? (isKo ? '준비됨' : 'READY') : (isKo ? '조치 필요' : 'ACTION REQUIRED')}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
              {row.required.map((code) => (
                <span key={code}>
                  {code.replaceAll('_', ' ')} {p.perDoc[code] ? '✓' : '✕'}
                </span>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" className="h-11 rounded-lg" onClick={() => void reissue(p.id)}>
                {isKo ? '무효 후 재발행' : 'Void & reissue'}
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-lg">
                <Link
                  href={`/${locale}/admin/waivers/${reservationId}/print?packet=individual&participantId=${p.id}`}
                  target="_blank"
                >
                  {isKo ? '개인 면책 인쇄' : 'Print individual waiver'}
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 max-w-md space-y-2">
        <label htmlFor="void-reason" className="text-sm font-medium">
          {isKo ? '재발행 사유 (감사 기록)' : 'Reissue reason (audit)'}
        </label>
        <Input id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="h-11 rounded-lg" />
      </div>

      {row.required.includes('ANTELOPE_CANYON_X') ? (
        <WaiverGuideSignatureForm reservationId={reservationId} isKo={isKo} />
      ) : null}
    </div>
  )
}
