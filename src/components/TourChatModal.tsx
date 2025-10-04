'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import TourChatRoom from './TourChatRoom'
import { Button } from '@/components/ui/button'

interface TourChatModalProps {
  tourId: string
  guideEmail: string
  tourDate: string
  isOpen: boolean
  onClose: () => void
}

export default function TourChatModal({ 
  tourId, 
  guideEmail, 
  tourDate, 
  isOpen, 
  onClose 
}: TourChatModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 h-[95vh] max-h-[95vh] flex flex-col">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            투어 채팅방
          </h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="p-1 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        {/* 모달 컨텐트 */}
        <div className="flex-1 overflow-hidden">
          <TourChatRoom
            tourId={tourId}
            guideEmail={guideEmail}
            tourDate={tourDate}
            isModalView={true}
          />
        </div>
      </div>
    </div>
  )
}
