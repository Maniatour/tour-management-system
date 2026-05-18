'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState, useId } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { ChevronsUpDown, Search } from 'lucide-react'
import {
  unifiedStandardGroupSelectChrome,
  unifiedStandardTriggerLabel,
  type UnifiedStandardLeafGroup,
  type UnifiedStandardLeafItem,
  type UnifiedStandardTreeRow,
} from '@/lib/companyExpenseStandardUnified'

function leafIndentClass(depth: number): string {
  if (depth <= 0) return 'pl-3'
  if (depth === 1) return 'pl-6'
  if (depth === 2) return 'pl-10'
  return 'pl-14'
}

function filterGroupRows(
  g: UnifiedStandardLeafGroup,
  q: string
): UnifiedStandardTreeRow[] {
  const rows = g.rows?.length ? g.rows : g.items.map((it) => ({ type: 'leaf' as const, item: it, depth: 1 }))
  if (!q) return rows
  const headerHit = g.groupLabel.toLowerCase().includes(q)
  if (headerHit) return rows
  const matchedLeafIds = new Set(
    g.items
      .filter(
        (it) => it.searchText.includes(q) || it.displayLabel.toLowerCase().includes(q)
      )
      .map((it) => it.id)
  )
  if (matchedLeafIds.size === 0) return []
  const out: UnifiedStandardTreeRow[] = []
  let pendingBranches: UnifiedStandardTreeRow[] = []
  const flushBranches = () => {
    if (pendingBranches.length > 0) {
      out.push(...pendingBranches)
      pendingBranches = []
    }
  }
  for (const row of rows) {
    if (row.type === 'branch') {
      pendingBranches.push(row)
      continue
    }
    if (matchedLeafIds.has(row.item.id)) {
      flushBranches()
      out.push(...pendingBranches)
      pendingBranches = []
      out.push(row)
    }
  }
  return out
}

export type UnifiedStandardLeafPickerProps = {
  groups: UnifiedStandardLeafGroup[]
  value: string
  onPick: (leafId: string | null) => void
  /** false: «선택 없음»(초기화) 항목 숨김 */
  allowClear?: boolean
  /** value 가 비어 있을 때 트리거에 보일 문구(기본: 폼의 unifiedStandardPlaceholder) */
  placeholderWhenEmpty?: string
  /** allowClear 일 때 목록 맨 위 항목 라벨(기본: 폼의 standardPaidForLeafNone) */
  clearOptionLabel?: string
  disabled?: boolean
  /** 부모 다이얼로그가 닫히면 목록 접기·검색 초기화 */
  parentOpen?: boolean
  listZClass?: string
  /** 라벨·힌트 오른쪽 (예: COGS 안내 BookOpen) */
  headerTrailing?: React.ReactNode
  /** true: 라벨·힌트 행 생략, 콤보만 (표 안 셀 등) */
  compact?: boolean
  summary?: React.ReactNode
  renderOptionSuffix?: (item: UnifiedStandardLeafItem) => React.ReactNode
  className?: string
  /** 콤보 목록이 열리거나 닫힐 때 (부모 모달 높이 조절용) */
  onListboxOpenChange?: (open: boolean) => void
}

export function UnifiedStandardLeafPicker({
  groups,
  value,
  onPick,
  allowClear = true,
  disabled = false,
  parentOpen = true,
  listZClass = 'z-[1201]',
  headerTrailing,
  compact = false,
  summary,
  renderOptionSuffix,
  className,
  placeholderWhenEmpty,
  clearOptionLabel,
  onListboxOpenChange,
}: UnifiedStandardLeafPickerProps) {
  const t = useTranslations('companyExpense.form')
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const triggerId = useId()

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const out: { group: UnifiedStandardLeafGroup; rows: UnifiedStandardTreeRow[] }[] = []
    for (const g of groups) {
      const rows = filterGroupRows(g, q)
      if (rows.length > 0) out.push({ group: g, rows })
    }
    return out
  }, [groups, searchQuery])

  const triggerLabel = useMemo(() => unifiedStandardTriggerLabel(groups, value), [groups, value])

  useEffect(() => {
    if (!parentOpen) {
      setOpen(false)
      setSearchQuery('')
    }
  }, [parentOpen])

  useEffect(() => {
    if (!open) return
    setSearchQuery('')
    const id = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    onListboxOpenChange?.(open)
  }, [open, onListboxOpenChange])

  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (ev: MouseEvent) => {
      const root = rootRef.current
      if (root && !root.contains(ev.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  const pick = useCallback(
    (leafId: string | null) => {
      onPick(leafId)
      setOpen(false)
      setSearchQuery('')
    },
    [onPick]
  )

  if (groups.length === 0) return null

  return (
    <div className={cn('space-y-2', className)}>
      {!compact && (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor={triggerId}>{t('unifiedStandardClassification')}</Label>
            <p className="text-muted-foreground text-xs">{t('unifiedStandardHint')}</p>
          </div>
          {headerTrailing ? <div className="shrink-0">{headerTrailing}</div> : null}
        </div>
      )}
      <div ref={rootRef} className="relative">
        <Button
          type="button"
          variant="outline"
          id={triggerId}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${triggerId}-listbox`}
          aria-haspopup="listbox"
          className="h-auto min-h-10 w-full justify-between gap-2 whitespace-normal py-2 text-left font-normal text-sm"
          onClick={() => !disabled && setOpen((o) => !o)}
        >
          <span
            className={cn(
              'line-clamp-4 min-w-0 flex-1 text-left',
              !triggerLabel && 'text-muted-foreground'
            )}
          >
            {triggerLabel || placeholderWhenEmpty || t('unifiedStandardPlaceholder')}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </Button>
        {open ? (
          <div
            id={`${triggerId}-listbox`}
            role="listbox"
            className={cn(
              'absolute left-0 right-0 mt-1 flex max-h-[min(22rem,60vh)] flex-col overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg',
              listZClass
            )}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false)
                e.preventDefault()
              }
            }}
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-2 py-1.5">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-w-0 flex-1 border-0 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
                placeholder={t('unifiedStandardSearchPlaceholder')}
                aria-label={t('unifiedStandardSearchPlaceholder')}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {allowClear ? (
                <button
                  type="button"
                  role="option"
                  aria-selected={!value}
                  className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-gray-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(null)}
                >
                  {clearOptionLabel || t('standardPaidForLeafNone')}
                </button>
              ) : null}
              {filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t('unifiedStandardSearchEmpty')}
                </div>
              ) : (
                filtered.map(({ group: g, rows }) => {
                  const chrome = unifiedStandardGroupSelectChrome(g.rootId)
                  const soleRoot =
                    g.items.length === 1 &&
                    g.items[0].id === g.rootId &&
                    rows.length === 1 &&
                    rows[0].type === 'leaf'
                  if (soleRoot && rows[0].type === 'leaf') {
                    const it0 = rows[0].item
                    const selected = value === it0.id
                    return (
                      <button
                        key={g.rootId}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onMouseDown={(e) => e.preventDefault()}
                        className={cn(
                          'w-full border-0 text-left text-sm',
                          chrome.singleItemClassName,
                          selected && 'ring-1 ring-inset ring-blue-500/60'
                        )}
                        onClick={() => pick(it0.id)}
                      >
                        <span className="inline-flex flex-wrap items-baseline gap-x-1">
                          <span>{it0.displayLabel}</span>
                          {renderOptionSuffix?.(it0)}
                        </span>
                      </button>
                    )
                  }
                  return (
                    <div key={g.rootId} className="pb-1">
                      <div
                        className={cn(
                          chrome.labelClassName,
                          'mx-0 mt-0 w-full max-w-none first:mt-0'
                        )}
                      >
                        {g.groupLabel}
                      </div>
                      {rows.map((row) => {
                        if (row.type === 'branch') {
                          return (
                            <div
                              key={`branch-${row.id}`}
                              role="presentation"
                              className={cn(
                                'py-1.5 pr-3 text-xs font-semibold text-muted-foreground',
                                leafIndentClass(row.depth)
                              )}
                            >
                              {row.label}
                            </div>
                          )
                        }
                        const it = row.item
                        const selected = value === it.id
                        return (
                          <button
                            key={it.id}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            onMouseDown={(e) => e.preventDefault()}
                            className={cn(
                              'w-full border-0 py-2 pr-3 text-left text-sm hover:bg-gray-50',
                              leafIndentClass(row.depth),
                              selected && 'bg-blue-50'
                            )}
                            onClick={() => pick(it.id)}
                          >
                            <span className="inline-flex flex-wrap items-baseline gap-x-1">
                              <span>{it.displayLabel}</span>
                              {renderOptionSuffix?.(it)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ) : null}
      </div>
      {summary ? <div className="text-xs">{summary}</div> : null}
    </div>
  )
}
