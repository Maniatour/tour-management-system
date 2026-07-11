'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { CalendarClock, Briefcase, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Eraser, Eye, EyeOff, History, Loader2, Redo2, Save, Undo2, X } from 'lucide-react'
import dayjs from 'dayjs'
import { OFFICE_SCHEDULE_COPY as C } from '@/lib/officeScheduleCopy'
import {
  clearStaffColorOverride,
  readStaffColorOverrides,
  setStaffColorOverride,
  type StaffColorOverrides,
} from '@/lib/officeScheduleColorPrefs'
import { supabase } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import {
  buildOfficeScheduleMonthDays,
  buildOfficeScheduleTimeRows,
  officeScheduleCellKey,
  officeScheduleSlotKey,
} from '@/lib/officeScheduleMonthDays'
import {
  buildStaffColorMap,
  cellBackgroundForEmails,
  cellLabelForEmails,
  type StaffColor,
} from '@/lib/officeScheduleColors'
import {
  computeStaffHoursSummaries,
  computeDailyHoursTotals,
  computeDailyPayTotals,
  computeStaffPaySummaries,
  formatDailyPayAmount,
  formatHourlyRateLabel,
  formatScheduledDays,
  getScheduleLoadRange,
  sumStaffHoursSummaries,
  sumStaffPaySummaries,
} from '@/lib/officeScheduleStats'
import {
  buildOfficeScheduleSavePayload,
  saveOfficeScheduleBatch,
  scheduleDraftsEqual,
} from '@/lib/officeScheduleSave'
import {
  cellsInPaintRectangle,
  paintCellId,
  type PaintCellCoord,
} from '@/lib/officeSchedulePaintRange'
import { pushScheduleUndoSnapshot, type ScheduleSnapshot } from '@/lib/officeScheduleUndo'
import {
  buildOffDaysByDate,
  cloneOffDayMap,
  officeScheduleOffDayKey,
  offDatesForEmployee,
  removeSlotsForEmployeeOnDate,
  type OffDayMap,
} from '@/lib/officeScheduleOffDays'
import { fetchEmployeeHourlyRatePeriods, getHourlyRateForEmployeeOnDate, type EmployeeRatePeriod } from '@/lib/employeeHourlyRates'
import OfficeScheduleHistoryPanel from '@/components/attendance/OfficeScheduleHistoryPanel'
import OfficeScheduleEmployeeSettingsModal from '@/components/attendance/OfficeScheduleEmployeeSettingsModal'
import {
  computeFullTimeMonthlyMinimum,
  formatMonthlyMinimum,
  getEmployeeSettings,
  type OfficeScheduleEmployeeSettings,
} from '@/lib/officeScheduleEmployeeSettings'
import {
  batchShiftTimeLabel,
  buildBatchShiftSlotKeys,
  countNewBatchShiftSlots,
  type OfficeBatchShift,
} from '@/lib/officeScheduleBatchShift'

type TeamRow = {
  email: string
  name_en: string | null
  display_name: string | null
  position: string | null
}

type SlotRow = {
  employee_email: string
  schedule_date: string
  hour_slot: number
  note: string | null
}

type OffDayRow = {
  employee_email: string
  schedule_date: string
  note: string | null
}

type SlotMap = Map<string, { note: string | null }>
type Brush = string | 'eraser' | null

interface OfficeScheduleModalProps {
  isOpen: boolean
  onClose: () => void
  initialMonth?: string
  canEditAll?: boolean
  isSuper?: boolean
  currentUserEmail?: string
}

const TIME_COL_PX = 56
const FIXED_SIDE_COLUMNS_PX = TIME_COL_PX * 2
const DAY_COL_MIN_PX = 30
const MOBILE_TAP_MOVE_THRESHOLD_PX = 12

const OFFICE_SCHEDULE_STAFF_ORDER = ['judy', 'hana', 'somi', 'mike'] as const

function scheduleStaffSortLabel(m: TeamRow): string {
  return (m.display_name || m.name_en || m.email.split('@')[0]).trim().toLowerCase()
}

function scheduleStaffOrderIndex(m: TeamRow): number {
  const label = scheduleStaffSortLabel(m)
  const first = label.split(/\s+/)[0] ?? label
  const email = m.email.trim().toLowerCase()
  const idx = OFFICE_SCHEDULE_STAFF_ORDER.findIndex(
    (key) => first === key || label.startsWith(`${key} `) || email.includes(key)
  )
  return idx >= 0 ? idx : OFFICE_SCHEDULE_STAFF_ORDER.length
}

function filterAndSortOfficeScheduleTeam(rows: TeamRow[]): TeamRow[] {
  return rows
    .filter((m) => !m.email.trim().toLowerCase().includes('vegasmaniatour'))
    .sort((a, b) => {
      const orderDiff = scheduleStaffOrderIndex(a) - scheduleStaffOrderIndex(b)
      if (orderDiff !== 0) return orderDiff
      return scheduleStaffSortLabel(a).localeCompare(scheduleStaffSortLabel(b))
    })
}

function displayName(m: TeamRow): string {
  return (m.display_name || m.name_en || m.email.split('@')[0]).trim()
}

function shortDateLabel(dateString: string): string {
  const d = dayjs(dateString)
  return `${d.month() + 1}/${d.date()}`
}

function cloneSlotMap(map: SlotMap): SlotMap {
  return new Map(map)
}

function buildCurrentSnapshot(slots: SlotMap, offDays: OffDayMap): ScheduleSnapshot {
  return { slots: cloneSlotMap(slots), offDays: cloneOffDayMap(offDays) }
}

function cellsInOffPaintRange(
  from: { date: string },
  to: { date: string },
  monthDates: string[]
): { date: string }[] {
  const fromIdx = monthDates.indexOf(from.date)
  const toIdx = monthDates.indexOf(to.date)
  if (fromIdx < 0 || toIdx < 0) return []
  const min = Math.min(fromIdx, toIdx)
  const max = Math.max(fromIdx, toIdx)
  return monthDates.slice(min, max + 1).map((date) => ({ date }))
}

function buildCellStaffMap(slotMap: SlotMap): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const [key] of slotMap) {
    const [email, date, hourStr] = key.split('|')
    const hour = Number(hourStr)
    const cellKey = officeScheduleCellKey(date, hour)
    const list = map.get(cellKey) ?? []
    list.push(email)
    map.set(cellKey, list)
  }
  return map
}

function ScheduleStatsPeriodCell({
  label,
  labelTitle,
  hours,
  days,
  pay,
  highlight = false,
  monthlyMin,
}: {
  label: string
  labelTitle?: string
  hours: number
  days: number
  pay?: number | undefined
  highlight?: boolean
  monthlyMin?: { minDays: number; minHours: number } | undefined
}) {
  const belowMin =
    monthlyMin != null && (days < monthlyMin.minDays || hours < monthlyMin.minHours)

  return (
    <div
      className={`rounded-md border px-1 py-1 text-center min-w-0 max-lg:flex max-lg:items-center max-lg:justify-between max-lg:gap-2 max-lg:px-2.5 max-lg:py-1.5 max-lg:text-left ${
        highlight ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-100'
      }`}
    >
      <p
        className={`text-[9px] font-medium leading-tight mb-0.5 truncate max-lg:mb-0 max-lg:text-[10px] max-lg:shrink-0 ${
          highlight ? 'text-indigo-600' : 'text-gray-500'
        }`}
        title={labelTitle ?? label}
      >
        {label}
      </p>
      <div className="max-lg:flex max-lg:items-center max-lg:gap-2.5 max-lg:shrink-0">
        <p
          className={`text-xs font-bold tabular-nums leading-tight ${
            highlight ? 'text-indigo-700' : 'text-slate-800'
          }`}
        >
          {hours}h
        </p>
        <p
          className={`text-[9px] font-semibold tabular-nums ${
            highlight ? 'text-indigo-600/80' : 'text-gray-600'
          }`}
          title={C.statsScheduledDays}
        >
          {formatScheduledDays(days)}
        </p>
        {monthlyMin != null && (
          <p
            className={`text-[8px] font-medium tabular-nums max-lg:mt-0 mt-0.5 leading-tight ${
              belowMin ? 'text-rose-600' : 'text-emerald-700'
            }`}
            title={C.employeeSettingsMonthlyMin}
          >
            {formatMonthlyMinimum(monthlyMin.minDays, monthlyMin.minHours)}
          </p>
        )}
        {pay != null && (
          <p className="text-[9px] font-bold text-amber-800 tabular-nums max-lg:mt-0 mt-0.5">
            {formatDailyPayAmount(pay)}
          </p>
        )}
      </div>
    </div>
  )
}

type StrokeMode = 'add' | 'remove'

export default function OfficeScheduleModal({
  isOpen,
  onClose,
  initialMonth,
  canEditAll = false,
  isSuper = false,
  currentUserEmail = '',
}: OfficeScheduleModalProps) {
  const [currentMonth, setCurrentMonth] = useState(() => initialMonth || dayjs().format('YYYY-MM'))
  const [team, setTeam] = useState<TeamRow[]>([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedSlotMap, setSavedSlotMap] = useState<SlotMap>(new Map())
  const [draftSlotMap, setDraftSlotMap] = useState<SlotMap>(new Map())
  const [savedOffDayMap, setSavedOffDayMap] = useState<OffDayMap>(new Map())
  const [draftOffDayMap, setDraftOffDayMap] = useState<OffDayMap>(new Map())
  const [colorOverrides, setColorOverrides] = useState<StaffColorOverrides>({})
  const [activeBrush, setActiveBrush] = useState<Brush>(null)
  const [statsTick, setStatsTick] = useState(0)
  const [undoStack, setUndoStack] = useState<ScheduleSnapshot[]>([])
  const [redoStack, setRedoStack] = useState<ScheduleSnapshot[]>([])
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isEmployeeSettingsOpen, setIsEmployeeSettingsOpen] = useState(false)
  const [mobileStatsOpen, setMobileStatsOpen] = useState(false)
  const [mobileStaffOpen, setMobileStaffOpen] = useState(false)
  const [hiddenStaffEmails, setHiddenStaffEmails] = useState<Set<string>>(() => new Set())
  const [ratePeriods, setRatePeriods] = useState<EmployeeRatePeriod[]>([])
  const [employeeSettingsMap, setEmployeeSettingsMap] = useState<
    Map<string, OfficeScheduleEmployeeSettings>
  >(() => new Map())

  const draftSlotMapRef = useRef<SlotMap>(new Map())
  const draftOffDayMapRef = useRef<OffDayMap>(new Map())
  const cellStaffMapRef = useRef<Map<string, string[]>>(new Map())
  const activeBrushRef = useRef<Brush>(null)
  const isPaintingRef = useRef(false)
  const strokeBeforeRef = useRef<ScheduleSnapshot | null>(null)
  const strokeModeRef = useRef<StrokeMode | null>(null)
  const lastPaintedPosRef = useRef<PaintCellCoord | null>(null)
  const lastPaintedOffDateRef = useRef<string | null>(null)
  const isPaintingOffRef = useRef(false)
  const offDayBlockAlertShownRef = useRef(false)
  const monthDateStringsRef = useRef<string[]>([])
  const paintRafRef = useRef<number | null>(null)
  const pointerCaptureTargetRef = useRef<HTMLElement | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const touchTapPendingRef = useRef<{
    pointerId: number
    x: number
    y: number
    date: string
    hourSlot: number | null
  } | null>(null)
  const canEditAllRef = useRef(canEditAll)
  const currentUserEmailRef = useRef(currentUserEmail)

  useEffect(() => {
    activeBrushRef.current = activeBrush
  }, [activeBrush])

  useEffect(() => {
    canEditAllRef.current = canEditAll
    currentUserEmailRef.current = currentUserEmail
  }, [canEditAll, currentUserEmail])

  const monthDays = useMemo(() => buildOfficeScheduleMonthDays(currentMonth, 'en'), [currentMonth])
  const timeRows = useMemo(() => buildOfficeScheduleTimeRows('en'), [])

  useEffect(() => {
    monthDateStringsRef.current = monthDays.map((d) => d.dateString)
  }, [monthDays])

  const [isCompactScheduleTable, setIsCompactScheduleTable] = useState(false)

  const isDirty = useMemo(
    () =>
      !scheduleDraftsEqual(savedSlotMap, draftSlotMap, savedOffDayMap, draftOffDayMap),
    [savedSlotMap, draftSlotMap, savedOffDayMap, draftOffDayMap]
  )

  const scheduleTimeColumnCount = isCompactScheduleTable ? 1 : 2
  const scheduleSideColumnsPx = isCompactScheduleTable ? TIME_COL_PX : FIXED_SIDE_COLUMNS_PX

  const dynamicMinTableWidthPx = useMemo(
    () => scheduleSideColumnsPx + monthDays.length * DAY_COL_MIN_PX,
    [monthDays.length, scheduleSideColumnsPx]
  )

  const bodyScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 1023px)')
    const update = () => setIsCompactScheduleTable(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const endStroke = () => {
      if (!isPaintingRef.current) return
      isPaintingRef.current = false
      isPaintingOffRef.current = false
      offDayBlockAlertShownRef.current = false
      strokeModeRef.current = null
      lastPaintedPosRef.current = null
      if (pointerCaptureTargetRef.current && activePointerIdRef.current != null) {
        try {
          pointerCaptureTargetRef.current.releasePointerCapture(activePointerIdRef.current)
        } catch {
          /* already released */
        }
      }
      pointerCaptureTargetRef.current = null
      activePointerIdRef.current = null
      if (paintRafRef.current != null) {
        cancelAnimationFrame(paintRafRef.current)
        paintRafRef.current = null
      }

      const before = strokeBeforeRef.current
      strokeBeforeRef.current = null
      if (
        before &&
        !scheduleDraftsEqual(
          before.slots,
          draftSlotMapRef.current,
          before.offDays,
          draftOffDayMapRef.current
        )
      ) {
        setUndoStack((stack) => pushScheduleUndoSnapshot(stack, before))
        setRedoStack([])
      }

      setDraftSlotMap(cloneSlotMap(draftSlotMapRef.current))
      setDraftOffDayMap(cloneOffDayMap(draftOffDayMapRef.current))
      setSaveSuccess(false)
      setStatsTick((n) => n + 1)
    }
    window.addEventListener('mouseup', endStroke)
    window.addEventListener('pointerup', endStroke)
    return () => {
      window.removeEventListener('mouseup', endStroke)
      window.removeEventListener('pointerup', endStroke)
    }
  }, [])

  useEffect(() => {
    if (isOpen) setColorOverrides(readStaffColorOverrides())
  }, [isOpen])

  const loadTeam = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('team')
      .select('email, name_en, display_name, position')
      .eq('is_active', true)
      .or('position.ilike.op,position.ilike.office manager')
      .order('name_en')
    if (err) {
      console.error(err)
      setError(C.loadError)
      return
    }
    setTeam(filterAndSortOfficeScheduleTeam((data || []) as TeamRow[]))
  }, [])

  const loadSlots = useCallback(async () => {
    const { from, to } = getScheduleLoadRange(monthDays)
    if (!from || !to) return
    const [slotsResult, offDaysResult] = await Promise.all([
      fromUntypedTable(supabase, 'office_schedule_slots')
        .select('employee_email, schedule_date, hour_slot, note')
        .gte('schedule_date', from)
        .lte('schedule_date', to),
      fromUntypedTable(supabase, 'office_schedule_off_days')
        .select('employee_email, schedule_date, note')
        .gte('schedule_date', from)
        .lte('schedule_date', to),
    ])
    if (slotsResult.error || offDaysResult.error) {
      console.error(slotsResult.error ?? offDaysResult.error)
      setError(C.loadError)
      return
    }
    setError(null)
    const next = new Map<string, { note: string | null }>()
    for (const row of (slotsResult.data || []) as SlotRow[]) {
      const date =
        typeof row.schedule_date === 'string'
          ? row.schedule_date.slice(0, 10)
          : String(row.schedule_date)
      const key = officeScheduleSlotKey(row.employee_email, date, row.hour_slot)
      next.set(key, { note: row.note })
    }
    const nextOffDays = new Map<string, { note: string | null }>()
    for (const row of (offDaysResult.data || []) as OffDayRow[]) {
      const date =
        typeof row.schedule_date === 'string'
          ? row.schedule_date.slice(0, 10)
          : String(row.schedule_date)
      const key = officeScheduleOffDayKey(row.employee_email, date)
      nextOffDays.set(key, { note: row.note })
    }
    setSavedSlotMap(next)
    setDraftSlotMap(cloneSlotMap(next))
    draftSlotMapRef.current = cloneSlotMap(next)
    setSavedOffDayMap(nextOffDays)
    setDraftOffDayMap(cloneOffDayMap(nextOffDays))
    draftOffDayMapRef.current = cloneOffDayMap(nextOffDays)
    cellStaffMapRef.current = buildCellStaffMap(next)
    setUndoStack([])
    setRedoStack([])
    setSaveSuccess(false)
    setStatsTick((n) => n + 1)
  }, [monthDays])

  useEffect(() => {
    if (!isOpen) {
      setActiveBrush(null)
      setHiddenStaffEmails(new Set())
      setUndoStack([])
      setRedoStack([])
      strokeBeforeRef.current = null
      isPaintingRef.current = false
      setMobileStatsOpen(false)
      setMobileStaffOpen(false)
      return
    }
    if (team.length === 0 || activeBrush !== null) return
    const self = team.find(
      (r) => r.email.trim().toLowerCase() === currentUserEmail.trim().toLowerCase()
    )
    setActiveBrush(self?.email ?? team[0].email)
  }, [isOpen, team, activeBrush, currentUserEmail])

  useEffect(() => {
    if (!isOpen) return
    if (initialMonth) setCurrentMonth(initialMonth)
  }, [isOpen, initialMonth])

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
      setSlotsLoading(true)
      await loadSlots()
      if (!cancelled) setSlotsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen, loadSlots])

  useEffect(() => {
    if (!isOpen || !isSuper) {
      setRatePeriods([])
      return
    }
    let cancelled = false
    ;(async () => {
      const data = await fetchEmployeeHourlyRatePeriods(supabase)
      if (!cancelled) setRatePeriods(data)
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen, isSuper])

  const handleEmployeeSettingsChange = useCallback(
    (map: Map<string, OfficeScheduleEmployeeSettings>) => {
      setEmployeeSettingsMap(map)
    },
    []
  )

  const staffColorMap = useMemo(
    () =>
      buildStaffColorMap(
        team.map((m) => m.email),
        (email) => {
          const m = team.find((r) => r.email === email)
          return m ? displayName(m) : email.split('@')[0]
        },
        colorOverrides
      ),
    [team, colorOverrides]
  )

  const staffStats = useMemo(
    () =>
      computeStaffHoursSummaries(
        draftSlotMapRef.current.keys(),
        team.map((m) => m.email),
        currentMonth
      ),
    [draftSlotMap, team, currentMonth, statsTick]
  )

  const totalStats = useMemo(() => sumStaffHoursSummaries(staffStats), [staffStats])

  const totalPayStats = useMemo(
    () =>
      sumStaffPaySummaries(
        computeStaffPaySummaries(
          draftSlotMapRef.current.keys(),
          team.map((m) => m.email),
          currentMonth,
          ratePeriods,
          hiddenStaffEmails
        )
      ),
    [draftSlotMap, team, currentMonth, statsTick, hiddenStaffEmails, ratePeriods]
  )

  const dailyHoursByDate = useMemo(
    () =>
      computeDailyHoursTotals(
        draftSlotMapRef.current.keys(),
        team.map((m) => m.email),
        monthDays.map((d) => d.dateString),
        hiddenStaffEmails
      ),
    [draftSlotMap, team, monthDays, statsTick, hiddenStaffEmails]
  )

  const visibleStaffStats = useMemo(() => {
    if (hiddenStaffEmails.size === 0) return staffStats
    return staffStats.filter((row) => !hiddenStaffEmails.has(row.email.trim().toLowerCase()))
  }, [staffStats, hiddenStaffEmails])

  const fullTimeMonthlyMinByEmail = useMemo(() => {
    const map = new Map<string, { minDays: number; minHours: number }>()
    for (const member of team) {
      const settings = getEmployeeSettings(employeeSettingsMap, member.email)
      if (settings.employment_type === 'full_time') {
        map.set(
          member.email.trim().toLowerCase(),
          computeFullTimeMonthlyMinimum(currentMonth, settings.rest_days)
        )
      }
    }
    return map
  }, [team, employeeSettingsMap, currentMonth])

  const offDaysByDate = useMemo(() => buildOffDaysByDate(draftOffDayMap), [draftOffDayMap])

  const filterEmailsForView = useCallback(
    (emails: string[]): string[] => {
      if (hiddenStaffEmails.size === 0) return emails
      return emails.filter((e) => !hiddenStaffEmails.has(e.trim().toLowerCase()))
    },
    [hiddenStaffEmails]
  )

  const dailyPayByDate = useMemo(
    () =>
      computeDailyPayTotals(
        draftSlotMapRef.current.keys(),
        team.map((m) => m.email),
        monthDays.map((d) => d.dateString),
        ratePeriods,
        hiddenStaffEmails
      ),
    [draftSlotMap, team, monthDays, statsTick, hiddenStaffEmails, ratePeriods]
  )

  const toggleStaffVisibility = useCallback((email: string) => {
    const norm = email.trim().toLowerCase()
    setHiddenStaffEmails((prev) => {
      const next = new Set(prev)
      if (next.has(norm)) next.delete(norm)
      else next.add(norm)
      return next
    })
  }, [])

  const getCellEmails = useCallback((date: string, hourSlot: number): string[] => {
    const cellKey = officeScheduleCellKey(date, hourSlot)
    return cellStaffMapRef.current.get(cellKey) ?? []
  }, [])

  const isOffDayForBrush = useCallback((date: string): boolean => {
    const brush = activeBrushRef.current
    if (!brush || brush === 'eraser') return false
    return draftOffDayMapRef.current.has(officeScheduleOffDayKey(brush, date))
  }, [])

  const showOffDayScheduleBlocked = useCallback(
    (date: string) => {
      if (offDayBlockAlertShownRef.current) return
      offDayBlockAlertShownRef.current = true
      const brush = activeBrushRef.current
      if (!brush || brush === 'eraser') return
      const member = team.find((m) => m.email === brush)
      const name = member ? displayName(member) : brush.split('@')[0]
      const dateLabel = shortDateLabel(date)
      window.alert(
        C.offDayScheduleBlocked.replace('{name}', name).replace('{date}', dateLabel)
      )
    },
    [team]
  )

  const resolveStrokeMode = useCallback((date: string, hourSlot: number): StrokeMode | null => {
    const brush = activeBrushRef.current
    if (!brush) return null
    if (brush === 'eraser') return 'remove'

    const email = brush
    const normalized = email.trim().toLowerCase()
    const has = getCellEmails(date, hourSlot).some((e) => e.trim().toLowerCase() === normalized)
    return has ? 'remove' : 'add'
  }, [getCellEmails])

  const mutateCell = useCallback(
    (date: string, hourSlot: number, mode: StrokeMode): boolean => {
      const brush = activeBrushRef.current
      if (!brush) return false

      const draft = draftSlotMapRef.current
      const cellKey = officeScheduleCellKey(date, hourSlot)
      let changed = false

      if (mode === 'remove') {
        const toRemove =
          brush === 'eraser'
            ? (cellStaffMapRef.current.get(cellKey) ?? []).filter(
                (e) =>
                  canEditAllRef.current ||
                  e.trim().toLowerCase() === currentUserEmailRef.current.trim().toLowerCase()
              )
            : (cellStaffMapRef.current.get(cellKey) ?? []).filter(
                (e) => e.trim().toLowerCase() === brush.trim().toLowerCase()
              )

        if (!canEditAllRef.current && brush !== 'eraser') {
          if (brush.trim().toLowerCase() !== currentUserEmailRef.current.trim().toLowerCase()) {
            return false
          }
        }

        for (const email of toRemove) {
          if (
            !canEditAllRef.current &&
            email.trim().toLowerCase() !== currentUserEmailRef.current.trim().toLowerCase()
          ) {
            continue
          }
          const slotKey = officeScheduleSlotKey(email, date, hourSlot)
          if (draft.delete(slotKey)) changed = true
        }

        if (changed) {
          const rebuilt: string[] = []
          for (const [key] of draft) {
            const [em, d, h] = key.split('|')
            if (d === date && Number(h) === hourSlot) rebuilt.push(em)
          }
          cellStaffMapRef.current.set(cellKey, rebuilt)
        }
        return changed
      }

      const email = brush
      if (
        !canEditAllRef.current &&
        email.trim().toLowerCase() !== currentUserEmailRef.current.trim().toLowerCase()
      ) {
        return false
      }

      const normalized = email.trim().toLowerCase()
      const already = (cellStaffMapRef.current.get(cellKey) ?? []).some(
        (e) => e.trim().toLowerCase() === normalized
      )
      if (already) return false

      const offKey = officeScheduleOffDayKey(email, date)
      if (draftOffDayMapRef.current.has(offKey)) {
        return false
      }

      const slotKey = officeScheduleSlotKey(email, date, hourSlot)
      draft.set(slotKey, { note: null })
      const list = cellStaffMapRef.current.get(cellKey) ?? []
      cellStaffMapRef.current.set(cellKey, [...list, email])
      return true
    },
    []
  )

  const getOffEmailsForDate = useCallback((date: string): string[] => {
    const emails: string[] = []
    for (const [key] of draftOffDayMapRef.current) {
      const [, d] = key.split('|')
      if (d === date) emails.push(key.split('|')[0])
    }
    return emails
  }, [])

  const resolveOffStrokeMode = useCallback((date: string): StrokeMode | null => {
    const brush = activeBrushRef.current
    if (!brush) return null
    if (brush === 'eraser') return 'remove'

    const email = brush
    const offKey = officeScheduleOffDayKey(email, date)
    return draftOffDayMapRef.current.has(offKey) ? 'remove' : 'add'
  }, [])

  const mutateOffDay = useCallback((date: string, mode: StrokeMode): boolean => {
    const brush = activeBrushRef.current
    if (!brush) return false

    const draftOff = draftOffDayMapRef.current
    const draft = draftSlotMapRef.current
    let changed = false

    if (mode === 'remove') {
      const toRemove =
        brush === 'eraser'
          ? getOffEmailsForDate(date).filter(
              (e) =>
                canEditAllRef.current ||
                e.trim().toLowerCase() === currentUserEmailRef.current.trim().toLowerCase()
            )
          : [brush]

      if (!canEditAllRef.current && brush !== 'eraser') {
        if (brush.trim().toLowerCase() !== currentUserEmailRef.current.trim().toLowerCase()) {
          return false
        }
      }

      for (const email of toRemove) {
        if (
          !canEditAllRef.current &&
          email.trim().toLowerCase() !== currentUserEmailRef.current.trim().toLowerCase()
        ) {
          continue
        }
        const offKey = officeScheduleOffDayKey(email, date)
        if (draftOff.delete(offKey)) changed = true
      }
      return changed
    }

    const email = brush
    if (
      !canEditAllRef.current &&
      email.trim().toLowerCase() !== currentUserEmailRef.current.trim().toLowerCase()
    ) {
      return false
    }

    const offKey = officeScheduleOffDayKey(email, date)
    if (draftOff.has(offKey)) return false

    draftOff.set(offKey, { note: null })
    if (removeSlotsForEmployeeOnDate(draft, email, date)) {
      cellStaffMapRef.current = buildCellStaffMap(draft)
    }
    return true
  }, [getOffEmailsForDate])

  const flushDraftRender = useCallback(() => {
    if (paintRafRef.current != null) {
      cancelAnimationFrame(paintRafRef.current)
      paintRafRef.current = null
    }
    setDraftSlotMap(cloneSlotMap(draftSlotMapRef.current))
    setDraftOffDayMap(cloneOffDayMap(draftOffDayMapRef.current))
    setSaveSuccess(false)
  }, [])

  const scheduleDraftRender = useCallback(() => {
    if (paintRafRef.current != null) return
    paintRafRef.current = requestAnimationFrame(() => {
      paintRafRef.current = null
      setDraftSlotMap(cloneSlotMap(draftSlotMapRef.current))
      setDraftOffDayMap(cloneOffDayMap(draftOffDayMapRef.current))
      setSaveSuccess(false)
    })
  }, [])

  const paintOffDates = useCallback(
    (dates: string[], isStrokeStart: boolean) => {
      const brush = activeBrushRef.current
      if (!brush) return
      if (brush !== 'eraser' && !canEditAllRef.current) {
        if (brush.trim().toLowerCase() !== currentUserEmailRef.current.trim().toLowerCase()) return
      }

      let mode = strokeModeRef.current
      if (isStrokeStart || mode == null) {
        const first = dates[0]
        if (!first) return
        mode = resolveOffStrokeMode(first)
        if (!mode) return
        strokeModeRef.current = mode
      }

      let changed = false
      for (const date of dates) {
        if (mutateOffDay(date, mode)) changed = true
      }

      if (changed) {
        if (isPaintingRef.current) flushDraftRender()
        else scheduleDraftRender()
      }
    },
    [flushDraftRender, mutateOffDay, resolveOffStrokeMode, scheduleDraftRender]
  )

  const paintOffStrokeTo = useCallback(
    (date: string, isStrokeStart: boolean) => {
      if (isStrokeStart) {
        lastPaintedOffDateRef.current = date
        paintOffDates([date], true)
        return
      }

      const last = lastPaintedOffDateRef.current
      if (!last) {
        lastPaintedOffDateRef.current = date
        paintOffDates([date], false)
        return
      }

      if (last === date) return

      const dates = cellsInOffPaintRange({ date: last }, { date }, monthDateStringsRef.current).map(
        (c) => c.date
      )
      lastPaintedOffDateRef.current = date
      paintOffDates(dates, false)
    },
    [paintOffDates]
  )

  const paintOffStrokeToRef = useRef(paintOffStrokeTo)
  paintOffStrokeToRef.current = paintOffStrokeTo

  const paintCells = useCallback(
    (cells: PaintCellCoord[], isStrokeStart: boolean) => {
      const brush = activeBrushRef.current
      if (!brush) return
      if (brush !== 'eraser' && !canEditAllRef.current) {
        if (brush.trim().toLowerCase() !== currentUserEmailRef.current.trim().toLowerCase()) return
      }

      let mode = strokeModeRef.current
      if (isStrokeStart || mode == null) {
        const first = cells[0]
        if (!first) return
        mode = resolveStrokeMode(first.date, first.hourSlot)
        if (!mode) return
        strokeModeRef.current = mode
      }

      let changed = false
      for (const { date, hourSlot } of cells) {
        if (mode === 'add' && isOffDayForBrush(date)) {
          showOffDayScheduleBlocked(date)
          continue
        }
        if (mutateCell(date, hourSlot, mode)) changed = true
      }

      if (changed) {
        if (isPaintingRef.current) flushDraftRender()
        else scheduleDraftRender()
      }
    },
    [flushDraftRender, isOffDayForBrush, mutateCell, resolveStrokeMode, scheduleDraftRender, showOffDayScheduleBlocked]
  )

  const paintStrokeTo = useCallback(
    (coord: PaintCellCoord, isStrokeStart: boolean) => {
      if (isStrokeStart) {
        lastPaintedPosRef.current = coord
        paintCells([coord], true)
        return
      }

      const last = lastPaintedPosRef.current
      if (!last) {
        lastPaintedPosRef.current = coord
        paintCells([coord], false)
        return
      }

      if (paintCellId(last.date, last.hourSlot) === paintCellId(coord.date, coord.hourSlot)) {
        return
      }

      const cells = cellsInPaintRectangle(last, coord, monthDateStringsRef.current)
      lastPaintedPosRef.current = coord
      paintCells(cells, false)
    },
    [paintCells]
  )

  const paintStrokeToRef = useRef(paintStrokeTo)
  paintStrokeToRef.current = paintStrokeTo

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (!isPaintingRef.current) return
      const el = document.elementFromPoint(e.clientX, e.clientY)
      if (isPaintingOffRef.current) {
        const offCell = el?.closest('[data-off-cell]') as HTMLElement | null
        if (!offCell) return
        const date = offCell.dataset.date
        if (!date) return
        paintOffStrokeToRef.current(date, false)
        return
      }
      const cell = el?.closest('[data-schedule-cell]') as HTMLElement | null
      if (!cell) return
      const date = cell.dataset.date
      const hourSlot = Number(cell.dataset.hour)
      if (!date || !Number.isFinite(hourSlot)) return
      paintStrokeToRef.current({ date, hourSlot }, false)
    }
    document.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => document.removeEventListener('pointermove', onPointerMove)
  }, [])

  const canEditCell = useCallback(
    (email: string) => {
      if (canEditAll) return true
      return email.trim().toLowerCase() === currentUserEmail.trim().toLowerCase()
    },
    [canEditAll, currentUserEmail]
  )

  const canPaintCell = useCallback(() => {
    const brush = activeBrushRef.current
    if (!brush) return false
    if (brush === 'eraser') return canEditAllRef.current || Boolean(currentUserEmailRef.current)
    return canEditCell(brush)
  }, [canEditCell])

  const canSave = useMemo(() => {
    if (!isDirty || saving) return false
    if (canEditAll) return true
    return Boolean(currentUserEmail)
  }, [isDirty, saving, canEditAll, currentUserEmail])

  const cellStaffMap = useMemo(() => buildCellStaffMap(draftSlotMap), [draftSlotMap])

  const canUndo = undoStack.length > 0
  const canRedo = redoStack.length > 0

  const applyDraftSnapshot = useCallback((snapshot: ScheduleSnapshot) => {
    const nextSlots = cloneSlotMap(snapshot.slots)
    const nextOffDays = cloneOffDayMap(snapshot.offDays)
    draftSlotMapRef.current = nextSlots
    draftOffDayMapRef.current = nextOffDays
    cellStaffMapRef.current = buildCellStaffMap(nextSlots)
    setDraftSlotMap(cloneSlotMap(nextSlots))
    setDraftOffDayMap(cloneOffDayMap(nextOffDays))
    setSaveSuccess(false)
    setStatsTick((n) => n + 1)
  }, [])

  const handleUndo = useCallback(() => {
    if (isPaintingRef.current || undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    setRedoStack((stack) =>
      pushScheduleUndoSnapshot(stack, buildCurrentSnapshot(draftSlotMapRef.current, draftOffDayMapRef.current))
    )
    setUndoStack((stack) => stack.slice(0, -1))
    applyDraftSnapshot(prev)
  }, [undoStack, applyDraftSnapshot])

  const handleRedo = useCallback(() => {
    if (isPaintingRef.current || redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setUndoStack((stack) =>
      pushScheduleUndoSnapshot(stack, buildCurrentSnapshot(draftSlotMapRef.current, draftOffDayMapRef.current))
    )
    setRedoStack((stack) => stack.slice(0, -1))
    applyDraftSnapshot(next)
  }, [redoStack, applyDraftSnapshot])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey) || (e.key === 'Z' && e.shiftKey)) {
        e.preventDefault()
        handleRedo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, handleUndo, handleRedo])

  const startPainting = (e: React.PointerEvent, date: string, hourSlot: number) => {
    if (!canPaintCell()) return
    isPaintingOffRef.current = false
    offDayBlockAlertShownRef.current = false
    strokeBeforeRef.current = buildCurrentSnapshot(
      draftSlotMapRef.current,
      draftOffDayMapRef.current
    )
    const grid = bodyScrollRef.current
    if (grid) {
      try {
        grid.setPointerCapture(e.pointerId)
        pointerCaptureTargetRef.current = grid
        activePointerIdRef.current = e.pointerId
      } catch {
        /* ignore */
      }
    }
    isPaintingRef.current = true
    strokeModeRef.current = null
    lastPaintedPosRef.current = null
    paintStrokeTo({ date, hourSlot }, true)
  }

  const startOffPainting = (e: React.PointerEvent, date: string) => {
    if (!canPaintCell()) return
    isPaintingOffRef.current = true
    offDayBlockAlertShownRef.current = false
    strokeBeforeRef.current = buildCurrentSnapshot(
      draftSlotMapRef.current,
      draftOffDayMapRef.current
    )
    const grid = bodyScrollRef.current
    if (grid) {
      try {
        grid.setPointerCapture(e.pointerId)
        pointerCaptureTargetRef.current = grid
        activePointerIdRef.current = e.pointerId
      } catch {
        /* ignore */
      }
    }
    isPaintingRef.current = true
    strokeModeRef.current = null
    lastPaintedOffDateRef.current = null
    paintOffStrokeTo(date, true)
  }

  const finishStrokeSnapshot = useCallback(() => {
    const before = strokeBeforeRef.current
    strokeBeforeRef.current = null
    isPaintingOffRef.current = false
    if (
      before &&
      !scheduleDraftsEqual(
        before.slots,
        draftSlotMapRef.current,
        before.offDays,
        draftOffDayMapRef.current
      )
    ) {
      setUndoStack((stack) => pushScheduleUndoSnapshot(stack, before))
      setRedoStack([])
    }
    setDraftSlotMap(cloneSlotMap(draftSlotMapRef.current))
    setDraftOffDayMap(cloneOffDayMap(draftOffDayMapRef.current))
    setSaveSuccess(false)
    setStatsTick((n) => n + 1)
  }, [])

  const applyMobileTap = useCallback(
    (date: string, hourSlot: number | null) => {
      if (!canPaintCell()) return
      strokeBeforeRef.current = buildCurrentSnapshot(
        draftSlotMapRef.current,
        draftOffDayMapRef.current
      )
      offDayBlockAlertShownRef.current = false
      if (hourSlot == null) {
        isPaintingOffRef.current = true
        paintOffStrokeTo(date, true)
      } else {
        isPaintingOffRef.current = false
        paintStrokeTo({ date, hourSlot }, true)
      }
      finishStrokeSnapshot()
    },
    [canPaintCell, paintStrokeTo, paintOffStrokeTo, finishStrokeSnapshot]
  )

  const handleCellPointerDown = (e: React.PointerEvent, date: string, hourSlot: number) => {
    if (!canPaintCell()) return
    if (e.pointerType === 'touch') {
      touchTapPendingRef.current = {
        pointerId: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        date,
        hourSlot,
      }
      return
    }
    e.preventDefault()
    startPainting(e, date, hourSlot)
  }

  const handleOffCellPointerDown = (e: React.PointerEvent, date: string) => {
    if (!canPaintCell()) return
    if (e.pointerType === 'touch') {
      touchTapPendingRef.current = {
        pointerId: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        date,
        hourSlot: null,
      }
      return
    }
    e.preventDefault()
    startOffPainting(e, date)
  }

  useEffect(() => {
    const onTouchPointerMove = (e: PointerEvent) => {
      const pending = touchTapPendingRef.current
      if (!pending || pending.pointerId !== e.pointerId) return
      const dx = e.clientX - pending.x
      const dy = e.clientY - pending.y
      if (
        dx * dx + dy * dy >
        MOBILE_TAP_MOVE_THRESHOLD_PX * MOBILE_TAP_MOVE_THRESHOLD_PX
      ) {
        touchTapPendingRef.current = null
      }
    }
    const onTouchPointerUp = (e: PointerEvent) => {
      const pending = touchTapPendingRef.current
      if (!pending || pending.pointerId !== e.pointerId) return
      touchTapPendingRef.current = null
      const dx = e.clientX - pending.x
      const dy = e.clientY - pending.y
      if (
        dx * dx + dy * dy >
        MOBILE_TAP_MOVE_THRESHOLD_PX * MOBILE_TAP_MOVE_THRESHOLD_PX
      ) {
        return
      }
      applyMobileTap(pending.date, pending.hourSlot)
    }
    window.addEventListener('pointerup', onTouchPointerUp)
    window.addEventListener('pointermove', onTouchPointerMove, { passive: true })
    return () => {
      window.removeEventListener('pointerup', onTouchPointerUp)
      window.removeEventListener('pointermove', onTouchPointerMove)
    }
  }, [applyMobileTap])

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    setSaveSuccess(false)
    try {
      const { from, to } = getScheduleLoadRange(monthDays)
      const payload = buildOfficeScheduleSavePayload(
        savedSlotMap,
        draftSlotMap,
        savedOffDayMap,
        draftOffDayMap,
        canEditAll,
        currentUserEmail,
        currentMonth,
        from,
        to
      )

      if (
        payload.deletes.length === 0 &&
        payload.upserts.length === 0 &&
        payload.offDeletes.length === 0 &&
        payload.offUpserts.length === 0
      ) {
        setSavedSlotMap(cloneSlotMap(draftSlotMap))
        setSavedOffDayMap(cloneOffDayMap(draftOffDayMap))
        draftSlotMapRef.current = cloneSlotMap(draftSlotMap)
        draftOffDayMapRef.current = cloneOffDayMap(draftOffDayMap)
        cellStaffMapRef.current = buildCellStaffMap(draftSlotMap)
        setUndoStack([])
        setRedoStack([])
        setSaveSuccess(true)
        setStatsTick((n) => n + 1)
        return
      }

      await saveOfficeScheduleBatch(supabase, payload)

      setSavedSlotMap(cloneSlotMap(draftSlotMap))
      setSavedOffDayMap(cloneOffDayMap(draftOffDayMap))
      draftSlotMapRef.current = cloneSlotMap(draftSlotMap)
      draftOffDayMapRef.current = cloneOffDayMap(draftOffDayMap)
      cellStaffMapRef.current = buildCellStaffMap(draftSlotMap)
      setUndoStack([])
      setRedoStack([])
      setSaveSuccess(true)
      setStatsTick((n) => n + 1)
    } catch (e) {
      console.error(e)
      setError(C.saveError)
    } finally {
      setSaving(false)
    }
  }

  const handleHistoryRestored = useCallback(async () => {
    setUndoStack([])
    setRedoStack([])
    setSaveSuccess(false)
    await loadSlots()
  }, [loadSlots])

  const requestClose = () => {
    if (isDirty && !window.confirm(C.unsavedChanges)) return
    onClose()
  }

  const shiftMonth = (delta: number) => {
    if (isDirty && !window.confirm(C.unsavedMonthChange)) return
    setCurrentMonth((prev) => dayjs(`${prev}-01`).add(delta, 'month').format('YYYY-MM'))
  }

  const handleColorChange = (email: string, bg: string) => {
    setColorOverrides((prev) => setStaffColorOverride(email, bg, prev))
  }

  const handleColorReset = (email: string) => {
    setColorOverrides((prev) => clearStaffColorOverride(email, prev))
  }

  const monthLabel = useMemo(() => dayjs(`${currentMonth}-01`).format('MMMM YYYY'), [currentMonth])
  const viewedMonthShort = useMemo(() => dayjs(`${currentMonth}-01`).format('MMM YYYY'), [currentMonth])

  const activeBrushLabel = useMemo(() => {
    if (activeBrush === 'eraser') return C.eraser
    if (!activeBrush) return '—'
    const member = team.find((m) => m.email === activeBrush)
    return member ? displayName(member) : activeBrush.split('@')[0]
  }, [activeBrush, team])

  const selectActiveBrush = useCallback((brush: Brush) => {
    setActiveBrush(brush)
    setMobileStaffOpen(false)
  }, [])

  const applyBatchShiftFill = useCallback(
    (email: string, shift: OfficeBatchShift, restDays: number[]) => {
      if (!canEditCell(email)) return

      const member = team.find((m) => m.email === email)
      const name = member ? displayName(member) : email.split('@')[0]
      const shiftLabel =
        shift === 'first_half' ? C.employeeSettingsBatchFirstHalf : C.employeeSettingsBatchSecondHalf
      const timeLabel = batchShiftTimeLabel(shift)
      const offDates = offDatesForEmployee(draftOffDayMapRef.current, email)
      const newCount = countNewBatchShiftSlots(
        draftSlotMapRef.current,
        email,
        currentMonth,
        restDays,
        shift,
        offDates
      )

      if (newCount === 0) {
        window.alert(C.employeeSettingsBatchFillNone)
        return
      }

      const confirmed = window.confirm(
        C.employeeSettingsBatchFillConfirm.replace('{shift}', shiftLabel)
          .replace('{time}', timeLabel)
          .replace('{name}', name)
          .replace('{month}', monthLabel)
      )
      if (!confirmed) return

      const before = buildCurrentSnapshot(draftSlotMapRef.current, draftOffDayMapRef.current)
      const keys = buildBatchShiftSlotKeys(email, currentMonth, restDays, shift, offDates)
      let changed = false
      for (const key of keys) {
        if (!draftSlotMapRef.current.has(key)) {
          draftSlotMapRef.current.set(key, { note: null })
          changed = true
        }
      }

      if (!changed) return

      cellStaffMapRef.current = buildCellStaffMap(draftSlotMapRef.current)
      setUndoStack((stack) => pushScheduleUndoSnapshot(stack, before))
      setRedoStack([])
      setDraftSlotMap(cloneSlotMap(draftSlotMapRef.current))
      setDraftOffDayMap(cloneOffDayMap(draftOffDayMapRef.current))
      setSaveSuccess(false)
      setStatsTick((n) => n + 1)
      window.alert(C.employeeSettingsBatchFillDone)
    },
    [canEditCell, team, currentMonth, monthLabel]
  )

  const todayYmd = dayjs().format('YYYY-MM-DD')

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="modal-inset-below-chrome max-lg:bg-black/45 lg:!fixed lg:!inset-0 lg:!top-0 lg:!bottom-0 lg:z-[100] lg:flex lg:items-center lg:justify-center lg:p-2 lg:bg-black/55"
      role="dialog"
      aria-modal="true"
      aria-labelledby="office-schedule-modal-title"
      onClick={requestClose}
    >
      <div
        className="relative bg-white flex flex-col overflow-hidden border border-indigo-100 max-lg:h-full max-lg:w-full max-lg:max-h-none max-lg:rounded-none max-lg:border-0 max-lg:shadow-none lg:rounded-xl lg:shadow-2xl lg:w-[calc(100vw-0.5rem)] lg:max-w-[min(99vw,1920px)] lg:max-h-[min(96dvh,980px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <OfficeScheduleEmployeeSettingsModal
          isOpen={isEmployeeSettingsOpen}
          onClose={() => setIsEmployeeSettingsOpen(false)}
          team={team}
          canEdit={canEditAll}
          scopeMonth={currentMonth}
          onSettingsChange={handleEmployeeSettingsChange}
          onBatchFillShift={applyBatchShiftFill}
        />
        <OfficeScheduleHistoryPanel
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          scopeMonth={currentMonth}
          canRestore={canEditAll}
          onRestored={() => void handleHistoryRestored()}
        />
        <div className="lg:hidden shrink-0 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <h2
              id="office-schedule-modal-title"
              className="text-sm font-semibold text-gray-900 flex items-center gap-1.5 min-w-0"
            >
              <CalendarClock className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="truncate">{C.title}</span>
              {isDirty && (
                <span className="text-[9px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded shrink-0">
                  Unsaved
                </span>
              )}
            </h2>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="flex items-center justify-center p-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40"
                title={C.save}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={requestClose}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                aria-label={C.close}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="hidden lg:flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-200 shrink-0">
          <h2
            className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2 min-w-0"
          >
            <CalendarClock className="w-5 h-5 text-indigo-600 shrink-0" />
            <span className="truncate">{C.title}</span>
            {isDirty && (
              <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                Unsaved
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsEmployeeSettingsOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              title={C.employeeSettingsTitle}
            >
              <Briefcase className="w-4 h-4" />
              <span className="hidden sm:inline">{C.employeeSettingsButton}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              title={C.historyTitle}
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">{C.history}</span>
            </button>
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo || saving}
              title={`${C.undo} (Ctrl+Z)`}
              className="flex items-center gap-1 px-2.5 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Undo2 className="w-4 h-4" />
              <span className="hidden sm:inline">{C.undo}</span>
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo || saving}
              title={`${C.redo} (Ctrl+Y)`}
              className="flex items-center gap-1 px-2.5 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Redo2 className="w-4 h-4" />
              <span className="hidden sm:inline">{C.redo}</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? C.saving : C.save}
            </button>
            <button
              type="button"
              onClick={requestClose}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label={C.close}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="px-3 sm:px-4 py-2 border-b border-gray-100 shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2 bg-white">
          <div className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="p-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-600 shrink-0"
              aria-label={C.prevMonth}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-gray-800 min-w-[5.5rem] text-center truncate">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="p-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-600 shrink-0"
              aria-label={C.nextMonth}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="lg:hidden flex items-center gap-1 ml-auto shrink-0">
            <button
              type="button"
              onClick={() => setIsEmployeeSettingsOpen(true)}
              className="p-1.5 text-gray-700 bg-white border border-gray-300 rounded-md"
              title={C.employeeSettingsTitle}
              aria-label={C.employeeSettingsButton}
            >
              <Briefcase className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              className="p-1.5 text-gray-700 bg-white border border-gray-300 rounded-md"
              title={C.historyTitle}
              aria-label={C.history}
            >
              <History className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo || saving}
              title={C.undo}
              aria-label={C.undo}
              className="p-1.5 text-gray-700 bg-white border border-gray-300 rounded-md disabled:opacity-40"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo || saving}
              title={C.redo}
              aria-label={C.redo}
              className="p-1.5 text-gray-700 bg-white border border-gray-300 rounded-md disabled:opacity-40"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="hidden sm:block text-xs text-gray-500">{C.hint}</p>
          {!canEditAll && (
            <p className="text-[10px] text-gray-400">{C.historyRestoreRestricted}</p>
          )}
          {saveSuccess && <p className="text-xs text-green-600 font-medium">{C.saveSuccess}</p>}
        </div>

        <div className="shrink-0 border-b border-gray-100 bg-white">
          <button
            type="button"
            onClick={() => setMobileStaffOpen((open) => !open)}
            className="lg:hidden flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left active:bg-gray-50"
            aria-expanded={mobileStaffOpen}
            aria-label={mobileStaffOpen ? C.staffPickerHide : C.staffPickerShow}
          >
            <span className="text-xs font-semibold text-gray-800">{C.selectStaff}</span>
            <span className="flex items-center gap-1.5 min-w-0 shrink">
              <span className="text-[10px] font-semibold text-indigo-700 truncate max-w-[9rem]">
                {activeBrushLabel}
              </span>
              {mobileStaffOpen ? (
                <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
              ) : (
                <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" />
              )}
            </span>
          </button>

          <div
            className={`px-3 sm:px-4 py-2.5 ${
              mobileStaffOpen ? 'max-lg:block' : 'max-lg:hidden'
            } lg:block`}
          >
            <p className="hidden lg:block text-[11px] font-medium text-gray-600 mb-2">{C.selectStaff}</p>
            <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:items-center lg:gap-2">
            {team.map((member) => {
              const color = staffColorMap.get(member.email.trim().toLowerCase())
              const selected = activeBrush === member.email
              const editable = canEditCell(member.email)
              const visible = !hiddenStaffEmails.has(member.email.trim().toLowerCase())
              const name = displayName(member)
              return (
                <div
                  key={member.email}
                  className={`rounded-xl border-2 text-xs font-medium transition-all overflow-hidden lg:inline-flex lg:items-center lg:rounded-md lg:border ${
                    selected
                      ? 'ring-2 ring-indigo-500 ring-offset-1 shadow-md lg:shadow-sm'
                      : 'shadow-sm hover:shadow-md lg:hover:shadow-sm'
                  } ${!editable ? 'opacity-45' : ''} ${!visible ? 'opacity-60' : ''}`}
                  style={{
                    backgroundColor: color?.bg ?? '#f3f4f6',
                    borderColor: color?.border ?? '#d1d5db',
                    color: color?.text ?? '#374151',
                  }}
                >
                  <div className="flex items-stretch lg:contents">
                    <button
                      type="button"
                      onClick={() => toggleStaffVisibility(member.email)}
                      title={visible ? C.hideStaff : C.showStaff}
                      aria-label={visible ? C.hideStaff : C.showStaff}
                      aria-pressed={visible}
                      className={`shrink-0 px-3 py-3 lg:px-1.5 lg:py-1 border-r transition-colors active:bg-black/10 ${
                        visible
                          ? 'border-black/10 text-indigo-700 hover:bg-black/5'
                          : 'border-black/10 text-gray-500 hover:bg-black/5'
                      }`}
                      style={{ borderColor: color?.border ?? '#d1d5db' }}
                    >
                      {visible ? (
                        <Eye className="w-4 h-4 lg:w-3.5 lg:h-3.5" />
                      ) : (
                        <EyeOff className="w-4 h-4 lg:w-3.5 lg:h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={!editable}
                      onClick={() => selectActiveBrush(member.email)}
                      className={`flex flex-1 items-center justify-center gap-2 px-2 py-3 lg:justify-start lg:gap-1.5 lg:px-2 lg:py-1 min-w-0 ${
                        !editable ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-black/5 active:bg-black/10'
                      }`}
                    >
                      <span
                        className="w-4 h-4 lg:w-3 lg:h-3 rounded-sm border shrink-0"
                        style={{ backgroundColor: color?.bg, borderColor: color?.border }}
                      />
                      <span className="truncate text-sm lg:text-xs font-semibold">{name}</span>
                    </button>
                  </div>
                </div>
              )
            })}
            <button
              type="button"
              onClick={() => selectActiveBrush('eraser')}
              className={`col-span-2 lg:col-span-1 flex items-center justify-center gap-2 px-3 py-3 lg:py-1 rounded-xl lg:rounded-md border text-sm lg:text-xs font-semibold transition-all active:scale-[0.98] ${
                activeBrush === 'eraser'
                  ? 'ring-2 ring-red-400 ring-offset-1 bg-red-50 border-red-300 text-red-700'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Eraser className="w-4 h-4 lg:w-3.5 lg:h-3.5" />
              {C.eraser}
            </button>
          </div>
          </div>
        </div>

        {error && <p className="px-3 sm:px-4 pt-2 text-sm text-red-600 shrink-0 bg-white">{error}</p>}

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white">
          {(teamLoading && team.length === 0) || slotsLoading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600 py-16">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              {C.loading}
            </div>
          ) : team.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-16">{C.noStaff}</p>
          ) : (
            <div
              ref={bodyScrollRef}
              className="overflow-auto min-h-0 flex-1 select-none max-lg:touch-pan-x max-lg:touch-pan-y lg:touch-none [scrollbar-gutter:stable] isolate"
            >
                <table
                  className="border-collapse text-[10px]"
                  style={{ minWidth: dynamicMinTableWidthPx, width: '100%', tableLayout: 'fixed' }}
                >
                  <colgroup>
                    <col style={{ width: TIME_COL_PX }} />
                    {!isCompactScheduleTable && <col style={{ width: TIME_COL_PX }} />}
                    {monthDays.map((d) => (
                      <col key={`col-${d.dateString}`} style={{ minWidth: DAY_COL_MIN_PX }} />
                    ))}
                  </colgroup>
                  <thead className="sticky top-0 z-30">
                    <tr className="border-b border-gray-300 bg-gray-50">
                      <th
                        colSpan={scheduleTimeColumnCount}
                        className="sticky left-0 z-40 bg-gray-50 border-r border-gray-300 px-1 py-1 text-center text-[11px] text-gray-500 font-medium"
                      />
                      {monthDays.map((d) => (
                        <th
                          key={`md-${d.dateString}`}
                          className={`px-0 py-1 text-center border-r border-gray-300 text-[11px] font-semibold leading-tight bg-gray-50 ${
                            d.isEdgePadding ? 'text-gray-400 bg-gray-100' : 'text-gray-800'
                          } ${d.isWeekend ? 'bg-yellow-100' : ''} ${
                            d.dateString === todayYmd ? 'bg-indigo-100 text-indigo-900' : ''
                          }`}
                        >
                          {shortDateLabel(d.dateString)}
                        </th>
                      ))}
                    </tr>
                    <tr className="border-b border-gray-300 bg-gray-50">
                      <th
                        className="sticky left-0 z-40 bg-gray-50 border-r border-gray-300 px-1 py-1 text-center text-[11px] text-gray-600 font-medium shadow-[2px_0_4px_-2px_rgba(0,0,0,0.12)]"
                      >
                        {C.timeStart}
                      </th>
                      {!isCompactScheduleTable && (
                        <th
                          className="sticky z-40 bg-gray-50 border-r border-gray-300 px-1 py-1 text-center text-[11px] text-gray-600 font-medium shadow-[2px_0_4px_-2px_rgba(0,0,0,0.12)]"
                          style={{ left: TIME_COL_PX }}
                        >
                          {C.timeEnd}
                        </th>
                      )}
                      {monthDays.map((d) => (
                        <th
                          key={`dow-${d.dateString}`}
                          className={`px-0 py-0.5 text-center border-r border-gray-300 text-[10px] font-normal text-gray-500 bg-gray-50 ${
                            d.isEdgePadding ? 'bg-gray-100' : ''
                          } ${d.isWeekend ? 'bg-yellow-50' : ''} ${
                            d.dateString === todayYmd ? 'bg-indigo-50' : ''
                          }`}
                        >
                          {d.dayOfWeek}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b-2 border-rose-200 bg-rose-50/40">
                      <td
                        colSpan={scheduleTimeColumnCount}
                        className="sticky left-0 z-10 border-r border-rose-200 px-1 py-1 text-center text-[10px] font-bold text-rose-700 whitespace-nowrap shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] bg-rose-50/90"
                        title={C.offDayHint}
                      >
                        {C.offRowLabel}
                      </td>
                      {monthDays.map((d) => {
                        const offEmails = filterEmailsForView(offDaysByDate.get(d.dateString) ?? [])
                        const { background, color } = cellBackgroundForEmails(offEmails, staffColorMap)
                        const label =
                          offEmails.length > 0 ? cellLabelForEmails(offEmails, staffColorMap) : ''
                        const offBackground =
                          offEmails.length > 0
                            ? `repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(0,0,0,0.07) 3px, rgba(0,0,0,0.07) 6px), ${background}`
                            : '#fff'
                        return (
                          <td
                            key={`off-${d.dateString}`}
                            className={`p-0 border-r border-rose-100 align-middle ${
                              d.isEdgePadding ? 'bg-gray-50/50' : ''
                            }`}
                            style={{ height: 24 }}
                          >
                            <button
                              type="button"
                              disabled={!canPaintCell()}
                              data-off-cell
                              data-date={d.dateString}
                              title={label || (canPaintCell() ? C.offDayHint : C.readOnly)}
                              onPointerDown={(e) => handleOffCellPointerDown(e, d.dateString)}
                              className={`w-full h-full min-h-[22px] flex items-center justify-center ${
                                canPaintCell()
                                  ? 'cursor-crosshair hover:brightness-95'
                                  : 'cursor-default'
                              }`}
                              style={{ background: offBackground, color }}
                            >
                              {offEmails.length > 1 ? (
                                <span className="text-[8px] leading-none px-0.5 truncate font-bold">
                                  {offEmails.length}
                                </span>
                              ) : offEmails.length === 1 ? (
                                <span className="text-[8px] leading-none font-bold tracking-tight">
                                  {C.offDayCellLabel}
                                </span>
                              ) : null}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                    {timeRows.map((row) => (
                      <tr key={row.hourSlot} className="border-b border-gray-200">
                        <td
                          className={`sticky left-0 z-10 border-r border-gray-300 px-1 py-0 text-center text-gray-700 font-medium whitespace-nowrap shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] ${
                            row.isBlock ? 'bg-amber-50/80' : 'bg-white'
                          }`}
                        >
                          {row.startLabel}
                        </td>
                        {!isCompactScheduleTable && (
                          <td
                            className={`sticky z-10 border-r border-gray-300 px-1 py-0 text-center text-gray-500 whitespace-nowrap shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] ${
                              row.isBlock ? 'bg-amber-50/80' : 'bg-white'
                            }`}
                            style={{ left: TIME_COL_PX }}
                          >
                            {row.endLabel}
                          </td>
                        )}
                        {monthDays.map((d) => {
                          const cellKey = officeScheduleCellKey(d.dateString, row.hourSlot)
                          const emails = filterEmailsForView(cellStaffMap.get(cellKey) ?? [])
                          const { background, color } = cellBackgroundForEmails(emails, staffColorMap)
                          const label = emails.length > 0 ? cellLabelForEmails(emails, staffColorMap) : ''
                          return (
                            <td
                              key={cellKey}
                              className={`p-0 border-r border-gray-200 align-middle ${
                                d.isEdgePadding ? 'bg-gray-50/50' : ''
                              } ${d.isWeekend && emails.length === 0 ? 'bg-yellow-50/40' : ''}`}
                              style={{ height: row.isBlock ? 22 : 20 }}
                            >
                              <button
                                type="button"
                                disabled={!canPaintCell()}
                                data-schedule-cell
                                data-date={d.dateString}
                                data-hour={row.hourSlot}
                                title={label || (canPaintCell() ? C.cellHint : C.readOnly)}
                                onPointerDown={(e) => {
                                  handleCellPointerDown(e, d.dateString, row.hourSlot)
                                }}
                                className={`w-full h-full min-h-[18px] ${
                                  canPaintCell() ? 'cursor-crosshair hover:brightness-95' : 'cursor-default'
                                }`}
                                style={{ background, color }}
                              >
                                {emails.length > 1 ? (
                                  <span className="block text-[8px] leading-none px-0.5 truncate font-semibold">
                                    {emails.length}
                                  </span>
                                ) : emails.length === 1 ? (
                                  <span className="sr-only">{label}</span>
                                ) : null}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                    {canEditAll && (
                      <tr className="border-t-2 border-gray-300 bg-gray-50">
                        <td
                          colSpan={scheduleTimeColumnCount}
                          className="sticky left-0 z-10 bg-gray-50 border-r border-gray-300 px-1 py-1 text-center text-[9px] text-gray-600 font-semibold shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
                        >
                          {C.dailyTotalHours}
                        </td>
                        {monthDays.map((d) => {
                          const dailyHours = dailyHoursByDate.get(d.dateString) ?? 0
                          return (
                            <td
                              key={`dh-${d.dateString}`}
                              className={`px-0 py-1 text-center border-r border-gray-200 text-xs max-lg:text-[8px] font-bold tabular-nums leading-tight bg-gray-50 ${
                                d.isEdgePadding ? 'text-gray-400' : ''
                              } ${d.isWeekend ? 'bg-yellow-50/60' : ''} ${
                                d.dateString === todayYmd ? 'bg-indigo-50' : ''
                              } ${dailyHours > 0 ? 'text-indigo-700' : 'text-gray-400'}`}
                            >
                              {dailyHours > 0 ? `${dailyHours}h` : '—'}
                            </td>
                          )
                        })}
                      </tr>
                    )}
                    {isSuper && (
                      <tr className="border-t border-gray-200 bg-amber-50/40">
                        <td
                          colSpan={scheduleTimeColumnCount}
                          className="sticky left-0 z-10 bg-amber-50/90 border-r border-gray-300 px-1 py-1 text-center text-[9px] text-amber-900 font-semibold shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
                        >
                          {C.dailyPay}
                        </td>
                        {monthDays.map((d) => {
                          const dailyPay = dailyPayByDate.get(d.dateString) ?? 0
                          return (
                            <td
                              key={`pay-${d.dateString}`}
                              className={`px-0 py-1 text-center border-r border-gray-200 text-xs max-lg:text-[8px] font-bold tabular-nums leading-tight bg-amber-50/40 ${
                                d.isEdgePadding ? 'text-gray-400' : ''
                              } ${d.isWeekend ? 'bg-yellow-50/80' : ''} ${
                                d.dateString === todayYmd ? 'bg-indigo-50/80' : ''
                              } ${dailyPay > 0 ? 'text-amber-900' : 'text-gray-400'}`}
                            >
                              {formatDailyPayAmount(dailyPay)}
                            </td>
                          )
                        })}
                      </tr>
                    )}
                  </tbody>
                </table>
            </div>
          )}
        </div>
        </div>

        <div className="shrink-0 border-t border-gray-200 bg-gray-50 min-w-0 lg:border-t-2 lg:border-gray-300">
          <button
            type="button"
            onClick={() => setMobileStatsOpen((open) => !open)}
            className="lg:hidden flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left active:bg-gray-100/80"
            aria-expanded={mobileStatsOpen}
            aria-label={mobileStatsOpen ? C.statsHide : C.statsShow}
          >
            <span className="text-xs font-semibold text-gray-800">{C.statsTitle}</span>
            <span className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-semibold text-indigo-700 tabular-nums">
                {viewedMonthShort} {totalStats.monthHours}h · {formatScheduledDays(totalStats.monthDays)}
              </span>
              {mobileStatsOpen ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronUp className="w-4 h-4 text-gray-500" />
              )}
            </span>
          </button>

          <div
            className={`space-y-2 px-3 sm:px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] min-w-0 ${
              mobileStatsOpen ? 'max-lg:block max-lg:max-h-[min(48dvh,360px)] max-lg:overflow-y-auto max-lg:overscroll-y-contain' : 'max-lg:hidden'
            } lg:block lg:max-h-none lg:overflow-visible`}
          >
          <div className="hidden lg:block">
            <p className="text-[10px] font-medium text-gray-500 mb-1">{C.legend}</p>
            <div className="flex flex-nowrap sm:flex-wrap gap-x-3 gap-y-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {team.map((member) => {
                const color = staffColorMap.get(member.email.trim().toLowerCase()) as StaffColor | undefined
                if (!color) return null
                const hasOverride = Boolean(colorOverrides[member.email.trim().toLowerCase()])
                return (
                  <label
                    key={member.email}
                    className="inline-flex items-center gap-1.5 text-[10px] text-gray-700 cursor-pointer"
                    title={C.resetColor}
                  >
                    <input
                      type="color"
                      value={color.bg}
                      onChange={(e) => handleColorChange(member.email, e.target.value)}
                      className="w-5 h-4 p-0 border border-gray-300 rounded cursor-pointer"
                    />
                    <span>{color.label}</span>
                    {hasOverride && (
                      <button
                        type="button"
                        onClick={() => handleColorReset(member.email)}
                        className="text-[9px] text-gray-400 hover:text-gray-600 underline"
                      >
                        reset
                      </button>
                    )}
                  </label>
                )
              })}
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                <span className="w-4 h-3 rounded-sm border shrink-0 bg-gradient-to-br from-orange-200 via-blue-200 to-green-200" />
                {C.comboHint}
              </span>
            </div>
          </div>

          <div className="min-w-0">
            <p className="hidden lg:block text-[10px] font-medium text-gray-500 mb-1.5">{C.statsTitle}</p>
            <div className="grid grid-cols-1 gap-2 w-full min-w-0 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-[1800px]:grid-cols-5">
              {canEditAll && hiddenStaffEmails.size === 0 && (
                <div className="w-full min-w-0 rounded-lg border border-indigo-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-indigo-100 bg-indigo-600">
                    <span className="text-[11px] font-semibold text-white">{C.statsTotal}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 p-1.5 lg:grid-cols-5 lg:gap-0.5 lg:min-w-0">
                    <ScheduleStatsPeriodCell
                      label={C.statsFirstHalf}
                      hours={totalStats.firstHalfHours}
                      days={totalStats.firstHalfDays}
                      pay={isSuper ? totalPayStats.firstHalfPay : undefined}
                    />
                    <ScheduleStatsPeriodCell
                      label={C.statsSecondHalf}
                      hours={totalStats.secondHalfHours}
                      days={totalStats.secondHalfDays}
                      pay={isSuper ? totalPayStats.secondHalfPay : undefined}
                    />
                    <ScheduleStatsPeriodCell
                      label={C.statsWeek}
                      hours={totalStats.weekHours}
                      days={totalStats.weekDays}
                      pay={isSuper ? totalPayStats.weekPay : undefined}
                    />
                    <ScheduleStatsPeriodCell
                      label={C.statsTwoWeeks}
                      hours={totalStats.twoWeekHours}
                      days={totalStats.twoWeekDays}
                      pay={isSuper ? totalPayStats.twoWeekPay : undefined}
                    />
                    <ScheduleStatsPeriodCell
                      label={viewedMonthShort}
                      labelTitle={C.statsMonth}
                      hours={totalStats.monthHours}
                      days={totalStats.monthDays}
                      pay={isSuper ? totalPayStats.monthPay : undefined}
                      highlight
                    />
                  </div>
                </div>
              )}
              {visibleStaffStats.map((row) => {
                const m = team.find((t) => t.email === row.email)
                const color = staffColorMap.get(row.email.trim().toLowerCase())
                const name = m ? displayName(m) : row.email
                const empSettings = getEmployeeSettings(employeeSettingsMap, row.email)
                const hourlyRate = getHourlyRateForEmployeeOnDate(ratePeriods, row.email, todayYmd)
                const monthlyMin = fullTimeMonthlyMinByEmail.get(row.email.trim().toLowerCase())
                return (
                  <div
                    key={row.email}
                    className="w-full min-w-0 rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden"
                  >
                    <div
                      className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-gray-100 min-w-0"
                      style={{ backgroundColor: color?.bg ?? '#f9fafb' }}
                    >
                      <span
                        className="w-3 h-3 rounded-sm border shrink-0"
                        style={{
                          backgroundColor: color?.bg,
                          borderColor: color?.border,
                        }}
                      />
                      <span
                        className="text-[11px] font-semibold truncate min-w-0 flex-1"
                        style={{ color: color?.text ?? '#1f2937' }}
                      >
                        {name}
                      </span>
                      <span
                        className="text-[8px] font-semibold px-1 py-0.5 rounded border border-gray-200 bg-white/80 text-gray-600 shrink-0"
                        title={C.employeeSettingsPayType}
                      >
                        {empSettings.pay_type === 'monthly'
                          ? C.statsPayTypeMonthly
                          : C.statsPayTypeHourly}
                      </span>
                      <span
                        className="text-[8px] font-semibold px-1 py-0.5 rounded border border-gray-200 bg-white/80 text-gray-600 shrink-0"
                        title={C.employeeSettingsEmployment}
                      >
                        {empSettings.employment_type === 'full_time'
                          ? C.statsEmploymentFullTime
                          : C.statsEmploymentPartTime}
                      </span>
                      {isSuper && empSettings.pay_type === 'hourly' && (
                        <span
                          className="text-[9px] font-semibold text-amber-800 tabular-nums shrink-0"
                          title={C.statsHourlyRate}
                        >
                          {formatHourlyRateLabel(hourlyRate)}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 p-1.5 lg:grid-cols-5 lg:gap-0.5 lg:min-w-0">
                      <ScheduleStatsPeriodCell
                        label={C.statsFirstHalf}
                        hours={row.firstHalfHours}
                        days={row.firstHalfDays}
                      />
                      <ScheduleStatsPeriodCell
                        label={C.statsSecondHalf}
                        hours={row.secondHalfHours}
                        days={row.secondHalfDays}
                      />
                      <ScheduleStatsPeriodCell
                        label={C.statsWeek}
                        hours={row.weekHours}
                        days={row.weekDays}
                      />
                      <ScheduleStatsPeriodCell
                        label={C.statsTwoWeeks}
                        hours={row.twoWeekHours}
                        days={row.twoWeekDays}
                      />
                      <ScheduleStatsPeriodCell
                        label={viewedMonthShort}
                        labelTitle={C.statsMonth}
                        hours={row.monthHours}
                        days={row.monthDays}
                        monthlyMin={monthlyMin}
                        highlight
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}
