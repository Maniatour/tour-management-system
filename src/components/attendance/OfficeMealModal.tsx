'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { UtensilsCrossed, Loader2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTranslations } from 'next-intl'
import {
  lasVegasTodayYmd,
  addCalendarDaysYmd,
  OFFICE_MEAL_POLICY_START,
  OFFICE_MEAL_SELECTABLE_EMAILS,
  isOfficeMealSelectableEmail,
} from '@/lib/attendanceMealPolicy'

type TeamRow = { email: string; name_ko: string | null; display_name: string | null }

function sortTeamBySelectableOrder(rows: TeamRow[]): TeamRow[] {
  const order = OFFICE_MEAL_SELECTABLE_EMAILS.map((e) => e.toLowerCase())
  return [...rows].sort((a, b) => {
    const ia = order.indexOf(a.email.trim().toLowerCase())
    const ib = order.indexOf(b.email.trim().toLowerCase())
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })
}

interface OfficeMealModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function OfficeMealModal({ isOpen, onClose }: OfficeMealModalProps) {
  const t = useTranslations('attendancePage')
  const [mealDate, setMealDate] = useState(() => lasVegasTodayYmd())
  const [team, setTeam] = useState<TeamRow[]>([])
  const [mealEmails, setMealEmails] = useState<Set<string>>(new Set())
  const [teamLoading, setTeamLoading] = useState(false)
  const [mealsLoading, setMealsLoading] = useState(false)
  const [savingEmail, setSavingEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const summaryEnd = lasVegasTodayYmd()
  const summaryStart = useMemo(() => addCalendarDaysYmd(summaryEnd, -13), [summaryEnd])
  const [mealCounts, setMealCounts] = useState<Record<string, number>>({})

  const loadTeam = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('team')
      .select('email, name_ko, display_name')
      .eq('is_active', true)
      .in('email', [...OFFICE_MEAL_SELECTABLE_EMAILS])
    if (err) {
      console.error(err)
      return
    }
    const rows = ((data || []) as TeamRow[]).filter((r) => isOfficeMealSelectableEmail(r.email))
    setTeam(sortTeamBySelectableOrder(rows))
  }, [])

  const loadMealsForDate = useCallback(
    async (d: string) => {
      const { data, error: err } = await supabase
        .from('office_meal_log')
        .select('employee_email')
        .eq('meal_date', d)
      if (err) {
        console.error(err)
        setError(t('officeMealLoadError'))
        return
      }
      setError(null)
      setMealEmails(
        new Set(
          (data || [])
            .map((r: { employee_email: string }) => r.employee_email)
            .filter((em) => isOfficeMealSelectableEmail(em))
        )
      )
    },
    [t]
  )

  const loadSummary = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('office_meal_log')
      .select('employee_email')
      .gte('meal_date', summaryStart)
      .lte('meal_date', summaryEnd)
    if (err) {
      console.error(err)
      return
    }
    const counts: Record<string, number> = {}
    for (const row of data || []) {
      const em = (row as { employee_email: string }).employee_email
      if (!isOfficeMealSelectableEmail(em)) continue
      counts[em] = (counts[em] || 0) + 1
    }
    setMealCounts(counts)
  }, [summaryStart, summaryEnd])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    ;(async () => {
      setTeamLoading(true)
      await loadTeam()
      if (!cancelled) setTeamLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen, loadTeam])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    ;(async () => {
      setMealsLoading(true)
      await Promise.all([loadMealsForDate(mealDate), loadSummary()])
      if (!cancelled) setMealsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen, mealDate, loadMealsForDate, loadSummary])

  useEffect(() => {
    if (isOpen) {
      setMealDate(lasVegasTodayYmd())
    }
  }, [isOpen])

  const displayName = (m: TeamRow) =>
    (m.display_name || m.name_ko || m.email.split('@')[0]).trim()

  const toggle = async (email: string, nextChecked: boolean) => {
    setSavingEmail(email)
    setError(null)
    try {
      if (nextChecked) {
        const { error: upErr } = await supabase
          .from('office_meal_log')
          .upsert({ meal_date: mealDate, employee_email: email }, { onConflict: 'meal_date,employee_email' })
        if (upErr) throw upErr
        setMealEmails((prev) => new Set(prev).add(email))
      } else {
        const { error: delErr } = await supabase
          .from('office_meal_log')
          .delete()
          .eq('meal_date', mealDate)
          .eq('employee_email', email)
        if (delErr) throw delErr
        setMealEmails((prev) => {
          const n = new Set(prev)
          n.delete(email)
          return n
        })
      }
      await loadSummary()
    } catch (e) {
      console.error(e)
      setError(t('officeMealSaveError'))
    } finally {
      setSavingEmail(null)
    }
  }

  const sortedSummary = useMemo(() => {
    return team
      .map((m) => ({ ...m, count: mealCounts[m.email] || 0 }))
      .filter((m) => m.count > 0)
      .sort((a, b) => b.count - a.count || displayName(a).localeCompare(displayName(b), 'ko'))
  }, [team, mealCounts])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="office-meal-modal-title"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-xl shadow-xl w-full sm:max-w-lg max-h-[min(85dvh,640px)] flex flex-col border border-amber-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 shrink-0">
          <h2
            id="office-meal-modal-title"
            className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2 min-w-0"
          >
            <UtensilsCrossed className="w-5 h-5 text-amber-700 shrink-0" />
            <span className="truncate">{t('officeMealTitle')}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 shrink-0"
            aria-label={t('close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 sm:p-5">
          <p className="text-xs text-gray-600 mb-4 leading-relaxed">
            {t('officeMealPolicyNote', { date: OFFICE_MEAL_POLICY_START })}
          </p>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <label className="text-sm text-gray-700">
              {t('officeMealPickDate')}
              <input
                type="date"
                value={mealDate}
                onChange={(e) => setMealDate(e.target.value)}
                className="ml-2 px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white"
              />
            </label>
            <span className="text-xs text-gray-500">{t('officeMealLasVegasHint')}</span>
          </div>

          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

          {teamLoading && team.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-gray-600 py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('loading')}
            </div>
          ) : (
            <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
              {mealsLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 rounded-md">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
                </div>
              )}
              {team.map((m) => {
                const checked = mealEmails.has(m.email)
                const busy = savingEmail === m.email
                return (
                  <label
                    key={m.email}
                    className="flex items-center gap-2 text-sm bg-amber-50/50 border border-amber-100 rounded-md px-3 py-2 cursor-pointer hover:bg-amber-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={busy || mealsLoading}
                      onChange={(e) => toggle(m.email, e.target.checked)}
                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="truncate font-medium text-gray-800">{displayName(m)}</span>
                    {busy && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 ml-auto text-amber-600" />}
                  </label>
                )
              })}
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-amber-200/80">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              {t('officeMealTwoWeekTitle', { start: summaryStart, end: summaryEnd })}
            </h3>
            {sortedSummary.length === 0 ? (
              <p className="text-xs text-gray-500">{t('officeMealTwoWeekEmpty')}</p>
            ) : (
              <ul className="text-sm space-y-1 max-h-36 overflow-y-auto">
                {sortedSummary.map((m) => (
                  <li key={m.email} className="flex justify-between gap-2 text-gray-800">
                    <span className="truncate">{displayName(m)}</span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {t('officeMealCountTimes', { n: m.count })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
