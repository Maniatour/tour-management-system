'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'

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
  onAddCashDismiss?: () => void
}

const categories = [
  '투어 수입',
  '예약 수입',
  '기타 수입',
  '투어 지출',
  '회사 지출',
  '예약 지출',
  '기타 지출'
]

type CashFormData = {
  transaction_date: string
  transaction_type: 'deposit' | 'withdrawal' | 'bank_deposit'
  amount: string
  description: string
  category: string
  notes: string
}

const defaultCashForm = (): CashFormData => ({
  transaction_date: new Date().toISOString().split('T')[0],
  transaction_type: 'deposit',
  amount: '',
  description: '',
  category: '',
  notes: ''
})

export default function CashLedgerReportEditModals({
  target,
  onDismiss,
  onSaved,
  addCashOpen = false,
  onAddCashDismiss
}: CashLedgerReportEditModalsProps) {
  const { user } = useAuth()
  const [cashOpen, setCashOpen] = useState(false)
  const [cashRow, setCashRow] = useState<Record<string, unknown> | null>(null)
  const [cashForm, setCashForm] = useState<CashFormData>(defaultCashForm)
  const [cashSaving, setCashSaving] = useState(false)

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
          old_values: oldValues,
          new_values: newValues,
          modified_by: user?.email || '',
          modified_at: new Date().toISOString()
        })
      } catch (error) {
        console.error('수정 히스토리 저장 오류:', error)
      }
    },
    [user?.email]
  )

  useEffect(() => {
    if (!addCashOpen) return
    setCashForm(defaultCashForm())
    setCashRow(null)
    setCashOpen(true)
  }, [addCashOpen])

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
            .eq('id', target.id)
            .single()
          if (cancelled) return
          if (error || !data) {
            toast.error('현금 거래를 불러오는 중 오류가 발생했습니다.')
            onDismiss()
            return
          }
          const desc = (data.description as string) || ''
          const isBankDeposit = desc.includes('은행 Deposit') || desc === '은행 Deposit'
          setCashRow(data as Record<string, unknown>)
          setCashForm({
            transaction_date: new Date(data.transaction_date as string).toISOString().split('T')[0],
            transaction_type: isBankDeposit ? 'bank_deposit' : (data.transaction_type as 'deposit' | 'withdrawal'),
            amount: String(data.amount ?? ''),
            description: desc,
            category: (data.category as string) || '',
            notes: (data.notes as string) || ''
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
  }, [target, onDismiss, addCashOpen])

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
    const dbTransactionType = cashForm.transaction_type === 'bank_deposit' ? 'withdrawal' : cashForm.transaction_type
    const [year, month, day] = cashForm.transaction_date.split('-').map(Number)
    const transactionDate = new Date(year, month - 1, day, 0, 0, 0, 0)
    const newValues = {
      transaction_date: transactionDate.toISOString(),
      transaction_type: dbTransactionType,
      amount: parseFloat(cashForm.amount),
      description: cashForm.description || null,
      category: cashForm.category || null,
      notes: cashForm.notes || null
    }

    const isCreate = addCashOpen && !cashRow

    try {
      setCashSaving(true)
      if (isCreate) {
        const { data, error } = await supabase
          .from('cash_transactions')
          .insert({
            transaction_date: newValues.transaction_date,
            transaction_type: newValues.transaction_type,
            amount: newValues.amount,
            description: newValues.description,
            category: newValues.category,
            notes: newValues.notes,
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
          category: cashRow.category,
          notes: cashRow.notes
        }
        const { error } = await supabase
          .from('cash_transactions')
          .update({
            transaction_date: newValues.transaction_date,
            transaction_type: newValues.transaction_type,
            amount: newValues.amount,
            description: newValues.description,
            category: newValues.category,
            notes: newValues.notes,
            updated_at: new Date().toISOString()
          })
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{addCashOpen && !cashRow ? '현금 거래 추가' : '현금 거래 수정'}</DialogTitle>
            <DialogDescription>
              {addCashOpen && !cashRow
                ? '현금 입금 또는 출금 내역을 새로 기록합니다.'
                : '현금 입금 또는 출금 내역을 수정합니다.'}
            </DialogDescription>
          </DialogHeader>
          {(cashRow || addCashOpen) && (
            <form onSubmit={submitCash} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cr_transaction_date">거래일자 *</Label>
                  <Input
                    id="cr_transaction_date"
                    type="date"
                    value={cashForm.transaction_date}
                    onChange={(e) => setCashForm({ ...cashForm, transaction_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cr_transaction_type">거래 유형 *</Label>
                  <Select
                    value={cashForm.transaction_type}
                    onValueChange={(value: 'deposit' | 'withdrawal' | 'bank_deposit') => {
                      let newDescription = cashForm.description
                      if (value === 'bank_deposit') {
                        if (!cashForm.description || !cashForm.description.includes('은행 Deposit')) {
                          newDescription = cashForm.description
                            ? `은행 Deposit - ${cashForm.description}`
                            : '은행 Deposit'
                        }
                      } else {
                        if (cashForm.description?.startsWith('은행 Deposit - ')) {
                          newDescription = cashForm.description.replace('은행 Deposit - ', '')
                        } else if (cashForm.description === '은행 Deposit') {
                          newDescription = ''
                        }
                      }
                      setCashForm({ ...cashForm, transaction_type: value, description: newDescription })
                    }}
                  >
                    <SelectTrigger id="cr_transaction_type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deposit">입금</SelectItem>
                      <SelectItem value="withdrawal">출금</SelectItem>
                      <SelectItem value="bank_deposit">은행 Deposit</SelectItem>
                    </SelectContent>
                  </Select>
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
                  onChange={(e) => setCashForm({ ...cashForm, amount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cr_description">설명</Label>
                <Input
                  id="cr_description"
                  value={cashForm.description}
                  onChange={(e) => setCashForm({ ...cashForm, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cr_category">카테고리</Label>
                <Select
                  value={cashForm.category || undefined}
                  onValueChange={(value) => setCashForm({ ...cashForm, category: value })}
                >
                  <SelectTrigger id="cr_category">
                    <SelectValue placeholder="카테고리 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cr_notes">메모</Label>
                <Textarea
                  id="cr_notes"
                  value={cashForm.notes}
                  onChange={(e) => setCashForm({ ...cashForm, notes: e.target.value })}
                  rows={3}
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
