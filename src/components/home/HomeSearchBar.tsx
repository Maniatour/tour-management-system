'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Search } from 'lucide-react'

type HomeSearchBarProps = {
  locale: string
  searchPlaceholder: string
  anytimeLabel: string
  participantLabel: string
  participantOptions: string[]
  searchButtonLabel: string
  initialQuery?: string
}

export default function HomeSearchBar({
  locale,
  searchPlaceholder,
  anytimeLabel,
  participantLabel,
  participantOptions,
  searchButtonLabel,
  initialQuery = '',
}: HomeSearchBarProps) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)

  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])
  const [participants, setParticipants] = useState('1')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (query.trim()) params.set('search', query.trim())
    if (participants !== '1') params.set('guests', participants)
    const qs = params.toString()
    router.push(`/${locale}/products${qs ? `?${qs}` : ''}`)
  }

  return (
    <form onSubmit={handleSearch} className="gyg-search-form">
      <label className="gyg-search-field gyg-search-field-grow">
        <Search className="h-[18px] w-[18px] shrink-0 text-[#9ca3af]" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-[#1a2b49] placeholder:text-[#9ca3af] focus:outline-none"
        />
      </label>

      <button
        type="button"
        className="gyg-search-field gyg-search-field-select"
        aria-label={anytimeLabel}
      >
        <span>{anytimeLabel}</span>
        <ChevronDown className="h-4 w-4 text-[#1a2b49]" aria-hidden />
      </button>

      <label className="gyg-search-field gyg-search-field-select">
        <select
          value={participants}
          onChange={(e) => setParticipants(e.target.value)}
          className="cursor-pointer appearance-none bg-transparent text-[15px] font-normal text-[#1a2b49] focus:outline-none"
          aria-label={participantLabel}
        >
          {participantOptions.map((option) => (
            <option key={option} value={option.split(' ')[0] ?? option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none h-4 w-4 text-[#1a2b49]" aria-hidden />
      </label>

      <div className="gyg-search-submit-wrap">
        <button type="submit" className="gyg-search-submit">
          {searchButtonLabel}
        </button>
      </div>
    </form>
  )
}
