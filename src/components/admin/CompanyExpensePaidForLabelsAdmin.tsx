'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { apiBearerAuthHeaders } from '@/lib/api-client-bearer'

type LabelRow = {
  id: string
  code: string
  label_ko: string
  label_en: string | null
  links_vehicle_maintenance: boolean
  sort_order: number
  is_active: boolean
}

const emptyForm = () => ({
  code: '',
  label_ko: '',
  label_en: '',
  links_vehicle_maintenance: false,
  sort_order: '0',
})

export default function CompanyExpensePaidForLabelsAdmin() {
  const t = useTranslations('adminPaidForLabels')
  const [rows, setRows] = useState<LabelRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(emptyForm)
  const [editRow, setEditRow] = useState<LabelRow | null>(null)
  const [editDraft, setEditDraft] = useState(emptyForm)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/company-expenses/paid-for-labels?includeInactive=1', {
        headers: apiBearerAuthHeaders(),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('loadError'))
        setRows([])
        return
      }
      setRows(Array.isArray(json.data) ? json.data : [])
    } catch {
      toast.error(t('loadError'))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const openEdit = (r: LabelRow) => {
    setEditRow(r)
    setEditDraft({
      code: r.code,
      label_ko: r.label_ko,
      label_en: r.label_en ?? '',
      links_vehicle_maintenance: r.links_vehicle_maintenance,
      sort_order: String(r.sort_order ?? 0),
    })
  }

  const saveEdit = async () => {
    if (!editRow) return
    setSavingId(editRow.id)
    try {
      const res = await fetch(`/api/company-expenses/paid-for-labels/${encodeURIComponent(editRow.id)}`, {
        method: 'PATCH',
        headers: { ...apiBearerAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: editDraft.code.trim(),
          label_ko: editDraft.label_ko.trim(),
          label_en: editDraft.label_en.trim() || null,
          links_vehicle_maintenance: editDraft.links_vehicle_maintenance,
          sort_order: parseInt(editDraft.sort_order, 10) || 0,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('saveError'))
        return
      }
      toast.success(t('saveSuccess'))
      setEditRow(null)
      await load()
    } catch {
      toast.error(t('saveError'))
    } finally {
      setSavingId(null)
    }
  }

  const createLabel = async () => {
    if (!createForm.label_ko.trim()) {
      toast.error(t('labelKoRequired'))
      return
    }
    setSavingId('__create__')
    try {
      const res = await fetch('/api/company-expenses/paid-for-labels', {
        method: 'POST',
        headers: { ...apiBearerAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: createForm.code.trim() || undefined,
          label_ko: createForm.label_ko.trim(),
          label_en: createForm.label_en.trim() || null,
          links_vehicle_maintenance: createForm.links_vehicle_maintenance,
          sort_order: parseInt(createForm.sort_order, 10) || 0,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('createError'))
        return
      }
      toast.success(t('createSuccess'))
      setCreateOpen(false)
      setCreateForm(emptyForm())
      await load()
    } catch {
      toast.error(t('createError'))
    } finally {
      setSavingId(null)
    }
  }

  const deactivate = async (r: LabelRow) => {
    if (!confirm(t('confirmDeactivate', { code: r.code }))) return
    setSavingId(r.id)
    try {
      const res = await fetch(`/api/company-expenses/paid-for-labels/${encodeURIComponent(r.id)}`, {
        method: 'DELETE',
        headers: apiBearerAuthHeaders(),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('deactivateError'))
        return
      }
      toast.success(t('deactivateSuccess'))
      await load()
    } catch {
      toast.error(t('deactivateError'))
    } finally {
      setSavingId(null)
    }
  }

  const reactivate = async (r: LabelRow) => {
    setSavingId(r.id)
    try {
      const res = await fetch(`/api/company-expenses/paid-for-labels/${encodeURIComponent(r.id)}`, {
        method: 'PATCH',
        headers: { ...apiBearerAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('reactivateError'))
        return
      }
      toast.success(t('reactivateSuccess'))
      await load()
    } catch {
      toast.error(t('reactivateError'))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {t('refresh')}
        </Button>
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          {t('add')}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('colCode')}</TableHead>
                <TableHead>{t('colLabelKo')}</TableHead>
                <TableHead>{t('colLabelEn')}</TableHead>
                <TableHead className="w-28">{t('colVehicleLink')}</TableHead>
                <TableHead className="w-24">{t('colSort')}</TableHead>
                <TableHead className="w-28">{t('colStatus')}</TableHead>
                <TableHead className="w-40 text-right">{t('colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.code}</TableCell>
                  <TableCell>{r.label_ko}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{r.label_en || '—'}</TableCell>
                  <TableCell>{r.links_vehicle_maintenance ? <Badge variant="secondary">{t('yes')}</Badge> : '—'}</TableCell>
                  <TableCell className="tabular-nums">{r.sort_order}</TableCell>
                  <TableCell>
                    {r.is_active ? (
                      <Badge className="bg-green-100 text-green-800">{t('active')}</Badge>
                    ) : (
                      <Badge variant="outline">{t('inactive')}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button type="button" size="sm" variant="outline" onClick={() => openEdit(r)}>
                      {t('edit')}
                    </Button>
                    {r.is_active ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        disabled={savingId === r.id}
                        onClick={() => void deactivate(r)}
                      >
                        {t('deactivate')}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={savingId === r.id}
                        onClick={() => void reactivate(r)}
                      >
                        {t('reactivate')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dialogCreateTitle')}</DialogTitle>
            <DialogDescription>{t('dialogCreateHint')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label htmlFor="c-code">{t('fieldCode')}</Label>
              <Input
                id="c-code"
                value={createForm.code}
                onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value }))}
                placeholder={t('fieldCodePlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="c-ko">{t('fieldLabelKo')} *</Label>
              <Input
                id="c-ko"
                value={createForm.label_ko}
                onChange={(e) => setCreateForm((f) => ({ ...f, label_ko: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="c-en">{t('fieldLabelEn')}</Label>
              <Input
                id="c-en"
                value={createForm.label_en}
                onChange={(e) => setCreateForm((f) => ({ ...f, label_en: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="c-sort">{t('fieldSort')}</Label>
              <Input
                id="c-sort"
                type="number"
                value={createForm.sort_order}
                onChange={(e) => setCreateForm((f) => ({ ...f, sort_order: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={createForm.links_vehicle_maintenance}
                onCheckedChange={(v) =>
                  setCreateForm((f) => ({ ...f, links_vehicle_maintenance: v === true }))
                }
              />
              {t('fieldVehicleLink')}
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="button" onClick={() => void createLabel()} disabled={savingId === '__create__'}>
              {savingId === '__create__' ? t('saving') : t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editRow != null} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dialogEditTitle')}</DialogTitle>
            <DialogDescription>{t('dialogEditHint')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label htmlFor="e-code">{t('fieldCode')}</Label>
              <Input
                id="e-code"
                value={editDraft.code}
                onChange={(e) => setEditDraft((f) => ({ ...f, code: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="e-ko">{t('fieldLabelKo')} *</Label>
              <Input
                id="e-ko"
                value={editDraft.label_ko}
                onChange={(e) => setEditDraft((f) => ({ ...f, label_ko: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="e-en">{t('fieldLabelEn')}</Label>
              <Input
                id="e-en"
                value={editDraft.label_en}
                onChange={(e) => setEditDraft((f) => ({ ...f, label_en: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="e-sort">{t('fieldSort')}</Label>
              <Input
                id="e-sort"
                type="number"
                value={editDraft.sort_order}
                onChange={(e) => setEditDraft((f) => ({ ...f, sort_order: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={editDraft.links_vehicle_maintenance}
                onCheckedChange={(v) =>
                  setEditDraft((f) => ({ ...f, links_vehicle_maintenance: v === true }))
                }
              />
              {t('fieldVehicleLink')}
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditRow(null)}>
              {t('cancel')}
            </Button>
            <Button type="button" onClick={() => void saveEdit()} disabled={!editRow || savingId === editRow.id}>
              {editRow && savingId === editRow.id ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
