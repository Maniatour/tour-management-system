'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  readTodoPanelTourCompletion,
  setTodoPanelTourStatus,
  type TodoPanelTourCompletionNamespace,
  type TodoPanelTourItemState,
  type TodoPanelTourState,
} from '@/lib/todoPanelTourCompletion'

export function useTodoPanelTourCompletion(namespace: TodoPanelTourCompletionNamespace, dateKey: string) {
  const [tourState, setTourState] = useState<TodoPanelTourState>(() =>
    readTodoPanelTourCompletion(namespace, dateKey)
  )

  useEffect(() => {
    setTourState(readTodoPanelTourCompletion(namespace, dateKey))
  }, [namespace, dateKey])

  const setTourStatus = useCallback(
    (tourId: string, status: TodoPanelTourItemState) => {
      setTourState(setTodoPanelTourStatus(namespace, tourId, status, dateKey))
    },
    [namespace, dateKey]
  )

  const toggleTour = useCallback(
    (tourId: string, completed: boolean) => {
      setTourStatus(tourId, completed ? 'completed' : 'pending')
    },
    [setTourStatus]
  )

  return { tourState, setTourStatus, toggleTour }
}
