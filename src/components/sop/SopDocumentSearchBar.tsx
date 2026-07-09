'use client'

import { useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { SopDocumentSearchHit } from '@/lib/sopDocumentSearch'

type Props = {
  query: string
  onQueryChange: (query: string) => void
  hits: SopDocumentSearchHit[]
  activeIndex: number
  onActiveIndexChange: (index: number) => void
  uiLocaleEn: boolean
  className?: string
}

export default function SopDocumentSearchBar({
  query,
  onQueryChange,
  hits,
  activeIndex,
  onActiveIndexChange,
  uiLocaleEn,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const isEn = uiLocaleEn
  const hasQuery = query.trim().length > 0
  const activeHit = hits[activeIndex] ?? null

  const goPrev = () => {
    if (hits.length === 0) return
    onActiveIndexChange((activeIndex - 1 + hits.length) % hits.length)
  }

  const goNext = () => {
    if (hits.length === 0) return
    onActiveIndexChange((activeIndex + 1) % hits.length)
  }

  const clear = () => {
    onQueryChange('')
    onActiveIndexChange(0)
    inputRef.current?.focus()
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div
      className={cn(
        'rounded-xl border border-gray-200 bg-white p-2 shadow-sm sm:p-2.5',
        className
      )}
      data-no-drag
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
          <Input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (e.shiftKey) goPrev()
                else goNext()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                clear()
              }
            }}
            placeholder={isEn ? 'Search in document…' : '문서 내 검색…'}
            className="h-10 touch-manipulation pl-9 pr-9 sm:h-9"
            aria-label={isEn ? 'Search in document' : '문서 내 검색'}
          />
          {hasQuery ? (
            <button
              type="button"
              onClick={clear}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label={isEn ? 'Clear search' : '검색 지우기'}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <span className="text-xs tabular-nums text-gray-500">
            {hasQuery
              ? hits.length > 0
                ? isEn
                  ? `${activeIndex + 1} / ${hits.length}`
                  : `${activeIndex + 1} / ${hits.length}건`
                : isEn
                  ? 'No results'
                  : '결과 없음'
              : isEn
                ? 'Ctrl+F'
                : 'Ctrl+F'}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 touch-manipulation sm:h-8 sm:w-8"
              disabled={hits.length === 0}
              onClick={goPrev}
              aria-label={isEn ? 'Previous match' : '이전 결과'}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 touch-manipulation sm:h-8 sm:w-8"
              disabled={hits.length === 0}
              onClick={goNext}
              aria-label={isEn ? 'Next match' : '다음 결과'}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {activeHit ? (
        <p className="mt-2 truncate text-xs text-gray-600">
          <span className="font-medium text-indigo-700">{activeHit.fieldLabel}</span>
          {' · '}
          {activeHit.snippet}
        </p>
      ) : hasQuery ? (
        <p className="mt-2 text-xs text-gray-500">
          {isEn ? 'Try different keywords.' : '다른 검색어를 입력해 보세요.'}
        </p>
      ) : null}
    </div>
  )
}
