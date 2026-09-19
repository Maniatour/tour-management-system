'use client'

import { useMemo, useState } from 'react'
import { UserMinus, UserPlus, Search } from 'lucide-react'
import type { SupportedLanguage } from '@/lib/translation'
import { useTourChatGuideMembers } from '@/hooks/useTourChatGuideMembers'
import { BROWSER_AUTOFILL_OFF_PROPS } from '@/lib/browserAutofill'

interface ChatGuideMemberManagerProps {
  roomId: string
  selectedLanguage: SupportedLanguage
}

export default function ChatGuideMemberManager({
  roomId,
  selectedLanguage,
}: ChatGuideMemberManagerProps) {
  const isKo = selectedLanguage === 'ko'
  const { members, candidates, loading, busyEmail, error, invite, remove } =
    useTourChatGuideMembers(roomId, true)
  const [query, setQuery] = useState('')
  const [showInvite, setShowInvite] = useState(false)

  const inviteList = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return candidates
      .filter((candidate) => !candidate.already_member)
      .filter((candidate) => {
        if (!needle) return candidate.is_guide_or_driver
        const haystack = `${candidate.name} ${candidate.email} ${candidate.position || ''}`.toLowerCase()
        return haystack.includes(needle)
      })
      .slice(0, 20)
  }, [candidates, query])

  return (
    <div className="border-t border-gray-200">
      <div className="px-4 py-3 bg-slate-50">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-gray-900">
            {isKo ? '가이드 멤버' : 'Guide members'}
          </h4>
          <button
            type="button"
            onClick={() => setShowInvite((open) => !open)}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            <UserPlus size={14} />
            {isKo ? '초대' : 'Invite'}
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {isKo
            ? '배정이 바뀌면 자동으로 맞춰집니다. 추가로 초대하거나 잘못된 멤버를 내보낼 수 있습니다.'
            : 'Members follow tour assignment. You can also invite or remove extra guides.'}
        </p>
      </div>

      <div className="max-h-48 overflow-y-auto px-2 py-2 space-y-1.5">
        {loading && members.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-gray-500">
            {isKo ? '불러오는 중…' : 'Loading…'}
          </p>
        ) : members.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-gray-500">
            {isKo ? '연결된 가이드가 없습니다.' : 'No guides in this room.'}
          </p>
        ) : (
          members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{member.name}</p>
                <p className="truncate text-[11px] text-gray-500">
                  {member.assigned
                    ? isKo ? '배정' : 'Assigned'
                    : isKo ? '초대' : 'Invited'}
                  {member.position ? ` · ${member.position}` : ''}
                </p>
              </div>
              {member.can_remove ? (
                <button
                  type="button"
                  disabled={busyEmail === member.email}
                  onClick={() => void remove(member.email)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  <UserMinus size={12} />
                  {isKo ? '내보내기' : 'Remove'}
                </button>
              ) : (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                  {isKo ? '배정됨' : 'Assigned'}
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {error ? (
        <p className="px-4 pb-2 text-xs text-red-600">{error}</p>
      ) : null}

      {showInvite ? (
        <div className="border-t border-gray-100 px-3 py-3">
          <div className="relative mb-2">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              {...BROWSER_AUTOFILL_OFF_PROPS}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isKo ? '이름 또는 이메일 검색' : 'Search name or email'}
              className="w-full rounded-xl border border-gray-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {inviteList.length === 0 ? (
              <p className="py-3 text-center text-xs text-gray-500">
                {isKo ? '초대할 팀원이 없습니다.' : 'No teammates to invite.'}
              </p>
            ) : (
              inviteList.map((candidate) => (
                <button
                  key={candidate.email}
                  type="button"
                  disabled={busyEmail === candidate.email}
                  onClick={() => void invite(candidate.email)}
                  className="flex w-full items-center justify-between rounded-xl border border-gray-100 bg-white px-2.5 py-2 text-left hover:border-primary/30 hover:bg-primary/5 disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-900">
                      {candidate.name}
                    </span>
                    <span className="block truncate text-[11px] text-gray-500">
                      {candidate.position || candidate.email}
                    </span>
                  </span>
                  <span className="text-[11px] font-semibold text-primary">
                    {isKo ? '추가' : 'Add'}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
