'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { ProductCodeBuilderConfigStored } from '@/lib/productCodeBuilderConfig'
import { getBuilderGroupOrder, getSegmentsByGroupFromConfig } from '@/lib/productCodeBuilderConfig'
import {
  createProductCodeBuilderRow,
  moveBuilderRow,
  PRODUCT_CODE_GROUP_LABELS,
  PRODUCT_CODE_MULTI_SEGMENT_GROUP,
  type ProductCodeBuilderRow,
  type ProductCodeSegmentGroup,
} from '@/lib/productCodeSystem'

type ProductCodeBuilderRowsProps = {
  rows: ProductCodeBuilderRow[]
  onChange: (rows: ProductCodeBuilderRow[]) => void
  config: ProductCodeBuilderConfigStored
  locale: string
}

export default function ProductCodeBuilderRows({
  rows,
  onChange,
  config,
  locale,
}: ProductCodeBuilderRowsProps) {
  const t = useTranslations('products.productCode')
  const isEn = locale === 'en'
  const [addGroup, setAddGroup] = useState<ProductCodeSegmentGroup>('company')
  const [addCode, setAddCode] = useState('')

  const orderedGroups = useMemo(() => getBuilderGroupOrder(config), [config])

  const addOptions = useMemo(
    () => getSegmentsByGroupFromConfig(config, addGroup),
    [config, addGroup]
  )

  const groupLabel = (group: ProductCodeSegmentGroup) =>
    isEn ? PRODUCT_CODE_GROUP_LABELS[group].en : PRODUCT_CODE_GROUP_LABELS[group].ko

  const handleAdd = () => {
    if (!addCode) return
    onChange([...rows, createProductCodeBuilderRow(addGroup, addCode)])
    setAddCode('')
  }

  const handleRemove = (rowId: string) => {
    onChange(rows.filter((row) => row.id !== rowId))
  }

  const handleMove = (rowId: string, direction: -1 | 1) => {
    onChange(moveBuilderRow(rows, rowId, direction))
  }

  const handleChangeCode = (rowId: string, code: string) => {
    if (!code) return
    onChange(rows.map((row) => (row.id === rowId ? { ...row, code } : row)))
  }

  const optionsForRow = (row: ProductCodeBuilderRow) => {
    const opts = getSegmentsByGroupFromConfig(config, row.group)
    if (row.code && !opts.some((opt) => opt.code === row.code)) {
      return [
        { code: row.code, labelKo: row.code, labelEn: row.code, group: row.group },
        ...opts,
      ]
    }
    return opts
  }

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {t('builderEmpty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li
              key={row.id}
              className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2"
            >
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => handleMove(row.id, -1)}
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                  aria-label={t('builderMoveUp')}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={index === rows.length - 1}
                  onClick={() => handleMove(row.id, 1)}
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                  aria-label={t('builderMoveDown')}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {groupLabel(row.group)}
              </span>
              <div className="min-w-0 flex-1">
                <Label className="sr-only">{t('builderChangeCode')}</Label>
                <select
                  value={row.code}
                  onChange={(e) => handleChangeCode(row.id, e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm font-mono"
                  aria-label={`${groupLabel(row.group)} ${t('builderChangeCode')}`}
                >
                  {optionsForRow(row).map((opt) => (
                    <option key={`${row.id}-${opt.code}`} value={opt.code}>
                      {opt.code} — {isEn ? opt.labelEn : opt.labelKo}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(row.id)}
                className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                aria-label={t('builderRemovePart')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
        <p className="text-xs font-medium text-muted-foreground">{t('builderAddPart')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('builderAddGroup')}</Label>
            <select
              value={addGroup}
              onChange={(e) => {
                setAddGroup(e.target.value as ProductCodeSegmentGroup)
                setAddCode('')
              }}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              {orderedGroups.map((group) => (
                <option key={group} value={group}>
                  {groupLabel(group)}
                  {group === PRODUCT_CODE_MULTI_SEGMENT_GROUP ? ` (${t('builderMultiHint')})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('builderAddCode')}</Label>
            <select
              value={addCode}
              onChange={(e) => setAddCode(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">{t('builderNone')}</option>
              {addOptions.map((opt) => (
                <option key={`${addGroup}-${opt.code}`} value={opt.code}>
                  {opt.code} — {isEn ? opt.labelEn : opt.labelKo}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={handleAdd} disabled={!addCode}>
          <Plus className="mr-1.5 h-4 w-4" />
          {addGroup === PRODUCT_CODE_MULTI_SEGMENT_GROUP
            ? t('builderAddDestination')
            : t('builderAppendPart')}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{t('builderHint')}</p>
    </div>
  )
}
