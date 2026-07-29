'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { useTranslations } from 'next-intl'
import { useParams, useRouter } from 'next/navigation'
import { Check, Circle, Edit, Link2, Loader2, MessageCircle, Pin, PinOff, Plus, Trash2, X, BookOpen } from 'lucide-react'
import { TeamBoardTodoManagePanel } from '@/components/team-board/TeamBoardTodoManagePanel'
import { HubArticleManualLinkField } from '@/components/team-board/HubArticleManualLinkField'
import { useTeamBoardManualOptional } from '@/contexts/TeamBoardManualContext'
import { OP_TODO_REFRESH_EVENT } from '@/lib/opTodoRefresh'
import { toggleOpTodoCompletion } from '@/lib/opTodoToggleCompletion'
import { opTodoHasAction, useOpTodoActionClick } from '@/hooks/useOpTodoActionClick'
import { TourEnvelopePrintPanel } from '@/components/admin/todo/TourEnvelopePrintPanel'
import { PickupNotificationPanel } from '@/components/admin/todo/PickupNotificationPanel'
import { GuideScheduleConfirmPanel } from '@/components/admin/todo/GuideScheduleConfirmPanel'
import { CustomerInfoReviewPanel } from '@/components/admin/todo/CustomerInfoReviewPanel'
import { CancelRebookingFollowUpPanel } from '@/components/admin/todo/CancelRebookingFollowUpPanel'
import { PendingCustomerManagementPanel } from '@/components/admin/todo/PendingCustomerManagementPanel'
import { OtaClosurePanel } from '@/components/admin/todo/OtaClosurePanel'
import { TourHotelManagementPanel } from '@/components/admin/todo/TourHotelManagementPanel'
import { TourHotelPriceCheckPanel } from '@/components/admin/todo/TourHotelPriceCheckPanel'
import { TourSettlementPanel } from '@/components/admin/todo/TourSettlementPanel'
import { ReservationAgencyManagementPanel } from '@/components/admin/todo/ReservationAgencyManagementPanel'
import { AntelopeCanyonBookingPanel } from '@/components/admin/todo/AntelopeCanyonBookingPanel'
import { AdminTodoListManualButton } from '@/components/admin/todo/AdminTodoListManualModal'
import {
  TourQuickPrintHost,
  type TourQuickPrintKind,
  type TourQuickPrintRequest,
} from '@/components/admin/todo/TourQuickPrintHost'
import {
  TourPickupNotificationHost,
  type TourPickupNotificationKind,
  type TourPickupNotificationRequest,
} from '@/components/admin/todo/TourPickupNotificationHost'
import {
  shouldHideTodoChipForEnvelopePrintPanel,
  findTourEnvelopePrintLinkedTodo,
  readTourEnvelopePrintLocalCompleted,
  tourEnvelopePrintTargetDate,
  tourEnvelopePrintTodoFormSeed,
} from '@/lib/tourEnvelopePrintTodo'
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
import type { OpTodoFormValues } from '@/components/admin/todo/OpTodoFormFields'
import {
  readTeamBoardPrimaryCache,
  readTeamBoardWorkCache,
} from '@/lib/teamBoard/teamBoardDataCache'
import {
  fetchOpTodosOnly,
  fetchTeamBoardBootstrap,
  runOpTodoResetsIfDue,
  TB_STATUS_LOGS_LIMIT,
} from '@/lib/teamBoard/teamBoardFetch'
import { resolveOpTodoDepartmentFilter } from '@/lib/teamBoard/opTodoDepartmentFilter'
import { useDeferredPanelMount } from '@/hooks/useDeferredPanelMount'
import { useInViewport } from '@/hooks/useInViewport'
import { TodoPanelMountSkeleton } from '@/components/team-board/TodoPanelMountSkeleton'

type Announcement = {
  id: string
  title: string
  content: string
  is_pinned: boolean
  recipients: string[] | null
  target_positions: string[] | null
  priority: 'low' | 'normal' | 'high' | 'urgent' | null
  tags: string[] | null
  due_by: string | null
  is_archived: boolean | null
  is_deleted: boolean | null
  deleted_at: string | null
  deleted_by: string | null
  created_by: string
  created_at: string
  updated_at: string
  linked_hub_article_id?: string | null
}


type Acknowledgment = {
  id: string
  announcement_id: string
  ack_by: string
  ack_at: string
}

type OpTodo = {
  id: string
  title: string
  description: string | null
  scope: 'common' | 'individual'
  category: 'daily' | 'weekly' | 'monthly' | 'yearly'
  department: 'office' | 'guide' | 'common'
  assigned_to: string | null
  due_date: string | null
  completed: boolean
  completed_at: string | null
  created_by: string
  created_at: string
  updated_at: string
  notify_enabled?: boolean | null
  notify_time?: string | null
  notify_weekday?: number | null
  notify_day_of_month?: number | null
  notify_month?: number | null
  next_notify_at?: string | null
  action_type?: string | null
  action_config?: Record<string, unknown> | null
  linked_hub_article_id?: string | null
}


type Issue = {
  id: string
  title: string
  description: string | null
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  reported_by: string
  is_deleted: boolean | null
  deleted_at: string | null
  deleted_by: string | null
  created_at: string
  updated_at: string
}

type Task = {
  id: string
  title: string
  description: string | null
  due_date: string | null
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  created_by: string
  assigned_to: string | null
  target_positions: string[] | null
  target_individuals: string[] | null
  tags: string[] | null
  is_deleted: boolean | null
  deleted_at: string | null
  deleted_by: string | null
  created_at: string
  updated_at: string
  linked_hub_article_id?: string | null
}

type TodoClickLog = {
  id: string
  todo_id: string
  user_email: string
  action: 'completed' | 'uncompleted'
  timestamp: string
  created_at: string
}

type TeamMember = {
  email: string
  name_ko: string | null
  position: string | null
  is_active: boolean
}

type TeamBoardComment = {
  id: string
  target_type: 'task' | 'announcement' | 'issue'
  target_id: string
  comment: string
  created_by: string
  created_at: string
}

type TeamBoardStatusLog = {
  id: string
  target_type: 'task' | 'announcement' | 'issue'
  target_id: string
  action: 'completed' | 'deleted' | 'restored' | 'status_changed'
  from_state: string | null
  to_state: string | null
  note: string | null
  changed_by: string
  changed_at: string
}

/** PostgREST/Supabase에서 테이블·뷰가 없을 때 흔한 오류 형태 */
function isMissingSupabaseRelationError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { message?: string; code?: string; details?: string }
  const m = String(e.message || '').toLowerCase()
  const d = String(e.details || '').toLowerCase()
  const c = String(e.code || '')
  return (
    m.includes('not found') ||
    m.includes('does not exist') ||
    m.includes('schema cache') ||
    m.includes('relation') ||
    d.includes('not found') ||
    c === '42P01' ||
    c === 'PGRST301' ||
    c === 'PGRST205'
  )
}

/** 초기 로드 페이로드·쿼리 시간 절감용 (필요 시 상향) */

const POSITION_OPTIONS = [
  { value: 'manager', label: '매니저' },
  { value: 'admin', label: '관리자' },
  { value: 'tour guide', label: '가이드' },
  { value: 'op', label: 'OP' },
  { value: 'driver', label: '드라이버' },
] as const

const TASK_PRIORITY_BORDER: Record<'low' | 'medium' | 'high' | 'urgent', string> = {
  low: 'border-gray-300',
  medium: 'border-blue-400',
  high: 'border-orange-400',
  urgent: 'border-red-500 border-2',
}

const TASK_PRIORITY_BADGE: Record<'low' | 'medium' | 'high' | 'urgent', { label: string; className: string }> = {
  low: { label: '낮음', className: 'bg-gray-100 text-gray-600' },
  medium: { label: '보통', className: 'bg-primary/10 text-primary' },
  high: { label: '높음', className: 'bg-orange-100 text-orange-700' },
  urgent: { label: '긴급', className: 'bg-red-600 text-white' },
}

const getTaskPriorityBorderClass = (priority: Task['priority']) =>
  TASK_PRIORITY_BORDER[priority] ?? TASK_PRIORITY_BORDER.medium

const getTaskPriorityBadge = (priority: Task['priority']) =>
  TASK_PRIORITY_BADGE[priority] ?? TASK_PRIORITY_BADGE.medium

const getTeamMemberDisplayName = (email: string | null | undefined, members: TeamMember[]) => {
  if (!email) return '작성자'
  const member = members.find(m => (m.email || '').toLowerCase() === email.toLowerCase())
  return member?.name_ko || email.split('@')[0]
}

const getPositionLabel = (value: string) =>
  POSITION_OPTIONS.find(p => p.value === value || normalizePosition(p.value) === normalizePosition(value))?.label ?? value

const getTaskTargetBadges = (task: Task, members: TeamMember[]) => {
  if (task.target_individuals?.length) {
    return task.target_individuals.map(email => ({
      key: email,
      label: getTeamMemberDisplayName(email, members),
      className: 'bg-primary/10 text-primary',
    }))
  }
  if (task.target_positions?.length) {
    return task.target_positions.map(pos => ({
      key: pos,
      label: getPositionLabel(pos),
      className: 'bg-purple-100 text-purple-700',
    }))
  }
  if (task.assigned_to) {
    return [{
      key: task.assigned_to,
      label: getTeamMemberDisplayName(task.assigned_to, members),
      className: 'bg-primary/10 text-primary',
    }]
  }
  return []
}

const normalizePosition = (position: string | null | undefined): string => {
  const normalized = (position || '').trim().toLowerCase()

  if (!normalized) return ''
  if (normalized === 'office manager' || normalized === 'office_manager' || normalized === 'manager' || normalized === '매니저') return 'manager'
  if (normalized === 'super' || normalized === 'admin') return 'admin'
  if (normalized === 'tour guide' || normalized === 'guide') return 'tour guide'
  if (normalized === 'office' || normalized === 'op') return 'op'
  if (normalized === 'driver') return 'driver'

  return normalized
}

export default function TeamBoardPageInner() {
  const { authUser, userRole, userPosition } = useAuth()
  const manualCtx = useTeamBoardManualOptional()
  const params = useParams()
  const router = useRouter()
  const uiLocale = typeof params?.locale === 'string' ? params.locale : 'ko'
  // supabase 클라이언트는 AuthContext에서 관리됨
  
  // useTranslations 훅을 조건부로 사용
  let t: (key: string) => string
  try {
    const translations = useTranslations('teamBoard')
    t = translations
  } catch (error) {
    console.warn('useTranslations failed, using fallback:', error)
    // fallback 함수
    t = (key: string) => {
      const fallbacks: Record<string, string> = {
        'tasks': '업무',
        'newTodo': '새 ToDo',
        'checklist': '체크리스트',
        'noTodos': '등록된 ToDo가 없습니다.',
        'filters.catDaily': 'Daily',
        'filters.catMonthly': 'Monthly',
        'filters.catYearly': 'Yearly'
      }
      return fallbacks[key] || key
    }
  }
  const primaryCache = typeof window !== 'undefined' ? readTeamBoardPrimaryCache() : null
  const workCache = typeof window !== 'undefined' ? readTeamBoardWorkCache() : null
  const [loading, setLoading] = useState(() => !primaryCache)
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => workCache?.announcements ?? [])
  const [acksByAnnouncement, setAcksByAnnouncement] = useState<Record<string, Acknowledgment[]>>(
    () => workCache?.acksByAnnouncement ?? {}
  )
  const [showNewAnnouncement, setShowNewAnnouncement] = useState(false)
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', recipients: [] as string[], priority: 'normal' as 'low'|'normal'|'high'|'urgent', tags: '' , target_positions: [] as string[], linked_hub_article_id: null as string | null })
  const [submitting, setSubmitting] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [editAnnouncement, setEditAnnouncement] = useState({ title: '', content: '', recipients: [] as string[], priority: 'normal' as 'low'|'normal'|'high'|'urgent', tags: '' , target_positions: [] as string[], linked_hub_article_id: null as string | null })

  const [opTodos, setOpTodos] = useState<OpTodo[]>(() => primaryCache?.opTodos ?? [])
  const [showNewTodoModal, setShowNewTodoModal] = useState(false)
  const [showTodoCreateModal, setShowTodoCreateModal] = useState(false)
  const [editTodoId, setEditTodoId] = useState<string | null>(null)
  const [todoCreateFormSeed, setTodoCreateFormSeed] = useState<Partial<OpTodoFormValues> | null>(null)
  const [tourQuickPrint, setTourQuickPrint] = useState<TourQuickPrintRequest>(null)
  const [tourPickupNotification, setTourPickupNotification] = useState<TourPickupNotificationRequest>(null)
  
  // 클릭 기록을 위한 상태 (현재 사용되지 않음)
  // const [clickLogs, setClickLogs] = useState<Record<string, { user: string; timestamp: string; action: 'completed' | 'uncompleted' }[]>>({})
  
  // 히스토리 모달 상태
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<'daily' | 'weekly' | 'monthly' | 'yearly' | null>(null)
  const [categoryHistory, setCategoryHistory] = useState<{ user: string; timestamp: string; action: 'completed' | 'uncompleted'; todoTitle: string }[]>([])
  
  // Todo List department 필터 상태
  const [selectedDepartment, setSelectedDepartment] = useState<'all' | 'office' | 'guide' | 'common'>('all')

  // 카테고리별 히스토리 불러오기
  const loadCategoryHistory = async (category: 'daily' | 'weekly' | 'monthly' | 'yearly') => {
    try {
      // 해당 카테고리의 todo들 가져오기
      const categoryTodos = opTodos.filter(todo => todo.category === category)
      const todoIds = categoryTodos.map(todo => todo.id)
      
      if (todoIds.length === 0) {
        setCategoryHistory([])
        return
      }

      const { data, error } = await supabase
        .from('todo_click_logs')
        .select(`
          *,
          op_todos!inner(title)
        `)
        .in('todo_id', todoIds)
        .order('timestamp', { ascending: false })
      
      if (error) throw error
      
      const history = (data as (TodoClickLog & { op_todos: { title: string } })[])?.map(log => ({
        user: log.user_email,
        timestamp: log.timestamp,
        action: log.action,
        todoTitle: log.op_todos?.title || 'Unknown'
      })) || []
      
      setCategoryHistory(history)
    } catch (e) {
      console.error('Failed to load category history:', e)
    }
  }

  // 히스토리 모달 열기
  const openHistoryModal = async (category: 'daily' | 'weekly' | 'monthly' | 'yearly') => {
    setSelectedCategory(category)
    setShowHistoryModal(true)
    await loadCategoryHistory(category)
  }

  const handleEditEnvelopePrintTodo = () => {
    const linked = findTourEnvelopePrintLinkedTodo(opTodos)
    if (linked) {
      setEditTodoId(linked.id)
      return
    }
    setTodoCreateFormSeed(tourEnvelopePrintTodoFormSeed(uiLocale))
    setShowTodoCreateModal(true)
  }

  const handleEditPickupNotificationTodo = () => {
    const linked = findPickupNotificationLinkedTodo(opTodos)
    if (linked) {
      setEditTodoId(linked.id)
      return
    }
    setTodoCreateFormSeed(pickupNotificationTodoFormSeed(uiLocale))
    setShowTodoCreateModal(true)
  }

  const handleEditGuideScheduleConfirmTodo = () => {
    const linked = findGuideScheduleConfirmLinkedTodo(opTodos)
    if (linked) {
      setEditTodoId(linked.id)
      return
    }
    setTodoCreateFormSeed(guideScheduleConfirmTodoFormSeed(uiLocale))
    setShowTodoCreateModal(true)
  }

  const handleEditCustomerInfoReviewTodo = () => {
    const linked = findCustomerInfoReviewLinkedTodo(opTodos)
    if (linked) {
      setEditTodoId(linked.id)
      return
    }
    setTodoCreateFormSeed(customerInfoReviewTodoFormSeed(uiLocale))
    setShowTodoCreateModal(true)
  }

  const handleEditCancelRebookingFollowUpTodo = () => {
    const linked = findCancelRebookingFollowUpLinkedTodo(opTodos)
    if (linked) {
      setEditTodoId(linked.id)
      return
    }
    setTodoCreateFormSeed(cancelRebookingFollowUpTodoFormSeed(uiLocale))
    setShowTodoCreateModal(true)
  }

  const handleEditPendingCustomerManagementTodo = () => {
    const linked = findPendingCustomerManagementLinkedTodo(opTodos)
    if (linked) {
      setEditTodoId(linked.id)
      return
    }
    setTodoCreateFormSeed(pendingCustomerManagementTodoFormSeed(uiLocale))
    setShowTodoCreateModal(true)
  }

  const handleCancelFollowUpManualChange = async (
    reservationId: string,
    kind: CancelFollowUpManualKind,
    action: 'mark' | 'clear'
  ) => {
    try {
      await upsertReservationCancelFollowUpManual(supabase, reservationId, kind, action)
      dispatchCancelRebookingFollowUpRefresh()
    } catch (e) {
      console.error(e)
      alert('저장에 실패했습니다.')
    }
  }

  const handleEditOtaClosureTodo = () => {
    const linked = findOtaClosureLinkedTodo(opTodos)
    if (linked) {
      setEditTodoId(linked.id)
      return
    }
    setTodoCreateFormSeed(otaClosureTodoFormSeed(uiLocale))
    setShowTodoCreateModal(true)
  }

  const handleEditTourHotelManagementTodo = () => {
    const linked = findTourHotelManagementLinkedTodo(opTodos)
    if (linked) {
      setEditTodoId(linked.id)
      return
    }
    setTodoCreateFormSeed(tourHotelManagementTodoFormSeed(uiLocale))
    setShowTodoCreateModal(true)
  }

  const handleEditTourHotelPriceCheckTodo = () => {
    const linked = findTourHotelPriceCheckLinkedTodo(opTodos)
    if (linked) {
      setEditTodoId(linked.id)
      return
    }
    setTodoCreateFormSeed(tourHotelPriceCheckTodoFormSeed(uiLocale))
    setShowTodoCreateModal(true)
  }

  const handleEditTourSettlementTodo = () => {
    const linked = findTourSettlementLinkedTodo(opTodos)
    if (linked) {
      setEditTodoId(linked.id)
      return
    }
    setTodoCreateFormSeed(tourSettlementTodoFormSeed(uiLocale))
    setShowTodoCreateModal(true)
  }

  const handleEditReservationAgencyManagementTodo = () => {
    const linked = findReservationAgencyManagementLinkedTodo(opTodos)
    if (linked) {
      setEditTodoId(linked.id)
      return
    }
    setTodoCreateFormSeed(reservationAgencyManagementTodoFormSeed(uiLocale))
    setShowTodoCreateModal(true)
  }

  const handleEditAntelopeCanyonBookingTodo = () => {
    const linked = findAntelopeCanyonBookingLinkedTodo(opTodos)
    if (linked) {
      setEditTodoId(linked.id)
      return
    }
    setTodoCreateFormSeed(antelopeCanyonBookingTodoFormSeed(uiLocale))
    setShowTodoCreateModal(true)
  }

  const toggleTaskSection = (section: string) => {
    setExpandedTaskSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // 수동 리셋 함수
  const resetCategoryTodos = async (category: 'daily' | 'weekly' | 'monthly' | 'yearly') => {
    if (!confirm(`${category === 'daily' ? '일일' : category === 'weekly' ? '주간' : category === 'monthly' ? '월간' : '연간'} 체크리스트를 리셋하시겠습니까?`)) {
      return
    }

    try {
      const { data, error } = await supabase.rpc('manual_reset_todos', { category_name: category })

      if (error) throw error

      // 로컬 상태 업데이트
      setOpTodos(prev => prev.map(todo => 
        todo.category === category 
          ? { ...todo, completed: false, completed_at: null }
          : todo
      ))

      // 히스토리 새로고침
      await loadCategoryHistory(category)

      alert(data || '리셋이 완료되었습니다.')
    } catch (e) {
      console.error('Failed to reset todos:', e)
      alert('리셋 중 오류가 발생했습니다.')
    }
  }
  
  
  // 이슈 관련 상태
  const [issues, setIssues] = useState<Issue[]>([])
  const [newIssue, setNewIssue] = useState({
    title: '',
    description: '',
    status: 'open' as 'open' | 'in_progress' | 'resolved' | 'closed',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical'
  })

  // 업무 관리 모달 상태
  const [showWorkModal, setShowWorkModal] = useState(false)
  const [workModalType, setWorkModalType] = useState<'issue' | null>(null)

  // 업무 관리 관련 상태
  const [tasks, setTasks] = useState<Task[]>(() => workCache?.tasks ?? [])
  const [showNewTaskModal, setShowNewTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showArchivedModal, setShowArchivedModal] = useState(false)
  const [archivedModalSection, setArchivedModalSection] = useState<'tasks' | 'announcements' | 'issues'>('tasks')
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    assigned_to: '',
    target_positions: [] as string[],
    target_individuals: [] as string[],
    tags: [] as string[],
    linked_hub_article_id: null as string | null,
  })
  const [taskRecipientMode, setTaskRecipientMode] = useState<'individual' | 'group'>('individual')
  const [selectedTaskPositions, setSelectedTaskPositions] = useState<string[]>([])
  const [selectedTaskIndividuals, setSelectedTaskIndividuals] = useState<string[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(
    () => primaryCache?.teamMembers ?? workCache?.teamMembers ?? []
  )
  const [boardComments, setBoardComments] = useState<TeamBoardComment[]>([])
  const [statusLogs, setStatusLogs] = useState<TeamBoardStatusLog[]>([])
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [expandedStatusLogs, setExpandedStatusLogs] = useState<Record<string, boolean>>({})
  const [isCommentsFeatureEnabled, setIsCommentsFeatureEnabled] = useState(() => {
    if (typeof window === 'undefined') return false
    if (localStorage.getItem('team_board_comments_disabled') === 'true') return false
    return localStorage.getItem('team_board_comments_enabled') === 'true'
  })
  const isCommentsFeatureEnabledRef = useRef(isCommentsFeatureEnabled)
  isCommentsFeatureEnabledRef.current = isCommentsFeatureEnabled
  const [activePositionTab, setActivePositionTab] = useState<string>('manager')
  const [expandedTaskSections, setExpandedTaskSections] = useState<Record<string, boolean>>({
    'pending': true,
    'in_progress': true,
    'completed': true,
    'cancelled': true
  })

  const hasAdminPermission = (permissions?: string[] | Record<string, boolean> | null) => {
    if (!permissions) return false
    if (Array.isArray(permissions)) {
      return permissions.includes('canViewAdmin') || permissions.includes('canManageTeam')
    }
    return !!(permissions.canViewAdmin || permissions.canManageTeam)
  }

  const superAdminEmails = ['info@maniatour.com', 'wooyong.shim09@gmail.com']
  const normalizedPosition = normalizePosition(userPosition)
  const isAdminByRole = userRole === 'admin'
  const isAdminByPosition = ['admin', 'manager'].includes(normalizedPosition)
  const isSuperAdminByEmail = !!authUser?.email && superAdminEmails.includes(authUser.email.toLowerCase())
  const isAdminUser = isSuperAdminByEmail || isAdminByRole || isAdminByPosition || hasAdminPermission(authUser?.permissions)
  const opTodoDepartments = useMemo(
    () =>
      resolveOpTodoDepartmentFilter({
        viewAll: isAdminUser,
        userPosition: userPosition ?? null,
      }),
    [isAdminUser, userPosition]
  )
  const activeTasks = tasks.filter(task => !task.is_deleted && task.status !== 'completed' && task.status !== 'cancelled')
  const archivedTasks = tasks.filter(task => !!task.is_deleted || task.status === 'completed' || task.status === 'cancelled')
  const activeAnnouncements = announcements.filter(announcement => !announcement.is_deleted && !announcement.is_archived)
  const archivedAnnouncements = announcements.filter(announcement => !!announcement.is_deleted || !!announcement.is_archived)
  const activeIssues = issues.filter(issue => !issue.is_deleted && issue.status !== 'resolved' && issue.status !== 'closed')
  const archivedIssues = issues.filter(issue => !!issue.is_deleted || issue.status === 'resolved' || issue.status === 'closed')

  useEffect(() => {
    fetchAll()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** 댓글·활동 로그는 첫 화면 이후 백그라운드 로드 (404 테이블이 있어도 메인 로딩을 막지 않음) */
  const loadTeamBoardSecondary = async () => {
    try {
      const wantComments = isCommentsFeatureEnabledRef.current
      const [commentsRes, logsRes] = await Promise.all([
        wantComments
          ? supabase.from('team_board_comments').select('*').order('created_at', { ascending: true })
          : Promise.resolve({ data: [], error: null } as any), // eslint-disable-line @typescript-eslint/no-explicit-any
        supabase
          .from('team_board_status_logs')
          .select('*')
          .order('changed_at', { ascending: false })
          .limit(TB_STATUS_LOGS_LIMIT),
      ])

      if (commentsRes?.error) {
        if (isMissingSupabaseRelationError(commentsRes.error)) {
          setIsCommentsFeatureEnabled(false)
          if (typeof window !== 'undefined') {
            localStorage.setItem('team_board_comments_disabled', 'true')
            localStorage.removeItem('team_board_comments_enabled')
          }
          setBoardComments([])
        }
      } else {
        if (typeof window !== 'undefined' && wantComments) {
          localStorage.setItem('team_board_comments_enabled', 'true')
          localStorage.removeItem('team_board_comments_disabled')
        }
        setBoardComments(((commentsRes?.data as TeamBoardComment[]) || []) as TeamBoardComment[])
      }

      if (logsRes?.error) {
        if (isMissingSupabaseRelationError(logsRes.error)) {
          setStatusLogs([])
        }
      } else {
        setStatusLogs(((logsRes?.data as TeamBoardStatusLog[]) || []) as TeamBoardStatusLog[])
      }
    } catch (e) {
      console.error('loadTeamBoardSecondary', e)
    }
  }

  const fetchAll = async () => {
    const hadPrimaryCache = Boolean(readTeamBoardPrimaryCache())
    try {
      if (!hadPrimaryCache) setLoading(true)
      void runOpTodoResetsIfDue()
      const bootstrap = await fetchTeamBoardBootstrap({ opTodoDepartments })
      setOpTodos(bootstrap.primary.opTodos as OpTodo[])
      setTeamMembers(bootstrap.primary.teamMembers as unknown as TeamMember[])
      setAnnouncements(bootstrap.work.announcements as Announcement[])
      setAcksByAnnouncement(bootstrap.work.acksByAnnouncement)
      setTasks(bootstrap.work.tasks as unknown as Task[])
      setIssues(bootstrap.issues as unknown as Issue[])
    } finally {
      setLoading(false)
    }

    void loadTeamBoardSecondary()
  }

  const refreshOpTodosOnly = async () => {
    try {
      const data = await fetchOpTodosOnly({ opTodoDepartments })
      setOpTodos(data as OpTodo[])
    } catch (e) {
      console.error('refreshOpTodosOnly', e)
    }
  }

  useEffect(() => {
    const onRefresh = () => void refreshOpTodosOnly()
    window.addEventListener(OP_TODO_REFRESH_EVENT, onRefresh)
    return () => window.removeEventListener(OP_TODO_REFRESH_EVENT, onRefresh)
  }, [])

  const getCommentKey = (targetType: TeamBoardComment['target_type'], targetId: string) => `${targetType}:${targetId}`

  const getCommentsByTarget = (targetType: TeamBoardComment['target_type'], targetId: string) =>
    boardComments.filter(comment => comment.target_type === targetType && comment.target_id === targetId)

  const setCommentInput = (targetType: TeamBoardComment['target_type'], targetId: string, value: string) => {
    const key = getCommentKey(targetType, targetId)
    setCommentInputs(prev => ({ ...prev, [key]: value }))
  }

  const getStatusLogsByTarget = (targetType: TeamBoardStatusLog['target_type'], targetId: string) =>
    statusLogs.filter(log => log.target_type === targetType && log.target_id === String(targetId))
  const getStatusLogKey = (targetType: TeamBoardStatusLog['target_type'], targetId: string) => `${targetType}:${targetId}`

  const getStatusActionLabel = (action: TeamBoardStatusLog['action']) => {
    if (action === 'completed') return '완료'
    if (action === 'deleted') return '삭제'
    if (action === 'restored') return '복구'
    return '상태 변경'
  }

  const getMemberDisplayName = (email: string | null | undefined) => {
    if (!email) return '사용자'
    const member = teamMembers.find(teamMember => (teamMember.email || '').toLowerCase() === email.toLowerCase())
    return member?.name_ko || email.split('@')[0]
  }

  const addStatusLog = async (payload: {
    targetType: TeamBoardStatusLog['target_type']
    targetId: string
    action: TeamBoardStatusLog['action']
    fromState?: string | null
    toState?: string | null
    note?: string | null
  }) => {
    if (!authUser?.email) return
    try {
      const { data, error } = await supabase
        .from('team_board_status_logs')
        .insert([{
          target_type: payload.targetType,
          target_id: String(payload.targetId),
          action: payload.action,
          from_state: payload.fromState ?? null,
          to_state: payload.toState ?? null,
          note: payload.note ?? null,
          changed_by: authUser.email,
        }] as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .select()
        .single()
      if (error) return
      setStatusLogs(prev => [data as TeamBoardStatusLog, ...prev])
    } catch {
      // 로그 저장 실패는 핵심 기능을 막지 않음
    }
  }

  const addComment = async (targetType: TeamBoardComment['target_type'], targetId: string) => {
    if (!isCommentsFeatureEnabled) return
    if (!authUser?.email) return
    const key = getCommentKey(targetType, targetId)
    const value = (commentInputs[key] || '').trim()
    if (!value) return

    try {
      const { data, error } = await supabase
        .from('team_board_comments')
        .insert([{
          target_type: targetType,
          target_id: targetId,
          comment: value,
          created_by: authUser.email,
        }] as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .select()
        .single()

      if (error) throw error

      setBoardComments(prev => [...prev, data as TeamBoardComment])
      setCommentInputs(prev => ({ ...prev, [key]: '' }))
    } catch (e) {
      console.error(e)
      alert('댓글 등록 중 오류가 발생했습니다.')
    }
  }

  const canDeleteComment = (comment: TeamBoardComment) => {
    if (!authUser?.email) return false
    const isAuthor = (comment.created_by || '').toLowerCase() === authUser.email.toLowerCase()
    const isAdmin = hasAdminPermission(authUser?.permissions)
    return isAuthor || isAdmin
  }

  const deleteComment = async (commentId: string) => {
    if (!isCommentsFeatureEnabled) return
    try {
      const { error } = await supabase
        .from('team_board_comments')
        .delete()
        .eq('id', commentId)
      if (error) throw error

      setBoardComments(prev => prev.filter(comment => comment.id !== commentId))
    } catch (e) {
      console.error(e)
      alert('댓글 삭제 중 오류가 발생했습니다.')
    }
  }

  const handleCreateAnnouncement = async () => {
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim() || !authUser?.email) return
    setSubmitting(true)
    try {
      // 그룹 선택 시 선택된 position의 모든 활성 팀원들을 개별 직원 목록에 추가
      let finalIndividuals = [...selectedTaskIndividuals]
      if (taskRecipientMode === 'group' && selectedTaskPositions.length > 0) {
        const groupMembers = teamMembers
          .filter(member => member.position && selectedTaskPositions.includes(member.position) && member.is_active && member.email)
          .map(member => member.email!)
        finalIndividuals = [...new Set([...selectedTaskIndividuals, ...groupMembers])]
      }

      const { data, error } = await fromUntypedTable(supabase, 'team_announcements')
        .insert([{ 
          title: newAnnouncement.title.trim(), 
          content: newAnnouncement.content.trim(), 
          created_by: authUser.email,
          recipients: finalIndividuals.length > 0 ? finalIndividuals : null,
          target_positions: taskRecipientMode === 'group' ? selectedTaskPositions : null,
          priority: newAnnouncement.priority,
          tags: newAnnouncement.tags ? newAnnouncement.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
          linked_hub_article_id: newAnnouncement.linked_hub_article_id,
        }] as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .select()
        .single()
      if (error) throw error
      setAnnouncements([data as Announcement, ...announcements])
      setShowNewAnnouncement(false)
      setNewAnnouncement({ title: '', content: '', recipients: [], priority: 'normal', tags: '', target_positions: [], linked_hub_article_id: null })
      setSelectedTaskPositions([])
      setSelectedTaskIndividuals([])
      setActivePositionTab('manager')
    } catch (e) {
      console.error(e)
      alert('공지 생성 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const togglePin = async (announcement: Announcement) => {
    try {
      const { data, error } = await fromUntypedTable(supabase, 'team_announcements')
        .update({ is_pinned: !announcement.is_pinned })
        .eq('id', announcement.id)
        .select()
        .single()
      if (error) throw error
      setAnnouncements(announcements.map(a => a.id === announcement.id ? (data as Announcement) : a))
    } catch (e) {
      console.error(e)
      alert('핀 고정 변경 중 오류가 발생했습니다.')
    }
  }


  const ackAnnouncement = async (announcementId: string) => {
    if (!authUser?.email) return
    try {
      const { data, error } = await supabase
        .from('team_announcement_acknowledgments')
        .insert([{ announcement_id: announcementId, ack_by: authUser.email }] as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .select()
        .single()
      if (error) throw error
      setAcksByAnnouncement(prev => ({ ...prev, [announcementId]: [...(prev[announcementId] || []), data as Acknowledgment] }))
    } catch (e) {
      console.error(e)
      alert('확인 처리 중 오류가 발생했습니다.')
    }
  }

  const unackAnnouncement = async (announcementId: string) => {
    if (!authUser?.email) return
    try {
      const { error } = await supabase
        .from('team_announcement_acknowledgments')
        .delete()
        .eq('announcement_id', announcementId)
        .eq('ack_by', authUser.email)
      if (error) throw error
      setAcksByAnnouncement(prev => ({ ...prev, [announcementId]: (prev[announcementId] || []).filter(a => a.ack_by !== authUser.email) }))
    } catch (e) {
      console.error(e)
      alert('확인 취소 중 오류가 발생했습니다.')
    }
  }

  const startEditAnnouncement = (announcement: Announcement) => {
    setEditingAnnouncement(announcement)
    setEditAnnouncement({
      title: announcement.title,
      content: announcement.content,
      recipients: announcement.recipients || [],
      priority: announcement.priority || 'normal',
      tags: announcement.tags ? announcement.tags.join(', ') : '',
      target_positions: announcement.target_positions || [],
      linked_hub_article_id: announcement.linked_hub_article_id ?? null,
    })
    setSelectedTaskPositions(announcement.target_positions || [])
    setSelectedTaskIndividuals(announcement.recipients || [])
    setTaskRecipientMode(announcement.target_positions && announcement.target_positions.length > 0 ? 'group' : 'individual')
  }

  const cancelEditAnnouncement = () => {
    setEditingAnnouncement(null)
    setEditAnnouncement({ title: '', content: '', recipients: [], priority: 'normal', tags: '', target_positions: [], linked_hub_article_id: null })
    setSelectedTaskPositions([])
    setSelectedTaskIndividuals([])
    setTaskRecipientMode('individual')
  }

  const updateAnnouncement = async () => {
    if (!editingAnnouncement || !editAnnouncement.title.trim() || !editAnnouncement.content.trim() || !authUser?.email) return
    setSubmitting(true)
    try {
      // 그룹 선택 시 선택된 position의 모든 활성 팀원들을 개별 직원 목록에 추가
      let finalIndividuals = [...selectedTaskIndividuals]
      if (taskRecipientMode === 'group' && selectedTaskPositions.length > 0) {
        const groupMembers = teamMembers
          .filter(member => member.position && selectedTaskPositions.includes(member.position) && member.is_active && member.email)
          .map(member => member.email!)
        finalIndividuals = [...new Set([...selectedTaskIndividuals, ...groupMembers])]
      }

      const { data, error } = await fromUntypedTable(supabase, 'team_announcements')
        .update({
          title: editAnnouncement.title.trim(),
          content: editAnnouncement.content.trim(),
          recipients: finalIndividuals.length > 0 ? finalIndividuals : null,
          target_positions: taskRecipientMode === 'group' ? selectedTaskPositions : null,
          priority: editAnnouncement.priority,
          tags: editAnnouncement.tags ? editAnnouncement.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
          linked_hub_article_id: editAnnouncement.linked_hub_article_id,
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .eq('id', editingAnnouncement.id!)
        .select()
        .single()
      if (error) throw error
      setAnnouncements(announcements.map(a => a.id === editingAnnouncement.id ? (data as Announcement) : a))
      cancelEditAnnouncement()
    } catch (e) {
      console.error(e)
      alert('전달사항 수정 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteAnnouncement = async (announcementId: string) => {
    if (!confirm('정말로 이 전달사항을 삭제하시겠습니까?')) return
    if (!authUser?.email) return
    try {
      const { data, error } = await fromUntypedTable(supabase, 'team_announcements')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: authUser.email,
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .eq('id', announcementId)
        .select()
        .single()
      if (error) throw error
      setAnnouncements(announcements.map(a => a.id === announcementId ? (data as Announcement) : a))
    } catch (e) {
      console.error(e)
      alert('전달사항 삭제 중 오류가 발생했습니다.')
    }
  }

  // 권한 체크 함수
  const canEditAnnouncement = (announcement: Announcement) => {
    if (!authUser?.email) return false
    // 관리자이거나 작성자인 경우
    return authUser.email === announcement.created_by || 
           isAdminUser
  }

  const canEditTask = (task: Task) => {
    if (!authUser?.email) return false
    const email = authUser.email.toLowerCase()
    return (
      isAdminUser ||
      (task.created_by || '').toLowerCase() === email ||
      (task.assigned_to != null && task.assigned_to.toLowerCase() === email)
    )
  }

  const toDatetimeLocalValue = (iso: string) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const resetTaskForm = () => {
    setNewTask({
      title: '',
      description: '',
      due_date: '',
      priority: 'medium',
      assigned_to: '',
      target_positions: [],
      target_individuals: [],
      tags: [],
      linked_hub_article_id: null,
    })
    setSelectedTaskPositions([])
    setSelectedTaskIndividuals([])
    setActivePositionTab('manager')
    setTaskRecipientMode('individual')
  }

  const closeTaskModal = () => {
    setShowNewTaskModal(false)
    setEditingTask(null)
    resetTaskForm()
  }

  const startEditTask = (task: Task) => {
    const individuals = task.target_individuals || []
    const positions = task.target_positions || []
    setEditingTask(task)
    setNewTask({
      title: task.title,
      description: task.description || '',
      due_date: task.due_date ? toDatetimeLocalValue(task.due_date) : '',
      priority: task.priority,
      assigned_to: task.assigned_to || '',
      target_positions: positions,
      target_individuals: individuals,
      tags: task.tags || [],
      linked_hub_article_id: task.linked_hub_article_id ?? null,
    })
    if (positions.length > 0) {
      setTaskRecipientMode('group')
      setSelectedTaskPositions(positions)
      setSelectedTaskIndividuals(individuals)
    } else {
      setTaskRecipientMode('individual')
      setSelectedTaskPositions([])
      setSelectedTaskIndividuals(individuals)
    }
  }




  const createTask = async () => {
    if (!newTask.title.trim() || !authUser?.email) return
    setSubmitting(true)
    try {
      // 그룹 선택 시 선택된 position의 모든 활성 팀원들을 개별 직원 목록에 추가
      let finalIndividuals = [...selectedTaskIndividuals]
      if (taskRecipientMode === 'group' && selectedTaskPositions.length > 0) {
        const groupMembers = teamMembers
          .filter(member => member.position && selectedTaskPositions.includes(member.position) && member.is_active && member.email)
          .map(member => member.email!)
        finalIndividuals = [...new Set([...selectedTaskIndividuals, ...groupMembers])]
      }

      const payload = {
        title: newTask.title.trim(),
        description: newTask.description.trim() || null,
        due_date: newTask.due_date || null,
        priority: newTask.priority,
        assigned_to: newTask.assigned_to || null,
        target_positions: taskRecipientMode === 'group' ? selectedTaskPositions : null,
        target_individuals: finalIndividuals.length > 0 ? finalIndividuals : null,
        tags: newTask.tags,
        created_by: authUser.email,
        linked_hub_article_id: newTask.linked_hub_article_id,
      }
      const { data, error } = await supabase
        .from('tasks')
        .insert([payload] as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .select()
        .single()
      if (error) throw error
      setTasks(prev => [data as unknown as Task, ...prev])
      closeTaskModal()
    } catch (e) {
      console.error(e)
      alert('업무 생성 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const updateTask = async (statusOverride?: Task['status']) => {
    if (!editingTask || !newTask.title.trim()) return
    setSubmitting(true)
    try {
      let finalIndividuals = [...selectedTaskIndividuals]
      if (taskRecipientMode === 'group' && selectedTaskPositions.length > 0) {
        const groupMembers = teamMembers
          .filter(member => member.position && selectedTaskPositions.includes(member.position) && member.is_active && member.email)
          .map(member => member.email!)
        finalIndividuals = [...new Set([...selectedTaskIndividuals, ...groupMembers])]
      }

      const payload = {
        title: newTask.title.trim(),
        description: newTask.description.trim() || null,
        due_date: newTask.due_date || null,
        priority: newTask.priority,
        status: statusOverride ?? editingTask.status,
        assigned_to: newTask.assigned_to || null,
        target_positions: taskRecipientMode === 'group' ? selectedTaskPositions : null,
        target_individuals: finalIndividuals.length > 0 ? finalIndividuals : null,
        tags: newTask.tags,
        updated_at: new Date().toISOString(),
        linked_hub_article_id: newTask.linked_hub_article_id,
      }
      const { data, error } = await supabase
        .from('tasks')
        .update(payload as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .eq('id', Number(editingTask.id))
        .select()
        .single()
      if (error) throw error
      setTasks(prev => prev.map(task => (task.id === editingTask.id ? (data as unknown as Task) : task)))
      closeTaskModal()
    } catch (e) {
      console.error(e)
      alert('업무 수정 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const createIssue = async () => {
    if (!newIssue.title.trim() || !authUser?.email) return
    setSubmitting(true)
    try {
      const payload = {
        title: newIssue.title.trim(),
        description: newIssue.description.trim() || null,
        status: newIssue.status,
        priority: newIssue.priority,
        reported_by: authUser.email,
      }
      const { data, error } = await supabase
        .from('issues')
        .insert([payload] as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .select()
        .single()
      if (error) throw error
      setIssues(prev => [data as unknown as Issue, ...prev])
      closeWorkModal()
      setNewIssue({
        title: '',
        description: '',
        status: 'open',
        priority: 'medium'
      })
    } catch (e) {
      console.error(e)
      alert('이슈 생성 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const updateIssueStatus = async (issueId: string, status: Issue['status']) => {
    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('issues')
        .update({ status } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .eq('id', issueId)
        .select()
        .single()
      if (error) throw error

      setIssues(prev => prev.map(issue => (issue.id === issueId ? (data as unknown as Issue) : issue)))
    } catch (e) {
      console.error(e)
      alert('이슈 상태 변경 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const completeTask = async (taskId: string) => {
    if (!isAdminUser) return
    try {
      const target = tasks.find(task => String(task.id) === String(taskId))
      const { data, error } = await supabase
        .from('tasks')
        .update({ status: 'completed' } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .eq('id', Number(taskId))
        .select()
        .single()
      if (error) throw error
      setTasks(prev => prev.map(task => (task.id === taskId ? (data as unknown as Task) : task)))
      await addStatusLog({
        targetType: 'task',
        targetId: String(taskId),
        action: 'completed',
        fromState: target?.status || null,
        toState: 'completed',
      })
    } catch (e) {
      console.error(e)
      alert('업무 완료 처리 중 오류가 발생했습니다.')
    }
  }

  const deleteTaskSoft = async (taskId: string) => {
    if (!isAdminUser || !authUser?.email) return
    try {
      const target = tasks.find(task => String(task.id) === String(taskId))
      const { data, error } = await supabase
        .from('tasks')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: authUser.email,
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .eq('id', Number(taskId))
        .select()
        .single()
      if (error) throw error
      setTasks(prev => prev.map(task => (task.id === taskId ? (data as unknown as Task) : task)))
      await addStatusLog({
        targetType: 'task',
        targetId: String(taskId),
        action: 'deleted',
        fromState: target?.status || null,
        toState: 'deleted',
      })
    } catch (e) {
      console.error(e)
      alert('업무 삭제 처리 중 오류가 발생했습니다.')
    }
  }

  const completeAnnouncement = async (announcementId: string) => {
    if (!isAdminUser) return
    try {
      const target = announcements.find(announcement => announcement.id === announcementId)
      const { data, error } = await fromUntypedTable(supabase, 'team_announcements')
        .update({ is_archived: true } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .eq('id', announcementId)
        .select()
        .single()
      if (error) throw error
      setAnnouncements(prev => prev.map(announcement => (announcement.id === announcementId ? (data as Announcement) : announcement)))
      await addStatusLog({
        targetType: 'announcement',
        targetId: announcementId,
        action: 'completed',
        fromState: target?.is_archived ? 'archived' : 'active',
        toState: 'archived',
      })
    } catch (e) {
      console.error(e)
      alert('전달사항 완료 처리 중 오류가 발생했습니다.')
    }
  }

  const completeIssue = async (issueId: string) => {
    if (!isAdminUser) return
    const target = issues.find(issue => issue.id === issueId)
    await updateIssueStatus(issueId, 'resolved')
    await addStatusLog({
      targetType: 'issue',
      targetId: issueId,
      action: 'completed',
      fromState: target?.status || null,
      toState: 'resolved',
    })
  }

  const deleteIssueSoft = async (issueId: string) => {
    if (!isAdminUser || !authUser?.email) return
    try {
      const target = issues.find(issue => issue.id === issueId)
      const { data, error } = await supabase
        .from('issues')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: authUser.email,
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .eq('id', issueId)
        .select()
        .single()
      if (error) throw error
      setIssues(prev => prev.map(issue => (issue.id === issueId ? (data as unknown as Issue) : issue)))
      await addStatusLog({
        targetType: 'issue',
        targetId: issueId,
        action: 'deleted',
        fromState: target?.status || null,
        toState: 'deleted',
      })
    } catch (e) {
      console.error(e)
      alert('이슈 삭제 처리 중 오류가 발생했습니다.')
    }
  }

  const restoreTask = async (taskId: string) => {
    if (!isAdminUser) return
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          status: 'pending',
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .eq('id', Number(taskId))
        .select()
        .single()
      if (error) throw error
      setTasks(prev => prev.map(task => (String(task.id) === String(taskId) ? (data as unknown as Task) : task)))
      await addStatusLog({
        targetType: 'task',
        targetId: String(taskId),
        action: 'restored',
        fromState: 'archived_or_deleted',
        toState: 'pending',
      })
    } catch (e) {
      console.error(e)
      alert('업무 복구 중 오류가 발생했습니다.')
    }
  }

  const restoreAnnouncement = async (announcementId: string) => {
    if (!isAdminUser) return
    try {
      const { data, error } = await fromUntypedTable(supabase, 'team_announcements')
        .update({
          is_archived: false,
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .eq('id', announcementId)
        .select()
        .single()
      if (error) throw error
      setAnnouncements(prev => prev.map(announcement => (announcement.id === announcementId ? (data as Announcement) : announcement)))
      await addStatusLog({
        targetType: 'announcement',
        targetId: announcementId,
        action: 'restored',
        fromState: 'archived_or_deleted',
        toState: 'active',
      })
    } catch (e) {
      console.error(e)
      alert('전달사항 복구 중 오류가 발생했습니다.')
    }
  }

  const restoreIssue = async (issueId: string) => {
    if (!isAdminUser) return
    try {
      const { data, error } = await supabase
        .from('issues')
        .update({
          status: 'open',
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .eq('id', issueId)
        .select()
        .single()
      if (error) throw error
      setIssues(prev => prev.map(issue => (issue.id === issueId ? (data as unknown as Issue) : issue)))
      await addStatusLog({
        targetType: 'issue',
        targetId: issueId,
        action: 'restored',
        fromState: 'resolved_or_deleted',
        toState: 'open',
      })
    } catch (e) {
      console.error(e)
      alert('이슈 복구 중 오류가 발생했습니다.')
    }
  }

  // 업무 모달 열기 함수들
  const openWorkModal = (type: 'issue') => {
    setWorkModalType(type)
    setShowWorkModal(true)
  }

  const closeWorkModal = () => {
    setShowWorkModal(false)
    setWorkModalType(null)
  }

  return (
    <ProtectedRoute requiredPermission="canViewAdmin">
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">업무 관리</h1>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 shrink-0">
            <input
              type="checkbox"
              className="rounded border-gray-300"
              checked={isCommentsFeatureEnabled}
              onChange={(e) => {
                const on = e.target.checked
                isCommentsFeatureEnabledRef.current = on
                setIsCommentsFeatureEnabled(on)
                if (typeof window !== 'undefined') {
                  if (on) {
                    localStorage.setItem('team_board_comments_enabled', 'true')
                    localStorage.removeItem('team_board_comments_disabled')
                  } else {
                    localStorage.setItem('team_board_comments_disabled', 'true')
                    localStorage.removeItem('team_board_comments_enabled')
                    setBoardComments([])
                  }
                }
                if (on) void loadTeamBoardSecondary()
              }}
            />
            <span>
              팀보드 댓글 로드{' '}
              <span className="text-xs text-gray-400">(DB에 테이블이 있을 때만)</span>
            </span>
          </label>
        </div>

        {loading ? (
          <div className="flex items-center text-gray-500"><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Loading...</div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* 1) Todo List */}
            <ChecklistPanel
              opTodos={opTodos}
              selectedDepartment={selectedDepartment}
              onDepartmentChange={setSelectedDepartment}
              onManageNotifications={() => setShowNewTodoModal(true)}
              onAddTodo={() => setShowTodoCreateModal(true)}
              onEditTodo={(todo) => setEditTodoId(todo.id)}
              onEditEnvelopePrintTodo={handleEditEnvelopePrintTodo}
              onEditPickupNotificationTodo={handleEditPickupNotificationTodo}
              onEditGuideScheduleConfirmTodo={handleEditGuideScheduleConfirmTodo}
              onEditCustomerInfoReviewTodo={handleEditCustomerInfoReviewTodo}
              onEditCancelRebookingFollowUpTodo={handleEditCancelRebookingFollowUpTodo}
              onEditPendingCustomerManagementTodo={handleEditPendingCustomerManagementTodo}
              onCancelFollowUpManualChange={handleCancelFollowUpManualChange}
              onOpenReservation={(reservationId) =>
                router.push(`/${uiLocale}/admin/reservations/${reservationId}`)
              }
              onEditOtaClosureTodo={handleEditOtaClosureTodo}
              onEditTourHotelManagementTodo={handleEditTourHotelManagementTodo}
              onEditTourHotelPriceCheckTodo={handleEditTourHotelPriceCheckTodo}
              onEditTourSettlementTodo={handleEditTourSettlementTodo}
              onEditReservationAgencyManagementTodo={handleEditReservationAgencyManagementTodo}
              onEditAntelopeCanyonBookingTodo={handleEditAntelopeCanyonBookingTodo}
              onOpenTourDetail={(tourId) => router.push(`/${uiLocale}/admin/tours/${tourId}`)}
              onQuickPrint={(tourId, kind) => setTourQuickPrint({ tourId, kind })}
              onPickupAction={(tourId, kind) => setTourPickupNotification({ tourId, kind })}
              locale={uiLocale}
              toggleTodoCompletion={async (id: string, is_completed: boolean) => {
                if (!authUser?.email) return

                const todo = opTodos.find((t) => t.id === id)
                if (!todo) return

                setSubmitting(true)
                try {
                  const { data, error } = await toggleOpTodoCompletion(todo, is_completed)

                  if (error) {
                    console.error('Error toggling todo completion:', error)
                    alert('체크리스트 완료 처리에 실패했습니다.')
                    return
                  }

                  setOpTodos((prev) =>
                    prev.map((t) =>
                      t.id === id
                        ? {
                            ...t,
                            completed: data?.completed ?? is_completed,
                            completed_at: data?.completed_at ?? (is_completed ? new Date().toISOString() : null),
                            next_notify_at: data?.next_notify_at ?? t.next_notify_at ?? null,
                          }
                        : t
                    )
                  )
                } catch (e) {
                  console.error('Error in toggleTodoCompletion:', e)
                  alert('체크리스트 완료 처리에 실패했습니다.')
                } finally {
                  setSubmitting(false)
                }
              }}
              openHistoryModal={openHistoryModal}
            />

            {/* 2) 업무(Tasks) */}
            <section className="bg-white rounded-lg shadow border p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">{t('tasks')}</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setArchivedModalSection('tasks')
                      setShowArchivedModal(true)
                    }}
                    className="px-2 py-1 text-xs border rounded text-gray-700 hover:bg-gray-100"
                    title="완료/삭제 내역 보기"
                  >
                    완료/삭제 보기
                  </button>
                  <button
                    onClick={() => setShowNewTaskModal(true)}
                    className="w-8 h-8 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center transition-colors"
                    title="새 업무 추가"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {['pending', 'in_progress'].map(status => (
                  <div key={status} className="bg-gray-50 rounded-md border">
                    <button
                      onClick={() => toggleTaskSection(status)}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-100 transition-colors"
                    >
                      <h3 className="font-medium text-sm">
                        {status === 'pending' ? '대기' : 
                         status === 'in_progress' ? '진행중' : '대기'}
                        <span className="ml-2 text-xs text-gray-500">
                          ({activeTasks.filter(task => task.status === status).length})
                        </span>
                      </h3>
                      <div className="flex items-center">
                        {expandedTaskSections[status] ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                    
                    {expandedTaskSections[status] && (
                      <div className="px-3 pb-3 space-y-2">
                        {activeTasks.filter(task => task.status === status).length === 0 ? (
                          <div className="text-center py-4 text-gray-500 text-sm">
                            등록된 업무가 없습니다.
                          </div>
                        ) : (
                          activeTasks
                            .filter(task => task.status === status)
                            .map(task => {
                              const hasManual = !!task.linked_hub_article_id?.trim()
                              return (
                              <div
                                key={task.id}
                                className={`bg-white p-2 border rounded-md shadow-sm ${getTaskPriorityBorderClass(task.priority)}`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    {(() => {
                                      const badge = getTaskPriorityBadge(task.priority)
                                      return (
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${badge.className}`}>
                                          {badge.label}
                                        </span>
                                      )
                                    })()}
                                    {hasManual ? (
                                      <button
                                        type="button"
                                        onClick={() => manualCtx?.openManual(task.linked_hub_article_id)}
                                        className={`inline-flex min-w-0 items-center gap-1 text-sm truncate hover:text-primary ${
                                          task.status === 'completed' ? 'line-through text-gray-500' : ''
                                        }`}
                                        title="메뉴얼 보기"
                                      >
                                        <span className="truncate">{task.title}</span>
                                        <BookOpen className="h-3 w-3 shrink-0 text-indigo-600" aria-hidden />
                                      </button>
                                    ) : (
                                      <span className={`text-sm truncate ${task.status === 'completed' ? 'line-through text-gray-500' : ''}`}>
                                        {task.title}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {canEditTask(task) && (
                                      <button
                                        type="button"
                                        onClick={() => startEditTask(task)}
                                        className="p-1 text-gray-500 hover:text-primary hover:bg-muted/50 rounded transition-colors"
                                        title="수정"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </button>
                                    )}
                                    {isAdminUser && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => void completeTask(task.id)}
                                          className="px-2 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                        >
                                          완료
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void deleteTaskSoft(task.id)}
                                          className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                                        >
                                          삭제
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-start justify-between gap-2 mt-1">
                                  <p className="text-xs text-gray-400 shrink-0">
                                    작성: {new Date(task.created_at).toLocaleString()}
                                  </p>
                                  <CommentThread
                                    comments={getCommentsByTarget('task', task.id)}
                                    value={commentInputs[getCommentKey('task', task.id)] || ''}
                                    onChange={(value) => setCommentInput('task', task.id, value)}
                                    onSubmit={() => addComment('task', task.id)}
                                    onDelete={deleteComment}
                                    canDelete={canDeleteComment}
                                    teamMembers={teamMembers}
                                    compact
                                    alignRight
                                    enabled={isCommentsFeatureEnabled}
                                  />
                                </div>
                                <div className="mt-1 text-xs text-gray-500 flex items-center flex-wrap gap-1">
                                  <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                    {getTeamMemberDisplayName(task.created_by, teamMembers)}
                                  </span>
                                  <span className="mx-0.5">&gt;</span>
                                  {(() => {
                                    const targets = getTaskTargetBadges(task, teamMembers)
                                    return targets.length > 0 ? (
                                      <span className="flex items-center flex-wrap gap-1">
                                        {targets.map(target => (
                                          <span
                                            key={`${task.id}-target-${target.key}`}
                                            className={`px-2 py-0.5 rounded-full ${target.className}`}
                                          >
                                            {target.label}
                                          </span>
                                        ))}
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">전체</span>
                                    )
                                  })()}
                                </div>
                                {task.description && <p className="text-xs text-gray-500 mt-1">{task.description}</p>}
                                {task.due_date && (
                                  <p className="text-xs text-gray-400 mt-1">
                                    마감: {new Date(task.due_date).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* 3) 전달사항 */}
            <section className="bg-white rounded-lg shadow border p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">전달사항</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setArchivedModalSection('announcements')
                      setShowArchivedModal(true)
                    }}
                    className="px-2 py-1 text-xs border rounded text-gray-700 hover:bg-gray-100"
                    title="완료/삭제 내역 보기"
                  >
                    완료/삭제 보기
                  </button>
                  <button
                    onClick={() => setShowNewAnnouncement(true)}
                    className="w-8 h-8 bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center justify-center transition-colors"
                    title="새 공지"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {activeAnnouncements.length === 0 ? (
                <div className="text-sm text-gray-500">등록된 공지가 없습니다.</div>
              ) : (
                <div className="space-y-4">
                  {/* 미확인 전달사항 */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">미확인 전달사항</h3>
                    <ul className="space-y-3">
                      {activeAnnouncements.filter(a => {
                        const acks = acksByAnnouncement[a.id] || []
                        const recipients = a.recipients || []
                        if (recipients.length === 0) return true // 전체 대상인 경우
                        return !recipients.every(email => acks.some(ack => ack.ack_by === email))
                      }).map(a => {
                        const acks = acksByAnnouncement[a.id] || []
                        const mineAck = !!acks.find(x => (x.ack_by || '').toLowerCase() === authUser?.email?.toLowerCase())
                        const hasManual = !!a.linked_hub_article_id?.trim()
                        return (
                          <li key={a.id} className="border rounded-md p-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <button
                                  type="button"
                                  disabled={!hasManual}
                                  onClick={() => hasManual && manualCtx?.openManual(a.linked_hub_article_id)}
                                  className={`w-full text-left ${hasManual ? 'group cursor-pointer' : 'cursor-default'}`}
                                >
                                  <div className="flex items-center space-x-2">
                                    {a.is_pinned && <span className="inline-flex items-center text-amber-600 text-xs font-semibold">PIN</span>}
                                    <h3 className={`text-base font-semibold ${hasManual ? 'group-hover:text-primary' : ''}`}>{a.title}</h3>
                                    {hasManual && (
                                      <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-800">
                                        <BookOpen className="h-2.5 w-2.5" />
                                        메뉴얼
                                      </span>
                                    )}
                                    {a.priority && a.priority !== 'normal' && (
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${a.priority==='urgent'?'bg-red-600 text-white':a.priority==='high'?'bg-red-100 text-red-700':'bg-gray-100 text-gray-600'}`}>{a.priority}</span>
                                    )}
                                  </div>
                                  <p className={`mt-1 text-sm text-gray-700 whitespace-pre-wrap ${hasManual ? 'group-hover:text-gray-900' : ''}`}>{a.content}</p>
                                </button>
                                {/* 날짜 | 작성자 배지 > 대상 배지들 */}
                                <div className="mt-2 text-xs text-gray-500 flex items-center flex-wrap gap-1">
                                  <span>{new Date(a.created_at).toLocaleString()} |</span>
                                  {(() => {
                                    const author = teamMembers.find(m => (m.email || '').toLowerCase() === (a.created_by || '').toLowerCase())
                                    const authorName = author?.name_ko || (a.created_by ? a.created_by.split('@')[0] : '작성자')
                                    return (
                                  <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700">{authorName}</span>
                                    )
                                  })()}
                                  <span className="mx-1">&gt;</span>
                                  {(() => {
                                    const names = (a.recipients || []).map((email: string) => {
                                      const member = teamMembers.find(m => (m.email || '').toLowerCase() === (email || '').toLowerCase())
                                      const display = member?.name_ko || (email ? email.split('@')[0] : '')
                                      const isAcked = !!acks.find(x => (x.ack_by || '').toLowerCase() === (email || '').toLowerCase())
                                      return { name: display, acked: isAcked }
                                    }).filter(Boolean)
                                    return names.length > 0 ? (
                                      <span className="flex items-center flex-wrap gap-1">
                                        {names.map((n, idx) => (
                                          <span key={`${a.id}-rec-${idx}`} className={`px-2 py-0.5 rounded-full ${n.acked ? 'bg-primary/10 text-primary' : 'bg-red-100 text-red-700'}`}>{n.name}</span>
                                        ))}
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">전체</span>
                                    )
                                  })()}
                                </div>
                                {/* tags & due */}
                                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                                  {a.tags && a.tags.map((t, idx) => (
                                    <span key={`${a.id}-tag-${idx}`} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded">#{t}</span>
                                  ))}
                                  {a.due_by && (
                                    <span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded">Due: {new Date(a.due_by).toLocaleString()}</span>
                                  )}
                                  {a.is_archived ? (
                                    <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded">Archived</span>
                                  ) : null}
                                </div>
                                <CommentThread
                                  comments={getCommentsByTarget('announcement', a.id)}
                                  value={commentInputs[getCommentKey('announcement', a.id)] || ''}
                                  onChange={(value) => setCommentInput('announcement', a.id, value)}
                                  onSubmit={() => addComment('announcement', a.id)}
                                  onDelete={deleteComment}
                                  canDelete={canDeleteComment}
                                  teamMembers={teamMembers}
                                  enabled={isCommentsFeatureEnabled}
                                />
                              </div>
                              <div className="flex items-center space-x-2">
                                {isAdminUser && (
                                  <button
                                    onClick={() => void completeAnnouncement(a.id)}
                                    className="px-2 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                    title="완료 처리"
                                  >
                                    완료
                                  </button>
                                )}
                                <button onClick={() => togglePin(a)} className="p-1 text-gray-500 hover:text-gray-700" title="핀 고정">
                                  {a.is_pinned ? <PinOff className="w-4 h-4"/> : <Pin className="w-4 h-4"/>}
                                </button>
                                {canEditAnnouncement(a) && (
                                  <>
                                    <button 
                                      onClick={() => startEditAnnouncement(a)} 
                                      className="p-1 text-gray-500 hover:text-primary hover:bg-muted/50 rounded transition-colors"
                                      title="수정"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => deleteAnnouncement(a.id)} 
                                      className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                      title="삭제"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                                <button 
                                  onClick={() => mineAck ? unackAnnouncement(a.id) : ackAnnouncement(a.id)} 
                                  className={`p-1 rounded transition-colors ${mineAck ? 'text-primary hover:bg-muted/50' : 'text-gray-400 hover:bg-gray-50'}`}
                                  title={mineAck ? "확인 취소" : "확인"}
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>

                  {/* 모두 확인된 전달사항 */}
                  {activeAnnouncements.filter(a => {
                    const acks = acksByAnnouncement[a.id] || []
                    const recipients = a.recipients || []
                    if (recipients.length === 0) return acks.length > 0 // 전체 대상인 경우
                    return recipients.every(email => acks.some(ack => ack.ack_by === email))
                  }).length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-3">모두 확인된 전달사항</h3>
                      <ul className="space-y-3">
                        {activeAnnouncements.filter(a => {
                          const acks = acksByAnnouncement[a.id] || []
                          const recipients = a.recipients || []
                          if (recipients.length === 0) return acks.length > 0 // 전체 대상인 경우
                          return recipients.every(email => acks.some(ack => ack.ack_by === email))
                        }).map(a => {
                          const acks = acksByAnnouncement[a.id] || []
                          const mineAck = !!acks.find(x => (x.ack_by || '').toLowerCase() === authUser?.email?.toLowerCase())
                          const hasManual = !!a.linked_hub_article_id?.trim()
                          return (
                            <li key={a.id} className="border rounded-md p-3 bg-gray-50">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <button
                                    type="button"
                                    disabled={!hasManual}
                                    onClick={() => hasManual && manualCtx?.openManual(a.linked_hub_article_id)}
                                    className={`w-full text-left ${hasManual ? 'group cursor-pointer' : 'cursor-default'}`}
                                  >
                                    <div className="flex items-center space-x-2">
                                      {a.is_pinned && <span className="inline-flex items-center text-amber-600 text-xs font-semibold">PIN</span>}
                                      <h3 className={`text-base font-semibold text-gray-600 ${hasManual ? 'group-hover:text-primary' : ''}`}>{a.title}</h3>
                                      {hasManual && (
                                        <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-800">
                                          <BookOpen className="h-2.5 w-2.5" />
                                          메뉴얼
                                        </span>
                                      )}
                                      {a.priority && a.priority !== 'normal' && (
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${a.priority==='urgent'?'bg-red-600 text-white':a.priority==='high'?'bg-red-100 text-red-700':'bg-gray-100 text-gray-600'}`}>{a.priority}</span>
                                      )}
                                    </div>
                                    <p className={`mt-1 text-sm text-gray-600 whitespace-pre-wrap ${hasManual ? 'group-hover:text-gray-800' : ''}`}>{a.content}</p>
                                  </button>
                                  {/* 날짜 | 작성자 배지 > 대상 배지들 */}
                                  <div className="mt-2 text-xs text-gray-500 flex items-center flex-wrap gap-1">
                                    <span>{new Date(a.created_at).toLocaleString()} |</span>
                                    {(() => {
                                      const author = teamMembers.find(m => (m.email || '').toLowerCase() === (a.created_by || '').toLowerCase())
                                      const authorName = author?.name_ko || (a.created_by ? a.created_by.split('@')[0] : '작성자')
                                      return (
                                    <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700">{authorName}</span>
                                      )
                                    })()}
                                    <span className="mx-1">&gt;</span>
                                    {(() => {
                                      const names = (a.recipients || []).map((email: string) => {
                                        const member = teamMembers.find(m => (m.email || '').toLowerCase() === (email || '').toLowerCase())
                                        const display = member?.name_ko || (email ? email.split('@')[0] : '')
                                        const isAcked = !!acks.find(x => (x.ack_by || '').toLowerCase() === (email || '').toLowerCase())
                                        return { name: display, acked: isAcked }
                                      }).filter(Boolean)
                                      return names.length > 0 ? (
                                        <span className="flex items-center flex-wrap gap-1">
                                          {names.map((n, idx) => (
                                            <span key={`${a.id}-rec-${idx}`} className={`px-2 py-0.5 rounded-full ${n.acked ? 'bg-primary/10 text-primary' : 'bg-red-100 text-red-700'}`}>{n.name}</span>
                                          ))}
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">전체</span>
                                      )
                                    })()}
                                  </div>
                                  {/* tags & due */}
                                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                                    {a.tags && a.tags.map((t, idx) => (
                                      <span key={`${a.id}-tag-${idx}`} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded">#{t}</span>
                                    ))}
                                    {a.due_by && (
                                      <span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded">Due: {new Date(a.due_by).toLocaleString()}</span>
                                    )}
                                    {a.is_archived ? (
                                      <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded">Archived</span>
                                    ) : null}
                                  </div>
                                  <CommentThread
                                    comments={getCommentsByTarget('announcement', a.id)}
                                    value={commentInputs[getCommentKey('announcement', a.id)] || ''}
                                    onChange={(value) => setCommentInput('announcement', a.id, value)}
                                    onSubmit={() => addComment('announcement', a.id)}
                                    onDelete={deleteComment}
                                    canDelete={canDeleteComment}
                                    teamMembers={teamMembers}
                                    enabled={isCommentsFeatureEnabled}
                                  />
                                </div>
                                <div className="flex items-center space-x-2">
                                  {isAdminUser && (
                                    <button
                                      onClick={() => void completeAnnouncement(a.id)}
                                      className="px-2 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                      title="완료 처리"
                                    >
                                      완료
                                    </button>
                                  )}
                                  <button onClick={() => togglePin(a)} className="p-1 text-gray-500 hover:text-gray-700" title="핀 고정">
                                    {a.is_pinned ? <PinOff className="w-4 h-4"/> : <Pin className="w-4 h-4"/>}
                                  </button>
                                  {canEditAnnouncement(a) && (
                                    <>
                                      <button 
                                        onClick={() => startEditAnnouncement(a)} 
                                        className="p-1 text-gray-500 hover:text-primary hover:bg-muted/50 rounded transition-colors"
                                        title="수정"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </button>
                                      <button 
                                        onClick={() => deleteAnnouncement(a.id)} 
                                        className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                        title="삭제"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
                                  <button 
                                    onClick={() => mineAck ? unackAnnouncement(a.id) : ackAnnouncement(a.id)} 
                                    className={`p-1 rounded transition-colors ${mineAck ? 'text-primary hover:bg-muted/50' : 'text-gray-400 hover:bg-gray-50'}`}
                                    title={mineAck ? "확인 취소" : "확인"}
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* 4) 이슈 */}
            <section className="bg-white rounded-lg shadow border p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">이슈</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setArchivedModalSection('issues')
                      setShowArchivedModal(true)
                    }}
                    className="px-2 py-1 text-xs border rounded text-gray-700 hover:bg-gray-100"
                    title="완료/삭제 내역 보기"
                  >
                    완료/삭제 보기
                  </button>
                  <button
                    onClick={() => openWorkModal('issue')}
                    className="w-8 h-8 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center transition-colors"
                    title="새 이슈"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <IssuePanel
                issues={activeIssues}
                getComments={(issueId) => getCommentsByTarget('issue', issueId)}
                getInputValue={(issueId) => commentInputs[getCommentKey('issue', issueId)] || ''}
                onInputChange={(issueId, value) => setCommentInput('issue', issueId, value)}
                onSubmitComment={(issueId) => addComment('issue', issueId)}
                onDeleteComment={deleteComment}
                canDeleteComment={canDeleteComment}
                isAdminUser={isAdminUser}
                onCompleteIssue={completeIssue}
                onDeleteIssue={deleteIssueSoft}
                teamMembers={teamMembers}
                commentsEnabled={isCommentsFeatureEnabled}
              />
            </section>

          </div>
        )}

        {/* Edit Announcement Modal */}
        {editingAnnouncement && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-4">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">전달사항 수정</h3>
                  <div className="flex items-center gap-2">
                    {(['normal','low','high','urgent'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setEditAnnouncement({ ...editAnnouncement, priority: p })}
                        className={`px-3 py-1 text-sm rounded ${
                          editAnnouncement.priority === p
                            ? 'bg-orange-500 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {p === 'normal' ? '보통' : p === 'low' ? '낮음' : p === 'high' ? '높음' : '긴급'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">제목</label>
                    <input
                      type="text"
                      value={editAnnouncement.title}
                      onChange={(e) => setEditAnnouncement({ ...editAnnouncement, title: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="공지 제목"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">내용</label>
                    <textarea
                      value={editAnnouncement.content}
                      onChange={(e) => setEditAnnouncement({ ...editAnnouncement, content: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-ring"
                      rows={3}
                      placeholder="공지 내용"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">태그</label>
                      <input
                        type="text"
                        value={editAnnouncement.tags}
                        onChange={(e) => setEditAnnouncement({ ...editAnnouncement, tags: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder="예: 긴급, 회의"
                      />
                    </div>
                  </div>

                  <HubArticleManualLinkField
                    locale={uiLocale}
                    value={editAnnouncement.linked_hub_article_id}
                    onChange={(linked_hub_article_id) => setEditAnnouncement({ ...editAnnouncement, linked_hub_article_id })}
                    hubArticles={manualCtx?.hubArticles ?? []}
                    loading={manualCtx?.hubArticlesLoading ?? false}
                  />
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">전달 대상</label>
                    <div className="space-y-3">
                      <div className="flex space-x-3">
                        <button
                          type="button"
                          onClick={() => {
                            setTaskRecipientMode('individual')
                            setSelectedTaskPositions([])
                            setSelectedTaskIndividuals([])
                          }}
                          className={`px-4 py-2 rounded text-sm font-medium ${
                            taskRecipientMode === 'individual'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          개별 선택
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTaskRecipientMode('group')
                            setSelectedTaskPositions([])
                            setSelectedTaskIndividuals([])
                          }}
                          className={`px-4 py-2 rounded text-sm font-medium ${
                            taskRecipientMode === 'group'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          그룹 선택
                        </button>
                      </div>
                      
                      {taskRecipientMode === 'individual' ? (
                        <div className="border rounded">
                          {/* 탭 헤더 */}
                          <div className="flex border-b">
                            {POSITION_OPTIONS.map(({ value, label }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setActivePositionTab(value)}
                                className={`px-4 py-2 text-sm font-medium border-r last:border-r-0 transition-colors ${
                                  activePositionTab === value
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          
                          {/* 탭 내용 */}
                          <div className="p-4 max-h-40 overflow-y-auto">
                            <div className="flex flex-wrap gap-2">
                              {teamMembers
                                .filter(member => normalizePosition(member.position) === activePositionTab && member.is_active)
                                .map(member => (
                                  <button
                                    key={member.email}
                                    type="button"
                                    onClick={() => {
                                      if (selectedTaskIndividuals.includes(member.email)) {
                                        setSelectedTaskIndividuals(selectedTaskIndividuals.filter(email => email !== member.email))
                                      } else {
                                        setSelectedTaskIndividuals([...selectedTaskIndividuals, member.email])
                                      }
                                    }}
                                    className={`px-3 py-2 text-sm rounded transition-colors ${
                                      selectedTaskIndividuals.includes(member.email)
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                                  >
                                    {member.name_ko}
                                  </button>
                                ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {POSITION_OPTIONS.map(({ value, label }) => (
                            <div key={value} className="border rounded p-3">
                              <button
                                type="button"
                                onClick={() => {
                                  if (selectedTaskPositions.includes(value)) {
                                    setSelectedTaskPositions(selectedTaskPositions.filter(pos => pos !== value))
                                    // 해당 position의 모든 직원들도 선택 해제
                                    const positionMembers = teamMembers
                                      .filter(member => normalizePosition(member.position) === value && member.is_active)
                                      .map(member => member.email)
                                    setSelectedTaskIndividuals(selectedTaskIndividuals.filter(email => !positionMembers.includes(email)))
                                  } else {
                                    setSelectedTaskPositions([...selectedTaskPositions, value])
                                    // 해당 position의 모든 직원들도 자동 선택
                                    const positionMembers = teamMembers
                                      .filter(member => normalizePosition(member.position) === value && member.is_active)
                                      .map(member => member.email)
                                    setSelectedTaskIndividuals([...new Set([...selectedTaskIndividuals, ...positionMembers])])
                                  }
                                }}
                                className={`w-full text-left px-3 py-2 text-sm font-medium rounded transition-colors ${
                                  selectedTaskPositions.includes(value)
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                              >
                                {label}
                              </button>
                              {selectedTaskPositions.includes(value) && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {teamMembers
                                    .filter(member => normalizePosition(member.position) === value && member.is_active)
                                    .map(member => (
                                      <button
                                        key={member.email}
                                        type="button"
                                        onClick={() => {
                                          if (selectedTaskIndividuals.includes(member.email)) {
                                            setSelectedTaskIndividuals(selectedTaskIndividuals.filter(email => email !== member.email))
                                          } else {
                                            setSelectedTaskIndividuals([...selectedTaskIndividuals, member.email])
                                          }
                                        }}
                                        className={`px-3 py-2 text-sm rounded transition-colors ${
                                          selectedTaskIndividuals.includes(member.email)
                                            ? 'bg-green-600 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                      >
                                        {member.name_ko}
                                      </button>
                                    ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2 mt-4">
                  <button
                    onClick={cancelEditAnnouncement}
                    className="px-3 py-1 text-xs text-gray-600 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    취소
                  </button>
                  <button
                    onClick={updateAnnouncement}
                    disabled={submitting}
                    className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                  >
                    {submitting ? '수정 중...' : '수정'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* New Announcement Modal */}
        {showNewAnnouncement && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-4">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">새 공지 작성</h3>
                  <div className="flex items-center gap-2">
                    {(['normal','low','high','urgent'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setNewAnnouncement({ ...newAnnouncement, priority: p })}
                        className={`px-3 py-1 text-sm rounded ${
                          newAnnouncement.priority === p
                            ? 'bg-orange-500 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {p === 'normal' ? '보통' : p === 'low' ? '낮음' : p === 'high' ? '높음' : '긴급'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">제목</label>
                    <input
                      type="text"
                      value={newAnnouncement.title}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="공지 제목"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">내용</label>
                    <textarea
                      value={newAnnouncement.content}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-ring"
                      rows={3}
                      placeholder="공지 내용"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">태그</label>
                      <input
                        type="text"
                        value={newAnnouncement.tags}
                        onChange={(e) => setNewAnnouncement({ ...newAnnouncement, tags: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder="예: 긴급, 회의"
                      />
                    </div>
                  </div>

                  <HubArticleManualLinkField
                    locale={uiLocale}
                    value={newAnnouncement.linked_hub_article_id}
                    onChange={(linked_hub_article_id) => setNewAnnouncement({ ...newAnnouncement, linked_hub_article_id })}
                    hubArticles={manualCtx?.hubArticles ?? []}
                    loading={manualCtx?.hubArticlesLoading ?? false}
                  />
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">전달 대상</label>
                    <div className="space-y-3">
                      <div className="flex space-x-3">
                        <button
                          type="button"
                          onClick={() => {
                            setTaskRecipientMode('individual')
                            setSelectedTaskPositions([])
                            setSelectedTaskIndividuals([])
                          }}
                          className={`px-4 py-2 rounded text-sm font-medium ${
                            taskRecipientMode === 'individual'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          개별 선택
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTaskRecipientMode('group')
                            setSelectedTaskPositions([])
                            setSelectedTaskIndividuals([])
                          }}
                          className={`px-4 py-2 rounded text-sm font-medium ${
                            taskRecipientMode === 'group'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          그룹 선택
                        </button>
                      </div>
                      
                      {taskRecipientMode === 'individual' ? (
                        <div className="border rounded">
                          {/* 탭 헤더 */}
                          <div className="flex border-b">
                            {POSITION_OPTIONS.map(({ value, label }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setActivePositionTab(value)}
                                className={`px-4 py-2 text-sm font-medium border-r last:border-r-0 transition-colors ${
                                  activePositionTab === value
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          
                          {/* 탭 내용 */}
                          <div className="p-4 max-h-40 overflow-y-auto">
                            <div className="flex flex-wrap gap-2">
                              {teamMembers
                                .filter(member => normalizePosition(member.position) === activePositionTab && member.is_active)
                                .map(member => (
                                  <button
                                    key={member.email}
                                    type="button"
                                    onClick={() => {
                                      if (selectedTaskIndividuals.includes(member.email)) {
                                        setSelectedTaskIndividuals(selectedTaskIndividuals.filter(email => email !== member.email))
                                      } else {
                                        setSelectedTaskIndividuals([...selectedTaskIndividuals, member.email])
                                      }
                                    }}
                                    className={`px-3 py-2 text-sm rounded transition-colors ${
                                      selectedTaskIndividuals.includes(member.email)
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                                  >
                                    {member.name_ko}
                                  </button>
                                ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {POSITION_OPTIONS.map(({ value, label }) => (
                            <div key={value} className="border rounded p-3">
                              <button
                                type="button"
                                onClick={() => {
                                  if (selectedTaskPositions.includes(value)) {
                                    setSelectedTaskPositions(selectedTaskPositions.filter(pos => pos !== value))
                                    // 해당 position의 모든 직원들도 선택 해제
                                    const positionMembers = teamMembers
                                      .filter(member => normalizePosition(member.position) === value && member.is_active)
                                      .map(member => member.email)
                                    setSelectedTaskIndividuals(selectedTaskIndividuals.filter(email => !positionMembers.includes(email)))
                                  } else {
                                    setSelectedTaskPositions([...selectedTaskPositions, value])
                                    // 해당 position의 모든 직원들도 자동 선택
                                    const positionMembers = teamMembers
                                      .filter(member => normalizePosition(member.position) === value && member.is_active)
                                      .map(member => member.email)
                                    setSelectedTaskIndividuals([...new Set([...selectedTaskIndividuals, ...positionMembers])])
                                  }
                                }}
                                className={`w-full text-left px-3 py-2 text-sm font-medium rounded transition-colors ${
                                  selectedTaskPositions.includes(value)
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                              >
                                {label}
                              </button>
                              {selectedTaskPositions.includes(value) && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {teamMembers
                                    .filter(member => normalizePosition(member.position) === value && member.is_active)
                                    .map(member => (
                                      <button
                                        key={member.email}
                                        type="button"
                                        onClick={() => {
                                          if (selectedTaskIndividuals.includes(member.email)) {
                                            setSelectedTaskIndividuals(selectedTaskIndividuals.filter(email => email !== member.email))
                                          } else {
                                            setSelectedTaskIndividuals([...selectedTaskIndividuals, member.email])
                                          }
                                        }}
                                        className={`px-3 py-2 text-sm rounded transition-colors ${
                                          selectedTaskIndividuals.includes(member.email)
                                            ? 'bg-green-600 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                      >
                                        {member.name_ko}
                                      </button>
                                    ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2 mt-4">
                  <button
                    onClick={() => setShowNewAnnouncement(false)}
                    className="px-3 py-1 text-xs text-gray-600 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleCreateAnnouncement}
                    disabled={submitting}
                    className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                  >
                    {submitting ? '작성 중...' : '작성'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <TeamBoardTodoManagePanel
          locale={uiLocale}
          manageOpen={showNewTodoModal}
          onManageClose={() => setShowNewTodoModal(false)}
          createOpen={showTodoCreateModal}
          onCreateOpenChange={setShowTodoCreateModal}
          opTodos={opTodos}
          onTodosChange={setOpTodos}
          authEmail={authUser?.email}
          editTodoId={editTodoId}
          onEditTodoIdChange={setEditTodoId}
          createFormSeed={todoCreateFormSeed}
          onCreateFormSeedApplied={() => setTodoCreateFormSeed(null)}
        />

        <TourQuickPrintHost
          locale={uiLocale}
          request={tourQuickPrint}
          onClose={() => setTourQuickPrint(null)}
        />
        <TourPickupNotificationHost
          locale={uiLocale}
          request={tourPickupNotification}
          onClose={() => setTourPickupNotification(null)}
        />

        {/* Issue Modal */}
        {showWorkModal && workModalType === 'issue' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-4">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">새 이슈</h3>
                  <div className="flex items-center gap-2">
                    {(['low','medium','high','critical'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setNewIssue({ ...newIssue, priority: p })}
                        className={`px-3 py-1 text-sm rounded ${
                          newIssue.priority === p
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {p === 'low' ? '낮음' : p === 'medium' ? '보통' : p === 'high' ? '높음' : '치명적'}
                      </button>
                    ))}
                  </div>
                </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">이슈 제목</label>
                <input 
                  value={newIssue.title} 
                  onChange={e => setNewIssue({ ...newIssue, title: e.target.value })} 
                  placeholder="이슈 제목을 입력하세요" 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">설명</label>
                <textarea 
                  value={newIssue.description} 
                  onChange={e => setNewIssue({ ...newIssue, description: e.target.value })} 
                  placeholder="이슈 설명을 입력하세요" 
                  rows={4} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">우선순위</label>
                <div className="flex flex-wrap gap-2">
                  {(['low','medium','high','critical'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewIssue({ ...newIssue, priority: p })}
                      className={`px-3 py-2 text-sm rounded ${
                        newIssue.priority === p
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {p === 'low' ? '낮음' : p === 'medium' ? '보통' : p === 'high' ? '높음' : '치명적'}
                    </button>
                  ))}
                </div>
              </div>
                
              <div className="flex justify-end space-x-3 pt-4">
                <button 
                  onClick={closeWorkModal} 
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button 
                  disabled={submitting} 
                  onClick={createIssue} 
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? '등록 중...' : '이슈 등록'}
                </button>
              </div>
            </div>
            </div>
          </div>
          </div>
        )}

        {/* New / Edit Task Modal */}
        {(showNewTaskModal || editingTask) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-4">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">{editingTask ? '업무 수정' : '새 업무 추가'}</h3>
                  <div className="flex items-center gap-2">
                    {(['low','medium','high','urgent'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setNewTask({ ...newTask, priority: p })}
                        className={`px-3 py-1 text-sm rounded ${
                          newTask.priority === p
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {p === 'low' ? '낮음' : p === 'medium' ? '보통' : p === 'high' ? '높음' : '긴급'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">제목</label>
                    <input
                      type="text"
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="업무 제목"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">설명</label>
                    <textarea
                      value={newTask.description}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-ring"
                      rows={2}
                      placeholder="업무 설명"
                    />
                  </div>
                  
                  <div className={`grid gap-3 ${editingTask ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">마감일</label>
                      <input
                        type="datetime-local"
                        value={newTask.due_date}
                        onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">우선순위</label>
                      <select
                        value={newTask.priority}
                        onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as 'low' | 'medium' | 'high' | 'urgent' })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="low">낮음</option>
                        <option value="medium">보통</option>
                        <option value="high">높음</option>
                        <option value="urgent">긴급</option>
                      </select>
                    </div>
                    {editingTask && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">상태</label>
                        <select
                          value={editingTask.status}
                          onChange={(e) =>
                            setEditingTask({
                              ...editingTask,
                              status: e.target.value as Task['status'],
                            })
                          }
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="pending">대기</option>
                          <option value="in_progress">진행중</option>
                          <option value="completed">완료</option>
                          <option value="cancelled">취소</option>
                        </select>
                      </div>
                    )}
                  </div>
                  
                  <HubArticleManualLinkField
                    locale={uiLocale}
                    value={newTask.linked_hub_article_id}
                    onChange={(linked_hub_article_id) => setNewTask({ ...newTask, linked_hub_article_id })}
                    hubArticles={manualCtx?.hubArticles ?? []}
                    loading={manualCtx?.hubArticlesLoading ?? false}
                    compact
                  />

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">전달 대상</label>
                    <div className="space-y-2">
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setTaskRecipientMode('individual')
                            setSelectedTaskPositions([])
                            setSelectedTaskIndividuals([])
                          }}
                          className={`px-3 py-1 rounded text-xs font-medium ${
                            taskRecipientMode === 'individual'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          개별 선택
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTaskRecipientMode('group')
                            setSelectedTaskPositions([])
                            setSelectedTaskIndividuals([])
                          }}
                          className={`px-3 py-1 rounded text-xs font-medium ${
                            taskRecipientMode === 'group'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          그룹 선택
                        </button>
                      </div>
                  
                  {taskRecipientMode === 'individual' ? (
                    <div className="border rounded">
                      {/* 탭 헤더 */}
                      <div className="flex border-b">
                        {POSITION_OPTIONS.map(({ value, label }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setActivePositionTab(value)}
                            className={`px-3 py-2 text-xs font-medium border-r last:border-r-0 transition-colors ${
                              activePositionTab === value
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      
                      {/* 탭 내용 */}
                      <div className="p-3 max-h-32 overflow-y-auto">
                        <div className="flex flex-wrap gap-1">
                          {teamMembers
                            .filter(member => normalizePosition(member.position) === activePositionTab && member.is_active)
                            .map(member => (
                              <button
                                key={member.email}
                                type="button"
                                onClick={() => {
                                  if (selectedTaskIndividuals.includes(member.email)) {
                                    setSelectedTaskIndividuals(selectedTaskIndividuals.filter(email => email !== member.email))
                                  } else {
                                    setSelectedTaskIndividuals([...selectedTaskIndividuals, member.email])
                                  }
                                }}
                                className={`px-2 py-1 text-xs rounded transition-colors ${
                                  selectedTaskIndividuals.includes(member.email)
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                              >
                                {member.name_ko}
                              </button>
                            ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {POSITION_OPTIONS.map(({ value, label }) => (
                        <div key={value} className="border rounded p-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedTaskPositions.includes(value)) {
                                setSelectedTaskPositions(selectedTaskPositions.filter(pos => pos !== value))
                                // 해당 position의 모든 직원들도 선택 해제
                                const positionMembers = teamMembers
                                  .filter(member => normalizePosition(member.position) === value && member.is_active)
                                  .map(member => member.email)
                                setSelectedTaskIndividuals(selectedTaskIndividuals.filter(email => !positionMembers.includes(email)))
                              } else {
                                setSelectedTaskPositions([...selectedTaskPositions, value])
                                // 해당 position의 모든 직원들도 자동 선택
                                const positionMembers = teamMembers
                                  .filter(member => normalizePosition(member.position) === value && member.is_active)
                                  .map(member => member.email)
                                setSelectedTaskIndividuals([...new Set([...selectedTaskIndividuals, ...positionMembers])])
                              }
                            }}
                            className={`w-full text-left px-2 py-1 text-xs font-medium rounded transition-colors ${
                              selectedTaskPositions.includes(value)
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            {label}
                          </button>
                          {selectedTaskPositions.includes(value) && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {teamMembers
                                .filter(member => normalizePosition(member.position) === value && member.is_active)
                                .map(member => (
                                  <button
                                    key={member.email}
                                    type="button"
                                    onClick={() => {
                                      if (selectedTaskIndividuals.includes(member.email)) {
                                        setSelectedTaskIndividuals(selectedTaskIndividuals.filter(email => email !== member.email))
                                      } else {
                                        setSelectedTaskIndividuals([...selectedTaskIndividuals, member.email])
                                      }
                                    }}
                                    className={`px-2 py-1 text-xs rounded transition-colors ${
                                      selectedTaskIndividuals.includes(member.email)
                                        ? 'bg-green-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                  >
                                    {member.name_ko}
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2 mt-4">
                  <button
                    onClick={closeTaskModal}
                    className="px-3 py-1 text-xs text-gray-600 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => (editingTask ? void updateTask(editingTask.status) : void createTask())}
                    disabled={submitting}
                    className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                  >
                    {submitting ? (editingTask ? '저장 중...' : '생성 중...') : editingTask ? '저장' : '생성'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Completed/Deleted Modal */}
        {showArchivedModal && (
          <Modal onClose={() => setShowArchivedModal(false)}>
            <h3 className="text-lg font-semibold mb-4">
              {archivedModalSection === 'tasks'
                ? '업무 완료/삭제 내역'
                : archivedModalSection === 'announcements'
                ? '전달사항 완료/삭제 내역'
                : '이슈 완료/삭제 내역'}
            </h3>

            <div className="space-y-3">
              {archivedModalSection === 'tasks' && (
                archivedTasks.length === 0 ? (
                  <p className="text-sm text-gray-500">완료/삭제된 업무가 없습니다.</p>
                ) : (
                  archivedTasks.map(task => (
                    <div
                      key={`arch-task-${task.id}`}
                      className={`border rounded p-3 ${getTaskPriorityBorderClass(task.priority)}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            {(() => {
                              const badge = getTaskPriorityBadge(task.priority)
                              return (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${badge.className}`}>
                                  {badge.label}
                                </span>
                              )
                            })()}
                            <div className="text-sm font-medium">{task.title}</div>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            상태: {task.is_deleted ? '삭제됨' : task.status === 'completed' ? '완료됨' : '취소됨'} | 작성: {new Date(task.created_at).toLocaleString()}
                          </div>
                        </div>
                        {isAdminUser && (
                          <button
                            type="button"
                            onClick={() => void restoreTask(String(task.id))}
                            className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90"
                          >
                            복구
                          </button>
                        )}
                      </div>
                      <div className="mt-2 space-y-1">
                        {getStatusLogsByTarget('task', String(task.id))
                          .slice(0, expandedStatusLogs[getStatusLogKey('task', String(task.id))] ? undefined : 3)
                          .map(log => (
                          <div key={log.id} className="text-xs text-gray-500">
                            [{new Date(log.changed_at).toLocaleString()}] {getMemberDisplayName(log.changed_by)} - {getStatusActionLabel(log.action)}
                          </div>
                        ))}
                        {getStatusLogsByTarget('task', String(task.id)).length > 3 && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedStatusLogs(prev => ({
                                ...prev,
                                [getStatusLogKey('task', String(task.id))]: !prev[getStatusLogKey('task', String(task.id))],
                              }))
                            }
                            className="text-xs text-primary hover:text-primary/80"
                          >
                            {expandedStatusLogs[getStatusLogKey('task', String(task.id))] ? '접기' : '더보기'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )
              )}

              {archivedModalSection === 'announcements' && (
                archivedAnnouncements.length === 0 ? (
                  <p className="text-sm text-gray-500">완료/삭제된 전달사항이 없습니다.</p>
                ) : (
                  archivedAnnouncements.map(announcement => (
                    <div key={`arch-ann-${announcement.id}`} className="border rounded p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium">{announcement.title}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            상태: {announcement.is_deleted ? '삭제됨' : '완료됨'} | 작성: {new Date(announcement.created_at).toLocaleString()}
                          </div>
                        </div>
                        {isAdminUser && (
                          <button
                            type="button"
                            onClick={() => void restoreAnnouncement(announcement.id)}
                            className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90"
                          >
                            복구
                          </button>
                        )}
                      </div>
                      <div className="mt-2 space-y-1">
                        {getStatusLogsByTarget('announcement', announcement.id)
                          .slice(0, expandedStatusLogs[getStatusLogKey('announcement', announcement.id)] ? undefined : 3)
                          .map(log => (
                          <div key={log.id} className="text-xs text-gray-500">
                            [{new Date(log.changed_at).toLocaleString()}] {getMemberDisplayName(log.changed_by)} - {getStatusActionLabel(log.action)}
                          </div>
                        ))}
                        {getStatusLogsByTarget('announcement', announcement.id).length > 3 && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedStatusLogs(prev => ({
                                ...prev,
                                [getStatusLogKey('announcement', announcement.id)]: !prev[getStatusLogKey('announcement', announcement.id)],
                              }))
                            }
                            className="text-xs text-primary hover:text-primary/80"
                          >
                            {expandedStatusLogs[getStatusLogKey('announcement', announcement.id)] ? '접기' : '더보기'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )
              )}

              {archivedModalSection === 'issues' && (
                archivedIssues.length === 0 ? (
                  <p className="text-sm text-gray-500">완료/삭제된 이슈가 없습니다.</p>
                ) : (
                  archivedIssues.map(issue => (
                    <div key={`arch-issue-${issue.id}`} className="border rounded p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium">{issue.title}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            상태: {issue.is_deleted ? '삭제됨' : issue.status === 'resolved' ? '완료됨' : '닫힘'} | 작성: {new Date(issue.created_at).toLocaleString()}
                          </div>
                        </div>
                        {isAdminUser && (
                          <button
                            type="button"
                            onClick={() => void restoreIssue(issue.id)}
                            className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90"
                          >
                            복구
                          </button>
                        )}
                      </div>
                      <div className="mt-2 space-y-1">
                        {getStatusLogsByTarget('issue', issue.id)
                          .slice(0, expandedStatusLogs[getStatusLogKey('issue', issue.id)] ? undefined : 3)
                          .map(log => (
                          <div key={log.id} className="text-xs text-gray-500">
                            [{new Date(log.changed_at).toLocaleString()}] {getMemberDisplayName(log.changed_by)} - {getStatusActionLabel(log.action)}
                          </div>
                        ))}
                        {getStatusLogsByTarget('issue', issue.id).length > 3 && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedStatusLogs(prev => ({
                                ...prev,
                                [getStatusLogKey('issue', issue.id)]: !prev[getStatusLogKey('issue', issue.id)],
                              }))
                            }
                            className="text-xs text-primary hover:text-primary/80"
                          >
                            {expandedStatusLogs[getStatusLogKey('issue', issue.id)] ? '접기' : '더보기'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          </Modal>
        )}

        {/* History Modal */}
        {showHistoryModal && selectedCategory && (
          <Modal onClose={() => setShowHistoryModal(false)}>
            <h3 className="text-lg font-semibold mb-4">
              {selectedCategory === 'daily' ? '일일' : 
               selectedCategory === 'weekly' ? '주간' :
               selectedCategory === 'monthly' ? '월간' : '연간'} 히스토리
            </h3>
            <div className="max-h-96 overflow-y-auto">
              {categoryHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  히스토리가 없습니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {categoryHistory.map((log, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            log.action === 'completed' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {log.action === 'completed' ? '완료' : '미완료'}
                          </span>
                          <span className="font-medium text-sm">{log.todoTitle}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {log.user} - {new Date(log.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-between mt-4">
              <button 
                onClick={() => selectedCategory && resetCategoryTodos(selectedCategory)} 
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
              >
                리셋
              </button>
              <button 
                onClick={() => setShowHistoryModal(false)} 
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                닫기
              </button>
            </div>
          </Modal>
        )}
      </div>
    </ProtectedRoute>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-6xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-end mb-4">
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5"/>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}



function DeferredDailyPanel({
  panelIndex,
  className = '',
  children,
}: {
  panelIndex: number
  className?: string
  children: (queryEnabled: boolean) => React.ReactNode
}) {
  const mounted = useDeferredPanelMount(panelIndex)
  const { ref, inViewport } = useInViewport({ enabled: mounted, rootMargin: '280px 0px' })
  const queryEnabled = mounted && inViewport

  if (!mounted) {
    return (
      <div className={className}>
        <TodoPanelMountSkeleton />
      </div>
    )
  }

  return (
    <div ref={ref} className={className}>
      {children(queryEnabled)}
    </div>
  )
}

function ChecklistPanel({ opTodos, selectedDepartment, onDepartmentChange, onAddTodo, onManageNotifications, onEditTodo, onEditEnvelopePrintTodo, onEditPickupNotificationTodo, onEditGuideScheduleConfirmTodo, onEditCustomerInfoReviewTodo, onEditCancelRebookingFollowUpTodo, onEditPendingCustomerManagementTodo, onCancelFollowUpManualChange, onOpenReservation, onEditOtaClosureTodo, onEditTourHotelManagementTodo, onEditTourHotelPriceCheckTodo, onEditTourSettlementTodo, onEditReservationAgencyManagementTodo, onEditAntelopeCanyonBookingTodo, onOpenTourDetail, onQuickPrint, onPickupAction, locale, toggleTodoCompletion, openHistoryModal }: { 
  opTodos: OpTodo[]; 
  selectedDepartment: 'all' | 'office' | 'guide' | 'common';
  onDepartmentChange: (department: 'all' | 'office' | 'guide' | 'common') => void;
  onAddTodo: () => void; 
  onManageNotifications: () => void;
  onEditTodo: (todo: OpTodo) => void;
  onEditEnvelopePrintTodo: () => void;
  onEditPickupNotificationTodo: () => void;
  onEditGuideScheduleConfirmTodo: () => void;
  onEditCustomerInfoReviewTodo: () => void;
  onEditCancelRebookingFollowUpTodo: () => void;
  onEditPendingCustomerManagementTodo: () => void;
  onCancelFollowUpManualChange: (
    reservationId: string,
    kind: CancelFollowUpManualKind,
    action: 'mark' | 'clear'
  ) => void | Promise<void>;
  onOpenReservation: (reservationId: string) => void;
  onEditOtaClosureTodo: () => void;
  onEditTourHotelManagementTodo: () => void;
  onEditTourHotelPriceCheckTodo: () => void;
  onEditTourSettlementTodo: () => void;
  onEditReservationAgencyManagementTodo: () => void;
  onEditAntelopeCanyonBookingTodo: () => void;
  onOpenTourDetail: (tourId: string) => void;
  onQuickPrint: (tourId: string, kind: TourQuickPrintKind) => void;
  onPickupAction: (tourId: string, kind: TourPickupNotificationKind) => void;
  locale: string;
  toggleTodoCompletion: (id: string, is_completed: boolean) => Promise<void>;
  openHistoryModal: (category: 'daily' | 'weekly' | 'monthly' | 'yearly') => void;
}) {
  const openTodoAction = useOpTodoActionClick('admin')
  const manualCtx = useTeamBoardManualOptional()
  const envelopeTargetDate = useMemo(() => tourEnvelopePrintTargetDate(), [])
  const linkedEnvelopeTodo = useMemo(() => findTourEnvelopePrintLinkedTodo(opTodos), [opTodos])
  const [envelopeLocalCompleted, setEnvelopeLocalCompleted] = useState(() =>
    readTourEnvelopePrintLocalCompleted(envelopeTargetDate)
  )
  const envelopeCompleted = linkedEnvelopeTodo?.completed ?? envelopeLocalCompleted

  useEffect(() => {
    setEnvelopeLocalCompleted(readTourEnvelopePrintLocalCompleted(envelopeTargetDate))
  }, [envelopeTargetDate])

  useEffect(() => {
    if (linkedEnvelopeTodo) {
      setEnvelopeLocalCompleted(linkedEnvelopeTodo.completed)
    }
  }, [linkedEnvelopeTodo?.id, linkedEnvelopeTodo?.completed])

  const pickupCompletionDateKey = useMemo(() => pickupNotificationCompletionDateKey(), [])
  const linkedPickupTodo = useMemo(() => findPickupNotificationLinkedTodo(opTodos), [opTodos])
  const [pickupLocalCompleted, setPickupLocalCompleted] = useState(() =>
    readPickupNotificationLocalCompleted(pickupCompletionDateKey)
  )
  const pickupCompleted = linkedPickupTodo?.completed ?? pickupLocalCompleted

  useEffect(() => {
    setPickupLocalCompleted(readPickupNotificationLocalCompleted(pickupCompletionDateKey))
  }, [pickupCompletionDateKey])

  useEffect(() => {
    if (linkedPickupTodo) {
      setPickupLocalCompleted(linkedPickupTodo.completed)
    }
  }, [linkedPickupTodo?.id, linkedPickupTodo?.completed])

  const guideConfirmCompletionDateKey = useMemo(() => guideScheduleConfirmCompletionDateKey(), [])
  const linkedGuideConfirmTodo = useMemo(() => findGuideScheduleConfirmLinkedTodo(opTodos), [opTodos])
  const [guideConfirmLocalCompleted, setGuideConfirmLocalCompleted] = useState(() =>
    readGuideScheduleConfirmLocalCompleted(guideConfirmCompletionDateKey)
  )
  const guideConfirmCompleted = linkedGuideConfirmTodo?.completed ?? guideConfirmLocalCompleted

  useEffect(() => {
    setGuideConfirmLocalCompleted(readGuideScheduleConfirmLocalCompleted(guideConfirmCompletionDateKey))
  }, [guideConfirmCompletionDateKey])

  useEffect(() => {
    if (linkedGuideConfirmTodo) {
      setGuideConfirmLocalCompleted(linkedGuideConfirmTodo.completed)
    }
  }, [linkedGuideConfirmTodo?.id, linkedGuideConfirmTodo?.completed])

  const customerInfoReviewDateKey = useMemo(() => customerInfoReviewCompletionDateKey(), [])
  const linkedCustomerInfoReviewTodo = useMemo(
    () => findCustomerInfoReviewLinkedTodo(opTodos),
    [opTodos]
  )
  const [customerInfoReviewLocalCompleted, setCustomerInfoReviewLocalCompleted] = useState(() =>
    readCustomerInfoReviewLocalCompleted(customerInfoReviewDateKey)
  )
  const customerInfoReviewCompleted =
    linkedCustomerInfoReviewTodo?.completed ?? customerInfoReviewLocalCompleted

  useEffect(() => {
    setCustomerInfoReviewLocalCompleted(readCustomerInfoReviewLocalCompleted(customerInfoReviewDateKey))
  }, [customerInfoReviewDateKey])

  useEffect(() => {
    if (linkedCustomerInfoReviewTodo) {
      setCustomerInfoReviewLocalCompleted(linkedCustomerInfoReviewTodo.completed)
    }
  }, [linkedCustomerInfoReviewTodo?.id, linkedCustomerInfoReviewTodo?.completed])

  const cancelRebookingDateKey = useMemo(() => cancelRebookingFollowUpCompletionDateKey(), [])
  const linkedCancelRebookingTodo = useMemo(
    () => findCancelRebookingFollowUpLinkedTodo(opTodos),
    [opTodos]
  )
  const [cancelRebookingLocalCompleted, setCancelRebookingLocalCompleted] = useState(() =>
    readCancelRebookingFollowUpLocalCompleted(cancelRebookingDateKey)
  )
  const cancelRebookingCompleted =
    linkedCancelRebookingTodo?.completed ?? cancelRebookingLocalCompleted

  useEffect(() => {
    setCancelRebookingLocalCompleted(readCancelRebookingFollowUpLocalCompleted(cancelRebookingDateKey))
  }, [cancelRebookingDateKey])

  useEffect(() => {
    if (linkedCancelRebookingTodo) {
      setCancelRebookingLocalCompleted(linkedCancelRebookingTodo.completed)
    }
  }, [linkedCancelRebookingTodo?.id, linkedCancelRebookingTodo?.completed])

  const pendingCustomerDateKey = useMemo(() => pendingCustomerManagementCompletionDateKey(), [])
  const linkedPendingCustomerTodo = useMemo(
    () => findPendingCustomerManagementLinkedTodo(opTodos),
    [opTodos]
  )
  const [pendingCustomerLocalCompleted, setPendingCustomerLocalCompleted] = useState(() =>
    readPendingCustomerManagementLocalCompleted(pendingCustomerDateKey)
  )
  const pendingCustomerCompleted =
    linkedPendingCustomerTodo?.completed ?? pendingCustomerLocalCompleted

  useEffect(() => {
    setPendingCustomerLocalCompleted(readPendingCustomerManagementLocalCompleted(pendingCustomerDateKey))
  }, [pendingCustomerDateKey])

  useEffect(() => {
    if (linkedPendingCustomerTodo) {
      setPendingCustomerLocalCompleted(linkedPendingCustomerTodo.completed)
    }
  }, [linkedPendingCustomerTodo?.id, linkedPendingCustomerTodo?.completed])

  const otaClosureDateKey = useMemo(() => otaClosureCompletionDateKey(), [])
  const linkedOtaClosureTodo = useMemo(() => findOtaClosureLinkedTodo(opTodos), [opTodos])
  const [otaClosureLocalCompleted, setOtaClosureLocalCompleted] = useState(() =>
    readOtaClosureLocalCompleted(otaClosureDateKey)
  )
  const otaClosureCompleted = linkedOtaClosureTodo?.completed ?? otaClosureLocalCompleted

  useEffect(() => {
    setOtaClosureLocalCompleted(readOtaClosureLocalCompleted(otaClosureDateKey))
  }, [otaClosureDateKey])

  useEffect(() => {
    if (linkedOtaClosureTodo) {
      setOtaClosureLocalCompleted(linkedOtaClosureTodo.completed)
    }
  }, [linkedOtaClosureTodo?.id, linkedOtaClosureTodo?.completed])

  const tourHotelManagementDateKey = useMemo(() => tourHotelManagementCompletionDateKey(), [])
  const linkedTourHotelManagementTodo = useMemo(
    () => findTourHotelManagementLinkedTodo(opTodos),
    [opTodos]
  )
  const [tourHotelManagementLocalCompleted, setTourHotelManagementLocalCompleted] = useState(() =>
    readTourHotelManagementLocalCompleted(tourHotelManagementDateKey)
  )
  const tourHotelManagementCompleted =
    linkedTourHotelManagementTodo?.completed ?? tourHotelManagementLocalCompleted

  useEffect(() => {
    setTourHotelManagementLocalCompleted(readTourHotelManagementLocalCompleted(tourHotelManagementDateKey))
  }, [tourHotelManagementDateKey])

  useEffect(() => {
    if (linkedTourHotelManagementTodo) {
      setTourHotelManagementLocalCompleted(linkedTourHotelManagementTodo.completed)
    }
  }, [linkedTourHotelManagementTodo?.id, linkedTourHotelManagementTodo?.completed])

  const tourHotelPriceCheckDateKey = useMemo(() => tourHotelPriceCheckCompletionDateKey(), [])
  const linkedTourHotelPriceCheckTodo = useMemo(
    () => findTourHotelPriceCheckLinkedTodo(opTodos),
    [opTodos]
  )
  const [tourHotelPriceCheckLocalCompleted, setTourHotelPriceCheckLocalCompleted] = useState(() =>
    readTourHotelPriceCheckLocalCompleted(tourHotelPriceCheckDateKey)
  )
  const tourHotelPriceCheckCompleted =
    linkedTourHotelPriceCheckTodo?.completed ?? tourHotelPriceCheckLocalCompleted

  useEffect(() => {
    setTourHotelPriceCheckLocalCompleted(readTourHotelPriceCheckLocalCompleted(tourHotelPriceCheckDateKey))
  }, [tourHotelPriceCheckDateKey])

  useEffect(() => {
    if (linkedTourHotelPriceCheckTodo) {
      setTourHotelPriceCheckLocalCompleted(linkedTourHotelPriceCheckTodo.completed)
    }
  }, [linkedTourHotelPriceCheckTodo?.id, linkedTourHotelPriceCheckTodo?.completed])

  const tourSettlementDateKey = useMemo(() => tourSettlementCompletionDateKey(), [])
  const linkedTourSettlementTodo = useMemo(
    () => findTourSettlementLinkedTodo(opTodos),
    [opTodos]
  )
  const [tourSettlementLocalCompleted, setTourSettlementLocalCompleted] = useState(() =>
    readTourSettlementLocalCompleted(tourSettlementDateKey)
  )
  const tourSettlementCompleted =
    linkedTourSettlementTodo?.completed ?? tourSettlementLocalCompleted

  useEffect(() => {
    setTourSettlementLocalCompleted(readTourSettlementLocalCompleted(tourSettlementDateKey))
  }, [tourSettlementDateKey])

  useEffect(() => {
    if (linkedTourSettlementTodo) {
      setTourSettlementLocalCompleted(linkedTourSettlementTodo.completed)
    }
  }, [linkedTourSettlementTodo?.id, linkedTourSettlementTodo?.completed])

  const reservationAgencyManagementDateKey = useMemo(
    () => reservationAgencyManagementCompletionDateKey(),
    []
  )
  const linkedReservationAgencyManagementTodo = useMemo(
    () => findReservationAgencyManagementLinkedTodo(opTodos),
    [opTodos]
  )
  const [reservationAgencyManagementLocalCompleted, setReservationAgencyManagementLocalCompleted] =
    useState(() => readReservationAgencyManagementLocalCompleted(reservationAgencyManagementDateKey))
  const reservationAgencyManagementCompleted =
    linkedReservationAgencyManagementTodo?.completed ?? reservationAgencyManagementLocalCompleted

  useEffect(() => {
    setReservationAgencyManagementLocalCompleted(
      readReservationAgencyManagementLocalCompleted(reservationAgencyManagementDateKey)
    )
  }, [reservationAgencyManagementDateKey])

  useEffect(() => {
    if (linkedReservationAgencyManagementTodo) {
      setReservationAgencyManagementLocalCompleted(linkedReservationAgencyManagementTodo.completed)
    }
  }, [linkedReservationAgencyManagementTodo?.id, linkedReservationAgencyManagementTodo?.completed])

  const antelopeCanyonBookingDateKey = useMemo(() => antelopeCanyonBookingCompletionDateKey(), [])
  const linkedAntelopeCanyonBookingTodo = useMemo(
    () => findAntelopeCanyonBookingLinkedTodo(opTodos),
    [opTodos]
  )
  const [antelopeCanyonBookingLocalCompleted, setAntelopeCanyonBookingLocalCompleted] = useState(
    () => readAntelopeCanyonBookingLocalCompleted(antelopeCanyonBookingDateKey)
  )
  const antelopeCanyonBookingCompleted =
    linkedAntelopeCanyonBookingTodo?.completed ?? antelopeCanyonBookingLocalCompleted

  useEffect(() => {
    setAntelopeCanyonBookingLocalCompleted(
      readAntelopeCanyonBookingLocalCompleted(antelopeCanyonBookingDateKey)
    )
  }, [antelopeCanyonBookingDateKey])

  useEffect(() => {
    if (linkedAntelopeCanyonBookingTodo) {
      setAntelopeCanyonBookingLocalCompleted(linkedAntelopeCanyonBookingTodo.completed)
    }
  }, [linkedAntelopeCanyonBookingTodo?.id, linkedAntelopeCanyonBookingTodo?.completed])

  // useTranslations 훅을 조건부로 사용
  let t: (key: string) => string
  try {
    const translations = useTranslations('teamBoard')
    t = translations
  } catch (error) {
    console.warn('useTranslations failed in ChecklistPanel, using fallback:', error)
    // fallback 함수
    t = (key: string) => {
      const fallbacks: Record<string, string> = {
        'checklist': 'Todo List',
        'newTodo': '새 ToDo',
        'noTodos': '등록된 ToDo가 없습니다.'
      }
      return fallbacks[key] || key
    }
  }

  // department 필터링된 todos (고정 패널과 중복되는 DB 항목 제외)
  const filteredTodos = useMemo(() => {
    const base =
      selectedDepartment === 'all'
        ? opTodos
        : opTodos.filter((todo) => todo.department === selectedDepartment)
    return base.filter(
      (todo) =>
        !shouldHideTodoChipForEnvelopePrintPanel(todo) &&
        !shouldHideTodoChipForPickupNotificationPanel(todo) &&
        !shouldHideTodoChipForGuideScheduleConfirmPanel(todo) &&
        !shouldHideTodoChipForCustomerInfoReviewPanel(todo) &&
        !shouldHideTodoChipForCancelRebookingFollowUpPanel(todo) &&
        !shouldHideTodoChipForPendingCustomerManagementPanel(todo) &&
        !shouldHideTodoChipForOtaClosurePanel(todo) &&
        !shouldHideTodoChipForTourHotelManagementPanel(todo) &&
        !shouldHideTodoChipForTourHotelPriceCheckPanel(todo) &&
        !shouldHideTodoChipForTourSettlementPanel(todo) &&
        !shouldHideTodoChipForReservationAgencyManagementPanel(todo) &&
        !shouldHideTodoChipForAntelopeCanyonBookingPanel(todo)
    )
  }, [opTodos, selectedDepartment])

  const completionPercentage = useMemo(() => {
    if (filteredTodos.length === 0) return 0
    const completedCount = filteredTodos.filter(todo => todo.completed).length
    return Math.round((completedCount / filteredTodos.length) * 100)
  }, [filteredTodos])

  // Helper: 날짜/기간 표기
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const formatDailyLabel = (d: Date) => {
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`
  }
  const formatWeeklyRange = (d: Date) => {
    // 주: 일요일 시작 ~ 토요일 끝
    const start = new Date(d)
    start.setDate(d.getDate() - d.getDay())
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return `${start.getMonth() + 1}월 ${start.getDate()}일 - ${end.getMonth() + 1}월 ${end.getDate()}일`
  }
  const formatMonthlyLabel = (d: Date) => `${d.getFullYear()}년 ${d.getMonth() + 1}월`
  const formatYearlyLabel = (d: Date) => `${d.getFullYear()}년`

  // 색상 매핑 (카드/게이지)
  const colorByCategory: Record<'daily'|'weekly'|'monthly'|'yearly', { cardBg: string; cardBorder: string; barBg: string; barFill: string; badge: string }> = {
    daily:   { cardBg: 'bg-primary/5',   cardBorder: 'border-border',   barBg: 'bg-primary/10',   barFill: 'bg-primary/50',   badge: 'bg-primary/10 text-primary' },
    weekly:  { cardBg: 'bg-slate-50',  cardBorder: 'border-slate-200',  barBg: 'bg-slate-100',  barFill: 'bg-slate-400',  badge: 'bg-slate-100 text-slate-700' },
    monthly: { cardBg: 'bg-green-50',  cardBorder: 'border-green-200',  barBg: 'bg-green-100',  barFill: 'bg-green-500',  badge: 'bg-green-100 text-green-700' },
    yearly:  { cardBg: 'bg-purple-50', cardBorder: 'border-purple-200', barBg: 'bg-purple-100', barFill: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700' },
  }

  const dailyCollageItemClass = 'mb-2 w-full break-inside-avoid'

  const renderCategoryCard = (
    category: 'daily' | 'weekly' | 'monthly' | 'yearly',
    className = ''
  ) => {
    const categoryTodos = filteredTodos.filter((todo) => todo.category === category)
    const now = new Date()
    const colors = colorByCategory[category]
    const headerLabel =
      category === 'daily'
        ? formatDailyLabel(now)
        : category === 'weekly'
          ? formatWeeklyRange(now)
          : category === 'monthly'
            ? formatMonthlyLabel(now)
            : formatYearlyLabel(now)

    const completedCount = categoryTodos.filter((t) => t.completed).length
    const percent =
      categoryTodos.length === 0 ? 0 : Math.round((completedCount / categoryTodos.length) * 100)

    return (
      <div
        key={category}
        className={`rounded-lg border p-3 ${colors.cardBg} ${colors.cardBorder} ${className}`}
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h5 className="text-sm font-medium">
              {category === 'daily'
                ? '일일'
                : category === 'weekly'
                  ? '주간'
                  : category === 'monthly'
                    ? '월간'
                    : '연간'}
            </h5>
            <span className={`rounded px-2 py-0.5 text-xs ${colors.badge}`}>{headerLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{percent}%</span>
            <button
              onClick={() => openHistoryModal(category)}
              className="rounded p-1 text-gray-500 transition-colors hover:bg-muted/50 hover:text-primary"
              title="히스토리 보기"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className={`h-1.5 w-full rounded ${colors.barBg}`}>
          <div className={`h-1.5 rounded ${colors.barFill}`} style={{ width: `${percent}%` }} />
        </div>

        <div
          className={
            category === 'daily'
              ? 'mt-2 columns-1 gap-2 md:columns-2 lg:columns-3'
              : 'mt-2 flex flex-wrap gap-1'
          }
        >
          {category === 'daily' && (
            <DeferredDailyPanel panelIndex={0} className={dailyCollageItemClass}>
              {(queryEnabled) => (
              <div
                className={`${dailyCollageItemClass} rounded border p-2 ${
                  envelopeCompleted
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-gray-300 bg-white'
                }`}
                title="우클릭: 수정"
              >
                <TourEnvelopePrintPanel
                  locale={locale}
                  variant="list"
                  queryEnabled={queryEnabled}
                  onQuickPrint={onQuickPrint}
                  linkedTodos={opTodos}
                  onToggleLinkedTodo={async (todo, completed) => {
                    await toggleTodoCompletion(todo.id, completed)
                  }}
                  onCompletedChange={setEnvelopeLocalCompleted}
                  onEditRequest={onEditEnvelopePrintTodo}
                />
              </div>
              )}
            </DeferredDailyPanel>
          )}
          {category === 'daily' && (
            <DeferredDailyPanel panelIndex={1} className={dailyCollageItemClass}>
              {(queryEnabled) => (
              <div
                className={`${dailyCollageItemClass} rounded border p-2 ${
                  pickupCompleted ? 'border-emerald-300 bg-emerald-50' : 'border-gray-300 bg-white'
                }`}
                title="우클릭: 수정"
              >
                <PickupNotificationPanel
                  locale={locale}
                  variant="list"
                  queryEnabled={queryEnabled}
                  linkedTodos={opTodos}
                  onToggleLinkedTodo={async (todo, completed) => {
                    await toggleTodoCompletion(todo.id, completed)
                  }}
                  onCompletedChange={setPickupLocalCompleted}
                  onPickupAction={onPickupAction}
                  onEditRequest={onEditPickupNotificationTodo}
                />
              </div>
              )}
            </DeferredDailyPanel>
          )}
          {category === 'daily' && (
            <DeferredDailyPanel panelIndex={2} className={dailyCollageItemClass}>
              {(queryEnabled) => (
              <div
                className={`${dailyCollageItemClass} rounded border p-2 ${
                  guideConfirmCompleted
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-gray-300 bg-white'
                }`}
                title="우클릭: 수정"
              >
                <GuideScheduleConfirmPanel
                  locale={locale}
                  variant="list"
                  queryEnabled={queryEnabled}
                  linkedTodos={opTodos}
                  onToggleLinkedTodo={async (todo, completed) => {
                    await toggleTodoCompletion(todo.id, completed)
                  }}
                  onCompletedChange={setGuideConfirmLocalCompleted}
                  onEditRequest={onEditGuideScheduleConfirmTodo}
                />
              </div>
              )}
            </DeferredDailyPanel>
          )}
          {category === 'daily' && (
            <DeferredDailyPanel panelIndex={3} className={dailyCollageItemClass}>
              {(queryEnabled) => (
              <div
                className={`${dailyCollageItemClass} rounded border p-2 ${
                  customerInfoReviewCompleted
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-gray-300 bg-white'
                }`}
                title="우클릭: 수정"
              >
                <CustomerInfoReviewPanel
                  locale={locale}
                  variant="list"
                  queryEnabled={queryEnabled}
                  linkedTodos={opTodos}
                  onToggleLinkedTodo={async (todo, completed) => {
                    await toggleTodoCompletion(todo.id, completed)
                  }}
                  onCompletedChange={setCustomerInfoReviewLocalCompleted}
                  onEditRequest={onEditCustomerInfoReviewTodo}
                />
              </div>
              )}
            </DeferredDailyPanel>
          )}
          {category === 'daily' && (
            <DeferredDailyPanel panelIndex={4} className={dailyCollageItemClass}>
              {(queryEnabled) => (
              <div
                className={`${dailyCollageItemClass} rounded border p-2 ${
                  cancelRebookingCompleted
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-gray-300 bg-white'
                }`}
                title="우클릭: 수정"
              >
                <CancelRebookingFollowUpPanel
                  locale={locale}
                  variant="list"
                  queryEnabled={queryEnabled}
                  linkedTodos={opTodos}
                  onToggleLinkedTodo={async (todo, completed) => {
                    await toggleTodoCompletion(todo.id, completed)
                  }}
                  onCompletedChange={setCancelRebookingLocalCompleted}
                  onEditRequest={onEditCancelRebookingFollowUpTodo}
                  onOpenReservation={onOpenReservation}
                  onCancelFollowUpManualChange={onCancelFollowUpManualChange}
                />
              </div>
              )}
            </DeferredDailyPanel>
          )}
          {category === 'daily' && (
            <DeferredDailyPanel panelIndex={5} className={dailyCollageItemClass}>
              {(queryEnabled) => (
              <div
                className={`${dailyCollageItemClass} rounded border p-2 ${
                  pendingCustomerCompleted
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-gray-300 bg-white'
                }`}
                title="우클릭: 수정"
              >
                <PendingCustomerManagementPanel
                  locale={locale}
                  variant="list"
                  queryEnabled={queryEnabled}
                  linkedTodos={opTodos}
                  onToggleLinkedTodo={async (todo, completed) => {
                    await toggleTodoCompletion(todo.id, completed)
                  }}
                  onCompletedChange={setPendingCustomerLocalCompleted}
                  onEditRequest={onEditPendingCustomerManagementTodo}
                  onOpenReservation={onOpenReservation}
                />
              </div>
              )}
            </DeferredDailyPanel>
          )}
          {category === 'daily' && (
            <DeferredDailyPanel panelIndex={6} className={dailyCollageItemClass}>
              {(queryEnabled) => (
              <div
                className={`${dailyCollageItemClass} rounded border p-2 ${
                  otaClosureCompleted ? 'border-emerald-300 bg-emerald-50' : 'border-gray-300 bg-white'
                }`}
                title="우클릭: 수정"
              >
                <OtaClosurePanel
                  locale={locale}
                  variant="list"
                  queryEnabled={queryEnabled}
                  linkedTodos={opTodos}
                  onToggleLinkedTodo={async (todo, completed) => {
                    await toggleTodoCompletion(todo.id, completed)
                  }}
                  onCompletedChange={setOtaClosureLocalCompleted}
                  onEditRequest={onEditOtaClosureTodo}
                />
              </div>
              )}
            </DeferredDailyPanel>
          )}
          {category === 'daily' && (
            <DeferredDailyPanel panelIndex={7} className={dailyCollageItemClass}>
              {(queryEnabled) => (
              <div
                className={`${dailyCollageItemClass} rounded border p-2 ${
                  tourHotelManagementCompleted
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-gray-300 bg-white'
                }`}
                title="우클릭: 수정"
              >
                <TourHotelManagementPanel
                  locale={locale}
                  variant="list"
                  queryEnabled={queryEnabled}
                  linkedTodos={opTodos}
                  onToggleLinkedTodo={async (todo, completed) => {
                    await toggleTodoCompletion(todo.id, completed)
                  }}
                  onCompletedChange={setTourHotelManagementLocalCompleted}
                  onEditRequest={onEditTourHotelManagementTodo}
                  onOpenTourDetail={onOpenTourDetail}
                />
              </div>
              )}
            </DeferredDailyPanel>
          )}
          {category === 'daily' && (
            <DeferredDailyPanel panelIndex={8} className={dailyCollageItemClass}>
              {(queryEnabled) => (
              <div
                className={`${dailyCollageItemClass} rounded border p-2 ${
                  tourHotelPriceCheckCompleted
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-gray-300 bg-white'
                }`}
                title="우클릭: 수정"
              >
                <TourHotelPriceCheckPanel
                  locale={locale}
                  variant="list"
                  queryEnabled={queryEnabled}
                  linkedTodos={opTodos}
                  onToggleLinkedTodo={async (todo, completed) => {
                    await toggleTodoCompletion(todo.id, completed)
                  }}
                  onCompletedChange={setTourHotelPriceCheckLocalCompleted}
                  onEditRequest={onEditTourHotelPriceCheckTodo}
                  onOpenTourDetail={onOpenTourDetail}
                />
              </div>
              )}
            </DeferredDailyPanel>
          )}
          {category === 'daily' && (
            <DeferredDailyPanel panelIndex={9} className={dailyCollageItemClass}>
              {(queryEnabled) => (
              <div
                className={`${dailyCollageItemClass} rounded border p-2 ${
                  tourSettlementCompleted
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-gray-300 bg-white'
                }`}
                title="우클릭: 수정"
              >
                <TourSettlementPanel
                  locale={locale}
                  variant="list"
                  queryEnabled={queryEnabled}
                  linkedTodos={opTodos}
                  onToggleLinkedTodo={async (todo, completed) => {
                    await toggleTodoCompletion(todo.id, completed)
                  }}
                  onCompletedChange={setTourSettlementLocalCompleted}
                  onEditRequest={onEditTourSettlementTodo}
                  onOpenTourDetail={onOpenTourDetail}
                />
              </div>
              )}
            </DeferredDailyPanel>
          )}
          {category === 'daily' && (
            <DeferredDailyPanel panelIndex={10} className={dailyCollageItemClass}>
              {(queryEnabled) => (
              <div
                className={`${dailyCollageItemClass} rounded border p-2 ${
                  reservationAgencyManagementCompleted
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-gray-300 bg-white'
                }`}
                title="우클릭: 수정"
              >
                <ReservationAgencyManagementPanel
                  locale={locale}
                  variant="list"
                  queryEnabled={queryEnabled}
                  linkedTodos={opTodos}
                  onToggleLinkedTodo={async (todo, completed) => {
                    await toggleTodoCompletion(todo.id, completed)
                  }}
                  onCompletedChange={setReservationAgencyManagementLocalCompleted}
                  onEditRequest={onEditReservationAgencyManagementTodo}
                />
              </div>
              )}
            </DeferredDailyPanel>
          )}
          {category === 'daily' && (
            <DeferredDailyPanel panelIndex={11} className={dailyCollageItemClass}>
              {(queryEnabled) => (
              <div
                className={`${dailyCollageItemClass} rounded border p-2 ${
                  antelopeCanyonBookingCompleted
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-gray-300 bg-white'
                }`}
                title="우클릭: 수정"
              >
                <AntelopeCanyonBookingPanel
                  locale={locale}
                  variant="list"
                  queryEnabled={queryEnabled}
                  linkedTodos={opTodos}
                  onToggleLinkedTodo={async (todo, completed) => {
                    await toggleTodoCompletion(todo.id, completed)
                  }}
                  onCompletedChange={setAntelopeCanyonBookingLocalCompleted}
                  onEditRequest={onEditAntelopeCanyonBookingTodo}
                  onOpenTourDetail={onOpenTourDetail}
                />
              </div>
              )}
            </DeferredDailyPanel>
          )}
          {categoryTodos.length === 0 ? (
            category === 'daily' ? null : (
              <div className="w-full rounded border-2 border-dashed border-gray-200 py-4 text-center text-xs text-gray-500">
                항목 없음
              </div>
            )
          ) : (
            categoryTodos.map((todo) => {
              const hasManual = !!todo.linked_hub_article_id?.trim()
              const hasAction = opTodoHasAction(todo)
              const hasLink = hasManual || hasAction

              return (
                <div
                  key={todo.id}
                  className={
                    category === 'daily'
                      ? `${dailyCollageItemClass} min-w-0`
                      : 'inline-flex'
                  }
                  title="우클릭: 수정"
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onEditTodo(todo)
                  }}
                >
                  {hasLink ? (
                    <div
                      className={`items-stretch overflow-hidden rounded border text-xs ${
                        category === 'daily' ? 'flex w-full' : 'inline-flex'
                      } ${
                        todo.completed
                          ? 'border-emerald-300 bg-emerald-50'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => void toggleTodoCompletion(todo.id, !todo.completed)}
                        className="flex shrink-0 items-center px-1.5 text-gray-500 hover:bg-gray-100"
                        title="완료 토글"
                        aria-label={todo.completed ? '완료 취소' : '완료'}
                      >
                        {todo.completed ? (
                          <Check className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <Circle className="h-3 w-3" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (hasManual) {
                            manualCtx?.openManual(todo.linked_hub_article_id)
                            return
                          }
                          if (hasAction) openTodoAction(todo)
                        }}
                        className={`inline-flex items-center gap-1 px-2 py-1 hover:bg-gray-50 ${
                          category === 'daily' ? 'min-w-0 flex-1' : ''
                        } ${
                          todo.completed ? 'text-emerald-700 line-through' : 'text-gray-700'
                        }`}
                        title={hasManual ? '메뉴얼 보기' : '연결 열기'}
                      >
                        {todo.title}
                        {hasManual ? (
                          <BookOpen className="h-3 w-3 shrink-0 text-indigo-600" aria-hidden />
                        ) : (
                          <Link2 className="h-3 w-3 shrink-0 text-primary" aria-hidden />
                        )}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void toggleTodoCompletion(todo.id, !todo.completed)}
                      className={`rounded border px-2 py-1 text-xs ${
                        category === 'daily' ? 'w-full text-left' : ''
                      } ${
                        todo.completed
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 line-through'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {todo.title}
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    )
  }

  return (
    <section className="bg-white rounded-lg shadow border p-4 xl:col-span-3">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-lg font-semibold">Todo List</h2>
          <AdminTodoListManualButton locale={locale} />
        </div>
        <div className="flex items-center space-x-3 shrink-0">
          {/* Department 필터 */}
          <select
            value={selectedDepartment}
            onChange={(e) => onDepartmentChange(e.target.value as 'all' | 'office' | 'guide' | 'common')}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">전체</option>
            <option value="office">Office</option>
            <option value="guide">Guide</option>
            <option value="common">공통</option>
          </select>
          
          <span className="text-xs text-gray-500">{completionPercentage}%</span>
          <button
            onClick={onManageNotifications}
            className="px-3 py-1 text-xs font-medium rounded-md border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors"
            title="Todo 알림 관리"
          >
            Notification 관리
          </button>
          <button
            onClick={onAddTodo}
            className="w-8 h-8 bg-primary hover:bg-primary/90 text-white rounded-lg flex items-center justify-center transition-colors"
            title={t('newTodo')}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {renderCategoryCard('daily', 'lg:col-span-3')}
        <div className="flex flex-col gap-4 lg:col-span-1">
          {renderCategoryCard('weekly')}
          {renderCategoryCard('monthly')}
          {renderCategoryCard('yearly')}
        </div>
      </div>
    </section>
  )
}



function IssuePanel({
  issues,
  getComments,
  getInputValue,
  onInputChange,
  onSubmitComment,
  onDeleteComment,
  canDeleteComment,
  isAdminUser,
  onCompleteIssue,
  onDeleteIssue,
  teamMembers,
  commentsEnabled,
}: {
  issues: Issue[]
  getComments: (issueId: string) => TeamBoardComment[]
  getInputValue: (issueId: string) => string
  onInputChange: (issueId: string, value: string) => void
  onSubmitComment: (issueId: string) => void
  onDeleteComment: (commentId: string) => Promise<void>
  canDeleteComment: (comment: TeamBoardComment) => boolean
  isAdminUser: boolean
  onCompleteIssue: (issueId: string) => Promise<void>
  onDeleteIssue: (issueId: string) => Promise<void>
  teamMembers: TeamMember[]
  commentsEnabled: boolean
}) {
  const statusColors = {
    open: 'bg-red-100 text-red-700',
    in_progress: 'bg-primary/10 text-primary',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-700'
  }

  const priorityColors = {
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-primary/10 text-primary',
    high: 'bg-orange-100 text-orange-600',
    critical: 'bg-red-100 text-red-600'
  }

  if (issues.length === 0) {
    return <div className="text-sm text-gray-500">등록된 이슈가 없습니다.</div>
  }

  return (
    <div className="space-y-3">
      {issues.map(issue => (
        <div key={issue.id} className="border rounded-lg p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-medium text-gray-900">{issue.title}</h4>
              {issue.description && (
                <p className="text-sm text-gray-600 mt-1">{issue.description}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className={`px-2 py-1 rounded-full text-xs ${statusColors[issue.status as keyof typeof statusColors]}`}>
                  {issue.status === 'open' ? '열림' : 
                   issue.status === 'in_progress' ? '진행중' : 
                   issue.status === 'resolved' ? '해결됨' : '닫힘'}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs ${priorityColors[issue.priority as keyof typeof priorityColors]}`}>
                  {issue.priority === 'low' ? '낮음' : 
                   issue.priority === 'medium' ? '보통' : 
                   issue.priority === 'high' ? '높음' : '치명적'}
                </span>
                {isAdminUser && (
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={() => void onCompleteIssue(issue.id)}
                      className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700 transition-colors"
                    >
                      완료
                    </button>
                    <button
                      onClick={() => void onDeleteIssue(issue.id)}
                      className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="text-xs text-gray-400 ml-2">작성: {new Date(issue.created_at).toLocaleString()}</div>
          </div>
          <CommentThread
            comments={getComments(issue.id)}
            value={getInputValue(issue.id)}
            onChange={(value) => onInputChange(issue.id, value)}
            onSubmit={() => onSubmitComment(issue.id)}
            onDelete={onDeleteComment}
            canDelete={canDeleteComment}
            teamMembers={teamMembers}
            compact
            enabled={commentsEnabled}
          />
        </div>
      ))}
    </div>
  )
}

function CommentThread({
  comments,
  value,
  onChange,
  onSubmit,
  onDelete,
  canDelete,
  teamMembers,
  compact = false,
  alignRight = false,
  enabled = true,
}: {
  comments: TeamBoardComment[]
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onDelete: (commentId: string) => Promise<void>
  canDelete: (comment: TeamBoardComment) => boolean
  teamMembers: TeamMember[]
  compact?: boolean
  alignRight?: boolean
  enabled?: boolean
}) {
  const [showComposer, setShowComposer] = useState(false)
  const hasComments = comments.length > 0
  const showPanel = hasComments

  return (
    <div className={alignRight ? 'shrink-0 min-w-0' : 'mt-2'}>
      <div className={`flex items-center gap-2 ${alignRight ? 'justify-end' : ''}`}>
        <button
          type="button"
          onClick={() => {
            if (!enabled) {
              alert('댓글 기능을 사용하려면 DB 마이그레이션 적용이 필요합니다.')
              return
            }
            setShowComposer(prev => !prev)
          }}
          className="p-1.5 rounded-full bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
          title="댓글 입력"
        >
          <MessageCircle className="w-3.5 h-3.5" />
        </button>
        {enabled && (showComposer || value.trim().length > 0) && (
          <div className={`flex items-center gap-2 ${alignRight ? 'max-w-[12rem] sm:max-w-xs' : 'flex-1'}`}>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onSubmit()
                  setShowComposer(false)
                }
              }}
              placeholder="댓글 입력..."
              className={`px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-ring ${alignRight ? 'w-full min-w-0' : 'flex-1'}`}
            />
            <button
              type="button"
              onClick={() => {
                onSubmit()
                setShowComposer(false)
              }}
              className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
            >
              등록
            </button>
          </div>
        )}
      </div>

      {enabled && showPanel && (
        <div className={`${alignRight ? 'mt-1 flex justify-end' : 'mt-2'}`}>
          <div className={`border rounded-md bg-gray-50 ${compact ? 'p-2' : 'p-3'} ${alignRight ? 'w-full max-w-md' : 'w-full'}`}>
          {hasComments && (
            <div className="space-y-1 mb-2 max-h-28 overflow-y-auto">
              {comments.map((comment) => {
                const author = teamMembers.find(member => (member.email || '').toLowerCase() === (comment.created_by || '').toLowerCase())
                const authorName = author?.name_ko || (comment.created_by ? comment.created_by.split('@')[0] : '사용자')
                return (
                  <div key={comment.id} className="text-xs text-gray-700 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-medium text-gray-800 mr-1">{authorName}</span>
                      <span>{comment.comment}</span>
                      <span className="text-gray-400 ml-2">{new Date(comment.created_at).toLocaleString()}</span>
                    </div>
                    {canDelete(comment) && (
                      <button
                        type="button"
                        onClick={() => void onDelete(comment.id)}
                        className="shrink-0 px-1.5 py-0.5 rounded text-[10px] bg-red-50 text-red-600 hover:bg-red-100"
                        title="댓글 삭제"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  )
}

