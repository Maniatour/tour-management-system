'use client'

import { Search, Star } from 'lucide-react'
import { Input } from '@/components/ui/input'

export function toYmd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function daysAgoYmd(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return toYmd(date)
}

export function formatTourDateLabel(isoDate: string, locale: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!year || !month || !day) return isoDate
  return new Date(year, month - 1, day).toLocaleDateString(locale === 'en' ? 'en-US' : 'ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  })
}

export function AdminTourPhotosViewTab({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-medium ${
        active ? 'bg-sky-600 text-white' : 'border border-input bg-white hover:bg-accent'
      }`}
    >
      {icon ? <Star className={`h-4 w-4 ${active ? 'fill-white' : ''}`} /> : null}
      {label}
    </button>
  )
}

export function AdminTourPhotosPresetButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-input bg-white px-3 py-2 text-sm font-medium hover:bg-accent"
    >
      {label}
    </button>
  )
}

export function AdminTourPhotosSearchField({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (value: string) => void
  label: string
}) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <div className="relative mt-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={label}
          className="pl-9"
        />
      </div>
    </label>
  )
}
