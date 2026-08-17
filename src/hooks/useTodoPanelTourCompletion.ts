'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  readTodoPanelTourCompletion,
  readTodoPanelTourCompletionLookback,
  setTodoPanelTourStatus,
  type TodoPanelTourCompletionNamespace,
  type TodoPanelTourItemState,
  type TodoPanelTourState,
} from '@/lib/todoPanelTourCompletion'

export function useTodoPanelTourCompletion(
  namespace: TodoPanelTourCompletionNamespace,
  dateKey: string,
  lookbackDays = 1
) {
  const [tourState, setTourState] = useState<TodoPanelTourState>(() =>
    lookbackDays > 1
      ? readTodoPanelTourCompletionLookback(namespace, dateKey, lookbackDays)
      : readTodoPanelTourCompletion(namespace, dateKey)
  )

  useEffect(() => {
    setTourState(
      lookbackDays > 1
        ? readTodoPanelTourCompletionLookback(namespace, dateKey, lookbackDays)
        : readTodoPanelTourCompletion(namespace, dateKey)
    )
  }, [namespace, dateKey, lookbackDays])

  const setTourStatus = useCallback(
    (tourId: string, status: TodoPanelTourItemState) => {
      setTourState(setTodoPanelTourStatus(namespace, tourId, status, dateKey, lookbackDays))
    },
    [namespace, dateKey, lookbackDays]
  )

  const toggleTour = useCallback(
    (tourId: string, completed: boolean) => {
      setTourStatus(tourId, completed ? 'completed' : 'pending')
    },
    [setTourStatus]
  )

  return { tourState, setTourStatus, toggleTour }
}
