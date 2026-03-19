'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { DollarSign, Plus, RefreshCw, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchEmployeeHourlyRatePeriods,
  dayBefore,
  type EmployeeRatePeriod,
} from '@/lib/employeeHourlyRates'

type TeamOption = { email: string; name_ko: string; position: string | null }

export default function EmployeeHourlyRatesPanel() {
  const [rows, setRows] = useState<EmployeeRatePeriod[]>([])
  const [teamList, setTeamList] = useState<TeamOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [form, setForm] = useState({
    employee_email: '',
    hourly_rate: '15.00',
    effective_from: new Date().toISOString().slice(0, 10),
    effective_to: '',
    notes: '',
  })

  const nameByEmail = useMemo(() => {
    const m: Record<string, string> = {}
    teamList.forEach((t) => {
      m[t.email] = t.name_ko || t.email
    })
    return m
  }, [teamList])

  const loadTeam = useCallback(async () => {
    const { data, error } = await supabase
      .from('team')
      .select('email, name_ko, position')
      .eq('is_active', true)
      .order('name_ko')
    if (error) {
      console.error(error)
      return
    }
    const list = (data || []) as TeamOption[]
    setTeamList(list)
    setForm((f) => ({
      ...f,
      employee_email: f.employee_email || list[0]?.email || '',
    }))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchEmployeeHourlyRatePeriods(supabase)
      setRows(data)
    } catch (e) {
      console.error(e)
      setMessage('목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTeam()
  }, [loadTeam])

  useEffect(() => {
    load()
  }, [load])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      if (!form.employee_email.trim()) {
        setMessage('직원을 선택하세요.')
        setSaving(false)
        return
      }
      const rate = parseFloat(form.hourly_rate)
      if (Number.isNaN(rate) || rate < 0) {
        setMessage('유효한 시급을 입력하세요.')
        setSaving(false)
        return
      }

      const effectiveFrom = form.effective_from
      const effectiveTo = form.effective_to.trim() || null
      const email = form.employee_email.trim()

      const { data: openRows } = await supabase
        .from('employee_hourly_rate_periods')
        .select('id')
        .eq('employee_email', email)
        .is('effective_to', null)

      if (openRows && openRows.length > 0) {
        const closeDate = dayBefore(effectiveFrom)
        for (const r of openRows) {
          await supabase.from('employee_hourly_rate_periods').update({ effective_to: closeDate }).eq('id', r.id)
        }
      }

      const { error } = await supabase.from('employee_hourly_rate_periods').insert({
        employee_email: email,
        hourly_rate: rate,
        effective_from: effectiveFrom,
        effective_to: effectiveTo,
        notes: form.notes.trim() || null,
      })

      if (error) {
        console.error(error)
        setMessage(error.message)
        setSaving(false)
        return
      }

      setMessage('저장되었습니다.')
      setForm((f) => ({
        ...f,
        hourly_rate: rate.toFixed(2),
        effective_to: '',
        notes: '',
      }))
      await load()
    } catch (err) {
      console.error(err)
      setMessage('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const ea = a.employee_email.localeCompare(b.employee_email)
    if (ea !== 0) return ea
    return b.effective_from.localeCompare(a.effective_from)
  })

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-600 shrink-0" />
          직원별 시급 이력
        </h2>
        <button
          type="button"
          onClick={() => {
            loadTeam()
            load()
          }}
          disabled={loading}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      <p className="text-sm text-gray-600 mb-4 flex items-start gap-2">
        <User className="w-4 h-4 mt-0.5 shrink-0 text-gray-500" />
        <span>
          직원(<code className="bg-gray-100 px-1 rounded">team.email</code>)마다 다른 시급을 적용할 수 있습니다. 적용 시작일 기준으로 구간이 나뉘며,
          새 구간을 추가하면 해당 직원의 이전 &quot;종료일 없음&quot; 구간은 자동으로 전날까지 닫힙니다.
        </span>
      </p>

      {message && (
        <div className="mb-3 text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-md px-3 py-2">{message}</div>
      )}

      <form
        onSubmit={handleAdd}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-6 p-3 bg-gray-50 rounded-lg border border-gray-100"
      >
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">직원</label>
          <select
            value={form.employee_email}
            onChange={(e) => setForm((f) => ({ ...f, employee_email: e.target.value }))}
            className="w-full px-2 py-2 text-sm border border-gray-300 rounded-md"
            required
          >
            <option value="">선택…</option>
            {teamList.map((t) => (
              <option key={t.email} value={t.email}>
                {t.name_ko} ({t.email})
                {t.position ? ` · ${t.position}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">시급 ($)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.hourly_rate}
            onChange={(e) => setForm((f) => ({ ...f, hourly_rate: e.target.value }))}
            className="w-full px-2 py-2 text-sm border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">적용 시작일</label>
          <input
            type="date"
            value={form.effective_from}
            onChange={(e) => setForm((f) => ({ ...f, effective_from: e.target.value }))}
            className="w-full px-2 py-2 text-sm border border-gray-300 rounded-md"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">적용 종료일 (선택)</label>
          <input
            type="date"
            value={form.effective_to}
            onChange={(e) => setForm((f) => ({ ...f, effective_to: e.target.value }))}
            className="w-full px-2 py-2 text-sm border border-gray-300 rounded-md"
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">메모</label>
          <input
            type="text"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="w-full px-2 py-2 text-sm border border-gray-300 rounded-md"
            placeholder="선택"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            구간 추가
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">불러오는 중…</p>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">직원</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">이메일</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">시급</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">시작</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">종료</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">메모</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sorted.map((r) => (
                <tr key={r.id || `${r.employee_email}-${r.effective_from}`} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap font-medium">
                    {nameByEmail[r.employee_email] || '—'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600 text-xs">{r.employee_email}</td>
                  <td className="px-3 py-2 text-right font-medium">${Number(r.hourly_rate).toFixed(2)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.effective_from}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">{r.effective_to ?? '— (현재)'}</td>
                  <td className="px-3 py-2 text-gray-600 max-w-xs truncate">{r.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
