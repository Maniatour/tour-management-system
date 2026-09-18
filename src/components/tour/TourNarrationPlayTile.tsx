'use client'

import { Pause } from 'lucide-react'
import type { ReactNode } from 'react'

export const NARRATION_TILE_COLORS = [
  '#2563EB',
  '#0F766E',
  '#C2410C',
  '#7C3AED',
  '#BE123C',
  '#0369A1',
  '#B45309',
  '#15803D',
  '#DB2777',
  '#1D4ED8',
  '#0E7490',
  '#9A3412',
  '#6D28D9',
  '#B91C1C',
  '#3F6212',
  '#4338CA',
] as const

export function splitNarrationTitleLines(title: string): [string, string | null] {
  const trimmed = title.trim()
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length <= 1) return [trimmed, null]
  if (words.length === 2) return [words[0] ?? trimmed, words[1] ?? null]
  let bestIndex = 1
  let bestScore = Number.POSITIVE_INFINITY
  for (let i = 1; i < words.length; i++) {
    const left = words.slice(0, i).join(' ')
    const right = words.slice(i).join(' ')
    const score = Math.abs(left.length - right.length)
    if (score < bestScore) {
      bestScore = score
      bestIndex = i
    }
  }
  return [words.slice(0, bestIndex).join(' '), words.slice(bestIndex).join(' ')]
}

export function formatNarrationDurationClock(duration: number | null | undefined): string | null {
  if (duration == null || duration <= 0) return null
  const minutes = Math.floor(duration / 60)
  const seconds = Math.round(duration % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

type TourNarrationPlayTileProps = {
  title: string
  duration?: number | null | undefined
  colorIndex: number
  playing: boolean
  isCurrent: boolean
  ariaLabel: string
  onClick: () => void
  topLeft?: ReactNode
}

export function TourNarrationPlayTile({
  title,
  duration,
  colorIndex,
  playing,
  isCurrent,
  ariaLabel,
  onClick,
  topLeft,
}: TourNarrationPlayTileProps) {
  const [line1, line2] = splitNarrationTitleLines(title)
  const clock = formatNarrationDurationClock(duration)
  const tileColor =
    NARRATION_TILE_COLORS[colorIndex % NARRATION_TILE_COLORS.length] ?? NARRATION_TILE_COLORS[0]

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={playing}
      aria-label={ariaLabel}
      style={{
        backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(0,0,0,0.18) 100%)',
        backgroundColor: tileColor,
      }}
      className={`relative flex aspect-square w-full touch-manipulation select-none flex-col items-center justify-center overflow-hidden rounded-2xl border px-1.5 text-white shadow-sm transition duration-200 ease-out active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        playing
          ? 'border-white ring-2 ring-red-500 ring-offset-2 ring-offset-white shadow-md'
          : isCurrent
            ? 'border-white/80 ring-2 ring-white ring-offset-2 ring-offset-white shadow-md'
            : 'border-white/10 hover:brightness-110'
      }`}
    >
      {topLeft ? (
        <span className="pointer-events-none absolute left-2 top-2 flex h-5 items-center justify-center overflow-hidden rounded-sm">
          {topLeft}
        </span>
      ) : null}
      {playing ? (
        <span className="pointer-events-none absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/25">
          <Pause className="h-3 w-3" />
        </span>
      ) : null}
      <span className="flex min-h-0 w-full flex-col items-center justify-center text-center">
        <span className="max-w-full break-words text-[12px] font-semibold leading-[1.15] tracking-tight min-[400px]:text-[13px] sm:text-sm">
          {line1}
        </span>
        {line2 ? (
          <span className="max-w-full break-words text-[12px] font-semibold leading-[1.15] tracking-tight min-[400px]:text-[13px] sm:text-sm">
            {line2}
          </span>
        ) : null}
      </span>
      {clock ? (
        <span className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[10px] font-medium tabular-nums opacity-80">
          {clock}
        </span>
      ) : null}
    </button>
  )
}
