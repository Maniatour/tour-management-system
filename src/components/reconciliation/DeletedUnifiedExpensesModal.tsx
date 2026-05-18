'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import { Archive, RotateCcw } from 'lucide-react'
import {
  fetchSoftDeletedUnifiedExpenseRows,
  restoreExpenseBySourceKey,
  UNIFIED_EXPENSE_SOURCE_LABEL,
  type UnifiedLedgerDuplicateExpenseRow
} from '@/lib/expense-unified-duplicate-scan'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { toast } from 'sonner'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRestored?: () => void
}

export default function DeletedUnifiedExpensesModal({ open, onOpenChange, onRestored }: Props) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [rows, setRows] = useState<UnifiedLedgerDuplicateExpenseRow[] | null>(null)
  const [restoringKey, setRestoringKey] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const list = await fetchSoftDeletedUnifiedExpenseRows()
      setRows(list)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '조회 실패')
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setRows(null)
      setErr(null)
      return
    }
    void reload()
  }, [open, reload])

  async function onRestore(sourceKey: string) {
    setRestoringKey(sourceKey)
    setErr(null)
    try {
      await restoreExpenseBySourceKey(sourceKey)
      toast.success('지출을 복구했습니다.')
      setRows((prev) => (prev ? prev.filter((r) => r.source_key !== sourceKey) : prev))
      onRestored?.()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '복구 실패'
      setErr(msg)
      toast.error(msg)
    } finally {
      setRestoringKey(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-0 p-0 w-full max-w-none h-[100dvh] max-h-[100dvh] rounded-none sm:rounded-lg sm:w-[calc(100vw-1rem)] sm:max-w-[min(96rem,calc(100vw-1.5rem))] sm:h-auto sm:max-h-[min(88vh,820px)]">
        <DialogHeader className="px-4 pt-4 pb-2 pr-12 border-b border-slate-100 shrink-0 text-left space-y-1">
          <DialogTitle className="text-base flex items-center gap-2">
            <Archive className="h-5 w-5 shrink-0 text-slate-600" aria-hidden />
            삭제된 지출 보관함
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-slate-600">
            중복 점검 등에서 소프트 삭제한 회사·투어·예약·입장권 지출입니다. 복구하면 목록·중복 점검에 다시 나타납니다.
          </DialogDescription>
        </DialogHeader>

        <div className="px-3 sm:px-4 py-3 overflow-y-auto flex-1 min-h-0 text-[11px] sm:text-xs">
          {err ? <p className="text-red-700 text-sm mb-2">{err}</p> : null}
          {loading ? <p className="text-slate-600">불러오는 중…</p> : null}
          {!loading && rows && rows.length === 0 ? (
            <p className="text-emerald-800">삭제된 지출이 없습니다.</p>
          ) : null}
          {!loading && rows && rows.length > 0 ? (
            <Fragment>
              <div className="md:hidden space-y-3">
              {rows.map((row) => (
                <div
                  key={`${row.source_key}-m`}
                  className="rounded-lg border border-slate-200 bg-white p-3 space-y-2 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-slate-900">{UNIFIED_EXPENSE_SOURCE_LABEL[row.source_table]}</p>
                      <p className="text-lg font-bold tabular-nums text-slate-900 mt-0.5">
                        {row.amount != null && Number.isFinite(row.amount)
                          ? `$${row.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                          : '—'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 text-xs gap-1 shrink-0"
                      disabled={restoringKey != null}
                      onClick={() => void onRestore(row.source_key)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                      복구
                    </Button>
                  </div>
                  <dl className="grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1 text-xs border-t border-slate-100 pt-2">
                    <dt className="text-slate-500">등록일</dt>
                    <dd>{row.submit_on ? String(row.submit_on).slice(0, 10) : '—'}</dd>
                    <dt className="text-slate-500">삭제일</dt>
                    <dd>{row.deleted_at ? String(row.deleted_at).slice(0, 10) : '—'}</dd>
                    <dt className="text-slate-500">Paid to</dt>
                    <dd className="break-words">{row.paid_to?.trim() || '—'}</dd>
                    <dt className="text-slate-500">Paid for</dt>
                    <dd className="break-words">{row.paid_for?.trim() || '—'}</dd>
                    <dt className="text-slate-500">삭제자</dt>
                    <dd className="break-all text-[10px]">{row.deleted_by?.trim() || '—'}</dd>
                    <dt className="text-slate-500 col-span-2 pt-0.5">ID</dt>
                    <dd className="col-span-2 font-mono text-[10px] break-all">{row.id}</dd>
                  </dl>
                </div>
              ))}
            </div>
            <div className="hidden md:block rounded-md border border-slate-200 overflow-x-auto">
              <table className="w-full min-w-[72rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 bg-slate-50">
                    <th className="py-1.5 px-2 font-medium min-w-[7rem]">지출 구분</th>
                    <th className="py-1.5 px-2 font-medium min-w-[10rem]">지출 ID</th>
                    <th className="py-1.5 px-2 font-medium whitespace-nowrap">등록일</th>
                    <th className="py-1.5 px-2 font-medium text-right whitespace-nowrap">금액</th>
                    <th className="py-1.5 px-2 font-medium min-w-[6rem]">Paid to</th>
                    <th className="py-1.5 px-2 font-medium min-w-[6rem]">Paid for</th>
                    <th className="py-1.5 px-2 font-medium whitespace-nowrap">삭제일</th>
                    <th className="py-1.5 px-2 font-medium min-w-[8rem]">삭제한 사람</th>
                    <th className="py-1.5 px-2 font-medium w-24">복구</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.source_key} className="border-b border-slate-100 align-top">
                      <td className="py-1.5 px-2 whitespace-nowrap font-medium text-slate-800">
                        {UNIFIED_EXPENSE_SOURCE_LABEL[row.source_table]}
                      </td>
                      <td className="py-1.5 px-2 font-mono text-[10px] break-all text-slate-900">{row.id}</td>
                      <td className="py-1.5 px-2 whitespace-nowrap text-slate-700">
                        {row.submit_on ? String(row.submit_on).slice(0, 10) : '—'}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-slate-900">
                        {row.amount != null && Number.isFinite(row.amount)
                          ? `$${row.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                          : '—'}
                      </td>
                      <td className="py-1.5 px-2 break-words text-slate-700">{row.paid_to?.trim() || '—'}</td>
                      <td className="py-1.5 px-2 break-words text-slate-700">{row.paid_for?.trim() || '—'}</td>
                      <td className="py-1.5 px-2 whitespace-nowrap text-slate-700">
                        {row.deleted_at ? String(row.deleted_at).slice(0, 10) : '—'}
                      </td>
                      <td className="py-1.5 px-2 break-all text-slate-600 text-[10px]">
                        {row.deleted_by?.trim() || '—'}
                      </td>
                      <td className="py-1.5 px-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px] gap-1"
                          disabled={restoringKey != null}
                          onClick={() => void onRestore(row.source_key)}
                        >
                          <RotateCcw className="h-3 w-3" aria-hidden />
                          복구
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </Fragment>
          ) : null}
        </div>

        <DialogFooter className="px-3 sm:px-4 py-3 border-t border-slate-100 shrink-0 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="secondary" size="sm" className="w-full sm:w-auto h-10" disabled={loading} onClick={() => void reload()}>
            새로고침
          </Button>
          <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto h-10" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
