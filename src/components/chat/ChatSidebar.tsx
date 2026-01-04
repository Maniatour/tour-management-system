'use client'

import React from 'react'
import { Users, User, X } from 'lucide-react'
import type { ChatParticipant } from '@/types/chat'
import type { SupportedLanguage } from '@/lib/translation'

interface ChatSidebarProps {
  isOpen: boolean
  onClose: () => void
  participants: Map<string, ChatParticipant>
  selectedLanguage: SupportedLanguage
}

export default function ChatSidebar({
  isOpen,
  onClose,
  participants,
  selectedLanguage
}: ChatSidebarProps) {
  if (!isOpen) return null

  return (
    <div className="absolute right-0 top-0 bottom-0 w-64 bg-white border-l border-gray-200 shadow-lg z-30 flex flex-col">
      <div className="p-4 border-b bg-indigo-50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center">
            <Users size={16} className="mr-2 text-indigo-600" />
            {selectedLanguage === 'ko' ? '참여자' : 'Participants'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {participants.size} {selectedLanguage === 'ko' ? '명 온라인' : 'online'}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {participants.size === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">{selectedLanguage === 'ko' ? '온라인 참여자가 없습니다' : 'No online participants'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {Array.from(participants.values()).map((participant, index) => (
              <div
                key={`${participant.id}-${participant.type}-${index}`}
                className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 border border-gray-100"
              >
                <div className="relative">
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                    <User size={16} className="text-indigo-600" />
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{participant.name}</p>
                  <p className="text-xs text-gray-500">
                    {participant.type === 'guide' 
                      ? (selectedLanguage === 'ko' ? '가이드' : 'Guide')
                      : (selectedLanguage === 'ko' ? '고객' : 'Customer')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

