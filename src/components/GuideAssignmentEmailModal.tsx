'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, Mail, Loader2, Send, UserPlus, UserMinus, RefreshCw } from 'lucide-react'
import {
  type GuideAssignmentChangeItem,
  type GuideAssignmentEmailRecipientGroup,
  buildGuideAssignmentEmailRecipientGroups,
  guideAssignmentEmailKindLabel,
  guideAssignmentRoleLabel,
} from '@/lib/guideAssignmentSchedule'

interface GuideAssignmentEmailModalProps {
  isOpen: boolean
  onClose: () => void
  changes: GuideAssignmentChangeItem[]
  sentBy?: string | null
}

function recipientGroupKey(g: GuideAssignmentEmailRecipientGroup): string {
  return `${g.email}\0${g.kind}`
}

export default function GuideAssignmentEmailModal({
  isOpen,
  onClose,
  changes,
  sentBy,
}: GuideAssignmentEmailModalProps) {
  const recipientGroups = useMemo(
    () => buildGuideAssignmentEmailRecipientGroups(changes),
    [changes],
  )

  const groupsKey = useMemo(
    () => recipientGroups.map((g) => recipientGroupKey(g)).join('\n'),
    [recipientGroups],
  )

  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ subject: string; html: string; recipientName: string } | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [sending, setSending] = useState(false)
  const [sentGroupKeys, setSentGroupKeys] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const previewRequestIdRef = useRef(0)

  const added = changes.filter((c) => c.changeType === 'added')
  const removed = changes.filter((c) => c.changeType === 'removed')
  const changed = changes.filter((c) => c.changeType === 'changed')

  const selectedGroup = useMemo(
    () => recipientGroups.find((g) => recipientGroupKey(g) === selectedGroupKey) ?? null,
    [recipientGroups, selectedGroupKey],
  )

  useEffect(() => {
    setSentGroupKeys(new Set())
    setError(null)
    setPreview(null)
    setSelectedGroupKey(recipientGroups[0] ? recipientGroupKey(recipientGroups[0]) : null)
  }, [groupsKey])

  const selectedItemsKey = useMemo(
    () => selectedGroup?.items.map((i) => i.id).join('|') ?? '',
    [selectedGroup],
  )

  const loadPreview = useCallback(async (group: GuideAssignmentEmailRecipientGroup) => {
    const requestId = ++previewRequestIdRef.current
    setLoadingPreview(true)
    setError(null)
    try {
      const res = await fetch('/api/preview-guide-assignment-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: group.email,
          kind: group.kind,
          items: group.items,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '미리보기 실패')
      if (requestId !== previewRequestIdRef.current) return
      setPreview({
        subject: data.subject,
        html: data.html,
        recipientName: data.recipientName,
      })
    } catch (e) {
      if (requestId !== previewRequestIdRef.current) return
      setPreview(null)
      setError(e instanceof Error ? e.message : '미리보기를 불러오지 못했습니다.')
    } finally {
      if (requestId === previewRequestIdRef.current) {
        setLoadingPreview(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!selectedGroup || !selectedItemsKey) return
    void loadPreview(selectedGroup)
  }, [selectedGroup, selectedItemsKey, loadPreview])

  const handleSend = async () => {
    if (!selectedGroup || !preview) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/send-guide-assignment-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedGroup.email,
          subject: preview.subject,
          html: preview.html,
          sentBy,
          tourIds: [...new Set(selectedGroup.items.map((i) => i.tourId))],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '발송 실패')
      setSentGroupKeys((prev) => new Set(prev).add(recipientGroupKey(selectedGroup)))
    } catch (e) {
      setError(e instanceof Error ? e.message : '이메일 발송에 실패했습니다.')
    } finally {
      setSending(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-gray-900">가이드 배정 안내 이메일</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 transition-colors hover:text-gray-600"
            aria-label="닫기"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-4 text-sm text-gray-600">
            저장된 배정 변경을 반영했습니다. 새로 배정된 가이드와, 배정이 해제·변경된 이전 가이드에게 각각
            안내 메일을 보낼 수 있습니다. (예: Joey → Chad 변경 시 Joey·Chad 모두)
          </p>

          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            <ChangeSummaryBlock
              title="신규 배정"
              icon={<UserPlus className="h-4 w-4 text-green-600" />}
              items={added}
              tone="green"
            />
            <ChangeSummaryBlock
              title="배정 변경"
              icon={<RefreshCw className="h-4 w-4 text-amber-600" />}
              items={changed}
              tone="amber"
            />
            <ChangeSummaryBlock
              title="배정 해제"
              icon={<UserMinus className="h-4 w-4 text-red-600" />}
              items={removed}
              tone="red"
            />
          </div>

          {recipientGroups.length === 0 ? (
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              발송 대상 가이드가 없습니다.
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">수신 가이드</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={selectedGroupKey ?? ''}
                  onChange={(e) => setSelectedGroupKey(e.target.value)}
                >
                  {recipientGroups.map((g) => {
                    const key = recipientGroupKey(g)
                    return (
                      <option key={key} value={key}>
                        {g.email} · {guideAssignmentEmailKindLabel(g.kind)} ({g.items.length}건)
                        {sentGroupKeys.has(key) ? ' · 발송됨' : ''}
                      </option>
                    )
                  })}
                </select>
                {selectedGroup && selectedGroup.items.length > 0 && (
                  <ul className="mt-2 max-h-40 overflow-y-auto rounded border border-gray-100 bg-gray-50 text-xs text-gray-700">
                    {selectedGroup.items.map((item) => (
                      <li key={item.id} className="border-b border-gray-100 px-2 py-1.5 last:border-0">
                        {item.tourDate} · {item.productName} · {guideAssignmentRoleLabel(item.role)}
                        <span className="block text-[10px] text-gray-500">
                          이전: {item.previousName} → 변경 후: {item.newName}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">이메일 미리보기</label>
                {loadingPreview ? (
                  <div className="flex h-48 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : preview ? (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-600">
                      <span className="font-medium">제목:</span> {preview.subject}
                    </p>
                    <div
                      className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 text-sm"
                      dangerouslySetInnerHTML={{ __html: preview.html }}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">미리보기를 불러올 수 없습니다.</p>
                )}
              </div>
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
          >
            닫기
          </button>
          {recipientGroups.length > 0 && (
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={
                sending ||
                loadingPreview ||
                !preview ||
                !selectedGroupKey ||
                sentGroupKeys.has(selectedGroupKey ?? '')
              }
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sentGroupKeys.has(selectedGroupKey ?? '') ? '발송 완료' : '이메일 전송'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ChangeSummaryBlock({
  title,
  icon,
  items,
  tone,
}: {
  title: string
  icon: React.ReactNode
  items: GuideAssignmentChangeItem[]
  tone: 'green' | 'amber' | 'red'
}) {
  const border =
    tone === 'green' ? 'border-green-200 bg-green-50' : tone === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'

  return (
    <div className={`rounded-lg border px-3 py-2 ${border}`}>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-800">
        {icon}
        {title}
        <span className="ml-auto font-bold">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-gray-500">없음</p>
      ) : (
        <ul className="max-h-20 overflow-y-auto text-[11px] text-gray-700">
          {items.slice(0, 5).map((item) => (
            <li key={item.id} className="truncate">
              {item.tourDate} {item.productName}: {item.previousName} → {item.newName}
            </li>
          ))}
          {items.length > 5 && <li className="text-gray-500">+{items.length - 5}건 더</li>}
        </ul>
      )}
    </div>
  )
}
