'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import SopDocumentReadonly from '@/components/sop/SopDocumentReadonly'
import SopDocumentSearchBar from '@/components/sop/SopDocumentSearchBar'
import { buildSopDocumentToc, sopTocAnchorIds, type SopTocEntry, type SopTocLevel } from '@/lib/sopDocumentToc'
import { searchSopDocument } from '@/lib/sopDocumentSearch'
import { usePersistedSplitWidth } from '@/hooks/usePersistedSplitWidth'
import type { SopDocument, SopEditLocale } from '@/types/sopStructure'
import { cn } from '@/lib/utils'

type Props = {
  doc: SopDocument
  viewLang: SopEditLocale
  uiLocaleEn: boolean
  /** 목차(왼쪽 트리) 너비 드래그 조절 */
  resizableToc?: boolean
  tocWidthStorageKey?: string
  onEditSection?: (sectionId: string) => void
  onEditCategory?: (sectionId: string, categoryId: string) => void
  onAddSection?: () => void
  onDeleteSection?: (sectionId: string) => void
  onAddCategory?: (sectionId: string, afterCategoryId?: string) => void
  onDeleteCategory?: (sectionId: string, categoryId: string) => void
  onMoveSection?: (sectionId: string, direction: -1 | 1) => void
  onMoveCategory?: (sectionId: string, categoryId: string, direction: -1 | 1) => void
  onAddChecklistItem?: (sectionId: string, categoryId: string, afterItemId?: string) => void
  onEditChecklistItem?: (sectionId: string, categoryId: string, itemId: string) => void
  onDeleteChecklistItem?: (sectionId: string, categoryId: string, itemId: string) => void
  onMoveChecklistItem?: (
    sectionId: string,
    categoryId: string,
    itemId: string,
    direction: -1 | 1
  ) => void
  onEditChecklistManual?: (sectionId: string, categoryId: string, itemId: string) => void
  onChangeRowDisplay?: (
    sectionId: string,
    categoryId: string,
    itemId: string,
    display: 'list' | 'text'
  ) => void
  onManageAttachments?: (sectionId: string, categoryId: string, itemId: string) => void
  onConvertCategoryToRow?: (sectionId: string, categoryId: string) => void
  onConvertRowToCategory?: (sectionId: string, categoryId: string, itemId: string) => void
  onEditCategoryManual?: (sectionId: string, categoryId: string) => void
  /** 읽기 모달 등 — 문서 내 검색 */
  enableSearch?: boolean
}

function scrollToAnchor(anchorId: string) {
  const el = document.getElementById(anchorId)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function tocLevelClass(level: SopTocLevel, active: boolean): string {
  if (level === 'section') {
    return active
      ? 'bg-indigo-100 font-medium text-indigo-900'
      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
  }
  if (level === 'category') {
    return active
      ? 'bg-indigo-50 font-medium text-indigo-800'
      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
  }
  if (level === 'row') {
    return active
      ? 'bg-violet-50 font-medium text-violet-900'
      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
  }
  return active
    ? 'bg-gray-100 font-medium text-gray-900'
    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
}

function tocTextClass(level: SopTocLevel): string {
  if (level === 'section') return 'text-sm'
  if (level === 'category') return 'text-xs'
  if (level === 'row') return 'text-xs'
  return 'text-[11px]'
}

function tocEntryHasMatch(entry: SopTocEntry, matchingAnchorIds: Set<string>): boolean {
  if (matchingAnchorIds.has(entry.anchorId)) return true
  return entry.children?.some((child) => tocEntryHasMatch(child, matchingAnchorIds)) ?? false
}

function TocTree({
  entries,
  activeAnchorId,
  matchingAnchorIds,
  depth = 0,
  onNavigate,
}: {
  entries: SopTocEntry[]
  activeAnchorId: string | null
  matchingAnchorIds?: Set<string> | null
  depth?: number
  onNavigate: (anchorId: string) => void
}) {
  return (
    <ul className={cn(depth > 0 && 'ml-3 mt-0.5 space-y-0.5 border-l border-gray-200 pl-2', depth === 0 && 'space-y-0.5')}>
      {entries.map((entry) => {
        const entryMatches = matchingAnchorIds?.has(entry.anchorId) ?? false
        const showEntry =
          !matchingAnchorIds ||
          matchingAnchorIds.size === 0 ||
          entryMatches ||
          (matchingAnchorIds ? tocEntryHasMatch(entry, matchingAnchorIds) : false)

        if (!showEntry) return null

        return (
        <li key={entry.anchorId}>
          <button
            type="button"
            onClick={() => onNavigate(entry.anchorId)}
            className={cn(
              'w-full rounded-md px-3 py-2.5 text-left transition-colors touch-manipulation',
              tocTextClass(entry.level),
              tocLevelClass(entry.level, activeAnchorId === entry.anchorId),
              entryMatches && matchingAnchorIds && 'ring-1 ring-amber-300 bg-amber-50/80'
            )}
          >
            {entry.label}
          </button>
          {entry.children?.length ? (
            <TocTree
              entries={entry.children}
              activeAnchorId={activeAnchorId}
              {...(matchingAnchorIds ? { matchingAnchorIds } : {})}
              depth={depth + 1}
              onNavigate={onNavigate}
            />
          ) : null}
        </li>
        )
      })}
    </ul>
  )
}

function TocNav({
  entries,
  activeAnchorId,
  matchingAnchorIds,
  uiLocaleEn,
  onNavigate,
  className,
}: {
  entries: SopTocEntry[]
  activeAnchorId: string | null
  matchingAnchorIds?: Set<string> | null
  uiLocaleEn: boolean
  onNavigate: (anchorId: string) => void
  className?: string
}) {
  if (entries.length === 0) return null

  return (
    <nav aria-label={uiLocaleEn ? 'Table of contents' : '목차'} className={className}>
      <TocTree
        entries={entries}
        activeAnchorId={activeAnchorId}
        {...(matchingAnchorIds ? { matchingAnchorIds } : {})}
        onNavigate={onNavigate}
      />
    </nav>
  )
}

export default function SopDocumentWithToc({
  doc,
  viewLang,
  uiLocaleEn,
  onEditSection,
  onEditCategory,
  onAddSection,
  onDeleteSection,
  onAddCategory,
  onDeleteCategory,
  onMoveSection,
  onMoveCategory,
  onAddChecklistItem,
  onEditChecklistItem,
  onDeleteChecklistItem,
  onMoveChecklistItem,
  onEditChecklistManual,
  onChangeRowDisplay,
  onManageAttachments,
  onConvertCategoryToRow,
  onConvertRowToCategory,
  onEditCategoryManual,
  resizableToc = false,
  tocWidthStorageKey = 'sop-document-toc-width',
  enableSearch = false,
}: Props) {
  const entries = useMemo(() => buildSopDocumentToc(doc, viewLang), [doc, viewLang])
  const flatAnchors = useMemo(() => sopTocAnchorIds(entries), [entries])
  const [activeAnchorId, setActiveAnchorId] = useState<string | null>(entries[0]?.anchorId ?? null)
  const [mobileTocOpen, setMobileTocOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchActiveIndex, setSearchActiveIndex] = useState(0)
  const searchHits = useMemo(
    () => (enableSearch ? searchSopDocument(doc, searchQuery, viewLang, uiLocaleEn) : []),
    [doc, enableSearch, searchQuery, uiLocaleEn, viewLang]
  )
  const matchingAnchorIds = useMemo(() => {
    if (!searchQuery.trim() || searchHits.length === 0) return null
    return new Set(searchHits.map((hit) => hit.anchorId))
  }, [searchHits, searchQuery])
  const activeSearchHit = searchHits[searchActiveIndex] ?? null
  const { width: tocWidth, onResizePointerDown: onTocResizePointerDown } = usePersistedSplitWidth({
    storageKey: tocWidthStorageKey,
    defaultWidth: 224,
    minWidth: 160,
    maxWidth: 420,
    enabled: resizableToc,
  })

  const onNavigate = useCallback((anchorId: string) => {
    scrollToAnchor(anchorId)
    setActiveAnchorId(anchorId)
    setMobileTocOpen(false)
  }, [])

  useEffect(() => {
    setSearchActiveIndex(0)
  }, [searchQuery])

  useEffect(() => {
    if (!enableSearch || !activeSearchHit) return
    scrollToAnchor(activeSearchHit.anchorId)
    setActiveAnchorId(activeSearchHit.anchorId)
  }, [activeSearchHit, enableSearch])

  useEffect(() => {
    if (!enableSearch || !activeSearchHit) return
    const el = document.getElementById(activeSearchHit.anchorId)
    if (!el) return
    el.classList.add('sop-search-active')
    return () => {
      el.classList.remove('sop-search-active')
    }
  }, [activeSearchHit, enableSearch])

  useEffect(() => {
    if (flatAnchors.length === 0) return

    const observer = new IntersectionObserver(
      (observed) => {
        const visible = observed
          .filter((o) => o.isIntersecting)
          .sort((a, b) => (a.boundingClientRect.top ?? 0) - (b.boundingClientRect.top ?? 0))
        if (visible.length > 0 && visible[0].target.id) {
          setActiveAnchorId(visible[0].target.id)
        }
      },
      { rootMargin: '-72px 0px -55% 0px', threshold: 0 }
    )

    for (const anchorId of flatAnchors) {
      const el = document.getElementById(anchorId)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [flatAnchors])

  const readonlyProps = {
    doc,
    viewLang,
    anchors: true as const,
    ...(activeSearchHit?.rowId ? { searchFocusRowId: activeSearchHit.rowId } : {}),
    ...(onEditSection ? { onEditSection } : {}),
    ...(onEditCategory ? { onEditCategory } : {}),
    ...(onAddSection ? { onAddSection } : {}),
    ...(onDeleteSection ? { onDeleteSection } : {}),
    ...(onAddCategory ? { onAddCategory } : {}),
    ...(onDeleteCategory ? { onDeleteCategory } : {}),
    ...(onMoveSection ? { onMoveSection } : {}),
    ...(onMoveCategory ? { onMoveCategory } : {}),
    ...(onAddChecklistItem ? { onAddChecklistItem } : {}),
    ...(onEditChecklistItem ? { onEditChecklistItem } : {}),
    ...(onDeleteChecklistItem ? { onDeleteChecklistItem } : {}),
    ...(onMoveChecklistItem ? { onMoveChecklistItem } : {}),
    ...(onEditChecklistManual ? { onEditChecklistManual } : {}),
    ...(onChangeRowDisplay ? { onChangeRowDisplay } : {}),
    ...(onManageAttachments ? { onManageAttachments } : {}),
    ...(onConvertCategoryToRow ? { onConvertCategoryToRow } : {}),
    ...(onConvertRowToCategory ? { onConvertRowToCategory } : {}),
    ...(onEditCategoryManual ? { onEditCategoryManual } : {}),
  }

  if (entries.length <= 1 && !(entries[0]?.children?.length)) {
    return (
      <div className={cn('space-y-3', resizableToc && 'flex h-full min-h-0 flex-col')}>
        {enableSearch ? (
          <SopDocumentSearchBar
            query={searchQuery}
            onQueryChange={setSearchQuery}
            hits={searchHits}
            activeIndex={searchActiveIndex}
            onActiveIndexChange={setSearchActiveIndex}
            uiLocaleEn={uiLocaleEn}
          />
        ) : null}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 sm:p-4">
          <SopDocumentReadonly {...readonlyProps} />
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', resizableToc && 'flex h-full min-h-0 flex-col')}>
      {enableSearch ? (
        <SopDocumentSearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          hits={searchHits}
          activeIndex={searchActiveIndex}
          onActiveIndexChange={setSearchActiveIndex}
          uiLocaleEn={uiLocaleEn}
          {...(resizableToc ? { className: 'shrink-0' } : {})}
        />
      ) : null}
      <div className="md:hidden">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-800 shadow-sm touch-manipulation active:bg-gray-50"
          aria-expanded={mobileTocOpen}
          onClick={() => setMobileTocOpen((o) => !o)}
        >
          <span>{uiLocaleEn ? 'Table of contents' : '목차'}</span>
          <span className="text-gray-500">{mobileTocOpen ? '▲' : '▼'}</span>
        </button>
        {mobileTocOpen ? (
          <div className="mt-2 max-h-[min(40vh,20rem)] overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
            <TocNav
              entries={entries}
              activeAnchorId={activeAnchorId}
              {...(matchingAnchorIds ? { matchingAnchorIds } : {})}
              uiLocaleEn={uiLocaleEn}
              onNavigate={onNavigate}
            />
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          resizableToc
            ? 'flex min-h-0 flex-1 gap-0'
            : 'grid gap-4 md:grid-cols-[minmax(11rem,14rem)_1fr] lg:grid-cols-[minmax(12rem,16rem)_1fr]'
        )}
      >
        <aside
          className={cn(resizableToc ? 'hidden min-h-0 shrink-0 md:block' : 'hidden md:block')}
          style={resizableToc ? { width: tocWidth } : undefined}
        >
          <div
            className={cn(
              'overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 shadow-sm',
              resizableToc ? 'h-full' : 'sticky top-4 max-h-[calc(100vh-6rem)]'
            )}
          >
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {uiLocaleEn ? 'Contents' : '목차'}
            </h2>
            <TocNav
              entries={entries}
              activeAnchorId={activeAnchorId}
              {...(matchingAnchorIds ? { matchingAnchorIds } : {})}
              uiLocaleEn={uiLocaleEn}
              onNavigate={onNavigate}
            />
          </div>
        </aside>

        {resizableToc ? (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={uiLocaleEn ? 'Resize table of contents' : '목차 너비 조절'}
            className="relative hidden w-2 shrink-0 cursor-col-resize touch-none md:block"
            onPointerDown={onTocResizePointerDown}
          >
            <div className="absolute inset-y-3 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-gray-200 hover:bg-indigo-300" />
          </div>
        ) : null}

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 sm:p-4">
          <SopDocumentReadonly {...readonlyProps} />
        </div>
      </div>
    </div>
  )
}
