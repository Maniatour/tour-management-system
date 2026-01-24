'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, GripVertical } from 'lucide-react'

interface ResizableModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  initialHeight: number
  onHeightChange: (height: number) => void
}

export default function ResizableModal({
  isOpen,
  onClose,
  title,
  children,
  initialHeight,
  onHeightChange
}: ResizableModalProps) {
  const [height, setHeight] = useState(initialHeight)
  const [isResizing, setIsResizing] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setHeight(initialHeight)
  }, [initialHeight])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      
      const windowHeight = window.innerHeight
      const newHeight = windowHeight - e.clientY
      const minHeight = 300
      const maxHeight = windowHeight - 100
      
      const clampedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight))
      setHeight(clampedHeight)
      onHeightChange(clampedHeight)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, onHeightChange])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50 p-4">
      <div 
        ref={modalRef}
        className="bg-white rounded-t-lg shadow-xl w-full max-w-7xl overflow-hidden flex flex-col"
        style={{ height: `${height}px`, maxHeight: '95vh' }}
      >
        {/* 리사이즈 핸들 */}
        <div
          onMouseDown={handleMouseDown}
          className="w-full h-2 bg-gray-200 hover:bg-gray-300 cursor-ns-resize flex items-center justify-center group transition-colors"
        >
          <GripVertical className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
        </div>
        
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden" style={{ height: `calc(${height}px - 80px)` }}>
          {children}
        </div>
      </div>
    </div>
  )
}
