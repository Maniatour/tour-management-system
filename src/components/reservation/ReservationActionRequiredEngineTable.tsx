'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Edit,
  Eye,
  RefreshCw,
  Sparkles,
  DollarSign,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Reservation, Customer } from '@/types/reservation'
import type { ReservationPricingMapValue } from '@/types/reservationPricingMap'
import { supabase } from '@/lib/supabase'
import {
  analyzeReservationPricingEngine,
  buildEngineApplyPreview,
  type EngineApplyPreviewRow,
  type EngineDbFieldKey,
  type ReservationPricingAnalysis,
} from '@/lib/pricingEngine/analyzeReservation'
import type { BalanceChannelRowInput } from '@/utils/balanceChannelRevenue'
import {
  normalizeReservationIdForPayments,
  type PaymentRecordLike,
} from '@/utils/reservationPricingBalance'
import {
  getCustomerName,
  getProductNameForLocale,
  getStatusLabel,
  getStatusColor,
} from '@/utils/reservationUtils'
import { ReservationChannelFavicon } from '@/components/reservation/ReservationChannelFavicon'

function fmtUsd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return `$${Number(n).toFixed(2)}`
}

type Props = {
  reservations: Reservation[]
  customers: Customer[]
  products: Array<{ id: string; name: string }>
  channels: BalanceChannelRowInput[]
  reservationPricingMap: Map<string, ReservationPricingMapValue>
  paymentRecordsByReservationId: Map<string, PaymentRecordLike[]>
  reservationOptionSumByReservationId: Map<string, number>
  reservationExpenseSumByReservationId: Map<string, number>
  locale: string
  onEditClick: (reservationId: string) => void
  onPricingInfoClick: (reservation: Reservation) => void
  onRefreshReservations?: () => void | Promise<void>
  onRefreshReservationPricing?: (ids: string[]) => void | Promise<void>
}

function LayerLines({
  title,
  lines,
  isKorean,
}: {
  title: string
  lines: ReservationPricingAnalysis['engine']['customer']['lines']
  isKorean: boolean
}) {
  if (lines.length === 0) return null
  return (
    <div className="rounded-lg border border-border/50 bg-slate-50/80 p-3">
      <div className="mb-2 text-xs font-semibold text-slate-800">{title}</div>
      <div className="space-y-1 font-mono text-[11px] tabular-nums">
        {lines.map((line) => (
          <div key={line.id} className="flex justify-between gap-3">
            <span className="min-w-0 truncate text-slate-700">
              <span
                className={
                  line.sign === '+'
                    ? 'text-emerald-600'
                    : line.sign === '-'
                      ? 'text-red-600'
                      : 'text-blue-600'
                }
              >
                {line.sign}
              </span>{' '}
              {isKorean ? line.labelKo : line.labelEn}
            </span>
            <span className="shrink-0 font-medium">${line.amount.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function EngineReviewCard({
  reservation,
  analysis,
  pricing,
  paymentRecords,
  reservationOptionSumByReservationId,
  customerName,
  productName,
  channelName,
  channels,
  locale,
  busy,
  selected,
  onToggleSelect,
  onApply,
  onEdit,
  onPricingInfo,
  statusLabel,
}: {
  reservation: Reservation
  analysis: ReservationPricingAnalysis
  pricing: ReservationPricingMapValue
  paymentRecords: PaymentRecordLike[]
  reservationOptionSumByReservationId: Map<string, number>
  customerName: string
  productName: string
  channelName: string
  channels: BalanceChannelRowInput[]
  locale: string
  busy: boolean
  selected: boolean
  onToggleSelect: (checked: boolean) => void
  onApply: (fieldKeys: EngineDbFieldKey[]) => void
  onEdit: () => void
  onPricingInfo: () => void
  statusLabel: string
}) {
  const isKorean = locale === 'ko'
  const [expanded, setExpanded] = useState(!analysis.allMatch)
  const [showLayers, setShowLayers] = useState(false)
  const [selectedFields, setSelectedFields] = useState<Set<EngineDbFieldKey>>(() => {
    const s = new Set<EngineDbFieldKey>()
    for (const f of analysis.fields) {
      if (!f.matchDb) s.add(f.key)
    }
    return s
  })

  const applyPreview = useMemo(() => {
    if (selectedFields.size === 0) return null
    return buildEngineApplyPreview(analysis, [...selectedFields], {
      reservation,
      channels,
      pricing,
      paymentRecords,
      reservationOptionSumByReservationId,
    })
  }, [
    analysis,
    selectedFields,
    reservation,
    channels,
    pricing,
    paymentRecords,
    reservationOptionSumByReservationId,
  ])

  const applyPreviewByKey = useMemo(() => {
    if (!applyPreview) return new Map<string, EngineApplyPreviewRow>()
    return new Map(applyPreview.rows.map((r) => [r.key, r]))
  }, [applyPreview])

  const showApplyColumn = selectedFields.size > 0

  const extraApplyRows = useMemo(() => {
    if (!applyPreview) return []
    const fieldKeys = new Set(analysis.fields.map((f) => f.key))
    return applyPreview.rows.filter(
      (r) => r.includedInApply && !fieldKeys.has(r.key as EngineDbFieldKey)
    )
  }, [applyPreview, analysis.fields])

  const legacyMismatchCount = analysis.fields.filter((f) => !f.matchLegacy).length

  const toggleField = (key: EngineDbFieldKey) => {
    setSelectedFields((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <article
      className={`rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md ${
        analysis.allMatch ? 'border-emerald-200/80' : 'border-amber-200/90'
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onToggleSelect(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300"
          aria-label={isKorean ? '선택' : 'Select'}
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-0.5 shrink-0 text-slate-500 hover:text-slate-800"
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-900">{customerName}</span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                analysis.allMatch
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-900'
              }`}
            >
              {analysis.allMatch ? (
                <>
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  {isKorean ? 'DB 일치' : 'DB match'}
                </>
              ) : (
                <>
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  {isKorean
                    ? `DB ${analysis.mismatchCount}건 · 산식 ${legacyMismatchCount}건`
                    : `DB ${analysis.mismatchCount} · legacy ${legacyMismatchCount}`}
                </>
              )}
            </span>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-800">
              {isKorean ? analysis.profileLabelKo : analysis.profileLabelEn}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{productName}</span>
            <span>{reservation.tourDate}</span>
            <span className="inline-flex items-center gap-1">
              <ReservationChannelFavicon channelId={reservation.channelId ?? ''} channels={channels} />
              {channelName}
            </span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] ${getStatusColor(reservation.status)}`}>
              {statusLabel}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onPricingInfo}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            title={isKorean ? '가격 정보' : 'Pricing'}
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            title={isKorean ? '수정' : 'Edit'}
          >
            <Edit className="h-4 w-4" />
          </button>
          {!analysis.allMatch && (
            <button
              type="button"
              disabled={busy || selectedFields.size === 0}
              onClick={() => onApply([...selectedFields])}
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {isKorean ? '엔진값 적용' : 'Apply engine'}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/60 px-4 pb-4 pt-3 space-y-3">
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 w-8" />
                  <th className="px-3 py-2 font-medium">{isKorean ? '항목' : 'Field'}</th>
                  <th className="px-3 py-2 font-medium text-right">
                    {isKorean ? 'DB (저장)' : 'DB (stored)'}
                  </th>
                  <th className="px-3 py-2 font-medium text-right">
                    {isKorean ? '기존 산식' : 'Legacy formula'}
                  </th>
                  <th className="px-3 py-2 font-medium text-right">
                    {isKorean ? '엔진 (기준)' : 'Engine (truth)'}
                  </th>
                  {showApplyColumn && (
                    <th className="px-3 py-2 font-medium text-right bg-indigo-50/80 text-indigo-900">
                      <div>{isKorean ? '적용값' : 'Apply'}</div>
                      <div className="font-normal text-[10px] text-indigo-700/80">
                        {isKorean ? '연쇄 포함' : 'w/ cascade'}
                      </div>
                    </th>
                  )}
                  <th className="px-3 py-2 font-medium text-right">Δ</th>
                </tr>
              </thead>
              <tbody>
                {analysis.fields.map((row) => {
                  const rowWarn = !row.matchDb || !row.matchLegacy
                  const previewRow = applyPreviewByKey.get(row.key)
                  const inApply = Boolean(previewRow?.includedInApply)
                  return (
                    <tr
                      key={row.key}
                      className={
                        inApply
                          ? 'bg-indigo-50/40'
                          : rowWarn
                            ? 'bg-amber-50/50'
                            : 'bg-white'
                      }
                    >
                      <td className="px-3 py-2">
                        {!row.matchDb && (
                          <input
                            type="checkbox"
                            checked={selectedFields.has(row.key)}
                            onChange={() => toggleField(row.key)}
                            className="h-3.5 w-3.5 rounded border-gray-300"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">
                          {isKorean ? row.labelKo : row.labelEn}
                        </div>
                        <div className="font-mono text-[10px] text-gray-400">{row.dbColumn}</div>
                        {!row.matchLegacy && row.matchDb && (
                          <div className="text-[10px] text-violet-700">
                            {isKorean ? '산식 ≠ 엔진' : 'Formula ≠ engine'}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-700">
                        {fmtUsd(row.dbValue)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-violet-800">
                        {fmtUsd(row.legacyValue)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-indigo-900">
                        {fmtUsd(row.engineValue)}
                      </td>
                      {showApplyColumn && (
                        <td className="px-3 py-2 text-right align-top bg-indigo-50/30">
                          {previewRow ? (
                            <div className="flex flex-col items-end gap-0.5">
                              <span
                                className={`font-mono tabular-nums ${
                                  inApply
                                    ? 'font-semibold text-indigo-950'
                                    : 'font-medium text-gray-500'
                                }`}
                              >
                                {fmtUsd(previewRow.applyValue)}
                              </span>
                              {inApply ? (
                                <span
                                  className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                                    previewRow.includeReason === 'selected'
                                      ? 'bg-indigo-100 text-indigo-800'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {previewRow.includeReason === 'selected'
                                    ? isKorean
                                      ? '선택'
                                      : 'Selected'
                                    : isKorean
                                      ? '연쇄'
                                      : 'Cascade'}
                                </span>
                              ) : (
                                <span className="text-[9px] font-medium text-gray-400">
                                  {isKorean ? '유지' : 'Keep'}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="font-mono text-gray-300">—</span>
                          )}
                        </td>
                      )}
                      <td
                        className={`px-3 py-2 text-right font-mono tabular-nums ${
                          row.matchDb ? 'text-gray-400' : 'font-semibold text-amber-800'
                        }`}
                      >
                        {row.matchDb
                          ? '—'
                          : `${row.deltaDbVsEngine >= 0 ? '+' : ''}${row.deltaDbVsEngine.toFixed(2)}`}
                      </td>
                    </tr>
                  )
                })}
                {showApplyColumn &&
                  extraApplyRows.map((previewRow) => (
                    <tr key={previewRow.key} className="bg-indigo-50/40">
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">
                          {isKorean ? previewRow.labelKo : previewRow.labelEn}
                        </div>
                        <div className="font-mono text-[10px] text-gray-400">{previewRow.dbColumn}</div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-700">
                        {previewRow.key === 'commission_percent'
                          ? previewRow.dbValue != null
                            ? `${previewRow.dbValue.toFixed(2)}%`
                            : '—'
                          : fmtUsd(previewRow.dbValue)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-violet-800">
                        {previewRow.key === 'commission_percent'
                          ? previewRow.legacyValue != null
                            ? `${previewRow.legacyValue.toFixed(2)}%`
                            : '—'
                          : fmtUsd(previewRow.legacyValue)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-indigo-900">
                        {previewRow.key === 'commission_percent'
                          ? `${previewRow.engineValue.toFixed(2)}%`
                          : fmtUsd(previewRow.engineValue)}
                      </td>
                      <td className="px-3 py-2 text-right align-top bg-indigo-50/30">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="font-mono tabular-nums font-semibold text-indigo-950">
                            {previewRow.key === 'commission_percent'
                              ? `${previewRow.applyValue.toFixed(2)}%`
                              : fmtUsd(previewRow.applyValue)}
                          </span>
                          <span
                            className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                              previewRow.includeReason === 'selected'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {previewRow.includeReason === 'selected'
                              ? isKorean
                                ? '선택'
                                : 'Selected'
                              : isKorean
                                ? '연쇄'
                                : 'Cascade'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-400">—</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={() => setShowLayers((v) => !v)}
            className="mt-3 text-xs font-medium text-indigo-700 hover:text-indigo-900"
          >
            {showLayers
              ? isKorean
                ? '산식 레이어 숨기기'
                : 'Hide layers'
              : isKorean
                ? '산식 레이어 보기 (①②③④)'
                : 'Show layers (①②③④)'}
          </button>

          {showLayers && (
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <LayerLines
                title={isKorean ? '① 고객 결제' : '① Customer'}
                lines={analysis.engine.customer.lines}
                isKorean={isKorean}
              />
              <LayerLines
                title={isKorean ? '②③ 채널' : '②③ Channel'}
                lines={analysis.engine.channel.lines}
                isKorean={isKorean}
              />
              <LayerLines
                title={isKorean ? '④ 회사 매출' : '④ Company'}
                lines={analysis.engine.company.lines}
                isKorean={isKorean}
              />
            </div>
          )}
        </div>
      )}
    </article>
  )
}

export function ReservationActionRequiredEngineTable({
  reservations,
  customers,
  products,
  channels,
  reservationPricingMap,
  paymentRecordsByReservationId,
  reservationOptionSumByReservationId,
  reservationExpenseSumByReservationId,
  locale,
  onEditClick,
  onPricingInfoClick,
  onRefreshReservations,
  onRefreshReservationPricing,
}: Props) {
  const t = useTranslations('reservations')
  const isKorean = locale === 'ko'
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [applyBusy, setApplyBusy] = useState(false)
  const [rowBusyId, setRowBusyId] = useState<string | null>(null)

  const channelById = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels])

  const analyses = useMemo(() => {
    const list: Array<{ reservation: Reservation; analysis: ReservationPricingAnalysis }> = []
    for (const r of reservations) {
      const p = reservationPricingMap.get(r.id)
      const rid = normalizeReservationIdForPayments(r.id)
      const records =
        paymentRecordsByReservationId.get(rid) ??
        paymentRecordsByReservationId.get(r.id) ??
        []
      const analysis = analyzeReservationPricingEngine(
        r,
        p,
        channels,
        records,
        reservationOptionSumByReservationId,
        reservationExpenseSumByReservationId
      )
      if (analysis) list.push({ reservation: r, analysis })
    }
    return list
  }, [
    reservations,
    reservationPricingMap,
    paymentRecordsByReservationId,
    reservationOptionSumByReservationId,
    reservationExpenseSumByReservationId,
    channels,
  ])

  const mismatchCount = analyses.filter(
    (a) => a.analysis.fields.some((f) => !f.matchDb || !f.matchLegacy)
  ).length

  const applyPatch = useCallback(
    async (reservationId: string, fieldKeys: EngineDbFieldKey[]) => {
      const item = analyses.find((a) => a.reservation.id === reservationId)
      if (!item || fieldKeys.length === 0) return
      const p = reservationPricingMap.get(reservationId)
      if (!p) return

      const patch = buildEngineApplyPreview(item.analysis, fieldKeys, {
        reservation: item.reservation,
        channels,
        pricing: p,
        paymentRecords:
          paymentRecordsByReservationId.get(normalizeReservationIdForPayments(reservationId)) ??
          paymentRecordsByReservationId.get(reservationId) ??
          [],
        reservationOptionSumByReservationId,
      }).patch
      if (Object.keys(patch).length === 0) return

      setRowBusyId(reservationId)
      try {
        const { error } = await supabase
          .from('reservation_pricing')
          .update(patch as never)
          .eq('reservation_id', reservationId)
        if (error) {
          console.error('[engine-apply]', reservationId, error)
          return
        }
        if (onRefreshReservationPricing) {
          await onRefreshReservationPricing([reservationId])
        } else {
          await onRefreshReservations?.()
        }
      } finally {
        setRowBusyId(null)
      }
    },
    [analyses, reservationPricingMap, paymentRecordsByReservationId, reservationOptionSumByReservationId, channels, onRefreshReservationPricing, onRefreshReservations]
  )

  const applySelected = useCallback(async () => {
    if (selectedIds.size === 0) return
    setApplyBusy(true)
    try {
      for (const id of selectedIds) {
        const item = analyses.find((a) => a.reservation.id === id)
        if (!item) continue
        const keys = item.analysis.fields.filter((f) => !f.matchDb).map((f) => f.key)
        if (keys.length === 0) continue
        await applyPatch(id, keys)
      }
      setSelectedIds(new Set())
    } finally {
      setApplyBusy(false)
    }
  }, [selectedIds, analyses, applyPatch])

  const allSelected =
    analyses.length > 0 && analyses.every((a) => selectedIds.has(a.reservation.id))

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50/90 to-slate-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-950">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              {isKorean ? '가격 엔진 검토' : 'Pricing engine review'}
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-indigo-900/80">
              {isKorean
                ? 'DB 저장값·기존 산식·새 엔진(기준)을 나란히 비교합니다. 엔진값 적용 시 연쇄로 바뀌는 항목은 미리보기에서 확인할 수 있습니다.'
                : 'Compare stored DB values, legacy formulas, and the new engine. Cascaded fields are shown in the apply preview.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
              {isKorean ? `총 ${analyses.length}건` : `${analyses.length} total`}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium shadow-sm ${
                mismatchCount > 0
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {isKorean ? `불일치 ${mismatchCount}건` : `${mismatchCount} mismatch(es)`}
            </span>
          </div>
        </div>

        {analyses.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-indigo-100/80 pt-3">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedIds(new Set(analyses.map((a) => a.reservation.id)))
                  } else {
                    setSelectedIds(new Set())
                  }
                }}
                className="h-4 w-4 rounded border-gray-300"
              />
              {isKorean ? '전체 선택' : 'Select all'}
            </label>
            <button
              type="button"
              disabled={applyBusy || selectedIds.size === 0}
              onClick={() => void applySelected()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {applyBusy ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <DollarSign className="h-3.5 w-3.5" />
              )}
              {isKorean
                ? `선택 ${selectedIds.size}건 엔진값 일괄 적용`
                : `Apply engine to ${selectedIds.size} selected`}
            </button>
          </div>
        )}
      </div>

      {analyses.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-8 text-center text-sm text-muted-foreground">
          {t('actionRequired.empty')}
        </p>
      ) : (
        <div className="space-y-3">
          {analyses.map(({ reservation, analysis }) => {
            const channel = channelById.get(reservation.channelId ?? '')
            const p = reservationPricingMap.get(reservation.id)
            if (!p) return null
            const rid = normalizeReservationIdForPayments(reservation.id)
            const records =
              paymentRecordsByReservationId.get(rid) ??
              paymentRecordsByReservationId.get(reservation.id) ??
              []
            return (
              <EngineReviewCard
                key={reservation.id}
                reservation={reservation}
                analysis={analysis}
                pricing={p}
                paymentRecords={records}
                reservationOptionSumByReservationId={reservationOptionSumByReservationId}
                customerName={getCustomerName(reservation.customerId ?? '', customers)}
                productName={getProductNameForLocale(reservation.productId ?? '', products, locale)}
                channelName={channel?.name ?? reservation.channelId ?? '—'}
                channels={channels}
                locale={locale}
                busy={rowBusyId === reservation.id || applyBusy}
                selected={selectedIds.has(reservation.id)}
                onToggleSelect={(checked) => {
                  setSelectedIds((prev) => {
                    const next = new Set(prev)
                    if (checked) next.add(reservation.id)
                    else next.delete(reservation.id)
                    return next
                  })
                }}
                onApply={(keys) => void applyPatch(reservation.id, keys)}
                onEdit={() => onEditClick(reservation.id)}
                onPricingInfo={() => onPricingInfoClick(reservation)}
                statusLabel={getStatusLabel(reservation.status, t)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
