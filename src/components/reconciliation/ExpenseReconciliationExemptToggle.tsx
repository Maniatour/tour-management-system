'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Ban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { setExpenseReconciliationExempt } from '@/lib/expense-reconciliation-exemptions'
import type { ExpenseReconSourceTable } from '@/lib/expense-reconciliation-similar-lines'
import { cn } from '@/lib/utils'

export default function ExpenseReconciliationExemptToggle({
  sourceTable,
  sourceId,
  exempt,
  disabled,
  compact = false,
  onChanged,
}: {
  sourceTable: ExpenseReconSourceTable
  sourceId: string
  exempt: boolean
  disabled?: boolean
  compact?: boolean
  onChanged?: (exempt: boolean) => void
}) {
  const t = useTranslations('expenses.statementRecon.reconExempt')
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (disabled || saving) return
    setSaving(true)
    try {
      await setExpenseReconciliationExempt(supabase, {
        sourceTable,
        sourceId,
        exempt: !exempt,
        actorEmail: user?.email ?? null,
      })
      onChanged?.(!exempt)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled || saving}
      title={exempt ? t('titleClear') : t('titleSet')}
      aria-label={exempt ? t('titleClear') : t('titleSet')}
      className={cn(
        'shrink-0 px-1.5 h-7 text-[10px] font-medium',
        exempt
          ? 'text-slate-700 bg-slate-100 hover:bg-slate-200'
          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50',
        compact && 'h-8 w-8 p-0'
      )}
      onClick={(e) => void toggle(e)}
    >
      <Ban className={cn('h-3.5 w-3.5 shrink-0', !compact && 'mr-1')} aria-hidden />
      {!compact ? (saving ? t('saving') : exempt ? t('labelClear') : t('labelSet')) : null}
    </Button>
  )
}
