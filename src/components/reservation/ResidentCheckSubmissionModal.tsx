'use client'

import { FileText, X } from 'lucide-react'
import { hasResidentCheckProof, parseResidentCheckProofUrls } from '@/lib/residentCheckProofUrls'
import type { ResidentCheckGuestRecord } from '@/lib/residentCheckReservationSync'

function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    cents / 100
  )
}

function residencyLabel(value: string, isKo: boolean): string {
  if (value === 'us_resident') return isKo ? '미국 거주자 (전원)' : 'U.S. resident (entire party)'
  if (value === 'non_resident') return isKo ? '비거주자 (전원)' : 'Non-U.S. resident (entire party)'
  if (value === 'mixed') return isKo ? '혼성 (일부 비거주)' : 'Mixed party'
  return value
}

function paymentLabel(value: string | null, isKo: boolean): string {
  if (value === 'card') return isKo ? '카드 결제' : 'Pay by card'
  if (value === 'cash') return isKo ? '투어 당일 현금' : 'Cash on tour day'
  return isKo ? '해당 없음' : 'Not required'
}

function ProofThumbs({ urls, alt }: { urls: string[]; alt: string }) {
  if (urls.length === 0) return null
  return (
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {urls.map((url, index) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="overflow-hidden rounded-xl border border-border/60"
        >
          <img src={url} alt={`${alt} ${index + 1}`} className="h-24 w-full object-cover" />
        </a>
      ))}
    </div>
  )
}

export default function ResidentCheckSubmissionModal({
  record,
  guestName,
  tourDate,
  locale = 'ko',
  onClose,
}: {
  record: ResidentCheckGuestRecord
  guestName?: string
  tourDate?: string
  locale?: string
  onClose: () => void
}) {
  const isKo = locale === 'ko'
  const s = record.submission
  const idUrls = parseResidentCheckProofUrls(s.id_proof_url)
  const passUrls = parseResidentCheckProofUrls(s.pass_photo_url)

  const rows: Array<{ label: string; value: string }> = [
    { label: isKo ? '게스트' : 'Guest', value: guestName || '—' },
    { label: isKo ? '투어 날짜' : 'Tour date', value: tourDate || '—' },
    { label: isKo ? '거주 상태' : 'Residency', value: residencyLabel(s.residency, isKo) },
  ]

  if (s.residency !== 'us_resident') {
    rows.push({
      label: isKo ? '비거주자 16세 이상' : 'Non-U.S. residents age 16+',
      value: String(s.non_resident_16_plus_count),
    })
  }
  if (s.residency === 'non_resident') {
    rows.push({
      label: isKo ? '연간 패스 보유' : 'Annual pass',
      value:
        s.has_annual_pass === true
          ? isKo
            ? '있음'
            : 'Yes'
          : isKo
            ? '없음'
            : 'No',
    })
  }
  if (s.payment_method) {
    rows.push({
      label: isKo ? '결제 방법' : 'Payment method',
      value: paymentLabel(s.payment_method, isKo),
    })
  }
  if (s.nps_fee_usd_cents > 0) {
    rows.push({
      label: isKo ? '비거주 입장료' : 'Non-resident fee',
      value: formatUsdFromCents(s.nps_fee_usd_cents),
    })
  }
  if (s.card_processing_fee_usd_cents > 0) {
    rows.push({
      label: isKo ? '카드 수수료' : 'Card processing fee',
      value: formatUsdFromCents(s.card_processing_fee_usd_cents),
    })
  }
  if (s.total_charge_usd_cents > 0) {
    rows.push({
      label: isKo ? '당일 결제 금액' : 'Total due today',
      value: formatUsdFromCents(s.total_charge_usd_cents),
    })
  }
  rows.push({
    label: isKo ? '약관 동의' : 'Terms agreed',
    value: s.agreed ? (isKo ? '동의함' : 'Yes') : isKo ? '미동의' : 'No',
  })
  rows.push({
    label: isKo ? '제출 상태' : 'Status',
    value: record.completedAt
      ? isKo
        ? '제출 완료'
        : 'Completed'
      : isKo
        ? '작성 중'
        : 'In progress',
  })
  if (s.pass_assistance_requested) {
    rows.push({
      label: isKo ? '패스 안내 요청' : 'Pass assistance',
      value: isKo ? '요청함' : 'Requested',
    })
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              {isKo ? '게스트 거주 확인 폼' : 'Guest residency form'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={isKo ? '닫기' : 'Close'}
          >
            <X className="h-4 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">
          <dl className="grid gap-3 text-xs sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.label}>
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="font-medium text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
          {hasResidentCheckProof(s.id_proof_url) ? (
            <div className="mt-4">
              <p className="text-xs font-medium text-foreground">
                {isKo ? '신분증' : 'ID proof'} ({idUrls.length})
              </p>
              <ProofThumbs urls={idUrls} alt={isKo ? '신분증' : 'ID proof'} />
            </div>
          ) : null}
          {hasResidentCheckProof(s.pass_photo_url) ? (
            <div className="mt-4">
              <p className="text-xs font-medium text-foreground">
                {isKo ? '연간 패스 사진' : 'Pass photo'} ({passUrls.length})
              </p>
              <ProofThumbs urls={passUrls} alt={isKo ? '연간 패스' : 'Pass photo'} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
