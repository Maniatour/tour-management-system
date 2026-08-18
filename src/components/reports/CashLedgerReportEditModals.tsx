'use client'

import type { Json } from '@/lib/database.types'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useOperatorOptional } from '@/contexts/OperatorContext'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatDateTimeForDatetimeLocalInput, parseDatetimeLocalInputToISOString } from '@/utils/datetimeLocal'
import { ExpensePaidToCombobox } from '@/components/expense/ExpensePaidToCombobox'
import { isReusableExpenseVendor } from '@/lib/expenseVendors'
import {
  applyProfitSharePaidToChange,
  applyProfitShareSplitHalves,
  cashDirectEntryDescription,
  cashDirectEntryTitle,
  classifyProfitSharePartner,
  emptyProfitShareExcludeForm,
  emptyProfitShareSplitForm,
  ensureBankDepositDescription,
  excludeFormFromTransaction,
  isBankDepositDescription,
  presetCashDirectEntry,
  resolveProfitShareSplitPayload,
  splitFormFromTransaction,
  type CashDirectEntryKind,
  type ProfitShareExcludeFormFields,
  type ProfitShareSplitFormFields,
} from '@/lib/cashTransactionPurpose'
import ProfitShareExcludeFields from '@/components/expenses/ProfitShareOffsetFields'
import ProfitShareSplitFields, { ProfitSharePaidToPresets } from '@/components/expenses/ProfitShareSplitFields'

export type CashLedgerEditSource =
  | 'cash_transactions'
  | 'payment_records'
  | 'company_expenses'
  | 'reservation_expenses'

export interface CashLedgerEditTarget {
  source: CashLedgerEditSource
  id: string
}

interface CashLedgerReportEditModalsProps {
  target: CashLedgerEditTarget | null
  onDismiss: () => void
  onSaved: () => void | Promise<void>
  /** true이면 현금 거래(cash_transactions) 추가 폼을 연다 */
  addCashOpen?: boolean
  addCashKind?: CashDirectEntryKind
  onAddCashDismiss?: () => void
}

type CashFormData = ProfitShareExcludeFormFields & ProfitShareSplitFormFields & {
  transaction_date: string
  transaction_type: 'deposit' | 'withdrawal' | 'bank_deposit'
  amount: string
  description: string
  paid_to: string
}

const defaultCashForm = (kind: CashDirectEntryKind = 'deposit'): CashFormData => {
  const preset = presetCashDirectEntry(kind)
  return {
    transaction_date: formatDateTimeForDatetimeLocalInput(new Date()),
    transaction_type: preset.transaction_type,
    amount: '',
    description: preset.description,
    paid_to: '',
    ...emptyProfitShareExcludeForm(),
    ...emptyProfitShareSplitForm(),
  }
}

export default function CashLedgerReportEditModals({
  target,
  onDismiss,
  onSaved,
  addCashOpen = false,
  addCashKind = 'deposit',
  onAddCashDismiss
}: CashLedgerReportEditModalsProps) {
  const { user } = useAuth()
  const { operatorId } = useOperatorOptional()
  const activeOperatorId = resolveOperatorId(operatorId)
  const [cashOpen, setCashOpen] = useState(false)
  const [cashRow, setCashRow] = useState<Record<string, unknown> | null>(null)
  const [cashForm, setCashForm] = useState<CashFormData>(defaultCashForm)
  const [cashSaving, setCashSaving] = useState(false)
  const [paidToOptions, setPaidToOptions] = useState<string[]>([])

  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentRow, setPaymentRow] = useState<Record<string, unknown> | null>(null)

  const [companyOpen, setCompanyOpen] = useState(false)
  const [companyRow, setCompanyRow] = useState<Record<string, unknown> | null>(null)

  const [reservationOpen, setReservationOpen] = useState(false)
  const [reservationRow, setReservationRow] = useState<Record<string, unknown> | null>(null)

  const saveHistory = useCallback(
    async (
      transactionId: string,
      sourceTable: string,
      changeType: 'created' | 'updated' | 'deleted',
      oldValues: unknown,
      newValues: unknown
    ) => {
      try {
        await supabase.from('cash_transaction_history').insert({
          transaction_id: transactionId,
          source_table: sourceTable,
          change_type: changeType,
          old_values: oldValues as Json,
          new_values: newValues as Json,
          modified_by: user?.email || '',
          modified_at: new Date().toISOString()
        })
      } catch (error) {
        console.error('수정 히스토리 저장 오류:', error)
      }
    },
    [user?.email]
  )

  const loadPaidToOptions = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('expense_vendors').select('name, usage_type').order('name')
      if (error) throw error
      const names = new Set<string>()
      for (const row of data ?? []) {
        if (!isReusableExpenseVendor({ usage_type: row.usage_type === 'one_time' ? 'one_time' : 'reusable' })) continue
        const name = String(row.name ?? '').trim()
        if (name) names.add(name)
      }
      setPaidToOptions([...names])
    } catch (error) {
      console.error('결제처 목록 로드 오류:', error)
    }
  }, [])

  const cashPaidToComboboxOptions = useMemo(() => {
    const names = new Set(paidToOptions)
    const current = cashForm.paid_to.trim()
    if (current) names.add(current)
    return [...names]
  }, [paidToOptions, cashForm.paid_to])

  useEffect(() => {
    if (!cashOpen) return
    void loadPaidToOptions()
  }, [cashOpen, loadPaidToOptions])

  useEffect(() => {
    if (!addCashOpen) return
    setCashForm(defaultCashForm(addCashKind))
    setCashRow(null)
    setCashOpen(true)
  }, [addCashOpen, addCashKind])

  useEffect(() => {
    if (!target) {
      setPaymentOpen(false)
      setPaymentRow(null)
      setCompanyOpen(false)
      setCompanyRow(null)
      setReservationOpen(false)
      setReservationRow(null)
      if (!addCashOpen) {
        setCashOpen(false)
        setCashRow(null)
      }
      return
    }

    let cancelled = false

    const load = async () => {
      try {
        if (target.source !== 'cash_transactions') {
          setCashOpen(false)
          setCashRow(null)
        }

        if (target.source === 'cash_transactions') {
          const { data, error } = await supabase
            .from('cash_transactions')
            .select('*')
            .eq('operator_id', activeOperatorId)
            .eq('id', target.id)
            .single()
          if (cancelled) return
          if (error || !data) {
            toast.error('현금 거래를 불러오는 중 오류가 발생했습니다.')
            onDismiss()
            return
          }
          const desc = (data.description as string) || ''
          const isBankDeposit = isBankDepositDescription(desc)
          setCashRow(data as Record<string, unknown>)
          setCashForm({
            transaction_date: formatDateTimeForDatetimeLocalInput(data.transaction_date as string),
            transaction_type: isBankDeposit ? 'bank_deposit' : (data.transaction_type as 'deposit' | 'withdrawal'),
            amount: String(data.amount ?? ''),
            description: desc,
            paid_to: String(data.paid_to ?? ''),
            ...excludeFormFromTransaction({
              profit_share_excluded: Boolean(data.profit_share_excluded),
              offset_paid_to: (data.offset_paid_to as string | null) ?? null,
            }),
            ...splitFormFromTransaction({
              amount: Number(data.amount) || 0,
              share_chad_amount: data.share_chad_amount == null ? null : Number(data.share_chad_amount),
              share_joey_amount: data.share_joey_amount == null ? null : Number(data.share_joey_amount),
            }),
          })
          setCashOpen(true)
          return
        }

        if (target.source === 'payment_records') {
          const { data, error } = await supabase.from('payment_records').select('*').eq('id', target.id).single()
          if (cancelled) return
          if (error || !data) {
            toast.error('결제 기록을 불러오는 중 오류가 발생했습니다.')
            onDismiss()
            return
          }
          setPaymentRow(data as Record<string, unknown>)
          setPaymentOpen(true)
          return
        }

        if (target.source === 'company_expenses') {
          const { data, error } = await supabase.from('company_expenses').select('*').eq('id', target.id).single()
          if (cancelled) return
          if (error || !data) {
            toast.error('회사 지출을 불러오는 중 오류가 발생했습니다.')
            onDismiss()
            return
          }
          setCompanyRow(data as Record<string, unknown>)
          setCompanyOpen(true)
          return
        }

        if (target.source === 'reservation_expenses') {
          const { data, error } = await supabase.from('reservation_expenses').select('*').eq('id', target.id).single()
          if (cancelled) return
          if (error || !data) {
            toast.error('예약 지출을 불러오는 중 오류가 발생했습니다.')
            onDismiss()
            return
          }
          setReservationRow(data as Record<string, unknown>)
          setReservationOpen(true)
        }
      } catch (e) {
        console.error(e)
        toast.error('데이터를 불러오는 중 오류가 발생했습니다.')
        onDismiss()
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [target, onDismiss, addCashOpen, activeOperatorId])

  const handleCashOpenChange = (open: boolean) => {
    setCashOpen(open)
    if (!open) {
      setCashRow(null)
      if (addCashOpen) {
        onAddCashDismiss?.()
      } else {
        onDismiss()
      }
    }
  }

  const submitCash = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cashForm.amount || parseFloat(cashForm.amount) <= 0) {
      toast.error('금액을 입력해주세요.')
      return
    }
    const paidToTrim = cashForm.paid_to.trim()
    if (cashForm.transaction_type === 'withdrawal' && !paidToTrim) {
      toast.error('Profit Share 수령인을 입력해주세요. (Chad / Joey)')
      return
    }
    const cashAmount = parseFloat(cashForm.amount)
    const isSplitPaidTo = classifyProfitSharePartner(paidToTrim) === 'split'
    const excludeFields = {
      profit_share_excluded:
        cashForm.transaction_type === 'withdrawal' && cashForm.profit_share_excluded,
      offset_paid_to: null as string | null,
      offset_amount: null as number | null,
      offset_method: null as string | null,
    }
    const splitResult = resolveProfitShareSplitPayload({
      isSplit: cashForm.transaction_type === 'withdrawal' && isSplitPaidTo,
      cashAmount,
      shareChad: cashForm.share_chad_amount,
      shareJoey: cashForm.share_joey_amount,
    })
    if (!splitResult.ok) {
      toast.error(splitResult.error)
      return
    }
    const splitFields = splitResult.fields
    if (
      paidToTrim &&
      !paidToOptions.some((name) => name.toLowerCase() === paidToTrim.toLowerCase())
    ) {
      try {
        await supabase.from('expense_vendors').insert({ name: paidToTrim, usage_type: 'one_time' })
        await loadPaidToOptions()
      } catch (vendorErr) {
        console.warn('결제처 목록 자동 추가 실패:', vendorErr)
      }
    }
    const dbTransactionType = cashForm.transaction_type === 'bank_deposit' ? 'withdrawal' : cashForm.transaction_type
    const description = ensureBankDepositDescription(cashForm.transaction_type, cashForm.description) || null
    const category =
      cashForm.transaction_type === 'withdrawal'
        ? 'Profit Share'
        : null
    const newValues = {
      transaction_date: parseDatetimeLocalInputToISOString(cashForm.transaction_date),
      transaction_type: dbTransactionType,
      amount: parseFloat(cashForm.amount),
      description,
      paid_to: paidToTrim || null,
      category,
      notes: null as string | null,
      ...excludeFields,
      ...splitFields,
    }

    const isCreate = addCashOpen && !cashRow

    try {
      setCashSaving(true)
      if (isCreate) {
        const { data, error } = await supabase
          .from('cash_transactions')
          .insert({
            operator_id: activeOperatorId,
            transaction_date: newValues.transaction_date,
            transaction_type: newValues.transaction_type,
            amount: newValues.amount,
            description: newValues.description,
            paid_to: newValues.paid_to,
            category: newValues.category,
            notes: newValues.notes,
            offset_paid_to: newValues.offset_paid_to,
            offset_amount: newValues.offset_amount,
            offset_method: newValues.offset_method,
            share_chad_amount: newValues.share_chad_amount,
            share_joey_amount: newValues.share_joey_amount,
            profit_share_excluded: newValues.profit_share_excluded,
            created_by: user?.email || ''
          })
          .select()
          .single()
        if (error) throw error
        if (data?.id) {
          await saveHistory(String(data.id), 'cash_transactions', 'created', null, newValues)
        }
        toast.success('현금 거래가 추가되었습니다.')
      } else {
        if (!cashRow) return
        const id = String(cashRow.id)
        const oldValues = {
          transaction_date: cashRow.transaction_date,
          transaction_type: cashRow.transaction_type,
          amount: cashRow.amount,
          description: cashRow.description,
          paid_to: cashRow.paid_to,
          category: cashRow.category,
          notes: cashRow.notes,
          offset_paid_to: cashRow.offset_paid_to,
          offset_amount: cashRow.offset_amount,
          offset_method: cashRow.offset_method,
          share_chad_amount: cashRow.share_chad_amount,
          share_joey_amount: cashRow.share_joey_amount,
        }
        const { error } = await supabase
          .from('cash_transactions')
          .update({
            transaction_date: newValues.transaction_date,
            transaction_type: newValues.transaction_type,
            amount: newValues.amount,
            description: newValues.description,
            paid_to: newValues.paid_to,
            category: newValues.category,
            notes: newValues.notes,
            offset_paid_to: newValues.offset_paid_to,
            offset_amount: newValues.offset_amount,
            offset_method: newValues.offset_method,
            share_chad_amount: newValues.share_chad_amount,
            share_joey_amount: newValues.share_joey_amount,
            profit_share_excluded: newValues.profit_share_excluded,
            updated_at: new Date().toISOString()
          })
          .eq('operator_id', activeOperatorId)
          .eq('id', id)
        if (error) throw error
        await saveHistory(id, 'cash_transactions', 'updated', oldValues, newValues)
        toast.success('현금 거래가 수정되었습니다.')
      }
      handleCashOpenChange(false)
      await onSaved()
    } catch (err) {
      console.error(err)
      toast.error('현금 거래를 저장하는 중 오류가 발생했습니다.')
    } finally {
      setCashSaving(false)
    }
  }

  return (
    <>
      <Dialog open={cashOpen} onOpenChange={handleCashOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {cashDirectEntryTitle(cashForm.transaction_type, !(addCashOpen && !cashRow))}
            </DialogTitle>
            <DialogDescription>
              {cashDirectEntryDescription(cashForm.transaction_type)}
            </DialogDescription>
          </DialogHeader>
          {(cashRow || addCashOpen) && (
            <form onSubmit={submitCash} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cr_transaction_date">거래 일시 *</Label>
                  <Input
                    id="cr_transaction_date"
                    type="datetime-local"
                    step={60}
                    value={cashForm.transaction_date}
                    onChange={(e) => setCashForm({ ...cashForm, transaction_date: e.target.value })}
                    required
                    className="min-w-0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>거래 유형</Label>
                  <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm">
                    {cashForm.transaction_type === 'bank_deposit'
                      ? '은행 Deposit'
                      : cashForm.transaction_type === 'withdrawal'
                        ? '지출 (Profit Share)'
                        : '입금'}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cr_amount">금액 *</Label>
                <Input
                  id="cr_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={cashForm.amount}
                  onChange={(e) =>
                    setCashForm(
                      cashForm.transaction_type === 'withdrawal' &&
                        classifyProfitSharePartner(cashForm.paid_to) === 'split'
                        ? applyProfitShareSplitHalves(cashForm, e.target.value)
                        : { ...cashForm, amount: e.target.value }
                    )
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cr_paid_to">
                  {cashForm.transaction_type === 'withdrawal' ? '수령인 *' : '결제처'}
                </Label>
                <ExpensePaidToCombobox
                  id="cr_paid_to"
                  value={cashForm.paid_to}
                  onChange={(paid_to) => setCashForm(applyProfitSharePaidToChange(cashForm, paid_to))}
                  options={cashPaidToComboboxOptions}
                  placeholder={
                    cashForm.transaction_type === 'withdrawal'
                      ? 'Chad, Joey 또는 둘 다'
                      : '결제처 선택 또는 입력'
                  }
                  parentOpen={cashOpen}
                  disabled={cashSaving}
                />
                {cashForm.transaction_type === 'withdrawal' ? (
                  <ProfitSharePaidToPresets
                    value={cashForm.paid_to}
                    disabled={cashSaving}
                    onChange={(paid_to) => setCashForm(applyProfitSharePaidToChange(cashForm, paid_to))}
                  />
                ) : null}
              </div>
              {cashForm.transaction_type === 'withdrawal' &&
              classifyProfitSharePartner(cashForm.paid_to) === 'split' ? (
                <ProfitShareSplitFields form={cashForm} disabled={cashSaving} onChange={setCashForm} />
              ) : null}
              {cashForm.transaction_type === 'withdrawal' ? (
                <ProfitShareExcludeFields
                  excluded={cashForm.profit_share_excluded}
                  disabled={cashSaving}
                  onChange={(profit_share_excluded) => setCashForm({ ...cashForm, profit_share_excluded })}
                />
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="cr_description">설명</Label>
                <Input
                  id="cr_description"
                  value={cashForm.description}
                  onChange={(e) => setCashForm({ ...cashForm, description: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => handleCashOpenChange(false)}>
                  취소
                </Button>
                <Button type="submit" disabled={cashSaving}>
                  {cashSaving ? '저장 중...' : addCashOpen && !cashRow ? '추가' : '수정'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={paymentOpen}
        onOpenChange={(open) => {
          setPaymentOpen(open)
          if (!open) {
            setPaymentRow(null)
            onDismiss()
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>예약 결제 수정</DialogTitle>
            <DialogDescription>예약 결제 기록을 수정합니다.</DialogDescription>
          </DialogHeader>
          {paymentRow && (
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                try {
                  const formData = new FormData(e.currentTarget)
                  const oldValues = {
                    amount: paymentRow.amount,
                    payment_method: paymentRow.payment_method,
                    note: paymentRow.note,
                    submit_on: paymentRow.submit_on,
                    payment_status: paymentRow.payment_status
                  }
                  const { error } = await supabase
                    .from('payment_records')
                    .update({
                      amount: parseFloat(formData.get('amount') as string),
                      note: (formData.get('note') as string) || null,
                      submit_on: new Date(formData.get('submit_on') as string).toISOString(),
                      payment_status: (formData.get('payment_status') as string) || 'pending',
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', paymentRow.id as string)
                  if (error) throw error
                  const newValues = {
                    amount: parseFloat(formData.get('amount') as string),
                    payment_method: paymentRow.payment_method,
                    note: (formData.get('note') as string) || null,
                    submit_on: new Date(formData.get('submit_on') as string).toISOString(),
                    payment_status: (formData.get('payment_status') as string) || 'pending'
                  }
                  await saveHistory(paymentRow.id as string, 'payment_records', 'updated', oldValues, newValues)
                  toast.success('예약 결제가 수정되었습니다.')
                  setPaymentOpen(false)
                  setPaymentRow(null)
                  onDismiss()
                  await onSaved()
                } catch (err) {
                  console.error(err)
                  toast.error('예약 결제를 수정하는 중 오류가 발생했습니다.')
                }
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cr_pr_amount">금액 *</Label>
                  <Input
                    id="cr_pr_amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={paymentRow.amount as number}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cr_pr_submit_on">제출일시 *</Label>
                  <Input
                    id="cr_pr_submit_on"
                    name="submit_on"
                    type="datetime-local"
                    defaultValue={new Date(paymentRow.submit_on as string).toISOString().slice(0, 16)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cr_pr_payment_status">결제 상태</Label>
                <input
                  type="hidden"
                  name="payment_status"
                  id="cr_pr_payment_status_hidden"
                  defaultValue={(paymentRow.payment_status as string) || 'pending'}
                />
                <Select
                  defaultValue={(paymentRow.payment_status as string) || 'pending'}
                  onValueChange={(value) => {
                    const el = document.getElementById('cr_pr_payment_status_hidden') as HTMLInputElement
                    if (el) el.value = value
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">대기</SelectItem>
                    <SelectItem value="confirmed">확인됨</SelectItem>
                    <SelectItem value="rejected">거부됨</SelectItem>
                    <SelectItem value="Deposit Received">Deposit Received</SelectItem>
                    <SelectItem value="Balance Received">Balance Received</SelectItem>
                    <SelectItem value="Partner Received">Partner Received</SelectItem>
                    <SelectItem value={"Customer's CC Charged"}>Customer&apos;s CC Charged</SelectItem>
                    <SelectItem value="Commission Received !">Commission Received !</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cr_pr_note">메모</Label>
                <Textarea id="cr_pr_note" name="note" defaultValue={(paymentRow.note as string) || ''} rows={3} />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPaymentOpen(false)
                    setPaymentRow(null)
                    onDismiss()
                  }}
                >
                  취소
                </Button>
                <Button type="submit">수정</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={companyOpen}
        onOpenChange={(open) => {
          setCompanyOpen(open)
          if (!open) {
            setCompanyRow(null)
            onDismiss()
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>회사 지출 수정</DialogTitle>
            <DialogDescription>회사 지출 기록을 수정합니다.</DialogDescription>
          </DialogHeader>
          {companyRow && (
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                try {
                  const formData = new FormData(e.currentTarget)
                  const oldValues = {
                    amount: companyRow.amount,
                    paid_to: companyRow.paid_to,
                    paid_for: companyRow.paid_for,
                    description: companyRow.description,
                    notes: companyRow.notes,
                    submit_on: companyRow.submit_on
                  }
                  const { error } = await supabase
                    .from('company_expenses')
                    .update({
                      amount: parseFloat(formData.get('amount') as string),
                      paid_to: formData.get('paid_to') as string,
                      paid_for: formData.get('paid_for') as string,
                      description: (formData.get('description') as string) || null,
                      notes: (formData.get('notes') as string) || null,
                      submit_on: new Date(formData.get('submit_on') as string).toISOString(),
                      updated_at: new Date().toISOString(),
                      updated_by: user?.email || null
                    })
                    .eq('id', companyRow.id as string)
                  if (error) throw error
                  const newValues = {
                    amount: parseFloat(formData.get('amount') as string),
                    paid_to: formData.get('paid_to') as string,
                    paid_for: formData.get('paid_for') as string,
                    description: (formData.get('description') as string) || null,
                    notes: (formData.get('notes') as string) || null,
                    submit_on: new Date(formData.get('submit_on') as string).toISOString()
                  }
                  await saveHistory(companyRow.id as string, 'company_expenses', 'updated', oldValues, newValues)
                  toast.success('회사 지출이 수정되었습니다.')
                  setCompanyOpen(false)
                  setCompanyRow(null)
                  onDismiss()
                  await onSaved()
                } catch (err) {
                  console.error(err)
                  toast.error('회사 지출을 수정하는 중 오류가 발생했습니다.')
                }
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cr_ce_amount">금액 *</Label>
                  <Input
                    id="cr_ce_amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={companyRow.amount as number}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cr_ce_submit_on">제출일시 *</Label>
                  <Input
                    id="cr_ce_submit_on"
                    name="submit_on"
                    type="datetime-local"
                    defaultValue={new Date(companyRow.submit_on as string).toISOString().slice(0, 16)}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cr_ce_paid_to">결제처 *</Label>
                  <Input id="cr_ce_paid_to" name="paid_to" defaultValue={(companyRow.paid_to as string) || ''} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cr_ce_paid_for">결제내용 *</Label>
                  <Input
                    id="cr_ce_paid_for"
                    name="paid_for"
                    defaultValue={(companyRow.paid_for as string) || ''}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cr_ce_description">상세 설명</Label>
                <Input
                  id="cr_ce_description"
                  name="description"
                  defaultValue={(companyRow.description as string) || ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cr_ce_notes">메모</Label>
                <Textarea id="cr_ce_notes" name="notes" defaultValue={(companyRow.notes as string) || ''} rows={3} />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCompanyOpen(false)
                    setCompanyRow(null)
                    onDismiss()
                  }}
                >
                  취소
                </Button>
                <Button type="submit">수정</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={reservationOpen}
        onOpenChange={(open) => {
          setReservationOpen(open)
          if (!open) {
            setReservationRow(null)
            onDismiss()
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>예약 지출 수정</DialogTitle>
            <DialogDescription>예약 지출(현금) 기록을 수정합니다.</DialogDescription>
          </DialogHeader>
          {reservationRow && (
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                try {
                  const oldValues = {
                    amount: reservationRow.amount,
                    submit_on: reservationRow.submit_on,
                    note: reservationRow.note,
                    paid_for: reservationRow.paid_for,
                    paid_to: reservationRow.paid_to
                  }
                  const newValues = {
                    amount: parseFloat(formData.get('amount') as string),
                    submit_on: new Date(formData.get('submit_on') as string).toISOString(),
                    note: (formData.get('note') as string) || null,
                    paid_for: (formData.get('paid_for') as string) || null,
                    paid_to: (formData.get('paid_to') as string) || null
                  }
                  const { error } = await supabase
                    .from('reservation_expenses')
                    .update({
                      amount: newValues.amount,
                      submit_on: newValues.submit_on,
                      note: newValues.note,
                      paid_for: newValues.paid_for,
                      paid_to: newValues.paid_to,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', reservationRow.id as string)
                  if (error) throw error
                  await saveHistory(
                    reservationRow.id as string,
                    'reservation_expenses',
                    'updated',
                    oldValues,
                    newValues
                  )
                  toast.success('예약 지출이 수정되었습니다.')
                  setReservationOpen(false)
                  setReservationRow(null)
                  onDismiss()
                  await onSaved()
                } catch (err) {
                  console.error(err)
                  toast.error('예약 지출을 수정하는 중 오류가 발생했습니다.')
                }
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cr_re_amount">금액 *</Label>
                  <Input
                    id="cr_re_amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={reservationRow.amount as number}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cr_re_submit_on">제출일시 *</Label>
                  <Input
                    id="cr_re_submit_on"
                    name="submit_on"
                    type="datetime-local"
                    defaultValue={
                      reservationRow.submit_on
                        ? new Date(reservationRow.submit_on as string).toISOString().slice(0, 16)
                        : ''
                    }
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cr_re_paid_to">결제처</Label>
                  <Input id="cr_re_paid_to" name="paid_to" defaultValue={(reservationRow.paid_to as string) || ''} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cr_re_paid_for">결제내용</Label>
                  <Input
                    id="cr_re_paid_for"
                    name="paid_for"
                    defaultValue={(reservationRow.paid_for as string) || ''}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cr_re_note">메모</Label>
                <Textarea id="cr_re_note" name="note" defaultValue={(reservationRow.note as string) || ''} rows={3} />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setReservationOpen(false)
                    setReservationRow(null)
                    onDismiss()
                  }}
                >
                  취소
                </Button>
                <Button type="submit">수정</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
