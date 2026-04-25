'use client'

import { useTranslations } from 'next-intl'
import { GitCompare, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ExampleRow = { label: string; cogs: string; opex: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CogsVsExpensesManualDialog({ open, onOpenChange }: Props) {
  const t = useTranslations('companyExpense.form')
  const examples = t.raw('cogsVsExpensesManualContent.examples') as ExampleRow[]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[min(92vh,44rem)] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0',
          'border border-border/60 shadow-xl sm:rounded-2xl'
        )}
      >
        <DialogHeader
          className={cn(
            'shrink-0 space-y-3 border-b border-border/60 bg-gradient-to-br from-muted/60 via-muted/30 to-background',
            'px-6 pb-4 pt-6 text-left'
          )}
        >
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
              aria-hidden
            >
              <GitCompare className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <DialogTitle className="text-lg font-semibold leading-snug tracking-tight">
                {t('cogsVsExpensesManualDialogTitle')}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                {t('cogsVsExpensesManualDialogDescription')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <section className="mb-6 rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('cogsVsExpensesManualContent.summaryTitle')}
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                {t('cogsVsExpensesManualContent.pillCogs')}
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-500/10 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('cogsVsExpensesManualContent.pillOpex')}
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-foreground">
              {t('cogsVsExpensesManualContent.summaryText')}
            </p>
          </section>

          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('cogsVsExpensesManualContent.examplesTitle')}
          </h3>

          <div className="hidden gap-2 px-1 pb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-2 sm:pl-[7.5rem]">
            <span className="text-emerald-700 dark:text-emerald-300">
              {t('cogsVsExpensesManualContent.cogsColumnLabel')}
            </span>
            <span className="text-slate-600 dark:text-slate-400">
              {t('cogsVsExpensesManualContent.opexColumnLabel')}
            </span>
          </div>

          <ul className="space-y-3">
            {Array.isArray(examples) &&
              examples.map((ex, i) => (
                <li
                  key={`${ex.label}-${i}`}
                  className="overflow-hidden rounded-2xl border border-border/60 bg-card/50 shadow-sm"
                >
                  <div className="border-b border-border/50 bg-muted/40 px-4 py-2.5">
                    <span className="text-sm font-semibold text-foreground">{ex.label}</span>
                  </div>
                  <div className="grid gap-px bg-border/60 sm:grid-cols-2">
                    <div className="bg-emerald-500/[0.07] p-4 dark:bg-emerald-500/10">
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-200 sm:hidden">
                        {t('cogsVsExpensesManualContent.cogsColumnLabel')}
                      </p>
                      <p className="text-sm leading-relaxed text-foreground/95">{ex.cogs}</p>
                    </div>
                    <div className="bg-muted/30 p-4 dark:bg-muted/20">
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:hidden">
                        {t('cogsVsExpensesManualContent.opexColumnLabel')}
                      </p>
                      <p className="text-sm leading-relaxed text-foreground/95">{ex.opex}</p>
                    </div>
                  </div>
                </li>
              ))}
          </ul>

          <div
            className={cn(
              'mt-6 flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.08] p-4',
              'dark:border-amber-500/30 dark:bg-amber-500/10'
            )}
            role="note"
          >
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
                {t('cogsVsExpensesManualContent.noteTitle')}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-amber-950/90 dark:text-amber-50/90">
                {t('cogsVsExpensesManualContent.noteText')}
              </p>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-border/60 bg-muted/20 px-6 py-4">
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto sm:min-w-[7rem]"
            onClick={() => onOpenChange(false)}
          >
            {t('cogsVsExpensesManualClose')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
