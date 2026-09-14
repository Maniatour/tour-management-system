'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, CircleAlert, Loader2, X } from 'lucide-react'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import type { OtaParseProductRule } from '@/lib/emailReservationParseCatalog'

type CoverageVariant = { variant_key: string; variant_name: string }
type SoldProduct = {
  product_id: string
  product_name: string
  variants: CoverageVariant[]
  parse_rules: OtaParseProductRule[]
  product_mapped: boolean
  price_connected: boolean
}

type PlatformCoverage = {
  key: string
  label: string
  hasDedicatedParser: boolean
  notes: string
  fieldCoverage: {
    product: 'strong' | 'partial' | 'none'
    people: 'strong' | 'partial' | 'none'
    date: 'strong' | 'partial' | 'none'
    customer: 'strong' | 'partial' | 'none'
    price: 'strong' | 'partial' | 'none'
  }
  channel_id: string | null
  channel_name: string | null
  sold_products: SoldProduct[]
  unmatched_rules: OtaParseProductRule[]
  stats: {
    import_count: number
    confirmed: number
    auto_confirmed: number
    with_product: number
    with_price: number
    auto_ready: number
    sold_count: number
    mapped_count: number
    price_connected_count: number
  }
}

type CoverageResponse = {
  platforms: PlatformCoverage[]
  auto_confirm: { enabled: boolean; requires: string[] }
}

const LEVEL_LABEL: Record<'strong' | 'partial' | 'none', string> = {
  strong: '확립',
  partial: '일부',
  none: '없음',
}

function LevelPill({ level }: { level: 'strong' | 'partial' | 'none' }) {
  const cls =
    level === 'strong'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : level === 'partial'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-slate-100 text-slate-600 border-slate-200'
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md border text-[11px] font-medium ${cls}`}>
      {LEVEL_LABEL[level]}
    </span>
  )
}

export function ReservationImportParseCoverageModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<CoverageResponse | null>(null)
  const [activeKey, setActiveKey] = useState<string>('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchApiWithAuth('/api/reservation-imports/parse-coverage')
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || '불러오기 실패')
        if (!cancelled) {
          setData(json as CoverageResponse)
          const first = (json as CoverageResponse).platforms?.[0]?.key
          if (first) setActiveKey((prev) => prev || first)
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '불러오기 실패')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const active = useMemo(
    () => data?.platforms.find((p) => p.key === activeKey) ?? data?.platforms[0] ?? null,
    [data, activeKey]
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3 sm:p-6">
      <div
        role="dialog"
        aria-labelledby="parse-coverage-title"
        className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col border border-gray-200"
      >
        <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b">
          <div className="min-w-0">
            <h2 id="parse-coverage-title" className="text-lg font-semibold text-gray-900">
              OTA 파싱 규칙 현황
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              채널에 연결된 판매 상품과 이메일 파서 매핑·가격 연결 상태를 확인합니다. 상품·날짜·인원·고객명·금액이
              모두 잡히고 해당일 동적가격이 있으면 확인 없이 예약에 자동 추가됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl hover:bg-gray-100"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <p className="p-6 text-sm text-red-700">{error}</p>
        ) : data ? (
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
            <div className="lg:w-56 shrink-0 border-b lg:border-b-0 lg:border-r overflow-x-auto lg:overflow-y-auto">
              <div className="flex lg:flex-col p-2 gap-1">
                {data.platforms.map((p) => {
                  const ready = p.stats.sold_count > 0 && p.stats.price_connected_count === p.stats.sold_count
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setActiveKey(p.key)}
                      className={`text-left min-h-[44px] px-3 py-2 rounded-xl text-sm ${
                        active?.key === p.key ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-gray-50 text-gray-800'
                      }`}
                    >
                      <span className="block truncate">{p.label}</span>
                      <span className="block text-[11px] text-gray-500">
                        가격 {p.stats.price_connected_count}/{p.stats.sold_count || 0}
                        {ready ? ' · 준비됨' : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {active && (
                <>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900">{active.label}</h3>
                      {active.hasDedicatedParser ? (
                        <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                          전용 파서
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md">
                          공통 패턴만
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{active.notes}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      채널: {active.channel_name || '미연결'} {active.channel_id ? `(${active.channel_id})` : ''}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-700">
                      <span>상품 <LevelPill level={active.fieldCoverage.product} /></span>
                      <span>인원 <LevelPill level={active.fieldCoverage.people} /></span>
                      <span>날짜 <LevelPill level={active.fieldCoverage.date} /></span>
                      <span>고객 <LevelPill level={active.fieldCoverage.customer} /></span>
                      <span>가격 <LevelPill level={active.fieldCoverage.price} /></span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      최근 메일 {active.stats.import_count}건 · 상품 {active.stats.with_product} · 금액 {active.stats.with_price} ·
                      자동추가 가능 {active.stats.auto_ready} · 예약 생성 {active.stats.confirmed}
                      {active.stats.auto_confirmed ? ` (자동 ${active.stats.auto_confirmed})` : ''}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">판매 상품</h4>
                    {active.sold_products.length === 0 ? (
                      <p className="text-sm text-gray-500">이 채널에 연결된 활성 상품이 없습니다.</p>
                    ) : (
                      <ul className="space-y-2">
                        {active.sold_products.map((p) => (
                          <li key={p.product_id} className="rounded-xl border border-gray-200 bg-white p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900">{p.product_name}</p>
                                <p className="text-xs text-gray-500">{p.product_id}</p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {p.product_mapped ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-800">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> 상품
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-800">
                                    <CircleAlert className="w-3.5 h-3.5" /> 상품 미매핑
                                  </span>
                                )}
                                {p.price_connected ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-800">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> 가격
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-800">
                                    <CircleAlert className="w-3.5 h-3.5" /> 가격 미연결
                                  </span>
                                )}
                              </div>
                            </div>
                            {p.variants.length > 0 && (
                              <p className="text-xs text-gray-500 mt-1">
                                variant: {p.variants.map((v) => v.variant_name).join(', ')}
                              </p>
                            )}
                            {p.parse_rules.length > 0 && (
                              <ul className="mt-2 space-y-1">
                                {p.parse_rules.map((r) => (
                                  <li key={r.id} className="text-xs text-gray-600">
                                    {r.matcher_label}
                                    {r.variant_label ? ` · ${r.variant_label}` : ''}
                                    {r.notes ? ` · ${r.notes}` : ''}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {active.unmatched_rules.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">파서에만 있는 규칙</h4>
                      <ul className="space-y-1">
                        {active.unmatched_rules.map((r) => (
                          <li key={r.id} className="text-sm text-gray-700">
                            {r.product_name}{' '}
                            <span className="text-xs text-gray-500">
                              ({r.matcher_label}
                              {r.product_id ? ` → ${r.product_id}` : ''})
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : null}

        {data?.auto_confirm?.requires?.length ? (
          <div className="border-t px-4 sm:px-5 py-3 text-xs text-gray-500">
            자동 예약 추가 조건: {data.auto_confirm.requires.join(' · ')}
          </div>
        ) : null}
      </div>
    </div>
  )
}
