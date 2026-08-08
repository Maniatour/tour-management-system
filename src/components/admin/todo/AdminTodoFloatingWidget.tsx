'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ClipboardList,
  ExternalLink,
  Loader2,
  Maximize2,
  Minimize2,
  PanelRight,
  PanelRightClose,
  Plus,
  BookOpen,
  X,
} from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { resolveSiteAccessPersona } from '@/lib/site-access-persona'
import { isSuperAdminEmail } from '@/lib/superAdmin'
import { opTodoAudiencesForUser, computeNextNotifyAtIso } from '@/lib/opTodoSchedule'
import { toggleOpTodoCompletion } from '@/lib/opTodoToggleCompletion'
import { setOpTodoOnHold } from '@/lib/opTodoSetOnHold'
import {
  getOpTodoSelectColumns,
  isMissingOpTodoOnHoldColumnError,
  isOpTodoOnHoldFeatureEnabled,
  markOpTodoOnHoldColumnAvailable,
  markOpTodoOnHoldColumnUnavailable,
  withOpTodoOnHoldDefault,
} from '@/lib/opTodoOnHoldColumn'
import { OP_TODO_REFRESH_EVENT, dispatchOpTodoRefresh } from '@/lib/opTodoRefresh'
import { fetchOpTodoPendingCount, runOpTodoResetsIfDue } from '@/lib/teamBoard/teamBoardFetch'
import { OpTodoFormModal } from '@/components/admin/todo/OpTodoFormModal'
import { EMPTY_OP_TODO_FORM, type OpTodoFormValues } from '@/components/admin/todo/OpTodoFormFields'
import { TodoPanelStatusButtons } from '@/components/admin/todo/TodoPanelStatusButtons'
import {
  AntelopeCanyonBookingPanel,
  BentoCheckPanel,
  CancelRebookingFollowUpPanel,
  CustomerInfoReviewPanel,
  GuideScheduleConfirmPanel,
  LazyReservationCardItem,
  LazyTourPickupNotificationHost,
  LazyTourQuickPrintHost,
  OtaClosurePanel,
  PendingCustomerManagementPanel,
  PickupNotificationPanel,
  ReservationAgencyManagementPanel,
  TourEnvelopePrintPanel,
  TourHotelManagementPanel,
  TourHotelPriceCheckPanel,
  TourHotelCcFormPanel,
  TourSettlementPanel,
} from '@/components/admin/todo/adminTodoLazyPanels'
import type { TourPickupNotificationRequest } from '@/components/admin/todo/TourPickupNotificationHost'
import type { TourQuickPrintRequest } from '@/components/admin/todo/TourQuickPrintHost'
import { shouldHideTodoChipForEnvelopePrintPanel, findTourEnvelopePrintLinkedTodo, readTourEnvelopePrintLocalCompleted, tourEnvelopePrintTargetDate, tourEnvelopePrintTodoFormSeed } from '@/lib/tourEnvelopePrintTodo'
import {
  shouldHideTodoChipForPickupNotificationPanel,
  findPickupNotificationLinkedTodo,
  readPickupNotificationLocalCompleted,
  pickupNotificationCompletionDateKey,
  pickupNotificationTodoFormSeed,
} from '@/lib/pickupNotificationTodo'
import {
  shouldHideTodoChipForGuideScheduleConfirmPanel,
  findGuideScheduleConfirmLinkedTodo,
  readGuideScheduleConfirmLocalCompleted,
  guideScheduleConfirmCompletionDateKey,
  guideScheduleConfirmTodoFormSeed,
} from '@/lib/guideScheduleConfirmTodo'
import {
  shouldHideTodoChipForCustomerInfoReviewPanel,
  findCustomerInfoReviewLinkedTodo,
  readCustomerInfoReviewLocalCompleted,
  customerInfoReviewCompletionDateKey,
  customerInfoReviewTodoFormSeed,
} from '@/lib/customerInfoReviewTodo'
import {
  shouldHideTodoChipForCancelRebookingFollowUpPanel,
  findCancelRebookingFollowUpLinkedTodo,
  readCancelRebookingFollowUpLocalCompleted,
  cancelRebookingFollowUpCompletionDateKey,
  cancelRebookingFollowUpTodoFormSeed,
} from '@/lib/cancelRebookingFollowUpTodo'
import { dispatchCancelRebookingFollowUpRefresh } from '@/lib/cancelRebookingFollowUpRefresh'
import {
  shouldHideTodoChipForPendingCustomerManagementPanel,
  findPendingCustomerManagementLinkedTodo,
  readPendingCustomerManagementLocalCompleted,
  pendingCustomerManagementCompletionDateKey,
  pendingCustomerManagementTodoFormSeed,
} from '@/lib/pendingCustomerManagementTodo'
import { upsertReservationCancelFollowUpManual } from '@/lib/reservationCancelFollowUpManual'
import type { CancelFollowUpManualKind } from '@/components/reservation/ReservationFollowUpQueueModal'
import {
  shouldHideTodoChipForOtaClosurePanel,
  findOtaClosureLinkedTodo,
  readOtaClosureLocalCompleted,
  otaClosureCompletionDateKey,
  otaClosureTodoFormSeed,
} from '@/lib/otaClosureTodo'
import {
  shouldHideTodoChipForTourHotelManagementPanel,
  findTourHotelManagementLinkedTodo,
  readTourHotelManagementLocalCompleted,
  tourHotelManagementCompletionDateKey,
  tourHotelManagementTodoFormSeed,
} from '@/lib/tourHotelManagementTodo'
import {
  shouldHideTodoChipForTourHotelPriceCheckPanel,
  findTourHotelPriceCheckLinkedTodo,
  readTourHotelPriceCheckLocalCompleted,
  tourHotelPriceCheckCompletionDateKey,
  tourHotelPriceCheckTodoFormSeed,
} from '@/lib/tourHotelPriceCheckTodo'
import {
  shouldHideTodoChipForTourHotelCcFormPanel,
  findTourHotelCcFormLinkedTodo,
  readTourHotelCcFormLocalCompleted,
  tourHotelCcFormCompletionDateKey,
  tourHotelCcFormTodoFormSeed,
} from '@/lib/tourHotelCcFormTodo'
import {
  shouldHideTodoChipForTourSettlementPanel,
  findTourSettlementLinkedTodo,
  readTourSettlementLocalCompleted,
  tourSettlementCompletionDateKey,
  tourSettlementTodoFormSeed,
} from '@/lib/tourSettlementTodo'
import {
  shouldHideTodoChipForReservationAgencyManagementPanel,
  findReservationAgencyManagementLinkedTodo,
  readReservationAgencyManagementLocalCompleted,
  reservationAgencyManagementCompletionDateKey,
  reservationAgencyManagementTodoFormSeed,
} from '@/lib/reservationAgencyManagementTodo'
import {
  shouldHideTodoChipForAntelopeCanyonBookingPanel,
  findAntelopeCanyonBookingLinkedTodo,
  readAntelopeCanyonBookingLocalCompleted,
  antelopeCanyonBookingCompletionDateKey,
  antelopeCanyonBookingTodoFormSeed,
} from '@/lib/antelopeCanyonBookingTodo'
import {
  shouldHideTodoChipForBentoCheckPanel,
  findBentoCheckLinkedTodo,
  readBentoCheckLocalCompleted,
  bentoCheckCompletionDateKey,
  bentoCheckTodoFormSeed,
} from '@/lib/bentoCheckTodo'
import { useTeamBoardManualOptional } from '@/contexts/TeamBoardManualContext'
import { useAdminTodo } from '@/contexts/AdminTodoContext'
import {
  clampFloatingPanelPosition,
  clampFloatingPanelSize,
  clampDockedFloatingPanelWidth,
  defaultFloatingPanelPosition,
  fabBottomCss,
  setAdminTodoDockLayoutActive,
  ADMIN_FLOATING_FAB_Z_CLASS,
  type FloatingPanelSize,
} from '@/lib/adminFloatingFabLayout'
import { AdminFloatingPanelShell } from '@/components/admin/AdminFloatingPanelShell'
import { useAdminMobileViewport } from '@/hooks/useAdminMobileViewport'
import {
  filterReservationsForOpTodoAction,
  getOpTodoActionLabel,
  normalizeOpTodoActionType,
  parseOpTodoActionConfig,
  tourDateFromOffset,
  type OpTodoWithAction,
} from '@/lib/opTodoAction'
import type { ActionRequiredTabId } from '@/components/reservation/ReservationActionRequiredModal'
import type { FollowUpQueueTabId } from '@/components/reservation/ReservationFollowUpQueueModal'
import { TourDetailResizableDialog } from '@/components/tour/TourDetailResizableDialog'
import { useAdminTodoQueueData } from '@/hooks/useAdminTodoQueueData'
import {
  ADMIN_TODO_WIDGET_STORAGE_KEY,
  readAdminTodoWidgetDocked,
  readAdminTodoWidgetMinimized,
  readAdminTodoWidgetPanelOpen,
  writeAdminTodoWidgetDocked,
  writeAdminTodoWidgetMinimized,
} from '@/lib/adminTodoWidgetPersistence'
import { useReservationFollowUpSnapshots } from '@/hooks/useReservationFollowUpSnapshots'
import { pickReservationsForOperationalQueue } from '@/lib/operationalQueueFetch'
import { getGroupColorClassesForReservations } from '@/utils/groupColors'
import type { Reservation, Customer } from '@/types/reservation'

const ReservationActionRequiredModal = dynamic(
  () => import('@/components/reservation/ReservationActionRequiredModal'),
  { ssr: false }
)
const ReservationFollowUpQueueModal = dynamic(
  () => import('@/components/reservation/ReservationFollowUpQueueModal'),
  { ssr: false }
)

type TodoListTab = 'pending' | 'on_hold' | 'completed'

function todoMatchesListTab(tab: TodoListTab, completed: boolean, onHold: boolean): boolean {
  if (tab === 'completed') return completed
  if (tab === 'on_hold') return onHold && !completed
  return !completed && !onHold
}

function panelVisibleInTab(tab: TodoListTab, completed: boolean, linkedOnHold: boolean): boolean {
  return todoMatchesListTab(tab, completed, linkedOnHold)
}

const STORAGE_KEY = ADMIN_TODO_WIDGET_STORAGE_KEY
const HEADER_HEIGHT = 50
const FAB_STACK_INDEX = 0
const DEFAULT_SIZE: FloatingPanelSize = { width: 380, height: 520 }
const MIN_SIZE: FloatingPanelSize = { width: 300, height: 360 }
const UPDATE_THROTTLE = 16

const CATEGORY_CARD_STYLES: Record<
  string,
  { border: string; borderCompleted: string; badge: string; hover: string }
> = {
  daily: {
    border: 'border-sky-400/70',
    borderCompleted: 'border-sky-200',
    badge: 'bg-sky-100 text-sky-800',
    hover: 'hover:border-sky-400 hover:bg-sky-50/50',
  },
  weekly: {
    border: 'border-slate-400/70',
    borderCompleted: 'border-slate-200',
    badge: 'bg-slate-100 text-slate-700',
    hover: 'hover:border-slate-400 hover:bg-slate-50',
  },
  monthly: {
    border: 'border-green-400/70',
    borderCompleted: 'border-green-200',
    badge: 'bg-green-100 text-green-700',
    hover: 'hover:border-green-400 hover:bg-green-50/50',
  },
  yearly: {
    border: 'border-purple-400/70',
    borderCompleted: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-700',
    hover: 'hover:border-purple-400 hover:bg-purple-50/50',
  },
}

function readSavedSize(): FloatingPanelSize {
  if (typeof window === 'undefined') return DEFAULT_SIZE
  try {
    const saved = localStorage.getItem(`${STORAGE_KEY}.size`)
    if (saved) {
      const parsed = JSON.parse(saved) as FloatingPanelSize
      if (
        Number.isFinite(parsed.width) &&
        Number.isFinite(parsed.height) &&
        parsed.width >= MIN_SIZE.width &&
        parsed.height >= MIN_SIZE.height
      ) {
        return clampFloatingPanelSize(parsed.width, parsed.height, MIN_SIZE, undefined, FAB_STACK_INDEX)
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_SIZE
}

function categoryCardClasses(category: string, completed: boolean, onHold = false): string {
  const style = CATEGORY_CARD_STYLES[category] ?? CATEGORY_CARD_STYLES.daily!
  if (onHold && !completed) {
    return 'border-2 border-amber-300/80 bg-amber-50/60'
  }
  if (completed) {
    return `border-2 ${style.borderCompleted} bg-gray-50/80`
  }
  return `border-2 ${style.border} bg-white ${style.hover}`
}

function categoryLabel(category: string, isKo: boolean): string {
  if (category === 'daily') return isKo ? '일일' : 'Daily'
  if (category === 'weekly') return isKo ? '주간' : 'Weekly'
  if (category === 'monthly') return isKo ? '월간' : 'Monthly'
  if (category === 'yearly') return isKo ? '연간' : 'Yearly'
  return category
}

function readSavedPosition(size: FloatingPanelSize): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: 0, y: 0 }
  try {
    const saved = localStorage.getItem(`${STORAGE_KEY}.position`)
    if (saved) {
      const parsed = JSON.parse(saved) as { x: number; y: number }
      if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
        return clampFloatingPanelPosition(parsed.x, parsed.y, size, {
          stackIndex: FAB_STACK_INDEX,
          headerHeight: HEADER_HEIGHT,
        })
      }
    }
  } catch {
    /* ignore */
  }
  return defaultFloatingPanelPosition(size, {
    stackIndex: FAB_STACK_INDEX,
    headerHeight: HEADER_HEIGHT,
  })
}

function readSavedDocked(): boolean {
  return readAdminTodoWidgetDocked()
}

type AdminTodoFloatingWidgetProps = {
  locale: string
}

export default function AdminTodoFloatingWidget({ locale }: AdminTodoFloatingWidgetProps) {
  const isKo = locale === 'ko'
  const params = useParams()
  const router = useRouter()
  const routeLocale = (params.locale as string) || locale
  const { user, userRole, userPosition } = useAuth()
  const { panelOpen, setPanelOpen, openTodoAction } = useAdminTodo()
  const manualCtx = useTeamBoardManualOptional()
  const isMobile = useAdminMobileViewport()

  const [pendingCount, setPendingCount] = useState(0)
  const [isMinimized, setIsMinimized] = useState(() =>
    readAdminTodoWidgetPanelOpen() ? readAdminTodoWidgetMinimized() : false
  )
  const [isDocked, setIsDocked] = useState(() => readSavedDocked())
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeMode, setResizeMode] = useState<'floating' | 'dock-width'>('floating')
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 })
  const floatPositionRef = useRef<{ x: number; y: number } | null>(null)
  const lastUpdateRef = useRef(0)

  const [position, setPosition] = useState(() => readSavedPosition(readSavedSize()))

  const [size, setSize] = useState<FloatingPanelSize>(readSavedSize)

  const [todos, setTodos] = useState<OpTodoWithAction[]>([])
  const [loading, setLoading] = useState(false)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [activeListTab, setActiveListTab] = useState<TodoListTab>('pending')
  const [createOpen, setCreateOpen] = useState(false)
  const [newTodo, setNewTodo] = useState<OpTodoFormValues>({ ...EMPTY_OP_TODO_FORM })
  const [savingCreate, setSavingCreate] = useState(false)
  const [editingTodo, setEditingTodo] = useState<OpTodoWithAction | null>(null)
  const [editForm, setEditForm] = useState<OpTodoFormValues>({ ...EMPTY_OP_TODO_FORM })
  const [savingEdit, setSavingEdit] = useState(false)
  const [tourQuickPrint, setTourQuickPrint] = useState<TourQuickPrintRequest>(null)
  const [tourPickupNotification, setTourPickupNotification] = useState<TourPickupNotificationRequest>(null)
  const envelopeTargetDate = useMemo(() => tourEnvelopePrintTargetDate(), [])
  const pickupCompletionDateKey = useMemo(() => pickupNotificationCompletionDateKey(), [])
  const guideConfirmCompletionDateKey = useMemo(() => guideScheduleConfirmCompletionDateKey(), [])
  const customerInfoReviewCompletionKey = useMemo(() => customerInfoReviewCompletionDateKey(), [])
  const cancelRebookingFollowUpCompletionKey = useMemo(
    () => cancelRebookingFollowUpCompletionDateKey(),
    []
  )
  const pendingCustomerManagementCompletionKey = useMemo(
    () => pendingCustomerManagementCompletionDateKey(),
    []
  )
  const otaClosureCompletionKey = useMemo(() => otaClosureCompletionDateKey(), [])
  const tourHotelManagementCompletionKey = useMemo(() => tourHotelManagementCompletionDateKey(), [])
  const tourHotelPriceCheckCompletionKey = useMemo(() => tourHotelPriceCheckCompletionDateKey(), [])
  const tourHotelCcFormCompletionKey = useMemo(() => tourHotelCcFormCompletionDateKey(), [])
  const tourSettlementCompletionKey = useMemo(() => tourSettlementCompletionDateKey(), [])
  const reservationAgencyManagementCompletionKey = useMemo(
    () => reservationAgencyManagementCompletionDateKey(),
    []
  )
  const antelopeCanyonBookingCompletionKey = useMemo(
    () => antelopeCanyonBookingCompletionDateKey(),
    []
  )
  const bentoCheckCompletionKey = useMemo(() => bentoCheckCompletionDateKey(), [])
  const [envelopeCompleted, setEnvelopeCompleted] = useState(() =>
    readTourEnvelopePrintLocalCompleted(envelopeTargetDate)
  )
  const [pickupNotificationCompleted, setPickupNotificationCompleted] = useState(() =>
    readPickupNotificationLocalCompleted(pickupCompletionDateKey)
  )
  const [guideScheduleConfirmCompleted, setGuideScheduleConfirmCompleted] = useState(() =>
    readGuideScheduleConfirmLocalCompleted(guideConfirmCompletionDateKey)
  )
  const [customerInfoReviewCompleted, setCustomerInfoReviewCompleted] = useState(() =>
    readCustomerInfoReviewLocalCompleted(customerInfoReviewCompletionKey)
  )
  const [cancelRebookingFollowUpCompleted, setCancelRebookingFollowUpCompleted] = useState(() =>
    readCancelRebookingFollowUpLocalCompleted(cancelRebookingFollowUpCompletionKey)
  )
  const [pendingCustomerManagementCompleted, setPendingCustomerManagementCompleted] = useState(
    () => readPendingCustomerManagementLocalCompleted(pendingCustomerManagementCompletionKey)
  )
  const [otaClosureCompleted, setOtaClosureCompleted] = useState(() =>
    readOtaClosureLocalCompleted(otaClosureCompletionKey)
  )
  const [tourHotelManagementCompleted, setTourHotelManagementCompleted] = useState(() =>
    readTourHotelManagementLocalCompleted(tourHotelManagementCompletionKey)
  )
  const [tourHotelPriceCheckCompleted, setTourHotelPriceCheckCompleted] = useState(() =>
    readTourHotelPriceCheckLocalCompleted(tourHotelPriceCheckCompletionKey)
  )
  const [tourHotelCcFormCompleted, setTourHotelCcFormCompleted] = useState(() =>
    readTourHotelCcFormLocalCompleted(tourHotelCcFormCompletionKey)
  )
  const [tourSettlementCompleted, setTourSettlementCompleted] = useState(() =>
    readTourSettlementLocalCompleted(tourSettlementCompletionKey)
  )
  const [reservationAgencyManagementCompleted, setReservationAgencyManagementCompleted] =
    useState(() =>
      readReservationAgencyManagementLocalCompleted(reservationAgencyManagementCompletionKey)
    )
  const [antelopeCanyonBookingCompleted, setAntelopeCanyonBookingCompleted] = useState(() =>
    readAntelopeCanyonBookingLocalCompleted(antelopeCanyonBookingCompletionKey)
  )
  const [bentoCheckCompleted, setBentoCheckCompleted] = useState(() =>
    readBentoCheckLocalCompleted(bentoCheckCompletionKey)
  )
  const [tourHotelDetailModalId, setTourHotelDetailModalId] = useState<string | null>(null)
  const [onHoldFeatureEnabled, setOnHoldFeatureEnabled] = useState(true)

  const adjustPendingCount = useCallback((todo: OpTodoWithAction, next: { completed: boolean; on_hold: boolean }) => {
    const wasPending = !todo.completed && !todo.on_hold
    const isPending = !next.completed && !next.on_hold
    if (wasPending && !isPending) setPendingCount((c) => Math.max(0, c - 1))
    else if (!wasPending && isPending) setPendingCount((c) => c + 1)
  }, [])

  useEffect(() => {
    const linked = findTourEnvelopePrintLinkedTodo(todos)
    setEnvelopeCompleted(linked?.completed ?? readTourEnvelopePrintLocalCompleted(envelopeTargetDate))
  }, [todos, envelopeTargetDate])

  useEffect(() => {
    const linked = findPickupNotificationLinkedTodo(todos)
    setPickupNotificationCompleted(
      linked?.completed ?? readPickupNotificationLocalCompleted(pickupCompletionDateKey)
    )
  }, [todos, pickupCompletionDateKey])

  useEffect(() => {
    const linked = findGuideScheduleConfirmLinkedTodo(todos)
    setGuideScheduleConfirmCompleted(
      linked?.completed ?? readGuideScheduleConfirmLocalCompleted(guideConfirmCompletionDateKey)
    )
  }, [todos, guideConfirmCompletionDateKey])

  useEffect(() => {
    const linked = findCustomerInfoReviewLinkedTodo(todos)
    setCustomerInfoReviewCompleted(
      linked?.completed ?? readCustomerInfoReviewLocalCompleted(customerInfoReviewCompletionKey)
    )
  }, [todos, customerInfoReviewCompletionKey])

  useEffect(() => {
    const linked = findCancelRebookingFollowUpLinkedTodo(todos)
    setCancelRebookingFollowUpCompleted(
      linked?.completed ??
        readCancelRebookingFollowUpLocalCompleted(cancelRebookingFollowUpCompletionKey)
    )
  }, [todos, cancelRebookingFollowUpCompletionKey])

  useEffect(() => {
    const linked = findPendingCustomerManagementLinkedTodo(todos)
    setPendingCustomerManagementCompleted(
      linked?.completed ??
        readPendingCustomerManagementLocalCompleted(pendingCustomerManagementCompletionKey)
    )
  }, [todos, pendingCustomerManagementCompletionKey])

  useEffect(() => {
    const linked = findOtaClosureLinkedTodo(todos)
    setOtaClosureCompleted(linked?.completed ?? readOtaClosureLocalCompleted(otaClosureCompletionKey))
  }, [todos, otaClosureCompletionKey])

  useEffect(() => {
    const linked = findTourHotelManagementLinkedTodo(todos)
    setTourHotelManagementCompleted(
      linked?.completed ?? readTourHotelManagementLocalCompleted(tourHotelManagementCompletionKey)
    )
  }, [todos, tourHotelManagementCompletionKey])

  useEffect(() => {
    const linked = findTourHotelPriceCheckLinkedTodo(todos)
    setTourHotelPriceCheckCompleted(
      linked?.completed ?? readTourHotelPriceCheckLocalCompleted(tourHotelPriceCheckCompletionKey)
    )
  }, [todos, tourHotelPriceCheckCompletionKey])

  useEffect(() => {
    const linked = findTourHotelCcFormLinkedTodo(todos)
    setTourHotelCcFormCompleted(
      linked?.completed ?? readTourHotelCcFormLocalCompleted(tourHotelCcFormCompletionKey)
    )
  }, [todos, tourHotelCcFormCompletionKey])

  useEffect(() => {
    const linked = findTourSettlementLinkedTodo(todos)
    setTourSettlementCompleted(
      linked?.completed ?? readTourSettlementLocalCompleted(tourSettlementCompletionKey)
    )
  }, [todos, tourSettlementCompletionKey])

  useEffect(() => {
    const linked = findReservationAgencyManagementLinkedTodo(todos)
    setReservationAgencyManagementCompleted(
      linked?.completed ??
        readReservationAgencyManagementLocalCompleted(reservationAgencyManagementCompletionKey)
    )
  }, [todos, reservationAgencyManagementCompletionKey])

  useEffect(() => {
    const linked = findAntelopeCanyonBookingLinkedTodo(todos)
    setAntelopeCanyonBookingCompleted(
      linked?.completed ??
        readAntelopeCanyonBookingLocalCompleted(antelopeCanyonBookingCompletionKey)
    )
  }, [todos, antelopeCanyonBookingCompletionKey])

  useEffect(() => {
    const linked = findBentoCheckLinkedTodo(todos)
    setBentoCheckCompleted(
      linked?.completed ?? readBentoCheckLocalCompleted(bentoCheckCompletionKey)
    )
  }, [todos, bentoCheckCompletionKey])

  const handleEnvelopeToggleLinkedTodo = useCallback(
    async (todo: { id: string; completed: boolean }, completed: boolean) => {
      const full = todos.find((t) => t.id === todo.id)
      if (!full) return
      setSubmittingId(full.id)
      try {
        const { data, error } = await toggleOpTodoCompletion(full, completed)
        if (error) throw error
        const patch = {
          completed: data?.completed ?? completed,
          completed_at: data?.completed_at ?? (completed ? new Date().toISOString() : null),
          next_notify_at: data?.next_notify_at ?? full.next_notify_at ?? null,
          on_hold: data?.on_hold ?? false,
        }
        setTodos((prev) => prev.map((t) => (t.id === full.id ? { ...t, ...patch } : t)))
        adjustPendingCount(full, { completed: patch.completed, on_hold: !!patch.on_hold })
        dispatchOpTodoRefresh()
      } catch (e) {
        console.error(e)
        alert(isKo ? '완료 처리에 실패했습니다.' : 'Failed to update todo.')
        throw e
      } finally {
        setSubmittingId(null)
      }
    },
    [adjustPendingCount, isKo, todos]
  )

  const showEnvelopePrintInList = panelVisibleInTab(
    activeListTab,
    envelopeCompleted,
    findTourEnvelopePrintLinkedTodo(todos)?.on_hold ?? false
  )

  const showPickupNotificationInList = panelVisibleInTab(
    activeListTab,
    pickupNotificationCompleted,
    findPickupNotificationLinkedTodo(todos)?.on_hold ?? false
  )

  const showGuideScheduleConfirmInList = panelVisibleInTab(
    activeListTab,
    guideScheduleConfirmCompleted,
    findGuideScheduleConfirmLinkedTodo(todos)?.on_hold ?? false
  )

  const showCustomerInfoReviewInList = panelVisibleInTab(
    activeListTab,
    customerInfoReviewCompleted,
    findCustomerInfoReviewLinkedTodo(todos)?.on_hold ?? false
  )

  const showCancelRebookingFollowUpInList = panelVisibleInTab(
    activeListTab,
    cancelRebookingFollowUpCompleted,
    findCancelRebookingFollowUpLinkedTodo(todos)?.on_hold ?? false
  )

  const showPendingCustomerManagementInList = panelVisibleInTab(
    activeListTab,
    pendingCustomerManagementCompleted,
    findPendingCustomerManagementLinkedTodo(todos)?.on_hold ?? false
  )

  const showOtaClosureInList = panelVisibleInTab(
    activeListTab,
    otaClosureCompleted,
    findOtaClosureLinkedTodo(todos)?.on_hold ?? false
  )

  const showTourHotelManagementInList = panelVisibleInTab(
    activeListTab,
    tourHotelManagementCompleted,
    findTourHotelManagementLinkedTodo(todos)?.on_hold ?? false
  )

  const showTourSettlementInList = panelVisibleInTab(
    activeListTab,
    tourSettlementCompleted,
    findTourSettlementLinkedTodo(todos)?.on_hold ?? false
  )

  const showReservationAgencyManagementInList = panelVisibleInTab(
    activeListTab,
    reservationAgencyManagementCompleted,
    findReservationAgencyManagementLinkedTodo(todos)?.on_hold ?? false
  )

  const showAntelopeCanyonBookingInList = panelVisibleInTab(
    activeListTab,
    antelopeCanyonBookingCompleted,
    findAntelopeCanyonBookingLinkedTodo(todos)?.on_hold ?? false
  )

  const showBentoCheckInList = panelVisibleInTab(
    activeListTab,
    bentoCheckCompleted,
    findBentoCheckLinkedTodo(todos)?.on_hold ?? false
  )

  const tourHotelPriceCheckOnHold = findTourHotelPriceCheckLinkedTodo(todos)?.on_hold ?? false
  const showTourHotelPriceCheckInList =
    (activeListTab === 'pending' && !tourHotelPriceCheckOnHold) ||
    (activeListTab === 'on_hold' && tourHotelPriceCheckOnHold) ||
    (activeListTab === 'completed' && tourHotelPriceCheckCompleted)

  const showTourHotelCcFormInList = panelVisibleInTab(
    activeListTab,
    tourHotelCcFormCompleted,
    findTourHotelCcFormLinkedTodo(todos)?.on_hold ?? false
  )

  const todoToFormValues = useCallback(
    (todo: OpTodoWithAction): OpTodoFormValues => {
      const category = todo.category
      const department = todo.department
      return {
        title: todo.title,
        category:
          category === 'daily' || category === 'weekly' || category === 'monthly' || category === 'yearly'
            ? category
            : 'daily',
        department:
          department === 'office' || department === 'guide' || department === 'common'
            ? department
            : 'common',
        notify_enabled: !!todo.notify_enabled,
        notify_time: todo.notify_time || '09:00',
        notify_weekday: todo.notify_weekday ?? 1,
        notify_day_of_month: todo.notify_day_of_month ?? 1,
        notify_month: todo.notify_month ?? 1,
        action_type: normalizeOpTodoActionType(todo.action_type),
        action_config: parseOpTodoActionConfig(todo.action_config),
        linked_hub_article_id: todo.linked_hub_article_id ?? null,
      }
    },
    []
  )

  const closeEditTodo = useCallback(() => {
    setEditingTodo(null)
    setEditForm({ ...EMPTY_OP_TODO_FORM })
  }, [])

  const openEditTodo = useCallback(
    (todo: OpTodoWithAction) => {
      setEditingTodo(todo)
      setEditForm(todoToFormValues(todo))
    },
    [todoToFormValues]
  )

  const openEditEnvelopePrintTodo = useCallback(() => {
    const linked = findTourEnvelopePrintLinkedTodo(todos)
    if (linked) {
      openEditTodo(linked)
      return
    }
    setNewTodo({
      ...EMPTY_OP_TODO_FORM,
      ...tourEnvelopePrintTodoFormSeed(locale),
    })
    setCreateOpen(true)
  }, [todos, openEditTodo, locale])

  const handlePickupToggleLinkedTodo = useCallback(
    async (todo: { id: string; completed: boolean }, completed: boolean) => {
      const full = todos.find((t) => t.id === todo.id)
      if (!full) return
      setSubmittingId(full.id)
      try {
        const { data, error } = await toggleOpTodoCompletion(full, completed)
        if (error) throw error
        const patch = {
          completed: data?.completed ?? completed,
          completed_at: data?.completed_at ?? (completed ? new Date().toISOString() : null),
          next_notify_at: data?.next_notify_at ?? full.next_notify_at ?? null,
          on_hold: data?.on_hold ?? false,
        }
        setTodos((prev) => prev.map((t) => (t.id === full.id ? { ...t, ...patch } : t)))
        adjustPendingCount(full, { completed: patch.completed, on_hold: !!patch.on_hold })
        dispatchOpTodoRefresh()
      } catch (e) {
        console.error(e)
        alert(isKo ? '완료 처리에 실패했습니다.' : 'Failed to update todo.')
        throw e
      } finally {
        setSubmittingId(null)
      }
    },
    [adjustPendingCount, isKo, todos]
  )

  const openEditPickupNotificationTodo = useCallback(() => {
    const linked = findPickupNotificationLinkedTodo(todos)
    if (linked) {
      openEditTodo(linked)
      return
    }
    setNewTodo({
      ...EMPTY_OP_TODO_FORM,
      ...pickupNotificationTodoFormSeed(locale),
    })
    setCreateOpen(true)
  }, [todos, openEditTodo, locale])

  const handleGuideScheduleConfirmToggleLinkedTodo = useCallback(
    async (todo: { id: string; completed: boolean }, completed: boolean) => {
      const full = todos.find((t) => t.id === todo.id)
      if (!full) return
      setSubmittingId(full.id)
      try {
        const { data, error } = await toggleOpTodoCompletion(full, completed)
        if (error) throw error
        const patch = {
          completed: data?.completed ?? completed,
          completed_at: data?.completed_at ?? (completed ? new Date().toISOString() : null),
          next_notify_at: data?.next_notify_at ?? full.next_notify_at ?? null,
          on_hold: data?.on_hold ?? false,
        }
        setTodos((prev) => prev.map((t) => (t.id === full.id ? { ...t, ...patch } : t)))
        adjustPendingCount(full, { completed: patch.completed, on_hold: !!patch.on_hold })
        dispatchOpTodoRefresh()
      } catch (e) {
        console.error(e)
        alert(isKo ? '완료 처리에 실패했습니다.' : 'Failed to update todo.')
        throw e
      } finally {
        setSubmittingId(null)
      }
    },
    [adjustPendingCount, isKo, todos]
  )

  const openEditGuideScheduleConfirmTodo = useCallback(() => {
    const linked = findGuideScheduleConfirmLinkedTodo(todos)
    if (linked) {
      openEditTodo(linked)
      return
    }
    setNewTodo({
      ...EMPTY_OP_TODO_FORM,
      ...guideScheduleConfirmTodoFormSeed(locale),
    })
    setCreateOpen(true)
  }, [todos, openEditTodo, locale])

  const handleCustomerInfoReviewToggleLinkedTodo = useCallback(
    async (todo: { id: string; completed: boolean }, completed: boolean) => {
      const full = todos.find((t) => t.id === todo.id)
      if (!full) return
      setSubmittingId(full.id)
      try {
        const { data, error } = await toggleOpTodoCompletion(full, completed)
        if (error) throw error
        const patch = {
          completed: data?.completed ?? completed,
          completed_at: data?.completed_at ?? (completed ? new Date().toISOString() : null),
          next_notify_at: data?.next_notify_at ?? full.next_notify_at ?? null,
          on_hold: data?.on_hold ?? false,
        }
        setTodos((prev) => prev.map((t) => (t.id === full.id ? { ...t, ...patch } : t)))
        adjustPendingCount(full, { completed: patch.completed, on_hold: !!patch.on_hold })
        dispatchOpTodoRefresh()
      } catch (e) {
        console.error(e)
        alert(isKo ? '완료 처리에 실패했습니다.' : 'Failed to update todo.')
        throw e
      } finally {
        setSubmittingId(null)
      }
    },
    [adjustPendingCount, isKo, todos]
  )

  const openEditCustomerInfoReviewTodo = useCallback(() => {
    const linked = findCustomerInfoReviewLinkedTodo(todos)
    if (linked) {
      openEditTodo(linked)
      return
    }
    setNewTodo({
      ...EMPTY_OP_TODO_FORM,
      ...customerInfoReviewTodoFormSeed(locale),
    })
    setCreateOpen(true)
  }, [todos, openEditTodo, locale])

  const handleCancelRebookingFollowUpToggleLinkedTodo = useCallback(
    async (todo: { id: string; completed: boolean }, completed: boolean) => {
      const full = todos.find((t) => t.id === todo.id)
      if (!full) return
      setSubmittingId(full.id)
      try {
        const { data, error } = await toggleOpTodoCompletion(full, completed)
        if (error) throw error
        const patch = {
          completed: data?.completed ?? completed,
          completed_at: data?.completed_at ?? (completed ? new Date().toISOString() : null),
          next_notify_at: data?.next_notify_at ?? full.next_notify_at ?? null,
          on_hold: data?.on_hold ?? false,
        }
        setTodos((prev) => prev.map((t) => (t.id === full.id ? { ...t, ...patch } : t)))
        adjustPendingCount(full, { completed: patch.completed, on_hold: !!patch.on_hold })
        dispatchOpTodoRefresh()
      } catch (e) {
        console.error(e)
        alert(isKo ? '완료 처리에 실패했습니다.' : 'Failed to update todo.')
        throw e
      } finally {
        setSubmittingId(null)
      }
    },
    [adjustPendingCount, isKo, todos]
  )

  const openEditCancelRebookingFollowUpTodo = useCallback(() => {
    const linked = findCancelRebookingFollowUpLinkedTodo(todos)
    if (linked) {
      openEditTodo(linked)
      return
    }
    setNewTodo({
      ...EMPTY_OP_TODO_FORM,
      ...cancelRebookingFollowUpTodoFormSeed(locale),
    })
    setCreateOpen(true)
  }, [todos, openEditTodo, locale])

  const handlePendingCustomerManagementToggleLinkedTodo = useCallback(
    async (todo: { id: string; completed: boolean }, completed: boolean) => {
      const full = todos.find((t) => t.id === todo.id)
      if (!full) return
      setSubmittingId(full.id)
      try {
        const { data, error } = await toggleOpTodoCompletion(full, completed)
        if (error) throw error
        const patch = {
          completed: data?.completed ?? completed,
          completed_at: data?.completed_at ?? (completed ? new Date().toISOString() : null),
          next_notify_at: data?.next_notify_at ?? full.next_notify_at ?? null,
          on_hold: data?.on_hold ?? false,
        }
        setTodos((prev) => prev.map((t) => (t.id === full.id ? { ...t, ...patch } : t)))
        adjustPendingCount(full, { completed: patch.completed, on_hold: !!patch.on_hold })
        dispatchOpTodoRefresh()
      } catch (e) {
        console.error(e)
        alert(isKo ? '완료 처리에 실패했습니다.' : 'Failed to update todo.')
        throw e
      } finally {
        setSubmittingId(null)
      }
    },
    [adjustPendingCount, isKo, todos]
  )

  const openEditPendingCustomerManagementTodo = useCallback(() => {
    const linked = findPendingCustomerManagementLinkedTodo(todos)
    if (linked) {
      openEditTodo(linked)
      return
    }
    setNewTodo({
      ...EMPTY_OP_TODO_FORM,
      ...pendingCustomerManagementTodoFormSeed(locale),
    })
    setCreateOpen(true)
  }, [todos, openEditTodo, locale])

  const handleCancelFollowUpManualChange = useCallback(
    async (reservationId: string, kind: CancelFollowUpManualKind, action: 'mark' | 'clear') => {
      try {
        await upsertReservationCancelFollowUpManual(supabase, reservationId, kind, action)
        dispatchCancelRebookingFollowUpRefresh()
      } catch (e) {
        console.error(e)
        alert(isKo ? '저장에 실패했습니다.' : 'Save failed.')
      }
    },
    [isKo]
  )

  const openReservationFromPanel = useCallback(
    (reservationId: string) => {
      router.push(`/${routeLocale}/admin/reservations/${reservationId}`)
    },
    [router, routeLocale]
  )

  const handleOtaClosureToggleLinkedTodo = useCallback(
    async (todo: { id: string; completed: boolean }, completed: boolean) => {
      const full = todos.find((t) => t.id === todo.id)
      if (!full) return
      setSubmittingId(full.id)
      try {
        const { data, error } = await toggleOpTodoCompletion(full, completed)
        if (error) throw error
        const patch = {
          completed: data?.completed ?? completed,
          completed_at: data?.completed_at ?? (completed ? new Date().toISOString() : null),
          next_notify_at: data?.next_notify_at ?? full.next_notify_at ?? null,
          on_hold: data?.on_hold ?? false,
        }
        setTodos((prev) => prev.map((t) => (t.id === full.id ? { ...t, ...patch } : t)))
        adjustPendingCount(full, { completed: patch.completed, on_hold: !!patch.on_hold })
        dispatchOpTodoRefresh()
      } catch (e) {
        console.error(e)
        alert(isKo ? '완료 처리에 실패했습니다.' : 'Failed to update todo.')
        throw e
      } finally {
        setSubmittingId(null)
      }
    },
    [adjustPendingCount, isKo, todos]
  )

  const openEditOtaClosureTodo = useCallback(() => {
    const linked = findOtaClosureLinkedTodo(todos)
    if (linked) {
      openEditTodo(linked)
      return
    }
    setNewTodo({
      ...EMPTY_OP_TODO_FORM,
      ...otaClosureTodoFormSeed(locale),
    })
    setCreateOpen(true)
  }, [todos, openEditTodo, locale])

  const handleTourHotelManagementToggleLinkedTodo = useCallback(
    async (todo: { id: string; completed: boolean }, completed: boolean) => {
      const full = todos.find((t) => t.id === todo.id)
      if (!full) return
      setSubmittingId(full.id)
      try {
        const { data, error } = await toggleOpTodoCompletion(full, completed)
        if (error) throw error
        const patch = {
          completed: data?.completed ?? completed,
          completed_at: data?.completed_at ?? (completed ? new Date().toISOString() : null),
          next_notify_at: data?.next_notify_at ?? full.next_notify_at ?? null,
          on_hold: data?.on_hold ?? false,
        }
        setTodos((prev) => prev.map((t) => (t.id === full.id ? { ...t, ...patch } : t)))
        adjustPendingCount(full, { completed: patch.completed, on_hold: !!patch.on_hold })
        dispatchOpTodoRefresh()
      } catch (e) {
        console.error(e)
        alert(isKo ? '완료 처리에 실패했습니다.' : 'Failed to update todo.')
        throw e
      } finally {
        setSubmittingId(null)
      }
    },
    [adjustPendingCount, isKo, todos]
  )

  const openEditTourHotelManagementTodo = useCallback(() => {
    const linked = findTourHotelManagementLinkedTodo(todos)
    if (linked) {
      openEditTodo(linked)
      return
    }
    setNewTodo({
      ...EMPTY_OP_TODO_FORM,
      ...tourHotelManagementTodoFormSeed(locale),
    })
    setCreateOpen(true)
  }, [todos, openEditTodo, locale])

  const handleTourHotelPriceCheckToggleLinkedTodo = useCallback(
    async (todo: { id: string; completed: boolean }, completed: boolean) => {
      const full = todos.find((t) => t.id === todo.id)
      if (!full) return
      setSubmittingId(full.id)
      try {
        const { data, error } = await toggleOpTodoCompletion(full, completed)
        if (error) throw error
        const patch = {
          completed: data?.completed ?? completed,
          completed_at: data?.completed_at ?? (completed ? new Date().toISOString() : null),
          next_notify_at: data?.next_notify_at ?? full.next_notify_at ?? null,
          on_hold: data?.on_hold ?? false,
        }
        setTodos((prev) => prev.map((t) => (t.id === full.id ? { ...t, ...patch } : t)))
        adjustPendingCount(full, { completed: patch.completed, on_hold: !!patch.on_hold })
        dispatchOpTodoRefresh()
      } catch (e) {
        console.error(e)
        alert(isKo ? '완료 처리에 실패했습니다.' : 'Failed to update todo.')
        throw e
      } finally {
        setSubmittingId(null)
      }
    },
    [adjustPendingCount, isKo, todos]
  )

  const openEditTourHotelPriceCheckTodo = useCallback(() => {
    const linked = findTourHotelPriceCheckLinkedTodo(todos)
    if (linked) {
      openEditTodo(linked)
      return
    }
    setNewTodo({
      ...EMPTY_OP_TODO_FORM,
      ...tourHotelPriceCheckTodoFormSeed(locale),
    })
    setCreateOpen(true)
  }, [todos, openEditTodo, locale])

  const handleTourHotelCcFormToggleLinkedTodo = useCallback(
    async (todo: { id: string; completed: boolean }, completed: boolean) => {
      const full = todos.find((t) => t.id === todo.id)
      if (!full) return
      setSubmittingId(full.id)
      try {
        const { data, error } = await toggleOpTodoCompletion(full, completed)
        if (error) throw error
        const patch = {
          completed: data?.completed ?? completed,
          completed_at: data?.completed_at ?? (completed ? new Date().toISOString() : null),
          next_notify_at: data?.next_notify_at ?? full.next_notify_at ?? null,
          on_hold: data?.on_hold ?? false,
        }
        setTodos((prev) => prev.map((t) => (t.id === full.id ? { ...t, ...patch } : t)))
        adjustPendingCount(full, { completed: patch.completed, on_hold: !!patch.on_hold })
        dispatchOpTodoRefresh()
      } catch (e) {
        console.error(e)
        alert(isKo ? '완료 처리에 실패했습니다.' : 'Failed to update todo.')
        throw e
      } finally {
        setSubmittingId(null)
      }
    },
    [adjustPendingCount, isKo, todos]
  )

  const openEditTourHotelCcFormTodo = useCallback(() => {
    const linked = findTourHotelCcFormLinkedTodo(todos)
    if (linked) {
      openEditTodo(linked)
      return
    }
    setNewTodo({
      ...EMPTY_OP_TODO_FORM,
      ...tourHotelCcFormTodoFormSeed(locale),
    })
    setCreateOpen(true)
  }, [todos, openEditTodo, locale])

  const handleTourSettlementToggleLinkedTodo = useCallback(
    async (todo: { id: string; completed: boolean }, completed: boolean) => {
      const full = todos.find((t) => t.id === todo.id)
      if (!full) return
      setSubmittingId(full.id)
      try {
        const { data, error } = await toggleOpTodoCompletion(full, completed)
        if (error) throw error
        const patch = {
          completed: data?.completed ?? completed,
          completed_at: data?.completed_at ?? (completed ? new Date().toISOString() : null),
          next_notify_at: data?.next_notify_at ?? full.next_notify_at ?? null,
          on_hold: data?.on_hold ?? false,
        }
        setTodos((prev) => prev.map((t) => (t.id === full.id ? { ...t, ...patch } : t)))
        adjustPendingCount(full, { completed: patch.completed, on_hold: !!patch.on_hold })
        dispatchOpTodoRefresh()
      } catch (e) {
        console.error(e)
        alert(isKo ? '완료 처리에 실패했습니다.' : 'Failed to update todo.')
        throw e
      } finally {
        setSubmittingId(null)
      }
    },
    [adjustPendingCount, isKo, todos]
  )

  const openEditTourSettlementTodo = useCallback(() => {
    const linked = findTourSettlementLinkedTodo(todos)
    if (linked) {
      openEditTodo(linked)
      return
    }
    setNewTodo({
      ...EMPTY_OP_TODO_FORM,
      ...tourSettlementTodoFormSeed(locale),
    })
    setCreateOpen(true)
  }, [todos, openEditTodo, locale])

  const handleReservationAgencyManagementToggleLinkedTodo = useCallback(
    async (todo: { id: string; completed: boolean }, completed: boolean) => {
      const full = todos.find((t) => t.id === todo.id)
      if (!full) return
      setSubmittingId(full.id)
      try {
        const { data, error } = await toggleOpTodoCompletion(full, completed)
        if (error) throw error
        const patch = {
          completed: data?.completed ?? completed,
          completed_at: data?.completed_at ?? (completed ? new Date().toISOString() : null),
          next_notify_at: data?.next_notify_at ?? full.next_notify_at ?? null,
          on_hold: data?.on_hold ?? false,
        }
        setTodos((prev) => prev.map((t) => (t.id === full.id ? { ...t, ...patch } : t)))
        adjustPendingCount(full, { completed: patch.completed, on_hold: !!patch.on_hold })
        dispatchOpTodoRefresh()
      } catch (e) {
        console.error(e)
        alert(isKo ? '완료 처리에 실패했습니다.' : 'Failed to update todo.')
        throw e
      } finally {
        setSubmittingId(null)
      }
    },
    [adjustPendingCount, isKo, todos]
  )

  const openEditReservationAgencyManagementTodo = useCallback(() => {
    const linked = findReservationAgencyManagementLinkedTodo(todos)
    if (linked) {
      openEditTodo(linked)
      return
    }
    setNewTodo({
      ...EMPTY_OP_TODO_FORM,
      ...reservationAgencyManagementTodoFormSeed(locale),
    })
    setCreateOpen(true)
  }, [todos, openEditTodo, locale])

  const handleAntelopeCanyonBookingToggleLinkedTodo = useCallback(
    async (todo: { id: string; completed: boolean }, completed: boolean) => {
      const full = todos.find((t) => t.id === todo.id)
      if (!full) return
      setSubmittingId(full.id)
      try {
        const { data, error } = await toggleOpTodoCompletion(full, completed)
        if (error) throw error
        const patch = {
          completed: data?.completed ?? completed,
          completed_at: data?.completed_at ?? (completed ? new Date().toISOString() : null),
          next_notify_at: data?.next_notify_at ?? full.next_notify_at ?? null,
          on_hold: data?.on_hold ?? false,
        }
        setTodos((prev) => prev.map((t) => (t.id === full.id ? { ...t, ...patch } : t)))
        adjustPendingCount(full, { completed: patch.completed, on_hold: !!patch.on_hold })
        dispatchOpTodoRefresh()
      } catch (e) {
        console.error(e)
        alert(isKo ? '완료 처리에 실패했습니다.' : 'Failed to update todo.')
        throw e
      } finally {
        setSubmittingId(null)
      }
    },
    [adjustPendingCount, isKo, todos]
  )

  const openEditAntelopeCanyonBookingTodo = useCallback(() => {
    const linked = findAntelopeCanyonBookingLinkedTodo(todos)
    if (linked) {
      openEditTodo(linked)
      return
    }
    setNewTodo({
      ...EMPTY_OP_TODO_FORM,
      ...antelopeCanyonBookingTodoFormSeed(locale),
    })
    setCreateOpen(true)
  }, [todos, openEditTodo, locale])

  const handleBentoCheckToggleLinkedTodo = useCallback(
    async (todo: { id: string; completed: boolean }, completed: boolean) => {
      const full = todos.find((t) => t.id === todo.id)
      if (!full) return
      setSubmittingId(full.id)
      try {
        const { data, error } = await toggleOpTodoCompletion(full, completed)
        if (error) throw error
        const patch = {
          completed: data?.completed ?? completed,
          completed_at: data?.completed_at ?? (completed ? new Date().toISOString() : null),
          next_notify_at: data?.next_notify_at ?? full.next_notify_at ?? null,
          on_hold: data?.on_hold ?? false,
        }
        setTodos((prev) => prev.map((t) => (t.id === full.id ? { ...t, ...patch } : t)))
        adjustPendingCount(full, { completed: patch.completed, on_hold: !!patch.on_hold })
        dispatchOpTodoRefresh()
      } catch (e) {
        console.error(e)
        alert(isKo ? '완료 처리에 실패했습니다.' : 'Failed to update todo.')
        throw e
      } finally {
        setSubmittingId(null)
      }
    },
    [adjustPendingCount, isKo, todos]
  )

  const openEditBentoCheckTodo = useCallback(() => {
    const linked = findBentoCheckLinkedTodo(todos)
    if (linked) {
      openEditTodo(linked)
      return
    }
    setNewTodo({
      ...EMPTY_OP_TODO_FORM,
      ...bentoCheckTodoFormSeed(locale),
    })
    setCreateOpen(true)
  }, [todos, openEditTodo, locale])

  const persona = useMemo(
    () =>
      resolveSiteAccessPersona({
        userRole,
        userPosition,
        isSuper: isSuperAdminEmail(user?.email),
        authUserEmail: user?.email,
      }),
    [userRole, userPosition, user?.email]
  )

  const visible = persona === 'op' || persona === 'office_manager' || persona === 'super'
  const viewAllOpTodos = persona === 'super'
  const audiences = useMemo(
    () => opTodoAudiencesForUser(userPosition, { viewAll: viewAllOpTodos }),
    [userPosition, viewAllOpTodos]
  )

  const loadTodos = useCallback(async () => {
    setLoading(true)
    try {
      await runOpTodoResetsIfDue()

      const runLoad = async (selectColumns: string) => {
        let query = supabase
          .from('op_todos')
          .select(selectColumns)
          .order('completed', { ascending: true })
          .order('category', { ascending: true })
          .order('created_at', { ascending: false })
          .limit(200)
        if (!viewAllOpTodos) {
          query = query.in('department', audiences)
        }
        return query
      }

      let useOnHoldSelect = isOpTodoOnHoldFeatureEnabled()
      let { data, error } = await runLoad(getOpTodoSelectColumns())

      if (error && useOnHoldSelect && isMissingOpTodoOnHoldColumnError(error)) {
        markOpTodoOnHoldColumnUnavailable()
        setOnHoldFeatureEnabled(false)
        useOnHoldSelect = false
        ;({ data, error } = await runLoad(getOpTodoSelectColumns()))
      }

      if (error) throw error

      if (useOnHoldSelect) {
        markOpTodoOnHoldColumnAvailable()
        setOnHoldFeatureEnabled(true)
      }

      setTodos(((data || []) as unknown as OpTodoWithAction[]).map(withOpTodoOnHoldDefault))
    } catch (e) {
      console.error('AdminTodoFloatingWidget load', e)
    } finally {
      setLoading(false)
    }
  }, [audiences, viewAllOpTodos])

  useEffect(() => {
    if (!visible || !user?.email) return
    let cancelled = false
    const loadCount = async () => {
      const runCountFallback = async (withOnHoldFilter: boolean) => {
        let query = supabase
          .from('op_todos')
          .select('id', { count: 'exact', head: true })
          .eq('completed', false)
        if (withOnHoldFilter) {
          query = query.eq('on_hold', false)
        }
        if (!viewAllOpTodos) {
          query = query.in('department', audiences)
        }
        return query
      }

      let withOnHoldFilter = isOpTodoOnHoldFeatureEnabled()
      try {
        const count = await fetchOpTodoPendingCount({
          departments: viewAllOpTodos ? null : audiences,
          excludeOnHold: withOnHoldFilter,
        })

        if (withOnHoldFilter) {
          markOpTodoOnHoldColumnAvailable()
          if (!cancelled) setOnHoldFeatureEnabled(true)
        }

        if (!cancelled) setPendingCount(count)
        return
      } catch (rpcError) {
        if (withOnHoldFilter && isMissingOpTodoOnHoldColumnError(rpcError)) {
          markOpTodoOnHoldColumnUnavailable()
          if (!cancelled) setOnHoldFeatureEnabled(false)
          withOnHoldFilter = false
          try {
            const count = await fetchOpTodoPendingCount({
              departments: viewAllOpTodos ? null : audiences,
              excludeOnHold: false,
            })
            if (!cancelled) setPendingCount(count)
            return
          } catch {
            /* fall through */
          }
        }
      }

      let { count, error } = await runCountFallback(withOnHoldFilter)

      if (error && withOnHoldFilter && isMissingOpTodoOnHoldColumnError(error)) {
        markOpTodoOnHoldColumnUnavailable()
        if (!cancelled) setOnHoldFeatureEnabled(false)
        withOnHoldFilter = false
        ;({ count, error } = await runCountFallback(false))
      } else if (!error && withOnHoldFilter) {
        markOpTodoOnHoldColumnAvailable()
        if (!cancelled) setOnHoldFeatureEnabled(true)
      }

      if (!cancelled && !error) setPendingCount(count ?? 0)
    }
    void loadCount()
    const id = window.setInterval(() => void loadCount(), 60000)
    const onRefresh = () => void loadCount()
    window.addEventListener(OP_TODO_REFRESH_EVENT, onRefresh)
    return () => {
      cancelled = true
      window.clearInterval(id)
      window.removeEventListener(OP_TODO_REFRESH_EVENT, onRefresh)
    }
  }, [visible, user?.email, audiences, panelOpen, viewAllOpTodos])

  useEffect(() => {
    if (!panelOpen) return
    const onRefresh = () => void loadTodos()
    window.addEventListener(OP_TODO_REFRESH_EVENT, onRefresh)
    return () => window.removeEventListener(OP_TODO_REFRESH_EVENT, onRefresh)
  }, [panelOpen, loadTodos])

  useEffect(() => {
    if (!panelOpen) return
    void loadTodos()
  }, [panelOpen, loadTodos])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(`${STORAGE_KEY}.position`, JSON.stringify(position))
  }, [position])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(`${STORAGE_KEY}.size`, JSON.stringify(size))
  }, [size])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      writeAdminTodoWidgetDocked(isDocked)
    } catch {
      /* ignore */
    }
  }, [isDocked])

  useEffect(() => {
    if (typeof window === 'undefined') return
    writeAdminTodoWidgetMinimized(isMinimized)
  }, [isMinimized])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const dockActive = panelOpen && isDocked && !isMobile
    setAdminTodoDockLayoutActive(dockActive, size.width)
    return () => {
      setAdminTodoDockLayoutActive(false)
    }
  }, [panelOpen, isDocked, isMobile, size.width])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onViewportChange = () => {
      if (isDocked && !isMobile) {
        setSize((prev) => ({
          ...prev,
          width: clampDockedFloatingPanelWidth(prev.width, MIN_SIZE.width),
        }))
        return
      }
      setSize((prev) => {
        const next = clampFloatingPanelSize(
          prev.width,
          prev.height,
          MIN_SIZE,
          undefined,
          FAB_STACK_INDEX
        )
        setPosition((pos) =>
          clampFloatingPanelPosition(pos.x, pos.y, next, {
            minimized: isMinimized,
            headerHeight: HEADER_HEIGHT,
            stackIndex: FAB_STACK_INDEX,
          })
        )
        return next
      })
    }
    window.addEventListener('resize', onViewportChange)
    window.visualViewport?.addEventListener('resize', onViewportChange)
    return () => {
      window.removeEventListener('resize', onViewportChange)
      window.visualViewport?.removeEventListener('resize', onViewportChange)
    }
  }, [isMinimized, isDocked, isMobile])

  useEffect(() => {
    if (typeof window === 'undefined' || isDocked) return
    setPosition((pos) =>
      clampFloatingPanelPosition(pos.x, pos.y, size, {
        minimized: isMinimized,
        headerHeight: HEADER_HEIGHT,
        stackIndex: FAB_STACK_INDEX,
      })
    )
  }, [size.height, size.width, isMinimized, isDocked])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isDocked) return
    if (e.target instanceof HTMLElement && e.target.closest('[data-todo-resize-handle]')) return
    if (e.target instanceof HTMLElement && e.target.closest('[data-todo-dock-resize-handle]')) return
    if (e.target instanceof HTMLElement && e.target.closest('[data-todo-drag-handle]')) {
      const rect = e.currentTarget.getBoundingClientRect()
      dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      setIsDragging(true)
      e.preventDefault()
    }
  }

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || typeof window === 'undefined') return
      const now = performance.now()
      if (now - lastUpdateRef.current < UPDATE_THROTTLE) return
      lastUpdateRef.current = now
      const rawX = e.clientX - dragOffsetRef.current.x
      const rawY = e.clientY - dragOffsetRef.current.y
      setPosition(
        clampFloatingPanelPosition(rawX, rawY, size, {
          minimized: isMinimized,
          headerHeight: HEADER_HEIGHT,
          stackIndex: FAB_STACK_INDEX,
        })
      )
    },
    [isDragging, isMinimized, size]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(false)
    setResizeMode('floating')
  }, [])

  const toggleDocked = useCallback(() => {
    if (isMobile) return
    setIsDocked((prev) => {
      const next = !prev
      if (next) {
        floatPositionRef.current = position
        setIsMinimized(false)
      } else if (floatPositionRef.current) {
        setPosition(
          clampFloatingPanelPosition(
            floatPositionRef.current.x,
            floatPositionRef.current.y,
            size,
            {
              minimized: isMinimized,
              headerHeight: HEADER_HEIGHT,
              stackIndex: FAB_STACK_INDEX,
            }
          )
        )
      }
      return next
    })
  }, [isMobile, isMinimized, position, size])

  useEffect(() => {
    if (isMobile && isMinimized) setIsMinimized(false)
  }, [isMobile, isMinimized])

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    }
    setResizeMode('floating')
    setIsResizing(true)
  }

  const handleDockedResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    }
    setResizeMode('dock-width')
    setIsResizing(true)
  }

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || typeof window === 'undefined') return
      const now = performance.now()
      if (now - lastUpdateRef.current < UPDATE_THROTTLE) return
      lastUpdateRef.current = now

      if (resizeMode === 'dock-width') {
        const deltaX = resizeStartRef.current.x - e.clientX
        const nextWidth = clampDockedFloatingPanelWidth(
          resizeStartRef.current.width + deltaX,
          MIN_SIZE.width
        )
        setSize((prev) => ({ ...prev, width: nextWidth }))
        return
      }

      const deltaX = e.clientX - resizeStartRef.current.x
      const deltaY = e.clientY - resizeStartRef.current.y
      const nextSize = clampFloatingPanelSize(
        resizeStartRef.current.width + deltaX,
        resizeStartRef.current.height + deltaY,
        MIN_SIZE,
        undefined,
        FAB_STACK_INDEX
      )
      setSize(nextSize)
      setPosition((pos) =>
        clampFloatingPanelPosition(pos.x, pos.y, nextSize, {
          stackIndex: FAB_STACK_INDEX,
          headerHeight: HEADER_HEIGHT,
        })
      )
    },
    [isResizing, resizeMode]
  )

  useEffect(() => {
    if (!isDragging && !isResizing) return
    const onMove = (e: MouseEvent) => {
      if (isResizing) handleResizeMove(e)
      else handleMouseMove(e)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isResizing, handleMouseMove, handleResizeMove, handleMouseUp])

  const listTodos = useMemo(
    () =>
      todos.filter(
        (t) =>
          !shouldHideTodoChipForEnvelopePrintPanel(t) &&
          !shouldHideTodoChipForPickupNotificationPanel(t) &&
          !shouldHideTodoChipForGuideScheduleConfirmPanel(t) &&
          !shouldHideTodoChipForCustomerInfoReviewPanel(t) &&
          !shouldHideTodoChipForCancelRebookingFollowUpPanel(t) &&
          !shouldHideTodoChipForPendingCustomerManagementPanel(t) &&
          !shouldHideTodoChipForOtaClosurePanel(t) &&
          !shouldHideTodoChipForTourHotelManagementPanel(t) &&
          !shouldHideTodoChipForTourHotelPriceCheckPanel(t) &&
          !shouldHideTodoChipForTourHotelCcFormPanel(t) &&
          !shouldHideTodoChipForTourSettlementPanel(t) &&
          !shouldHideTodoChipForReservationAgencyManagementPanel(t) &&
          !shouldHideTodoChipForAntelopeCanyonBookingPanel(t) &&
          !shouldHideTodoChipForBentoCheckPanel(t)
      ),
    [todos]
  )

  const pendingTodos = useMemo(
    () => listTodos.filter((t) => todoMatchesListTab('pending', t.completed, !!t.on_hold)),
    [listTodos]
  )
  const onHoldTodos = useMemo(
    () => listTodos.filter((t) => todoMatchesListTab('on_hold', t.completed, !!t.on_hold)),
    [listTodos]
  )
  const completedTodos = useMemo(() => listTodos.filter((t) => t.completed), [listTodos])
  const visibleTodos =
    activeListTab === 'pending'
      ? pendingTodos
      : activeListTab === 'on_hold'
        ? onHoldTodos
        : completedTodos

  const todoListTabs = useMemo(() => {
    const tabs = [
      { id: 'pending' as const, label: isKo ? '해야 할 일' : 'To do', count: pendingTodos.length },
      ...(onHoldFeatureEnabled
        ? [{ id: 'on_hold' as const, label: isKo ? '보류' : 'On hold', count: onHoldTodos.length }]
        : []),
      { id: 'completed' as const, label: isKo ? '완료' : 'Done', count: completedTodos.length },
    ]
    return tabs
  }, [isKo, onHoldFeatureEnabled, pendingTodos.length, onHoldTodos.length, completedTodos.length])

  useEffect(() => {
    if (!onHoldFeatureEnabled && activeListTab === 'on_hold') {
      setActiveListTab('pending')
    }
  }, [activeListTab, onHoldFeatureEnabled])

  const completionPct = useMemo(() => {
    if (!todos.length) return 0
    return Math.round((todos.filter((t) => t.completed).length / todos.length) * 100)
  }, [todos])

  const toggleTodoOnHold = async (todo: OpTodoWithAction) => {
    if (!user?.email || !onHoldFeatureEnabled) return
    setSubmittingId(todo.id)
    const next = !todo.on_hold
    try {
      const { data, error } = await setOpTodoOnHold(todo.id, next)
      if (error) throw error
      const patch = {
        on_hold: data?.on_hold ?? next,
        completed: data?.completed ?? false,
        completed_at: data?.completed_at ?? null,
      }
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, ...patch } : t)))
      adjustPendingCount(todo, patch)
      dispatchOpTodoRefresh()
    } catch (e) {
      console.error(e)
      if (isMissingOpTodoOnHoldColumnError(e)) {
        markOpTodoOnHoldColumnUnavailable()
        setOnHoldFeatureEnabled(false)
        alert(
          isKo
            ? '보류 기능을 사용하려면 DB 마이그레이션(20260728140000_op_todos_on_hold.sql)을 적용해 주세요.'
            : 'Apply migration 20260728140000_op_todos_on_hold.sql to enable on-hold.'
        )
      } else {
        alert(isKo ? '보류 처리에 실패했습니다.' : 'Failed to update hold status.')
      }
    } finally {
      setSubmittingId(null)
    }
  }

  const envelopeLinkedTodo = useMemo(() => findTourEnvelopePrintLinkedTodo(todos), [todos])
  const pickupLinkedTodo = useMemo(() => findPickupNotificationLinkedTodo(todos), [todos])
  const guideLinkedTodo = useMemo(() => findGuideScheduleConfirmLinkedTodo(todos), [todos])
  const customerReviewLinkedTodo = useMemo(() => findCustomerInfoReviewLinkedTodo(todos), [todos])
  const cancelRebookingLinkedTodo = useMemo(
    () => findCancelRebookingFollowUpLinkedTodo(todos),
    [todos]
  )
  const pendingCustomerLinkedTodo = useMemo(
    () => findPendingCustomerManagementLinkedTodo(todos),
    [todos]
  )
  const otaClosureLinkedTodo = useMemo(() => findOtaClosureLinkedTodo(todos), [todos])
  const tourHotelMgmtLinkedTodo = useMemo(() => findTourHotelManagementLinkedTodo(todos), [todos])
  const tourHotelPriceLinkedTodo = useMemo(() => findTourHotelPriceCheckLinkedTodo(todos), [todos])
  const tourHotelCcFormLinkedTodo = useMemo(() => findTourHotelCcFormLinkedTodo(todos), [todos])
  const tourSettlementLinkedTodo = useMemo(() => findTourSettlementLinkedTodo(todos), [todos])
  const reservationAgencyLinkedTodo = useMemo(
    () => findReservationAgencyManagementLinkedTodo(todos),
    [todos]
  )
  const antelopeCanyonBookingLinkedTodo = useMemo(
    () => findAntelopeCanyonBookingLinkedTodo(todos),
    [todos]
  )
  const bentoCheckLinkedTodo = useMemo(() => findBentoCheckLinkedTodo(todos), [todos])

  const panelHoldProps = useCallback(
    (linked: { id: string; on_hold?: boolean | null } | null | undefined) => {
      const holdDisabledHint = !onHoldFeatureEnabled
        ? isKo
          ? '보류 기능: DB 마이그레이션(20260728140000_op_todos_on_hold.sql) 적용 필요'
          : 'On hold requires migration 20260728140000_op_todos_on_hold.sql'
        : !linked
          ? isKo
            ? '팀보드에서 연결된 할일이 있을 때 보류할 수 있습니다'
            : 'Link a to-do in Team Board to enable on-hold'
          : undefined

      return {
        onHold: !!linked?.on_hold,
        holdEnabled: onHoldFeatureEnabled && !!linked,
        holdBusy: linked ? submittingId === linked.id : false,
        ...(holdDisabledHint ? { holdDisabledHint } : {}),
        ...(linked
          ? {
              onToggleHold: () => {
                const full = todos.find((t) => t.id === linked.id)
                if (full) void toggleTodoOnHold(full)
              },
            }
          : {}),
      }
    },
    [isKo, onHoldFeatureEnabled, submittingId, todos]
  )

  const toggleComplete = async (todo: OpTodoWithAction) => {
    if (!user?.email) return
    setSubmittingId(todo.id)
    const next = !todo.completed
    try {
      const { data, error } = await toggleOpTodoCompletion(todo, next)
      if (error) throw error
      const patch = {
        completed: data?.completed ?? next,
        completed_at: data?.completed_at ?? (next ? new Date().toISOString() : null),
        next_notify_at: data?.next_notify_at ?? todo.next_notify_at ?? null,
        on_hold: data?.on_hold ?? false,
      }
      setTodos((prev) =>
        prev.map((t) => (t.id === todo.id ? { ...t, ...patch } : t))
      )
      adjustPendingCount(todo, { completed: patch.completed, on_hold: !!patch.on_hold })
    } catch (e) {
      console.error(e)
      alert(isKo ? '완료 처리에 실패했습니다.' : 'Failed to update todo.')
    } finally {
      setSubmittingId(null)
    }
  }

  const openWidget = () => {
    setPanelOpen(true)
    setIsMinimized(false)
    const savedSize = readSavedSize()
    if (isDocked && !isMobile) {
      setSize((prev) => ({
        ...prev,
        width: clampDockedFloatingPanelWidth(savedSize.width, MIN_SIZE.width),
        height: savedSize.height,
      }))
      return
    }
    setSize(savedSize)
    setPosition(readSavedPosition(savedSize))
  }

  const closeWidget = () => {
    setPanelOpen(false)
    setIsMinimized(false)
    setCreateOpen(false)
    setEditingTodo(null)
    setEditForm({ ...EMPTY_OP_TODO_FORM })
    setNewTodo({ ...EMPTY_OP_TODO_FORM })
  }

  const openCreateModal = () => {
    setNewTodo({ ...EMPTY_OP_TODO_FORM })
    setCreateOpen(true)
  }

  const closeCreateModal = () => {
    setCreateOpen(false)
    setNewTodo({ ...EMPTY_OP_TODO_FORM })
  }

  const buildNotifyPayload = (form: OpTodoFormValues) => {
    const schedule = form.notify_enabled
      ? {
          category: form.category,
          notifyTime: form.notify_time,
          notifyWeekday: form.notify_weekday,
          notifyDayOfMonth: form.notify_day_of_month,
          notifyMonth: form.notify_month,
        }
      : null
    const nextNotify = schedule ? computeNextNotifyAtIso(schedule) : null
    return {
      notify_enabled: !!form.notify_enabled,
      notify_time: form.notify_enabled ? form.notify_time : null,
      notify_weekday: form.notify_enabled && form.category === 'weekly' ? form.notify_weekday : null,
      notify_day_of_month:
        form.notify_enabled && (form.category === 'monthly' || form.category === 'yearly')
          ? form.notify_day_of_month
          : null,
      notify_month: form.notify_enabled && form.category === 'yearly' ? form.notify_month : null,
      next_notify_at: form.notify_enabled ? nextNotify : null,
    }
  }

  const createTodo = async () => {
    if (!newTodo.title.trim() || !user?.email) return
    setSavingCreate(true)
    try {
      const { data, error } = await supabase
        .from('op_todos')
        .insert([
          {
            title: newTodo.title.trim(),
            description: null,
            scope: 'common',
            category: newTodo.category,
            department: newTodo.department,
            assigned_to: null,
            created_by: user.email,
            ...buildNotifyPayload(newTodo),
            action_type: newTodo.action_type,
            action_config: newTodo.action_config,
            linked_hub_article_id: newTodo.linked_hub_article_id,
          },
        ] as never[])
        .select()
        .single()
      if (error) throw error
      const created = data as OpTodoWithAction
      setTodos((prev) => [created, ...prev])
      if (!created.completed) setPendingCount((c) => c + 1)
      dispatchOpTodoRefresh()
      closeCreateModal()
    } catch (e) {
      console.error(e)
      alert(isKo ? 'ToDo 생성 중 오류가 발생했습니다.' : 'Failed to create todo.')
    } finally {
      setSavingCreate(false)
    }
  }

  const updateTodo = async () => {
    if (!editingTodo || !editForm.title.trim()) return
    setSavingEdit(true)
    try {
      const { data, error } = await supabase
        .from('op_todos')
        .update({
          title: editForm.title.trim(),
          category: editForm.category,
          department: editForm.department,
          ...buildNotifyPayload(editForm),
          action_type: editForm.action_type,
          action_config: editForm.action_config,
          linked_hub_article_id: editForm.linked_hub_article_id,
        } as never)
        .eq('id', editingTodo.id)
        .select()
        .single()
      if (error) throw error
      const updated = data as OpTodoWithAction
      setTodos((prev) => prev.map((t) => (t.id === editingTodo.id ? updated : t)))
      dispatchOpTodoRefresh()
      closeEditTodo()
    } catch (e) {
      console.error(e)
      alert(isKo ? 'ToDo 수정 중 오류가 발생했습니다.' : 'Failed to update todo.')
    } finally {
      setSavingEdit(false)
    }
  }

  const deleteTodo = async () => {
    if (!editingTodo) return
    if (!confirm(isKo ? '정말로 이 항목을 삭제하시겠습니까?' : 'Delete this todo?')) return
    setSavingEdit(true)
    try {
      const wasPending = !editingTodo.completed
      const { error } = await supabase.from('op_todos').delete().eq('id', editingTodo.id)
      if (error) throw error
      setTodos((prev) => prev.filter((t) => t.id !== editingTodo.id))
      if (wasPending) setPendingCount((c) => Math.max(0, c - 1))
      dispatchOpTodoRefresh()
      closeEditTodo()
    } catch (e) {
      console.error(e)
      alert(isKo ? 'ToDo 삭제 중 오류가 발생했습니다.' : 'Failed to delete todo.')
    } finally {
      setSavingEdit(false)
    }
  }

  const todoFormModals = (
    <>
      <OpTodoFormModal
        open={createOpen}
        mode="create"
        locale={locale}
        values={newTodo}
        onChange={setNewTodo}
        onClose={closeCreateModal}
        onSave={createTodo}
        saving={savingCreate}
      />
      <OpTodoFormModal
        open={!!editingTodo}
        mode="edit"
        locale={locale}
        values={editForm}
        onChange={setEditForm}
        onClose={closeEditTodo}
        onSave={updateTodo}
        onDelete={deleteTodo}
        saving={savingEdit}
      />
    </>
  )

  const createTodoModal = (
    <>
      {todoFormModals}
      {tourQuickPrint ? (
        <LazyTourQuickPrintHost
          locale={locale}
          request={tourQuickPrint}
          onClose={() => setTourQuickPrint(null)}
        />
      ) : null}
      {tourPickupNotification ? (
        <LazyTourPickupNotificationHost
          locale={locale}
          request={tourPickupNotification}
          onClose={() => setTourPickupNotification(null)}
        />
      ) : null}
      <TourDetailResizableDialog
        open={Boolean(tourHotelDetailModalId)}
        onOpenChange={(open) => !open && setTourHotelDetailModalId(null)}
        tourId={tourHotelDetailModalId}
        onNavigateToTour={setTourHotelDetailModalId}
        stackLevel="elevated"
        accessibilityTitle={isKo ? '투어 상세' : 'Tour detail'}
      />
    </>
  )

  if (!visible) return null

  const headerTitle = isKo ? '업무 Todo' : 'Work Todos'
  const headerSubtitle =
    pendingCount > 0
      ? isKo
        ? `미완료 ${pendingCount}건 · ${completionPct}%`
        : `${pendingCount} pending · ${completionPct}%`
      : isKo
        ? `전체 ${completionPct}% 완료`
        : `${completionPct}% done`

  const headerChrome = (
    <div
      data-todo-drag-handle={isMobile || isDocked ? undefined : true}
      className={`select-none bg-gradient-to-r from-emerald-600 to-emerald-700 text-white ${
        isMobile || isDocked ? '' : `cursor-grab ${isDragging ? 'cursor-grabbing' : ''}`
      } ${isMinimized && !isMobile && !isDocked ? 'rounded-lg' : isMobile ? '' : isDocked ? '' : 'rounded-t-lg'}`}
      style={{ height: HEADER_HEIGHT }}
    >
      <div className="flex h-full items-center justify-between px-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {pendingCount > 0 && (
            <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {pendingCount > 99 ? '99+' : pendingCount}
            </span>
          )}
          <ClipboardList className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold leading-tight">{headerTitle}</p>
            <p className="truncate text-[10px] text-white/80">{headerSubtitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={openCreateModal}
            className="rounded p-1 transition-colors hover:bg-black/20"
            title={isKo ? '새 업무 추가' : 'Add todo'}
            aria-label={isKo ? '새 업무 추가' : 'Add todo'}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          {!isMobile && (
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={toggleDocked}
              className={`rounded p-1 transition-colors hover:bg-black/20 ${isDocked ? 'bg-white/15' : ''}`}
              title={
                isDocked
                  ? isKo
                    ? '오른쪽 고정 해제'
                    : 'Undock panel'
                  : isKo
                    ? '오른쪽에 고정'
                    : 'Dock to right'
              }
              aria-label={
                isDocked
                  ? isKo
                    ? '오른쪽 고정 해제'
                    : 'Undock panel'
                  : isKo
                    ? '오른쪽에 고정'
                    : 'Dock to right'
              }
              aria-pressed={isDocked}
            >
              {isDocked ? (
                <PanelRightClose className="h-3.5 w-3.5" />
              ) : (
                <PanelRight className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          {!isMobile && (
            <button
              type="button"
              onClick={() => setIsMinimized((v) => !v)}
              className="rounded p-1 transition-colors hover:bg-black/20"
              title={isMinimized ? (isKo ? '펼치기' : 'Expand') : isKo ? '최소화' : 'Minimize'}
            >
              {isMinimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
            </button>
          )}
          <button
            type="button"
            onClick={closeWidget}
            className="rounded p-1 transition-colors hover:bg-black/20"
            title={isKo ? '닫기' : 'Close'}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )

  if (!panelOpen) {
    return (
      <>
        <button
        type="button"
        onClick={openWidget}
        className={`fixed ${ADMIN_FLOATING_FAB_Z_CLASS} flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-xl ring-2 ring-white/20 transition hover:scale-105 hover:shadow-emerald-900/30 active:scale-95 lg:h-14 lg:w-14 lg:shadow-2xl`}
        style={{
          right: '1rem',
          bottom: fabBottomCss(FAB_STACK_INDEX),
        }}
        aria-label={isKo ? '업무 Todo 열기' : 'Open work todos'}
        title={headerTitle}
      >
        <ClipboardList className="h-5 w-5 lg:h-6 lg:w-6" />
        {pendingCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full border-2 border-white bg-red-500 px-0.5 text-[9px] font-bold leading-none text-white lg:h-5 lg:min-w-[1.25rem] lg:px-1 lg:text-[10px]">
            {pendingCount > 99 ? '99+' : pendingCount}
          </span>
        )}
      </button>
      </>
    )
  }

  const resizeHandle = !isMobile && !isDocked ? (
    <button
      type="button"
      aria-label={isKo ? '크기 조절' : 'Resize panel'}
      data-todo-resize-handle
      onMouseDown={handleResizeMouseDown}
      className={`absolute bottom-0 right-0 z-10 flex h-5 w-5 cursor-nwse-resize items-end justify-end p-0.5 text-gray-400 transition-colors hover:text-emerald-600 ${
        isResizing ? 'text-emerald-600' : ''
      }`}
    >
      <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
        <path
          d="M11 11L11 6M11 11L6 11M11 11L4 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </button>
  ) : null

  const dockedResizeHandle =
    !isMobile && isDocked ? (
      <button
        type="button"
        aria-label={isKo ? '패널 너비 조절' : 'Resize panel width'}
        data-todo-dock-resize-handle
        onMouseDown={handleDockedResizeMouseDown}
        className={`absolute bottom-0 left-0 top-0 z-10 w-1.5 cursor-ew-resize border-0 bg-transparent p-0 transition-colors hover:bg-emerald-500/25 ${
          isResizing && resizeMode === 'dock-width' ? 'bg-emerald-500/35' : ''
        }`}
      />
    ) : null

  const panelBody = (
    <>
      <div className="flex shrink-0 items-stretch border-b border-gray-200 bg-gray-50/90">
        <div className="flex min-w-0 flex-1">
          {todoListTabs.map(({ id, label, count }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveListTab(id)}
              className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-2 text-xs font-medium transition-colors ${
                activeListTab === id
                  ? 'border-emerald-600 bg-white text-emerald-700'
                  : 'border-transparent text-gray-500 hover:bg-white/60 hover:text-gray-700'
              }`}
            >
              <span>{label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                  activeListTab === id ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {count}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void loadTodos()}
          className="shrink-0 border-l border-gray-200 px-3 text-[11px] font-medium text-emerald-700 hover:bg-white/60"
        >
          {isKo ? '새로고침' : 'Refresh'}
        </button>
      </div>

      <div className="mb-1 px-3 pt-2 shrink-0">
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <ul className="space-y-1.5">
            {visibleTodos.length === 0 &&
            !showEnvelopePrintInList &&
            !showPickupNotificationInList &&
            !showGuideScheduleConfirmInList &&
            !showCustomerInfoReviewInList &&
            !showCancelRebookingFollowUpInList &&
            !showPendingCustomerManagementInList &&
            !showOtaClosureInList &&
            !showTourHotelManagementInList &&
            !showTourHotelPriceCheckInList &&
            !showTourHotelCcFormInList &&
            !showTourSettlementInList &&
            !showReservationAgencyManagementInList &&
            !showAntelopeCanyonBookingInList &&
            !showBentoCheckInList ? (
              <li className="list-none py-12 text-center text-sm text-gray-500">
                {activeListTab === 'pending'
                  ? isKo
                    ? '해야 할 일이 없습니다.'
                    : 'Nothing to do.'
                  : activeListTab === 'on_hold'
                    ? isKo
                      ? '보류 중인 항목이 없습니다.'
                      : 'Nothing on hold.'
                    : isKo
                      ? '완료된 항목이 없습니다.'
                      : 'No completed items.'}
              </li>
            ) : null}
              <li
                className={`rounded-lg px-2.5 py-2 transition-colors ${categoryCardClasses(
                  'daily',
                  envelopeCompleted,
                  envelopeLinkedTodo?.on_hold ?? false
                )} ${showEnvelopePrintInList ? '' : 'hidden'}`}
                aria-hidden={!showEnvelopePrintInList}
              >
                <TourEnvelopePrintPanel
                  locale={locale}
                  variant="list"
                  linkedTodos={todos as never}
                  onCompletedChange={setEnvelopeCompleted}
                  onToggleLinkedTodo={handleEnvelopeToggleLinkedTodo}
                  onQuickPrint={(tourId, kind) => setTourQuickPrint({ tourId, kind })}
                  onEditRequest={openEditEnvelopePrintTodo}
                  {...panelHoldProps(envelopeLinkedTodo)}
                />
              </li>
              <li
                className={`rounded-lg px-2.5 py-2 transition-colors ${categoryCardClasses(
                  'daily',
                  pickupNotificationCompleted,
                  pickupLinkedTodo?.on_hold ?? false
                )} ${showPickupNotificationInList ? '' : 'hidden'}`}
                aria-hidden={!showPickupNotificationInList}
              >
                <PickupNotificationPanel
                  locale={locale}
                  variant="list"
                  linkedTodos={todos as never}
                  onCompletedChange={setPickupNotificationCompleted}
                  onToggleLinkedTodo={handlePickupToggleLinkedTodo}
                  onPickupAction={(tourId, kind) => setTourPickupNotification({ tourId, kind })}
                  onEditRequest={openEditPickupNotificationTodo}
                  {...panelHoldProps(pickupLinkedTodo)}
                />
              </li>
              <li
                className={`rounded-lg px-2.5 py-2 transition-colors ${categoryCardClasses(
                  'daily',
                  guideScheduleConfirmCompleted,
                  guideLinkedTodo?.on_hold ?? false
                )} ${showGuideScheduleConfirmInList ? '' : 'hidden'}`}
                aria-hidden={!showGuideScheduleConfirmInList}
              >
                <GuideScheduleConfirmPanel
                  locale={locale}
                  variant="list"
                  linkedTodos={todos as never}
                  onCompletedChange={setGuideScheduleConfirmCompleted}
                  onToggleLinkedTodo={handleGuideScheduleConfirmToggleLinkedTodo}
                  onEditRequest={openEditGuideScheduleConfirmTodo}
                  {...panelHoldProps(guideLinkedTodo)}
                />
              </li>
              <li
                className={`rounded-lg px-2.5 py-2 transition-colors ${categoryCardClasses(
                  'daily',
                  customerInfoReviewCompleted,
                  customerReviewLinkedTodo?.on_hold ?? false
                )} ${showCustomerInfoReviewInList ? '' : 'hidden'}`}
                aria-hidden={!showCustomerInfoReviewInList}
              >
                <CustomerInfoReviewPanel
                  locale={locale}
                  variant="list"
                  linkedTodos={todos as never}
                  onCompletedChange={setCustomerInfoReviewCompleted}
                  onToggleLinkedTodo={handleCustomerInfoReviewToggleLinkedTodo}
                  onEditRequest={openEditCustomerInfoReviewTodo}
                  {...panelHoldProps(customerReviewLinkedTodo)}
                />
              </li>
              <li
                className={`rounded-lg px-2.5 py-2 transition-colors ${categoryCardClasses(
                  'daily',
                  cancelRebookingFollowUpCompleted,
                  cancelRebookingLinkedTodo?.on_hold ?? false
                )} ${showCancelRebookingFollowUpInList ? '' : 'hidden'}`}
                aria-hidden={!showCancelRebookingFollowUpInList}
              >
                <CancelRebookingFollowUpPanel
                  locale={locale}
                  variant="list"
                  linkedTodos={todos as never}
                  onCompletedChange={setCancelRebookingFollowUpCompleted}
                  onToggleLinkedTodo={handleCancelRebookingFollowUpToggleLinkedTodo}
                  onEditRequest={openEditCancelRebookingFollowUpTodo}
                  onOpenReservation={openReservationFromPanel}
                  onCancelFollowUpManualChange={handleCancelFollowUpManualChange}
                  {...panelHoldProps(cancelRebookingLinkedTodo)}
                />
              </li>
              <li
                className={`rounded-lg px-2.5 py-2 transition-colors ${categoryCardClasses(
                  'daily',
                  pendingCustomerManagementCompleted,
                  pendingCustomerLinkedTodo?.on_hold ?? false
                )} ${showPendingCustomerManagementInList ? '' : 'hidden'}`}
                aria-hidden={!showPendingCustomerManagementInList}
              >
                <PendingCustomerManagementPanel
                  locale={locale}
                  variant="list"
                  linkedTodos={todos as never}
                  onCompletedChange={setPendingCustomerManagementCompleted}
                  onToggleLinkedTodo={handlePendingCustomerManagementToggleLinkedTodo}
                  onEditRequest={openEditPendingCustomerManagementTodo}
                  onOpenReservation={openReservationFromPanel}
                  {...panelHoldProps(pendingCustomerLinkedTodo)}
                />
              </li>
              <li
                className={`rounded-lg px-2.5 py-2 transition-colors ${categoryCardClasses(
                  'daily',
                  otaClosureCompleted,
                  otaClosureLinkedTodo?.on_hold ?? false
                )} ${showOtaClosureInList ? '' : 'hidden'}`}
                aria-hidden={!showOtaClosureInList}
              >
                <OtaClosurePanel
                  locale={locale}
                  variant="list"
                  linkedTodos={todos as never}
                  onCompletedChange={setOtaClosureCompleted}
                  onToggleLinkedTodo={handleOtaClosureToggleLinkedTodo}
                  onEditRequest={openEditOtaClosureTodo}
                  {...panelHoldProps(otaClosureLinkedTodo)}
                />
              </li>
              <li
                className={`rounded-lg px-2.5 py-2 transition-colors ${categoryCardClasses(
                  'daily',
                  tourHotelManagementCompleted,
                  tourHotelMgmtLinkedTodo?.on_hold ?? false
                )} ${showTourHotelManagementInList ? '' : 'hidden'}`}
                aria-hidden={!showTourHotelManagementInList}
              >
                <TourHotelManagementPanel
                  locale={locale}
                  variant="list"
                  linkedTodos={todos as never}
                  onCompletedChange={setTourHotelManagementCompleted}
                  onToggleLinkedTodo={handleTourHotelManagementToggleLinkedTodo}
                  onEditRequest={openEditTourHotelManagementTodo}
                  onOpenTourDetail={setTourHotelDetailModalId}
                  {...panelHoldProps(tourHotelMgmtLinkedTodo)}
                />
              </li>
              <li
                className={`rounded-lg px-2.5 py-2 transition-colors ${categoryCardClasses(
                  'daily',
                  tourHotelPriceCheckCompleted,
                  tourHotelPriceLinkedTodo?.on_hold ?? false
                )} ${showTourHotelPriceCheckInList ? '' : 'hidden'}`}
                aria-hidden={!showTourHotelPriceCheckInList}
              >
                <TourHotelPriceCheckPanel
                  locale={locale}
                  variant="list"
                  linkedTodos={todos as never}
                  onCompletedChange={setTourHotelPriceCheckCompleted}
                  onToggleLinkedTodo={handleTourHotelPriceCheckToggleLinkedTodo}
                  onEditRequest={openEditTourHotelPriceCheckTodo}
                  onOpenTourDetail={setTourHotelDetailModalId}
                  {...panelHoldProps(tourHotelPriceLinkedTodo)}
                />
              </li>
              <li
                className={`rounded-lg px-2.5 py-2 transition-colors ${categoryCardClasses(
                  'daily',
                  tourHotelCcFormCompleted,
                  tourHotelCcFormLinkedTodo?.on_hold ?? false
                )} ${showTourHotelCcFormInList ? '' : 'hidden'}`}
                aria-hidden={!showTourHotelCcFormInList}
              >
                <TourHotelCcFormPanel
                  locale={locale}
                  variant="list"
                  linkedTodos={todos as never}
                  onCompletedChange={setTourHotelCcFormCompleted}
                  onToggleLinkedTodo={handleTourHotelCcFormToggleLinkedTodo}
                  onEditRequest={openEditTourHotelCcFormTodo}
                  onOpenTourDetail={setTourHotelDetailModalId}
                  {...panelHoldProps(tourHotelCcFormLinkedTodo)}
                />
              </li>
              <li
                className={`rounded-lg px-2.5 py-2 transition-colors ${categoryCardClasses(
                  'daily',
                  tourSettlementCompleted,
                  tourSettlementLinkedTodo?.on_hold ?? false
                )} ${showTourSettlementInList ? '' : 'hidden'}`}
                aria-hidden={!showTourSettlementInList}
              >
                <TourSettlementPanel
                  locale={locale}
                  variant="list"
                  linkedTodos={todos as never}
                  onCompletedChange={setTourSettlementCompleted}
                  onToggleLinkedTodo={handleTourSettlementToggleLinkedTodo}
                  onEditRequest={openEditTourSettlementTodo}
                  onOpenTourDetail={setTourHotelDetailModalId}
                  {...panelHoldProps(tourSettlementLinkedTodo)}
                />
              </li>
              <li
                className={`rounded-lg px-2.5 py-2 transition-colors ${categoryCardClasses(
                  'daily',
                  reservationAgencyManagementCompleted,
                  reservationAgencyLinkedTodo?.on_hold ?? false
                )} ${showReservationAgencyManagementInList ? '' : 'hidden'}`}
                aria-hidden={!showReservationAgencyManagementInList}
              >
                <ReservationAgencyManagementPanel
                  locale={locale}
                  variant="list"
                  linkedTodos={todos as never}
                  onCompletedChange={setReservationAgencyManagementCompleted}
                  onToggleLinkedTodo={handleReservationAgencyManagementToggleLinkedTodo}
                  onEditRequest={openEditReservationAgencyManagementTodo}
                  {...panelHoldProps(reservationAgencyLinkedTodo)}
                />
              </li>
              <li
                className={`rounded-lg px-2.5 py-2 transition-colors ${categoryCardClasses(
                  'daily',
                  antelopeCanyonBookingCompleted,
                  antelopeCanyonBookingLinkedTodo?.on_hold ?? false
                )} ${showAntelopeCanyonBookingInList ? '' : 'hidden'}`}
                aria-hidden={!showAntelopeCanyonBookingInList}
              >
                <AntelopeCanyonBookingPanel
                  locale={locale}
                  variant="list"
                  linkedTodos={todos as never}
                  onCompletedChange={setAntelopeCanyonBookingCompleted}
                  onToggleLinkedTodo={handleAntelopeCanyonBookingToggleLinkedTodo}
                  onEditRequest={openEditAntelopeCanyonBookingTodo}
                  onOpenTourDetail={setTourHotelDetailModalId}
                  {...panelHoldProps(antelopeCanyonBookingLinkedTodo)}
                />
              </li>
              <li
                className={`rounded-lg px-2.5 py-2 transition-colors ${categoryCardClasses(
                  'daily',
                  bentoCheckCompleted,
                  bentoCheckLinkedTodo?.on_hold ?? false
                )} ${showBentoCheckInList ? '' : 'hidden'}`}
                aria-hidden={!showBentoCheckInList}
              >
                <BentoCheckPanel
                  locale={locale}
                  variant="list"
                  linkedTodos={todos as never}
                  onCompletedChange={setBentoCheckCompleted}
                  onToggleLinkedTodo={handleBentoCheckToggleLinkedTodo}
                  onEditRequest={openEditBentoCheckTodo}
                  onOpenTourDetail={setTourHotelDetailModalId}
                  {...panelHoldProps(bentoCheckLinkedTodo)}
                />
              </li>
            {visibleTodos.map((todo) => {
              const actionType = normalizeOpTodoActionType(todo.action_type)
              const actionConfig = parseOpTodoActionConfig(todo.action_config)
              const hasAction = actionType !== 'none'
              const hasManual = !!todo.linked_hub_article_id?.trim()
              const busy = submittingId === todo.id
              const onHold = !!todo.on_hold
              const catStyle = CATEGORY_CARD_STYLES[todo.category] ?? CATEGORY_CARD_STYLES.daily!
              return (
                <li
                  key={todo.id}
                  title={isKo ? '우클릭: 수정' : 'Right-click to edit'}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    openEditTodo(todo)
                  }}
                  className={`rounded-lg px-2.5 py-2 transition-colors ${categoryCardClasses(
                    todo.category,
                    todo.completed,
                    onHold
                  )}`}
                >
                  <div className="flex items-start gap-2">
                    <TodoPanelStatusButtons
                      locale={locale}
                      completed={todo.completed}
                      onHold={onHold}
                      busy={busy}
                      holdBusy={busy}
                      holdEnabled={onHoldFeatureEnabled}
                      holdDisabledHint={
                        !onHoldFeatureEnabled
                          ? isKo
                            ? '보류 기능: DB 마이그레이션(20260728140000_op_todos_on_hold.sql) 적용 필요'
                            : 'On hold requires migration 20260728140000_op_todos_on_hold.sql'
                          : undefined
                      }
                      onToggleComplete={() => void toggleComplete(todo)}
                      onToggleHold={() => void toggleTodoOnHold(todo)}
                    />
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        disabled={!hasManual && !hasAction}
                        onClick={() => {
                          if (hasManual) {
                            manualCtx?.openManual(todo.linked_hub_article_id)
                            return
                          }
                          if (hasAction) openTodoAction(todo)
                        }}
                        className={`w-full text-left ${
                          hasManual || hasAction ? 'group cursor-pointer' : 'cursor-default'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p
                            className={`text-[13px] font-medium leading-snug ${
                              todo.completed
                                ? 'text-gray-400 line-through'
                                : onHold
                                  ? 'text-amber-900'
                                  : 'text-gray-900'
                            } ${hasManual || hasAction ? 'group-hover:text-emerald-700' : ''}`}
                          >
                            {todo.title}
                          </p>
                          {onHold && !todo.completed ? (
                            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                              {isKo ? '보류' : 'On hold'}
                            </span>
                          ) : null}
                          {todo.category === 'daily' ? (
                            <span
                              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${catStyle.badge}`}
                            >
                              {categoryLabel(todo.category, isKo)}
                            </span>
                          ) : null}
                        </div>
                        {(todo.category !== 'daily' || hasManual || hasAction) ? (
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {todo.category !== 'daily' ? (
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${catStyle.badge}`}
                            >
                              {categoryLabel(todo.category, isKo)}
                            </span>
                          ) : null}
                          {hasManual && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-800">
                              <BookOpen className="h-2.5 w-2.5" />
                              {isKo ? '메뉴얼' : 'Manual'}
                            </span>
                          )}
                          {hasAction && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                              <ExternalLink className="h-2.5 w-2.5" />
                              {getOpTodoActionLabel(actionType, actionConfig, locale)}
                            </span>
                          )}
                        </div>
                        ) : null}
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )

  return (
    <>
      <AdminFloatingPanelShell
        isMobile={isMobile}
        isMinimized={isMinimized}
        panelOpen={panelOpen}
        position={position}
        size={size}
        minSize={MIN_SIZE}
        minimizedHeight={HEADER_HEIGHT}
        docked={isDocked && !isMobile}
        dockedResizeHandle={dockedResizeHandle}
        onMouseDown={handleMouseDown}
        header={headerChrome}
        resizeHandle={resizeHandle}
      >
        {panelBody}
      </AdminFloatingPanelShell>
      {createTodoModal}
    </>
  )
}

export function AdminTodoActionHost({ locale }: { locale: string }) {
  const router = useRouter()
  const params = useParams()
  const routeLocale = (params.locale as string) || locale
  const isKo = routeLocale === 'ko'
  const { activeAction, closeTodoAction } = useAdminTodo()
  const actionType = activeAction?.actionType
  const actionConfig = activeAction?.actionConfig ?? {}
  const isOpen = Boolean(activeAction)

  const needsQueue =
    isOpen && (actionType === 'reservation_action' || actionType === 'reservation_follow_up')

  const queue = useAdminTodoQueueData({ enabled: needsQueue })
  const productsById = useMemo(() => {
    const m = new Map<string, { name?: string | null; name_ko?: string | null; name_en?: string | null }>()
    for (const p of (queue.products as Array<{ id: string; name?: string; name_ko?: string; name_en?: string }>) || []) {
      m.set(p.id, p)
    }
    return m
  }, [queue.products])

  const reservations = useMemo(() => {
    const base = pickReservationsForOperationalQueue(queue.snapshot, [])
    return filterReservationsForOpTodoAction(base, actionConfig, productsById)
  }, [queue.snapshot, actionConfig, productsById])

  const reservationsLite = useMemo(
    () =>
      reservations.map((r) => ({
        id: r.id,
        status: r.status,
        tourDate: r.tourDate,
        tourTime: r.tourTime,
        productId: r.productId,
      })),
    [reservations]
  )

  const { snapshotsByReservationId, loading: followUpLoading, patchCancelManualFlags } =
    useReservationFollowUpSnapshots(
    reservationsLite,
    (queue.products as Array<{ id: string; product_code?: string | null }>) || [],
    0,
    { loadDeferred: false }
  )

  const [tourModalId, setTourModalId] = useState<string | null>(null)
  const [choicesCache] = useState(() => new Map())
  const [emailDropdownOpen, setEmailDropdownOpen] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setTourModalId(null)
      return
    }
    if (actionType === 'tour_detail' && actionConfig.tourId) {
      setTourModalId(actionConfig.tourId)
      return
    }
    if (actionType === 'tours_page') {
      const date = tourDateFromOffset(actionConfig.tourDateOffsetDays)
      const qs = new URLSearchParams()
      if (date) qs.set('date', date)
      if (actionConfig.productId) qs.set('productId', actionConfig.productId)
      router.push(`/${routeLocale}/admin/tours${qs.toString() ? `?${qs}` : ''}`)
      closeTodoAction()
      return
    }
    if (actionType === 'reservations_page') {
      const path = actionConfig.path || `/${routeLocale}/admin/reservations`
      router.push(path)
      closeTodoAction()
      return
    }
    if (actionType === 'team_board') {
      router.push(`/${routeLocale}/admin/team-board`)
      closeTodoAction()
      return
    }
    if (actionType === 'custom_url' && actionConfig.url) {
      if (actionConfig.url.startsWith('http')) {
        window.open(actionConfig.url, '_blank', 'noopener,noreferrer')
      } else {
        router.push(actionConfig.url)
      }
      closeTodoAction()
    }
  }, [isOpen, actionType, actionConfig, router, routeLocale, closeTodoAction])

  const tourInfoMap = useMemo(() => {
    const m = new Map<string, {
      totalPeople: number
      otherReservationsTotalPeople: number
      allDateTotalPeople: number
      allDateOtherStatusPeople: number
      status: string
      guideName: string
      assistantName: string
      vehicleName: string
      tourDate: string
      tourStartDatetime: string | null
      isAssigned: boolean
      reservationIds: string[]
      productId: string | null
    }>()
    for (const r of reservations) {
      m.set(r.id, {
        totalPeople: 0,
        otherReservationsTotalPeople: 0,
        allDateTotalPeople: 0,
        allDateOtherStatusPeople: 0,
        status: r.status || '',
        guideName: '',
        assistantName: '',
        vehicleName: '',
        tourDate: String(r.tourDate || ''),
        tourStartDatetime: null,
        isAssigned: false,
        reservationIds: [],
        productId: null,
      })
    }
    return m
  }, [reservations])

  const noop = useCallback(() => undefined, [])
  const navigateReservation = useCallback(
    (reservationId: string) => {
      router.push(`/${routeLocale}/admin/reservations/${reservationId}`)
      closeTodoAction()
    },
    [router, routeLocale, closeTodoAction]
  )

  const handleEditClick = useCallback(
    (reservationId: string) => navigateReservation(reservationId),
    [navigateReservation]
  )

  const handleDetailClick = useCallback(
    (reservation: Reservation) => navigateReservation(reservation.id),
    [navigateReservation]
  )

  const generatePriceCalculation = useCallback(() => '', [])
  const getSelectedChoices = useCallback(async () => [], [])

  const initialActionTab = (actionConfig.tab as ActionRequiredTabId) || 'status'
  const initialFollowUpTab = (actionConfig.tab as FollowUpQueueTabId) || 'confirm'

  const handleCancelFollowUpManualChangeInActionHost = useCallback(
    async (reservationId: string, kind: CancelFollowUpManualKind, action: 'mark' | 'clear') => {
      try {
        const result = await upsertReservationCancelFollowUpManual(
          supabase,
          reservationId,
          kind,
          action
        )
        if (result) {
          patchCancelManualFlags(
            reservationId,
            result.cancelFollowUpManual,
            result.cancelRebookingOutreachManual
          )
        }
        dispatchCancelRebookingFollowUpRefresh()
      } catch (e) {
        console.error(e)
        alert(isKo ? '저장에 실패했습니다.' : 'Save failed.')
      }
    },
    [isKo, patchCancelManualFlags]
  )

  const renderFollowUpCard = useCallback(
    (reservation: Reservation) => (
      <LazyReservationCardItem
        reservation={reservation}
        customers={(queue.customers as Customer[]) || []}
        products={(queue.products as Array<{ id: string; name: string }>) || []}
        channels={(queue.channels as Array<{ id: string; name: string }>) || []}
        pickupHotels={queue.pickupHotels || []}
        productOptions={(queue.productOptions as Array<{ id: string; name: string; is_required?: boolean }>) || []}
        optionChoices={(queue.optionChoices as Array<{ id: string; name: string }>) || []}
        locale={routeLocale}
        tourInfoMap={tourInfoMap}
        reservationPricingMap={queue.reservationPricingMap}
        onPricingInfoClick={handleDetailClick}
        onCreateTour={noop}
        onPickupTimeClick={noop}
        onPickupHotelClick={noop}
        onPaymentClick={noop}
        onDetailClick={handleDetailClick}
        onReviewClick={noop}
        onEmailPreview={noop}
        onEmailLogsClick={noop}
        onEditClick={handleEditClick}
        onCustomerClick={noop}
        onRefreshReservations={() => void queue.reload()}
        onCancelFollowUpManualChange={handleCancelFollowUpManualChangeInActionHost}
        onCancellationReasonSaved={() => dispatchCancelRebookingFollowUpRefresh()}
        generatePriceCalculation={generatePriceCalculation}
        getGroupColorClasses={getGroupColorClassesForReservations}
        getSelectedChoicesFromNewSystem={getSelectedChoices}
        choicesCacheRef={{ current: choicesCache }}
        followUpPipelineSnapshot={snapshotsByReservationId.get(reservation.id) ?? null}
        followUpPipelineSnapshotLoaded={snapshotsByReservationId.has(reservation.id)}
      />
    ),
    [
      queue.customers,
      queue.products,
      queue.channels,
      queue.pickupHotels,
      queue.productOptions,
      queue.optionChoices,
      queue.reservationPricingMap,
      queue.reload,
      routeLocale,
      tourInfoMap,
      handleDetailClick,
      handleEditClick,
      noop,
      generatePriceCalculation,
      getSelectedChoices,
      choicesCache,
      snapshotsByReservationId,
      handleCancelFollowUpManualChangeInActionHost,
    ]
  )

  return (
    <>
      <TourDetailResizableDialog
        open={Boolean(tourModalId)}
        onOpenChange={(open) => !open && closeTodoAction()}
        tourId={tourModalId}
        onNavigateToTour={setTourModalId}
        stackLevel="default"
        accessibilityTitle={isKo ? '투어 상세' : 'Tour detail'}
      />

      {actionType === 'reservation_action' && (
        <ReservationActionRequiredModal
          isOpen={isOpen}
          onClose={closeTodoAction}
          bulkReservationsLoading={queue.loading && !queue.snapshot}
          bulkReservationsSyncing={queue.loading && !!queue.snapshot}
          reservations={reservations}
          customers={(queue.customers as Customer[]) || []}
          products={(queue.products as Array<{ id: string; name: string; sub_category?: string; base_price?: number }>) || []}
          channels={(queue.channels as Array<{ id: string; name: string; favicon_url?: string | null; type?: string | null; category?: string | null; commission_percent?: number | null }>) || []}
          pickupHotels={queue.pickupHotels || []}
          productOptions={(queue.productOptions as Array<{ id: string; name: string; is_required?: boolean }>) || []}
          optionChoices={(queue.optionChoices as Array<{ id: string; name: string; option_id?: string; adult_price?: number; child_price?: number; infant_price?: number }>) || []}
          tourInfoMap={tourInfoMap}
          reservationPricingMap={queue.reservationPricingMap}
          locale={routeLocale}
          onPricingInfoClick={handleDetailClick}
          onCreateTour={noop}
          onPickupTimeClick={noop}
          onPickupHotelClick={noop}
          onPaymentClick={noop}
          onDetailClick={handleDetailClick}
          onReviewClick={noop}
          onEmailPreview={noop}
          onEmailLogsClick={noop}
          onEmailDropdownToggle={setEmailDropdownOpen}
          onEditClick={handleEditClick}
          onCustomerClick={noop}
          onRefreshReservations={() => void queue.reload()}
          onRefreshTableList={() => void queue.reload()}
          generatePriceCalculation={generatePriceCalculation}
          getGroupColorClasses={getGroupColorClassesForReservations}
          getSelectedChoicesFromNewSystem={getSelectedChoices}
          choicesCacheRef={{ current: choicesCache }}
          emailDropdownOpen={emailDropdownOpen}
          sendingEmail={null}
          initialTab={initialActionTab}
        />
      )}

      {actionType === 'reservation_follow_up' && (
        <ReservationFollowUpQueueModal
          isOpen={isOpen}
          onClose={closeTodoAction}
          bulkReservationsLoading={queue.loading && !queue.snapshot}
          bulkReservationsSyncing={queue.loading && !!queue.snapshot}
          reservations={reservations}
          customers={(queue.customers as Customer[]) || []}
          snapshotsByReservationId={snapshotsByReservationId}
          loadingSnapshots={followUpLoading}
          renderSimpleReservationCard={renderFollowUpCard}
          initialTab={initialFollowUpTab}
          onCancelFollowUpManualChange={handleCancelFollowUpManualChangeInActionHost}
        />
      )}
    </>
  )
}
