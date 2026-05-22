'use client'

import { useParams } from 'next/navigation'
import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, Archive, Car, ExternalLink, User, Users } from 'lucide-react'
import DeletedUnifiedExpensesModal from '@/components/reconciliation/DeletedUnifiedExpensesModal'
import { TourDetailModalContent } from '@/components/tour/TourDetailModalContent'
import { UnifiedExpenseInlineEditForm } from '@/components/reconciliation/UnifiedExpenseInlineEditForm'
import {
  saveUnifiedExpenseEdit,
  unifiedLedgerRowToEditDraft,
  type UnifiedExpenseEditDraft
} from '@/lib/unified-expense-edit'
import {
  BULK_COMPANY_DUP_AMOUNT_EPS,
  BULK_COMPANY_DUP_DAY_WINDOW,
  fetchCompanyExpenseDuplicatesForBulk,
  type BulkCompanyDuplicateCheckInput,
  type BulkCompanyDuplicateRow,
  type LedgerDuplicateExpenseRow
} from '@/lib/statement-bulk-company-duplicate-check'
import {
  canonGroupFingerprint,
  canonPairFingerprint,
  deleteExpenseBySourceKey,
  fetchUnifiedExpenseLedgerDuplicateGroups,
  formatExpenseStatementLinkDisplay,
  insertExpenseDuplicateSuppression,
  UNIFIED_EXPENSE_SOURCE_LABEL,
  type TourReferenceSnapshot,
  type UnifiedLedgerDuplicateExpenseRow
} from '@/lib/expense-unified-duplicate-scan'
import { getStatusColor, getStatusText } from '@/utils/tourStatusUtils'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { toast } from 'sonner'

const LEDGER_GROUP_PAGE_SIZES = [5, 10, 20, 30] as const
const DEFAULT_LEDGER_GROUP_PAGE_SIZE = 10

export type CompanyExpenseDuplicateCheckMode = 'statement' | 'ledger'

function ledgerGroupKey(group: UnifiedLedgerDuplicateExpenseRow[]): string {
  return canonGroupFingerprint(group.map((r) => r.source_key))
}

function rowSearchBlob(row: UnifiedLedgerDuplicateExpenseRow): string {
  const parts = [
    UNIFIED_EXPENSE_SOURCE_LABEL[row.source_table],
    row.id,
    row.paid_to,
    row.paid_for,
    row.description,
    row.category,
    row.standard_paid_for,
    row.display_payment_method,
    row.display_statement_status,
    row.display_financial_account,
    row.source_context,
    row.source_key,
    row.amount != null ? String(row.amount) : '',
    row.submit_on,
    row.tour_reference?.tourName,
    row.tour_reference?.tourDate,
    row.detail_tour_id,
    row.detail_reservation_id
  ]
  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function ledgerGroupMatchesSearch(group: UnifiedLedgerDuplicateExpenseRow[], q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return group.some((row) => rowSearchBlob(row).includes(needle))
}

function ledgerGroupMatchesDateRange(
  group: UnifiedLedgerDuplicateExpenseRow[],
  dateFrom: string,
  dateTo: string
): boolean {
  if (!dateFrom && !dateTo) return true
  return group.some((row) => {
    const ymd = String(row.submit_on ?? '').slice(0, 10)
    if (!ymd || ymd.length !== 10) return false
    if (dateFrom && ymd < dateFrom) return false
    if (dateTo && ymd > dateTo) return false
    return true
  })
}

function ledgerGroupTotalPages(totalFiltered: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.max(0, totalFiltered) / pageSize))
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: CompanyExpenseDuplicateCheckMode
  /** mode === 'statement' — 지출 일괄 입력 후보와 동일한 명세 줄 목록 */
  statementCandidates?: BulkCompanyDuplicateCheckInput[]
  /** 중복 점검에서 숨김·삭제 후 부모 목록 새로고침 등 */
  onAfterLedgerMutation?: () => void
  createdByEmail?: string | null
}

function linkCell(m: {
  reconciled_statement_line_id: string | null
  statement_line_id: string | null
}): string {
  const label = formatExpenseStatementLinkDisplay(m)
  return label === '미연결' ? '—' : label
}

function originCell(origin: string | null): string {
  return origin === 'statement_adjustment' ? '명세 보정·일괄' : '운영'
}

function LedgerReferenceCell({
  tourRef,
  fallbackText,
  locale
}: {
  tourRef: TourReferenceSnapshot | null | undefined
  fallbackText: string | null | undefined
  locale: string
}) {
  if (tourRef) {
    const tourStatus = (tourRef.tourStatus ?? '').trim()
    const tourName = tourRef.tourName?.trim() || ''

    return (
      <div className="min-w-0 max-w-full space-y-1">
        <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-800 leading-snug font-medium">
          {tourRef.tourDate ? <span className="shrink-0">{tourRef.tourDate}</span> : <span className="text-slate-400 shrink-0">날짜 —</span>}
          <span className="text-slate-300 shrink-0">·</span>
          <span className="break-words">{tourName || '투어명 —'}</span>
          {tourStatus ? (
            <span
              className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[9px] font-semibold leading-none ${getStatusColor(tourRef.tourStatus)}`}
              title={tourStatus}
            >
              {getStatusText(tourRef.tourStatus, locale)}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-800 leading-snug">
          <span className="inline-flex items-center gap-0.5" title="배정 인원">
            <User className="h-3 w-3 shrink-0 text-slate-500" aria-hidden />
            <span className="tabular-nums font-medium">{tourRef.assignedPeople}</span>
          </span>
          <span className="inline-flex items-center gap-0.5 min-w-0" title={`가이드 ${tourRef.guideName}`}>
            <User className="h-3 w-3 shrink-0 text-slate-500" aria-hidden />
            <span className="truncate max-w-[5.5rem]">{tourRef.guideName}</span>
          </span>
          <span className="inline-flex items-center gap-0.5 min-w-0" title={`어시 ${tourRef.assistantName}`}>
            <Users className="h-3 w-3 shrink-0 text-slate-500" aria-hidden />
            <span className="truncate max-w-[5.5rem]">{tourRef.assistantName}</span>
          </span>
          <span className="inline-flex items-center gap-0.5 min-w-0" title={`차량 ${tourRef.vehicleName}`}>
            <Car className="h-3 w-3 shrink-0 text-slate-500" aria-hidden />
            <span className="truncate max-w-[5.5rem]">{tourRef.vehicleName}</span>
          </span>
        </div>
      </div>
    )
  }

  const trimmed = fallbackText?.trim()
  if (!trimmed) return <span className="text-slate-400">—</span>
  return <span className="text-[10px] text-slate-600 break-words">{trimmed}</span>
}

function LedgerDetailLinksCell({
  row,
  onOpenTour,
  onOpenReservation
}: {
  row: UnifiedLedgerDuplicateExpenseRow
  onOpenTour: (tourId: string) => void
  onOpenReservation: (reservationId: string) => void
}) {
  const tourId = row.detail_tour_id?.trim()
  const resId = row.detail_reservation_id?.trim()
  if (!tourId && !resId) {
    return <span className="text-slate-400">—</span>
  }
  return (
    <div className="flex flex-col gap-1 items-start">
      {tourId ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[10px] px-2 py-0"
          onClick={() => onOpenTour(tourId)}
        >
          투어 상세
        </Button>
      ) : null}
      {resId ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[10px] px-2 py-0"
          onClick={() => onOpenReservation(resId)}
        >
          예약 상세
        </Button>
      ) : null}
    </div>
  )
}

function standardCategoryCell(row: LedgerDuplicateExpenseRow): string {
  const spf = (row.standard_paid_for ?? '').trim()
  if (spf) return spf
  const c = (row.category ?? '').trim()
  if (c) return `${c} (비표준)`
  return '—'
}

function formatUsd(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return '—'
  return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function MobileField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-slate-500 shrink-0">{label}</dt>
      <dd className="text-slate-900 min-w-0 break-words">{children}</dd>
    </>
  )
}

function LedgerDuplicateRowMobileCard({
  row,
  rowIndex,
  groupIndex,
  locale,
  selected,
  editing,
  editDraft,
  editSaving,
  onToggleDelete,
  onStartEdit,
  onCancelEdit,
  onDraftChange,
  onSaveEdit,
  onOpenTour,
  onOpenReservation
}: {
  row: UnifiedLedgerDuplicateExpenseRow
  rowIndex: number
  groupIndex: number
  locale: string
  selected: boolean
  editing: boolean
  editDraft: UnifiedExpenseEditDraft | null
  editSaving: boolean
  onToggleDelete: (checked: boolean) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onDraftChange: (draft: UnifiedExpenseEditDraft) => void
  onSaveEdit: () => void
  onOpenTour: (tourId: string) => void
  onOpenReservation: (reservationId: string) => void
}) {
  return (
    <div
      className={`rounded-lg border p-3 space-y-2 ${
        selected ? 'border-red-300 bg-red-50/90' : rowIndex === 0 ? 'border-amber-300 bg-amber-50/80' : 'border-amber-100 bg-white'
      } ${editing ? 'ring-2 ring-blue-300' : ''}`}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0 accent-red-600"
          checked={selected}
          onChange={(e) => onToggleDelete(e.target.checked)}
          aria-label={`그룹 ${groupIndex + 1}에서 삭제할 지출 선택`}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                rowIndex === 0 ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-800'
              }`}
            >
              {rowIndex === 0 ? '기준' : '비슷'}
            </span>
            <span className="text-xs font-semibold text-slate-900">{UNIFIED_EXPENSE_SOURCE_LABEL[row.source_table]}</span>
          </div>
          <p className="text-lg font-bold tabular-nums text-slate-900">{formatUsd(row.amount)}</p>
        </div>
      </div>

      <dl className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-1.5 text-xs border-t border-amber-100/80 pt-2">
        <MobileField label="등록일">{row.submit_on ? String(row.submit_on).slice(0, 10) : '—'}</MobileField>
        <MobileField label="Paid to">{row.paid_to?.trim() || '—'}</MobileField>
        <MobileField label="Paid for">{row.paid_for?.trim() || '—'}</MobileField>
        <MobileField label="표준 카테고리">{standardCategoryCell(row)}</MobileField>
        <MobileField label="결제 방법">{row.display_payment_method}</MobileField>
        <MobileField label="명세 대조">{row.display_statement_status}</MobileField>
        <MobileField label="금융 계정">{row.display_financial_account ?? '—'}</MobileField>
        <MobileField label="지출 ID">
          <span className="font-mono text-[10px] break-all">{row.id}</span>
        </MobileField>
        <dt className="text-slate-500 shrink-0 col-span-2 pt-0.5">참고</dt>
        <dd className="col-span-2 min-w-0">
          <LedgerReferenceCell tourRef={row.tour_reference} fallbackText={row.source_context} locale={locale} />
        </dd>
      </dl>

      <div className="flex flex-wrap gap-1.5 pt-1">
        <LedgerDetailLinksCell row={row} onOpenTour={onOpenTour} onOpenReservation={onOpenReservation} />
        {editing ? (
          <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" disabled={editSaving} onClick={onCancelEdit}>
            취소
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={editSaving}
            onClick={onStartEdit}
          >
            수정
          </Button>
        )}
      </div>

      {editing && editDraft ? (
        <div className="border-t border-blue-100 pt-2">
          <UnifiedExpenseInlineEditForm
            row={row}
            draft={editDraft}
            onDraftChange={onDraftChange}
            saving={editSaving}
            onSave={onSaveEdit}
            onCancel={onCancelEdit}
          />
        </div>
      ) : null}
    </div>
  )
}

export default function CompanyExpenseDuplicateCheckModal({
  open,
  onOpenChange,
  mode,
  statementCandidates = [],
  onAfterLedgerMutation,
  createdByEmail = null
}: Props) {
  const params = useParams()
  const locale = typeof params?.locale === 'string' ? params.locale : 'ko'

  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [statementRows, setStatementRows] = useState<BulkCompanyDuplicateRow[] | null>(null)
  const [ledgerGroups, setLedgerGroups] = useState<UnifiedLedgerDuplicateExpenseRow[][] | null>(null)
  const [ledgerDateFrom, setLedgerDateFrom] = useState('')
  const [ledgerDateTo, setLedgerDateTo] = useState('')
  const [ledgerSearch, setLedgerSearch] = useState('')
  const [ledgerPage, setLedgerPage] = useState(1)
  const [ledgerPageSize, setLedgerPageSize] = useState(DEFAULT_LEDGER_GROUP_PAGE_SIZE)
  const [deleteKeysByGroup, setDeleteKeysByGroup] = useState<Record<string, string[]>>({})
  const [deleteConfirm, setDeleteConfirm] = useState<{ deleteKeys: string[] } | null>(null)
  const [tourDetailModalId, setTourDetailModalId] = useState<string | null>(null)
  const [reservationDetailModalId, setReservationDetailModalId] = useState<string | null>(null)
  const [editingSourceKey, setEditingSourceKey] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<UnifiedExpenseEditDraft | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [deletedVaultOpen, setDeletedVaultOpen] = useState(false)

  const LEDGER_TABLE_COL_COUNT = 13

  const stmtKey = useMemo(
    () =>
      mode === 'statement'
        ? statementCandidates.map((c) => `${c.statement_line_id}|${c.posted_date}|${c.amount}`).join(';')
        : '',
    [mode, statementCandidates]
  )

  const reloadLedger = useCallback(async () => {
    const { groups } = await fetchUnifiedExpenseLedgerDuplicateGroups()
    setLedgerGroups(groups)
    setDeleteKeysByGroup({})
  }, [])

  const filteredLedgerGroups = useMemo(() => {
    if (!ledgerGroups) return null
    return ledgerGroups.filter(
      (group) =>
        ledgerGroupMatchesDateRange(group, ledgerDateFrom, ledgerDateTo) &&
        ledgerGroupMatchesSearch(group, ledgerSearch)
    )
  }, [ledgerGroups, ledgerDateFrom, ledgerDateTo, ledgerSearch])

  const ledgerTotalPages = useMemo(
    () => ledgerGroupTotalPages(filteredLedgerGroups?.length ?? 0, ledgerPageSize),
    [filteredLedgerGroups?.length, ledgerPageSize]
  )

  const safeLedgerPage = Math.min(Math.max(1, ledgerPage), ledgerTotalPages)

  const paginatedLedgerGroups = useMemo(() => {
    if (!filteredLedgerGroups) return null
    const start = (safeLedgerPage - 1) * ledgerPageSize
    return filteredLedgerGroups.slice(start, start + ledgerPageSize)
  }, [filteredLedgerGroups, safeLedgerPage, ledgerPageSize])

  useEffect(() => {
    if (ledgerPage !== safeLedgerPage) setLedgerPage(safeLedgerPage)
  }, [ledgerPage, safeLedgerPage])

  useEffect(() => {
    setLedgerPage(1)
  }, [ledgerDateFrom, ledgerDateTo, ledgerSearch, ledgerPageSize])

  useEffect(() => {
    if (!open) {
      setErr(null)
      setStatementRows(null)
      setLedgerGroups(null)
      setLedgerDateFrom('')
      setLedgerDateTo('')
      setLedgerSearch('')
      setLedgerPage(1)
      setLedgerPageSize(DEFAULT_LEDGER_GROUP_PAGE_SIZE)
      setDeleteKeysByGroup({})
      setDeleteConfirm(null)
      setTourDetailModalId(null)
      setReservationDetailModalId(null)
      setEditingSourceKey(null)
      setEditDraft(null)
      return
    }
    let cancelled = false
    void (async () => {
      setLoading(true)
      setErr(null)
      setStatementRows(null)
      setLedgerGroups(null)
      setDeleteKeysByGroup({})
      try {
        if (mode === 'statement') {
          if (statementCandidates.length === 0) {
            if (!cancelled) setStatementRows([])
            return
          }
          const rows = await fetchCompanyExpenseDuplicatesForBulk(statementCandidates)
          if (!cancelled) setStatementRows(rows)
        } else {
          await reloadLedger()
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : '조회 실패')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, mode, stmtKey, reloadLedger])

  const title =
    mode === 'statement'
      ? '명세 줄 ↔ 기존 회사 지출 중복 점검'
      : '회사·투어·예약·입장권 교차 중복 의심 점검'

  function removeLedgerKeysFromCurrentList(keys: string[]) {
    const keySet = new Set(keys)
    setLedgerGroups((prev) => {
      if (!prev) return prev
      return prev
        .map((group) => group.filter((row) => !keySet.has(row.source_key)))
        .filter((group) => group.length >= 2)
    })
    setDeleteKeysByGroup({})
  }

  function toggleDeleteKey(groupKey: string, sourceKey: string, checked: boolean) {
    setDeleteKeysByGroup((prev) => {
      const cur = prev[groupKey] ?? []
      const next = checked ? [...new Set([...cur, sourceKey])] : cur.filter((k) => k !== sourceKey)
      return { ...prev, [groupKey]: next }
    })
  }

  function onMarkGroupDifferent(group: UnifiedLedgerDuplicateExpenseRow[]) {
    const keys = group.map((r) => r.source_key)
    if (keys.length < 2) return
    const fp = keys.length === 2 ? canonPairFingerprint(keys[0]!, keys[1]!) : canonGroupFingerprint(keys)
    const kind = keys.length === 2 ? 'pair' : 'group'

    removeLedgerKeysFromCurrentList(keys)
    toast.success('다른 지출로 기록했습니다. 이 목록에서는 다시 표시되지 않습니다.')

    void (async () => {
      try {
        await insertExpenseDuplicateSuppression({
          fingerprint: fp,
          kind,
          member_keys: [...keys].sort((a, b) => a.localeCompare(b)),
          created_by: createdByEmail ?? null
        })
        onAfterLedgerMutation?.()
      } catch (e) {
        const msg = e instanceof Error ? e.message : '저장 실패'
        setErr(msg)
        toast.error(msg)
        await reloadLedger()
      }
    })()
  }

  const cancelExpenseEdit = useCallback(() => {
    setEditingSourceKey(null)
    setEditDraft(null)
  }, [])

  const startExpenseEdit = useCallback((row: UnifiedLedgerDuplicateExpenseRow) => {
    setEditingSourceKey(row.source_key)
    setEditDraft(unifiedLedgerRowToEditDraft(row))
  }, [])

  const saveExpenseEdit = useCallback(
    async (row: UnifiedLedgerDuplicateExpenseRow) => {
      if (!editDraft) return
      setEditSaving(true)
      setErr(null)
      try {
        await saveUnifiedExpenseEdit(row.source_table, row.id, editDraft)
        toast.success('지출을 수정했습니다.')
        cancelExpenseEdit()
        await reloadLedger()
        onAfterLedgerMutation?.()
      } catch (e) {
        const msg = e instanceof Error ? e.message : '저장 실패'
        setErr(msg)
        toast.error(msg)
      } finally {
        setEditSaving(false)
      }
    },
    [editDraft, cancelExpenseEdit, reloadLedger, onAfterLedgerMutation]
  )

  function runDeleteSelected(deleteKeys: string[]) {
    setDeleteConfirm(null)
    const count = deleteKeys.length
    removeLedgerKeysFromCurrentList(deleteKeys)
    toast.success(`${count}건을 삭제 보관함으로 옮겼습니다.`)

    void (async () => {
      try {
        for (const k of deleteKeys) {
          await deleteExpenseBySourceKey(k, createdByEmail)
        }
        onAfterLedgerMutation?.()
      } catch (e) {
        const msg = e instanceof Error ? e.message : '삭제 중 오류'
        setErr(msg)
        toast.error(msg)
        await reloadLedger()
      }
    })()
  }

  return (
    <>
      <AlertDialog open={deleteConfirm != null} onOpenChange={(v) => !v && setDeleteConfirm(null)}>
        <AlertDialogContent className="w-[calc(100vw-1.5rem)] max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-left text-base">선택한 지출 삭제</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-left text-sm text-muted-foreground space-y-2">
                <p>
                  아래에서 선택한 지출은 <strong>삭제 보관함</strong>으로 옮깁니다(복구 가능). 명세 대조 연결이 있으면 함께
                  해제됩니다.
                </p>
                {deleteConfirm && deleteConfirm.deleteKeys.length > 0 ? (
                  <ul className="list-disc pl-4 font-mono text-[11px] break-all text-slate-700">
                    {deleteConfirm.deleteKeys.map((k) => (
                      <li key={k}>{k}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={(ev) => {
                ev.preventDefault()
                if (!deleteConfirm) return
                void runDeleteSelected(deleteConfirm.deleteKeys)
              }}
            >
              삭제 보관함으로
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v && loading) return
          onOpenChange(v)
        }}
      >
        <DialogContent
          className="flex flex-col gap-0 p-0 w-full max-w-none h-[100dvh] max-h-[100dvh] rounded-none sm:rounded-lg sm:w-[calc(100vw-1rem)] sm:max-w-[min(96rem,calc(100vw-1.5rem))] md:max-w-[min(112rem,calc(100vw-1rem))] lg:max-w-[min(120rem,calc(100vw-0.75rem))] sm:h-auto sm:max-h-[min(88vh,820px)] md:max-h-[min(92vh,920px)]"
          onPointerDownOutside={(e) => {
            if (loading) e.preventDefault()
          }}
          onEscapeKeyDown={(e) => {
            if (loading) e.preventDefault()
          }}
        >
          <DialogHeader className="px-3 sm:px-4 pt-3 sm:pt-4 pb-2 pr-10 sm:pr-12 border-b border-slate-100 shrink-0 text-left space-y-1">
            <DialogTitle className="text-sm sm:text-base flex items-start sm:items-center gap-2 leading-snug pr-1">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5 sm:mt-0" aria-hidden />
              <span>{title}</span>
            </DialogTitle>
            {mode === 'ledger' ? (
              <details className="sm:hidden text-xs text-slate-600 group">
                <summary className="cursor-pointer list-none text-blue-700 font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                  점검 기준 안내
                  <span className="inline-block ml-1 transition group-open:rotate-180">▾</span>
                </summary>
                <p className="mt-2 leading-relaxed">
                  전체 지출을 스캔해 금액(±{BULK_COMPANY_DUP_AMOUNT_EPS})·등록일(±{BULK_COMPANY_DUP_DAY_WINDOW}일)로 묶습니다.
                  투어 지출끼리 연결 투어가 다르면 제외합니다. 상단에서 등록일·검색·페이지로 목록을 좁힐 수 있습니다.
                </p>
              </details>
            ) : null}
            <DialogDescription className="hidden sm:block text-xs sm:text-sm text-slate-600">
              {mode === 'statement' ? (
                <>
                  명세 <strong>출금·미대조</strong> 후보 줄마다, 금액(±{BULK_COMPANY_DUP_AMOUNT_EPS})·등록일(±
                  {BULK_COMPANY_DUP_DAY_WINDOW}일)이 맞는 <strong>기존 회사 지출</strong>을 찾습니다. 일괄 입력·자동 매칭 전에
                  같은 거래가 이미 있는지 확인할 때 사용하세요.
                </>
              ) : (
                <>
                  승인·대기·입장권 확정 지출 <strong>전체</strong>를 스캔해 중복 의심 그룹을 찾습니다.{' '}
                  <strong>회사·투어·예약·입장권</strong>을 한 풀에 넣어, 출처가 달라도(예: 회사 ↔ 투어) 금액(±
                  {BULK_COMPANY_DUP_AMOUNT_EPS})·등록일(±{BULK_COMPANY_DUP_DAY_WINDOW}일)이 비슷하면 한 그룹으로 묶습니다.{' '}
                  <strong>투어 지출끼리</strong> 연결 투어가 다르면 제외합니다. 아래 <strong>등록일·검색·페이지</strong>로
                  목록을 좁힐 수 있습니다(그룹 안 <strong>한 건이라도</strong> 등록일이 기간 안이면 표시). 우연히 겹친 경우{' '}
                  <strong>다른 지출로 숨김</strong>, 동일 거래면 <strong>삭제 보관함</strong>으로 옮기세요.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {mode === 'ledger' && !loading ? (
            <div className="px-3 sm:px-4 py-2.5 border-b border-slate-100 shrink-0 space-y-2 bg-slate-50/80">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                <label className="flex flex-col gap-0.5 text-[11px] text-slate-600 min-w-[8.5rem]">
                  <span className="font-medium text-slate-700">등록일 시작</span>
                  <input
                    type="date"
                    value={ledgerDateFrom}
                    onChange={(e) => setLedgerDateFrom(e.target.value)}
                    className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900"
                  />
                </label>
                <label className="flex flex-col gap-0.5 text-[11px] text-slate-600 min-w-[8.5rem]">
                  <span className="font-medium text-slate-700">등록일 끝</span>
                  <input
                    type="date"
                    value={ledgerDateTo}
                    onChange={(e) => setLedgerDateTo(e.target.value)}
                    className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900"
                  />
                </label>
                <label className="flex flex-col gap-0.5 text-[11px] text-slate-600 flex-1 min-w-[12rem]">
                  <span className="font-medium text-slate-700">검색</span>
                  <input
                    type="search"
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    placeholder="지출 ID, Paid to/for, 금액, 투어명…"
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900"
                  />
                </label>
                {(ledgerDateFrom || ledgerDateTo || ledgerSearch.trim()) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 text-xs shrink-0"
                    onClick={() => {
                      setLedgerDateFrom('')
                      setLedgerDateTo('')
                      setLedgerSearch('')
                    }}
                  >
                    필터 초기화
                  </Button>
                ) : null}
              </div>
              {ledgerGroups ? (
                <p className="text-[11px] text-slate-600 tabular-nums">
                  중복 의심 그룹{' '}
                  <strong className="text-slate-900">{filteredLedgerGroups?.length ?? 0}</strong>
                  {filteredLedgerGroups && ledgerGroups.length !== filteredLedgerGroups.length ? (
                    <span> / 전체 {ledgerGroups.length}</span>
                  ) : null}
                  건
                  {(filteredLedgerGroups?.length ?? 0) > 0 ? (
                    <span>
                      {' '}
                      · {(safeLedgerPage - 1) * ledgerPageSize + 1}–
                      {Math.min(safeLedgerPage * ledgerPageSize, filteredLedgerGroups?.length ?? 0)}번째 그룹 표시
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="px-3 sm:px-4 py-3 overflow-y-auto flex-1 min-h-0 text-[11px] sm:text-xs space-y-2">
            {err ? <p className="text-red-700 text-sm">{err}</p> : null}
            {loading ? <p className="text-slate-600">불러오는 중…</p> : null}

            {!loading && !err && mode === 'statement' && statementCandidates.length === 0 ? (
              <p className="text-slate-600">점검할 명세 출금·미대조 줄이 없습니다. 계정·필터를 확인하세요.</p>
            ) : null}

            {!loading &&
            !err &&
            mode === 'statement' &&
            statementRows &&
            statementCandidates.length > 0 &&
            statementRows.length === 0 ? (
              <p className="text-emerald-800">
                표시 중인 명세 후보 줄과 겹치는 기존 회사 지출이 없습니다. (금액 ±{BULK_COMPANY_DUP_AMOUNT_EPS}, 등록일 ±
                {BULK_COMPANY_DUP_DAY_WINDOW}일, 승인·대기만)
              </p>
            ) : null}

            {!loading && !err && mode === 'ledger' && ledgerGroups && ledgerGroups.length === 0 ? (
              <p className="text-emerald-800">
                중복 의심 그룹이 없습니다. (금액 ±{BULK_COMPANY_DUP_AMOUNT_EPS}, 등록일 ±{BULK_COMPANY_DUP_DAY_WINDOW}일,
                승인·대기·입장권 확정)
              </p>
            ) : null}

            {!loading &&
            !err &&
            mode === 'ledger' &&
            ledgerGroups &&
            ledgerGroups.length > 0 &&
            filteredLedgerGroups &&
            filteredLedgerGroups.length === 0 ? (
              <p className="text-slate-700">
                조건에 맞는 중복 의심 그룹이 없습니다. 등록일·검색을 바꾸거나{' '}
                <button
                  type="button"
                  className="text-blue-700 underline font-medium"
                  onClick={() => {
                    setLedgerDateFrom('')
                    setLedgerDateTo('')
                    setLedgerSearch('')
                  }}
                >
                  필터 초기화
                </button>
                를 눌러 보세요.
              </p>
            ) : null}

            {!loading && !err && mode === 'statement' && statementRows && statementRows.length > 0 ? (
              <>
              <div className="md:hidden space-y-3">
                {statementRows.map((block) =>
                  block.matches.map((m) => (
                    <div
                      key={`${block.proposal.statement_line_id}-${m.id}-m`}
                      className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2"
                    >
                      <div className="flex justify-between gap-2 border-b border-amber-100 pb-2">
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-500">명세</p>
                          <p className="text-sm font-semibold text-slate-900">{block.proposal.posted_date}</p>
                          <p className="text-xs text-slate-700 break-words">{block.proposal.line_desc || '—'}</p>
                        </div>
                        <p className="text-lg font-bold tabular-nums text-slate-900 shrink-0">
                          {formatUsd(Number(block.proposal.amount))}
                        </p>
                      </div>
                      <dl className="grid grid-cols-[5rem_1fr] gap-x-2 gap-y-1 text-xs">
                        <MobileField label="기존 ID">
                          <span className="font-mono text-[10px]">{m.id.slice(0, 8)}…</span>
                        </MobileField>
                        <MobileField label="기존 금액">{formatUsd(m.amount)}</MobileField>
                        <MobileField label="등록일">{m.submit_on ? String(m.submit_on).slice(0, 10) : '—'}</MobileField>
                        <MobileField label="Paid to">{m.paid_to?.trim() || '—'}</MobileField>
                        <MobileField label="Paid for">{m.paid_for?.trim() || '—'}</MobileField>
                        <MobileField label="상태">{m.status?.trim() || '—'}</MobileField>
                        <MobileField label="지출↔명세">{linkCell(m)}</MobileField>
                        <MobileField label="비고">{originCell(m.ledger_expense_origin)}</MobileField>
                      </dl>
                    </div>
                  ))
                )}
              </div>
              <div className="hidden md:block rounded-md border border-amber-200/90 bg-amber-50/50 overflow-x-auto">
                <table className="w-full min-w-[72rem] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-amber-200/80 text-slate-600 bg-amber-100/40">
                      <th className="py-1.5 px-1.5 font-medium whitespace-nowrap">명세일</th>
                      <th className="py-1.5 px-1.5 font-medium text-right whitespace-nowrap">명세 금액</th>
                      <th className="py-1.5 px-1.5 font-medium min-w-[10rem]">명세 설명</th>
                      <th className="py-1.5 px-1.5 font-medium whitespace-nowrap">기존 지출 ID</th>
                      <th className="py-1.5 px-1.5 font-medium text-right whitespace-nowrap">기존 금액</th>
                      <th className="py-1.5 px-1.5 font-medium whitespace-nowrap">등록일</th>
                      <th className="py-1.5 px-1.5 font-medium min-w-[7rem]">Paid to</th>
                      <th className="py-1.5 px-1.5 font-medium min-w-[7rem]">Paid for</th>
                      <th className="py-1.5 px-1.5 font-medium whitespace-nowrap">상태</th>
                      <th className="py-1.5 px-1.5 font-medium whitespace-nowrap">지출↔명세</th>
                      <th className="py-1.5 px-1.5 font-medium min-w-[6rem]">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementRows.flatMap((block) =>
                      block.matches.map((m) => (
                        <tr key={`${block.proposal.statement_line_id}-${m.id}`} className="border-b border-amber-100/80 align-top">
                          <td className="py-1 px-1.5 whitespace-nowrap text-slate-800">{block.proposal.posted_date}</td>
                          <td className="py-1 px-1.5 text-right tabular-nums text-slate-800">
                            ${Number(block.proposal.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-1 px-1.5 break-words text-slate-700">{block.proposal.line_desc || '—'}</td>
                          <td className="py-1 px-1.5 font-mono text-[10px] text-slate-800">{m.id.slice(0, 8)}…</td>
                          <td className="py-1 px-1.5 text-right tabular-nums text-slate-800">
                            {m.amount != null && Number.isFinite(m.amount)
                              ? `$${m.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                              : '—'}
                          </td>
                          <td className="py-1 px-1.5 whitespace-nowrap text-slate-700">
                            {m.submit_on ? String(m.submit_on).slice(0, 10) : '—'}
                          </td>
                          <td className="py-1 px-1.5 break-words text-slate-700">{m.paid_to?.trim() || '—'}</td>
                          <td className="py-1 px-1.5 break-words text-slate-700">{m.paid_for?.trim() || '—'}</td>
                          <td className="py-1 px-1.5 whitespace-nowrap text-slate-700">{m.status?.trim() || '—'}</td>
                          <td className="py-1 px-1.5 whitespace-nowrap text-slate-700">{linkCell(m)}</td>
                          <td className="py-1 px-1.5 text-slate-600">{originCell(m.ledger_expense_origin)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              </>
            ) : null}

            {!loading && !err && mode === 'ledger' && paginatedLedgerGroups && paginatedLedgerGroups.length > 0 ? (
              <div className="space-y-4">
                {paginatedLedgerGroups.map((group, pageGi) => {
                  const groupKey = ledgerGroupKey(group)
                  const displayGroupNo = (safeLedgerPage - 1) * ledgerPageSize + pageGi + 1
                  const refAmt = group[0]?.amount
                  const amtLabel =
                    refAmt != null && Number.isFinite(refAmt)
                      ? `$${refAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                      : '—'
                  const selectedDeleteKeys = deleteKeysByGroup[groupKey] ?? []
                  const selectedDeleteKeySet = new Set(selectedDeleteKeys)
                  return (
                    <div
                      key={`ledger-group-${groupKey}`}
                      className="rounded-lg border-2 border-amber-400/90 bg-gradient-to-b from-amber-50/90 to-white overflow-hidden shadow-sm ring-1 ring-amber-200/60"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center px-2 sm:px-3 py-2 bg-amber-100/90 border-b border-amber-300/80 text-xs text-amber-950">
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <span
                            className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-amber-600 px-2 text-[11px] font-bold text-white shrink-0"
                            title={`중복 의심 그룹 ${displayGroupNo}`}
                          >
                            {displayGroupNo}
                          </span>
                          <span className="font-semibold">중복 의심 그룹</span>
                          <span className="text-slate-700 text-[11px] sm:text-xs">
                            · {group.length}건 · {amtLabel}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5 w-full sm:w-auto sm:flex-row sm:ml-auto">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-9 w-full sm:w-auto text-xs sm:text-[11px]"
                            onClick={() => onMarkGroupDifferent(group)}
                          >
                            다른 지출(숨김)
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="h-9 w-full sm:w-auto text-xs sm:text-[11px]"
                            disabled={selectedDeleteKeys.length === 0}
                            onClick={() => setDeleteConfirm({ deleteKeys: selectedDeleteKeys })}
                          >
                            선택 삭제{selectedDeleteKeys.length > 0 ? ` (${selectedDeleteKeys.length})` : ''}
                          </Button>
                        </div>
                      </div>
                      <div className="md:hidden space-y-2 px-2 pb-2 pt-1">
                        {group.map((row, ri) => (
                          <LedgerDuplicateRowMobileCard
                            key={`${row.source_key}-m`}
                            row={row}
                            rowIndex={ri}
                            groupIndex={displayGroupNo - 1}
                            locale={locale}
                            selected={selectedDeleteKeySet.has(row.source_key)}
                            editing={editingSourceKey === row.source_key}
                            editDraft={editingSourceKey === row.source_key ? editDraft : null}
                            editSaving={editSaving}
                            onToggleDelete={(checked) => toggleDeleteKey(groupKey, row.source_key, checked)}
                            onStartEdit={() => startExpenseEdit(row)}
                            onCancelEdit={cancelExpenseEdit}
                            onDraftChange={setEditDraft}
                            onSaveEdit={() => void saveExpenseEdit(row)}
                            onOpenTour={setTourDetailModalId}
                            onOpenReservation={setReservationDetailModalId}
                          />
                        ))}
                      </div>
                      <div className="hidden md:block overflow-x-auto px-1 pb-2 pt-1">
                        <table className="w-full min-w-[106rem] border-collapse text-left text-[11px]">
                          <thead>
                            <tr className="border-b border-amber-200/90 text-slate-600 bg-amber-50/80">
                              <th className="py-1.5 px-2 font-medium w-14 text-center">삭제 선택</th>
                              <th className="py-1.5 px-2 font-medium min-w-[7rem]">지출 구분</th>
                              <th className="py-1.5 px-2 font-medium min-w-[11rem]">지출 ID</th>
                              <th className="py-1.5 px-2 font-medium whitespace-nowrap">등록일</th>
                              <th className="py-1.5 px-2 font-medium min-w-[7rem]">Paid to</th>
                              <th className="py-1.5 px-2 font-medium min-w-[7rem]">paid for</th>
                              <th className="py-1.5 px-2 font-medium min-w-[8rem]">표준 카테고리</th>
                              <th className="py-1.5 px-2 font-medium text-right whitespace-nowrap">금액</th>
                              <th className="py-1.5 px-2 font-medium min-w-[8rem]">결제 방법</th>
                              <th className="py-1.5 px-2 font-medium min-w-[9rem]">명세 대조 현황</th>
                              <th className="py-1.5 px-2 font-medium min-w-[8rem]">대조 금융 계정</th>
                              <th className="py-1.5 px-2 font-medium min-w-[8rem] whitespace-nowrap">투어·예약 상세</th>
                              <th className="py-1.5 px-2 font-medium min-w-[16rem] w-[16rem]">참고</th>
                              <th className="py-1.5 px-2 font-medium w-16 whitespace-nowrap">수정</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.map((row, ri) => (
                              <Fragment key={row.source_key}>
                              <tr
                                className={`border-b border-amber-100/90 align-top ${
                                  selectedDeleteKeySet.has(row.source_key) ? 'bg-red-50/80' : ri === 0 ? 'bg-amber-50/95' : 'bg-white'
                                } ${editingSourceKey === row.source_key ? 'ring-1 ring-inset ring-blue-300' : ''}`}
                              >
                                <td className="py-2 px-2 text-center align-middle">
                                  <input
                                    type="checkbox"
                                    className="h-3.5 w-3.5 accent-red-600"
                                    checked={selectedDeleteKeySet.has(row.source_key)}
                                    onChange={(e) => toggleDeleteKey(groupKey, row.source_key, e.target.checked)}
                                    aria-label={`그룹 ${displayGroupNo}에서 삭제할 지출 선택`}
                                  />
                                </td>
                                <td className="py-2 px-2 whitespace-nowrap text-slate-800 font-medium">
                                  {UNIFIED_EXPENSE_SOURCE_LABEL[row.source_table]}
                                </td>
                                <td className="py-2 px-2 align-top">
                                  <div className="flex flex-col gap-1">
                                    <span
                                      className={`inline-flex w-fit rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                        ri === 0 ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-800'
                                      }`}
                                    >
                                      {ri === 0 ? '기준' : '비슷'}
                                    </span>
                                    <span className="font-mono text-[10px] leading-snug break-all text-slate-900">
                                      {row.id}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2 px-2 whitespace-nowrap text-slate-800">
                                  {row.submit_on ? String(row.submit_on).slice(0, 10) : '—'}
                                </td>
                                <td className="py-2 px-2 break-words text-slate-800">{row.paid_to?.trim() || '—'}</td>
                                <td className="py-2 px-2 break-words text-slate-800">{row.paid_for?.trim() || '—'}</td>
                                <td className="py-2 px-2 break-words text-slate-800">{standardCategoryCell(row)}</td>
                                <td className="py-2 px-2 text-right tabular-nums text-slate-900 font-medium">
                                  {row.amount != null && Number.isFinite(row.amount)
                                    ? `$${row.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                                    : '—'}
                                </td>
                                <td className="py-2 px-2 break-words text-slate-800">{row.display_payment_method}</td>
                                <td className="py-2 px-2 break-words text-slate-800">{row.display_statement_status}</td>
                                <td className="py-2 px-2 break-words text-slate-800">
                                  {row.display_financial_account ?? '—'}
                                </td>
                                <td className="py-2 px-2 align-top">
                                  <LedgerDetailLinksCell
                                    row={row}
                                    onOpenTour={setTourDetailModalId}
                                    onOpenReservation={setReservationDetailModalId}
                                  />
                                </td>
                                <td className="py-2 px-2 align-top text-slate-600 text-[10px] min-w-[16rem] w-[16rem]">
                                  <LedgerReferenceCell
                                    tourRef={row.tour_reference}
                                    fallbackText={row.source_context}
                                    locale={locale}
                                  />
                                </td>
                                <td className="py-2 px-2 align-top">
                                  {editingSourceKey === row.source_key ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-[10px] px-2"
                                      disabled={editSaving}
                                      onClick={cancelExpenseEdit}
                                    >
                                      취소
                                    </Button>
                                  ) : (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-[10px] px-2"
                                      disabled={editSaving}
                                      onClick={() => startExpenseEdit(row)}
                                    >
                                      수정
                                    </Button>
                                  )}
                                </td>
                              </tr>
                              {editingSourceKey === row.source_key && editDraft ? (
                                <tr className="bg-blue-50/40 border-b border-amber-100/90">
                                  <td colSpan={LEDGER_TABLE_COL_COUNT} className="py-2 px-2">
                                    <UnifiedExpenseInlineEditForm
                                      row={row}
                                      draft={editDraft}
                                      onDraftChange={setEditDraft}
                                      saving={editSaving}
                                      onSave={() => void saveExpenseEdit(row)}
                                      onCancel={cancelExpenseEdit}
                                    />
                                  </td>
                                </tr>
                              ) : null}
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
                {(filteredLedgerGroups?.length ?? 0) > ledgerPageSize ? (
                  <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-2 pt-1 pb-2 text-xs text-slate-700 border-t border-slate-100">
                    <p className="tabular-nums text-slate-600">
                      그룹 {(safeLedgerPage - 1) * ledgerPageSize + 1}–
                      {Math.min(safeLedgerPage * ledgerPageSize, filteredLedgerGroups?.length ?? 0)} /{' '}
                      {filteredLedgerGroups?.length ?? 0}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1.5 text-slate-600 whitespace-nowrap">
                        <span>페이지당</span>
                        <select
                          value={ledgerPageSize}
                          onChange={(e) => setLedgerPageSize(Number(e.target.value))}
                          className="border border-slate-300 rounded-md px-2 py-1 text-xs bg-white"
                        >
                          {LEDGER_GROUP_PAGE_SIZES.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                        <span>그룹</span>
                      </label>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs px-2.5"
                          disabled={safeLedgerPage <= 1}
                          onClick={() => setLedgerPage(safeLedgerPage - 1)}
                        >
                          이전
                        </Button>
                        <span className="tabular-nums font-medium text-slate-800 min-w-[5.5rem] text-center px-1">
                          {safeLedgerPage} / {ledgerTotalPages}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs px-2.5"
                          disabled={safeLedgerPage >= ledgerTotalPages}
                          onClick={() => setLedgerPage(safeLedgerPage + 1)}
                        >
                          다음
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <DialogFooter className="px-3 sm:px-4 py-3 border-t border-slate-100 shrink-0 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            {mode === 'ledger' ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1.5 w-full sm:w-auto h-10"
                disabled={loading}
                onClick={() => setDeletedVaultOpen(true)}
              >
                <Archive className="h-4 w-4 shrink-0" aria-hidden />
                삭제된 지출 보관함
              </Button>
            ) : (
              <span className="hidden sm:block" />
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto h-10"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog modal={false} open={tourDetailModalId != null} onOpenChange={(v) => !v && setTourDetailModalId(null)}>
        <DialogContent
          className="w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden z-[110] sm:rounded-lg"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 border-b border-gray-200 px-4 py-3 pr-12 shrink-0 text-left">
            <DialogTitle className="text-base font-semibold">투어 상세</DialogTitle>
            {tourDetailModalId ? (
              <a
                href={`/${locale}/admin/tours/${tourDetailModalId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 shrink-0 ml-2"
              >
                새 탭에서 열기
                <ExternalLink size={14} aria-hidden />
              </a>
            ) : null}
          </DialogHeader>
          {tourDetailModalId ? (
            <div className="flex min-h-0 flex-1 flex-col bg-white">
              <TourDetailModalContent tourId={tourDetailModalId} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        modal={false}
        open={reservationDetailModalId != null}
        onOpenChange={(v) => !v && setReservationDetailModalId(null)}
      >
        <DialogContent
          className="w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden z-[110] sm:rounded-lg"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 border-b border-gray-200 px-4 py-3 pr-12 shrink-0 text-left">
            <DialogTitle className="text-base font-semibold">예약 상세</DialogTitle>
            {reservationDetailModalId ? (
              <a
                href={`/${locale}/admin/reservations/${reservationDetailModalId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 shrink-0 ml-2"
              >
                새 탭에서 열기
                <ExternalLink size={14} aria-hidden />
              </a>
            ) : null}
          </DialogHeader>
          {reservationDetailModalId ? (
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <iframe
                src={`/${locale}/admin/reservations/${reservationDetailModalId}`}
                className="w-full h-full min-h-0 flex-1 border-0"
                title="예약 상세"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {mode === 'ledger' ? (
        <DeletedUnifiedExpensesModal
          open={deletedVaultOpen}
          onOpenChange={setDeletedVaultOpen}
          onRestored={() => {
            void reloadLedger()
            onAfterLedgerMutation?.()
          }}
        />
      ) : null}
    </>
  )
}
