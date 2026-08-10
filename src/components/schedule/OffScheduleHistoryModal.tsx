'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import {
  Calendar,
  CheckCircle2,
  Clock,
  History,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type OffScheduleRow = Database['public']['Tables']['off_schedules']['Row']
type OffStatus = 'pending' | 'approved' | 'rejected'

type TeamMemberRef = {
  email: string
  name_ko?: string | null
  name_en?: string | null
  nick_name?: string | null
}

export type OffScheduleHistoryModalProps = {
  isOpen: boolean
  onClose: () => void
  locale?: string
  teamMembers?: TeamMemberRef[]
  /** 현재 스케줄 뷰 월 — 기본 off_date 필터 힌트 */
  scopeMonth?: string | Date | null
  approverEmail?: string | null
  onAfterChange?: () => void
}

type StatusFilter = 'all' | OffStatus

const STATUS_OPTIONS: { value: StatusFilter; labelKo: string; labelEn: string }[] = [
  { value: 'all', labelKo: '전체', labelEn: 'All' },
  { value: 'pending', labelKo: '대기', labelEn: 'Pending' },
  { value: 'approved', labelKo: '승인', labelEn: 'Approved' },
  { value: 'rejected', labelKo: '거절', labelEn: 'Rejected' },
]

function resolveMemberLabel(email: string, teamMembers: TeamMemberRef[], locale: string): string {
  const key = email.trim().toLowerCase()
  const member = teamMembers.find((m) => m.email.toLowerCase() === key)
  if (!member) return email
  if (locale === 'en') {
    return member.nick_name || member.name_en || member.name_ko || member.email
  }
  return member.nick_name || member.name_ko || member.name_en || member.email
}

function statusBadge(status: string, isKo: boolean) {
  if (status === 'approved') {
    return {
      icon: CheckCircle2,
      className: 'bg-emerald-100 text-emerald-800',
      label: isKo ? '승인' : 'Approved',
    }
  }
  if (status === 'rejected') {
    return {
      icon: XCircle,
      className: 'bg-red-100 text-red-800',
      label: isKo ? '거절' : 'Rejected',
    }
  }
  return {
    icon: Clock,
    className: 'bg-amber-100 text-amber-800',
    label: isKo ? '대기' : 'Pending',
  }
}

export default function OffScheduleHistoryModal({
  isOpen,
  onClose,
  locale = 'ko',
  teamMembers = [],
  scopeMonth = null,
  approverEmail = null,
  onAfterChange,
}: OffScheduleHistoryModalProps) {
  const isKo = locale === 'ko'
  const monthAnchor = scopeMonth ? dayjs(scopeMonth) : dayjs()

  const [rows, setRows] = useState<OffScheduleRow[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [fromDate, setFromDate] = useState(() => monthAnchor.startOf('month').format('YYYY-MM-DD'))
  const [toDate, setToDate] = useState(() => monthAnchor.endOf('month').format('YYYY-MM-DD'))
  const [guideQuery, setGuideQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [mutatingId, setMutatingId] = useState<string | null>(null)
  const [bulkWorking, setBulkWorking] = useState(false)
  const [editing, setEditing] = useState<OffScheduleRow | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editReason, setEditReason] = useState('')
  const [editStatus, setEditStatus] = useState<OffStatus>('pending')
  const [editSaving, setEditSaving] = useState(false)

  // 모달 열릴 때 현재 월 범위로 초기화
  useEffect(() => {
    if (!isOpen) return
    const anchor = scopeMonth ? dayjs(scopeMonth) : dayjs()
    setFromDate(anchor.startOf('month').format('YYYY-MM-DD'))
    setToDate(anchor.endOf('month').format('YYYY-MM-DD'))
    setStatusFilter('all')
    setGuideQuery('')
    setSelectedIds(new Set())
    setEditing(null)
  }, [isOpen, scopeMonth])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('off_schedules')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)

      if (fromDate) query = query.gte('off_date', fromDate)
      if (toDate) query = query.lte('off_date', toDate)
      if (statusFilter !== 'all') query = query.eq('status', statusFilter)

      const { data, error } = await query
      if (error) throw error
      setRows((data || []) as OffScheduleRow[])
      setSelectedIds(new Set())
    } catch (e) {
      console.error('Off schedule history load:', e)
      alert(isKo ? '오프 스케줄 히스토리를 불러오지 못했습니다.' : 'Failed to load off schedule history.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, statusFilter, isKo])

  useEffect(() => {
    if (isOpen) void load()
  }, [isOpen, load])

  const filteredRows = useMemo(() => {
    const q = guideQuery.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => {
      const email = row.team_email.toLowerCase()
      const name = resolveMemberLabel(row.team_email, teamMembers, locale).toLowerCase()
      const reason = (row.reason || '').toLowerCase()
      return email.includes(q) || name.includes(q) || reason.includes(q)
    })
  }, [rows, guideQuery, teamMembers, locale])

  const allVisibleSelected =
    filteredRows.length > 0 && filteredRows.every((r) => selectedIds.has(r.id))

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set())
      return
    }
    setSelectedIds(new Set(filteredRows.map((r) => r.id)))
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openEdit = (row: OffScheduleRow) => {
    setEditing(row)
    setEditDate(row.off_date)
    setEditReason(row.reason || '')
    setEditStatus((row.status as OffStatus) || 'pending')
  }

  const saveEdit = async () => {
    if (!editing) return
    if (!editDate) {
      alert(isKo ? '날짜를 선택해주세요.' : 'Please select a date.')
      return
    }
    setEditSaving(true)
    try {
      const patch: Database['public']['Tables']['off_schedules']['Update'] = {
        off_date: editDate,
        reason: editReason.trim() || null,
        status: editStatus,
        updated_at: new Date().toISOString(),
      }
      if (editStatus === 'approved' || editStatus === 'rejected') {
        patch.approved_by = approverEmail || editing.approved_by
        patch.approved_at = new Date().toISOString()
      } else {
        patch.approved_by = null
        patch.approved_at = null
      }

      const { error } = await supabase.from('off_schedules').update(patch).eq('id', editing.id)
      if (error) throw error

      setEditing(null)
      await load()
      onAfterChange?.()
    } catch (e) {
      console.error('Off schedule update:', e)
      alert(isKo ? '오프 스케줄 수정에 실패했습니다.' : 'Failed to update off schedule.')
    } finally {
      setEditSaving(false)
    }
  }

  const deleteOne = async (row: OffScheduleRow) => {
    const name = resolveMemberLabel(row.team_email, teamMembers, locale)
    const msg = isKo
      ? `${name} · ${row.off_date} 오프 스케줄을 삭제할까요?`
      : `Delete off schedule for ${name} on ${row.off_date}?`
    if (!confirm(msg)) return

    setMutatingId(row.id)
    try {
      const { error } = await supabase.from('off_schedules').delete().eq('id', row.id)
      if (error) throw error
      setRows((prev) => prev.filter((r) => r.id !== row.id))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(row.id)
        return next
      })
      if (editing?.id === row.id) setEditing(null)
      onAfterChange?.()
    } catch (e) {
      console.error('Off schedule delete:', e)
      alert(isKo ? '삭제에 실패했습니다.' : 'Failed to delete.')
    } finally {
      setMutatingId(null)
    }
  }

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return
    const msg = isKo
      ? `선택한 ${selectedIds.size}건의 오프 스케줄을 삭제할까요?`
      : `Delete ${selectedIds.size} selected off schedule(s)?`
    if (!confirm(msg)) return

    setBulkWorking(true)
    const ids = Array.from(selectedIds)
    const chunkSize = 100
    try {
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize)
        const { error } = await supabase.from('off_schedules').delete().in('id', chunk)
        if (error) throw error
      }
      setRows((prev) => prev.filter((r) => !selectedIds.has(r.id)))
      setSelectedIds(new Set())
      if (editing && selectedIds.has(editing.id)) setEditing(null)
      onAfterChange?.()
    } catch (e) {
      console.error('Bulk delete off schedules:', e)
      alert(isKo ? '일괄 삭제에 실패했습니다.' : 'Bulk delete failed.')
      void load()
    } finally {
      setBulkWorking(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50">
      <div
        className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="off-schedule-history-title"
      >
        <div className="px-4 py-3 border-b border-gray-200 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2
                id="off-schedule-history-title"
                className="text-lg font-semibold text-gray-900 flex items-center gap-2"
              >
                <History className="w-5 h-5 text-orange-500" />
                {isKo ? '오프 스케줄 히스토리' : 'Off Schedule History'}
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                {isKo
                  ? '생성된 오프 스케줄을 확인하고 수정·삭제할 수 있습니다. 실수로 넣은 건을 바로 정리하세요.'
                  : 'Review created off schedules and edit or delete them.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 shrink-0"
              aria-label={isKo ? '닫기' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-gray-100 flex flex-col gap-3 shrink-0">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              {isKo ? '시작일' : 'From'}
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-9 rounded-lg border border-gray-300 px-2 text-sm text-gray-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              {isKo ? '종료일' : 'To'}
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-9 rounded-lg border border-gray-300 px-2 text-sm text-gray-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-600 min-w-[120px]">
              {isKo ? '상태' : 'Status'}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="h-9 rounded-lg border border-gray-300 px-2 text-sm text-gray-900 bg-white"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {isKo ? opt.labelKo : opt.labelEn}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-600 flex-1 min-w-[160px]">
              {isKo ? '가이드·사유 검색' : 'Search guide / reason'}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="search"
                  value={guideQuery}
                  onChange={(e) => setGuideQuery(e.target.value)}
                  placeholder={isKo ? '이름, 이메일, 사유…' : 'Name, email, reason…'}
                  className="h-9 w-full rounded-lg border border-gray-300 pl-8 pr-2 text-sm text-gray-900"
                />
              </div>
            </label>
            <button
              type="button"
              disabled={loading}
              onClick={() => void load()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {isKo ? '새로고침' : 'Refresh'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={bulkWorking || selectedIds.size === 0}
              onClick={() => void deleteSelected()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              {isKo ? `선택 삭제 (${selectedIds.size})` : `Delete selected (${selectedIds.size})`}
            </button>
            <span className="text-xs text-gray-500">
              {isKo
                ? `${filteredRows.length}건 표시 · 생성일시 최신순`
                : `${filteredRows.length} shown · newest created first`}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-auto min-h-[240px]">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-500 text-sm">
              <Loader2 className="w-5 h-5 animate-spin" />
              {isKo ? '불러오는 중…' : 'Loading…'}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-500 text-sm">
              <Calendar className="w-8 h-8 text-gray-300" />
              {isKo ? '조건에 맞는 오프 스케줄이 없습니다.' : 'No off schedules match these filters.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 w-10">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAll}
                        aria-label={isKo ? '전체 선택' : 'Select all'}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">
                      {isKo ? '오프 날짜' : 'Off date'}
                    </th>
                    <th className="px-3 py-2 font-medium">{isKo ? '가이드' : 'Guide'}</th>
                    <th className="px-3 py-2 font-medium">{isKo ? '사유' : 'Reason'}</th>
                    <th className="px-3 py-2 font-medium">{isKo ? '상태' : 'Status'}</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">
                      {isKo ? '생성 시각' : 'Created'}
                    </th>
                    <th className="px-3 py-2 font-medium w-[140px]">{isKo ? '작업' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRows.map((row) => {
                    const badge = statusBadge(row.status, isKo)
                    const BadgeIcon = badge.icon
                    const busy = mutatingId === row.id || bulkWorking
                    return (
                      <tr key={row.id} className="hover:bg-gray-50/80">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.id)}
                            onChange={() => toggleSelect(row.id)}
                            disabled={busy}
                            aria-label={isKo ? '선택' : 'Select'}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">
                          {row.off_date}
                        </td>
                        <td className="px-3 py-2 text-gray-800">
                          <div className="font-medium">
                            {resolveMemberLabel(row.team_email, teamMembers, locale)}
                          </div>
                          <div className="text-xs text-gray-500 truncate max-w-[180px]" title={row.team_email}>
                            {row.team_email}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-gray-700 max-w-xs">
                          <span className="line-clamp-2 whitespace-pre-wrap">{row.reason || '—'}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                          >
                            <BadgeIcon className="w-3.5 h-3.5" />
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-600 text-xs">
                          {row.created_at
                            ? dayjs(row.created_at).format(
                                isKo ? 'YYYY-MM-DD HH:mm' : 'MMM D, YYYY h:mm A'
                              )
                            : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => openEdit(row)}
                              className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              {isKo ? '수정' : 'Edit'}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void deleteOne(row)}
                              className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {isKo ? '삭제' : 'Delete'}
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

        <div className="px-4 py-3 border-t border-gray-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200"
          >
            {isKo ? '닫기' : 'Close'}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-[1110] flex items-center justify-center p-4 bg-black/40">
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="off-schedule-edit-title"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="off-schedule-edit-title" className="text-base font-semibold text-gray-900">
                {isKo ? '오프 스케줄 수정' : 'Edit off schedule'}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                aria-label={isKo ? '닫기' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="text-sm text-gray-600">
                <span className="font-medium text-gray-800">{isKo ? '가이드' : 'Guide'}: </span>
                {resolveMemberLabel(editing.team_email, teamMembers, locale)}
              </div>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                {isKo ? '오프 날짜' : 'Off date'}
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="h-10 rounded-lg border border-gray-300 px-3 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                {isKo ? '사유' : 'Reason'}
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="h-10 rounded-lg border border-gray-300 px-3 text-sm"
                  placeholder={isKo ? '사유 입력' : 'Enter reason'}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                {isKo ? '상태' : 'Status'}
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as OffStatus)}
                  className="h-10 rounded-lg border border-gray-300 px-3 text-sm bg-white"
                >
                  <option value="pending">{isKo ? '대기' : 'Pending'}</option>
                  <option value="approved">{isKo ? '승인' : 'Approved'}</option>
                  <option value="rejected">{isKo ? '거절' : 'Rejected'}</option>
                </select>
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={editSaving}
                onClick={() => setEditing(null)}
                className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {isKo ? '취소' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={editSaving}
                onClick={() => void saveEdit()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isKo ? '저장' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
