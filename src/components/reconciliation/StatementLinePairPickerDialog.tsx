'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { ArrowLeftRight, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  buildStatementLinePairCandidates,
  type StatementLinePairRow,
} from '@/lib/statement-line-pairs'
import { formatStatementLineDescription } from '@/lib/statement-display'

const SEARCH_MIN = 2
const QUICK_MAX = 24
const SEARCH_MAX = 40

export type StatementLinePairPickerAnchor = {
  id: string
  posted_date: string
  amount: number | string
  direction: string
  description: string | null
  merchant: string | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  anchor: StatementLinePairPickerAnchor | null
  poolLines: StatementLinePairPickerAnchor[]
  /** 명세 줄 id → 금융 계정명 (전체 계정 보기에서 후보 계정 구분용) */
  accountLabelById?: Map<string, string>
  existingPairs: StatementLinePairRow[]
  saving: boolean
  onSelectCounterpart: (counterpartLineId: string) => void | Promise<void>
}

export default function StatementLinePairPickerDialog({
  open,
  onOpenChange,
  anchor,
  poolLines,
  accountLabelById,
  existingPairs,
  saving,
  onSelectCounterpart,
}: Props) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  const linkedCounterpartIds = useMemo(() => {
    if (!anchor) return new Set<string>()
    const s = new Set<string>()
    for (const p of existingPairs) {
      if (p.outflow_line_id === anchor.id) s.add(p.inflow_line_id)
      if (p.inflow_line_id === anchor.id) s.add(p.outflow_line_id)
    }
    return s
  }, [anchor, existingPairs])

  const candidates = useMemo(() => {
    if (!anchor) return []
    return buildStatementLinePairCandidates(
      { ...anchor, amount: Number(anchor.amount) || 0 },
      poolLines,
      { max: 200 }
    )
  }, [anchor, poolLines])

  const quickOptions = useMemo(() => {
    const eps = 0.02
    const out = []
    for (const c of candidates) {
      if (linkedCounterpartIds.has(c.lineId)) continue
      if (c.amountDiff < eps) {
        out.push(c)
        if (out.length >= QUICK_MAX) break
      }
    }
    if (out.length < QUICK_MAX) {
      for (const c of candidates) {
        if (linkedCounterpartIds.has(c.lineId)) continue
        if (out.some((x) => x.lineId === c.lineId)) continue
        out.push(c)
        if (out.length >= QUICK_MAX) break
      }
    }
    return out
  }, [candidates, linkedCounterpartIds])

  const searchResults = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    if (q.length < SEARCH_MIN) return []
    const out = []
    for (const c of candidates) {
      if (linkedCounterpartIds.has(c.lineId)) continue
      const hay = `${c.posted_date} ${c.amount} ${c.description}`.toLowerCase()
      if (!hay.includes(q)) continue
      out.push(c)
      if (out.length >= SEARCH_MAX) break
    }
    return out
  }, [candidates, deferredQuery, linkedCounterpartIds])

  const isOut = anchor?.direction === 'outflow'
  const anchorAmt = anchor ? Math.abs(Number(anchor.amount) || 0) : 0
  const anchorAccount = anchor ? accountLabelById?.get(anchor.id) ?? null : null

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setQuery('')
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-w-2xl w-[calc(100vw-1.25rem)] max-h-[min(90vh,760px)] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2 pr-12 border-b border-slate-100 shrink-0 text-left">
          <DialogTitle className="text-base flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-violet-700 shrink-0" aria-hidden />
            {isOut ? '수입 명세 줄 연결 (상계)' : '출금 명세 줄 연결 (상계)'}
          </DialogTitle>
        </DialogHeader>
        {anchor ? (
          <div className="flex flex-col flex-1 min-h-0 gap-3 px-4 py-3 overflow-y-auto">
            <p className="text-xs text-slate-600 break-words">
              기준 줄: <strong>{anchor.posted_date}</strong> ·{' '}
              {isOut ? '출금' : '수입'}{' '}
              <strong>${anchorAmt.toFixed(2)}</strong>
              {anchorAccount ? (
                <span className="ml-1 inline-block rounded bg-slate-100 px-1 py-0.5 text-[10px] text-slate-600 align-middle">
                  {anchorAccount}
                </span>
              ) : null}
              <span className="block mt-0.5 text-slate-500 line-clamp-2">
                {formatStatementLineDescription(anchor.description, anchor.merchant)}
              </span>
            </p>
            <p className="text-[11px] text-violet-900/90 bg-violet-50 border border-violet-100 rounded-md px-2.5 py-1.5">
              티켓·업체 환불처럼 <strong>지출(출금)</strong>과 <strong>환불 입금(수입)</strong>이 짝인 경우
              연결합니다. 운영 지출·입금 기록(reconciliation_matches)과는 별도입니다.
            </p>
            <label className="text-xs text-slate-600 block space-y-1">
              검색 ({SEARCH_MIN}자 이상 — 일자·금액·설명)
              <input
                className="w-full border rounded px-2 py-2 text-sm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </label>
            <div>
              <div className="text-xs font-medium text-slate-700 mb-1">
                금액·일자 근접 후보 (최대 {QUICK_MAX})
              </div>
              <div className="max-h-[min(28vh,280px)] overflow-y-auto border rounded divide-y divide-slate-100 bg-white">
                {quickOptions.length === 0 ? (
                  <div className="p-3 text-slate-500 text-sm">근접 후보가 없습니다. 검색을 이용하세요.</div>
                ) : (
                  quickOptions.map((c) => {
                    const acct = accountLabelById?.get(c.lineId) ?? null
                    const crossAccount = Boolean(acct && anchorAccount && acct !== anchorAccount)
                    return (
                      <button
                        key={c.lineId}
                        type="button"
                        disabled={saving}
                        className="w-full text-left px-2 py-2 text-sm hover:bg-violet-50 disabled:opacity-50"
                        onClick={() => void onSelectCounterpart(c.lineId)}
                      >
                        <span className="font-medium tabular-nums">${c.amount.toFixed(2)}</span>
                        <span className="text-slate-600"> · {c.posted_date}</span>
                        {c.amountDiff >= 0.02 ? (
                          <span className="text-amber-700 text-[11px] ml-1">
                            (차이 ${c.amountDiff.toFixed(2)})
                          </span>
                        ) : null}
                        {acct ? (
                          <span
                            className={`ml-1 inline-block rounded px-1 py-0.5 text-[10px] align-middle ${
                              crossAccount
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {crossAccount ? '타계정 · ' : ''}
                            {acct}
                          </span>
                        ) : null}
                        <span className="block text-[11px] text-slate-500 truncate">{c.description}</span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
            {deferredQuery.trim().length >= SEARCH_MIN ? (
              <div>
                <div className="text-xs font-medium text-slate-700 mb-1">
                  검색 결과 (최대 {SEARCH_MAX}건)
                </div>
                <div className="max-h-[min(24vh,240px)] overflow-y-auto border rounded divide-y divide-slate-100 bg-white">
                  {searchResults.length === 0 ? (
                    <div className="p-3 text-slate-500 text-sm">결과 없음</div>
                  ) : (
                    searchResults.map((c) => {
                      const acct = accountLabelById?.get(c.lineId) ?? null
                      const crossAccount = Boolean(acct && anchorAccount && acct !== anchorAccount)
                      return (
                        <button
                          key={`s:${c.lineId}`}
                          type="button"
                          disabled={saving}
                          className="w-full text-left px-2 py-2 text-sm hover:bg-violet-50 disabled:opacity-50"
                          onClick={() => void onSelectCounterpart(c.lineId)}
                        >
                          <span className="font-medium tabular-nums">${c.amount.toFixed(2)}</span>
                          <span className="text-slate-600"> · {c.posted_date}</span>
                          {acct ? (
                            <span
                              className={`ml-1 inline-block rounded px-1 py-0.5 text-[10px] align-middle ${
                                crossAccount
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {crossAccount ? '타계정 · ' : ''}
                              {acct}
                            </span>
                          ) : null}
                          <span className="block text-[11px] text-slate-500 truncate">{c.description}</span>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">
                {SEARCH_MIN}글자 이상 입력하면 전체 후보에서 검색합니다.
              </p>
            )}
          </div>
        ) : null}
        <DialogFooter className="px-4 py-3 border-t border-slate-100 shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
          {saving ? (
            <span className="text-xs text-slate-500 inline-flex items-center gap-1 ml-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              저장 중…
            </span>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
