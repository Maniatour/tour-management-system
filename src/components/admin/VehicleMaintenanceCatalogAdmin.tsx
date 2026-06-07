'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { apiBearerAuthHeaders } from '@/lib/api-client-bearer'
import {
  CATALOG_GROUP_ORDER,
  groupCatalogItems,
  type VehicleMaintenanceCatalogRow,
} from '@/lib/vehicleMaintenanceCatalog'
import { CATALOG_INTERVAL_KINDS } from '@/lib/vehicleMaintenanceCatalogApi'
import { ArrowLeft, ChevronDown, ChevronRight, Plus, RefreshCw } from 'lucide-react'

type CatalogForm = {
  code: string
  label_ko: string
  label_en: string
  category_group: string
  default_mileage_interval: string
  default_month_interval: string
  interval_kind: string
  legacy_subcategory: string
  sort_order: string
  notes_ko: string
  notes_en: string
}

const emptyForm = (): CatalogForm => ({
  code: '',
  label_ko: '',
  label_en: '',
  category_group: 'inspection',
  default_mileage_interval: '',
  default_month_interval: '',
  interval_kind: 'mileage',
  legacy_subcategory: '',
  sort_order: '0',
  notes_ko: '',
  notes_en: '',
})

function rowToForm(row: VehicleMaintenanceCatalogRow): CatalogForm {
  return {
    code: row.code,
    label_ko: row.label_ko,
    label_en: row.label_en ?? '',
    category_group: row.category_group,
    default_mileage_interval:
      row.default_mileage_interval != null ? String(row.default_mileage_interval) : '',
    default_month_interval:
      row.default_month_interval != null ? String(row.default_month_interval) : '',
    interval_kind: row.interval_kind,
    legacy_subcategory: row.legacy_subcategory ?? '',
    sort_order: String(row.sort_order ?? 0),
    notes_ko: row.notes_ko ?? '',
    notes_en: row.notes_en ?? '',
  }
}

function formToPayload(form: CatalogForm, includeCode: boolean) {
  const payload: Record<string, unknown> = {
    label_ko: form.label_ko.trim(),
    label_en: form.label_en.trim() || null,
    category_group: form.category_group,
    default_mileage_interval: form.default_mileage_interval.trim()
      ? parseInt(form.default_mileage_interval, 10)
      : null,
    default_month_interval: form.default_month_interval.trim()
      ? parseInt(form.default_month_interval, 10)
      : null,
    interval_kind: form.interval_kind,
    legacy_subcategory: form.legacy_subcategory.trim() || null,
    sort_order: parseInt(form.sort_order, 10) || 0,
    notes_ko: form.notes_ko.trim() || null,
    notes_en: form.notes_en.trim() || null,
  }
  if (includeCode) {
    payload.code = form.code.trim() || undefined
  }
  return payload
}

function CatalogFormFields({
  form,
  setForm,
  codeReadOnly,
  t,
  tVm,
}: {
  form: CatalogForm
  setForm: React.Dispatch<React.SetStateAction<CatalogForm>>
  codeReadOnly?: boolean
  t: ReturnType<typeof useTranslations>
  tVm: ReturnType<typeof useTranslations>
}) {
  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="cat_code">{t('fieldCode')}</Label>
          <Input
            id="cat_code"
            value={form.code}
            readOnly={codeReadOnly}
            disabled={codeReadOnly}
            placeholder={t('fieldCodePlaceholder')}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="cat_sort">{t('fieldSort')}</Label>
          <Input
            id="cat_sort"
            type="number"
            value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="cat_label_ko">{t('fieldLabelKo')}</Label>
          <Input
            id="cat_label_ko"
            value={form.label_ko}
            onChange={(e) => setForm({ ...form, label_ko: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="cat_label_en">{t('fieldLabelEn')}</Label>
          <Input
            id="cat_label_en"
            value={form.label_en}
            onChange={(e) => setForm({ ...form, label_en: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{t('fieldCategoryGroup')}</Label>
          <Select
            value={form.category_group}
            onValueChange={(v) => setForm({ ...form, category_group: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATALOG_GROUP_ORDER.map((g) => (
                <SelectItem key={g} value={g}>
                  {tVm(`catalogGroups.${g}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t('fieldIntervalKind')}</Label>
          <Select
            value={form.interval_kind}
            onValueChange={(v) => setForm({ ...form, interval_kind: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATALOG_INTERVAL_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {t(`intervalKind.${k}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="cat_mileage">{t('fieldMileageInterval')}</Label>
          <Input
            id="cat_mileage"
            type="number"
            placeholder="mi"
            value={form.default_mileage_interval}
            onChange={(e) => setForm({ ...form, default_mileage_interval: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="cat_months">{t('fieldMonthInterval')}</Label>
          <Input
            id="cat_months"
            type="number"
            placeholder={t('fieldMonthPlaceholder')}
            value={form.default_month_interval}
            onChange={(e) => setForm({ ...form, default_month_interval: e.target.value })}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="cat_legacy">{t('fieldLegacySubcategory')}</Label>
        <Input
          id="cat_legacy"
          value={form.legacy_subcategory}
          placeholder="oil_change"
          onChange={(e) => setForm({ ...form, legacy_subcategory: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="cat_notes_ko">{t('fieldNotesKo')}</Label>
        <Textarea
          id="cat_notes_ko"
          rows={2}
          value={form.notes_ko}
          onChange={(e) => setForm({ ...form, notes_ko: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="cat_notes_en">{t('fieldNotesEn')}</Label>
        <Textarea
          id="cat_notes_en"
          rows={2}
          value={form.notes_en}
          onChange={(e) => setForm({ ...form, notes_en: e.target.value })}
        />
      </div>
    </div>
  )
}

export default function VehicleMaintenanceCatalogAdmin() {
  const t = useTranslations('adminMaintenanceCatalog')
  const tVm = useTranslations('vehicleMaintenance')
  let locale = 'ko'
  try {
    locale = useLocale()
  } catch {
    locale = 'ko'
  }
  const [rows, setRows] = useState<VehicleMaintenanceCatalogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingCode, setSavingCode] = useState<string | null>(null)
  const [groupFilter, setGroupFilter] = useState('all')
  const [showInactive, setShowInactive] = useState(true)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(emptyForm)
  const [editRow, setEditRow] = useState<VehicleMaintenanceCatalogRow | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (showInactive) params.set('includeInactive', '1')
      if (groupFilter !== 'all') params.set('group', groupFilter)
      const res = await fetch(`/api/vehicle-maintenance/catalog?${params.toString()}`, {
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
  }, [showInactive, groupFilter, t])

  useEffect(() => {
    void load()
  }, [load])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        r.label_ko.toLowerCase().includes(q) ||
        (r.label_en ?? '').toLowerCase().includes(q) ||
        (r.notes_ko ?? '').toLowerCase().includes(q)
    )
  }, [rows, search])

  const groupedRows = useMemo(() => {
    const map = groupCatalogItems(filteredRows)
    const ordered: { group: string; items: VehicleMaintenanceCatalogRow[] }[] = []
    for (const group of CATALOG_GROUP_ORDER) {
      const items = map.get(group)
      if (items?.length) ordered.push({ group, items })
    }
    for (const [group, items] of map) {
      if (!CATALOG_GROUP_ORDER.includes(group as (typeof CATALOG_GROUP_ORDER)[number])) {
        ordered.push({ group, items })
      }
    }
    return ordered
  }, [filteredRows])

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  const openEdit = (row: VehicleMaintenanceCatalogRow) => {
    setEditRow(row)
    setEditForm(rowToForm(row))
  }

  const saveEdit = async () => {
    if (!editRow) return
    if (!editForm.label_ko.trim()) {
      toast.error(t('labelKoRequired'))
      return
    }
    setSavingCode(editRow.code)
    try {
      const res = await fetch(
        `/api/vehicle-maintenance/catalog/${encodeURIComponent(editRow.code)}`,
        {
          method: 'PATCH',
          headers: { ...apiBearerAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify(formToPayload(editForm, false)),
        }
      )
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
      setSavingCode(null)
    }
  }

  const createItem = async () => {
    if (!createForm.label_ko.trim()) {
      toast.error(t('labelKoRequired'))
      return
    }
    setSavingCode('__create__')
    try {
      const res = await fetch('/api/vehicle-maintenance/catalog', {
        method: 'POST',
        headers: { ...apiBearerAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(formToPayload(createForm, true)),
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
      setSavingCode(null)
    }
  }

  const deactivate = async (row: VehicleMaintenanceCatalogRow) => {
    if (!confirm(t('confirmDeactivate', { code: row.code }))) return
    setSavingCode(row.code)
    try {
      const res = await fetch(
        `/api/vehicle-maintenance/catalog/${encodeURIComponent(row.code)}`,
        { method: 'DELETE', headers: apiBearerAuthHeaders() }
      )
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
      setSavingCode(null)
    }
  }

  const reactivate = async (row: VehicleMaintenanceCatalogRow) => {
    setSavingCode(row.code)
    try {
      const res = await fetch(
        `/api/vehicle-maintenance/catalog/${encodeURIComponent(row.code)}`,
        {
          method: 'PATCH',
          headers: { ...apiBearerAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: true }),
        }
      )
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
      setSavingCode(null)
    }
  }

  const renderCatalogRow = (row: VehicleMaintenanceCatalogRow) => (
    <TableRow key={row.code} className={!row.is_active ? 'opacity-60' : undefined}>
      <TableCell className="font-mono text-xs">{row.code}</TableCell>
      <TableCell>
        <div className="font-medium">{row.label_ko}</div>
        {row.label_en && <div className="text-xs text-muted-foreground">{row.label_en}</div>}
        {row.notes_ko && (
          <div className="text-xs text-muted-foreground line-clamp-1">{row.notes_ko}</div>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm">
        {row.default_mileage_interval?.toLocaleString() ?? '—'}
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm">
        {row.default_month_interval ?? '—'}
      </TableCell>
      <TableCell className="text-sm">{t(`intervalKind.${row.interval_kind}`)}</TableCell>
      <TableCell className="text-right tabular-nums">{row.sort_order}</TableCell>
      <TableCell>
        <Badge variant={row.is_active ? 'default' : 'outline'}>
          {row.is_active ? t('active') : t('inactive')}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={savingCode === row.code}
            onClick={() => openEdit(row)}
          >
            {t('edit')}
          </Button>
          {row.is_active ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={savingCode === row.code}
              onClick={() => void deactivate(row)}
            >
              {t('deactivate')}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={savingCode === row.code}
              onClick={() => void reactivate(row)}
            >
              {t('reactivate')}
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  )

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/${locale}/admin/vehicle-maintenance`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('backToMaintenance')}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="w-4 h-4 mr-1" />
            {t('refresh')}
          </Button>
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            {t('add')}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[12rem]">
          <Label htmlFor="cat_search">{t('search')}</Label>
          <Input
            id="cat_search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
          />
        </div>
        <div className="w-44">
          <Label>{t('filterGroup')}</Label>
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allGroups')}</SelectItem>
              {CATALOG_GROUP_ORDER.map((g) => (
                <SelectItem key={g} value={g}>
                  {tVm(`catalogGroups.${g}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <Checkbox checked={showInactive} onCheckedChange={(v) => setShowInactive(v === true)} />
          {t('showInactive')}
        </label>
      </div>

      {loading ? (
        <p className="p-6 text-sm text-muted-foreground border rounded-lg bg-white">{t('loading')}</p>
      ) : groupedRows.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground border rounded-lg bg-white">{t('empty')}</p>
      ) : (
        <div className="space-y-3">
          {groupedRows.map(({ group, items }) => {
            const collapsed = collapsedGroups.has(group)
            const activeCount = items.filter((r) => r.is_active).length
            return (
              <div key={group} className="border rounded-lg overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 text-left"
                >
                  <span className="font-semibold text-sm flex items-center gap-2">
                    {collapsed ? (
                      <ChevronRight className="w-4 h-4 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 shrink-0" />
                    )}
                    {tVm(`catalogGroups.${group}`)}
                    <Badge variant="outline" className="font-normal">
                      {items.length}
                    </Badge>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t('groupActiveCount', { active: activeCount, total: items.length })}
                  </span>
                </button>
                {!collapsed && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('colCode')}</TableHead>
                          <TableHead>{t('colLabelKo')}</TableHead>
                          <TableHead className="text-right">{t('colMileage')}</TableHead>
                          <TableHead className="text-right">{t('colMonths')}</TableHead>
                          <TableHead>{t('colIntervalKind')}</TableHead>
                          <TableHead className="text-right">{t('colSort')}</TableHead>
                          <TableHead>{t('colStatus')}</TableHead>
                          <TableHead>{t('colActions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>{items.map((row) => renderCatalogRow(row))}</TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('dialogCreateTitle')}</DialogTitle>
            <DialogDescription>{t('dialogCreateHint')}</DialogDescription>
          </DialogHeader>
          <CatalogFormFields form={createForm} setForm={setCreateForm} t={t} tVm={tVm} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="button" onClick={() => void createItem()} disabled={savingCode === '__create__'}>
              {savingCode === '__create__' ? t('saving') : t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('dialogEditTitle')}</DialogTitle>
            <DialogDescription>{t('dialogEditHint')}</DialogDescription>
          </DialogHeader>
          <CatalogFormFields
            form={editForm}
            setForm={setEditForm}
            codeReadOnly
            t={t}
            tVm={tVm}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditRow(null)}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => void saveEdit()}
              disabled={!!editRow && savingCode === editRow.code}
            >
              {editRow && savingCode === editRow.code ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
