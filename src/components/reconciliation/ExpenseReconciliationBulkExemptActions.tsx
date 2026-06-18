'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Ban } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { bulkSetExpenseReconciliationExempt } from '@/lib/expense-reconciliation-exemptions'
import type { ExpenseReconSourceTable } from '@/lib/expense-reconciliation-similar-lines'

export default function ExpenseReconciliationBulkExemptActions({
  sourceTable,
  selectedIds,
  disabled,
  onApplied,
}: {
  sourceTable: ExpenseReconSourceTable
  selectedIds: ReadonlySet<string>
  disabled?: boolean
  onApplied?: () => void
}) {
  const t = useTranslations('expenses.statementRecon.reconExempt.bulk')
  const { user } = useAuth()
  const [applying, setApplying] = useState(false)
  const count = selectedIds.size

  const apply = async (exempt: boolean) => {
    if (count === 0) {
      toast.error(t('noSelection'))
      return
    }
    setApplying(true)
    try {
      const { updated } = await bulkSetExpenseReconciliationExempt(supabase, {
        sourceTable,
        sourceIds: [...selectedIds],
        exempt,
        actorEmail: user?.email ?? null,
      })
      if (updated < count) {
        toast.message(t('partial', { updated, requested: count }))
      } else if (exempt) {
        toast.success(t('successSet', { count: updated }))
      } else {
        toast.success(t('successClear', { count: updated }))
      }
      onApplied?.()
    } catch (err) {
      console.error(err)
      toast.error(t('error'))
    } finally {
      setApplying(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || applying || count === 0}
        title={t('markExemptTitle')}
        onClick={() => void apply(true)}
      >
        <Ban className="h-4 w-4 mr-1.5 shrink-0" aria-hidden />
        {applying ? t('applying') : t('markExempt', { count })}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled || applying || count === 0}
        title={t('clearExemptTitle')}
        onClick={() => void apply(false)}
      >
        {t('clearExempt')}
      </Button>
    </>
  )
}
