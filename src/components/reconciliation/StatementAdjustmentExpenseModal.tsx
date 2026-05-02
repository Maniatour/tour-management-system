'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { Landmark } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  applyStandardLeafToCompanyExpense,
  matchStandardLeafIdForPaidForAndCategory
} from '@/lib/companyExpenseStandardUnified'
import type { ExpenseStandardCategoryPickRow } from '@/lib/expenseStandardCategoryPaidFor'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

export type AdjustmentStatementLine = {
  id: string
  posted_date: string
  amount: number | string
  description: string | null
  merchant: string | null
  exclude_from_pnl: boolean
}

export type AdjustmentExpenseKind =
  | 'company_expenses'
  | 'reservation_expenses'
  | 'tour_expenses'
  | 'ticket_bookings'

type TourPickRow = {
  id: string
  tour_date: string
  product_id: string | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  line: AdjustmentStatementLine | null
  email: string
  onCompleted: () => void | Promise<void>
}

const KIND_LABEL: Record<AdjustmentExpenseKind, string> = {
  company_expenses: '회사 지출',
  reservation_expenses: '예약 지출',
  tour_expenses: '투어 지출',
  ticket_bookings: '티켓(입장권)'
}

export default function StatementAdjustmentExpenseModal({
  open,
  onOpenChange,
  line,
  email,
  onCompleted
}: Props) {
  const locale = useLocale()
  const [step, setStep] = useState<'kind' | 'form'>('kind')
  const [kind, setKind] = useState<AdjustmentExpenseKind | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [tourRows, setTourRows] = useState<TourPickRow[]>([])
  const [tourPickId, setTourPickId] = useState('')

  // 회사
  const [coPaidTo, setCoPaidTo] = useState('')
  const [coPaidFor, setCoPaidFor] = useState('')
  const [coCategory, setCoCategory] = useState('')
  const [coDescription, setCoDescription] = useState('')
  const [coPaymentMethod, setCoPaymentMethod] = useState('Card')

  // 예약
  const [rePaidTo, setRePaidTo] = useState('')
  const [rePaidFor, setRePaidFor] = useState('')
  const [reReservationId, setReReservationId] = useState('')
  const [reNote, setReNote] = useState('')

  // 투어
  const [tePaidTo, setTePaidTo] = useState('')
  const [tePaidFor, setTePaidFor] = useState('')

  // 티켓
  const [tiCategory, setTiCategory] = useState('')
  const [tiCompany, setTiCompany] = useState('')
  const [tiNote, setTiNote] = useState('')

  const resetForms = useCallback(() => {
    setCoPaidTo('')
    setCoPaidFor('')
    setCoCategory('')
    setCoDescription('')
    setCoPaymentMethod('Card')
    setRePaidTo('')
    setRePaidFor('')
    setReReservationId('')
    setReNote('')
    setTePaidTo('')
    setTePaidFor('')
    setTiCategory('')
    setTiCompany('')
    setTiNote('')
    setTourPickId('')
    setError(null)
  }, [])

  useEffect(() => {
    if (!open || !line) {
      setStep('kind')
      setKind(null)
      resetForms()
      return
    }
    setCoDescription(line.description || line.merchant || '')
  }, [open, line, resetForms])

  useEffect(() => {
    if (!open || step !== 'form' || kind !== 'tour_expenses') return
    let cancelled = false
    void (async () => {
      const { data, error: fetchError } = await supabase
        .from('tours')
        .select('id, tour_date, product_id')
        .order('tour_date', { ascending: false })
        .limit(500)
      if (cancelled) return
      if (fetchError) {
        setTourRows([])
        return
      }
      setTourRows((data || []) as TourPickRow[])
    })()
    return () => {
      cancelled = true
    }
  }, [open, step, kind])

  const lineAmount = line ? Number(line.amount) : NaN
  const submitOnIso = line ? `${line.posted_date}T12:00:00.000Z` : ''

  const linkStatement = async (sourceTable: string, sourceId: string) => {
    if (!line) return
    const { error: mErr } = await supabase.from('reconciliation_matches').insert({
      statement_line_id: line.id,
      source_table: sourceTable,
      source_id: sourceId,
      matched_amount: lineAmount,
      matched_by: email || null
    })
    if (mErr) throw mErr
    const { error: uErr } = await supabase
      .from('statement_lines')
      .update({ matched_status: 'matched' })
      .eq('id', line.id)
    if (uErr) throw uErr
  }

  const handleSubmit = async () => {
    if (!line || !email || !kind) {
      setError('로그인 정보 또는 유형이 없습니다.')
      return
    }
    if (!Number.isFinite(lineAmount) || lineAmount <= 0) {
      setError('명세 금액이 올바르지 않습니다.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      if (kind === 'company_expenses') {
        if (!coPaidTo.trim() || !coPaidFor.trim() || !coCategory.trim()) {
          setError('결제처·결제내용·카테고리를 입력하세요.')
          setSaving(false)
          return
        }
        const { data: catRows, error: catErr } = await supabase
          .from('expense_standard_categories')
          .select('id, name, name_ko, parent_id, tax_deductible, display_order, is_active')
          .order('display_order', { ascending: true })
        if (catErr) throw catErr
        const cats = (catRows ?? []) as ExpenseStandardCategoryPickRow[]
        const leafId = matchStandardLeafIdForPaidForAndCategory(
          coPaidFor.trim(),
          coCategory.trim(),
          cats,
          locale
        )
        const byId = new Map(cats.map((c) => [c.id, c]))
        const applied = leafId ? applyStandardLeafToCompanyExpense(leafId, byId) : null

        const { data: ins, error: insErr } = await supabase
          .from('company_expenses')
          .insert({
            paid_to: coPaidTo.trim(),
            paid_for: coPaidFor.trim(),
            description: coDescription.trim() || null,
            amount: lineAmount,
            payment_method: coPaymentMethod.trim() || 'Card',
            submit_by: email,
            category: applied ? applied.category : coCategory.trim(),
            ...(applied
              ? {
                  standard_paid_for: applied.paid_for,
                  expense_type: applied.expense_type,
                  tax_deductible: applied.tax_deductible
                }
              : {}),
            status: 'approved',
            ledger_expense_origin: 'statement_adjustment',
            statement_line_id: line.id,
            reconciliation_status: 'reconciled',
            exclude_from_pnl: line.exclude_from_pnl,
            is_personal: false,
            personal_partner: null,
            submit_on: submitOnIso
          })
          .select('id')
          .single()
        if (insErr || !ins?.id) throw insErr || new Error('회사 지출 저장 실패')
        await linkStatement('company_expenses', String(ins.id))
      } else if (kind === 'reservation_expenses') {
        if (!rePaidTo.trim() || !rePaidFor.trim()) {
          setError('결제처·결제내용을 입력하세요.')
          setSaving(false)
          return
        }
        const newId = crypto.randomUUID()
        const { error: insErr } = await supabase.from('reservation_expenses').insert({
          id: newId,
          submitted_by: email,
          paid_to: rePaidTo.trim(),
          paid_for: rePaidFor.trim(),
          amount: lineAmount,
          payment_method: 'Card',
          submit_on: submitOnIso,
          reservation_id: reReservationId.trim() || null,
          note: reNote.trim() || null,
          status: 'approved',
          statement_line_id: line.id,
          exclude_from_pnl: line.exclude_from_pnl,
          is_personal: false
        })
        if (insErr) throw insErr
        await linkStatement('reservation_expenses', newId)
      } else if (kind === 'tour_expenses') {
        if (!tourPickId) {
          setError('투어를 선택하세요.')
          setSaving(false)
          return
        }
        if (!tePaidTo.trim() || !tePaidFor.trim()) {
          setError('지급 대상·항목을 입력하세요.')
          setSaving(false)
          return
        }
        const picked = tourRows.find((t) => t.id === tourPickId)
        if (!picked) {
          setError('선택한 투어를 찾을 수 없습니다.')
          setSaving(false)
          return
        }
        const { data: ins, error: insErr } = await supabase
          .from('tour_expenses')
          .insert({
            tour_id: picked.id,
            tour_date: picked.tour_date,
            product_id: picked.product_id,
            paid_to: tePaidTo.trim(),
            paid_for: tePaidFor.trim(),
            amount: lineAmount,
            payment_method: 'Card',
            submitted_by: email,
            submit_on: submitOnIso,
            status: 'pending',
            statement_line_id: line.id,
            exclude_from_pnl: line.exclude_from_pnl,
            is_personal: false
          })
          .select('id')
          .single()
        if (insErr || !ins?.id) throw insErr || new Error('투어 지출 저장 실패')
        await linkStatement('tour_expenses', String(ins.id))
      } else if (kind === 'ticket_bookings') {
        if (!tiCategory.trim() || !tiCompany.trim()) {
          setError('카테고리·공급업체를 입력하세요.')
          setSaving(false)
          return
        }
        const { data: ins, error: insErr } = await supabase
          .from('ticket_bookings')
          .insert({
            category: tiCategory.trim(),
            company: tiCompany.trim(),
            expense: lineAmount,
            income: 0,
            submit_on: submitOnIso,
            submitted_by: email,
            check_in_date: line.posted_date,
            time: '12:00:00',
            ea: 1,
            payment_method: 'Card',
            status: 'confirmed',
            note: tiNote.trim() || null,
            statement_line_id: line.id
          })
          .select('id')
          .single()
        if (insErr || !ins?.id) throw insErr || new Error('티켓 부킹 저장 실패')
        await linkStatement('ticket_bookings', String(ins.id))
      }

      await onCompleted()
      onOpenChange(false)
      setStep('kind')
      setKind(null)
      resetForms()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const pickKind = (k: AdjustmentExpenseKind) => {
    setKind(k)
    setStep('form')
    setError(null)
  }

  const backToKind = () => {
    setStep('kind')
    setKind(null)
    setError(null)
  }

  if (!line) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[min(90vh,720px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Landmark className="h-5 w-5 text-slate-600 shrink-0" />
            보정 지출 · 실제 지출 등록
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-slate-600">
          명세 금액 <strong className="tabular-nums">${lineAmount.toFixed(2)}</strong> · 거래일{' '}
          <strong>{line.posted_date}</strong>
        </p>

        {step === 'kind' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            {(Object.keys(KIND_LABEL) as AdjustmentExpenseKind[]).map((k) => (
              <Button
                key={k}
                type="button"
                variant="outline"
                className="h-auto py-3 justify-start text-left whitespace-normal"
                onClick={() => pickKind(k)}
              >
                {KIND_LABEL[k]}
              </Button>
            ))}
          </div>
        )}

        {step === 'form' && kind && (
          <div className="space-y-3 pt-1">
            <Button type="button" variant="ghost" size="sm" className="-ml-2 h-8" onClick={backToKind}>
              ← 유형 다시 선택
            </Button>

            {kind === 'company_expenses' && (
              <div className="space-y-2">
                <div>
                  <Label htmlFor="adj-co-paid-to">결제처 (paid_to)</Label>
                  <Input
                    id="adj-co-paid-to"
                    value={coPaidTo}
                    onChange={(e) => setCoPaidTo(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="adj-co-paid-for">결제내용 (paid_for)</Label>
                  <Input
                    id="adj-co-paid-for"
                    value={coPaidFor}
                    onChange={(e) => setCoPaidFor(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="adj-co-cat">카테고리</Label>
                  <Input
                    id="adj-co-cat"
                    value={coCategory}
                    onChange={(e) => setCoCategory(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="adj-co-desc">설명</Label>
                  <Textarea
                    id="adj-co-desc"
                    value={coDescription}
                    onChange={(e) => setCoDescription(e.target.value)}
                    rows={2}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="adj-co-pm">결제 수단</Label>
                  <Input
                    id="adj-co-pm"
                    value={coPaymentMethod}
                    onChange={(e) => setCoPaymentMethod(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {kind === 'reservation_expenses' && (
              <div className="space-y-2">
                <div>
                  <Label htmlFor="adj-re-paid-to">결제처</Label>
                  <Input
                    id="adj-re-paid-to"
                    value={rePaidTo}
                    onChange={(e) => setRePaidTo(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="adj-re-paid-for">결제내용</Label>
                  <Input
                    id="adj-re-paid-for"
                    value={rePaidFor}
                    onChange={(e) => setRePaidFor(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="adj-re-rid">예약 ID (선택)</Label>
                  <Input
                    id="adj-re-rid"
                    value={reReservationId}
                    onChange={(e) => setReReservationId(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="adj-re-note">메모</Label>
                  <Textarea
                    id="adj-re-note"
                    value={reNote}
                    onChange={(e) => setReNote(e.target.value)}
                    rows={2}
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {kind === 'tour_expenses' && (
              <div className="space-y-2">
                <div>
                  <Label>투어 (일정)</Label>
                  <Select value={tourPickId} onValueChange={setTourPickId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="투어 선택" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {tourRows.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.tour_date} · {t.product_id ?? '—'} · {t.id.slice(0, 8)}…
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {tourRows.length === 0 && (
                    <p className="text-xs text-amber-800 mt-1">투어 목록을 불러오지 못했습니다.</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="adj-te-paid-to">지급 대상 (paid_to)</Label>
                  <Input
                    id="adj-te-paid-to"
                    value={tePaidTo}
                    onChange={(e) => setTePaidTo(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="adj-te-paid-for">항목 (paid_for)</Label>
                  <Input
                    id="adj-te-paid-for"
                    value={tePaidFor}
                    onChange={(e) => setTePaidFor(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {kind === 'ticket_bookings' && (
              <div className="space-y-2">
                <div>
                  <Label htmlFor="adj-ti-cat">카테고리</Label>
                  <Input
                    id="adj-ti-cat"
                    value={tiCategory}
                    onChange={(e) => setTiCategory(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="adj-ti-company">공급업체</Label>
                  <Input
                    id="adj-ti-company"
                    value={tiCompany}
                    onChange={(e) => setTiCompany(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="adj-ti-note">메모</Label>
                  <Textarea
                    id="adj-ti-note"
                    value={tiNote}
                    onChange={(e) => setTiNote(e.target.value)}
                    rows={2}
                    className="mt-1"
                  />
                </div>
                <p className="text-xs text-slate-500">
                  체크인일은 명세 거래일({line.posted_date})로 저장합니다. 시간은 12:00으로 둡니다.
                </p>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                취소
              </Button>
              <Button type="button" onClick={() => void handleSubmit()} disabled={saving}>
                {saving ? '저장 중…' : '저장하고 명세와 연결'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
