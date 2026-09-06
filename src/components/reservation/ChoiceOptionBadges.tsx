'use client'

import Image from 'next/image'
import {
  dedupeAntelopeTourChoiceBadges,
  isChoiceOptionUuid,
  simplifyChoiceLabel,
} from '@/utils/choiceLabels'
import { getGroupColorClassesForReservations } from '@/utils/groupColors'

export type ChoiceOptionBadgeItem = {
  choice_id: string
  option_id: string
  quantity?: number
  option_name?: string | null
  option_name_ko?: string | null
  option_key?: string | null
  internal_name?: string | null
  badge_icon_url?: string | null
  choice_group_ko?: string | null
}

function antelopeBadgeTone(name: string): string | null {
  if (name === '🏜️ L') return 'bg-emerald-100 text-emerald-800 border-emerald-300'
  if (name === '🏜️ X') return 'bg-violet-100 text-violet-800 border-violet-300'
  if (name === '🏜️ U') return 'bg-amber-100 text-amber-800 border-amber-200'
  return null
}

export function ChoiceOptionBadges({
  items,
  compact = false,
}: {
  items: ChoiceOptionBadgeItem[]
  compact?: boolean
}) {
  const displayChoices = dedupeAntelopeTourChoiceBadges(
    items
      .map((choice) => {
        const optionName = choice.option_name_ko || choice.option_name || ''
        const optionKey =
          choice.option_key && !isChoiceOptionUuid(choice.option_key) ? choice.option_key : null
        const name =
          simplifyChoiceLabel(optionName, optionKey, choice.internal_name) || optionName
        return { ...choice, name }
      })
      .filter((choice) => Boolean(choice.name || choice.badge_icon_url))
  )

  if (displayChoices.length === 0) return null

  const sizeClass = compact
    ? 'px-1.5 py-0.5 text-[11px] leading-tight'
    : 'px-2 py-1 text-xs'
  const iconSize = compact ? 'h-5 w-5' : 'h-7 w-7'

  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-1">
      {displayChoices.map((choice, index) => {
        const badgeIconUrl = choice.badge_icon_url?.trim()
        const label = choice.name || '·'
        const key = `${choice.choice_id}-${choice.option_id}-${index}`

        if (badgeIconUrl) {
          return (
            <span
              key={key}
              className={`relative inline-flex ${iconSize} shrink-0 overflow-hidden rounded-full border border-gray-200 bg-white`}
              title={label}
            >
              <Image
                src={badgeIconUrl}
                alt={label}
                fill
                sizes={compact ? '20px' : '28px'}
                className="object-contain"
              />
            </span>
          )
        }

        const antelopeTone = antelopeBadgeTone(label)
        const className = antelopeTone
          ? `inline-flex items-center rounded-full font-medium border ${sizeClass} ${antelopeTone}`
          : `${getGroupColorClassesForReservations(choice.choice_id, choice.choice_group_ko || '', label)} ${
              compact ? '!px-1.5 !py-0.5 !text-[11px] leading-tight' : ''
            }`

        return (
          <span key={key} className={className}>
            {label}
          </span>
        )
      })}
    </span>
  )
}
