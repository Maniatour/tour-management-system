'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import {
  aggregateOtaFileRowsByRn,
  extractOtaRowsFromLooseText,
  extractOtaRowsFromTable,
  guessRnAndAmountColumnIndexes,
  parseTextToTable,
  reconcileOtaAgainstSystem,
  type ReconcileResultRow,
  type ReconcileRowStatus,
  type SystemReservationForOta,
  type OtaFileRow,
} from '@/utils/otaSettlementReconciliation'

/** 통계 화면 필터·날짜와 무관하게 DB에서 해당 채널 예약 전부 */
async function fetchAllReservationsForChannel(channelId: string): Promise<SystemReservationForOta[]> {
  const pageSize = 1000
  let from = 0
  const allRaw: { id: string; channel_rn: string | null; status: string | null }[] = []
  while (true) {
    const { data, error } = await supabase
      .from('reservations')
      .select('id, channel_rn, status')
      .eq('channel_id', channelId)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data?.length) break
    allRaw.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  if (allRaw.length === 0) return []

  const pricingById: Record<string, number | null> = {}
  const ids = allRaw.map((r) => r.id)
  const chunkSize = 200
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    const { data: pr, error: pErr } = await supabase
      .from('reservation_pricing')
      .select('reservation_id, channel_settlement_amount')
      .in('reservation_id', chunk)
    if (pErr) throw pErr
    pr?.forEach((p: { reservation_id: string; channel_settlement_amount?: unknown }) => {
      const v = p.channel_settlement_amount
      if (v === null || v === undefined || v === '') {
        pricingById[p.reservation_id] = null
      } else {
        const n = Number(v)
        pricingById[p.reservation_id] = Number.isFinite(n) ? n : null
      }
    })
  }

  return allRaw.map((r) => ({
    id: r.id,
    channelRN: r.channel_rn || '',
    channelSettlementAmount: pricingById[r.id] ?? null,
    status: r.status || '',
  }))
}

export interface ChannelOtaReconciliationModalProps {
  open: boolean
  onClose: () => void
  channelId: string
  channelName: string
  onPatched: (reservationId: string) => Promise<void> | void
  canAudit: boolean
  onOpenReservation?: (reservationId: string) => void
  /**
   * 주입 시 DB 전체 조회 없이 이 목록만 시스템 쪽으로 대사 (투어 진행 내역·통계 기간과 동일).
   * 미전달 시 기존처럼 해당 채널 예약 전체를 불러와 비교.
   */
  systemReservationsOverride?: SystemReservationForOta[]
  /** 기간·화면 기준 안내 (예: 통계 날짜, 투어 탭) */
  periodNote?: string
}

const fmtUsd = (n: number | null | undefined) => {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** 표에 나온 행들의 OTA 정산·시스템 정산 열 합계 (null 행은 합산에서 제외) */
function sumComparableReconcileRows(rows: ReconcileResultRow[]): {
  otaSum: number
  sysSum: number
  diff: number
} {
  let ota = 0
  let sys = 0
  for (const r of rows) {
    if (r.otaAmount != null && Number.isFinite(Number(r.otaAmount))) ota += Number(r.otaAmount)
    if (r.systemAmount != null && Number.isFinite(Number(r.systemAmount))) sys += Number(r.systemAmount)
  }
  return {
    otaSum: Math.round(ota * 100) / 100,
    sysSum: Math.round(sys * 100) / 100,
    diff: Math.round((ota - sys) * 100) / 100,
  }
}

function statusLabel(s: ReconcileRowStatus): string {
  switch (s) {
    case 'match':
      return '일치'
    case 'mismatch':
      return '금액 차이'
    case 'ota_only':
      return '시스템에 없음'
    case 'system_only':
      return '파일에 없음'
    case 'no_amount':
      return '파일 금액 없음'
    case 'duplicate_ota':
      return '파일 RN 중복'
    case 'system_no_settlement':
      return '시스템 정산액 없음'
    default:
      return s
  }
}

function statusRowClass(s: ReconcileRowStatus): string {
  switch (s) {
    case 'match':
      return 'bg-green-50/80'
    case 'mismatch':
    case 'no_amount':
    case 'system_no_settlement':
      return 'bg-amber-50/80'
    case 'ota_only':
    case 'duplicate_ota':
      return 'bg-red-50/60'
    case 'system_only':
      return 'bg-slate-50/80'
    default:
      return ''
  }
}

type ResultFilter = 'all' | 'issue' | 'ota_only' | 'system_only'

export default function ChannelOtaReconciliationModal({
  open,
  onClose,
  channelId,
  channelName,
  onPatched,
  canAudit,
  onOpenReservation,
  systemReservationsOverride,
  periodNote,
}: ChannelOtaReconciliationModalProps) {
  const { authUser } = useAuth()
  const [fullChannelReservations, setFullChannelReservations] = useState<SystemReservationForOta[]>([])
  const [fullChannelLoading, setFullChannelLoading] = useState(false)
  const [fullChannelError, setFullChannelError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [parsedTable, setParsedTable] = useState<string[][] | null>(null)
  const [directOtaRows, setDirectOtaRows] = useState<OtaFileRow[] | null>(null)
  const [rawText, setRawText] = useState('')
  const [headerRowIndex, setHeaderRowIndex] = useState(0)
  const [rnCol, setRnCol] = useState<number>(0)
  const [amountCol, setAmountCol] = useState<number>(1)
  const [results, setResults] = useState<ReconcileResultRow[] | null>(null)
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all')
  const [patchingIds, setPatchingIds] = useState<Set<string>>(() => new Set())
  const [batchBusy, setBatchBusy] = useState(false)
  const [auditBusy, setAuditBusy] = useState(false)
  /** 대사 결과 테이블에서 Audit 일괄 처리용 선택 (행 key = ReconcileResultRow.key) */
  const [selectedResultKeys, setSelectedResultKeys] = useState<Set<string>>(() => new Set())
  const selectAllHeaderRef = useRef<HTMLInputElement>(null)
  /** 토스트 없이도 보이는 대사 안내 (문제 재현·디버깅용) */
  const [reconcileNotice, setReconcileNotice] = useState<string | null>(null)

  const usePeriodScope = systemReservationsOverride !== undefined

  const reset = useCallback(() => {
    setBusy(false)
    setParsedTable(null)
    setDirectOtaRows(null)
    setRawText('')
    setHeaderRowIndex(0)
    setRnCol(0)
    setAmountCol(1)
    setResults(null)
    setResultFilter('all')
    setPatchingIds(new Set())
    setBatchBusy(false)
    setAuditBusy(false)
    setSelectedResultKeys(new Set())
    setReconcileNotice(null)
    setFullChannelReservations([])
    setFullChannelLoading(false)
    setFullChannelError(null)
  }, [])

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  useEffect(() => {
    if (!open || !channelId) return
    let cancelled = false

    if (usePeriodScope) {
      setFullChannelLoading(false)
      setFullChannelError(null)
      setFullChannelReservations(systemReservationsOverride ?? [])
      return () => {
        /* no fetch to cancel */
      }
    }

    setFullChannelLoading(true)
    setFullChannelError(null)
    fetchAllReservationsForChannel(channelId)
      .then((rows) => {
        if (!cancelled) setFullChannelReservations(rows)
      })
      .catch((e) => {
        console.error('fetchAllReservationsForChannel', e)
        if (!cancelled) {
          setFullChannelReservations([])
          setFullChannelError(e instanceof Error ? e.message : '로드 실패')
          toast.error('채널 전체 예약을 불러오지 못했습니다.')
        }
      })
      .finally(() => {
        if (!cancelled) setFullChannelLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, channelId, usePeriodScope, systemReservationsOverride])

  const headers = useMemo(() => {
    if (!parsedTable || parsedTable.length === 0) return [] as string[]
    const idx = Math.min(headerRowIndex, parsedTable.length - 1)
    return parsedTable[idx] || []
  }, [parsedTable, headerRowIndex])

  const applyGuess = useCallback(
    (table: string[][]) => {
      if (!table.length) return
      const idx = Math.min(headerRowIndex, table.length - 1)
      const hdr = table[idx] || []
      const { rnIndex, amountIndex } = guessRnAndAmountColumnIndexes(hdr)
      const colCount = Math.max(...table.map((r) => r.length), 0)
      if (rnIndex != null) setRnCol(Math.min(rnIndex, Math.max(0, colCount - 1)))
      if (amountIndex != null) setAmountCol(Math.min(amountIndex, Math.max(0, colCount - 1)))
    },
    [headerRowIndex]
  )

  const loadFromText = useCallback(
    (text: string) => {
      setRawText(text)
      setDirectOtaRows(null)
      setResults(null)
      const table = parseTextToTable(text)
      if (table.length >= 2 && table[0].length >= 2) {
        setParsedTable(table)
        applyGuess(table)
      } else {
        setParsedTable(null)
        toast.message('표 형식이 아닙니다. PDF는 아래 「줄 단위 추출」 또는 직접 붙여넣기를 이용하세요.')
      }
    },
    [applyGuess]
  )

  useEffect(() => {
    if (parsedTable && parsedTable.length > 0) {
      applyGuess(parsedTable)
    }
  }, [headerRowIndex, parsedTable, applyGuess])

  const handleFile = async (file: File | null) => {
    if (!file) return
    setBusy(true)
    setResults(null)
    setDirectOtaRows(null)
    try {
      const fd = new FormData()
      fd.set('file', file)

      let authHeader: HeadersInit = {}
      try {
        const { data: { session } } = await supabase.auth.getSession()
        let token = session?.access_token ?? null
        if (!token && typeof window !== 'undefined') {
          token = localStorage.getItem('sb-access-token')
        }
        if (token) {
          authHeader = { Authorization: `Bearer ${token}` }
        }
      } catch {
        /* ignore */
      }

      const res = await fetch('/api/channel-settlement/parse-ota-file', {
        method: 'POST',
        headers: authHeader,
        body: fd,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error || '파일 읽기 실패')
        return
      }
      const text = String(json.text || '')
      setRawText(text)
      const table = parseTextToTable(text)
      if (table.length >= 2 && table[0].length >= 2) {
        setParsedTable(table)
        setHeaderRowIndex(0)
        applyGuess(table)
        const successMsg =
          json.kind === 'pdf'
            ? 'PDF에서 텍스트를 추출했습니다. 열 매핑을 확인하세요.'
            : json.kind === 'xlsx'
              ? `Excel${json.sheetName ? ` (${String(json.sheetName)})` : ''} 첫 시트를 불러왔습니다. 열 매핑을 확인하세요.`
              : 'CSV를 불러왔습니다.'
        toast.success(successMsg)
      } else {
        setParsedTable(null)
        if (json.kind === 'pdf') {
          toast.message('PDF에 표 형식 텍스트가 없습니다. 「줄 단위 추출」을 누르거나 CSV를 이용하세요.')
        } else if (json.kind === 'xlsx') {
          toast.message('Excel에서 표를 만들 수 없습니다. 첫 시트에 데이터가 있는지 확인하세요.')
        } else {
          toast.message('파싱할 표가 없습니다. 내용을 확인하세요.')
        }
      }
    } catch (e) {
      console.error(e)
      toast.error('파일 처리 중 오류')
    } finally {
      setBusy(false)
    }
  }

  const handleLooseExtract = () => {
    const rows = extractOtaRowsFromLooseText(rawText)
    if (rows.length === 0) {
      toast.error('추출된 RN/금액 행이 없습니다.')
      return
    }
    setDirectOtaRows(rows)
    setParsedTable(null)
    setResults(null)
    toast.success(`${rows.length}건을 줄 단위로 추출했습니다. 대사를 실행하세요.`)
  }

  const runReconcile = () => {
    setReconcileNotice(null)
    if (!channelId) {
      const msg = '채널을 먼저 선택하세요. (통계 화면에서 채널 필터를 하나 고른 뒤 다시 여세요.)'
      setReconcileNotice(msg)
      toast.error(msg)
      return
    }
    try {
      if (!usePeriodScope && fullChannelLoading) {
        const msg = '선택 채널의 전체 예약을 불러오는 중입니다. 잠시 후 다시 눌러 주세요.'
        setReconcileNotice(msg)
        toast.message(msg)
        return
      }
      if (fullChannelError) {
        const msg = `시스템 예약을 불러오지 못했습니다: ${fullChannelError}`
        setReconcileNotice(msg)
        toast.error(msg)
        return
      }
      let otaRows: OtaFileRow[] = []
      if (directOtaRows?.length) {
        otaRows = directOtaRows
      } else if (parsedTable && parsedTable.length >= 2) {
        otaRows = extractOtaRowsFromTable(parsedTable, rnCol, amountCol, headerRowIndex)
      } else {
        const msg = '표 데이터가 없습니다. 파일을 업로드하거나 「표로 파싱」·「줄 단위 추출」을 먼저 하세요.'
        setReconcileNotice(msg)
        toast.error(msg)
        return
      }
      if (otaRows.length === 0) {
        const msg =
          '파일에서 채널 RN이 있는 행이 0건입니다. 「헤더 줄」번호와 「채널 RN 열」·「OTA 정산 금액 열」이 맞는지 확인하세요.'
        setReconcileNotice(msg)
        toast.error(msg)
        return
      }
      const rawFileLineCount = otaRows.length
      const aggregatedByRn = aggregateOtaFileRowsByRn(otaRows)
      const rec = reconcileOtaAgainstSystem(aggregatedByRn, fullChannelReservations)
      setResults(rec)
      setSelectedResultKeys(new Set())
      const mism = rec.filter((r) => r.status === 'mismatch').length
      const otaOnly = rec.filter((r) => r.status === 'ota_only').length
      const systemOnly = rec.filter((r) => r.status === 'system_only').length
      const scopePart = usePeriodScope
        ? `비교 대상 예약(통계 기간·투어 진행 목록) ${fullChannelReservations.length}건`
        : `비교 대상 예약(채널 전체) ${fullChannelReservations.length}건`
      const summary = `대사 완료 · 파일 ${rawFileLineCount}행 → 동일 RN 합산 ${aggregatedByRn.length}건 · 표 ${rec.length}행 (파일 미포함·시스템만 ${systemOnly}건) · 불일치 ${mism} · OTA만 ${otaOnly} · ${scopePart}`
      setReconcileNotice(summary)
      toast.success(`대사 완료 · 표 ${rec.length}행 · 시스템만 ${systemOnly} · 불일치 ${mism} · OTA만 ${otaOnly}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '대사 처리 중 오류가 났습니다.'
      console.error('reconcile:', e)
      setReconcileNotice(msg)
      toast.error(msg)
    }
  }

  const applyOtaAmount = async (row: ReconcileResultRow) => {
    if (!row.reservationId || row.otaAmount == null) return
    setPatchingIds((prev) => new Set(prev).add(row.reservationId!))
    try {
      const rounded = Math.round(row.otaAmount * 100) / 100
      const { error } = await supabase
        .from('reservation_pricing')
        .update({ channel_settlement_amount: rounded })
        .eq('reservation_id', row.reservationId)
      if (error) throw error

      await onPatched(row.reservationId)
      setFullChannelReservations((prev) =>
        prev.map((r) => (r.id === row.reservationId ? { ...r, channelSettlementAmount: rounded } : r))
      )
      setResults((prev) =>
        prev
          ? prev.map((r) =>
              r.key === row.key
                ? {
                    ...r,
                    systemAmount: rounded,
                    status: 'match',
                    diff: null,
                  }
                : r
            )
          : prev
      )
      toast.success('채널 정산 금액을 반영했습니다.')
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setPatchingIds((prev) => {
        const next = new Set(prev)
        next.delete(row.reservationId!)
        return next
      })
    }
  }

  const applyAllMismatches = async () => {
    if (!results?.length) return
    const targets = results.filter(
      (r) =>
        (r.status === 'mismatch' || r.status === 'system_no_settlement') &&
        r.reservationId &&
        r.otaAmount != null
    )
    if (targets.length === 0) {
      toast.message('반영할 불일치 행이 없습니다.')
      return
    }
    if (!confirm(`${targets.length}건의 채널 정산 금액을 OTA 금액으로 일괄 반영할까요?`)) return
    setBatchBusy(true)
    const keys = new Set(targets.map((t) => t.key))
    try {
      for (const row of targets) {
        const rounded = Math.round(row.otaAmount! * 100) / 100
        const { error } = await supabase
          .from('reservation_pricing')
          .update({ channel_settlement_amount: rounded })
          .eq('reservation_id', row.reservationId!)
        if (error) throw error
        await onPatched(row.reservationId!)
      }
      const amountById = new Map(
        targets.map((t) => [t.reservationId!, Math.round(t.otaAmount! * 100) / 100] as const)
      )
      setFullChannelReservations((prev) =>
        prev.map((r) => {
          const amt = amountById.get(r.id)
          return amt !== undefined ? { ...r, channelSettlementAmount: amt } : r
        })
      )
      setResults((prev) =>
        prev
          ? prev.map((r) =>
              keys.has(r.key) && r.reservationId && r.otaAmount != null
                ? {
                    ...r,
                    systemAmount: Math.round(r.otaAmount * 100) / 100,
                    status: 'match' as const,
                    diff: null,
                  }
                : r
            )
          : prev
      )
      toast.success(`${targets.length}건 일괄 반영 완료`)
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : '일괄 반영 실패')
    } finally {
      setBatchBusy(false)
    }
  }

  const filteredResults = useMemo(() => {
    if (!results) return []
    const rows = results
    switch (resultFilter) {
      case 'issue':
        return rows.filter(
          (r) =>
            r.status === 'mismatch' ||
            r.status === 'ota_only' ||
            r.status === 'no_amount' ||
            r.status === 'system_no_settlement' ||
            r.status === 'system_only'
        )
      case 'ota_only':
        return rows.filter((r) => r.status === 'ota_only')
      case 'system_only':
        return rows.filter((r) => r.status === 'system_only')
      default:
        return rows
    }
  }, [results, resultFilter])

  const selectableViewKeys = useMemo(
    () => filteredResults.filter((r) => r.reservationId).map((r) => r.key),
    [filteredResults]
  )

  const selectedInViewCount = useMemo(
    () => selectableViewKeys.filter((k) => selectedResultKeys.has(k)).length,
    [selectableViewKeys, selectedResultKeys]
  )

  useEffect(() => {
    const el = selectAllHeaderRef.current
    if (!el) return
    const n = selectableViewKeys.length
    el.indeterminate = n > 0 && selectedInViewCount > 0 && selectedInViewCount < n
  }, [selectableViewKeys, selectedInViewCount])

  const toggleSelectAllInView = useCallback(() => {
    setSelectedResultKeys((prev) => {
      const keys = filteredResults.filter((r) => r.reservationId).map((r) => r.key)
      const allSelected = keys.length > 0 && keys.every((k) => prev.has(k))
      const next = new Set(prev)
      if (allSelected) keys.forEach((k) => next.delete(k))
      else keys.forEach((k) => next.add(k))
      return next
    })
  }, [filteredResults])

  const selectAllInFilteredView = useCallback(() => {
    setSelectedResultKeys((prev) => {
      const next = new Set(prev)
      filteredResults.filter((r) => r.reservationId).forEach((r) => next.add(r.key))
      return next
    })
  }, [filteredResults])

  const clearResultSelection = useCallback(() => {
    setSelectedResultKeys(new Set())
  }, [])

  const auditSelectedRows = useCallback(async () => {
    if (!canAudit || !results?.length) {
      toast.message('Audit 권한이 없습니다.')
      return
    }
    const ids = [
      ...new Set(
        results.filter((r) => selectedResultKeys.has(r.key) && r.reservationId).map((r) => r.reservationId as string)
      ),
    ]
    if (ids.length === 0) {
      toast.message('예약이 연결된 행을 선택하세요. (시스템에 없음 등은 선택할 수 없습니다)')
      return
    }
    if (!confirm(`${ids.length}건 예약에 Audit 완료를 표시할까요?`)) return
    setAuditBusy(true)
    try {
      for (const id of ids) {
        const { error } = await (supabase as any).from('reservations').update({
          amount_audited: true,
          amount_audited_at: new Date().toISOString(),
          amount_audited_by: authUser?.email ?? null,
        }).eq('id', id)
        if (error) throw error
        await onPatched(id)
      }
      toast.success(`${ids.length}건 Audit 완료`)
      setSelectedResultKeys(new Set())
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'Audit 저장 실패')
    } finally {
      setAuditBusy(false)
    }
  }, [authUser?.email, canAudit, onPatched, results, selectedResultKeys])

  const selectedAuditIdCount = useMemo(() => {
    if (!results?.length) return 0
    return new Set(
      results.filter((r) => selectedResultKeys.has(r.key) && r.reservationId).map((r) => r.reservationId as string)
    ).size
  }, [results, selectedResultKeys])

  const filteredSettlementTotals = useMemo(
    () => sumComparableReconcileRows(filteredResults),
    [filteredResults]
  )

  const fullComparableSettlementTotals = useMemo(() => {
    if (!results?.length) return sumComparableReconcileRows([])
    return sumComparableReconcileRows(results)
  }, [results])

  const colCount = useMemo(() => {
    if (!parsedTable?.length) return 1
    return Math.max(1, ...parsedTable.map((r) => r.length))
  }, [parsedTable])

  if (!open) return null

  const issueCount =
    results?.filter(
      (r) =>
        r.status === 'mismatch' ||
        r.status === 'ota_only' ||
        r.status === 'no_amount' ||
        r.status === 'system_no_settlement' ||
        r.status === 'system_only'
    ).length ?? 0

  const systemOnlyCount = results?.filter((r) => r.status === 'system_only').length ?? 0

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6 bg-black/50 overflow-y-auto">
      <div className="relative w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col rounded-xl border border-gray-200 bg-white shadow-xl my-auto">
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-blue-600 flex-shrink-0" />
              정산 비교 (OTA 파일 ↔ 시스템)
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-1" title={channelName}>
              채널: <span className="font-medium text-gray-800">{channelName || '—'}</span>
              {periodNote ? (
                <>
                  <span className="text-gray-400 mx-1">·</span>
                  <span className="text-gray-700">{periodNote}</span>
                </>
              ) : null}
              <span className="text-gray-400 mx-1">·</span>
              {usePeriodScope ? (
                <span>
                  비교 대상 예약 <span className="font-medium text-gray-800">{fullChannelReservations.length}</span>건
                  <span className="text-gray-400"> (통계 기간·투어 진행 내역 목록)</span>
                </span>
              ) : fullChannelLoading ? (
                <span className="inline-flex items-center gap-1 text-blue-700">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  전체 예약 불러오는 중…
                </span>
              ) : fullChannelError ? (
                <span className="text-red-600">예약 로드 오류</span>
              ) : (
                <span>
                  비교 대상 예약 <span className="font-medium text-gray-800">{fullChannelReservations.length}</span>건
                  <span className="text-gray-400"> (날짜·목록 필터 무관, 채널 전체)</span>
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-200/80 transition-colors"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!channelId && (
            <div className="flex items-center gap-2 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              채널 필터에서 OTA를 한 곳만 선택한 뒤 다시 여세요.
            </div>
          )}

          {channelId && (
            <div className="text-xs text-gray-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 space-y-1">
              {usePeriodScope ? (
                <p>
                  업로드 파일의 행을 <span className="font-medium">아래 목록에 있는 예약</span>(통계 기간·투어 진행 내역
                  필터와 동일)만 시스템 비교 대상으로 삼고, 부킹 번호를{' '}
                  <span className="font-medium">채널 RN</span>과 맞춥니다.
                </p>
              ) : (
                <p>
                  업로드 파일의 <span className="font-medium">모든 행</span>을, 화면의 날짜·상태 필터와 관계없이{' '}
                  <span className="font-medium">이 채널의 DB 예약 전체</span>와 채널 RN으로 비교합니다.
                </p>
              )}
              <p>
                파일에 <span className="font-medium">같은 부킹 번호(RN, 표기 변형 포함)</span>가 여러 줄(플러스/마이너스
                거래)이면 금액을 <span className="font-medium">합산</span>해 한 건으로 비교합니다.
              </p>
              <p>
                시스템 쪽 금액은 예약의 <span className="font-medium">채널 정산 금액</span>
                <span className="text-gray-500"> (reservation_pricing.channel_settlement_amount)</span>입니다.
              </p>
            </div>
          )}

          {fullChannelError && channelId && (
            <div className="flex items-center gap-2 text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {fullChannelError}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-2 p-3 rounded-lg border border-dashed border-gray-300 bg-gray-50/50 hover:border-blue-300 cursor-pointer">
              <span className="text-xs font-medium text-gray-700 flex items-center gap-2">
                <Upload className="h-4 w-4" />
                CSV, PDF 또는 Excel 업로드
              </span>
              <input
                type="file"
                accept=".csv,.pdf,.xlsx,.xlsm,.xls,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="text-xs text-gray-600 file:mr-2 file:py-1 file:px-2 file:rounded file:border file:border-gray-300 file:bg-white"
                disabled={busy || !channelId}
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
              {busy && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  처리 중…
                </span>
              )}
            </label>

            <div className="flex flex-col gap-2 p-3 rounded-lg border border-gray-200 bg-white">
              <label className="text-xs font-medium text-gray-700">텍스트 붙여넣기 (CSV/TSV)</label>
              <textarea
                className="w-full min-h-[72px] text-xs border border-gray-200 rounded-md px-2 py-1.5 font-mono"
                placeholder="헤더 포함 표를 붙여넣으세요"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                disabled={!channelId}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => loadFromText(rawText)}
                  disabled={!channelId || !rawText.trim()}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white disabled:opacity-50"
                >
                  표로 파싱
                </button>
                <button
                  type="button"
                  onClick={handleLooseExtract}
                  disabled={!channelId || !rawText.trim()}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 text-gray-700 disabled:opacity-50"
                >
                  줄 단위 추출 (PDF 등)
                </button>
              </div>
            </div>
          </div>

          {directOtaRows && (
            <div className="text-xs text-gray-600 bg-blue-50/80 border border-blue-100 rounded-lg px-3 py-2">
              줄 단위 추출 {directOtaRows.length}건 · 열 매핑 없이 대사합니다.
            </div>
          )}

          {parsedTable && parsedTable.length >= 2 && (
            <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-white">
              <p className="text-xs font-medium text-gray-800">열 매핑</p>
              <div className="flex flex-wrap gap-3 items-end">
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-gray-600">헤더 줄 (0부터)</span>
                  <input
                    type="number"
                    min={0}
                    max={Math.max(0, parsedTable.length - 2)}
                    className="border rounded px-2 py-1 w-24"
                    value={headerRowIndex}
                    onChange={(e) => setHeaderRowIndex(Math.max(0, Number(e.target.value) || 0))}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-gray-600">채널 RN 열</span>
                  <select
                    className="border rounded px-2 py-1 min-w-[140px]"
                    value={rnCol}
                    onChange={(e) => setRnCol(Number(e.target.value))}
                  >
                    {Array.from({ length: colCount }, (_, i) => (
                      <option key={i} value={i}>
                        {i}: {headers[i]?.slice(0, 28) || `(열 ${i})`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-gray-600">OTA 정산 금액 열</span>
                  <select
                    className="border rounded px-2 py-1 min-w-[140px]"
                    value={amountCol}
                    onChange={(e) => setAmountCol(Number(e.target.value))}
                  >
                    {Array.from({ length: colCount }, (_, i) => (
                      <option key={i} value={i}>
                        {i}: {headers[i]?.slice(0, 28) || `(열 ${i})`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="overflow-x-auto max-h-32 border border-gray-100 rounded text-xs">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead>
                    <tr className="bg-gray-100/80">
                      <th className="px-2 py-1 text-left font-medium text-gray-600 w-10" title="파일 줄 번호">
                        행
                      </th>
                      {Array.from({ length: colCount }, (_, ci) => (
                        <th
                          key={ci}
                          className="px-2 py-1 text-center font-medium text-gray-600 border-l border-gray-200/80 min-w-[2.5rem]"
                          title={`열 번호 ${ci}`}
                        >
                          {ci}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {parsedTable.slice(0, 4).map((r, ri) => (
                      <tr key={ri} className={ri === headerRowIndex ? 'bg-blue-50/60' : ''}>
                        <td className="px-2 py-1 text-gray-500 font-medium tabular-nums w-10" title="파일 상 줄 번호(1부터)">
                          {ri + 1}
                        </td>
                        {Array.from({ length: colCount }, (_, ci) => (
                          <td
                            key={ci}
                            className="px-2 py-1 whitespace-nowrap text-gray-700 max-w-[140px] truncate border-l border-gray-50"
                          >
                            {r[ci] != null && r[ci] !== '' ? String(r[ci]) : ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reconcileNotice && (
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${
                reconcileNotice.startsWith('대사 완료')
                  ? 'border-green-200 bg-green-50 text-green-900'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
              role="status"
            >
              {reconcileNotice}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={runReconcile}
              disabled={!channelId || busy || (!usePeriodScope && fullChannelLoading)}
              title={
                !channelId
                  ? '채널을 하나 선택한 뒤 사용할 수 있습니다.'
                  : busy
                    ? '파일 처리 중…'
                    : !usePeriodScope && fullChannelLoading
                      ? '채널 전체 예약을 불러오는 중…'
                      : usePeriodScope
                        ? '파일과 통계 기간 내 투어 목록 예약을 채널 RN으로 비교합니다.'
                        : '파일의 모든 행과 DB 채널 전체 예약을 RN으로 비교합니다.'
              }
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              대사 실행
            </button>
          </div>

          {results !== null && (
            <>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-gray-500">필터:</span>
                {(
                  [
                    ['all', '전체'],
                    ['issue', `확인 필요 (${issueCount})`],
                    ['ota_only', 'OTA만'],
                    ['system_only', `시스템만 (${systemOnlyCount})`],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setResultFilter(k)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                      resultFilter === k
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto sm:flex-1 sm:justify-end">
                  <button
                    type="button"
                    onClick={selectAllInFilteredView}
                    disabled={
                      !canAudit || batchBusy || auditBusy || selectableViewKeys.length === 0
                    }
                    className="px-2.5 py-1 rounded-md text-xs font-medium border border-gray-300 text-gray-800 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    전체 선택
                  </button>
                  <button
                    type="button"
                    onClick={clearResultSelection}
                    disabled={!canAudit || auditBusy || selectedResultKeys.size === 0}
                    className="px-2.5 py-1 rounded-md text-xs font-medium border border-gray-300 text-gray-800 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    선택 해제
                  </button>
                  <button
                    type="button"
                    onClick={() => void auditSelectedRows()}
                    disabled={!canAudit || auditBusy || batchBusy || selectedAuditIdCount === 0}
                    className="px-2.5 py-1 rounded-md text-xs font-medium border border-teal-500 text-teal-900 bg-teal-50 hover:bg-teal-100 disabled:opacity-50"
                  >
                    {auditBusy ? '처리 중…' : `선택 항목 Audit 완료 (${selectedAuditIdCount})`}
                  </button>
                  <button
                    type="button"
                    onClick={applyAllMismatches}
                    disabled={
                      batchBusy ||
                      auditBusy ||
                      !results.some(
                        (r) =>
                          (r.status === 'mismatch' || r.status === 'system_no_settlement') &&
                          r.otaAmount != null &&
                          r.reservationId
                      )
                    }
                    className="px-3 py-1.5 rounded-md text-xs font-medium border border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 disabled:opacity-50"
                  >
                    {batchBusy ? '처리 중…' : '불일치·정산없음 전체 OTA 금액 반영'}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs sm:text-sm">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-medium text-slate-700 shrink-0">정산 합계</span>
                  <span className="text-slate-600 shrink-0">(현재 표시 행, 금액 있는 셀만 합산)</span>
                  <span className="hidden sm:inline text-slate-300">·</span>
                  <span>
                    OTA{' '}
                    <strong className="tabular-nums text-indigo-900">{fmtUsd(filteredSettlementTotals.otaSum)}</strong>
                  </span>
                  <span className="text-slate-300">|</span>
                  <span>
                    시스템{' '}
                    <strong className="tabular-nums text-amber-900">{fmtUsd(filteredSettlementTotals.sysSum)}</strong>
                  </span>
                  <span className="text-slate-300">|</span>
                  <span title="OTA 정산 합계 − 시스템 정산 합계">
                    차이{' '}
                    <strong className="tabular-nums text-slate-900">{fmtUsd(filteredSettlementTotals.diff)}</strong>
                  </span>
                </div>
                {resultFilter !== 'all' && (
                  <div className="text-[11px] sm:text-xs text-slate-600 border-t border-slate-200/80 pt-1.5 leading-snug">
                    같은 기준 전체(필터 없음·대사 결과 전 행): OTA{' '}
                    <span className="font-semibold tabular-nums text-indigo-900">
                      {fmtUsd(fullComparableSettlementTotals.otaSum)}
                    </span>
                    {' · '}시스템{' '}
                    <span className="font-semibold tabular-nums text-amber-900">
                      {fmtUsd(fullComparableSettlementTotals.sysSum)}
                    </span>
                    {' · '}차이{' '}
                    <span className="font-semibold tabular-nums text-slate-900">
                      {fmtUsd(fullComparableSettlementTotals.diff)}
                    </span>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-1 py-2 w-8 text-center">
                        <input
                          ref={selectAllHeaderRef}
                          type="checkbox"
                          checked={
                            selectableViewKeys.length > 0 &&
                            selectedInViewCount === selectableViewKeys.length
                          }
                          onChange={toggleSelectAllInView}
                          disabled={!canAudit || selectableViewKeys.length === 0 || batchBusy || auditBusy}
                          title="현재 목록에서 예약이 연결된 행만 전체 선택/해제"
                          className="rounded border-gray-300 disabled:opacity-50"
                        />
                      </th>
                      <th className="px-2 py-2 text-left font-medium text-gray-600 w-9 tabular-nums" title="표시 순번">
                        #
                      </th>
                      <th className="px-2 py-2 text-left font-medium text-gray-600">상태</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-600">OTA RN</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-600">시스템 RN</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-600">예약 상태</th>
                      <th className="px-2 py-2 text-right font-medium text-gray-600">OTA 정산</th>
                      <th className="px-2 py-2 text-right font-medium text-gray-600">시스템 정산</th>
                      <th className="px-2 py-2 text-right font-medium text-gray-600">차이</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-600">작업</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredResults.map((row, rowIdx) => (
                      <tr key={row.key} className={statusRowClass(row.status)}>
                        <td className="px-1 py-2 text-center w-8" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedResultKeys.has(row.key)}
                            disabled={!canAudit || !row.reservationId || batchBusy || auditBusy}
                            onChange={(e) => {
                              setSelectedResultKeys((prev) => {
                                const next = new Set(prev)
                                if (e.target.checked) next.add(row.key)
                                else next.delete(row.key)
                                return next
                              })
                            }}
                            className="rounded border-gray-300 disabled:opacity-40"
                            title={
                              !row.reservationId
                                ? '예약이 없는 행은 Audit할 수 없습니다'
                                : !canAudit
                                  ? 'Super 권한 필요'
                                  : 'Audit 완료 일괄 표시에 포함'
                            }
                          />
                        </td>
                        <td className="px-2 py-2 text-gray-500 tabular-nums text-center w-9" title="표시 순번">
                          {rowIdx + 1}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">{statusLabel(row.status)}</td>
                        <td className="px-2 py-2 max-w-[140px]">
                          <div className="font-mono truncate" title={row.otaRn}>
                            {row.otaRn}
                          </div>
                          {(row.otaFileLineCount ?? 1) > 1 && (
                            <div
                              className="text-[10px] leading-tight text-indigo-800 mt-0.5"
                              title={
                                row.otaFileRowIndices
                                  ? `파일에서 합산한 줄 번호: ${row.otaFileRowIndices}`
                                  : undefined
                              }
                            >
                              {row.otaFileLineCount}행 합산
                              {row.otaFileRowIndices ? ` · 행 ${row.otaFileRowIndices}` : ''}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2 font-mono max-w-[120px] truncate" title={row.systemRn}>
                          {row.systemRn ?? '—'}
                        </td>
                        <td className="px-2 py-2 text-gray-700 whitespace-nowrap max-w-[100px] truncate" title={row.systemStatus ?? ''}>
                          {row.systemStatus ? String(row.systemStatus) : '—'}
                        </td>
                        <td className="px-2 py-2 text-right">{fmtUsd(row.otaAmount)}</td>
                        <td className="px-2 py-2 text-right">{fmtUsd(row.systemAmount)}</td>
                        <td className="px-2 py-2 text-right">{row.diff != null ? fmtUsd(row.diff) : '—'}</td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          <div className="flex flex-wrap gap-1">
                            {row.reservationId && onOpenReservation && (
                              <button
                                type="button"
                                className="text-blue-600 hover:underline"
                                onClick={() => {
                                  onOpenReservation(row.reservationId!)
                                }}
                              >
                                예약
                              </button>
                            )}
                            {row.status === 'mismatch' && row.reservationId && row.otaAmount != null && (
                              <button
                                type="button"
                                disabled={patchingIds.has(row.reservationId)}
                                className="px-2 py-0.5 rounded bg-amber-600 text-white disabled:opacity-50"
                                onClick={() => applyOtaAmount(row)}
                              >
                                {patchingIds.has(row.reservationId) ? '…' : 'OTA 금액 반영'}
                              </button>
                            )}
                            {row.status === 'system_no_settlement' && row.reservationId && row.otaAmount != null && (
                              <button
                                type="button"
                                disabled={patchingIds.has(row.reservationId)}
                                className="px-2 py-0.5 rounded bg-amber-600 text-white disabled:opacity-50"
                                onClick={() => applyOtaAmount(row)}
                              >
                                {patchingIds.has(row.reservationId) ? '…' : '정산액 입력'}
                              </button>
                            )}
                            {row.status === 'match' && (
                              <span className="inline-flex items-center gap-0.5 text-green-700">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
