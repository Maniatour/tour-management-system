'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Briefcase, Loader2, X } from 'lucide-react'
import { OFFICE_SCHEDULE_COPY as C } from '@/lib/officeScheduleCopy'
import { supabase } from '@/lib/supabase'
import {
  DEFAULT_OFFICE_EMPLOYEE_SETTINGS,
  REST_DAY_LABELS,
  fetchOfficeScheduleEmployeeSettings,
  getEmployeeSettings,
  normalizeRestDays,
  saveOfficeScheduleEmployeeSettings,
  type OfficeEmploymentType,
  type OfficePayType,
  type OfficeScheduleEmployeeSettings,
} from '@/lib/officeScheduleEmployeeSettings'
import type { OfficeBatchShift } from '@/lib/officeScheduleBatchShift'

type TeamRow = {
  email: string
  name_en: string | null
  display_name: string | null
}

function displayName(m: TeamRow): string {
  return (m.display_name || m.name_en || m.email.split('@')[0]).trim()
}

type Props = {
  isOpen: boolean
  onClose: () => void
  team: TeamRow[]
  canEdit: boolean
  scopeMonth: string
  onSettingsChange: (map: Map<string, OfficeScheduleEmployeeSettings>) => void
  onBatchFillShift?: (email: string, shift: OfficeBatchShift, restDays: number[]) => void
}

export default function OfficeScheduleEmployeeSettingsModal({
  isOpen,
  onClose,
  team,
  canEdit,
  scopeMonth,
  onSettingsChange,
  onBatchFillShift,
}: Props) {
  const [settingsMap, setSettingsMap] = useState<Map<string, OfficeScheduleEmployeeSettings>>(
    () => new Map()
  )
  const [loading, setLoading] = useState(false)
  const [savingEmail, setSavingEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const saveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const loadSettings = useCallback(async () => {
    if (team.length === 0) {
      setSettingsMap(new Map())
      return
    }
    setLoading(true)
    setError(null)
    try {
      const emails = team.map((m) => m.email)
      const fetched = await fetchOfficeScheduleEmployeeSettings(supabase, emails)
      const merged = new Map<string, OfficeScheduleEmployeeSettings>()
      for (const member of team) {
        merged.set(member.email.trim().toLowerCase(), getEmployeeSettings(fetched, member.email))
      }
      setSettingsMap(merged)
    } catch (e) {
      console.error(e)
      setError(C.employeeSettingsLoadError)
    } finally {
      setLoading(false)
    }
  }, [team])

  useEffect(() => {
    if (team.length === 0) return
    void loadSettings()
  }, [loadSettings, team.length])

  useEffect(() => {
    onSettingsChange(settingsMap)
  }, [settingsMap, onSettingsChange])

  useEffect(() => {
    return () => {
      for (const timer of saveTimersRef.current.values()) clearTimeout(timer)
      saveTimersRef.current.clear()
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  const persistSettings = useCallback(async (email: string, next: OfficeScheduleEmployeeSettings) => {
    setSavingEmail(email)
    setError(null)
    try {
      await saveOfficeScheduleEmployeeSettings(supabase, next)
    } catch (e) {
      console.error(e)
      setError(C.employeeSettingsSaveError)
    } finally {
      setSavingEmail((cur) => (cur === email ? null : cur))
    }
  }, [])

  const queueSave = useCallback(
    (email: string, next: OfficeScheduleEmployeeSettings) => {
      const norm = email.trim().toLowerCase()
      setSettingsMap((prev) => {
        const copy = new Map(prev)
        copy.set(norm, next)
        return copy
      })

      const existing = saveTimersRef.current.get(norm)
      if (existing) clearTimeout(existing)
      saveTimersRef.current.set(
        norm,
        setTimeout(() => {
          saveTimersRef.current.delete(norm)
          void persistSettings(email, next)
        }, 450)
      )
    },
    [persistSettings]
  )

  const updateField = useCallback(
    (
      email: string,
      patch: Partial<Pick<OfficeScheduleEmployeeSettings, 'pay_type' | 'employment_type' | 'rest_days'>>
    ) => {
      const norm = email.trim().toLowerCase()
      const current = settingsMap.get(norm) ?? {
        employee_email: email,
        ...DEFAULT_OFFICE_EMPLOYEE_SETTINGS,
      }
      let restDays = current.rest_days
      if (patch.rest_days != null) {
        restDays = normalizeRestDays(patch.rest_days)
      }
      const employmentType = patch.employment_type ?? current.employment_type
      if (employmentType !== 'full_time') {
        restDays = []
      }
      queueSave(email, {
        ...current,
        ...patch,
        employee_email: email,
        rest_days: restDays,
      })
    },
    [settingsMap, queueSave]
  )

  const toggleRestDay = useCallback(
    (email: string, day: number) => {
      const norm = email.trim().toLowerCase()
      const current = settingsMap.get(norm) ?? {
        employee_email: email,
        ...DEFAULT_OFFICE_EMPLOYEE_SETTINGS,
      }
      const set = new Set(current.rest_days)
      if (set.has(day)) set.delete(day)
      else set.add(day)
      updateField(email, { rest_days: [...set] })
    },
    [settingsMap, updateField]
  )

  const handleBatchFill = useCallback(
    (email: string, shift: OfficeBatchShift, restDays: number[]) => {
      if (!canEdit || !onBatchFillShift) return
      onBatchFillShift(email, shift, restDays)
    },
    [canEdit, onBatchFillShift]
  )

  if (team.length === 0) return null

  return (
    <>
      {isOpen && (
        <div
          className="absolute inset-0 z-40 flex max-lg:items-stretch items-center justify-center bg-black/45 p-0 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="office-schedule-employee-settings-title"
          onClick={onClose}
        >
          <div
            className="relative bg-white rounded-none sm:rounded-xl shadow-2xl w-full max-w-3xl h-full sm:h-auto max-h-none sm:max-h-[min(88%,720px)] flex flex-col overflow-hidden border-0 sm:border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 shrink-0">
              <h3
                id="office-schedule-employee-settings-title"
                className="text-sm font-semibold text-gray-900 flex items-center gap-2 min-w-0"
              >
                <Briefcase className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="truncate">{C.employeeSettingsTitle}</span>
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 shrink-0" />}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                aria-label={C.close}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="px-4 py-2 text-[11px] text-gray-500 border-b border-gray-100 shrink-0">
              {C.employeeSettingsDesc}
              {onBatchFillShift && (
                <span className="block mt-1 text-gray-400">
                  {C.employeeSettingsBatchFillHint.replace('{month}', scopeMonth)}
                </span>
              )}
            </p>

            {error && <p className="px-4 py-2 text-xs text-red-600 shrink-0">{error}</p>}

            <div className="flex-1 min-h-0 overflow-auto px-4 py-3">
              <table className="w-full min-w-[680px] text-xs border-collapse">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-1.5 pr-3 font-medium">{C.employeeSettingsStaff}</th>
                    <th className="py-1.5 pr-3 font-medium">{C.employeeSettingsPayType}</th>
                    <th className="py-1.5 pr-3 font-medium">{C.employeeSettingsEmployment}</th>
                    <th className="py-1.5 font-medium">{C.employeeSettingsRestDays}</th>
                  </tr>
                </thead>
                <tbody>
                  {team.map((member) => {
                    const norm = member.email.trim().toLowerCase()
                    const settings =
                      settingsMap.get(norm) ??
                      ({
                        employee_email: member.email,
                        ...DEFAULT_OFFICE_EMPLOYEE_SETTINGS,
                      } satisfies OfficeScheduleEmployeeSettings)
                    const isSaving = savingEmail === member.email
                    const isFullTime = settings.employment_type === 'full_time'

                    return (
                      <tr key={member.email} className="border-t border-gray-100">
                        <td className="py-2 pr-3 font-medium text-gray-800 whitespace-nowrap">
                          {displayName(member)}
                          {isSaving && (
                            <Loader2 className="inline w-3.5 h-3.5 ml-1 animate-spin text-indigo-500" />
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <select
                            value={settings.pay_type}
                            disabled={!canEdit}
                            onChange={(e) =>
                              updateField(member.email, { pay_type: e.target.value as OfficePayType })
                            }
                            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs disabled:opacity-60"
                          >
                            <option value="hourly">{C.employeeSettingsHourly}</option>
                            <option value="monthly">{C.employeeSettingsMonthly}</option>
                          </select>
                        </td>
                        <td className="py-2 pr-3">
                          <select
                            value={settings.employment_type}
                            disabled={!canEdit}
                            onChange={(e) =>
                              updateField(member.email, {
                                employment_type: e.target.value as OfficeEmploymentType,
                              })
                            }
                            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs disabled:opacity-60"
                          >
                            <option value="full_time">{C.employeeSettingsFullTime}</option>
                            <option value="part_time">{C.employeeSettingsPartTime}</option>
                          </select>
                        </td>
                        <td className="py-2">
                          {isFullTime ? (
                            <div className="flex flex-col gap-1.5">
                              <div className="flex flex-wrap gap-1">
                                {REST_DAY_LABELS.map((label, day) => {
                                  const active = settings.rest_days.includes(day)
                                  return (
                                    <button
                                      key={label}
                                      type="button"
                                      disabled={!canEdit}
                                      onClick={() => toggleRestDay(member.email, day)}
                                      className={`px-2 py-0.5 rounded-md border text-[10px] font-medium transition-colors ${
                                        active
                                          ? 'bg-rose-50 border-rose-300 text-rose-700'
                                          : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                                      } disabled:opacity-60`}
                                      title={
                                        active
                                          ? C.employeeSettingsRestDayOff
                                          : C.employeeSettingsRestDayWork
                                      }
                                    >
                                      {label}
                                    </button>
                                  )
                                })}
                              </div>
                              {onBatchFillShift && (
                                <div className="flex flex-wrap items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={!canEdit}
                                    onClick={() =>
                                      handleBatchFill(member.email, 'first_half', settings.rest_days)
                                    }
                                    className="px-2 py-0.5 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px] font-semibold hover:bg-indigo-100 disabled:opacity-60"
                                    title={C.employeeSettingsBatchFirstHalfTitle}
                                  >
                                    {C.employeeSettingsBatchFirstHalf}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!canEdit}
                                    onClick={() =>
                                      handleBatchFill(member.email, 'second_half', settings.rest_days)
                                    }
                                    className="px-2 py-0.5 rounded-md border border-violet-200 bg-violet-50 text-violet-700 text-[10px] font-semibold hover:bg-violet-100 disabled:opacity-60"
                                    title={C.employeeSettingsBatchSecondHalfTitle}
                                  >
                                    {C.employeeSettingsBatchSecondHalf}
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">{C.employeeSettingsRestDaysNa}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-2.5 border-t border-gray-100 shrink-0 flex items-center justify-between gap-2">
              <p className="text-[10px] text-gray-400">
                {canEdit ? C.employeeSettingsAutoSave : C.employeeSettingsReadOnly}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {C.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
