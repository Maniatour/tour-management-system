'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

type ProfitShareExcludeFieldsProps = {
  excluded: boolean
  disabled?: boolean
  onChange: (excluded: boolean) => void
}

export default function ProfitShareExcludeFields({
  excluded,
  disabled,
  onChange,
}: ProfitShareExcludeFieldsProps) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
      <div className="flex items-start gap-3">
        <Checkbox
          id="profit_share_excluded"
          checked={excluded}
          disabled={disabled}
          onCheckedChange={(checked) => onChange(checked === true)}
          className="mt-0.5"
        />
        <div className="space-y-1">
          <Label htmlFor="profit_share_excluded" className="text-sm font-medium cursor-pointer">
            상계 · 50/50에서 제외
          </Label>
          <p className="text-xs text-muted-foreground">
            현금 잔액에는 그대로 나갑니다. Chad / Joey 분배 비율에는 넣지 않습니다.
          </p>
        </div>
      </div>
    </div>
  )
}
