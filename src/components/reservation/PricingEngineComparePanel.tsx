'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, GitCompareArrows, CheckCircle2, AlertTriangle } from 'lucide-react'
import {
  buildPricingEngineContext,
  runPricingEngineComparison,
  type LegacyPricingSnapshotFromUi,
  type PricingEngineContext,
  type PricingComparisonResult,
} from '@/lib/pricingEngine'

export type PricingEngineComparePanelProps = {
  context: PricingEngineContext
  legacy: LegacyPricingSnapshotFromUi
  locale?: string
  defaultExpanded?: boolean
}

function LayerBlock({
  title,
  layer,
  isKorean,
}: {
  title: string
  layer: PricingComparisonResult['next']['customer']
  isKorean: boolean
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-white/80 p-3">
      <div className="mb-2 text-xs font-semibold text-gray-800">{title}</div>
      {layer.lines.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          {isKorean ? '항목 없음' : 'No lines'}
        </p>
      ) : (
        <div className="space-y-1 font-mono text-[11px] tabular-nums">
          {layer.lines.map((row) => (
            <div key={row.id} className="flex justify-between gap-2">
              <span className="min-w-0 truncate text-gray-700">
                <span
                  className={
                    row.sign === '+'
                      ? 'text-emerald-600'
                      : row.sign === '-'
                        ? 'text-red-600'
                        : 'text-blue-600'
                  }
                >
                  {row.sign}
                </span>{' '}
                {isKorean ? row.labelKo : row.labelEn}
              </span>
              <span className="shrink-0 font-medium text-gray-900">
                ${row.amount.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex justify-between border-t border-border/50 pt-2 text-xs font-semibold">
        <span className="text-gray-600">{isKorean ? '합계' : 'Total'}</span>
        <span>${layer.total.toFixed(2)}</span>
      </div>
    </div>
  )
}

export default function PricingEngineComparePanel({
  context,
  legacy,
  locale = 'ko',
  defaultExpanded = false,
}: PricingEngineComparePanelProps) {
  const isKorean = locale === 'ko'
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [showLayers, setShowLayers] = useState(false)

  const comparison = useMemo(
    () => runPricingEngineComparison(context, legacy),
    [context, legacy]
  )

  return (
    <div className="mt-4 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 p-3 shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <GitCompareArrows className="h-4 w-4 text-indigo-600" aria-hidden />
          <div>
            <div className="text-xs font-semibold text-indigo-900">
              {isKorean ? '가격 엔진 비교 (베타)' : 'Pricing engine compare (beta)'}
            </div>
            <div className="text-[10px] text-indigo-700/80">
              {isKorean
                ? '기존 가격 정보 vs 새 구조 — 일치할 때까지 병행 운영'
                : 'Legacy vs new engine — run in parallel until matched'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {comparison.allMatch ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
              <CheckCircle2 className="h-3 w-3" />
              {isKorean ? '전체 일치' : 'All match'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
              <AlertTriangle className="h-3 w-3" />
              {isKorean
                ? `${comparison.mismatchCount}건 불일치`
                : `${comparison.mismatchCount} mismatch(es)`}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-indigo-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-indigo-600" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg border border-indigo-100 bg-white/90 px-3 py-2 text-[11px] text-gray-700">
            <span className="font-medium text-indigo-900">
              {isKorean ? '시나리오' : 'Profile'}:
            </span>{' '}
            {isKorean ? comparison.next.profileLabelKo : comparison.next.profileLabelEn}
            <span className="mx-2 text-gray-300">|</span>
            <span className="font-mono text-[10px] text-gray-500">{comparison.profile}</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border/60 bg-white">
            <table className="min-w-full text-left text-[11px]">
              <thead className="border-b border-border/60 bg-slate-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 font-medium">{isKorean ? '항목' : 'Field'}</th>
                  <th className="px-3 py-2 font-medium text-right">
                    {isKorean ? '기존' : 'Legacy'}
                  </th>
                  <th className="px-3 py-2 font-medium text-right">
                    {isKorean ? '새 엔진' : 'New'}
                  </th>
                  <th className="px-3 py-2 font-medium text-right">Δ</th>
                  <th className="px-3 py-2 font-medium text-center">
                    {isKorean ? '일치' : 'Match'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((row) => (
                  <tr
                    key={row.key}
                    className={row.match ? 'bg-white' : 'bg-amber-50/60'}
                  >
                    <td className="px-3 py-2 text-gray-800">
                      {isKorean ? row.labelKo : row.labelEn}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      ${row.legacy.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      ${row.next.toFixed(2)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono tabular-nums ${
                        Math.abs(row.delta) > 0.02 ? 'text-amber-800 font-semibold' : 'text-gray-500'
                      }`}
                    >
                      {row.delta >= 0 ? '+' : ''}
                      {row.delta.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.match ? (
                        <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="mx-auto h-3.5 w-3.5 text-amber-600" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={() => setShowLayers((v) => !v)}
            className="text-[11px] font-medium text-indigo-700 hover:text-indigo-900"
          >
            {showLayers
              ? isKorean
                ? '새 엔진 레이어 숨기기'
                : 'Hide new engine layers'
              : isKorean
                ? '새 엔진 레이어 보기 (①②③④)'
                : 'Show new engine layers (①②③④)'}
          </button>

          {showLayers && (
            <div className="grid gap-3 md:grid-cols-3">
              <LayerBlock
                title={isKorean ? '① 고객 결제' : '① Customer'}
                layer={comparison.next.customer}
                isKorean={isKorean}
              />
              <LayerBlock
                title={isKorean ? '②③ 채널' : '②③ Channel'}
                layer={comparison.next.channel}
                isKorean={isKorean}
              />
              <LayerBlock
                title={isKorean ? '④ 회사 매출' : '④ Company'}
                layer={comparison.next.company}
                isKorean={isKorean}
              />
            </div>
          )}

          <p className="text-[10px] leading-relaxed text-gray-500">
            {isKorean
              ? '기존 가격 정보는 저장·표시에 그대로 사용됩니다. 새 엔진은 비교·검증용이며, 전 항목이 일치하면 단계적으로 전환합니다.'
              : 'Legacy pricing remains the source of truth for save/display. The new engine is for validation until all fields match.'}
          </p>
        </div>
      )}
    </div>
  )
}

export { buildPricingEngineContext }
