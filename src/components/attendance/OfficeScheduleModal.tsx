'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { CalendarClock, ChevronLeft, ChevronRight, Eraser, Eye, EyeOff, History, Loader2, Redo2, Save, Undo2, X } from 'lucide-react'
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
  getScheduleLoadRange,
  slotMapsEqual,
  sumStaffHoursSummaries,
  sumStaffPaySummaries,
} from '@/lib/officeScheduleStats'
import {
  buildOfficeScheduleSavePayload,
  saveOfficeScheduleBatch,
} from '@/lib/officeScheduleSave'
import {
  cellsInPaintRectangle,
  paintCellId,
  type PaintCellCoord,
} from '@/lib/officeSchedulePaintRange'
import { pushUndoSnapshot } from '@/lib/officeScheduleUndo'
import { fetchEmployeeHourlyRatePeriods, type EmployeeRatePeriod } from '@/lib/employeeHourlyRates'
import OfficeScheduleHistoryPanel from '@/components/attendance/OfficeScheduleHistoryPanel'

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
  const [colorOverrides, setColorOverrides] = useState<StaffColorOverrides>({})
  const [activeBrush, setActiveBrush] = useState<Brush>(null)
  const [statsTick, setStatsTick] = useState(0)
  const [undoStack, setUndoStack] = useState<SlotMap[]>([])
  const [redoStack, setRedoStack] = useState<SlotMap[]>([])
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [hiddenStaffEmails, setHiddenStaffEmails] = useState<Set<string>>(() => new Set())
  const [ratePeriods, setRatePeriods] = useState<EmployeeRatePeriod[]>([])

  const draftSlotMapRef = useRef<SlotMap>(new Map())
  const cellStaffMapRef = useRef<Map<string, string[]>>(new Map())
  const activeBrushRef = useRef<Brush>(null)
  const isPaintingRef = useRef(false)
  const strokeBeforeRef = useRef<SlotMap | null>(null)
  const strokeModeRef = useRef<StrokeMode | null>(null)
  const lastPaintedPosRef = useRef<PaintCellCoord | null>(null)
  const monthDateStringsRef = useRef<string[]>([])
  const paintRafRef = useRef<number | null>(null)
  const pointerCaptureTargetRef = useRef<HTMLElement | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
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

  const isDirty = useMemo(
    () => !slotMapsEqual(savedSlotMap, draftSlotMap),
    [savedSlotMap, draftSlotMap]
  )

  const dynamicMinTableWidthPx = useMemo(
    () => FIXED_SIDE_COLUMNS_PX + monthDays.length * DAY_COL_MIN_PX,
    [monthDays.length]
  )

  const bodyScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const endStroke = () => {
      if (!isPaintingRef.current) return
      isPaintingRef.current = false
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
      if (before && !slotMapsEqual(before, draftSlotMapRef.current)) {
        setUndoStack((stack) => pushUndoSnapshot(stack, before))
        setRedoStack([])
      }

      setDraftSlotMap(cloneSlotMap(draftSlotMapRef.current))
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
    setTeam((data || []) as TeamRow[])
  }, [])

  const loadSlots = useCallback(async () => {
    const { from, to } = getScheduleLoadRange(monthDays)
    if (!from || !to) return
    const { data, error: err } = await fromUntypedTable(supabase, 'office_schedule_slots')
      .select('employee_email, schedule_date, hour_slot, note')
      .gte('schedule_date', from)
      .lte('schedule_date', to)
    if (err) {
      console.error(err)
      setError(C.loadError)
      return
    }
    setError(null)
    const next = new Map<string, { note: string | null }>()
    for (const row of (data || []) as SlotRow[]) {
      const date =
        typeof row.schedule_date === 'string'
          ? row.schedule_date.slice(0, 10)
          : String(row.schedule_date)
      const key = officeScheduleSlotKey(row.employee_email, date, row.hour_slot)
      next.set(key, { note: row.note })
    }
    setSavedSlotMap(next)
    setDraftSlotMap(cloneSlotMap(next))
    draftSlotMapRef.current = cloneSlotMap(next)
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

      const slotKey = officeScheduleSlotKey(email, date, hourSlot)
      draft.set(slotKey, { note: null })
      const list = cellStaffMapRef.current.get(cellKey) ?? []
      cellStaffMapRef.current.set(cellKey, [...list, email])
      return true
    },
    []
  )

  const flushDraftRender = useCallback(() => {
    if (paintRafRef.current != null) {
      cancelAnimationFrame(paintRafRef.current)
      paintRafRef.current = null
    }
    setDraftSlotMap(cloneSlotMap(draftSlotMapRef.current))
    setSaveSuccess(false)
  }, [])

  const scheduleDraftRender = useCallback(() => {
    if (paintRafRef.current != null) return
    paintRafRef.current = requestAnimationFrame(() => {
      paintRafRef.current = null
      setDraftSlotMap(cloneSlotMap(draftSlotMapRef.current))
      setSaveSuccess(false)
    })
  }, [])

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
        if (mutateCell(date, hourSlot, mode)) changed = true
      }

      if (changed) {
        if (isPaintingRef.current) flushDraftRender()
        else scheduleDraftRender()
      }
    },
    [flushDraftRender, mutateCell, resolveStrokeMode, scheduleDraftRender]
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

  const applyDraftSnapshot = useCallback((snapshot: SlotMap) => {
    const next = cloneSlotMap(snapshot)
    draftSlotMapRef.current = next
    cellStaffMapRef.current = buildCellStaffMap(next)
    setDraftSlotMap(cloneSlotMap(next))
    setSaveSuccess(false)
    setStatsTick((n) => n + 1)
  }, [])

  const handleUndo = useCallback(() => {
    if (isPaintingRef.current || undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    setRedoStack((stack) => pushUndoSnapshot(stack, draftSlotMapRef.current))
    setUndoStack((stack) => stack.slice(0, -1))
    applyDraftSnapshot(prev)
  }, [undoStack, applyDraftSnapshot])

  const handleRedo = useCallback(() => {
    if (isPaintingRef.current || redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setUndoStack((stack) => pushUndoSnapshot(stack, draftSlotMapRef.current))
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
    strokeBeforeRef.current = cloneSlotMap(draftSlotMapRef.current)
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
        canEditAll,
        currentUserEmail,
        currentMonth,
        from,
        to
      )

      if (payload.deletes.length === 0 && payload.upserts.length === 0) {
        setSavedSlotMap(cloneSlotMap(draftSlotMap))
        draftSlotMapRef.current = cloneSlotMap(draftSlotMap)
        cellStaffMapRef.current = buildCellStaffMap(draftSlotMap)
        setUndoStack([])
        setRedoStack([])
        setSaveSuccess(true)
        setStatsTick((n) => n + 1)
        return
      }

      await saveOfficeScheduleBatch(supabase, payload)

      setSavedSlotMap(cloneSlotMap(draftSlotMap))
      draftSlotMapRef.current = cloneSlotMap(draftSlotMap)
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

  const todayYmd = dayjs().format('YYYY-MM-DD')
  const monthLabel = useMemo(() => dayjs(`${currentMonth}-01`).format('MMMM YYYY'), [currentMonth])
  const viewedMonthShort = useMemo(() => dayjs(`${currentMonth}-01`).format('MMM YYYY'), [currentMonth])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-2 bg-black/55"
      role="dialog"
      aria-modal="true"
      aria-labelledby="office-schedule-modal-title"
      onClick={requestClose}
    >
      <div
        className="relative bg-white rounded-xl shadow-2xl w-[calc(100vw-0.5rem)] max-w-[min(99vw,1920px)] max-h-[min(96dvh,980px)] flex flex-col overflow-hidden border border-indigo-100"
        onClick={(e) => e.stopPropagation()}
      >
        <OfficeScheduleHistoryPanel
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          scopeMonth={currentMonth}
          canRestore={canEditAll}
          onRestored={() => void handleHistoryRestored()}
        />
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-200 shrink-0">
          <h2
            id="office-schedule-modal-title"
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

        <div className="px-4 py-2 border-b border-gray-100 shrink-0 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="p-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-600"
              aria-label={C.prevMonth}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-gray-800 min-w-[7rem] text-center">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="p-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-600"
              aria-label={C.nextMonth}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-500">{C.hint}</p>
          {!canEditAll && (
            <p className="text-[10px] text-gray-400">{C.historyRestoreRestricted}</p>
          )}
          {saveSuccess && <p className="text-xs text-green-600 font-medium">{C.saveSuccess}</p>}
        </div>

        <div className="px-4 py-2 border-b border-gray-100 shrink-0">
          <p className="text-[11px] font-medium text-gray-600 mb-1.5">{C.selectStaff}</p>
          <div className="flex flex-wrap items-center gap-2">
            {team.map((member) => {
              const color = staffColorMap.get(member.email.trim().toLowerCase())
              const selected = activeBrush === member.email
              const editable = canEditCell(member.email)
              const visible = !hiddenStaffEmails.has(member.email.trim().toLowerCase())
              return (
                <div
                  key={member.email}
                  className={`inline-flex items-center rounded-md border text-xs font-medium transition-all overflow-hidden ${
                    selected ? 'ring-2 ring-indigo-500 ring-offset-1 shadow-sm' : 'hover:shadow-sm'
                  } ${!editable ? 'opacity-45' : ''} ${!visible ? 'opacity-60' : ''}`}
                  style={{
                    backgroundColor: color?.bg ?? '#f3f4f6',
                    borderColor: color?.border ?? '#d1d5db',
                    color: color?.text ?? '#374151',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleStaffVisibility(member.email)}
                    title={visible ? C.hideStaff : C.showStaff}
                    aria-label={visible ? C.hideStaff : C.showStaff}
                    aria-pressed={visible}
                    className={`shrink-0 px-1.5 py-1 border-r transition-colors ${
                      visible
                        ? 'border-black/10 text-indigo-700 hover:bg-black/5'
                        : 'border-black/10 text-gray-500 hover:bg-black/5'
                    }`}
                    style={{ borderColor: color?.border ?? '#d1d5db' }}
                  >
                    {visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    disabled={!editable}
                    onClick={() => setActiveBrush(member.email)}
                    className={`flex items-center gap-1.5 px-2 py-1 ${
                      !editable ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-black/5'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-sm border shrink-0"
                      style={{ backgroundColor: color?.bg, borderColor: color?.border }}
                    />
                    {displayName(member)}
                  </button>
                </div>
              )
            })}
            <button
              type="button"
              onClick={() => setActiveBrush('eraser')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-all ${
                activeBrush === 'eraser'
                  ? 'ring-2 ring-red-400 ring-offset-1 bg-red-50 border-red-300 text-red-700'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Eraser className="w-3.5 h-3.5" />
              {C.eraser}
            </button>
          </div>
        </div>

        {error && <p className="px-4 pt-2 text-sm text-red-600 shrink-0">{error}</p>}

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {(teamLoading && team.length === 0) || slotsLoading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600 py-16">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              {C.loading}
            </div>
          ) : team.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-16">{C.noStaff}</p>
          ) : (
            <>
              <div
                ref={bodyScrollRef}
                className="overflow-auto min-h-0 flex-1 select-none touch-none [scrollbar-gutter:stable]"
              >
                <table
                  className="border-collapse text-[10px]"
                  style={{ minWidth: dynamicMinTableWidthPx, width: '100%', tableLayout: 'fixed' }}
                >
                  <colgroup>
                    <col style={{ width: TIME_COL_PX }} />
                    <col style={{ width: TIME_COL_PX }} />
                    {monthDays.map((d) => (
                      <col key={`col-${d.dateString}`} style={{ minWidth: DAY_COL_MIN_PX }} />
                    ))}
                  </colgroup>
                  <thead className="sticky top-0 z-30">
                    <tr className="border-b border-gray-300 bg-gray-50">
                      <th
                        colSpan={2}
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
                      <th
                        className="sticky z-40 bg-gray-50 border-r border-gray-300 px-1 py-1 text-center text-[11px] text-gray-600 font-medium shadow-[2px_0_4px_-2px_rgba(0,0,0,0.12)]"
                        style={{ left: TIME_COL_PX }}
                      >
                        {C.timeEnd}
                      </th>
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
                    {timeRows.map((row) => (
                      <tr key={row.hourSlot} className="border-b border-gray-200">
                        <td
                          className={`sticky left-0 z-10 border-r border-gray-300 px-1 py-0 text-center text-gray-700 font-medium whitespace-nowrap shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] ${
                            row.isBlock ? 'bg-amber-50/80' : 'bg-white'
                          }`}
                        >
                          {row.startLabel}
                        </td>
                        <td
                          className={`sticky z-10 border-r border-gray-300 px-1 py-0 text-center text-gray-500 whitespace-nowrap shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] ${
                            row.isBlock ? 'bg-amber-50/80' : 'bg-white'
                          }`}
                          style={{ left: TIME_COL_PX }}
                        >
                          {row.endLabel}
                        </td>
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
                                  e.preventDefault()
                                  startPainting(e, d.dateString, row.hourSlot)
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
                          colSpan={2}
                          className="sticky left-0 z-10 bg-gray-50 border-r border-gray-300 px-1 py-1 text-center text-[9px] text-gray-600 font-semibold shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
                        >
                          {C.dailyTotalHours}
                        </td>
                        {monthDays.map((d) => {
                          const dailyHours = dailyHoursByDate.get(d.dateString) ?? 0
                          return (
                            <td
                              key={`dh-${d.dateString}`}
                              className={`px-0 py-1 text-center border-r border-gray-200 text-xs font-bold tabular-nums leading-tight bg-gray-50 ${
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
                          colSpan={2}
                          className="sticky left-0 z-10 bg-amber-50/90 border-r border-gray-300 px-1 py-1 text-center text-[9px] text-amber-900 font-semibold shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
                        >
                          {C.dailyPay}
                        </td>
                        {monthDays.map((d) => {
                          const dailyPay = dailyPayByDate.get(d.dateString) ?? 0
                          return (
                            <td
                              key={`pay-${d.dateString}`}
                              className={`px-0 py-1 text-center border-r border-gray-200 text-xs font-bold tabular-nums leading-tight bg-amber-50/40 ${
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
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-200 px-4 py-2 bg-gray-50 space-y-2">
          <div>
            <p className="text-[10px] font-medium text-gray-500 mb-1">{C.legend}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
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

          <div>
            <p className="text-[10px] font-medium text-gray-500 mb-1.5">{C.statsTitle}</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {canEditAll && hiddenStaffEmails.size === 0 && (
                <div className="shrink-0 min-w-[168px] rounded-lg border border-indigo-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-indigo-100 bg-indigo-600">
                    <span className="text-[11px] font-semibold text-white">{C.statsTotal}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 p-1.5">
                    <div className="rounded-md bg-slate-50 border border-slate-100 px-1.5 py-1 text-center">
                      <p className="text-[8px] text-gray-500 leading-tight mb-0.5">{C.statsWeek}</p>
                      <p className="text-sm font-bold text-slate-800 tabular-nums">{totalStats.weekHours}h</p>
                      {isSuper && (
                        <p className="text-[10px] font-bold text-amber-800 tabular-nums mt-0.5">
                          {formatDailyPayAmount(totalPayStats.weekPay)}
                        </p>
                      )}
                    </div>
                    <div className="rounded-md bg-slate-50 border border-slate-100 px-1.5 py-1 text-center">
                      <p className="text-[8px] text-gray-500 leading-tight mb-0.5">{C.statsTwoWeeks}</p>
                      <p className="text-sm font-bold text-slate-800 tabular-nums">{totalStats.twoWeekHours}h</p>
                      {isSuper && (
                        <p className="text-[10px] font-bold text-amber-800 tabular-nums mt-0.5">
                          {formatDailyPayAmount(totalPayStats.twoWeekPay)}
                        </p>
                      )}
                    </div>
                    <div className="rounded-md bg-indigo-50 border border-indigo-100 px-1.5 py-1 text-center">
                      <p className="text-[8px] text-indigo-600 leading-tight mb-0.5 truncate" title={viewedMonthShort}>
                        {viewedMonthShort}
                      </p>
                      <p className="text-sm font-bold text-indigo-700 tabular-nums">{totalStats.monthHours}h</p>
                      {isSuper && (
                        <p className="text-[10px] font-bold text-amber-800 tabular-nums mt-0.5">
                          {formatDailyPayAmount(totalPayStats.monthPay)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {visibleStaffStats.map((row) => {
                const m = team.find((t) => t.email === row.email)
                const color = staffColorMap.get(row.email.trim().toLowerCase())
                const name = m ? displayName(m) : row.email
                return (
                  <div
                    key={row.email}
                    className="shrink-0 min-w-[168px] rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden"
                  >
                    <div
                      className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-gray-100"
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
                        className="text-[11px] font-semibold truncate"
                        style={{ color: color?.text ?? '#1f2937' }}
                      >
                        {name}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 p-1.5">
                      <div className="rounded-md bg-slate-50 border border-slate-100 px-1.5 py-1 text-center">
                        <p className="text-[8px] text-gray-500 leading-tight mb-0.5">{C.statsWeek}</p>
                        <p className="text-sm font-bold text-slate-800 tabular-nums">{row.weekHours}h</p>
                      </div>
                      <div className="rounded-md bg-slate-50 border border-slate-100 px-1.5 py-1 text-center">
                        <p className="text-[8px] text-gray-500 leading-tight mb-0.5">{C.statsTwoWeeks}</p>
                        <p className="text-sm font-bold text-slate-800 tabular-nums">{row.twoWeekHours}h</p>
                      </div>
                      <div className="rounded-md bg-indigo-50 border border-indigo-100 px-1.5 py-1 text-center">
                        <p className="text-[8px] text-indigo-600 leading-tight mb-0.5 truncate" title={viewedMonthShort}>
                          {viewedMonthShort}
                        </p>
                        <p className="text-sm font-bold text-indigo-700 tabular-nums">{row.monthHours}h</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
