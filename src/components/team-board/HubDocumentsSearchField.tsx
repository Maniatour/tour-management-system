'use client'

import { Search, X } from 'lucide-react'

type HubDocumentsSearchFieldProps = {
  locale: string
  value: string
  onChange: (value: string) => void
  compact?: boolean
  className?: string
}

export function HubDocumentsSearchField({
  locale,
  value,
  onChange,
  compact = false,
  className = '',
}: HubDocumentsSearchFieldProps) {
  const isKo = locale === 'ko'

  return (
    <div className={`relative ${className}`}>
      <Search
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-gray-400 ${
          compact ? 'left-2 h-3.5 w-3.5' : 'left-3 h-4 w-4'
        }`}
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isKo ? '제목·본문·슬러그·카테고리 검색…' : 'Search title, body, slug, category…'}
        className={`w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 ${
          compact
            ? 'py-1.5 pl-7 pr-7 text-xs'
            : 'py-2.5 pl-9 pr-9 text-sm'
        }`}
        aria-label={isKo ? '운영 허브 문서 검색' : 'Search operations hub documents'}
      />
      {value.trim() ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className={`absolute top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 ${
            compact ? 'right-1.5' : 'right-2'
          }`}
          aria-label={isKo ? '검색어 지우기' : 'Clear search'}
        >
          <X className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        </button>
      ) : null}
    </div>
  )
}
