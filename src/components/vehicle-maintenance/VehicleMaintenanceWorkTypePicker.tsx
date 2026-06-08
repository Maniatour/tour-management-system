'use client'

import React, { useDeferredValue, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  catalogGroupBilingualLabel,
  catalogItemBilingualLabel,
  catalogItemMatchesSearch,
  type VehicleMaintenanceCatalogRow,
} from '@/lib/vehicleMaintenanceCatalog'
import enMessages from '@/i18n/locales/en.json'

export type WorkTypeIntervalColumns = {
  miles: string | null
  months: string | null
  inspectionOnly: boolean
}

type LegacySubcategoryOption = {
  value: string
  label: string
}

type WorkTypeRowProps = {
  item: VehicleMaintenanceCatalogRow
  checked: boolean
  intervalCols: WorkTypeIntervalColumns
  lastServiceDate: string | null
  onToggle: (code: string, checked: boolean) => void
  formatDate: (ymd: string | null) => string
  intervalInspectionLabel: string
  statusNoRecordLabel: string
}

const WorkTypeRow = React.memo(function WorkTypeRow({
  item,
  checked,
  intervalCols,
  lastServiceDate,
  onToggle,
  formatDate,
  intervalInspectionLabel,
  statusNoRecordLabel,
}: WorkTypeRowProps) {
  const { ko, en } = catalogItemBilingualLabel(item)

  return (
    <label
      className={`grid grid-cols-[auto_1fr_4.75rem_4.75rem] gap-x-2 items-start rounded-md px-2 py-1.5 w-full cursor-pointer transition-colors ${
        checked ? 'bg-primary/10' : 'hover:bg-muted/80'
      }`}
    >
      <Checkbox
        className="mt-0.5 shrink-0"
        checked={checked}
        onCheckedChange={(isChecked) => onToggle(item.code, isChecked === true)}
      />
      <div className="min-w-0 pr-1">
        <span className="text-sm leading-snug block">{ko}</span>
        {en && (
          <span className="text-[11px] text-muted-foreground leading-snug block">{en}</span>
        )}
      </div>
      <div className="text-right text-[11px] text-muted-foreground tabular-nums leading-snug">
        {intervalCols.miles ? (
          <div>{intervalCols.miles}</div>
        ) : intervalCols.inspectionOnly ? (
          <div>{intervalInspectionLabel}</div>
        ) : null}
        {intervalCols.months && (
          <div className={intervalCols.miles ? 'mt-0.5' : ''}>{intervalCols.months}</div>
        )}
        {!intervalCols.miles && !intervalCols.months && !intervalCols.inspectionOnly && (
          <span>—</span>
        )}
      </div>
      <div className="text-right text-[11px] tabular-nums leading-snug">
        {checked ? (
          lastServiceDate ? (
            <span className="text-foreground">{formatDate(lastServiceDate)}</span>
          ) : (
            <span className="text-muted-foreground">{statusNoRecordLabel}</span>
          )
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </div>
    </label>
  )
})

export type VehicleMaintenanceWorkTypePickerProps = {
  hasSelectedVehicle: boolean
  hasCatalog: boolean
  groupedCatalog: Map<string, VehicleMaintenanceCatalogRow[]>
  selectedSubcategories: string[]
  onToggleSubcategory: (code: string, checked: boolean) => void
  lastServiceByCode: Map<string, string>
  intervalDisplayByCode: Map<string, WorkTypeIntervalColumns>
  legacyOptions: LegacySubcategoryOption[]
  formatDate: (ymd: string | null) => string
}

function VehicleMaintenanceWorkTypePicker({
  hasSelectedVehicle,
  hasCatalog,
  groupedCatalog,
  selectedSubcategories,
  onToggleSubcategory,
  lastServiceByCode,
  intervalDisplayByCode,
  legacyOptions,
  formatDate,
}: VehicleMaintenanceWorkTypePickerProps) {
  const t = useTranslations('vehicleMaintenance')
  const [workTypeSearch, setWorkTypeSearch] = useState('')
  const deferredSearch = useDeferredValue(workTypeSearch)

  const catalogGroupLabels = (group: string) => {
    const ko = t(`catalogGroups.${group}`)
    const en =
      (enMessages.vehicleMaintenance.catalogGroups as Record<string, string>)[group] ?? null
    return catalogGroupBilingualLabel(ko, en)
  }

  const groupedCatalogFiltered = useMemo(() => {
    const q = deferredSearch.trim()
    if (!q) return groupedCatalog
    const result = new Map<string, VehicleMaintenanceCatalogRow[]>()
    for (const [group, items] of groupedCatalog) {
      const { ko, en } = catalogGroupLabels(group)
      const groupLabel = [ko, en].filter(Boolean).join(' ')
      const filtered = items.filter((item) => catalogItemMatchesSearch(item, q, groupLabel))
      if (filtered.length > 0) result.set(group, filtered)
    }
    return result
  }, [groupedCatalog, deferredSearch, t])

  const selectedSet = useMemo(
    () => new Set(selectedSubcategories),
    [selectedSubcategories]
  )

  const emptyInterval: WorkTypeIntervalColumns = {
    miles: null,
    months: null,
    inspectionOnly: false,
  }

  return (
    <aside className="flex flex-col border-b lg:border-b-0 lg:border-r bg-muted/20 min-h-0 max-h-[min(65vh,680px)]">
      <div className="px-3 py-3 border-b shrink-0 space-y-2">
        <div className="space-y-1">
          <Label className="text-sm font-semibold">{t('form.subcategory')}</Label>
          {!hasSelectedVehicle ? (
            <p className="text-xs text-amber-700">{t('form.workTypeSelectVehicle')}</p>
          ) : selectedSubcategories.length > 0 ? (
            <p className="text-xs text-muted-foreground">{selectedSubcategories.length}개 선택</p>
          ) : null}
        </div>
        {hasSelectedVehicle && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              value={workTypeSearch}
              onChange={(e) => setWorkTypeSearch(e.target.value)}
              placeholder={t('form.workTypeSearchPlaceholder')}
              className="h-8 pl-8 pr-8 text-xs"
            />
            {workTypeSearch.trim() && (
              <button
                type="button"
                onClick={() => setWorkTypeSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                aria-label={t('buttons.resetFilters')}
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>
      {hasSelectedVehicle && hasCatalog && (
        <div className="grid grid-cols-[auto_1fr_4.75rem_4.75rem] gap-x-2 gap-y-0 px-2 py-1.5 border-b text-[10px] font-medium text-muted-foreground shrink-0">
          <span />
          <span>{t('form.subcategory')}</span>
          <span className="text-right">{t('form.workTypeMileage')}</span>
          <span className="text-right">{t('form.workTypeLastService')}</span>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        {!hasSelectedVehicle ? (
          <p className="text-sm text-muted-foreground px-2 py-6 text-center">
            {t('form.workTypeSelectVehicle')}
          </p>
        ) : hasCatalog ? (
          groupedCatalogFiltered.size === 0 ? (
            <p className="text-sm text-muted-foreground px-2 py-6 text-center">
              {t('form.workTypeSearchNoResults')}
            </p>
          ) : (
            [...groupedCatalogFiltered.entries()].map(([group, items]) => {
              const groupLabels = catalogGroupLabels(group)
              return (
                <div key={group}>
                  <div className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border/60">
                    <div>{groupLabels.ko}</div>
                    {groupLabels.en && (
                      <div className="text-[10px] font-normal opacity-80 mt-0.5">
                        {groupLabels.en}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 py-1">
                    {items.map((item) => {
                      const checked = selectedSet.has(item.code)
                      return (
                        <WorkTypeRow
                          key={item.code}
                          item={item}
                          checked={checked}
                          intervalCols={intervalDisplayByCode.get(item.code) ?? emptyInterval}
                          lastServiceDate={
                            checked ? lastServiceByCode.get(item.code) ?? null : null
                          }
                          onToggle={onToggleSubcategory}
                          formatDate={formatDate}
                          intervalInspectionLabel={t('schedule.intervalInspection')}
                          statusNoRecordLabel={t('schedule.statusNoRecord')}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })
          )
        ) : (
          <div className="flex flex-col gap-0.5">
            {legacyOptions.map((option) => {
              const checked = selectedSet.has(option.value)
              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 w-full transition-colors ${
                    checked ? 'bg-primary/10' : 'hover:bg-muted/80'
                  }`}
                >
                  <Checkbox
                    className="mt-0.5 shrink-0"
                    checked={checked}
                    onCheckedChange={(isChecked) =>
                      onToggleSubcategory(option.value, isChecked === true)
                    }
                  />
                  <span className="text-sm leading-snug">{option.label}</span>
                </label>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}

export default React.memo(VehicleMaintenanceWorkTypePicker)
