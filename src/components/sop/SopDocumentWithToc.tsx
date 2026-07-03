'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import SopDocumentReadonly from '@/components/sop/SopDocumentReadonly'
import { buildSopDocumentToc, type SopTocEntry } from '@/lib/sopDocumentToc'
import type { SopDocument, SopEditLocale } from '@/types/sopStructure'
import { cn } from '@/lib/utils'

type Props = {
  doc: SopDocument
  viewLang: SopEditLocale
  uiLocaleEn: boolean
}

function scrollToAnchor(anchorId: string) {
  const el = document.getElementById(anchorId)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function TocNav({
  entries,
  activeAnchorId,
  uiLocaleEn,
  onNavigate,
  className,
}: {
  entries: SopTocEntry[]
  activeAnchorId: string | null
  uiLocaleEn: boolean
  onNavigate: (anchorId: string) => void
  className?: string
}) {
  if (entries.length === 0) return null

  return (
    <nav aria-label={uiLocaleEn ? 'Table of contents' : '목차'} className={className}>
      <ul className="space-y-0.5 text-sm">
        {entries.map((entry) => (
          <li key={entry.anchorId}>
            <button
              type="button"
              onClick={() => onNavigate(entry.anchorId)}
              className={cn(
                'w-full rounded-md px-2 py-1.5 text-left transition-colors',
                activeAnchorId === entry.anchorId
                  ? 'bg-indigo-100 font-medium text-indigo-900'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              {entry.label}
            </button>
            {entry.children && entry.children.length > 0 ? (
              <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-gray-200 pl-2">
                {entry.children.map((child) => (
                  <li key={child.anchorId}>
                    <button
                      type="button"
                      onClick={() => onNavigate(child.anchorId)}
                      className={cn(
                        'w-full rounded-md px-2 py-1 text-left text-xs transition-colors',
                        activeAnchorId === child.anchorId
                          ? 'bg-indigo-50 font-medium text-indigo-800'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      )}
                    >
                      {child.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default function SopDocumentWithToc({ doc, viewLang, uiLocaleEn }: Props) {
  const entries = useMemo(() => buildSopDocumentToc(doc, viewLang), [doc, viewLang])
  const [activeAnchorId, setActiveAnchorId] = useState<string | null>(entries[0]?.anchorId ?? null)
  const [mobileTocOpen, setMobileTocOpen] = useState(false)

  const onNavigate = useCallback((anchorId: string) => {
    scrollToAnchor(anchorId)
    setActiveAnchorId(anchorId)
    setMobileTocOpen(false)
  }, [])

  useEffect(() => {
    if (entries.length === 0) return

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

    for (const entry of entries) {
      const secEl = document.getElementById(entry.anchorId)
      if (secEl) observer.observe(secEl)
      for (const child of entry.children ?? []) {
        const catEl = document.getElementById(child.anchorId)
        if (catEl) observer.observe(catEl)
      }
    }

    return () => observer.disconnect()
  }, [entries])

  if (entries.length <= 1 && !(entries[0]?.children?.length)) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <SopDocumentReadonly doc={doc} viewLang={viewLang} anchors />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="md:hidden">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm"
          aria-expanded={mobileTocOpen}
          onClick={() => setMobileTocOpen((o) => !o)}
        >
          <span>{uiLocaleEn ? 'Table of contents' : '목차'}</span>
          <span className="text-gray-500">{mobileTocOpen ? '▲' : '▼'}</span>
        </button>
        {mobileTocOpen ? (
          <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
            <TocNav
              entries={entries}
              activeAnchorId={activeAnchorId}
              uiLocaleEn={uiLocaleEn}
              onNavigate={onNavigate}
            />
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(11rem,14rem)_1fr] lg:grid-cols-[minmax(12rem,16rem)_1fr]">
        <aside className="hidden md:block">
          <div className="sticky top-4 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {uiLocaleEn ? 'Contents' : '목차'}
            </h2>
            <TocNav
              entries={entries}
              activeAnchorId={activeAnchorId}
              uiLocaleEn={uiLocaleEn}
              onNavigate={onNavigate}
            />
          </div>
        </aside>

        <div className="min-w-0 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <SopDocumentReadonly doc={doc} viewLang={viewLang} anchors />
        </div>
      </div>
    </div>
  )
}
