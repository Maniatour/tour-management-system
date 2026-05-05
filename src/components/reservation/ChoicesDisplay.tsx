'use client'

import React, { useState, useEffect } from 'react'
import type { Reservation } from '@/types/reservation'
import { simplifyChoiceLabel } from '@/utils/choiceLabels'

interface ChoicesDisplayProps {
  reservation: Reservation
  getGroupColorClasses: (groupId: string, groupName?: string, optionName?: string) => string
  getSelectedChoicesFromNewSystem: (reservationId: string) => Promise<Array<{
    choice_id: string
    option_id: string
    quantity: number
    choice_options: {
      option_key: string
      option_name: string
      option_name_ko: string
      product_choices: {
        choice_group_ko: string
      }
    }
  }>>
  choicesCacheRef: React.MutableRefObject<Map<string, Array<{
    choice_id: string
    option_id: string
    quantity: number
    choice_options: {
      option_key: string
      option_name: string
      option_name_ko: string
      product_choices: {
        choice_group_ko: string
      }
    }
  }>>>
}

export const ChoicesDisplay = React.memo(function ChoicesDisplay({ 
  reservation,
  getGroupColorClasses,
  getSelectedChoicesFromNewSystem,
  choicesCacheRef
}: ChoicesDisplayProps) {
  const reservationId = reservation.id
  const [selectedChoices, setSelectedChoices] = useState<Array<{
    choice_id: string
    option_id: string
    quantity: number
    choice_options: {
      option_key: string
      option_name: string
      option_name_ko: string
      product_choices: {
        choice_group_ko: string
      }
    }
  }>>(() => {
    return choicesCacheRef.current.has(reservationId)
      ? choicesCacheRef.current.get(reservationId) || []
      : []
  })
  const [loading, setLoading] = useState(() => !choicesCacheRef.current.has(reservationId))

  useEffect(() => {
    if (choicesCacheRef.current.has(reservationId)) {
      setSelectedChoices(choicesCacheRef.current.get(reservationId) || [])
      setLoading(false)
      return
    }

    const loadChoices = async () => {
      try {
        const choices = await getSelectedChoicesFromNewSystem(reservationId)
        // 캐시에 저장
        choicesCacheRef.current.set(reservationId, choices)
        setSelectedChoices(choices)
      } catch (error) {
        console.error('Error loading choices:', error)
      } finally {
        setLoading(false)
      }
    }
    
    setLoading(true)
    loadChoices()
  }, [reservationId, getSelectedChoicesFromNewSystem, choicesCacheRef])

  // 로딩 중이고 데이터가 없을 때만 null 반환
  if (loading && selectedChoices.length === 0) {
    return null
  }

  if (selectedChoices.length === 0) {
    return null
  }

  return (
    <>
      {selectedChoices.map((choice, index) => {
        const optionName = choice.choice_options?.option_name_ko || choice.choice_options?.option_name || 'Unknown'
        const groupName = choice.choice_options?.product_choices?.choice_group_ko || 'Unknown'
        const displayLabel = simplifyChoiceLabel(optionName)
        const badgeClass = getGroupColorClasses(choice.choice_id, groupName, displayLabel)

        return (
          <span key={`${choice.choice_id}-${choice.option_id}-${index}`} className={badgeClass}>
            {displayLabel}
          </span>
        )
      })}
    </>
  )
}, (prevProps, nextProps) => {
  // 메모이제이션 비교: reservation.id만 비교
  return prevProps.reservation.id === nextProps.reservation.id
})
