'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { use } from 'react'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useTranslations } from 'next-intl'
import { Check, Edit, Loader2, Pin, PinOff, Plus, Trash2, X } from 'lucide-react'

interface TeamBoardPageProps {
  params: Promise<{ locale: string }>
}

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
  assigned_to: string | null
  due_date: string | null
  completed: boolean
  completed_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}


type Issue = {
  id: string
  title: string
  description: string | null
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  created_by: string
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

export default function TeamBoardPage({ params }: TeamBoardPageProps) {
  use(params)
  const { authUser } = useAuth()
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
  const [newTodo, setNewTodo] = useState<{ title: string; description: string; scope: 'common'|'individual'; category: 'daily'|'weekly'|'monthly'|'yearly'; assigned_to: string }>(
    { title: '', description: '', scope: 'common', category: 'daily', assigned_to: '' }
  )
  
  // 기존 항목 수정을 위한 상태
  const [editingTodo, setEditingTodo] = useState<OpTodo | null>(null)
  const [editTodoForm, setEditTodoForm] = useState<{ title: string; category: 'daily'|'weekly'|'monthly'|'yearly' }>({
    title: '',
    category: 'daily'
  })
  
  // 클릭 기록을 위한 상태 (현재 사용되지 않음)
  // const [clickLogs, setClickLogs] = useState<Record<string, { user: string; timestamp: string; action: 'completed' | 'uncompleted' }[]>>({})
  
  // 히스토리 모달 상태
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<'daily' | 'weekly' | 'monthly' | 'yearly' | null>(null)
  const [categoryHistory, setCategoryHistory] = useState<{ user: string; timestamp: string; action: 'completed' | 'uncompleted'; todoTitle: string }[]>([])

  // 클릭 기록 불러오기
  const loadClickLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('todo_click_logs')
        .select('*')
        .order('timestamp', { ascending: false })
      
      if (error) throw error
      
      // 데이터를 todo_id별로 그룹화
      const groupedLogs: Record<string, { user: string; timestamp: string; action: 'completed' | 'uncompleted' }[]> = {}
      ;(data as TodoClickLog[])?.forEach(log => {
        if (!groupedLogs[log.todo_id]) {
          groupedLogs[log.todo_id] = []
        }
        groupedLogs[log.todo_id].push({
          user: log.user_email,
          timestamp: log.timestamp,
          action: log.action
        })
      })
      
      // setClickLogs(groupedLogs)
    } catch (e) {
      console.error('Failed to load click logs:', e)
    }
  }

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
      const { data, error } = await supabase.rpc('manual_reset_todos', {
        category_name: category as string
      } as any)

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
  const [activePositionTab, setActivePositionTab] = useState<string>('Office Manager')
  const [expandedTaskSections, setExpandedTaskSections] = useState<Record<string, boolean>>({
    'pending': true,
    'in_progress': true,
    'completed': true,
    'cancelled': true
  })

  useEffect(() => {
    fetchAll()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAll = async () => {
    try {
      setLoading(true)
      const [{ data: anns }, { data: acks }, { data: opTodos }, { data: iss }, { data: tks }, { data: team }] = await Promise.all([
        supabase.from('team_announcements').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('team_announcement_acknowledgments').select('*'),
        supabase.from('op_todos').select('*').order('created_at', { ascending: false }),
        supabase.from('issues').select('*').order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('team').select('*').eq('is_active', true).order('name_ko'),
      ])

      // 클릭 기록 불러오기
      await loadClickLogs()

      setAnnouncements((anns || []) as Announcement[])

      const aMap: Record<string, Acknowledgment[]> = {}
      ;(acks as Acknowledgment[] || []).forEach((a) => {
        const key = a.announcement_id
        aMap[key] = aMap[key] || []
        aMap[key].push(a)
      })
      setAcksByAnnouncement(aMap)

      setOpTodos((opTodos || []) as OpTodo[])
      setIssues((iss || []) as Issue[])
      setTasks((tks || []) as Task[])
      setTeamMembers((team || []) as TeamMember[])
    } finally {
      setLoading(false)
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
          .filter(member => selectedTaskPositions.includes(member.position) && member.is_active)
          .map(member => member.email)
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
        }] as any)
        .select()
        .single()
      if (error) throw error
      setAnnouncements([data as Announcement, ...announcements])
      setShowNewAnnouncement(false)
      setNewAnnouncement({ title: '', content: '', recipients: [], priority: 'normal', tags: '', target_positions: [] })
      setSelectedTaskPositions([])
      setSelectedTaskIndividuals([])
      setActivePositionTab('Office Manager')
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
        .update({ is_pinned: !announcement.is_pinned } as any)
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
        .insert([{ announcement_id: announcementId, ack_by: authUser.email }] as any)
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
          .filter(member => selectedTaskPositions.includes(member.position) && member.is_active)
          .map(member => member.email)
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
        } as any)
        .eq('id', editingAnnouncement.id)
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
    try {
      const { error } = await supabase
        .from('team_announcements')
        .delete()
        .eq('id', announcementId)
      if (error) throw error
      setAnnouncements(announcements.filter(a => a.id !== announcementId))
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
           (authUser.permissions && (authUser.permissions.includes('canViewAdmin') || authUser.permissions.includes('canManageTeam')))
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
      const payload = {
        title: newTodo.title.trim(),
        description: null,
        scope: 'common' as const,
        category: newTodo.category,
        assigned_to: null,
        created_by: authUser.email,
      }
      const { data, error } = await supabase
        .from('op_todos')
        .insert([payload] as any)
        .select()
        .single()
      if (error) throw error
      setOpTodos(prev => [data as OpTodo, ...prev])
      setNewTodo({ title: '', description: '', scope: 'common', category: 'daily', assigned_to: '' })
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
      category: todo.category
    })
  }

  const cancelEditTodo = () => {
    setEditingTodo(null)
    setEditTodoForm({ title: '', category: 'daily' })
  }

  const updateTodo = async () => {
    if (!editingTodo || !editTodoForm.title.trim()) return
    
    try {
      const { data, error } = await supabase
        .from('op_todos')
        .update({
          title: editTodoForm.title.trim(),
          category: editTodoForm.category
        } as any)
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
          .filter(member => selectedTaskPositions.includes(member.position) && member.is_active)
          .map(member => member.email)
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
        .insert([payload] as any)
        .select()
        .single()
      if (error) throw error
      setTasks(prev => [data as Task, ...prev])
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
      setActivePositionTab('Office Manager')
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
        created_by: authUser.email,
      }
      const { data, error } = await supabase
        .from('issues')
        .insert([payload] as any)
        .select()
        .single()
      if (error) throw error
      setIssues(prev => [data as Issue, ...prev])
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
        <h1 className="text-2xl font-bold text-gray-900">업무 관리</h1>

        {loading ? (
          <div className="flex items-center text-gray-500"><Loader2 className="w-4 h-4 mr-2 animate-spin"/>로딩 중...</div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* 1) 체크리스트 */}
            <ChecklistPanel
              opTodos={opTodos}
              onAddTodo={() => {
                setNewTodo({ ...newTodo, category: 'daily', scope: 'individual', assigned_to: authUser?.email || '' })
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
                    .update({ completed: is_completed, completed_at: is_completed ? new Date().toISOString() : null } as any)
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
                    }] as any)
                  
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
                <button
                  onClick={() => setShowNewTaskModal(true)}
                  className="w-8 h-8 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center transition-colors"
                  title="새 업무 추가"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                {['pending', 'in_progress', 'completed', 'cancelled'].map(status => (
                  <div key={status} className="bg-gray-50 rounded-md border">
                    <button
                      onClick={() => toggleTaskSection(status)}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-100 transition-colors"
                    >
                      <h3 className="font-medium text-sm">
                        {status === 'pending' ? '대기' : 
                         status === 'in_progress' ? '진행중' : 
                         status === 'completed' ? '완료' : '취소'}
                        <span className="ml-2 text-xs text-gray-500">
                          ({tasks.filter(task => task.status === status).length})
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
                        {tasks.filter(task => task.status === status).length === 0 ? (
                          <div className="text-center py-4 text-gray-500 text-sm">
                            등록된 업무가 없습니다.
                          </div>
                        ) : (
                          tasks
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
                                {task.description && <p className="text-xs text-gray-500 mt-1">{task.description}</p>}
                                {task.due_date && (
                                  <p className="text-xs text-gray-400 mt-1">
                                    마감: {new Date(task.due_date).toLocaleDateString()}
                                  </p>
                                )}
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
                <button
                  onClick={() => setShowNewAnnouncement(true)}
                  className="w-8 h-8 bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center justify-center transition-colors"
                  title="새 공지"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {announcements.length === 0 ? (
                <div className="text-sm text-gray-500">등록된 공지가 없습니다.</div>
              ) : (
                <div className="space-y-4">
                  {/* 미확인 전달사항 */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">미확인 전달사항</h3>
                    <ul className="space-y-3">
                      {announcements.filter(a => {
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
                              </div>
                              <div className="flex items-center space-x-2">
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
                  {announcements.filter(a => {
                    const acks = acksByAnnouncement[a.id] || []
                    const recipients = a.recipients || []
                    if (recipients.length === 0) return acks.length > 0 // 전체 대상인 경우
                    return recipients.every(email => acks.some(ack => ack.ack_by === email))
                  }).length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-3">모두 확인된 전달사항</h3>
                      <ul className="space-y-3">
                        {announcements.filter(a => {
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
                                </div>
                                <div className="flex items-center space-x-2">
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
                <button
                  onClick={() => openWorkModal('issue')}
                  className="w-8 h-8 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center transition-colors"
                  title="새 이슈"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <IssuePanel issues={issues} />
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
                            {['Office Manager', 'Super', 'Tour Guide', 'OP', 'Driver'].map(position => (
                              <button
                                key={position}
                                type="button"
                                onClick={() => setActivePositionTab(position)}
                                className={`px-4 py-2 text-sm font-medium border-r last:border-r-0 transition-colors ${
                                  activePositionTab === position
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                {position}
                              </button>
                            ))}
                          </div>
                          
                          {/* 탭 내용 */}
                          <div className="p-4 max-h-40 overflow-y-auto">
                            <div className="flex flex-wrap gap-2">
                              {teamMembers
                                .filter(member => member.position === activePositionTab && member.is_active)
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
                          {['Office Manager', 'Super', 'Tour Guide', 'OP', 'Driver'].map(position => (
                            <div key={position} className="border rounded p-3">
                              <button
                                type="button"
                                onClick={() => {
                                  if (selectedTaskPositions.includes(position)) {
                                    setSelectedTaskPositions(selectedTaskPositions.filter(pos => pos !== position))
                                    // 해당 position의 모든 직원들도 선택 해제
                                    const positionMembers = teamMembers
                                      .filter(member => member.position === position && member.is_active)
                                      .map(member => member.email)
                                    setSelectedTaskIndividuals(selectedTaskIndividuals.filter(email => !positionMembers.includes(email)))
                                  } else {
                                    setSelectedTaskPositions([...selectedTaskPositions, position])
                                    // 해당 position의 모든 직원들도 자동 선택
                                    const positionMembers = teamMembers
                                      .filter(member => member.position === position && member.is_active)
                                      .map(member => member.email)
                                    setSelectedTaskIndividuals([...new Set([...selectedTaskIndividuals, ...positionMembers])])
                                  }
                                }}
                                className={`w-full text-left px-3 py-2 text-sm font-medium rounded transition-colors ${
                                  selectedTaskPositions.includes(position)
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                              >
                                {position}
                              </button>
                              {selectedTaskPositions.includes(position) && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {teamMembers
                                    .filter(member => member.position === position && member.is_active)
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
                            {['Office Manager', 'Super', 'Tour Guide', 'OP', 'Driver'].map(position => (
                              <button
                                key={position}
                                type="button"
                                onClick={() => setActivePositionTab(position)}
                                className={`px-4 py-2 text-sm font-medium border-r last:border-r-0 transition-colors ${
                                  activePositionTab === position
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                {position}
                              </button>
                            ))}
                          </div>
                          
                          {/* 탭 내용 */}
                          <div className="p-4 max-h-40 overflow-y-auto">
                            <div className="flex flex-wrap gap-2">
                              {teamMembers
                                .filter(member => member.position === activePositionTab && member.is_active)
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
                          {['Office Manager', 'Super', 'Tour Guide', 'OP', 'Driver'].map(position => (
                            <div key={position} className="border rounded p-3">
                              <button
                                type="button"
                                onClick={() => {
                                  if (selectedTaskPositions.includes(position)) {
                                    setSelectedTaskPositions(selectedTaskPositions.filter(pos => pos !== position))
                                    // 해당 position의 모든 직원들도 선택 해제
                                    const positionMembers = teamMembers
                                      .filter(member => member.position === position && member.is_active)
                                      .map(member => member.email)
                                    setSelectedTaskIndividuals(selectedTaskIndividuals.filter(email => !positionMembers.includes(email)))
                                  } else {
                                    setSelectedTaskPositions([...selectedTaskPositions, position])
                                    // 해당 position의 모든 직원들도 자동 선택
                                    const positionMembers = teamMembers
                                      .filter(member => member.position === position && member.is_active)
                                      .map(member => member.email)
                                    setSelectedTaskIndividuals([...new Set([...selectedTaskIndividuals, ...positionMembers])])
                                  }
                                }}
                                className={`w-full text-left px-3 py-2 text-sm font-medium rounded transition-colors ${
                                  selectedTaskPositions.includes(position)
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                              >
                                {position}
                              </button>
                              {selectedTaskPositions.includes(position) && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {teamMembers
                                    .filter(member => member.position === position && member.is_active)
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

        {/* New Todo Modal */}
        {showNewTodoModal && (
          <Modal onClose={() => setShowNewTodoModal(false)}>
            <h3 className="text-lg font-semibold mb-4">체크리스트 관리</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 기존 항목 관리 */}
              <div>
                <h4 className="font-medium mb-3">기존 항목 관리</h4>
                <div className="grid grid-cols-1 gap-3">
                  {['daily', 'weekly', 'monthly', 'yearly'].map(category => (
                    <div key={category} className="border rounded-lg p-2">
                      <h5 className="font-medium text-xs mb-2 text-center">
                        {category === 'daily' ? '일일' : 
                         category === 'weekly' ? '주간' :
                         category === 'monthly' ? '월간' : '연간'}
                      </h5>
                      <div className="flex flex-wrap gap-1">
                        {opTodos
                          .filter(todo => todo.category === category)
                          .map(todo => (
                            <div key={todo.id} className="relative group">
                              {editingTodo?.id === todo.id ? (
                                // 수정 모드
                                <div className="space-y-2 p-2 bg-white border rounded">
                                  <input
                                    value={editTodoForm.title}
                                    onChange={e => setEditTodoForm({ ...editTodoForm, title: e.target.value })}
                                    className="w-full px-2 py-1 text-xs border rounded"
                                    placeholder="항목 제목"
                                  />
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap gap-1">
                                      {['daily', 'weekly', 'monthly', 'yearly'].map(period => (
                                        <button
                                          key={period}
                                          onClick={() => setEditTodoForm({ ...editTodoForm, category: period as 'daily' | 'weekly' | 'monthly' | 'yearly' })}
                                          className={`px-2 py-1 text-[10px] rounded ${
                                            editTodoForm.category === period
                                              ? 'bg-blue-600 text-white'
                                              : 'bg-gray-200 text-gray-700'
                                          }`}
                                        >
                                          {period === 'daily' ? '일일' : 
                                           period === 'weekly' ? '주간' :
                                           period === 'monthly' ? '월간' : '연간'}
                                        </button>
                                      ))}
                                    </div>
                                    <div className="flex space-x-1">
                                      <button
                                        onClick={updateTodo}
                                        className="flex-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                      >
                                        저장
                                      </button>
                                      <button
                                        onClick={() => deleteTodo(editingTodo.id)}
                                        className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                      >
                                        삭제
                                      </button>
                                      <button
                                        onClick={cancelEditTodo}
                                        className="flex-1 px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                                      >
                                        취소
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                // 일반 보기 모드 - 컴팩트 버튼
                                <div className="inline-block">
                                  <button
                                    onClick={() => startEditTodo(todo)}
                                    className={`px-2 py-1 text-[11px] rounded border ${
                                      todo.completed
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700 line-through'
                                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                    }`}
                                  >
                                    {todo.title}
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        {opTodos.filter(todo => todo.category === category).length === 0 && (
                          <div className="text-xs text-gray-500 text-center py-4 border-2 border-dashed border-gray-200 rounded">
                            항목 없음
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
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
                        {['Office Manager', 'Super', 'Tour Guide', 'OP', 'Driver'].map(position => (
                          <button
                            key={position}
                            type="button"
                            onClick={() => setActivePositionTab(position)}
                            className={`px-3 py-2 text-xs font-medium border-r last:border-r-0 transition-colors ${
                              activePositionTab === position
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {position}
                          </button>
                        ))}
                      </div>
                      
                      {/* 탭 내용 */}
                      <div className="p-3 max-h-32 overflow-y-auto">
                        <div className="flex flex-wrap gap-1">
                          {teamMembers
                            .filter(member => member.position === activePositionTab && member.is_active)
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
                      {['Office Manager', 'Super', 'Tour Guide', 'OP', 'Driver'].map(position => (
                        <div key={position} className="border rounded p-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedTaskPositions.includes(position)) {
                                setSelectedTaskPositions(selectedTaskPositions.filter(pos => pos !== position))
                                // 해당 position의 모든 직원들도 선택 해제
                                const positionMembers = teamMembers
                                  .filter(member => member.position === position && member.is_active)
                                  .map(member => member.email)
                                setSelectedTaskIndividuals(selectedTaskIndividuals.filter(email => !positionMembers.includes(email)))
                              } else {
                                setSelectedTaskPositions([...selectedTaskPositions, position])
                                // 해당 position의 모든 직원들도 자동 선택
                                const positionMembers = teamMembers
                                  .filter(member => member.position === position && member.is_active)
                                  .map(member => member.email)
                                setSelectedTaskIndividuals([...new Set([...selectedTaskIndividuals, ...positionMembers])])
                              }
                            }}
                            className={`w-full text-left px-2 py-1 text-xs font-medium rounded transition-colors ${
                              selectedTaskPositions.includes(position)
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            {position}
                          </button>
                          {selectedTaskPositions.includes(position) && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {teamMembers
                                .filter(member => member.position === position && member.is_active)
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
                      setActivePositionTab('Office Manager')
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



function ChecklistPanel({ opTodos, onAddTodo, toggleTodoCompletion, openHistoryModal }: { 
  opTodos: OpTodo[]; 
  onAddTodo: () => void; 
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
        'checklist': '체크리스트',
        'newTodo': '새 ToDo',
        'noTodos': '등록된 ToDo가 없습니다.'
      }
      return fallbacks[key] || key
    }
  }

  const completionPercentage = useMemo(() => {
    if (opTodos.length === 0) return 0
    const completedCount = opTodos.filter(todo => todo.completed).length
    return Math.round((completedCount / opTodos.length) * 100)
  }, [opTodos])

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
        <h2 className="text-lg font-semibold">{t('checklist')}</h2>
        <div className="flex items-center">
          <span className="text-xs text-gray-500 mr-2">{completionPercentage}%</span>
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
          const categoryTodos = opTodos.filter(todo => todo.category === category)
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



function IssuePanel({ issues }: { issues: Issue[] }) {
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
              <div className="flex items-center space-x-2 mt-2">
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
              </div>
            </div>
            <div className="text-xs text-gray-400 ml-2">
              {new Date(issue.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

