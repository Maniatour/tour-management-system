'use client'

import { User } from 'lucide-react'
import type { ReactNode } from 'react'
import ChatPresenceBadge from '@/components/chat/ChatPresenceBadge'

export default function ChatGuidePresenceRow({
  name,
  subtitle,
  online,
  isKo,
  action,
}: {
  name: string
  subtitle: string
  online: boolean
  isKo: boolean
  action?: ReactNode
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 ${
        online ? 'border-emerald-100 bg-white' : 'border-slate-100 bg-slate-50'
      }`}
    >
      <div className="relative flex-shrink-0">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full ${
            online ? 'bg-indigo-100' : 'bg-slate-200'
          }`}
        >
          <User size={16} className={online ? 'text-indigo-600' : 'text-slate-500'} />
        </div>
        <div
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
            online ? 'bg-green-500' : 'bg-slate-400'
          }`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${online ? 'text-gray-900' : 'text-slate-600'}`}>
          {name}
        </p>
        <p className="truncate text-[11px] text-gray-500">{subtitle}</p>
      </div>
      <ChatPresenceBadge online={online} isKo={isKo} />
      {action}
    </div>
  )
}
