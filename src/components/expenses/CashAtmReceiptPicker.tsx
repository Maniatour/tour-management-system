'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link2, Loader2, Search, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  addCalendarDaysYmd,
  ATM_RECEIPT_DAY_WINDOW,
  atmToAccountLinkError,
  cashTransactionDateYmd,
  isTripManiaAtmToAccount,
  TRIP_MANIA_ATM_TO_ACCOUNT,
  type ParsedWellsFargoAtmReceipt,
} from '@/lib/wellsFargoAtmReceipt'

type AtmReceiptListItem = {
  id: string
  subject: string | null
  from: string | null
  receivedAt: string | null
  parsed: ParsedWellsFargoAtmReceipt
  linkedCashTransactionId: string | null
  bodyPending: boolean
}

type AtmReceiptPreviewPayload = {
  id: string
  subject: string | null
  receivedAt: string | null
  html: string | null
  text: string | null
  parsed: ParsedWellsFargoAtmReceipt
  error?: string
}

function formatUsd(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatYmd(ymd: string | null | undefined): string {
  if (!ymd) return '—'
  return ymd.slice(0, 10)
}

function itemDateYmd(item: AtmReceiptListItem): string {
  return item.parsed.depositDateYmd || (item.receivedAt ? item.receivedAt.slice(0, 10) : '')
}

function itemMatchesQuery(item: AtmReceiptListItem, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = [
    item.subject,
    item.from,
    item.parsed.amount != null ? String(item.parsed.amount) : '',
    itemDateYmd(item),
    item.parsed.toAccount,
    item.parsed.transactionNumber,
    item.parsed.atmId,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

function minutesApart(aIso: string | null | undefined, bIso: string | null | undefined): number | null {
  if (!aIso || !bIso) return null
  const a = new Date(aIso).getTime()
  const b = new Date(bIso).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return Math.abs(a - b) / 60000
}

function scoreItem(item: AtmReceiptListItem, amount: number, dateYmd: string, transactionDate: string): number {
  let score = 0
  if (item.parsed.amount != null && Math.abs(item.parsed.amount - amount) <= 0.51) {
    score += Math.abs(item.parsed.amount - amount) < 0.02 ? 40 : 20
  }
  const emailDate = itemDateYmd(item)
  if (dateYmd && emailDate) {
    if (emailDate === dateYmd) score += 30
    else if (emailDate === addCalendarDaysYmd(dateYmd, -1) || emailDate === addCalendarDaysYmd(dateYmd, 1)) score += 15
    else if (emailDate === addCalendarDaysYmd(dateYmd, -2) || emailDate === addCalendarDaysYmd(dateYmd, 2)) score += 5
  }
  const mins = minutesApart(item.receivedAt, transactionDate)
  if (mins != null) {
    if (mins <= 15) score += 50
    else if (mins <= 60) score += 25
    else if (mins <= 24 * 60) score += 10
  }
  if (isTripManiaAtmToAccount(item.parsed.toAccount)) score += 35
  else if (item.parsed.toAccount) score -= 80
  return score
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const atmBodyCache = new Map<string, AtmReceiptPreviewPayload>()
const atmBodyInflight = new Map<string, Promise<AtmReceiptPreviewPayload>>()

function loadAtmReceiptPreview(importId: string): Promise<AtmReceiptPreviewPayload> {
  const cached = atmBodyCache.get(importId)
  if (cached && (cached.html || cached.text)) return Promise.resolve(cached)
  const inflight = atmBodyInflight.get(importId)
  if (inflight) return inflight
  const req = (async () => {
    const res = await fetchApiWithAuth(`/api/admin/cash-transactions/atm-receipt/${importId}`)
    const json = (await res.json().catch(() => ({}))) as AtmReceiptPreviewPayload
    if (!res.ok) throw new Error(json.error || res.statusText)
    atmBodyCache.set(importId, json)
    return json
  })()
  atmBodyInflight.set(importId, req)
  return req.finally(() => {
    atmBodyInflight.delete(importId)
  })
}

function AtmReceiptBodyView({
  importId,
  onParsed,
}: {
  importId: string
  onParsed: (importId: string, parsed: ParsedWellsFargoAtmReceipt) => void
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<AtmReceiptPreviewPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const json = await loadAtmReceiptPreview(importId)
        if (cancelled) return
        setData(json)
        onParsed(importId, json.parsed)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [importId, onParsed])

  if (loading) {
    return (
      <p className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Gmail에서 본문 불러오는 중…
      </p>
    )
  }
  if (error || !data) {
    return <p className="px-3 py-3 text-sm text-red-600">{error || '메일을 찾을 수 없습니다.'}</p>
  }

  const srcDoc = data.html
    ? data.html.replace(/<script[\s\S]*?<\/script>/gi, '')
    : `<pre style="white-space:pre-wrap;font:14px/1.5 system-ui,sans-serif;padding:12px">${escapeHtml(
        data.text || '본문이 없습니다.'
      )}</pre>`

  return (
    <iframe
      title={data.subject || 'ATM Receipt'}
      sandbox=""
      srcDoc={srcDoc}
      className="h-56 w-full rounded-md border border-border bg-white"
    />
  )
}

export default function CashAtmReceiptPicker({
  open,
  onOpenChange,
  cashTransactionId,
  amount,
  transactionDate,
  linkedImportId,
  onLinked,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cashTransactionId: string
  amount: number
  transactionDate: string
  linkedImportId?: string | null | undefined
  onLinked: () => void | Promise<void>
}) {
  const dateYmd = cashTransactionDateYmd(transactionDate)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<AtmReceiptListItem[]>([])
  const [query, setQuery] = useState('')

  const applyParsed = useCallback((importId: string, parsed: ParsedWellsFargoAtmReceipt) => {
    setItems((prev) =>
      prev.map((item) => (item.id === importId ? { ...item, parsed, bodyPending: false } : item))
    )
  }, [])

  const loadItems = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateYmd) params.set('date', dateYmd)
      if (linkedImportId) params.set('linked', linkedImportId)
      const syncRes = await fetchApiWithAuth(
        `/api/admin/cash-transactions/atm-receipt-sync?${params.toString()}`
      )
      const syncJson = (await syncRes.json().catch(() => ({}))) as {
        items?: Array<{
          id: string
          subject: string | null
          from: string | null
          receivedAt: string | null
          parsed: ParsedWellsFargoAtmReceipt
          linkedCashTransactionId: string | null
        }>
        error?: string
        gmailError?: string | null
        searched?: number
        imported?: number
      }
      if (!syncRes.ok) throw new Error(syncJson.error || 'Gmail ATM 메일을 가져오지 못했습니다.')
      if (syncJson.gmailError) setError(syncJson.gmailError)

      const mapped: AtmReceiptListItem[] = (syncJson.items ?? []).map((row) => ({
        id: row.id,
        subject: row.subject,
        from: row.from,
        receivedAt: row.receivedAt,
        parsed: {
          amount: row.parsed?.amount ?? null,
          depositDateYmd: row.parsed?.depositDateYmd ?? null,
          transactionNumber: row.parsed?.transactionNumber ?? null,
          atmId: row.parsed?.atmId ?? null,
          last4: row.parsed?.last4 ?? null,
          toAccount: row.parsed?.toAccount ?? null,
        },
        linkedCashTransactionId: row.linkedCashTransactionId ?? null,
        bodyPending: row.parsed?.amount == null,
      }))
      setItems(mapped)
      if (!syncJson.gmailError && mapped.length === 0 && dateYmd) {
        setError(
          `거래일 전후 Gmail에서 ATM Receipt를 찾지 못했습니다. (검색 ${syncJson.searched ?? 0}건)`
        )
      }
      setLoading(false)
      if (linkedImportId) void loadAtmReceiptPreview(linkedImportId)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setItems([])
      setLoading(false)
    }
  }, [dateYmd, linkedImportId])

  useEffect(() => {
    if (open) void loadItems()
  }, [open, loadItems, cashTransactionId])

  const visible = useMemo(() => {
    return [...items]
      .filter((item) => itemMatchesQuery(item, query))
      .sort((a, b) => scoreItem(b, amount, dateYmd, transactionDate) - scoreItem(a, amount, dateYmd, transactionDate))
  }, [items, query, amount, dateYmd, transactionDate])

  const recommendedId = useMemo(() => {
    const best = visible[0]
    if (!best) return null
    const score = scoreItem(best, amount, dateYmd, transactionDate)
    if (score < 50) return null
    if (best.parsed.toAccount && !isTripManiaAtmToAccount(best.parsed.toAccount)) return null
    return best.id
  }, [visible, amount, dateYmd, transactionDate])

  const linkItem = async (importId: string) => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const preview = await loadAtmReceiptPreview(importId)
      applyParsed(importId, preview.parsed)
      const toError = atmToAccountLinkError(preview.parsed)
      if (toError) throw new Error(toError)

      const { data: taken } = await supabase
        .from('cash_transactions')
        .select('id')
        .eq('atm_receipt_import_id', importId)
        .neq('id', cashTransactionId)
        .maybeSingle()
      if (taken?.id) throw new Error('이 메일은 다른 은행 Deposit에 이미 연결되어 있습니다.')

      const { error: updErr } = await supabase
        .from('cash_transactions')
        .update({
          atm_receipt_import_id: importId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cashTransactionId)
      if (updErr) throw updErr
      toast.success('ATM 메일을 연결했습니다.')
      await onLinked()
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const unlink = async () => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const { error: updErr } = await supabase
        .from('cash_transactions')
        .update({
          atm_receipt_import_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cashTransactionId)
      if (updErr) throw updErr
      toast.success('ATM 메일 연결을 해제했습니다.')
      await onLinked()
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>ATM Receipt 연결</DialogTitle>
            <DialogDescription>
              거래일 ±{ATM_RECEIPT_DAY_WINDOW}일 안의 Wells Fargo ATM Receipt 메일을 보여 줍니다.
              To: {TRIP_MANIA_ATM_TO_ACCOUNT} 입금만 연결합니다.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            거래 {formatUsd(amount)} · {formatYmd(dateYmd)}
          </p>
          {linkedImportId ? (
            <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => void unlink()}>
              <Unlink className="w-4 h-4 mr-1.5" />
              연결 해제
            </Button>
          ) : null}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="금액, 날짜, Transaction # 검색"
              className="w-full h-10 rounded-lg border border-input bg-background pl-8 pr-3 text-sm"
            />
          </div>
          {error ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-red-600">{error}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadItems()}>
                다시 시도
              </Button>
            </div>
          ) : null}
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="w-4 h-4 animate-spin" />
              Gmail에서 ATM 메일 찾는 중…
            </p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">
              거래일 ±{ATM_RECEIPT_DAY_WINDOW}일 안의 ATM Receipt 메일이 없습니다.
            </p>
          ) : (
            <ul className="space-y-2">
              {visible.map((item) => {
                const linkedHere = item.linkedCashTransactionId === cashTransactionId
                const linkedOther = Boolean(item.linkedCashTransactionId && !linkedHere)
                const recommended = item.id === recommendedId
                const toOk = isTripManiaAtmToAccount(item.parsed.toAccount)
                const toKnownBad = Boolean(item.parsed.toAccount) && !toOk
                const mins = minutesApart(item.receivedAt, transactionDate)
                return (
                  <li
                    key={item.id}
                    className={`rounded-lg border p-3 space-y-2 ${
                      linkedHere || (recommended && !toKnownBad) ? 'border-violet-300 bg-violet-50/40' : 'border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.subject || 'ATM Receipt'}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatUsd(item.parsed.amount)} · {formatYmd(itemDateYmd(item))}
                          {item.parsed.transactionNumber ? ` · #${item.parsed.transactionNumber}` : ''}
                        </p>
                        {item.parsed.toAccount ? (
                          <p className={`text-[11px] mt-0.5 ${toOk ? 'text-emerald-700' : 'text-red-600'}`}>
                            To: {item.parsed.toAccount}
                          </p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            To: {TRIP_MANIA_ATM_TO_ACCOUNT} 확인 필요
                          </p>
                        )}
                        {mins != null && mins <= 15 ? (
                          <p className="text-[11px] text-violet-700 mt-0.5">수신 시각이 거래와 {Math.round(mins)}분 차이</p>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {linkedHere ? (
                          <span className="text-[11px] font-medium text-violet-700">연결됨</span>
                        ) : linkedOther ? (
                          <span className="text-[11px] font-medium text-muted-foreground">다른 거래</span>
                        ) : toKnownBad ? (
                          <span className="text-[11px] font-medium text-red-600">다른 계좌</span>
                        ) : recommended ? (
                          <span className="text-[11px] font-medium text-violet-700">추천</span>
                        ) : null}
                        {!linkedHere && !linkedOther && !toKnownBad ? (
                          <Button type="button" size="sm" disabled={saving} onClick={() => void linkItem(item.id)}>
                            <Link2 className="w-4 h-4 mr-1" />
                            연결
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <AtmReceiptBodyView importId={item.id} onParsed={applyParsed} />
                  </li>
                )
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>
  )
}
