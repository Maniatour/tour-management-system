'use client'

import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { createClientSupabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type OffScheduleRow = Database['public']['Tables']['off_schedules']['Row']

export interface PendingOffSchedulesModalProps {
  isOpen: boolean
  onClose: () => void
  approverEmail: string | null
  teamMemberNameLookup: Record<string, string>
  onAfterChange?: () => void
}

export function PendingOffSchedulesModal({
  isOpen,
  onClose,
  approverEmail,
  teamMemberNameLookup,
  onAfterChange,
}: PendingOffSchedulesModalProps) {
  const t = useTranslations('tours.calendar.offSchedule')
  const locale = useLocale()
  const supabase = createClientSupabase()
  const [rows, setRows] = useState<OffScheduleRow[]>([])
  const [guideNameByEmail, setGuideNameByEmail] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [bulkWorking, setBulkWorking] = useState(false)
  const [mutatingId, setMutatingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('off_schedules')
        .select('*')
        .eq('status', 'pending')
        .order('off_date', { ascending: true })

      if (error) throw error
      const list = data || []

      const emails = [
        ...new Set(
          list
            .map((r) => r.team_email?.trim())
            .filter((e): e is string => Boolean(e))
        ),
      ]

      const merged: Record<string, string> = { ...teamMemberNameLookup }

      if (emails.length > 0) {
        const { data: teamRows, error: teamErr } = await supabase
          .from('team')
          .select('email, name_ko, name_en, nick_name')
          .in('email', emails)

        if (!teamErr && teamRows) {
          for (const m of teamRows) {
            const key = m.email.trim().toLowerCase()
            const primary =
              locale === 'en'
                ? m.nick_name || m.name_en || m.name_ko || m.email
                : m.nick_name || m.name_ko || m.name_en || m.email
            merged[key] = String(primary || m.email).trim() || m.email
          }
        }
      }

      setGuideNameByEmail(merged)
      setRows(list)
    } catch (e) {
      console.error('Pending off schedules load:', e)
      alert(t('pendingLoadError'))
      setRows([])
      setGuideNameByEmail({ ...teamMemberNameLookup })
    } finally {
      setLoading(false)
    }
  }, [supabase, t, teamMemberNameLookup, locale])

  useEffect(() => {
    if (isOpen) void load()
  }, [isOpen, load])

  const applicantLabel = (email: string) => {
    const key = email.trim().toLowerCase()
    return guideNameByEmail[key] || teamMemberNameLookup[key] || email
  }

  const decide = async (row: OffScheduleRow, status: 'approved' | 'rejected') => {
    if (!approverEmail) return
    setMutatingId(row.id)
    try {
      const { error } = await supabase
        .from('off_schedules')
        .update({ status, approved_by: approverEmail })
        .eq('id', row.id)

      if (error) throw error
      setRows((prev) => prev.filter((r) => r.id !== row.id))
      onAfterChange?.()
    } catch (e) {
      console.error('Off schedule decision:', e)
      alert(t('adminUpdateError'))
    } finally {
      setMutatingId(null)
    }
  }

  const approveAllRemaining = async () => {
    if (!approverEmail || rows.length === 0) return
    const msg =
      locale === 'ko'
        ? `대기 중인 ${rows.length}건을 모두 승인할까요?`
        : `Approve all ${rows.length} pending request(s)?`
    if (!confirm(msg)) return

    setBulkWorking(true)
    const ids = rows.map((r) => r.id)
    const chunkSize = 100
    try {
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize)
        const { error } = await supabase
          .from('off_schedules')
          .update({ status: 'approved', approved_by: approverEmail })
          .eq('status', 'pending')
          .in('id', chunk)
        if (error) throw error
      }
      setRows([])
      onAfterChange?.()
    } catch (e) {
      console.error('Bulk approve off schedules:', e)
      alert(t('adminUpdateError'))
      void load()
    } finally {
      setBulkWorking(false)
    }
  }

  if (!isOpen) return null

  // ScheduleView 날짜/상품명 행 sticky z-[1010] — 모달은 z-[1100] 이상 (ScheduleView 내 다른 모달과 동일)
  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50">
      <div
        className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pending-off-modal-title"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 shrink-0">
          <h2 id="pending-off-modal-title" className="text-lg font-semibold text-gray-900">
            {t('pendingModalTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label={t('pendingClose')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={bulkWorking || loading || rows.length === 0 || !approverEmail}
            onClick={() => void approveAllRemaining()}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('pendingApproveAll')} ({rows.length})
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void load()}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {t('pendingRefresh')}
          </button>
        </div>

        <div className="flex-1 overflow-auto min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-500 text-sm">{t('pendingLoading')}</div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-gray-500 text-sm">{t('pendingEmpty')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 font-medium">{t('offDate')}</th>
                    <th className="px-4 py-2 font-medium">{t('applicant')}</th>
                    <th className="px-4 py-2 font-medium">{t('reason')}</th>
                    <th className="px-4 py-2 font-medium w-[200px]">{t('pendingActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row) => {
                    const busy = mutatingId === row.id || bulkWorking
                    return (
                      <tr key={row.id} className="hover:bg-gray-50/80">
                        <td className="px-4 py-2 whitespace-nowrap text-gray-900 font-medium">{row.off_date}</td>
                        <td className="px-4 py-2 text-gray-800">
                          <div className="font-medium">{applicantLabel(row.team_email)}</div>
                          <div className="text-xs text-gray-500 truncate max-w-[200px]" title={row.team_email}>
                            {row.team_email}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-gray-700 max-w-md">
                          <span className="line-clamp-3 whitespace-pre-wrap">{row.reason ?? '—'}</span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              disabled={busy || !approverEmail}
                              onClick={() => void decide(row, 'approved')}
                              className="px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {t('approve')}
                            </button>
                            <button
                              type="button"
                              disabled={busy || !approverEmail}
                              onClick={() => void decide(row, 'rejected')}
                              className="px-2.5 py-1 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              {t('reject')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            disabled={bulkWorking || loading || rows.length === 0 || !approverEmail}
            onClick={() => void approveAllRemaining()}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {t('pendingApproveAll')} ({rows.length})
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200"
          >
            {t('pendingClose')}
          </button>
        </div>
      </div>
    </div>
  )
}
