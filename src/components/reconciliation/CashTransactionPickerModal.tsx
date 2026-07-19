'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useOperatorOptional } from '@/contexts/OperatorContext'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { addCalendarDaysYmd } from '@/lib/expense-reconciliation-similar-lines'
import {
  fetchCashWithdrawalCategories,
  fetchCashWithdrawalsForPicker,
  type SimilarCashTransactionRow,
} from '@/lib/expense-cash-ledger-match'

const CATEGORY_ALL = '__all__'
const EMPTY_LINKED_CASH_IDS = new Set<string>()

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedId: string | null
  onConfirm: (row: SimilarCashTransactionRow) => void
  ledgerDateYmd?: string
  ledgerAmount?: number
  linkedCashIds?: Set<string>
  nestedElevated?: boolean
}

const PICKER_MODAL_SHELL_CLASS = cn(
  '!flex !flex-col gap-0 overflow-hidden p-0 lg:p-6',
  'max-lg:fixed max-lg:inset-x-0 max-lg:top-[var(--header-height,4rem)] max-lg:bottom-[calc(var(--footer-height,4rem)+env(safe-area-inset-bottom,0px))] max-lg:translate-x-0 max-lg:translate-y-0 max-lg:h-auto max-lg:max-h-none max-lg:w-full max-lg:max-w-none max-lg:rounded-none max-lg:border-0 max-lg:shadow-none',
  'lg:top-[50%] lg:left-[50%] lg:translate-x-[-50%] lg:translate-y-[-50%] lg:max-h-[90vh] lg:h-auto lg:w-full lg:max-w-[min(98vw,72rem)] lg:rounded-lg lg:border lg:shadow-lg'
)

export default function CashTransactionPickerModal({
  open,
  onOpenChange,
  selectedId,
  onConfirm,
  ledgerDateYmd = '',
  ledgerAmount = 0,
  linkedCashIds = EMPTY_LINKED_CASH_IDS,
  nestedElevated = false,
}: Props) {
  const t = useTranslations('expenses.statementRecon.cashPicker')
  const { operatorId } = useOperatorOptional()
  const activeOperatorId = resolveOperatorId(operatorId)

  const defaultStart = useMemo(() => {
    const base = ledgerDateYmd?.slice(0, 10)
    if (base && base.length >= 10) return addCalendarDaysYmd(base, -60)
    return '2025-01-01'
  }, [ledgerDateYmd])

  const defaultEnd = useMemo(() => {
    const base = ledgerDateYmd?.slice(0, 10)
    if (base && base.length >= 10) return addCalendarDaysYmd(base, 60)
    return ''
  }, [ledgerDateYmd])

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [amountSearchInput, setAmountSearchInput] = useState('')
  const [amountSearch, setAmountSearch] = useState('')
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(defaultEnd)
  const [category, setCategory] = useState(CATEGORY_ALL)
  const [categories, setCategories] = useState<string[]>([])
  const [rows, setRows] = useState<SimilarCashTransactionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [pickId, setPickId] = useState<string | null>(selectedId)
  const loadGenRef = useRef(0)

  const linkedCashIdsRef = useRef(linkedCashIds)
  linkedCashIdsRef.current = linkedCashIds

  const loadRows = useCallback(async () => {
    const gen = ++loadGenRef.current
    setLoading(true)
    setMessage(null)
    try {
      const list = await fetchCashWithdrawalsForPicker(supabase, {
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(amountSearch.trim() ? { amountSearch: amountSearch.trim() } : {}),
        ...(startDate ? { startDateYmd: startDate } : {}),
        ...(endDate ? { endDateYmd: endDate } : {}),
        category: category === CATEGORY_ALL ? null : category,
        linkedCashIds: linkedCashIdsRef.current,
        ledgerDateYmd,
        ledgerAmount,
        limit: 400,
        operatorId: activeOperatorId,
      })
      if (gen !== loadGenRef.current) return
      setRows(list)
    } catch (e) {
      if (gen !== loadGenRef.current) return
      setRows([])
      setMessage(e instanceof Error ? e.message : t('loadError'))
    } finally {
      if (gen === loadGenRef.current) setLoading(false)
    }
  }, [search, amountSearch, startDate, endDate, category, ledgerDateYmd, ledgerAmount, activeOperatorId, t])

  const applyTextSearch = useCallback(() => {
    setSearch(searchInput.trim())
    setAmountSearch(amountSearchInput.trim())
  }, [searchInput, amountSearchInput])

  useEffect(() => {
    if (!open) return
    setPickId(selectedId)
    setSearchInput('')
    setSearch('')
    setAmountSearchInput('')
    setAmountSearch('')
    setStartDate(defaultStart)
    setEndDate(defaultEnd)
    setCategory(CATEGORY_ALL)
    void fetchCashWithdrawalCategories(supabase, activeOperatorId)
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [open, selectedId, defaultStart, defaultEnd, activeOperatorId])

  useEffect(() => {
    if (!open) return
    void loadRows()
  }, [open, loadRows])

  const pickedRow = rows.find((r) => r.id === pickId) ?? null

  const handleConfirm = () => {
    if (!pickedRow) {
      setMessage(t('needSelect'))
      return
    }
    onConfirm(pickedRow)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        {...(nestedElevated ? { overlayClassName: 'z-[1400]' } : {})}
        className={cn(PICKER_MODAL_SHELL_CLASS, nestedElevated && 'z-[1400]')}
      >
        <DialogHeader className="shrink-0 border-b bg-white px-3 py-2.5 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:pr-8">
          <DialogTitle className="text-base lg:text-lg leading-snug text-left">{t('title')}</DialogTitle>
          <p className="hidden lg:block text-sm text-muted-foreground pt-1 text-left">{t('hint')}</p>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden gap-2 px-3 py-2 lg:gap-3 lg:px-0 lg:py-0">
        <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:flex-wrap">
            <div className="flex flex-col sm:flex-row flex-1 min-w-0 gap-2">
              <Input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    applyTextSearch()
                  }
                }}
                placeholder={t('searchPlaceholder')}
                className="h-9 text-sm flex-1 min-w-0"
              />
              <Button type="button" className="h-9 w-full sm:w-auto shrink-0 px-3" onClick={applyTextSearch}>
                {t('searchButton')}
              </Button>
            </div>
            <div className="w-full sm:w-[9.5rem]">
              <Input
                type="search"
                inputMode="decimal"
                value={amountSearchInput}
                onChange={(e) => setAmountSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    applyTextSearch()
                  }
                }}
                placeholder={t('amountSearchPlaceholder')}
                className="h-9 text-sm"
                aria-label={t('amountSearchLabel')}
              />
            </div>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 w-full sm:w-[10.5rem] text-sm"
              aria-label={t('startDate')}
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 w-full sm:w-[10.5rem] text-sm"
              aria-label={t('endDate')}
            />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 w-full sm:w-[10rem] text-sm">
                <SelectValue placeholder={t('categoryAll')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CATEGORY_ALL}>{t('categoryAll')}</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" className="h-9 w-full sm:w-auto shrink-0" onClick={() => void loadRows()}>
              {t('refresh')}
            </Button>
          </div>
          {amountSearch.trim() ? (
            <p className="hidden lg:block text-[11px] text-amber-900/80 leading-snug">{t('amountSearchHint')}</p>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
          <div className="shrink-0 border-b border-amber-200/80 bg-amber-50/70 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-amber-950">
            {t('resultsCount', { count: rows.length })}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain mobile-scroll">
          {message ? <div className="p-2 text-sm text-red-600">{message}</div> : null}
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{t('loading')}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{t('empty')}</p>
          ) : (
            <>
              <div className="md:hidden divide-y">
                {rows.map((r) => {
                  const selected = pickId === r.id
                  return (
                    <div
                      key={r.id}
                      className={`p-3 cursor-pointer active:bg-muted/50 ${
                        selected ? 'bg-amber-100/80' : ''
                      } ${r.linked_to_this_expense ? 'ring-1 ring-inset ring-emerald-400/45' : ''}`}
                      onClick={() => setPickId(r.id)}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="radio"
                          name="cash-picker-row"
                          className="mt-0.5 shrink-0"
                          checked={selected}
                          onChange={() => setPickId(r.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={r.description}
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium tabular-nums">
                            <span>{r.transaction_date}</span>
                            <span className="text-rose-800">${r.amount.toFixed(2)}</span>
                            {r.linked_to_this_expense ? (
                              <span className="text-[10px] text-emerald-800 font-medium">({t('linkedBadge')})</span>
                            ) : null}
                          </div>
                          <p className="text-sm break-words">{r.description || '—'}</p>
                          {r.category ? (
                            <p className="text-xs text-muted-foreground">{r.category}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-[1]">
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>{t('colDate')}</TableHead>
                  <TableHead className="text-right">{t('colAmount')}</TableHead>
                  <TableHead>{t('colDesc')}</TableHead>
                  <TableHead>{t('colCategory')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const selected = pickId === r.id
                  return (
                    <TableRow
                      key={r.id}
                      className={`cursor-pointer ${selected ? 'bg-amber-100/80' : 'hover:bg-muted/50'} ${
                        r.linked_to_this_expense ? 'ring-1 ring-inset ring-emerald-400/45' : ''
                      }`}
                      onClick={() => setPickId(r.id)}
                    >
                      <TableCell className="align-middle" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="radio"
                          name="cash-picker-row"
                          checked={selected}
                          onChange={() => setPickId(r.id)}
                          aria-label={r.description}
                        />
                      </TableCell>
                      <TableCell className="tabular-nums whitespace-nowrap text-sm">{r.transaction_date}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-rose-800 text-sm">
                        ${r.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm max-w-[18rem]">
                        <span className="line-clamp-2" title={r.description}>
                          {r.description}
                        </span>
                        {r.linked_to_this_expense ? (
                          <span className="ml-1 text-[10px] text-emerald-800 font-medium">({t('linkedBadge')})</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-[10rem]" title={r.category ?? undefined}>
                        {r.category || '—'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
              </div>
            </>
          )}
          </div>
        </div>
        </div>

        <DialogFooter className="shrink-0 border-t bg-white px-3 py-2.5 lg:px-0 lg:py-0 lg:pt-3 lg:mt-2 gap-2 flex-col-reverse lg:flex-row pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:pb-0">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button type="button" className="w-full sm:w-auto" disabled={!pickId || loading} onClick={handleConfirm}>
            {t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
