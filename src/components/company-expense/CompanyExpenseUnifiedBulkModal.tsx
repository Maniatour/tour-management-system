'use client'

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

type Mode = 'mapping' | 'text'

type PreviewRow = { id: string; paid_for: string; category: string | null; expense_type: string | null }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplied?: () => void
}

export function CompanyExpenseUnifiedBulkModal({ open, onOpenChange, onApplied }: Props) {
  const t = useTranslations('companyExpense.unifiedBulk')
  const [mode, setMode] = useState<Mode>('mapping')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<{ previewCount: number; previews: PreviewRow[] } | null>(null)

  const runPreview = async () => {
    setLoading(true)
    setPreview(null)
    try {
      const res = await fetch('/api/company-expenses/bulk-unified-standard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, dryRun: true }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('error'))
        return
      }
      setPreview({ previewCount: json.previewCount ?? 0, previews: json.previews ?? [] })
      toast.success(t('previewDone', { count: json.previewCount ?? 0 }))
    } catch {
      toast.error(t('error'))
    } finally {
      setLoading(false)
    }
  }

  const runApply = async () => {
    if (!preview || preview.previewCount === 0) {
      toast.error(t('nothingToApply'))
      return
    }
    if (!confirm(t('confirmApply', { count: preview.previewCount }))) return
    setLoading(true)
    try {
      const res = await fetch('/api/company-expenses/bulk-unified-standard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, dryRun: false }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('error'))
        return
      }
      toast.success(t('applyDone', { count: json.updatedCount ?? 0 }))
      setPreview(null)
      onOpenChange(false)
      onApplied?.()
    } catch {
      toast.error(t('error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[min(90vh,720px)] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2 shrink-0">
          <Label className="text-sm font-medium">{t('modeLabel')}</Label>
          <div className="flex flex-col gap-2">
            <label className="flex items-start gap-2 text-sm cursor-pointer rounded-md border p-2 has-[:checked]:border-primary has-[:checked]:bg-muted/50">
              <input
                type="radio"
                name="unified-bulk-mode"
                checked={mode === 'mapping'}
                onChange={() => setMode('mapping')}
                className="mt-1"
              />
              <span>
                <span className="font-medium">{t('modeMappingTitle')}</span>
                <span className="block text-muted-foreground text-xs mt-0.5">{t('modeMappingHint')}</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm cursor-pointer rounded-md border p-2 has-[:checked]:border-primary has-[:checked]:bg-muted/50">
              <input
                type="radio"
                name="unified-bulk-mode"
                checked={mode === 'text'}
                onChange={() => setMode('text')}
                className="mt-1"
              />
              <span>
                <span className="font-medium">{t('modeTextTitle')}</span>
                <span className="block text-muted-foreground text-xs mt-0.5">{t('modeTextHint')}</span>
              </span>
            </label>
          </div>
        </div>

        {preview && preview.previewCount > 0 && (
          <div className="min-h-0 flex-1 overflow-y-auto rounded border bg-muted/30 p-2 text-xs space-y-1">
            <p className="font-medium text-foreground mb-1">{t('previewTitle', { count: preview.previewCount })}</p>
            {preview.previews.slice(0, 50).map((r) => (
              <div key={r.id} className="truncate text-muted-foreground">
                {r.paid_for} · {r.category} · {r.expense_type}
              </div>
            ))}
            {preview.previewCount > 50 && <p className="text-muted-foreground">…</p>}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('close')}
          </Button>
          <Button type="button" variant="secondary" onClick={() => void runPreview()} disabled={loading}>
            {loading ? t('loading') : t('preview')}
          </Button>
          <Button type="button" onClick={() => void runApply()} disabled={loading || !preview?.previewCount}>
            {t('apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
