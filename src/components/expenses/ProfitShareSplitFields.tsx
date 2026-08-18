'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  PROFIT_SHARE_PAID_TO_PRESETS,
  applyProfitShareSplitHalves,
  formatShareInput,
} from '@/lib/cashTransactionPurpose'

type ProfitSharePaidToPresetsProps = {
  value: string
  disabled?: boolean
  onChange: (paidTo: string) => void
}

export function ProfitSharePaidToPresets({ value, disabled, onChange }: ProfitSharePaidToPresetsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {PROFIT_SHARE_PAID_TO_PRESETS.map((name) => (
        <Button
          key={name}
          type="button"
          size="sm"
          variant={value === name ? 'default' : 'outline'}
          disabled={disabled}
          onClick={() => onChange(name)}
        >
          {name}
        </Button>
      ))}
    </div>
  )
}

type ProfitShareSplitFieldsProps<T extends { amount: string; share_chad_amount: string; share_joey_amount: string }> = {
  form: T
  disabled?: boolean
  onChange: (next: T) => void
}

export default function ProfitShareSplitFields<
  T extends { amount: string; share_chad_amount: string; share_joey_amount: string },
>({ form, disabled, onChange }: ProfitShareSplitFieldsProps<T>) {
  const total = parseFloat(form.amount)
  const chad = parseFloat(form.share_chad_amount)
  const joey = parseFloat(form.share_joey_amount)
  const sum = (Number.isFinite(chad) ? chad : 0) + (Number.isFinite(joey) ? joey : 0)
  const mismatch = Number.isFinite(total) && total > 0 && Math.abs(sum - total) > 0.02

  const setChad = (value: string) => {
    const nextChad = parseFloat(value)
    if (Number.isFinite(total) && total > 0 && Number.isFinite(nextChad)) {
      const remainder = Math.round((total - nextChad) * 100) / 100
      onChange({
        ...form,
        share_chad_amount: value,
        share_joey_amount: remainder >= 0 ? formatShareInput(remainder) : form.share_joey_amount,
      })
      return
    }
    onChange({ ...form, share_chad_amount: value })
  }

  const setJoey = (value: string) => {
    const nextJoey = parseFloat(value)
    if (Number.isFinite(total) && total > 0 && Number.isFinite(nextJoey)) {
      const remainder = Math.round((total - nextJoey) * 100) / 100
      onChange({
        ...form,
        share_joey_amount: value,
        share_chad_amount: remainder >= 0 ? formatShareInput(remainder) : form.share_chad_amount,
      })
      return
    }
    onChange({ ...form, share_joey_amount: value })
  }

  return (
    <div className="rounded-lg border border-border/70 bg-muted/30 p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">개인 분배</p>
          <p className="text-xs text-muted-foreground">
            현금은 합계만 나갑니다. Chad / Joey 몫만 나누면 50/50에 반영됩니다. 기본은 반반입니다.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChange(applyProfitShareSplitHalves(form))}
        >
          반반
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="profit_share_chad_amount">Chad</Label>
          <Input
            id="profit_share_chad_amount"
            type="number"
            step="0.01"
            min="0"
            value={form.share_chad_amount}
            onChange={(e) => setChad(e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profit_share_joey_amount">Joey</Label>
          <Input
            id="profit_share_joey_amount"
            type="number"
            step="0.01"
            min="0"
            value={form.share_joey_amount}
            onChange={(e) => setJoey(e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>
      {mismatch ? (
        <p className="text-xs text-amber-700">
          두 금액 합이 현금 출금 ${total.toFixed(2)}과 같아야 합니다. 지금 합계 ${sum.toFixed(2)}.
        </p>
      ) : null}
    </div>
  )
}
