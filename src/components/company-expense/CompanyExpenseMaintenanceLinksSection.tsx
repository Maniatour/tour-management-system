'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'

type Candidate = {
  id: string
  maintenance_date: string | null
  maintenance_type: string | null
  category: string | null
  subcategory: string | null
  description: string | null
  total_cost: number | null
  status: string | null
}

type Props = {
  expenseId: string | null
  vehicleId: string | null
  enabled: boolean
}

export function CompanyExpenseMaintenanceLinksSection({ expenseId, vehicleId, enabled }: Props) {
  const t = useTranslations('companyExpense.maintenanceLinks')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  const load = useCallback(async () => {
    if (!expenseId || !vehicleId || !enabled) {
      setCandidates([])
      setSelected(new Set())
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/company-expenses/${encodeURIComponent(expenseId)}/maintenance-links`)
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('loadError'))
        setCandidates([])
        setSelected(new Set())
        return
      }
      setCandidates(Array.isArray(json.candidates) ? json.candidates : [])
      setSelected(new Set(Array.isArray(json.linkedIds) ? json.linkedIds : []))
    } catch {
      toast.error(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [expenseId, vehicleId, enabled, t])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const n = new Set(prev)
      if (checked) n.add(id)
      else n.delete(id)
      return n
    })
  }

  const save = async () => {
    if (!expenseId) {
      toast.error(t('saveNeedExpense'))
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/company-expenses/${encodeURIComponent(expenseId)}/maintenance-links`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maintenanceIds: Array.from(selected) }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('saveError'))
        return
      }
      toast.success(t('saveSuccess', { count: json.linkedCount ?? 0 }))
      await load()
    } catch {
      toast.error(t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  if (!enabled) return null

  if (!vehicleId) {
    return <p className="text-sm text-muted-foreground">{t('needVehicle')}</p>
  }

  if (!expenseId) {
    return <p className="text-sm text-muted-foreground">{t('needSavedExpense')}</p>
  }

  return (
    <div className="space-y-3 rounded-lg border border-amber-200/80 bg-amber-50/40 p-4">
      <div>
        <Label className="text-base font-medium">{t('title')}</Label>
        <p className="text-xs text-muted-foreground mt-1">{t('hint')}</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
          {candidates.map((c) => (
            <label
              key={c.id}
              className="flex items-start gap-2 rounded-md border border-white/60 bg-white/80 px-2 py-2 text-sm cursor-pointer hover:bg-white"
            >
              <Checkbox
                checked={selected.has(c.id)}
                onCheckedChange={(v) => toggle(c.id, v === true)}
                className="mt-0.5"
              />
              <span className="flex-1 min-w-0">
                <span className="font-medium tabular-nums">{c.maintenance_date}</span>
                <span className="text-muted-foreground mx-1">·</span>
                <span>{c.maintenance_type || '—'}</span>
                <span className="text-muted-foreground mx-1">·</span>
                <span className="break-words">{c.description || '—'}</span>
                {c.total_cost != null && (
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    ${Number(c.total_cost).toLocaleString()}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      )}

      <Button type="button" onClick={() => void save()} disabled={saving || loading}>
        {saving ? t('saving') : t('save')}
      </Button>
    </div>
  )
}
