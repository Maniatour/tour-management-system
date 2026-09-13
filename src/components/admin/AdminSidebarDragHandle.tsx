'use client'

import { GripVertical } from 'lucide-react'

type AdminSidebarDragHandleProps = {
  label: string
  onDragStart: (event: React.DragEvent<HTMLSpanElement>) => void
}

export default function AdminSidebarDragHandle({ label, onDragStart }: AdminSidebarDragHandleProps) {
  return (
    <span
      draggable
      className="sidebar-drag-handle ml-0.5 shrink-0 cursor-grab rounded-md p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-500 active:cursor-grabbing"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onDragStart={(event) => {
        event.stopPropagation()
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', label)
        onDragStart(event)
      }}
    >
      <GripVertical size={14} />
    </span>
  )
}
