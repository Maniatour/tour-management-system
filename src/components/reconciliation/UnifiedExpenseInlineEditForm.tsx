'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PaymentMethodAutocomplete } from '@/components/expense/PaymentMethodAutocomplete'
import { usePaymentMethodOptions } from '@/hooks/usePaymentMethodOptions'
import { UNIFIED_EXPENSE_SOURCE_LABEL, type UnifiedLedgerDuplicateExpenseRow } from '@/lib/expense-unified-duplicate-scan'
import type { UnifiedExpenseEditDraft } from '@/lib/unified-expense-edit'

type Props = {
  row: UnifiedLedgerDuplicateExpenseRow
  draft: UnifiedExpenseEditDraft
  onDraftChange: (next: UnifiedExpenseEditDraft) => void
  saving: boolean
  onSave: () => void
  onCancel: () => void
}

export function UnifiedExpenseInlineEditForm({
  row,
  draft,
  onDraftChange,
  saving,
  onSave,
  onCancel
}: Props) {
  const { paymentMethodOptions } = usePaymentMethodOptions()
  const isTicket = row.source_table === 'ticket_bookings'
  const isCompany = row.source_table === 'company_expenses'

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/90 p-3 space-y-3">
      <p className="text-[11px] font-medium text-slate-700">
        {UNIFIED_EXPENSE_SOURCE_LABEL[row.source_table]} 수정 ·{' '}
        <span className="font-mono text-slate-500">{row.id}</span>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl">
        <div className="space-y-1">
          <Label className="text-[11px]">금액</Label>
          <Input
            className="h-8 text-xs"
            value={draft.amount}
            onChange={(e) => onDraftChange({ ...draft, amount: e.target.value })}
            inputMode="decimal"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">등록일</Label>
          <Input
            type="date"
            className="h-8 text-xs"
            value={draft.submitDate}
            onChange={(e) => onDraftChange({ ...draft, submitDate: e.target.value })}
          />
        </div>
        <div className="space-y-1 sm:col-span-2 lg:col-span-1">
          <Label className="text-[11px]">결제 방법</Label>
          <PaymentMethodAutocomplete
            options={paymentMethodOptions}
            valueId={draft.payment_method}
            onChange={(id) => onDraftChange({ ...draft, payment_method: id })}
            pleaseSelectLabel="결제 방법 선택"
            className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
        </div>

        {isTicket ? (
          <>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[11px]">카테고리 (입장권)</Label>
              <Input
                className="h-8 text-xs"
                value={draft.category}
                onChange={(e) => onDraftChange({ ...draft, category: e.target.value })}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[11px]">공급업체(회사)</Label>
              <Input
                className="h-8 text-xs"
                value={draft.company}
                onChange={(e) => onDraftChange({ ...draft, company: e.target.value })}
              />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <Label className="text-[11px]">Paid to</Label>
              <Input
                className="h-8 text-xs"
                value={draft.paid_to}
                onChange={(e) => onDraftChange({ ...draft, paid_to: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Paid for</Label>
              <Input
                className="h-8 text-xs"
                value={draft.paid_for}
                onChange={(e) => onDraftChange({ ...draft, paid_for: e.target.value })}
              />
            </div>
            {isCompany ? (
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[11px]">회사 지출 카테고리</Label>
                <Input
                  className="h-8 text-xs"
                  value={draft.category}
                  onChange={(e) => onDraftChange({ ...draft, category: e.target.value })}
                />
              </div>
            ) : null}
          </>
        )}

        <div className="space-y-1 sm:col-span-2 lg:col-span-3">
          <Label className="text-[11px]">메모</Label>
          <Input
            className="h-8 text-xs"
            value={draft.note}
            onChange={(e) => onDraftChange({ ...draft, note: e.target.value })}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" className="h-8 text-xs" disabled={saving} onClick={onSave}>
          {saving ? '저장 중…' : '저장'}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" disabled={saving} onClick={onCancel}>
          취소
        </Button>
      </div>
    </div>
  )
}
