'use client'

import { TodoPanelStatusButtons } from '@/components/admin/todo/TodoPanelStatusButtons'
import type { TodoPanelTourItemState } from '@/lib/todoPanelTourCompletion'

type TodoPanelTourStatusButtonsProps = {
  locale: string
  status: TodoPanelTourItemState
  onSetStatus: (status: TodoPanelTourItemState) => void
}

export function TodoPanelTourStatusButtons({
  locale,
  status,
  onSetStatus,
}: TodoPanelTourStatusButtonsProps) {
  return (
    <TodoPanelStatusButtons
      locale={locale}
      size="sm"
      completed={status === 'completed'}
      onHold={status === 'on_hold'}
      holdEnabled
      onToggleComplete={() => {
        onSetStatus(status === 'completed' ? 'pending' : 'completed')
      }}
      onToggleHold={() => {
        onSetStatus(status === 'on_hold' ? 'pending' : 'on_hold')
      }}
    />
  )
}
