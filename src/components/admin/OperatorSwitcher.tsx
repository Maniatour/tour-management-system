'use client'

import { Building2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useOperatorOptional } from '@/contexts/OperatorContext'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'

/** Compact tenant switcher for admin header (multi-membership). */
export default function OperatorSwitcher() {
  const t = useTranslations('adminOperators')
  const { operatorId, availableOperators, setActiveOperatorId, loading } =
    useOperatorOptional()

  const options =
    availableOperators.length > 0
      ? availableOperators
      : [
          {
            operatorId: KOVEgAS_OPERATOR_ID,
            name: 'Kovegas',
            slug: 'kovegas',
            role: 'admin' as const,
            status: 'active' as const,
          },
        ]

  if (options.length <= 1) {
    return (
      <div className="hidden items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground lg:flex">
        <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="max-w-[140px] truncate font-medium text-foreground">
          {options[0]?.name || 'Kovegas'}
        </span>
      </div>
    )
  }

  return (
    <div className="hidden items-center gap-2 lg:flex">
      <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />
      <Select
        value={operatorId}
        disabled={loading}
        onValueChange={(id) => {
          void setActiveOperatorId(id)
        }}
      >
        <SelectTrigger
          aria-label={t('switcherLabel')}
          className="h-9 w-[180px] rounded-lg border-border/60 text-xs"
        >
          <SelectValue placeholder={t('switcherLabel')} />
        </SelectTrigger>
        <SelectContent>
          {options.map((op) => (
            <SelectItem key={op.operatorId} value={op.operatorId}>
              {op.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
