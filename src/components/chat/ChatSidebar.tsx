'use client'

import { Users, User, X } from 'lucide-react'
import type { Participant as ChatParticipant } from '@/types/chat'
import type { SupportedLanguage } from '@/lib/translation'
import ChatGuideMemberManager from '@/components/chat/ChatGuideMemberManager'
import ChatPresenceBadge from '@/components/chat/ChatPresenceBadge'
import { countOnlineParticipants, isPresentInChat } from '@/lib/chatCustomerPresence'

interface ChatSidebarProps {
  isOpen: boolean
  onClose: () => void
  participants: Map<string, ChatParticipant>
  selectedLanguage: SupportedLanguage
  canManageMembers?: boolean
  roomId?: string | null
}

function ParticipantRow({
  participant,
  selectedLanguage,
}: {
  participant: ChatParticipant
  selectedLanguage: SupportedLanguage
}) {
  const isKo = selectedLanguage === 'ko'
  const online = isPresentInChat(participant)
  const isCustomer = participant.type === 'customer'

  return (
    <div
      className={`flex items-center space-x-3 p-2 rounded-xl border ${
        online ? 'bg-white border-gray-100' : 'bg-slate-50 border-slate-100 opacity-80'
      }`}
    >
      <div className="relative">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${
            online ? 'bg-indigo-100' : 'bg-slate-200'
          }`}
        >
          <User size={16} className={online ? 'text-indigo-600' : 'text-slate-500'} />
        </div>
        <div
          className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full ${
            online ? 'bg-green-500' : 'bg-slate-400'
          }`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${online ? 'text-gray-900' : 'text-slate-600'}`}>
          {participant.name}
        </p>
        <p className="text-xs text-gray-500">
          {isCustomer ? (isKo ? '고객' : 'Guest') : isKo ? '가이드' : 'Guide'}
        </p>
      </div>
      <ChatPresenceBadge online={online} isKo={isKo} />
    </div>
  )
}

export default function ChatSidebar({
  isOpen,
  onClose,
  participants,
  selectedLanguage,
  canManageMembers = false,
  roomId = null,
}: ChatSidebarProps) {
  if (!isOpen) return null

  const isKo = selectedLanguage === 'ko'
  const all = Array.from(participants.values())
  const customers = all
    .filter((participant) => participant.type === 'customer')
    .sort((a, b) => Number(isPresentInChat(b)) - Number(isPresentInChat(a)) || a.name.localeCompare(b.name))
  const guides = canManageMembers
    ? []
    : all
        .filter((participant) => participant.type === 'guide')
        .sort((a, b) => Number(isPresentInChat(b)) - Number(isPresentInChat(a)) || a.name.localeCompare(b.name))
  const onlineCount = countOnlineParticipants(all)
  const empty = customers.length === 0 && guides.length === 0

  return (
    <div className={`absolute right-0 top-0 bottom-0 ${canManageMembers ? 'w-80' : 'w-64'} bg-white border-l border-gray-200 shadow-lg z-30 flex flex-col`}>
      <div className="p-4 border-b bg-indigo-50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center">
            <Users size={16} className="mr-2 text-indigo-600" />
            {isKo ? '참여자' : 'Participants'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {isKo
            ? `활성 ${onlineCount}명 · 고객 ${customers.length}명`
            : `${onlineCount} active · ${customers.length} guests`}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {empty ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">
              {isKo ? '아이디를 만든 고객이 없습니다' : 'No guests have joined yet'}
            </p>
          </div>
        ) : (
          <>
            {customers.length > 0 ? (
              <div className="space-y-1.5">
                <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {isKo ? '고객' : 'Guests'}
                </p>
                {customers.map((participant, index) => (
                  <ParticipantRow
                    key={`customer-${participant.id}-${index}`}
                    participant={participant}
                    selectedLanguage={selectedLanguage}
                  />
                ))}
              </div>
            ) : null}
            {guides.length > 0 ? (
              <div className="space-y-1.5">
                <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {isKo ? '가이드' : 'Guides'}
                </p>
                {guides.map((participant, index) => (
                  <ParticipantRow
                    key={`guide-${participant.id}-${index}`}
                    participant={participant}
                    selectedLanguage={selectedLanguage}
                  />
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
      {canManageMembers && roomId ? (
        <div className="flex-shrink-0">
          <ChatGuideMemberManager
            roomId={roomId}
            selectedLanguage={selectedLanguage}
            participants={participants}
          />
        </div>
      ) : null}
    </div>
  )
}
