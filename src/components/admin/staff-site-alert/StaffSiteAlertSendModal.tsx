'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock, History, Loader2, Megaphone, Send, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  canSendStaffSiteAlert,
  canUseSendAsJoeyShimOption,
  canUseSendAsJudyOption,
  normalizeTeamBoardPosition,
  STAFF_SITE_ALERT_POSITION_TABS,
  STAFF_SITE_ALERT_TARGET_GROUPS,
  staffSiteAlertLocalizedTitle,
  staffSiteAlertTargetSummary,
  type StaffSiteAlertRecipientMode,
  type StaffSiteAlertRecipientRow,
  type StaffSiteAlertRow,
  type StaffSiteAlertSendPayload,
  type StaffSiteAlertSenderProxy,
  type StaffSiteAlertTargetGroup,
  type StaffSiteAlertTeamMember,
} from '@/lib/staffSiteAlert'
import { useHubArticlesForManualLink } from '@/hooks/useHubArticlesForManualLink'
import { StaffSiteAlertHubAttachmentPicker } from '@/components/admin/staff-site-alert/StaffSiteAlertHubAttachmentPicker'

type StaffSiteAlertSendModalProps = {
  open: boolean
  locale: string
  onClose: () => void
}

type AlertWithStats = StaffSiteAlertRow & {
  total: number
  acknowledged: number
  signed: number
}

const EMPTY_FORM: StaffSiteAlertSendPayload = {
  titleKo: '',
  titleEn: '',
  bodyKo: '',
  bodyEn: '',
  recipientMode: 'group',
  targetGroups: [],
  targetIndividuals: [],
  linkedHubArticleIds: [],
  requiresSignature: false,
  senderProxy: null,
}

export function StaffSiteAlertSendModal({ open, locale, onClose }: StaffSiteAlertSendModalProps) {
  const { authUser, userRole, userPosition } = useAuth()
  const isKo = locale.startsWith('ko')
  const canSend = canSendStaffSiteAlert({
    userRole,
    userPosition,
    authUserEmail: authUser?.email,
  })
  const canSendAsJoeyShim = canUseSendAsJoeyShimOption({
    userRole,
    userPosition,
    authUserEmail: authUser?.email,
  })
  const canSendAsJudy = canUseSendAsJudyOption({
    userRole,
    userPosition,
    authUserEmail: authUser?.email,
  })

  const [tab, setTab] = useState<'send' | 'history'>('send')
  const [form, setForm] = useState<StaffSiteAlertSendPayload>(EMPTY_FORM)
  const [sending, setSending] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [history, setHistory] = useState<AlertWithStats[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [recipientDetails, setRecipientDetails] = useState<StaffSiteAlertRecipientRow[]>([])
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [teamMembers, setTeamMembers] = useState<StaffSiteAlertTeamMember[]>([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [activePositionTab, setActivePositionTab] = useState(STAFF_SITE_ALERT_POSITION_TABS[0]?.id ?? 'tour guide')
  const {
    articles: hubArticles,
    loading: hubArticlesLoading,
    loadFailed: hubArticlesLoadFailed,
    reload: reloadHubArticles,
  } = useHubArticlesForManualLink(open)

  const loadTeamMembers = useCallback(async () => {
    setTeamLoading(true)
    try {
      const { data, error } = await supabase
        .from('team')
        .select('email, name_ko, position, is_active')
        .eq('is_active', true)
        .order('name_ko', { ascending: true })

      if (error) throw error
      setTeamMembers((data || []) as StaffSiteAlertTeamMember[])
    } catch (e) {
      console.error('StaffSiteAlertSendModal team', e)
      setTeamMembers([])
    } finally {
      setTeamLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setTab('send')
      setForm(EMPTY_FORM)
      setExpandedId(null)
      setRecipientDetails([])
      setActivePositionTab(STAFF_SITE_ALERT_POSITION_TABS[0]?.id ?? 'tour guide')
      return
    }
    void loadTeamMembers()
  }, [open, loadTeamMembers])

  const loadHistory = useCallback(async () => {
    if (!canSend) return
    setHistoryLoading(true)
    try {
      const { data: alerts, error } = await supabase
        .from('staff_site_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30)

      if (error) throw error

      const withStats: AlertWithStats[] = []
      for (const alert of (alerts || []) as StaffSiteAlertRow[]) {
        const { data: recipients, error: rErr } = await supabase
          .from('staff_site_alert_recipients')
          .select('acknowledged_at, signed_at')
          .eq('alert_id', alert.id)

        if (rErr) throw rErr
        const rows = recipients || []
        withStats.push({
          ...alert,
          total: rows.length,
          acknowledged: rows.filter((r) => r.acknowledged_at).length,
          signed: rows.filter((r) => r.signed_at).length,
        })
      }
      setHistory(withStats)
    } catch (e) {
      console.error('StaffSiteAlertSendModal history', e)
    } finally {
      setHistoryLoading(false)
    }
  }, [canSend])

  useEffect(() => {
    if (open && tab === 'history') {
      void loadHistory()
    }
  }, [open, tab, loadHistory])

  const toggleGroup = (group: StaffSiteAlertTargetGroup) => {
    setForm((prev) => {
      const has = prev.targetGroups.includes(group)
      return {
        ...prev,
        targetGroups: has
          ? prev.targetGroups.filter((g) => g !== group)
          : [...prev.targetGroups, group],
      }
    })
  }

  const setRecipientMode = (mode: StaffSiteAlertRecipientMode) => {
    setForm((prev) => ({
      ...prev,
      recipientMode: mode,
      targetGroups: mode === 'group' ? prev.targetGroups : [],
      targetIndividuals: mode === 'individual' ? prev.targetIndividuals : [],
    }))
  }

  const toggleIndividual = (email: string) => {
    const key = email.trim().toLowerCase()
    if (!key) return
    setForm((prev) => {
      const has = prev.targetIndividuals.includes(key)
      return {
        ...prev,
        targetIndividuals: has
          ? prev.targetIndividuals.filter((e) => e !== key)
          : [...prev.targetIndividuals, key],
      }
    })
  }

  const membersInActiveTab = teamMembers.filter(
    (member) => normalizeTeamBoardPosition(member.position) === activePositionTab
  )

  const toggleSenderProxy = (proxy: StaffSiteAlertSenderProxy) => {
    setForm((prev) => ({
      ...prev,
      senderProxy: prev.senderProxy === proxy ? null : proxy,
    }))
  }

  const hasRecipients =
    form.recipientMode === 'group'
      ? form.targetGroups.length > 0
      : form.targetIndividuals.length > 0

  const handleSend = async () => {
    if (!canSend || sending) return
    setSending(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('no session')

      const res = await fetch('/api/staff-site-alerts/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...form, locale }),
      })
      const json = (await res.json()) as { error?: string; recipientCount?: number }
      if (!res.ok) throw new Error(json.error || 'send failed')

      alert(
        isKo
          ? `${json.recipientCount ?? 0}명에게 알림을 발송했습니다.`
          : `Alert sent to ${json.recipientCount ?? 0} recipients.`
      )
      setForm(EMPTY_FORM)
      setTab('history')
      void loadHistory()
    } catch (e) {
      console.error('StaffSiteAlertSendModal send', e)
      alert(isKo ? '발송에 실패했습니다.' : 'Failed to send alert.')
    } finally {
      setSending(false)
    }
  }

  const loadRecipientDetails = async (alertId: string) => {
    if (expandedId === alertId) {
      setExpandedId(null)
      setRecipientDetails([])
      return
    }
    setExpandedId(alertId)
    setDetailsLoading(true)
    try {
      const { data, error } = await supabase
        .from('staff_site_alert_recipients')
        .select('*')
        .eq('alert_id', alertId)
        .order('acknowledged_at', { ascending: true, nullsFirst: false })

      if (error) throw error
      setRecipientDetails((data || []) as StaffSiteAlertRecipientRow[])
    } catch (e) {
      console.error('StaffSiteAlertSendModal details', e)
      setRecipientDetails([])
    } finally {
      setDetailsLoading(false)
    }
  }

  if (!open || !canSend) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-gray-900">
              {isKo ? '사이트 알림 발송' : 'Site Alert Broadcast'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label={isKo ? '닫기' : 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b px-5">
          <button
            type="button"
            onClick={() => setTab('send')}
            className={`mr-4 border-b-2 px-1 py-3 text-sm font-medium ${
              tab === 'send'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Send className="h-4 w-4" />
              {isKo ? '발송' : 'Send'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`border-b-2 px-1 py-3 text-sm font-medium ${
              tab === 'history'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <History className="h-4 w-4" />
              {isKo ? '발송 내역' : 'History'}
            </span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'send' ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-800">
                    {isKo ? '제목 (한글)' : 'Title (Korean)'}
                  </label>
                  <input
                    value={form.titleKo}
                    onChange={(e) => setForm((p) => ({ ...p, titleKo: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-800">
                    {isKo ? '제목 (영문, 선택)' : 'Title (English, optional)'}
                  </label>
                  <input
                    value={form.titleEn}
                    onChange={(e) => setForm((p) => ({ ...p, titleEn: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-800">
                    {isKo ? '내용 (한글)' : 'Body (Korean)'}
                  </label>
                  <textarea
                    value={form.bodyKo}
                    onChange={(e) => setForm((p) => ({ ...p, bodyKo: e.target.value }))}
                    rows={5}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-800">
                    {isKo ? '내용 (영문, 선택)' : 'Body (English, optional)'}
                  </label>
                  <textarea
                    value={form.bodyEn}
                    onChange={(e) => setForm((p) => ({ ...p, bodyEn: e.target.value }))}
                    rows={5}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <StaffSiteAlertHubAttachmentPicker
                locale={locale}
                value={form.linkedHubArticleIds ?? []}
                onChange={(linkedHubArticleIds) =>
                  setForm((p) => ({ ...p, linkedHubArticleIds }))
                }
                hubArticles={hubArticles}
                loading={hubArticlesLoading}
                loadFailed={hubArticlesLoadFailed}
                onRetry={() => void reloadHubArticles()}
              />

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-800">
                  {isKo ? '수신 대상' : 'Recipients'}
                </label>
                <div className="mb-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRecipientMode('group')}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                      form.recipientMode === 'group'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {isKo ? '그룹 선택' : 'By group'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecipientMode('individual')}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                      form.recipientMode === 'individual'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {isKo ? '직원 선택' : 'By staff'}
                  </button>
                </div>

                {form.recipientMode === 'group' ? (
                  <div className="flex flex-wrap gap-2">
                    {STAFF_SITE_ALERT_TARGET_GROUPS.map((group) => {
                      const selected = form.targetGroups.includes(group.id)
                      return (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => toggleGroup(group.id)}
                          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                            selected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {isKo ? group.labelKo : group.labelEn}
                        </button>
                      )
                    })}
                  </div>
                ) : teamLoading ? (
                  <div className="flex items-center gap-2 py-6 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isKo ? '팀원 목록 불러오는 중…' : 'Loading team members…'}
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-gray-200">
                    <div className="flex flex-wrap border-b bg-gray-50">
                      {STAFF_SITE_ALERT_POSITION_TABS.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActivePositionTab(tab.id)}
                          className={`border-r px-3 py-2 text-xs font-medium last:border-r-0 sm:text-sm ${
                            activePositionTab === tab.id
                              ? 'bg-primary text-primary-foreground'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {isKo ? tab.labelKo : tab.labelEn}
                        </button>
                      ))}
                    </div>
                    <div className="max-h-44 overflow-y-auto p-3">
                      {membersInActiveTab.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          {isKo ? '이 직책의 활성 팀원이 없습니다.' : 'No active members in this role.'}
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {membersInActiveTab.map((member) => {
                            const email = (member.email || '').trim().toLowerCase()
                            const selected = form.targetIndividuals.includes(email)
                            return (
                              <button
                                key={email}
                                type="button"
                                onClick={() => toggleIndividual(email)}
                                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                                  selected
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                                }`}
                              >
                                {member.name_ko || email.split('@')[0]}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    {form.targetIndividuals.length > 0 ? (
                      <p className="border-t bg-gray-50 px-3 py-2 text-xs text-gray-600">
                        {isKo
                          ? `${form.targetIndividuals.length}명 선택됨`
                          : `${form.targetIndividuals.length} selected`}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={form.requiresSignature}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, requiresSignature: e.target.checked }))
                    }
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">
                      {isKo ? '서명 필요 안내' : 'Require signature'}
                    </span>
                    <span className="text-xs text-gray-600">
                      {isKo
                        ? '수신자가 이름을 입력하고 확인해야 닫을 수 있습니다.'
                        : 'Recipients must sign with their name before dismissing.'}
                    </span>
                  </span>
                </label>

                {canSendAsJoeyShim ? (
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={form.senderProxy === 'joey_shim'}
                      onChange={() => toggleSenderProxy('joey_shim')}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-900">
                        {isKo ? 'Joey Shim 계정으로 발송' : 'Send as Joey Shim'}
                      </span>
                      <span className="text-xs text-gray-600">
                        {isKo
                          ? '수신자에게 발송자가 Joey Shim으로 표시됩니다.'
                          : 'Recipients will see the sender as Joey Shim.'}
                      </span>
                    </span>
                  </label>
                ) : null}

                {canSendAsJudy ? (
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={form.senderProxy === 'judy'}
                      onChange={() => toggleSenderProxy('judy')}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-900">
                        {isKo ? 'Judy 계정으로 발송' : 'Send as Judy'}
                      </span>
                      <span className="text-xs text-gray-600">
                        {isKo
                          ? '수신자에게 발송자가 Office Manager Judy로 표시됩니다.'
                          : 'Recipients will see the sender as Office Manager Judy.'}
                      </span>
                    </span>
                  </label>
                ) : null}
              </div>
            </div>
          ) : historyLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-500">
              {isKo ? '발송 내역이 없습니다.' : 'No alerts sent yet.'}
            </p>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div key={item.id} className="rounded-xl border border-gray-200 bg-white">
                  <button
                    type="button"
                    onClick={() => void loadRecipientDetails(item.id)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">
                          {staffSiteAlertLocalizedTitle(item, locale)}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {new Date(item.created_at).toLocaleString(locale)} ·{' '}
                          {item.display_sender_name}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {staffSiteAlertTargetSummary(item, locale)}
                          {(item.linked_hub_article_ids?.length ?? 0) > 0
                            ? isKo
                              ? ` · 문서 ${item.linked_hub_article_ids!.length}개`
                              : ` · ${item.linked_hub_article_ids!.length} doc(s)`
                            : ''}
                          {item.requires_signature ? (isKo ? ' · 서명 필요' : ' · Signature') : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right text-xs text-gray-600">
                        <div className="inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          {item.acknowledged}/{item.total}
                        </div>
                        {item.requires_signature ? (
                          <div className="mt-1">
                            {isKo ? '서명' : 'Signed'}: {item.signed}/{item.total}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </button>

                  {expandedId === item.id ? (
                    <div className="border-t bg-gray-50 px-4 py-3">
                      {detailsLoading ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                        </div>
                      ) : recipientDetails.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          {isKo ? '수신자가 없습니다.' : 'No recipients.'}
                        </p>
                      ) : (
                        <div className="max-h-56 overflow-y-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="text-gray-500">
                                <th className="pb-2 pr-2 font-medium">
                                  {isKo ? '수신자' : 'Recipient'}
                                </th>
                                <th className="pb-2 pr-2 font-medium">
                                  {isKo ? '확인' : 'Confirmed'}
                                </th>
                                <th className="pb-2 font-medium">
                                  {isKo ? '서명' : 'Signature'}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {recipientDetails.map((r) => (
                                <tr key={r.id} className="border-t border-gray-200">
                                  <td className="py-2 pr-2 text-gray-800">{r.recipient_email}</td>
                                  <td className="py-2 pr-2 text-gray-600">
                                    {r.acknowledged_at ? (
                                      <span className="inline-flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {new Date(r.acknowledged_at).toLocaleString(locale)}
                                      </span>
                                    ) : (
                                      <span className="text-amber-700">
                                        {isKo ? '대기' : 'Pending'}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 text-gray-600">
                                    {r.signed_at ? (
                                      <span>
                                        {r.signature_text || '—'}
                                        <br />
                                        <span className="text-[10px] text-gray-500">
                                          {new Date(r.signed_at).toLocaleString(locale)}
                                        </span>
                                      </span>
                                    ) : item.requires_signature ? (
                                      <span className="text-amber-700">
                                        {isKo ? '미서명' : 'Unsigned'}
                                      </span>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {tab === 'send' ? (
          <div className="flex justify-end gap-2 border-t bg-gray-50 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-white disabled:opacity-50"
            >
              {isKo ? '취소' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={
                sending ||
                !form.titleKo.trim() ||
                !form.bodyKo.trim() ||
                !hasRecipients
              }
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isKo ? '발송' : 'Send'}
            </button>
          </div>
        ) : (
          <div className="flex justify-end border-t bg-gray-50 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-white"
            >
              {isKo ? '닫기' : 'Close'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
