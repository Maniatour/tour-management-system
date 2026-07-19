'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { apiBearerAuthHeaders } from '@/lib/api-client-bearer'
import {
  CATALOG_GROUP_ORDER,
  catalogItemLabel,
  type VehicleMaintenanceCatalogRow,
  type VehicleMaintenanceScheduleRow,
} from '@/lib/vehicleMaintenanceCatalog'
import {
  computeVehicleMaintenanceDueList,
  type MaintenanceDueItem,
  type MaintenanceDueStatus,
} from '@/lib/vehicleMaintenanceSchedule'
import { maintenanceDutyPresetMeta } from '@/lib/vehicleMaintenanceDutyPresets'
import {
  FUEL_TYPE_LABELS,
  MAINTENANCE_CLASS_LABELS,
  normalizeFuelType,
  normalizeMaintenanceVehicleClass,
} from '@/lib/vehicleMaintenanceApplicability'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Gauge, Edit, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useOperatorOptional } from '@/contexts/OperatorContext'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'

type VehicleLabelFields = {
  id: string
  vehicle_number?: string | null
  vehicle_type?: string | null
  nick?: string | null
  current_mileage?: number | null
  engine_oil_change_cycle?: number | null
  recent_engine_oil_change_mileage?: number | null
  maintenance_duty_preset?: string | null
  fuel_type?: string | null
  maintenance_vehicle_class?: string | null
}

function toScheduleVehicleRow(v: VehicleLabelFields) {
  return {
    id: v.id,
    current_mileage: v.current_mileage ?? null,
    engine_oil_change_cycle: v.engine_oil_change_cycle ?? null,
    recent_engine_oil_change_mileage: v.recent_engine_oil_change_mileage ?? null,
    maintenance_duty_preset: v.maintenance_duty_preset ?? 'standard',
    fuel_type: v.fuel_type ?? 'diesel',
    maintenance_vehicle_class: v.maintenance_vehicle_class ?? 'diesel_van',
  }
}

type MaintenanceRow = {
  id: string
  vehicle_id: string | null
  maintenance_date: string
  mileage: number | null
  subcategory: string | null
  mileage_interval: number | null
  next_maintenance_mileage: number | null
}

type ScheduleFilter = 'due' | 'all' | 'no_record'

type Props = {
  vehicles: VehicleLabelFields[]
  maintenances: MaintenanceRow[]
  vehicleIds: string[]
  showVehicleColumn: boolean
  vehicleLabel: (vehicle: VehicleLabelFields) => string
  formatDate: (ymd: string | null) => string
  hidden?: boolean
}

type EditForm = {
  vehicle_id: string
  catalog_code: string
  is_enabled: boolean
  custom_mileage_interval: string
  last_service_date: string
  last_service_mileage: string
  notes: string
}

export default function VehicleMaintenanceSchedulePanel({
  vehicles,
  maintenances,
  vehicleIds,
  showVehicleColumn,
  vehicleLabel,
  formatDate,
  hidden = false,
}: Props) {
  const t = useTranslations('vehicleMaintenance')
  const { operatorId } = useOperatorOptional()
  const activeOperatorId = resolveOperatorId(operatorId)
  let locale = 'ko'
  try {
    locale = useLocale()
  } catch {
    locale = 'ko'
  }

  const [catalog, setCatalog] = useState<VehicleMaintenanceCatalogRow[]>([])
  const [schedules, setSchedules] = useState<VehicleMaintenanceScheduleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ScheduleFilter>('due')
  const [groupFilter, setGroupFilter] = useState<string>('all')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState<EditForm | null>(null)

  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles])

  const loadCatalogAndSchedules = useCallback(async () => {
    try {
      setLoading(true)
      const scheduleParams = new URLSearchParams({ operatorId: activeOperatorId })
      if (vehicleIds.length === 1) {
        scheduleParams.set('vehicle_id', vehicleIds[0])
      }
      const [catalogRes, schedulesRes] = await Promise.all([
        fetch('/api/vehicle-maintenance/catalog', { headers: apiBearerAuthHeaders() }),
        fetch(`/api/vehicle-maintenance/schedules?${scheduleParams.toString()}`, {
          headers: apiBearerAuthHeaders(),
        }),
      ])
      const catalogJson = await catalogRes.json()
      const schedulesJson = await schedulesRes.json()
      if (catalogRes.ok) setCatalog(catalogJson.data ?? [])
      if (schedulesRes.ok) {
        const rows = (schedulesJson.data ?? []) as VehicleMaintenanceScheduleRow[]
        const idSet = new Set(vehicleIds)
        setSchedules(vehicleIds.length > 0 ? rows.filter((r) => idSet.has(r.vehicle_id)) : rows)
      }
    } catch (e) {
      console.error('정기점검 데이터 로드 오류:', e)
      toast.error(t('schedule.loadError'))
    } finally {
      setLoading(false)
    }
  }, [vehicleIds, t, activeOperatorId])

  useEffect(() => {
    if (hidden || vehicleIds.length === 0) return
    void loadCatalogAndSchedules()
  }, [hidden, vehicleIds, loadCatalogAndSchedules])

  const singleVehicleMeta = useMemo(() => {
    if (vehicleIds.length !== 1) return null
    const v = vehicleById.get(vehicleIds[0])
    if (!v) return null
    const fuel = normalizeFuelType(v.fuel_type)
    const vehicleClass = normalizeMaintenanceVehicleClass(v.maintenance_vehicle_class)
    return {
      preset: maintenanceDutyPresetMeta(v.maintenance_duty_preset),
      fuelLabel: locale === 'en' ? FUEL_TYPE_LABELS[fuel].en : FUEL_TYPE_LABELS[fuel].ko,
      classLabel:
        locale === 'en'
          ? MAINTENANCE_CLASS_LABELS[vehicleClass].en
          : MAINTENANCE_CLASS_LABELS[vehicleClass].ko,
    }
  }, [vehicleIds, vehicleById, locale])

  const dueItems = useMemo(() => {
    const vehicleRows = vehicles
      .filter((v) => vehicleIds.includes(v.id))
      .map(toScheduleVehicleRow)

    return computeVehicleMaintenanceDueList(vehicleRows, catalog, schedules, maintenances, {
      vehicleIds,
      includeOk: filter === 'all',
      includeDisabled: filter === 'all',
      includeNoRecord: filter === 'all' || filter === 'no_record',
    })
  }, [vehicles, vehicleIds, catalog, schedules, maintenances, filter])

  const filteredItems = useMemo(() => {
    if (filter === 'due') {
      return dueItems.filter((item) => item.status === 'overdue' || item.status === 'due_soon')
    }
    if (filter === 'no_record') {
      return dueItems.filter((item) => item.status === 'no_record')
    }
    return dueItems
  }, [dueItems, filter])

  const groupedItems = useMemo(() => {
    const map = new Map<string, MaintenanceDueItem[]>()
    for (const item of filteredItems) {
      if (groupFilter !== 'all' && item.categoryGroup !== groupFilter) continue
      const list = map.get(item.categoryGroup) ?? []
      list.push(item)
      map.set(item.categoryGroup, list)
    }
    const ordered: { group: string; items: MaintenanceDueItem[] }[] = []
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
  }, [filteredItems, groupFilter])

  const dueCount = useMemo(
    () =>
      computeVehicleMaintenanceDueList(
        vehicles.filter((v) => vehicleIds.includes(v.id)).map(toScheduleVehicleRow),
        catalog,
        schedules,
        maintenances,
        { vehicleIds, includeNoRecord: false }
      ).filter((item) => item.status === 'overdue' || item.status === 'due_soon').length,
    [vehicles, vehicleIds, catalog, schedules, maintenances]
  )

  const catalogByCode = useMemo(() => new Map(catalog.map((c) => [c.code, c])), [catalog])

  const formatMileage = (value: number | null | undefined) =>
    value != null ? `${value.toLocaleString()} mi` : '—'

  const statusLabel = (status: MaintenanceDueStatus) => {
    if (status === 'overdue') return t('schedule.statusOverdue')
    if (status === 'due_soon') return t('schedule.statusDueSoon')
    if (status === 'no_record') return t('schedule.statusNoRecord')
    if (status === 'disabled') return t('schedule.statusDisabled')
    return t('schedule.statusOk')
  }

  const statusBadgeClass = (status: MaintenanceDueStatus) => {
    if (status === 'overdue') return 'bg-red-100 text-red-800 border-red-200'
    if (status === 'due_soon') return 'bg-amber-100 text-amber-900 border-amber-200'
    if (status === 'no_record') return 'bg-slate-100 text-slate-700 border-slate-200'
    if (status === 'disabled') return 'bg-gray-100 text-gray-500 border-gray-200'
    return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  }

  const remainingLabel = (item: MaintenanceDueItem) => {
    if (item.milesUntilDue == null) return '—'
    if (item.milesUntilDue < 0) {
      return t('schedule.overdueBy', { miles: Math.abs(item.milesUntilDue).toLocaleString() })
    }
    if (item.milesUntilDue === 0) return t('schedule.statusOverdue')
    return t('schedule.dueIn', { miles: item.milesUntilDue.toLocaleString() })
  }

  const openEdit = (item: MaintenanceDueItem) => {
    const cat = catalogByCode.get(item.catalogCode)
    setEditForm({
      vehicle_id: item.vehicleId,
      catalog_code: item.catalogCode,
      is_enabled: item.isEnabled,
      custom_mileage_interval: String(
        item.intervalMiles ?? cat?.default_mileage_interval ?? ''
      ),
      last_service_date: item.lastMaintenanceDate ?? '',
      last_service_mileage:
        item.lastMaintenanceMileage != null ? String(item.lastMaintenanceMileage) : '',
      notes: item.scheduleNotes ?? '',
    })
    setEditOpen(true)
  }

  const handleSaveSchedule = async () => {
    if (!editForm) return
    try {
      setSaving(true)
      const res = await fetch('/api/vehicle-maintenance/schedules', {
        method: 'PUT',
        headers: { ...apiBearerAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, operatorId: activeOperatorId }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('schedule.saveError'))
        return
      }
      toast.success(t('schedule.saveSuccess'))
      setEditOpen(false)
      setEditForm(null)
      await loadCatalogAndSchedules()
    } catch (e) {
      console.error(e)
      toast.error(t('schedule.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  if (hidden) return null

  const editingCatalog = editForm ? catalogByCode.get(editForm.catalog_code) : null

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Gauge className="w-4 h-4" />
                {t('schedule.title')}
                {dueCount > 0 && (
                  <Badge className="bg-red-100 text-red-800 border border-red-200">{dueCount}</Badge>
                )}
              </CardTitle>
              <div className="text-sm text-muted-foreground mt-1 space-y-1">
                <span>{t('schedule.descriptionFull')}</span>
                {singleVehicleMeta && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-normal text-xs">
                      {locale === 'en'
                        ? singleVehicleMeta.preset.labelEn
                        : singleVehicleMeta.preset.labelKo}
                    </Badge>
                    <Badge variant="outline" className="font-normal text-xs">
                      {singleVehicleMeta.fuelLabel}
                    </Badge>
                    <Badge variant="outline" className="font-normal text-xs">
                      {singleVehicleMeta.classLabel}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {locale === 'en'
                        ? singleVehicleMeta.preset.descriptionEn
                        : singleVehicleMeta.preset.descriptionKo}
                      {' · '}
                      {t('schedule.dueSoonThreshold', {
                        miles: singleVehicleMeta.preset.dueSoonMiles,
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={filter} onValueChange={(v) => setFilter(v as ScheduleFilter)}>
                <SelectTrigger className="w-[10rem] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="due">{t('schedule.filterDue')}</SelectItem>
                  <SelectItem value="no_record">{t('schedule.filterNoRecord')}</SelectItem>
                  <SelectItem value="all">{t('schedule.filterAll')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="w-[11rem] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('schedule.allGroups')}</SelectItem>
                  {CATALOG_GROUP_ORDER.map((group) => (
                    <SelectItem key={group} value={group}>
                      {t(`catalogGroups.${group}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {vehicleIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('schedule.noData')}</p>
          ) : loading ? (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          ) : groupedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('schedule.noDueItems')}</p>
          ) : (
            <div className="space-y-4">
              {groupedItems.map(({ group, items }) => {
                const collapsed = collapsedGroups.has(group)
                return (
                  <div key={group} className="border rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/60 text-left"
                    >
                      <span className="font-medium text-sm flex items-center gap-2">
                        {collapsed ? (
                          <ChevronRight className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                        {t(`catalogGroups.${group}`)}
                        <Badge variant="outline" className="text-xs">
                          {items.length}
                        </Badge>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {
                          items.filter((i) => i.status === 'overdue' || i.status === 'due_soon')
                            .length
                        }{' '}
                        {t('schedule.dueShort')}
                      </span>
                    </button>
                    {!collapsed && (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {showVehicleColumn && (
                                <TableHead className="whitespace-nowrap">
                                  {t('schedule.vehicle')}
                                </TableHead>
                              )}
                              <TableHead className="whitespace-nowrap min-w-[9rem]">
                                {t('schedule.workType')}
                              </TableHead>
                              <TableHead className="whitespace-nowrap">
                                {t('schedule.lastServiceDate')}
                              </TableHead>
                              <TableHead className="whitespace-nowrap text-right">
                                {t('schedule.lastServiceMileage')}
                              </TableHead>
                              <TableHead className="whitespace-nowrap">
                                {t('schedule.interval')}
                              </TableHead>
                              <TableHead className="whitespace-nowrap text-right">
                                {t('schedule.dueAtMileage')}
                              </TableHead>
                              <TableHead className="whitespace-nowrap text-right">
                                {t('schedule.currentMileage')}
                              </TableHead>
                              <TableHead className="whitespace-nowrap">
                                {t('schedule.remaining')}
                              </TableHead>
                              <TableHead className="whitespace-nowrap">
                                {t('schedule.status')}
                              </TableHead>
                              <TableHead className="w-10" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map((item) => {
                              const vehicle = vehicleById.get(item.vehicleId)
                              const cat = catalogByCode.get(item.catalogCode)
                              const label = cat
                                ? catalogItemLabel(cat, locale)
                                : item.catalogCode
                              return (
                                <TableRow
                                  key={`${item.vehicleId}-${item.catalogCode}`}
                                  className={item.status === 'overdue' ? 'bg-red-50/60' : undefined}
                                >
                                  {showVehicleColumn && (
                                    <TableCell className="font-medium text-sm">
                                      {vehicle ? vehicleLabel(vehicle) : item.vehicleId}
                                    </TableCell>
                                  )}
                                  <TableCell className="text-sm">
                                    <div className="font-medium">{label}</div>
                                    {cat?.notes_ko && (
                                      <div className="text-xs text-muted-foreground line-clamp-1">
                                        {locale.startsWith('en') && cat.notes_en
                                          ? cat.notes_en
                                          : cat.notes_ko}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {formatDate(item.lastMaintenanceDate)}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums text-sm">
                                    {formatMileage(item.lastMaintenanceMileage)}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {item.intervalMiles != null
                                      ? t('schedule.intervalMiles', {
                                          miles: item.intervalMiles.toLocaleString(),
                                        })
                                      : item.intervalMonths != null
                                        ? t('schedule.intervalMonths', {
                                            months: item.intervalMonths,
                                          })
                                        : t('schedule.intervalInspection')}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums text-sm font-medium">
                                    {formatMileage(item.dueAtMileage)}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums text-sm">
                                    {formatMileage(item.currentMileage)}
                                  </TableCell>
                                  <TableCell className="text-sm">{remainingLabel(item)}</TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={statusBadgeClass(item.status)}
                                    >
                                      {statusLabel(item.status)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => openEdit(item)}
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('schedule.editTitle')}</DialogTitle>
            <DialogDescription>
              {editingCatalog ? catalogItemLabel(editingCatalog, locale) : editForm?.catalog_code}
            </DialogDescription>
          </DialogHeader>
          {editForm && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="schedule_enabled"
                  checked={editForm.is_enabled}
                  onCheckedChange={(checked) =>
                    setEditForm({ ...editForm, is_enabled: checked === true })
                  }
                />
                <Label htmlFor="schedule_enabled">{t('schedule.trackItem')}</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="last_service_date">{t('schedule.lastServiceDate')}</Label>
                  <Input
                    id="last_service_date"
                    type="date"
                    value={editForm.last_service_date}
                    onChange={(e) =>
                      setEditForm({ ...editForm, last_service_date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="last_service_mileage">{t('schedule.lastServiceMileage')}</Label>
                  <Input
                    id="last_service_mileage"
                    type="number"
                    value={editForm.last_service_mileage}
                    onChange={(e) =>
                      setEditForm({ ...editForm, last_service_mileage: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="custom_mileage_interval">{t('schedule.customInterval')}</Label>
                <Input
                  id="custom_mileage_interval"
                  type="number"
                  placeholder={
                    editingCatalog?.default_mileage_interval != null
                      ? String(editingCatalog.default_mileage_interval)
                      : undefined
                  }
                  value={editForm.custom_mileage_interval}
                  onChange={(e) =>
                    setEditForm({ ...editForm, custom_mileage_interval: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="schedule_notes">{t('schedule.notes')}</Label>
                <Textarea
                  id="schedule_notes"
                  rows={3}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  {t('buttons.cancel')}
                </Button>
                <Button type="button" onClick={handleSaveSchedule} disabled={saving}>
                  {t('buttons.save')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
