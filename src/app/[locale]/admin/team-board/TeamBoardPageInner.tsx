'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useTranslations } from 'next-intl'
import { Check, Edit, Loader2, MessageCircle, Pin, PinOff, Plus, Trash2, X } from 'lucide-react'
import { OpTodoNotificationLayer } from '@/components/team-board/OpTodoNotificationLayer'
import { audiencesForTeamMember, computeNextNotifyAtIso } from '@/lib/opTodoSchedule'

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
const TB_OP_TODOS_LIMIT = 400
const TB_ANNOUNCEMENTS_LIMIT = 80
const TB_TASKS_LIMIT = 120
const TB_ISSUES_LIMIT = 120
const TB_ACKS_LIMIT = 4000
const TB_STATUS_LOGS_LIMIT = 250

const TB_OP_TODO_COLUMNS =
  'id,title,description,scope,category,department,assigned_to,due_date,completed,completed_at,created_by,created_at,updated_at,notify_enabled,notify_time,notify_weekday,notify_day_of_month,notify_month,next_notify_at'

const TB_TASK_COLUMNS =
  'id,title,description,due_date,priority,status,created_by,assigned_to,target_positions,target_individuals,tags,is_deleted,deleted_at,deleted_by,created_at,updated_at'

const TB_ISSUE_COLUMNS =
  'id,title,description,status,priority,reported_by,is_deleted,deleted_at,deleted_by,created_at,updated_at'

const POSITION_OPTIONS = [
  { value: 'manager', label: '매니저' },
  { value: 'admin', label: '관리자' },
  { value: 'tour guide', label: '가이드' },
  { value: 'op', label: 'OP' },
  { value: 'driver', label: '드라이버' },
] as const

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
  const [loading, setLoading] = useState(true)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [acksByAnnouncement, setAcksByAnnouncement] = useState<Record<string, Acknowledgment[]>>({})
  const [showNewAnnouncement, setShowNewAnnouncement] = useState(false)
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', recipients: [] as string[], priority: 'normal' as 'low'|'normal'|'high'|'urgent', tags: '' , target_positions: [] as string[] })
  const [submitting, setSubmitting] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [editAnnouncement, setEditAnnouncement] = useState({ title: '', content: '', recipients: [] as string[], priority: 'normal' as 'low'|'normal'|'high'|'urgent', tags: '' , target_positions: [] as string[] })

  const [opTodos, setOpTodos] = useState<OpTodo[]>([])
  const [showNewTodoModal, setShowNewTodoModal] = useState(false)
  const [newTodo, setNewTodo] = useState<{
    title: string
    description: string
    scope: 'common' | 'individual'
    category: 'daily' | 'weekly' | 'monthly' | 'yearly'
    department: 'office' | 'guide' | 'common'
    assigned_to: string
    notify_enabled: boolean
    notify_time: string
    notify_weekday: number
    notify_day_of_month: number
    notify_month: number
  }>({
    title: '',
    description: '',
    scope: 'common',
    category: 'daily',
    department: 'common',
    assigned_to: '',
    notify_enabled: false,
    notify_time: '09:00',
    notify_weekday: 1,
    notify_day_of_month: 1,
    notify_month: 1,
  })
  
  // 기존 항목 수정을 위한 상태
  const [editingTodo, setEditingTodo] = useState<OpTodo | null>(null)
  const [editTodoForm, setEditTodoForm] = useState<{
    title: string
    category: 'daily' | 'weekly' | 'monthly' | 'yearly'
    department: 'office' | 'guide' | 'common'
    notify_enabled: boolean
    notify_time: string
    notify_weekday: number
    notify_day_of_month: number
    notify_month: number
  }>({
    title: '',
    category: 'daily',
    department: 'common',
    notify_enabled: false,
    notify_time: '09:00',
    notify_weekday: 1,
    notify_day_of_month: 1,
    notify_month: 1,
  })
  
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
      const { data, error } = await supabase.rpc('manual_reset_todos')

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
  const [tasks, setTasks] = useState<Task[]>([])
  const [showNewTaskModal, setShowNewTaskModal] = useState(false)
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
    tags: [] as string[]
  })
  const [taskRecipientMode, setTaskRecipientMode] = useState<'individual' | 'group'>('individual')
  const [selectedTaskPositions, setSelectedTaskPositions] = useState<string[]>([])
  const [selectedTaskIndividuals, setSelectedTaskIndividuals] = useState<string[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
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
    try {
      setLoading(true)
      // 1차: ToDo + 팀(가벼운 select) 병렬 — 둘 중 느린 쪽만큼만 대기 후 스피너 종료
      const [{ data: opTodos }, { data: team }] = await Promise.all([
        supabase
          .from('op_todos')
          .select(TB_OP_TODO_COLUMNS)
          .order('created_at', { ascending: false })
          .limit(TB_OP_TODOS_LIMIT),
        supabase
          .from('team')
          .select('email, name_ko, position, is_active')
          .eq('is_active', true)
          .order('name_ko'),
      ])
      setOpTodos((opTodos || []) as OpTodo[])
      setTeamMembers((team || []) as unknown as TeamMember[])
    } finally {
      setLoading(false)
    }

    // 댓글·활동 로그는 공지 배치와 동시에 시작 (idle 지연 없음)
    void loadTeamBoardSecondary()

    // 2차: 공지·ack·이슈·업무 (팀은 이미 반영됨)
    void (async () => {
      try {
        const [{ data: anns }, { data: acks }, { data: iss }, { data: tks }] = await Promise.all([
          supabase
            .from('team_announcements')
            .select(
              'id,title,content,is_pinned,recipients,target_positions,priority,tags,due_by,is_archived,is_deleted,deleted_at,deleted_by,created_by,created_at,updated_at'
            )
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(TB_ANNOUNCEMENTS_LIMIT),
          supabase
            .from('team_announcement_acknowledgments')
            .select('id, announcement_id, ack_by, ack_at')
            .limit(TB_ACKS_LIMIT),
          supabase
            .from('issues')
            .select(TB_ISSUE_COLUMNS)
            .order('updated_at', { ascending: false, nullsFirst: false })
            .limit(TB_ISSUES_LIMIT),
          supabase
            .from('tasks')
            .select(TB_TASK_COLUMNS)
            .order('updated_at', { ascending: false, nullsFirst: false })
            .limit(TB_TASKS_LIMIT),
        ])

        setAnnouncements((anns || []) as Announcement[])

        const aMap: Record<string, Acknowledgment[]> = {}
        ;(acks as Acknowledgment[] || []).forEach((a) => {
          const key = a.announcement_id
          aMap[key] = aMap[key] || []
          aMap[key].push(a)
        })
        setAcksByAnnouncement(aMap)

        setIssues((iss || []) as unknown as Issue[])
        setTasks((tks || []) as unknown as Task[])
      } catch (e) {
        console.error('team-board secondary batch', e)
      }
    })()
  }

  const refreshOpTodosOnly = async () => {
    const { data, error } = await supabase
      .from('op_todos')
      .select(TB_OP_TODO_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(TB_OP_TODOS_LIMIT)
    if (!error) setOpTodos((data || []) as OpTodo[])
  }

  const checklistNotifyAudiences = useMemo(() => {
    const row = teamMembers.find((m) => (m.email || '').toLowerCase() === (authUser?.email || '').toLowerCase())
    return audiencesForTeamMember(row?.position ?? null)
  }, [teamMembers, authUser?.email])

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

      const { data, error } = await supabase
        .from('team_announcements')
        .insert([{ 
          title: newAnnouncement.title.trim(), 
          content: newAnnouncement.content.trim(), 
          created_by: authUser.email,
          recipients: finalIndividuals.length > 0 ? finalIndividuals : null,
          target_positions: taskRecipientMode === 'group' ? selectedTaskPositions : null,
          priority: newAnnouncement.priority,
          tags: newAnnouncement.tags ? newAnnouncement.tags.split(',').map(t => t.trim()).filter(Boolean) : []
        }] as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .select()
        .single()
      if (error) throw error
      setAnnouncements([data as Announcement, ...announcements])
      setShowNewAnnouncement(false)
      setNewAnnouncement({ title: '', content: '', recipients: [], priority: 'normal', tags: '', target_positions: [] })
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
      const { data, error } = await supabase
        .from('team_announcements')
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
      target_positions: announcement.target_positions || []
    })
    setSelectedTaskPositions(announcement.target_positions || [])
    setSelectedTaskIndividuals(announcement.recipients || [])
    setTaskRecipientMode(announcement.target_positions && announcement.target_positions.length > 0 ? 'group' : 'individual')
  }

  const cancelEditAnnouncement = () => {
    setEditingAnnouncement(null)
    setEditAnnouncement({ title: '', content: '', recipients: [], priority: 'normal', tags: '', target_positions: [] })
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

      const { data, error } = await supabase
        .from('team_announcements')
        .update({
          title: editAnnouncement.title.trim(),
          content: editAnnouncement.content.trim(),
          recipients: finalIndividuals.length > 0 ? finalIndividuals : null,
          target_positions: taskRecipientMode === 'group' ? selectedTaskPositions : null,
          priority: editAnnouncement.priority,
          tags: editAnnouncement.tags ? editAnnouncement.tags.split(',').map(t => t.trim()).filter(Boolean) : []
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
      const { data, error } = await supabase
        .from('team_announcements')
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



  const createTodo = async () => {
    if (!newTodo.title.trim() || !authUser?.email) return
    
    // 세션 상태 확인
    const { data: { session } } = await supabase.auth.getSession()
    console.log('createTodo - Session check:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      email: session?.user?.email,
      authUserEmail: authUser.email,
      accessToken: session?.access_token ? 'present' : 'missing',
      refreshToken: session?.refresh_token ? 'present' : 'missing',
      expiresAt: session?.expires_at,
      tokenType: session?.token_type
    })
    
    // 세션이 없으면 에러
    if (!session || !session.user) {
      console.error('No valid session found for database operation')
      
      // localStorage에서 세션 복원 시도
      const storedSession = localStorage.getItem('auth_session')
      if (storedSession) {
        try {
          const sessionData = JSON.parse(storedSession)
          if (sessionData.session) {
            console.log('createTodo: Attempting to restore session from localStorage...')
            const { error } = await supabase.auth.setSession(sessionData.session)
            if (error) {
              console.error('createTodo: Failed to restore session:', error)
              alert('세션이 만료되었습니다. 다시 로그인해주세요.')
              return
            } else {
              console.log('createTodo: Session restored successfully, retrying...')
              // 세션 복원 후 재시도
              return createTodo()
            }
          }
        } catch (error) {
          console.error('Error parsing stored session:', error)
        }
      }
      
      alert('세션이 만료되었습니다. 다시 로그인해주세요.')
      return
    }
    
    try {
      const schedule = newTodo.notify_enabled
        ? {
            category: newTodo.category,
            notifyTime: newTodo.notify_time,
            notifyWeekday: newTodo.notify_weekday,
            notifyDayOfMonth: newTodo.notify_day_of_month,
            notifyMonth: newTodo.notify_month,
          }
        : null
      const nextNotify = schedule ? computeNextNotifyAtIso(schedule) : null
      const payload = {
        title: newTodo.title.trim(),
        description: null,
        scope: 'common' as const,
        category: newTodo.category,
        department: newTodo.department,
        assigned_to: null,
        created_by: authUser.email,
        notify_enabled: !!newTodo.notify_enabled,
        notify_time: newTodo.notify_enabled ? newTodo.notify_time : null,
        notify_weekday: newTodo.notify_enabled && newTodo.category === 'weekly' ? newTodo.notify_weekday : null,
        notify_day_of_month:
          newTodo.notify_enabled && (newTodo.category === 'monthly' || newTodo.category === 'yearly')
            ? newTodo.notify_day_of_month
            : null,
        notify_month: newTodo.notify_enabled && newTodo.category === 'yearly' ? newTodo.notify_month : null,
        next_notify_at: nextNotify,
      }
      const { data, error } = await supabase
        .from('op_todos')
        .insert([payload] as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .select()
        .single()
      if (error) throw error
      setOpTodos(prev => [data as OpTodo, ...prev])
      setNewTodo({
        title: '',
        description: '',
        scope: 'common',
        category: 'daily',
        department: 'common',
        assigned_to: '',
        notify_enabled: false,
        notify_time: '09:00',
        notify_weekday: 1,
        notify_day_of_month: 1,
        notify_month: 1,
      })
    } catch (e) {
      console.error(e)
      alert('ToDo 생성 중 오류가 발생했습니다.')
    }
  }

  const deleteTodo = async (id: string) => {
    if (!confirm('정말로 이 항목을 삭제하시겠습니까?')) return
    try {
      const { error } = await supabase
        .from('op_todos')
        .delete()
        .eq('id', id)
      if (error) throw error
      setOpTodos(prev => prev.filter(todo => todo.id !== id))
    } catch (e) {
      console.error(e)
      alert('ToDo 삭제 중 오류가 발생했습니다.')
    }
  }

  // 기존 항목 수정을 위한 함수들
  const startEditTodo = (todo: OpTodo) => {
    setEditingTodo(todo)
    setEditTodoForm({
      title: todo.title,
      category: todo.category,
      department: todo.department,
      notify_enabled: !!todo.notify_enabled,
      notify_time: todo.notify_time || '09:00',
      notify_weekday: todo.notify_weekday ?? 1,
      notify_day_of_month: todo.notify_day_of_month ?? 1,
      notify_month: todo.notify_month ?? 1,
    })
  }

  const cancelEditTodo = () => {
    setEditingTodo(null)
    setEditTodoForm({
      title: '',
      category: 'daily',
      department: 'common',
      notify_enabled: false,
      notify_time: '09:00',
      notify_weekday: 1,
      notify_day_of_month: 1,
      notify_month: 1,
    })
  }

  const updateTodo = async () => {
    if (!editingTodo || !editTodoForm.title.trim()) return
    
    try {
      const schedule = editTodoForm.notify_enabled
        ? {
            category: editTodoForm.category,
            notifyTime: editTodoForm.notify_time,
            notifyWeekday: editTodoForm.notify_weekday,
            notifyDayOfMonth: editTodoForm.notify_day_of_month,
            notifyMonth: editTodoForm.notify_month,
          }
        : null
      const nextNotify = schedule ? computeNextNotifyAtIso(schedule) : null
      const { data, error } = await supabase
        .from('op_todos')
        .update({
          title: editTodoForm.title.trim(),
          category: editTodoForm.category,
          department: editTodoForm.department,
          notify_enabled: editTodoForm.notify_enabled,
          notify_time: editTodoForm.notify_enabled ? editTodoForm.notify_time : null,
          notify_weekday:
            editTodoForm.notify_enabled && editTodoForm.category === 'weekly' ? editTodoForm.notify_weekday : null,
          notify_day_of_month:
            editTodoForm.notify_enabled && (editTodoForm.category === 'monthly' || editTodoForm.category === 'yearly')
              ? editTodoForm.notify_day_of_month
              : null,
          notify_month: editTodoForm.notify_enabled && editTodoForm.category === 'yearly' ? editTodoForm.notify_month : null,
          next_notify_at: editTodoForm.notify_enabled ? nextNotify : null,
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .eq('id', editingTodo.id!)
        .select()
        .single()
      
      if (error) throw error
      setOpTodos(prev => prev.map(todo => todo.id === editingTodo.id! ? (data as OpTodo) : todo))
      cancelEditTodo()
    } catch (e) {
      console.error(e)
      alert('ToDo 수정 중 오류가 발생했습니다.')
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
      }
      const { data, error } = await supabase
        .from('tasks')
        .insert([payload] as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .select()
        .single()
      if (error) throw error
      setTasks(prev => [data as unknown as Task, ...prev])
      setShowNewTaskModal(false)
      setNewTask({
        title: '',
        description: '',
        due_date: '',
        priority: 'medium',
        assigned_to: '',
        target_positions: [],
        target_individuals: [],
        tags: []
      })
      setSelectedTaskPositions([])
      setSelectedTaskIndividuals([])
      setActivePositionTab('manager')
    } catch (e) {
      console.error(e)
      alert('업무 생성 중 오류가 발생했습니다.')
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
      const { data, error } = await supabase
        .from('team_announcements')
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
      const { data, error } = await supabase
        .from('team_announcements')
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
        {authUser?.email ? (
          <OpTodoNotificationLayer
            supabase={supabase}
            userEmail={authUser.email}
            audiences={checklistNotifyAudiences}
            onRefresh={() => void refreshOpTodosOnly()}
          />
        ) : null}
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
              onAddTodo={() => {
                setNewTodo({
                  ...newTodo,
                  category: 'daily',
                  scope: 'individual',
                  department: 'common',
                  assigned_to: authUser?.email || '',
                  notify_enabled: false,
                  notify_time: '09:00',
                  notify_weekday: 1,
                  notify_day_of_month: 1,
                  notify_month: 1,
                })
                setShowNewTodoModal(true)
              }}
              toggleTodoCompletion={async (id: string, is_completed: boolean) => {
                console.log('ChecklistPanel toggleTodoCompletion called with:', { id, is_completed })
                if (!authUser?.email) {
                  console.log('No authUser email in ChecklistPanel')
                  return
                }
                
                setSubmitting(true)
                try {
                  console.log('Updating todo in database...')
                  // ToDo 상태 업데이트
                  const { error } = await supabase
                    .from('op_todos')
                    .update({ completed: is_completed, completed_at: is_completed ? new Date().toISOString() : null } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
                    .eq('id', id)
                  
                if (error) {
                  console.error('Error toggling todo completion:', error)
                  alert('Failed to toggle todo completion.')
                    return
                  }
                  console.log('Todo updated successfully in database')

                  // 클릭 기록을 데이터베이스에 저장
                  const { error: logError } = await supabase
                    .from('todo_click_logs')
                    .insert([{
                      todo_id: id,
                      user_email: authUser.email,
                      action: is_completed ? 'completed' : 'uncompleted'
                    }] as any) // eslint-disable-line @typescript-eslint/no-explicit-any
                  
                  if (logError) {
                    console.error('Failed to save click log:', logError)
                  }

                  // 로컬 상태 업데이트
                  // const logEntry = {
                  //   user: authUser.email,
                  //   timestamp: new Date().toISOString(),
                  //   action: is_completed ? 'completed' : 'uncompleted' as 'completed' | 'uncompleted'
                  // }
                  
                  // setClickLogs(prev => ({
                  //   ...prev,
                  //   [id]: [...(prev[id] || []), logEntry]
                  // }))
                  
                  setOpTodos(prev => prev.map(todo => (todo.id === id ? { ...todo, completed: is_completed } : todo)))
                } catch (e) {
                  console.error('Error in toggleTodoCompletion:', e)
                  alert('Failed to toggle todo completion.')
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
                            .map(task => (
                              <div key={task.id} className="bg-white p-2 border rounded-md shadow-sm">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <span className={`text-sm ${task.status === 'completed' ? 'line-through text-gray-500' : ''}`}>
                                      {task.title}
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    {task.priority === 'urgent' ? '긴급' : 
                                     task.priority === 'high' ? '높음' : 
                                     task.priority === 'medium' ? '보통' : '낮음'}
                                  </div>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">
                                  작성: {new Date(task.created_at).toLocaleString()}
                                </p>
                                {task.description && <p className="text-xs text-gray-500 mt-1">{task.description}</p>}
                                {task.due_date && (
                                  <p className="text-xs text-gray-400 mt-1">
                                    마감: {new Date(task.due_date).toLocaleDateString()}
                                  </p>
                                )}
                                {isAdminUser && (
                                  <div className="mt-2 flex items-center gap-2">
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
                                  </div>
                                )}
                                <CommentThread
                                  comments={getCommentsByTarget('task', task.id)}
                                  value={commentInputs[getCommentKey('task', task.id)] || ''}
                                  onChange={(value) => setCommentInput('task', task.id, value)}
                                  onSubmit={() => addComment('task', task.id)}
                                  onDelete={deleteComment}
                                  canDelete={canDeleteComment}
                                  teamMembers={teamMembers}
                                  compact
                                  enabled={isCommentsFeatureEnabled}
                                />
                              </div>
                            ))
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
                        return (
                          <li key={a.id} className="border rounded-md p-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  {a.is_pinned && <span className="inline-flex items-center text-amber-600 text-xs font-semibold">PIN</span>}
                                  <h3 className="text-base font-semibold">{a.title}</h3>
                                  {a.priority && a.priority !== 'normal' && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${a.priority==='urgent'?'bg-red-600 text-white':a.priority==='high'?'bg-red-100 text-red-700':'bg-gray-100 text-gray-600'}`}>{a.priority}</span>
                                  )}
                                </div>
                                <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{a.content}</p>
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
                                          <span key={`${a.id}-rec-${idx}`} className={`px-2 py-0.5 rounded-full ${n.acked ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{n.name}</span>
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
                                      className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
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
                                  className={`p-1 rounded transition-colors ${mineAck ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400 hover:bg-gray-50'}`}
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
                          return (
                            <li key={a.id} className="border rounded-md p-3 bg-gray-50">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    {a.is_pinned && <span className="inline-flex items-center text-amber-600 text-xs font-semibold">PIN</span>}
                                    <h3 className="text-base font-semibold text-gray-600">{a.title}</h3>
                                    {a.priority && a.priority !== 'normal' && (
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${a.priority==='urgent'?'bg-red-600 text-white':a.priority==='high'?'bg-red-100 text-red-700':'bg-gray-100 text-gray-600'}`}>{a.priority}</span>
                                    )}
                                  </div>
                                  <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">{a.content}</p>
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
                                            <span key={`${a.id}-rec-${idx}`} className={`px-2 py-0.5 rounded-full ${n.acked ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{n.name}</span>
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
                                        className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
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
                                    className={`p-1 rounded transition-colors ${mineAck ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400 hover:bg-gray-50'}`}
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
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="공지 제목"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">내용</label>
                    <textarea
                      value={editAnnouncement.content}
                      onChange={(e) => setEditAnnouncement({ ...editAnnouncement, content: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="예: 긴급, 회의"
                      />
                    </div>
                  </div>
                  
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
                              ? 'bg-blue-600 text-white'
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
                              ? 'bg-blue-600 text-white'
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
                                    ? 'bg-blue-600 text-white'
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
                                        ? 'bg-blue-600 text-white'
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
                                    ? 'bg-blue-600 text-white'
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
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
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
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="공지 제목"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">내용</label>
                    <textarea
                      value={newAnnouncement.content}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="예: 긴급, 회의"
                      />
                    </div>
                  </div>
                  
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
                              ? 'bg-blue-600 text-white'
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
                              ? 'bg-blue-600 text-white'
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
                                    ? 'bg-blue-600 text-white'
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
                                        ? 'bg-blue-600 text-white'
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
                                    ? 'bg-blue-600 text-white'
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
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? '작성 중...' : '작성'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Todo / Notification Modal */}
        {showNewTodoModal && (
          <Modal onClose={() => setShowNewTodoModal(false)}>
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold">Todo / Notification 관리</h3>
                <p className="mt-1 text-sm text-gray-500">
                  전체 Todo를 테이블에서 확인하고 알림 발송 여부, 반복 날짜, 시간을 바로 수정합니다.
                </p>
              </div>
              <div className="text-xs text-gray-500">
                총 {opTodos.length}개 / 알림 {opTodos.filter(todo => todo.notify_enabled).length}개
              </div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6">
              {/* 기존 항목 테이블 관리 */}
              <div>
                <h4 className="font-medium mb-3">전체 Todo List</h4>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="min-w-[980px] w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Todo</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">부서</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">반복</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">알림 보내기</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">날짜/요일</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">시간(KST)</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">다음 알림</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {opTodos.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-500">
                            등록된 Todo가 없습니다.
                          </td>
                        </tr>
                      ) : (
                        opTodos.map(todo => {
                          const isEditing = editingTodo?.id === todo.id
                          const category = isEditing ? editTodoForm.category : todo.category
                          const notifyEnabled = isEditing ? editTodoForm.notify_enabled : !!todo.notify_enabled
                          const nextNotifyLabel = todo.next_notify_at
                            ? new Date(todo.next_notify_at).toLocaleString('ko-KR')
                            : '-'
                          return (
                            <tr key={todo.id} className={todo.completed ? 'bg-gray-50' : undefined}>
                              <td className="px-3 py-2 align-top">
                                {isEditing ? (
                                  <input
                                    value={editTodoForm.title}
                                    onChange={e => setEditTodoForm({ ...editTodoForm, title: e.target.value })}
                                    className="w-56 rounded border border-gray-300 px-2 py-1 text-sm"
                                    placeholder="Todo 제목"
                                  />
                                ) : (
                                  <div>
                                    <div className={`font-medium ${todo.completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                                      {todo.title}
                                    </div>
                                    <div className="mt-1 text-xs text-gray-400">
                                      작성: {new Date(todo.created_at).toLocaleDateString('ko-KR')}
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 align-top">
                                {isEditing ? (
                                  <select
                                    value={editTodoForm.department}
                                    onChange={e => setEditTodoForm({ ...editTodoForm, department: e.target.value as 'office' | 'guide' | 'common' })}
                                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                                  >
                                    <option value="office">Office</option>
                                    <option value="guide">Guide</option>
                                    <option value="common">공통</option>
                                  </select>
                                ) : (
                                  <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
                                    {todo.department === 'office' ? 'Office' : todo.department === 'guide' ? 'Guide' : '공통'}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 align-top">
                                {isEditing ? (
                                  <select
                                    value={editTodoForm.category}
                                    onChange={e => setEditTodoForm({ ...editTodoForm, category: e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly' })}
                                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                                  >
                                    <option value="daily">일일</option>
                                    <option value="weekly">주간</option>
                                    <option value="monthly">월간</option>
                                    <option value="yearly">연간</option>
                                  </select>
                                ) : (
                                  <span className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">
                                    {todo.category === 'daily' ? '일일' : todo.category === 'weekly' ? '주간' : todo.category === 'monthly' ? '월간' : '연간'}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 align-top">
                                {isEditing ? (
                                  <label className="inline-flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={editTodoForm.notify_enabled}
                                      onChange={e => setEditTodoForm({ ...editTodoForm, notify_enabled: e.target.checked })}
                                      className="rounded border-gray-300"
                                    />
                                    <span className="text-xs text-gray-700">사용</span>
                                  </label>
                                ) : (
                                  <span className={`rounded px-2 py-1 text-xs ${todo.notify_enabled ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'}`}>
                                    {todo.notify_enabled ? '보냄' : '안 보냄'}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 align-top">
                                {isEditing && notifyEnabled ? (
                                  <div className="flex items-center gap-2">
                                    {category === 'weekly' ? (
                                      <select
                                        value={editTodoForm.notify_weekday}
                                        onChange={e => setEditTodoForm({ ...editTodoForm, notify_weekday: parseInt(e.target.value, 10) })}
                                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                                      >
                                        {['일', '월', '화', '수', '목', '금', '토'].map((label, i) => (
                                          <option key={label} value={i}>{label}요일</option>
                                        ))}
                                      </select>
                                    ) : null}
                                    {category === 'monthly' || category === 'yearly' ? (
                                      <input
                                        type="number"
                                        min={1}
                                        max={31}
                                        value={editTodoForm.notify_day_of_month}
                                        onChange={e =>
                                          setEditTodoForm({
                                            ...editTodoForm,
                                            notify_day_of_month: Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)),
                                          })
                                        }
                                        className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                                        title="일"
                                      />
                                    ) : null}
                                    {category === 'yearly' ? (
                                      <select
                                        value={editTodoForm.notify_month}
                                        onChange={e => setEditTodoForm({ ...editTodoForm, notify_month: parseInt(e.target.value, 10) })}
                                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                                      >
                                        {Array.from({ length: 12 }, (_, i) => (
                                          <option key={i + 1} value={i + 1}>{i + 1}월</option>
                                        ))}
                                      </select>
                                    ) : null}
                                    {category === 'daily' ? <span className="text-xs text-gray-500">매일</span> : null}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-500">
                                    {!notifyEnabled
                                      ? '-'
                                      : category === 'daily'
                                      ? '매일'
                                      : category === 'weekly'
                                      ? `${['일', '월', '화', '수', '목', '금', '토'][todo.notify_weekday ?? 1]}요일`
                                      : category === 'monthly'
                                      ? `매월 ${todo.notify_day_of_month ?? 1}일`
                                      : `${todo.notify_month ?? 1}월 ${todo.notify_day_of_month ?? 1}일`}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 align-top">
                                {isEditing && notifyEnabled ? (
                                  <input
                                    type="time"
                                    value={editTodoForm.notify_time}
                                    onChange={e => setEditTodoForm({ ...editTodoForm, notify_time: e.target.value })}
                                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                                  />
                                ) : (
                                  <span className="text-xs text-gray-600">{notifyEnabled ? todo.notify_time || '09:00' : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 align-top text-xs text-gray-500">
                                {nextNotifyLabel}
                              </td>
                              <td className="px-3 py-2 align-top">
                                <div className="flex justify-end gap-2">
                                  {isEditing ? (
                                    <>
                                      <button
                                        onClick={updateTodo}
                                        disabled={submitting}
                                        className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                                      >
                                        저장
                                      </button>
                                      <button
                                        onClick={cancelEditTodo}
                                        className="rounded bg-gray-500 px-2 py-1 text-xs text-white hover:bg-gray-600"
                                      >
                                        취소
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => startEditTodo(todo)}
                                        className="rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                                      >
                                        수정
                                      </button>
                                      <button
                                        onClick={() => deleteTodo(todo.id)}
                                        className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                                      >
                                        삭제
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 새 항목 추가 */}
              <div>
                <h4 className="font-medium mb-3">새 항목 추가</h4>
                <div className="space-y-3">
                  <input 
                    value={newTodo.title} 
                    onChange={e => setNewTodo({ ...newTodo, title: e.target.value })} 
                    placeholder="체크리스트 항목을 입력하세요" 
                    className="w-full px-3 py-2 border rounded-md"
                  />
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">부서</label>
                    <div className="flex space-x-2">
                      {['office', 'guide', 'common'].map(dept => (
                        <button
                          key={dept}
                          onClick={() => setNewTodo({ ...newTodo, department: dept as 'office' | 'guide' | 'common' })}
                          className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                            newTodo.department === dept
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {dept === 'office' ? 'Office' : 
                           dept === 'guide' ? 'Guide' : '공통'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">기간</label>
                    <div className="flex space-x-2">
                      {['daily', 'weekly', 'monthly', 'yearly'].map(period => (
                        <button
                          key={period}
                          onClick={() => setNewTodo({ ...newTodo, category: period as 'daily' | 'weekly' | 'monthly' | 'yearly' })}
                          className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                            newTodo.category === period
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {period === 'daily' ? '일일' : 
                           period === 'weekly' ? '주간' :
                           period === 'monthly' ? '월간' : '연간'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 rounded-lg border border-dashed border-amber-200 bg-amber-50/50 p-3">
                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer text-gray-800">
                      <input
                        type="checkbox"
                        checked={newTodo.notify_enabled}
                        onChange={(e) => setNewTodo({ ...newTodo, notify_enabled: e.target.checked })}
                      />
                      알림 보내기
                    </label>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      켜면 설정한 시각(한국 기준)에 해당 부서에 맞는 팀원 화면에 알림 모달이 뜹니다. 일일은 매일, 주간은 매주 같은 요일, 월간·연간은 같은 날짜에 반복됩니다.
                    </p>
                    {newTodo.notify_enabled ? (
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="text-xs font-medium text-gray-700">알림 시각</label>
                          <input
                            type="time"
                            value={newTodo.notify_time}
                            onChange={(e) => setNewTodo({ ...newTodo, notify_time: e.target.value })}
                            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                          />
                        </div>
                        {newTodo.category === 'weekly' ? (
                          <div>
                            <label className="text-xs font-medium text-gray-700">요일</label>
                            <select
                              value={newTodo.notify_weekday}
                              onChange={(e) =>
                                setNewTodo({ ...newTodo, notify_weekday: parseInt(e.target.value, 10) })
                              }
                              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                            >
                              {['일', '월', '화', '수', '목', '금', '토'].map((label, i) => (
                                <option key={label} value={i}>
                                  {label}요일
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                        {newTodo.category === 'monthly' || newTodo.category === 'yearly' ? (
                          <div>
                            <label className="text-xs font-medium text-gray-700">매월 몇 일</label>
                            <input
                              type="number"
                              min={1}
                              max={31}
                              value={newTodo.notify_day_of_month}
                              onChange={(e) =>
                                setNewTodo({
                                  ...newTodo,
                                  notify_day_of_month: Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)),
                                })
                              }
                              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                            />
                          </div>
                        ) : null}
                        {newTodo.category === 'yearly' ? (
                          <div>
                            <label className="text-xs font-medium text-gray-700">월</label>
                            <select
                              value={newTodo.notify_month}
                              onChange={(e) =>
                                setNewTodo({ ...newTodo, notify_month: parseInt(e.target.value, 10) })
                              }
                              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                            >
                              {Array.from({ length: 12 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>
                                  {i + 1}월
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <button 
                      onClick={() => setShowNewTodoModal(false)} 
                      className="px-4 py-2 border rounded-md hover:bg-gray-50"
                    >
                      취소
                    </button>
                    <button 
                      onClick={createTodo} 
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      추가
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Modal>
        )}

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

        {/* New Task Modal */}
        {showNewTaskModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-4">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">새 업무 추가</h3>
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
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="업무 제목"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">설명</label>
                    <textarea
                      value={newTask.description}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      rows={2}
                      placeholder="업무 설명"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">마감일</label>
                      <input
                        type="datetime-local"
                        value={newTask.due_date}
                        onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">우선순위</label>
                      <select
                        value={newTask.priority}
                        onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as 'low' | 'medium' | 'high' | 'urgent' })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="low">낮음</option>
                        <option value="medium">보통</option>
                        <option value="high">높음</option>
                        <option value="urgent">긴급</option>
                      </select>
                    </div>
                  </div>
                  
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
                              ? 'bg-blue-600 text-white'
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
                              ? 'bg-blue-600 text-white'
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
                                ? 'bg-blue-600 text-white'
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
                                    ? 'bg-blue-600 text-white'
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
                                ? 'bg-blue-600 text-white'
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
                    onClick={() => {
                      setShowNewTaskModal(false)
                      setActivePositionTab('manager')
                    }}
                    className="px-3 py-1 text-xs text-gray-600 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    취소
                  </button>
                  <button
                    onClick={createTask}
                    disabled={submitting}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? '생성 중...' : '생성'}
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
                    <div key={`arch-task-${task.id}`} className="border rounded p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium">{task.title}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            상태: {task.is_deleted ? '삭제됨' : task.status === 'completed' ? '완료됨' : '취소됨'} | 작성: {new Date(task.created_at).toLocaleString()}
                          </div>
                        </div>
                        {isAdminUser && (
                          <button
                            type="button"
                            onClick={() => void restoreTask(String(task.id))}
                            className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
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
                            className="text-xs text-blue-600 hover:text-blue-700"
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
                            className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
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
                            className="text-xs text-blue-600 hover:text-blue-700"
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
                            className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
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
                            className="text-xs text-blue-600 hover:text-blue-700"
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



function ChecklistPanel({ opTodos, selectedDepartment, onDepartmentChange, onAddTodo, onManageNotifications, toggleTodoCompletion, openHistoryModal }: { 
  opTodos: OpTodo[]; 
  selectedDepartment: 'all' | 'office' | 'guide' | 'common';
  onDepartmentChange: (department: 'all' | 'office' | 'guide' | 'common') => void;
  onAddTodo: () => void; 
  onManageNotifications: () => void;
  toggleTodoCompletion: (id: string, is_completed: boolean) => Promise<void>;
  openHistoryModal: (category: 'daily' | 'weekly' | 'monthly' | 'yearly') => void;
}) {
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

  // department 필터링된 todos
  const filteredTodos = useMemo(() => {
    if (selectedDepartment === 'all') return opTodos
    return opTodos.filter(todo => todo.department === selectedDepartment)
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
    daily:   { cardBg: 'bg-blue-50',   cardBorder: 'border-blue-200',   barBg: 'bg-blue-100',   barFill: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700' },
    weekly:  { cardBg: 'bg-slate-50',  cardBorder: 'border-slate-200',  barBg: 'bg-slate-100',  barFill: 'bg-slate-400',  badge: 'bg-slate-100 text-slate-700' },
    monthly: { cardBg: 'bg-green-50',  cardBorder: 'border-green-200',  barBg: 'bg-green-100',  barFill: 'bg-green-500',  badge: 'bg-green-100 text-green-700' },
    yearly:  { cardBg: 'bg-purple-50', cardBorder: 'border-purple-200', barBg: 'bg-purple-100', barFill: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700' },
  }

  return (
    <section className="bg-white rounded-lg shadow border p-4 xl:col-span-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Todo List</h2>
        <div className="flex items-center space-x-3">
          {/* Department 필터 */}
          <select
            value={selectedDepartment}
            onChange={(e) => onDepartmentChange(e.target.value as 'all' | 'office' | 'guide' | 'common')}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center transition-colors"
            title={t('newTodo')}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(category => {
          const categoryTodos = filteredTodos.filter(todo => todo.category === category)
          const now = new Date()
          const colors = colorByCategory[category]
          const headerLabel = category === 'daily'
            ? formatDailyLabel(now)
            : category === 'weekly'
            ? formatWeeklyRange(now)
            : category === 'monthly'
            ? formatMonthlyLabel(now)
            : formatYearlyLabel(now)

          const completedCount = categoryTodos.filter(t => t.completed).length
          const percent = categoryTodos.length === 0 ? 0 : Math.round((completedCount / categoryTodos.length) * 100)

          return (
            <div key={category} className={`rounded-lg p-3 border ${colors.cardBg} ${colors.cardBorder}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h5 className="font-medium text-sm">
                    {category === 'daily' ? '일일' : category === 'weekly' ? '주간' : category === 'monthly' ? '월간' : '연간'}
                  </h5>
                  <span className={`text-xs px-2 py-0.5 rounded ${colors.badge}`}>{headerLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{percent}%</span>
                  <button
                    onClick={() => openHistoryModal(category)}
                    className="p-1 text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                    title="히스토리 보기"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className={`w-full h-1.5 rounded ${colors.barBg}`}>
                <div className={`h-1.5 rounded ${colors.barFill}`} style={{ width: `${percent}%` }} />
              </div>

              <div className="flex flex-wrap gap-1 mt-2">
                {categoryTodos.length === 0 ? (
                  <div className="text-xs text-gray-500 text-center py-4 border-2 border-dashed border-gray-200 rounded w-full">
                    항목 없음
                  </div>
                ) : (
                  categoryTodos.map(todo => (
                    <div key={todo.id} className="inline-block">
                      <button
                        onClick={() => toggleTodoCompletion(todo.id, !todo.completed)}
                        className={`px-2 py-1 text-xs rounded border ${
                          todo.completed
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700 line-through'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {todo.title}
                      </button>
                    </div>
          ))
        )}
              </div>
            </div>
          )
        })}
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
    in_progress: 'bg-blue-100 text-blue-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-700'
  }

  const priorityColors = {
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-blue-100 text-blue-600',
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
  enabled?: boolean
}) {
  const [showComposer, setShowComposer] = useState(false)
  const hasComments = comments.length > 0
  const showPanel = hasComments

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (!enabled) {
              alert('댓글 기능을 사용하려면 DB 마이그레이션 적용이 필요합니다.')
              return
            }
            setShowComposer(prev => !prev)
          }}
          className="p-1.5 rounded-full bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
          title="댓글 입력"
        >
          <MessageCircle className="w-3.5 h-3.5" />
        </button>
        {enabled && (showComposer || value.trim().length > 0) && (
          <div className="flex items-center gap-2 flex-1">
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
              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => {
                onSubmit()
                setShowComposer(false)
              }}
              className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              등록
            </button>
          </div>
        )}
      </div>

      {enabled && showPanel && (
        <div className={`mt-2 border rounded-md bg-gray-50 ${compact ? 'p-2' : 'p-3'}`}>
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
      )}
    </div>
  )
}

