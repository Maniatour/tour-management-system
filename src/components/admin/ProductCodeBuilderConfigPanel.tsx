'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createEmptyBuilderSegment,
  getBuilderGroupOrder,
  moveBuilderGroupOrder,
  type ProductCodeBuilderConfigStored,
  type ProductCodeBuilderSegmentStored,
  validateBuilderSegmentInput,
} from '@/lib/productCodeBuilderConfig'
import {
  PRODUCT_CODE_GROUP_LABELS,
  type ProductCodeSegmentGroup,
} from '@/lib/productCodeSystem'

type ProductCodeBuilderConfigPanelProps = {
  config: ProductCodeBuilderConfigStored
  onChange: (config: ProductCodeBuilderConfigStored) => void
  onSave: () => Promise<void>
  onResetDefaults: () => void
  saving: boolean
  locale: string
  dirty: boolean
}

export default function ProductCodeBuilderConfigPanel({
  config,
  onChange,
  onSave,
  onResetDefaults,
  saving,
  locale,
  dirty,
}: ProductCodeBuilderConfigPanelProps) {
  const t = useTranslations('products.productCode.builderConfig')
  const isEn = locale === 'en'
  const [activeGroup, setActiveGroup] = useState<ProductCodeSegmentGroup>('company')
  const [draft, setDraft] = useState<ProductCodeBuilderSegmentStored | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const groupItems = config.segmentsByGroup[activeGroup] ?? []

  const orderedGroups = useMemo(() => getBuilderGroupOrder(config), [config])

  const sortedItems = useMemo(
    () => [...groupItems].sort((a, b) => a.sortOrder - b.sortOrder),
    [groupItems]
  )

  const updateGroupItems = (items: ProductCodeBuilderSegmentStored[]) => {
    onChange({
      ...config,
      segmentsByGroup: {
        ...config.segmentsByGroup,
        [activeGroup]: items.map((item, i) => ({ ...item, sortOrder: i })),
      },
    })
  }

  const startAdd = () => {
    setEditingId(null)
    setDraft(createEmptyBuilderSegment(activeGroup))
    setFormError(null)
  }

  const startEdit = (item: ProductCodeBuilderSegmentStored) => {
    setEditingId(item.id)
    setDraft({ ...item })
    setFormError(null)
  }

  const cancelForm = () => {
    setEditingId(null)
    setDraft(null)
    setFormError(null)
  }

  const saveForm = () => {
    if (!draft) return
    const validation = validateBuilderSegmentInput(draft, groupItems, editingId ?? undefined)
    if (!validation.valid) {
      setFormError((isEn ? validation.errorEn : validation.errorKo) ?? null)
      return
    }

    const normalized: ProductCodeBuilderSegmentStored = {
      ...draft,
      code: draft.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''),
      labelKo: draft.labelKo.trim(),
      labelEn: draft.labelEn.trim() || draft.labelKo.trim(),
    }

    if (editingId) {
      updateGroupItems(groupItems.map((item) => (item.id === editingId ? normalized : item)))
    } else {
      updateGroupItems([...groupItems, { ...normalized, sortOrder: groupItems.length }])
    }
    cancelForm()
  }

  const removeItem = (id: string) => {
    if (!window.confirm(t('deleteConfirm'))) return
    updateGroupItems(groupItems.filter((item) => item.id !== id))
    if (editingId === id) cancelForm()
  }

  const moveItem = (id: string, direction: -1 | 1) => {
    const index = sortedItems.findIndex((item) => item.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= sortedItems.length) return
    const next = [...sortedItems]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved!)
    updateGroupItems(next)
  }

  const moveGroup = (group: ProductCodeSegmentGroup, direction: -1 | 1) => {
    onChange({
      ...config,
      groupOrder: moveBuilderGroupOrder(orderedGroups, group, direction),
    })
  }

  const toggleEnabled = (id: string, enabled: boolean) => {
    updateGroupItems(groupItems.map((item) => (item.id === id ? { ...item, enabled } : item)))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <p className="text-sm font-semibold text-foreground">{t('title')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="shrink-0 border-b border-border lg:w-56 lg:border-b-0 lg:border-r">
          <p className="hidden px-3 pt-3 text-[11px] font-medium text-muted-foreground lg:block">
            {t('groupOrderHint')}
          </p>
          <nav className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:overflow-visible">
            {orderedGroups.map((group, groupIndex) => {
              const count = config.segmentsByGroup[group]?.filter((s) => s.enabled).length ?? 0
              const label = isEn ? PRODUCT_CODE_GROUP_LABELS[group].en : PRODUCT_CODE_GROUP_LABELS[group].ko
              return (
                <div
                  key={group}
                  className={`flex items-center gap-0.5 rounded-lg ${
                    activeGroup === group ? 'bg-primary/10 ring-1 ring-primary/30' : ''
                  }`}
                >
                  <div className="hidden shrink-0 flex-col gap-0.5 pl-1 lg:flex">
                    <button
                      type="button"
                      disabled={groupIndex === 0}
                      onClick={() => moveGroup(group, -1)}
                      className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                      aria-label={t('moveGroupUp')}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      disabled={groupIndex === orderedGroups.length - 1}
                      onClick={() => moveGroup(group, 1)}
                      className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                      aria-label={t('moveGroupDown')}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveGroup(group)
                      cancelForm()
                    }}
                    className={`flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm whitespace-nowrap transition-colors lg:px-3 ${
                      activeGroup === group
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <span className="truncate">{label}</span>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        activeGroup === group ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                </div>
              )
            })}
          </nav>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <p className="text-sm font-medium text-foreground">
                  {isEn ? PRODUCT_CODE_GROUP_LABELS[activeGroup].en : PRODUCT_CODE_GROUP_LABELS[activeGroup].ko}
                </p>
                <div className="flex items-center lg:hidden">
                  <button
                    type="button"
                    disabled={orderedGroups.indexOf(activeGroup) === 0}
                    onClick={() => moveGroup(activeGroup, -1)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                    aria-label={t('moveGroupUp')}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={orderedGroups.indexOf(activeGroup) === orderedGroups.length - 1}
                    onClick={() => moveGroup(activeGroup, 1)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                    aria-label={t('moveGroupDown')}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={startAdd}>
                <Plus className="mr-1.5 h-4 w-4" />
                {t('addItem')}
              </Button>
            </div>

            {draft ? (
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                <p className="text-sm font-medium">{editingId ? t('editItem') : t('newItem')}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>{t('code')}</Label>
                    <Input
                      value={draft.code}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev
                            ? { ...prev, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }
                            : prev
                        )
                      }
                      placeholder="M"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('labelKo')}</Label>
                    <Input
                      value={draft.labelKo}
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, labelKo: e.target.value } : prev))}
                      placeholder="Mania Tour"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label>{t('labelEn')}</Label>
                    <Input
                      value={draft.labelEn}
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, labelEn: e.target.value } : prev))}
                      placeholder="Mania Tour"
                    />
                  </div>
                </div>
                {formError ? <p className="text-xs text-destructive">{formError}</p> : null}
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={saveForm}>
                    {editingId ? t('updateItem') : t('appendItem')}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={cancelForm}>
                    {t('cancelItem')}
                  </Button>
                </div>
              </div>
            ) : null}

            {sortedItems.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                {t('emptyGroup')}
              </p>
            ) : (
              <ul className="space-y-2">
                {sortedItems.map((item, index) => (
                  <li
                    key={item.id}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
                      item.enabled ? 'border-border bg-background' : 'border-border/60 bg-muted/30 opacity-70'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveItem(item.id, -1)}
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                        aria-label={t('moveUp')}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === sortedItems.length - 1}
                        onClick={() => moveItem(item.id, 1)}
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                        aria-label={t('moveDown')}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-foreground">{item.code}</span>
                        <span className="truncate text-sm text-foreground">
                          {isEn ? item.labelEn : item.labelKo}
                        </span>
                      </div>
                      {!item.enabled ? (
                        <p className="text-[11px] text-muted-foreground">{t('disabled')}</p>
                      ) : null}
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={item.enabled}
                        onChange={(e) => toggleEnabled(item.id, e.target.checked)}
                      />
                      {t('enabled')}
                    </label>
                    <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(item)}>
                      {t('editItem')}
                    </Button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                      aria-label={t('deleteItem')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
            <Button type="button" variant="ghost" size="sm" onClick={onResetDefaults} disabled={saving}>
              <RotateCcw className="mr-1.5 h-4 w-4" />
              {t('resetDefaults')}
            </Button>
            <Button type="button" onClick={() => void onSave()} disabled={saving || !dirty}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {t('saveConfig')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
