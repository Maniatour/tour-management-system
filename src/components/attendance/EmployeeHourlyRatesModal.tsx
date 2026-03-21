'use client'

import React from 'react'
import { X } from 'lucide-react'
import EmployeeHourlyRatesPanel from '@/components/attendance/EmployeeHourlyRatesPanel'

interface EmployeeHourlyRatesModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
}

export default function EmployeeHourlyRatesModal({ isOpen, onClose, title }: EmployeeHourlyRatesModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hourly-rates-modal-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-6xl max-h-[92vh] flex flex-col bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 shrink-0 bg-white">
          <h2 id="hourly-rates-modal-title" className="text-base sm:text-lg font-semibold text-gray-900 truncate pr-2">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 shrink-0"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 min-h-0">
          <EmployeeHourlyRatesPanel variant="modal" />
        </div>
      </div>
    </div>
  )
}
