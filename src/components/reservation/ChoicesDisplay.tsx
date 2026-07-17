'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import type { Reservation } from '@/types/reservation'
import { isChoiceOptionUuid, simplifyChoiceLabel } from '@/utils/choiceLabels'

interface ChoiceRow {
  choice_id: string
  option_id: string
  quantity: number
  choice_options: {
    option_key: string
    option_name: string
    option_name_ko: string
    internal_name?: string
    badge_icon_url?: string
    product_choices: {
      choice_group_ko: string
    }
  }
}

interface ChoicesDisplayProps {
  reservation: Reservation
  getGroupColorClasses: (groupId: string, groupName?: string, optionName?: string) => string
  getSelectedChoicesFromNewSystem: (reservationId: string) => Promise<ChoiceRow[]>
  choicesCacheRef: React.MutableRefObject<Map<string, ChoiceRow[]>>
}

function parseChoicesFromReservationJson(reservation: Reservation): ChoiceRow[] {
  const raw = reservation.choices
  if (!raw || typeof raw !== 'object') return []
  const required = (raw as { required?: unknown }).required
  if (!Array.isArray(required)) return []

  const rows: ChoiceRow[] = []
  for (const item of required as Array<Record<string, unknown>>) {
    if (item.option_id && item.choice_id) {
      const optionId = String(item.option_id)
      if (!optionId || optionId === '__undecided__' || optionId === 'undecided') continue
      const optionKey = typeof item.option_key === 'string' ? item.option_key : ''
      const optionNameKo =
        (typeof item.option_name_ko === 'string' && item.option_name_ko) ||
        (typeof item.option_name === 'string' && item.option_name) ||
        ''
      const optionName = typeof item.option_name === 'string' ? item.option_name : ''
      // 이름·키가 전혀 없으면 표시 불가(orphan id만 있는 JSON) — API 해석 결과를 기다림
      if (!optionNameKo && !optionName && !optionKey) continue
      rows.push({
        choice_id: String(item.choice_id),
        option_id: optionId,
        quantity: typeof item.quantity === 'number' ? item.quantity : 1,
        choice_options: {
          option_key: optionKey,
          option_name: optionName,
          option_name_ko: optionNameKo,
          product_choices: {
            choice_group_ko:
              (typeof item.choice_group_ko === 'string' && item.choice_group_ko) ||
              (typeof item.choice_group === 'string' && item.choice_group) ||
              '',
          },
        },
      })
      continue
    }
    if (Array.isArray(item.options)) {
      for (const option of item.options as Array<Record<string, unknown>>) {
        if (!(option.selected || option.is_default)) continue
        rows.push({
          choice_id: String(item.id || item.choice_id || ''),
          option_id: String(option.id || option.option_id || ''),
          quantity: 1,
          choice_options: {
            option_key: typeof option.option_key === 'string' ? option.option_key : '',
            option_name: typeof option.name === 'string' ? option.name : '',
            option_name_ko:
              (typeof option.name_ko === 'string' && option.name_ko) ||
              (typeof option.name === 'string' && option.name) ||
              '',
            product_choices: {
              choice_group_ko:
                (typeof item.group_ko === 'string' && item.group_ko) ||
                (typeof item.choice_group_ko === 'string' && item.choice_group_ko) ||
                '',
            },
          },
        })
      }
    }
  }
  return rows.filter((r) => r.choice_id && r.option_id)
}

export const ChoicesDisplay = React.memo(function ChoicesDisplay({
  reservation,
  getGroupColorClasses,
  getSelectedChoicesFromNewSystem,
  choicesCacheRef,
}: ChoicesDisplayProps) {
  const reservationId = reservation.id
  const [selectedChoices, setSelectedChoices] = useState<ChoiceRow[]>(() => {
    // 목록 prefetch 가 빈 배열도 캐시 키로 남김 → has() 이면 조회 완료로 간주 (N+1 API 방지)
    if (choicesCacheRef.current.has(reservationId)) {
      return choicesCacheRef.current.get(reservationId) ?? []
    }
    return []
  })
  const [loading, setLoading] = useState(() => !choicesCacheRef.current.has(reservationId))

  useEffect(() => {
    if (choicesCacheRef.current.has(reservationId)) {
      setSelectedChoices(choicesCacheRef.current.get(reservationId) ?? [])
      setLoading(false)
      return
    }

    let cancelled = false
    const loadChoices = async () => {
      setLoading(true)
      try {
        let choices = await getSelectedChoicesFromNewSystem(reservationId)
        if (!choices.length) {
          choices = parseChoicesFromReservationJson(reservation)
        }
        if (cancelled) return
        // 빈 결과도 캐시해 동일 카드의 반복 GET 을 막음
        choicesCacheRef.current.set(reservationId, choices)
        setSelectedChoices(choices)
      } catch (error) {
        console.error('Error loading choices:', error)
        if (!cancelled) {
          const fallback = parseChoicesFromReservationJson(reservation)
          choicesCacheRef.current.set(reservationId, fallback)
          setSelectedChoices(fallback)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadChoices()
    return () => {
      cancelled = true
    }
  }, [reservationId, reservation, getSelectedChoicesFromNewSystem, choicesCacheRef])

  if (loading && selectedChoices.length === 0) {
    return null
  }

  if (selectedChoices.length === 0) {
    return null
  }

  return (
    <>
      {selectedChoices.map((choice, index) => {
        const optionName =
          choice.choice_options?.option_name_ko ||
          choice.choice_options?.option_name ||
          ''
        const optionKey = choice.choice_options?.option_key
        const groupName = choice.choice_options?.product_choices?.choice_group_ko || ''
        const displayLabel = simplifyChoiceLabel(
          optionName,
          optionKey && !isChoiceOptionUuid(optionKey) ? optionKey : null,
          choice.choice_options?.internal_name
        )
        if (!displayLabel && !choice.choice_options?.badge_icon_url) return null

        const label = displayLabel || choice.choice_options?.internal_name || optionName || '·'
        const badgeIconUrl = choice.choice_options?.badge_icon_url?.trim()
        const badgeClass = getGroupColorClasses(choice.choice_id, groupName, label)

        if (badgeIconUrl) {
          return (
            <span
              key={`${choice.choice_id}-${choice.option_id}-${index}`}
              className="relative inline-flex h-7 w-7 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-white align-middle"
              title={label}
            >
              <Image
                src={badgeIconUrl}
                alt={label}
                fill
                sizes="28px"
                className="object-contain"
              />
            </span>
          )
        }

        return (
          <span key={`${choice.choice_id}-${choice.option_id}-${index}`} className={badgeClass}>
            {label}
          </span>
        )
      })}
    </>
  )
}, (prevProps, nextProps) => {
  return prevProps.reservation.id === nextProps.reservation.id
})
