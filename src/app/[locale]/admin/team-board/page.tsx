'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { use } from 'react'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import { supabase, createClientSupabase } from '@/lib/supabase'
import { useTranslations } from 'next-intl'
import { Check, Edit, Loader2, MessageCircle, Pin, PinOff, Plus, Send, X } from 'lucide-react'

interface TeamBoardPageProps {
  params: Promise<{ locale: string }>
}

type Announcement = {
  id: string
  title: string
  content: string
  is_pinned: boolean
  recipients: string[] | null
  priority: 'low' | 'normal' | 'high' | 'urgent' | null
  tags: string[] | null
  due_by: string | null
  is_archived: boolean | null
  created_by: string
  created_at: string
  updated_at: string
}

type Comment = {
  id: string
  announcement_id: string
  comment: string
  created_by: string
  created_at: string
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

type Project = {
  id: string
  title: string
  description: string | null
  status: 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  start_date: string | null
  end_date: string | null
  assigned_to: string[]
  tags: string[]
  progress: number
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
  type: 'bug' | 'feature' | 'task' | 'improvement'
  assigned_to: string | null
  project_id: string | null
  due_date: string | null
  tags: string[]
  reported_by: string
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
  const [commentsByAnnouncement, setCommentsByAnnouncement] = useState<Record<string, Comment[]>>({})
  const [acksByAnnouncement, setAcksByAnnouncement] = useState<Record<string, Acknowledgment[]>>({})
  const [showNewAnnouncement, setShowNewAnnouncement] = useState(false)
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', recipients: [] as string[], priority: 'normal' as 'low'|'normal'|'high'|'urgent', tags: '' , target_positions: [] as string[] })
  const [submitting, setSubmitting] = useState(false)

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

  // 수동 리셋 함수
  const resetCategoryTodos = async (category: 'daily' | 'weekly' | 'monthly' | 'yearly') => {
    if (!confirm(`${category === 'daily' ? '일일' : category === 'weekly' ? '주간' : category === 'monthly' ? '월간' : '연간'} 체크리스트를 리셋하시겠습니까?`)) {
      return
    }

    try {
      const { data, error } = await supabase.rpc('manual_reset_todos', {
        category_name: category as string
      })

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
  
  // 프로젝트 관련 상태
  const [projects, setProjects] = useState<Project[]>([])
  const [newProject, setNewProject] = useState({
    title: '',
    description: '',
    status: 'planning' as 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    start_date: '',
    end_date: '',
    assigned_to: [] as string[],
    tags: '',
    progress: 0
  })
  
  // 이슈 관련 상태
  const [issues, setIssues] = useState<Issue[]>([])
  const [newIssue, setNewIssue] = useState({
    title: '',
    description: '',
    status: 'open' as 'open' | 'in_progress' | 'resolved' | 'closed',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    type: 'bug' as 'bug' | 'feature' | 'task' | 'improvement',
    assigned_to: '',
    project_id: '',
    due_date: '',
    tags: ''
  })

  // 업무 관리 모달 상태
  const [showWorkModal, setShowWorkModal] = useState(false)
  const [workModalType, setWorkModalType] = useState<'project' | 'issue' | null>(null)

  useEffect(() => {
    fetchAll()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAll = async () => {
    try {
      setLoading(true)
      const [{ data: anns }, { data: cmts }, { data: acks }, { data: opTodos }, { data: projs }, { data: iss }] = await Promise.all([
        supabase.from('team_announcements').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('team_announcement_comments').select('*').order('created_at', { ascending: true }),
        supabase.from('team_announcement_acknowledgments').select('*'),
        supabase.from('op_todos').select('*').order('created_at', { ascending: false }),
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('issues').select('*').order('created_at', { ascending: false }),
      ])

      // 클릭 기록 불러오기
      await loadClickLogs()

      setAnnouncements((anns || []) as Announcement[])
      const byAnn: Record<string, Comment[]> = {}
      ;(cmts as Comment[] || []).forEach((c) => {
        const key = c.announcement_id
        byAnn[key] = byAnn[key] || []
        byAnn[key].push(c)
      })
      setCommentsByAnnouncement(byAnn)

      const aMap: Record<string, Acknowledgment[]> = {}
      ;(acks as Acknowledgment[] || []).forEach((a) => {
        const key = a.announcement_id
        aMap[key] = aMap[key] || []
        aMap[key].push(a)
      })
      setAcksByAnnouncement(aMap)

      setOpTodos((opTodos || []) as OpTodo[])
      setProjects((projs || []) as Project[])
      setIssues((iss || []) as Issue[])
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAnnouncement = async () => {
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim() || !authUser?.email) return
    setSubmitting(true)
    try {
      // expand positions to emails
      let expandedRecipients = [...(newAnnouncement.recipients || [])]
      if (newAnnouncement.target_positions && newAnnouncement.target_positions.length > 0) {
        const { data: posMembers } = await supabase
          .from('team')
          .select('email, position')
          .in('position', newAnnouncement.target_positions)
          .eq('is_active', true)
        if (posMembers) {
          const emails = (posMembers as TeamMember[]).map((m) => m.email.toLowerCase())
          expandedRecipients = Array.from(new Set([...
            expandedRecipients.map(e => e.toLowerCase()), ...emails
          ]))
        }
      }

      const { data, error } = await supabase
        .from('team_announcements')
        .insert([{ 
          title: newAnnouncement.title.trim(), 
          content: newAnnouncement.content.trim(), 
          created_by: authUser.email,
          recipients: expandedRecipients,
          target_positions: newAnnouncement.target_positions,
          priority: newAnnouncement.priority,
          tags: newAnnouncement.tags ? newAnnouncement.tags.split(',').map(t => t.trim()).filter(Boolean) : []
        }] as any)
        .select()
        .single()
      if (error) throw error
      setAnnouncements([data as Announcement, ...announcements])
      setShowNewAnnouncement(false)
      setNewAnnouncement({ title: '', content: '', recipients: [], priority: 'normal', tags: '', target_positions: [] })
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

  const addComment = async (announcementId: string, commentText: string) => {
    if (!commentText.trim() || !authUser?.email) return
    try {
      const { data, error } = await supabase
        .from('team_announcement_comments')
        .insert([{ announcement_id: announcementId, comment: commentText.trim(), created_by: authUser.email }])
        .select()
        .single()
      if (error) throw error
      setCommentsByAnnouncement(prev => ({ ...prev, [announcementId]: [...(prev[announcementId] || []), data as Comment] }))
    } catch (e) {
      console.error(e)
      alert('댓글 등록 중 오류가 발생했습니다.')
    }
  }

  const ackAnnouncement = async (announcementId: string) => {
    if (!authUser?.email) return
    try {
      const { data, error } = await supabase
        .from('team_announcement_acknowledgments')
        .insert([{ announcement_id: announcementId, ack_by: authUser.email }])
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


  const toggleTodoCompleted = async (todo: OpTodo) => {
    console.log('toggleTodoCompleted called with:', todo)
    if (!authUser?.email) {
      console.log('No authUser email found')
      return
    }
    
    try {
      const newCompleted = !todo.completed
      console.log('Toggling todo to:', newCompleted)
      
      // ToDo 상태 업데이트
      const { data, error } = await supabase
        .from('op_todos')
        .update({ completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null })
        .eq('id', todo.id)
        .select()
        .single()
      if (error) throw error
      
      console.log('Todo updated successfully:', data)
      
      // 클릭 기록을 데이터베이스에 저장
      const { error: logError } = await supabase
        .from('todo_click_logs')
        .insert([{
          todo_id: todo.id,
          user_email: authUser.email,
          action: newCompleted ? 'completed' : 'uncompleted'
        }])
      
      if (logError) {
        console.error('Failed to save click log:', logError)
      }
      
      // 로컬 상태 업데이트
      // const logEntry = {
      //   user: authUser.email,
      //   timestamp: new Date().toISOString(),
      //   action: newCompleted ? 'completed' : 'uncompleted' as 'completed' | 'uncompleted'
      // }
      
      // setClickLogs(prev => ({
      //   ...prev,
      //   [todo.id]: [...(prev[todo.id] || []), logEntry]
      // }))
      
      setOpTodos(prev => prev.map(t => t.id === todo.id ? (data as OpTodo) : t))
      console.log('Local state updated')
    } catch (e) {
      console.error('Error in toggleTodoCompleted:', e)
      alert('ToDo 완료 상태 변경 중 오류가 발생했습니다.')
    }
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
        .insert([payload])
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
        })
        .eq('id', editingTodo.id)
        .select()
        .single()
      
      if (error) throw error
      setOpTodos(prev => prev.map(todo => todo.id === editingTodo.id ? (data as OpTodo) : todo))
      cancelEditTodo()
    } catch (e) {
      console.error(e)
      alert('ToDo 수정 중 오류가 발생했습니다.')
    }
  }

  const createProject = async () => {
    if (!newProject.title.trim() || !authUser?.email) return
    setSubmitting(true)
    try {
      const payload = {
        title: newProject.title.trim(),
        description: newProject.description.trim() || null,
        status: newProject.status,
        priority: newProject.priority,
        start_date: newProject.start_date || null,
        end_date: newProject.end_date || null,
        assigned_to: newProject.assigned_to,
        tags: newProject.tags ? newProject.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        progress: newProject.progress,
        created_by: authUser.email,
      }
      const { data, error } = await supabase
        .from('projects')
        .insert([payload])
        .select()
        .single()
      if (error) throw error
      setProjects(prev => [data as Project, ...prev])
      closeWorkModal()
      setNewProject({
        title: '',
        description: '',
        status: 'planning',
        priority: 'medium',
        start_date: '',
        end_date: '',
        assigned_to: [],
        tags: '',
        progress: 0
      })
    } catch (e) {
      console.error(e)
      alert('프로젝트 생성 중 오류가 발생했습니다.')
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
        type: newIssue.type,
        assigned_to: newIssue.assigned_to || null,
        project_id: newIssue.project_id || null,
        due_date: newIssue.due_date || null,
        tags: newIssue.tags ? newIssue.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        reported_by: authUser.email,
      }
      const { data, error } = await supabase
        .from('issues')
        .insert([payload])
        .select()
        .single()
      if (error) throw error
      setIssues(prev => [data as Issue, ...prev])
      closeWorkModal()
      setNewIssue({
        title: '',
        description: '',
        status: 'open',
        priority: 'medium',
        type: 'bug',
        assigned_to: '',
        project_id: '',
        due_date: '',
        tags: ''
      })
    } catch (e) {
      console.error(e)
      alert('이슈 생성 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  // 업무 모달 열기 함수들
  const openWorkModal = (type: 'project' | 'issue') => {
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
                  .update({ completed: is_completed, completed_at: is_completed ? new Date().toISOString() : null })
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
                    }])
                  
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
                  onClick={() => {
                    setNewTodo({ ...newTodo, category: 'daily', scope: 'individual', assigned_to: authUser?.email || '' })
                    setShowNewTodoModal(true)
                  }}
                  className="w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center transition-colors"
                  title={t('newTodo')}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {['todo', 'in_progress', 'completed'].map(status => (
                  <div key={status} className="bg-gray-50 p-3 rounded-md">
                    <h3 className="font-medium mb-3 capitalize">{status.replace('_', ' ')}</h3>
                    <div className="space-y-2">
                      {opTodos
                        .filter(todo => {
                          if (status === 'todo') return !todo.completed && todo.category === 'daily'
                          if (status === 'in_progress') return false // No explicit 'in_progress' status in current schema
                          if (status === 'completed') return todo.completed && todo.category === 'daily'
                          return false
                        })
                        .map(todo => (
                          <div key={todo.id} className="bg-white p-2 border rounded-md shadow-sm">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={todo.completed}
                                  onClick={() => toggleTodoCompleted(todo)}
                                  className="mr-2"
                                />
                                <span className={`${todo.completed ? 'line-through text-gray-500' : ''}`}>{todo.title}</span>
                              </div>
                              <div className="text-xs text-gray-400">{todo.assigned_to}</div>
                            </div>
                            {todo.description && <p className="text-xs text-gray-500 mt-1">{todo.description}</p>}
                          </div>
                        ))}
                    </div>
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
                  className="w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center transition-colors"
                  title="새 공지"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {announcements.length === 0 ? (
                <div className="text-sm text-gray-500">등록된 공지가 없습니다.</div>
              ) : (
                <ul className="space-y-3">
                  {announcements.map(a => {
                    const acks = acksByAnnouncement[a.id] || []
                    const mineAck = !!acks.find(x => (x.ack_by || '').toLowerCase() === authUser?.email?.toLowerCase())
                    return (
                      <li key={a.id} className="border rounded-md p-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center space-x-2">
                              {a.is_pinned && <span className="inline-flex items-center text-amber-600 text-xs font-semibold">PIN</span>}
                              <h3 className="text-base font-semibold">{a.title}</h3>
                              {a.priority && a.priority !== 'normal' && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${a.priority==='urgent'?'bg-red-600 text-white':a.priority==='high'?'bg-red-100 text-red-700':'bg-gray-100 text-gray-600'}`}>{a.priority}</span>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{a.content}</p>
                            {/* recipients */}
                            {a.recipients && a.recipients.length>0 && (
                              <div className="mt-2 text-xs text-gray-600">대상: {a.recipients.join(', ')}</div>
                            )}
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
                            <div className="mt-2 text-xs text-gray-400">{new Date(a.created_at).toLocaleString()} · {a.created_by}</div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button onClick={() => togglePin(a)} className="p-1 text-gray-500 hover:text-gray-700" title="핀 고정">
                              {a.is_pinned ? <PinOff className="w-4 h-4"/> : <Pin className="w-4 h-4"/>}
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <div className="text-xs text-gray-600 flex items-center space-x-2">
                            <MessageCircle className="w-3 h-3"/>
                            <span>댓글 {commentsByAnnouncement[a.id]?.length || 0}</span>
                            <span className="mx-1">•</span>
                            <Check className="w-3 h-3"/>
                            <span>확인 {acks.length}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            {mineAck ? (
                              <button onClick={() => unackAnnouncement(a.id)} className="text-xs px-2 py-1 border rounded-md hover:bg-gray-50">확인 취소</button>
                            ) : (
                              <button onClick={() => ackAnnouncement(a.id)} className="text-xs px-2 py-1 bg-emerald-600 text-white rounded-md hover:bg-emerald-700">확인</button>
                            )}
                          </div>
                        </div>

                        {/* Add comment input */}
                        <AddCommentRow onSubmit={(text) => addComment(a.id, text)} />

                        {/* Comments */}
                        {(commentsByAnnouncement[a.id] || []).length > 0 && (
                          <ul className="mt-2 space-y-2">
                            {(commentsByAnnouncement[a.id] || []).map(c => (
                              <li key={c.id} className="text-sm text-gray-700 border-t pt-2">
                                <div className="flex items-center justify-between">
                                  <span>{c.comment}</span>
                                  <span className="text-xs text-gray-400 ml-2">{c.created_by} · {new Date(c.created_at).toLocaleString()}</span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {/* 4) 프로젝트 */}
            <section className="bg-white rounded-lg shadow border p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">프로젝트</h2>
                <button
                  onClick={() => openWorkModal('project')}
                  className="w-8 h-8 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center transition-colors"
                  title="새 프로젝트"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <ProjectPanel projects={projects} />
            </section>

            {/* 5) 이슈 */}
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

        {/* New Announcement Modal */}
        {showNewAnnouncement && (
          <Modal onClose={() => setShowNewAnnouncement(false)}>
            <h3 className="text-lg font-semibold mb-3">새 공지 작성</h3>
            <div className="space-y-3">
              <input value={newAnnouncement.title} onChange={e => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })} placeholder="제목" className="w-full px-3 py-2 border rounded-md"/>
              <textarea value={newAnnouncement.content} onChange={e => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })} placeholder="내용" rows={6} className="w-full px-3 py-2 border rounded-md"/>
              {/* recipients picker */}
              <RecipientPicker selected={newAnnouncement.recipients} onChange={(arr) => setNewAnnouncement({ ...newAnnouncement, recipients: arr })} />
              {/* position picker */}
              <PositionPicker 
                selected={newAnnouncement.target_positions}
                onChange={(arr) => setNewAnnouncement({ ...newAnnouncement, target_positions: arr })}
                selectedRecipients={newAnnouncement.recipients}
                onRecipientsChange={(arr) => setNewAnnouncement({ ...newAnnouncement, recipients: arr })}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select value={newAnnouncement.priority} onChange={e => setNewAnnouncement({ ...newAnnouncement, priority: e.target.value as 'low' | 'normal' | 'high' | 'urgent' })} className="px-3 py-2 border rounded-md">
                  <option value="low">low</option>
                  <option value="normal">normal</option>
                  <option value="high">high</option>
                  <option value="urgent">urgent</option>
                </select>
                <input value={newAnnouncement.tags} onChange={e => setNewAnnouncement({ ...newAnnouncement, tags: e.target.value })} placeholder="태그(쉼표 구분)" className="px-3 py-2 border rounded-md"/>
              </div>
              <div className="flex justify-end space-x-2">
                <button onClick={() => setShowNewAnnouncement(false)} className="px-3 py-1.5 border rounded-md">취소</button>
                <button disabled={submitting} onClick={handleCreateAnnouncement} className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  {submitting ? '등록 중...' : '등록'}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* New Todo Modal */}
        {showNewTodoModal && (
          <Modal onClose={() => setShowNewTodoModal(false)}>
            <h3 className="text-lg font-semibold mb-4">체크리스트 관리</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 기존 항목 관리 */}
              <div>
                <h4 className="font-medium mb-3">기존 항목 관리</h4>
                <div className="grid grid-cols-1 gap-4">
                  {['daily', 'weekly', 'monthly', 'yearly'].map(category => (
                    <div key={category} className="border rounded-lg p-3">
                      <h5 className="font-medium text-sm mb-3 text-center">
                        {category === 'daily' ? '일일' : 
                         category === 'weekly' ? '주간' :
                         category === 'monthly' ? '월간' : '연간'}
                      </h5>
                      <div className="flex flex-wrap gap-2">
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
                                          className={`px-2 py-1 text-xs rounded ${
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
                                        onClick={cancelEditTodo}
                                        className="flex-1 px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                                      >
                                        취소
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                // 일반 보기 모드 - 태그 구름 모양 버튼
                                <div className="inline-block">
                                <button
                                  onClick={() => toggleTodoCompleted(todo)}
                                    className={`inline-flex items-center space-x-2 px-4 py-2 text-left transition-all duration-300 transform hover:scale-105 ${
                                      todo.completed 
                                        ? 'bg-gradient-to-br from-emerald-100 to-emerald-200 border-2 border-emerald-300 text-emerald-800 shadow-lg' 
                                        : 'bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 text-gray-700 hover:from-blue-50 hover:to-blue-100 hover:border-blue-300 hover:shadow-md'
                                    }`}
                                    style={{
                                      borderRadius: '20px',
                                      position: 'relative',
                                      overflow: 'hidden'
                                    }}
                                  >
                                    {/* 구름 모양 배경 효과 */}
                                    <div className="absolute inset-0 opacity-10">
                                      <div className="absolute -top-1 -left-1 w-4 h-4 bg-white rounded-full"></div>
                                      <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-white rounded-full"></div>
                                      <div className="absolute -bottom-0.5 -left-0.5 w-3 h-3 bg-white rounded-full"></div>
                                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full"></div>
                                    </div>
                                    
                                    <div className="relative flex items-center justify-center w-full">
                                      <div className="text-center">
                                        <span className={`text-sm font-medium whitespace-nowrap ${
                                          todo.completed ? 'line-through opacity-75' : ''
                                        }`}>
                                          {todo.title}
                                        </span>
                                      </div>
                                    </div>
                                </button>
                                  
                                  {/* 액션 버튼들 */}
                                  <div className="inline-flex items-center space-x-1 ml-2">
                                <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        startEditTodo(todo)
                                      }}
                                      className="p-1 text-blue-500 hover:bg-blue-100 rounded-full transition-colors"
                                      title="수정"
                                    >
                                      <Edit className="w-3 h-3"/>
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        deleteTodo(todo.id)
                                      }}
                                      className="p-1 text-red-500 hover:bg-red-100 rounded-full transition-colors"
                                      title="삭제"
                                >
                                  <X className="w-3 h-3"/>
                                </button>
                              </div>
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

        {/* Work Management Modal */}
        {showWorkModal && workModalType && (
          <Modal onClose={closeWorkModal}>
            <h3 className="text-lg font-semibold mb-4">
              {workModalType === 'project' ? '새 프로젝트' : '새 이슈'}
            </h3>
            
            {workModalType === 'project' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">프로젝트명</label>
                  <input 
                    value={newProject.title} 
                    onChange={e => setNewProject({ ...newProject, title: e.target.value })} 
                    placeholder="프로젝트명을 입력하세요" 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                  <textarea 
                    value={newProject.description} 
                    onChange={e => setNewProject({ ...newProject, description: e.target.value })} 
                    placeholder="프로젝트 설명을 입력하세요" 
                    rows={4} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
                    <select 
                      value={newProject.status} 
                      onChange={e => setNewProject({ ...newProject, status: e.target.value as 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled' })} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="planning">기획</option>
                      <option value="in_progress">진행중</option>
                      <option value="on_hold">보류</option>
                      <option value="completed">완료</option>
                      <option value="cancelled">취소</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">우선순위</label>
                    <select 
                      value={newProject.priority} 
                      onChange={e => setNewProject({ ...newProject, priority: e.target.value as 'low' | 'medium' | 'high' | 'urgent' })} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="low">낮음</option>
                      <option value="medium">보통</option>
                      <option value="high">높음</option>
                      <option value="urgent">긴급</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
                    <input 
                      type="date" 
                      value={newProject.start_date} 
                      onChange={e => setNewProject({ ...newProject, start_date: e.target.value })} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
                    <input 
                      type="date" 
                      value={newProject.end_date} 
                      onChange={e => setNewProject({ ...newProject, end_date: e.target.value })} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">태그</label>
                    <input 
                      value={newProject.tags} 
                      onChange={e => setNewProject({ ...newProject, tags: e.target.value })} 
                      placeholder="태그를 쉼표로 구분하여 입력하세요" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">진행률 (%)</label>
                    <input 
                      type="number" 
                      min="0" 
                      max="100" 
                      value={newProject.progress} 
                      onChange={e => setNewProject({ ...newProject, progress: parseInt(e.target.value) || 0 })} 
                      placeholder="0" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
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
                    onClick={createProject} 
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? '등록 중...' : '프로젝트 등록'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이슈 제목</label>
                  <input 
                    value={newIssue.title} 
                    onChange={e => setNewIssue({ ...newIssue, title: e.target.value })} 
                    placeholder="이슈 제목을 입력하세요" 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                  <textarea 
                    value={newIssue.description} 
                    onChange={e => setNewIssue({ ...newIssue, description: e.target.value })} 
                    placeholder="이슈 설명을 입력하세요" 
                    rows={4} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
                    <select 
                      value={newIssue.status} 
                      onChange={e => setNewIssue({ ...newIssue, status: e.target.value as 'open' | 'in_progress' | 'resolved' | 'closed' })} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="open">열림</option>
                      <option value="in_progress">진행중</option>
                      <option value="resolved">해결됨</option>
                      <option value="closed">닫힘</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">우선순위</label>
                    <select 
                      value={newIssue.priority} 
                      onChange={e => setNewIssue({ ...newIssue, priority: e.target.value as 'low' | 'medium' | 'high' | 'critical' })} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="low">낮음</option>
                      <option value="medium">보통</option>
                      <option value="high">높음</option>
                      <option value="critical">치명적</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">유형</label>
                    <select 
                      value={newIssue.type} 
                      onChange={e => setNewIssue({ ...newIssue, type: e.target.value as 'bug' | 'feature' | 'task' | 'improvement' })} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="bug">버그</option>
                      <option value="feature">기능</option>
                      <option value="task">작업</option>
                      <option value="improvement">개선</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">담당자</label>
                    <input 
                      value={newIssue.assigned_to} 
                      onChange={e => setNewIssue({ ...newIssue, assigned_to: e.target.value })} 
                      placeholder="담당자 이메일을 입력하세요" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">마감일</label>
                    <input 
                      type="date" 
                      value={newIssue.due_date} 
                      onChange={e => setNewIssue({ ...newIssue, due_date: e.target.value })} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">태그</label>
                  <input 
                    value={newIssue.tags} 
                    onChange={e => setNewIssue({ ...newIssue, tags: e.target.value })} 
                    placeholder="태그를 쉼표로 구분하여 입력하세요" 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
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
            )}
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

function AddCommentRow({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <div className="mt-3 flex items-center space-x-2">
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="댓글 입력..." className="flex-1 px-3 py-2 border rounded-md text-sm"/>
      <button
        onClick={() => { onSubmit(value); setValue('') }}
        className="inline-flex items-center px-3 py-1.5 bg-gray-800 text-white rounded-md hover:bg-gray-900 text-sm"
      >
        <Send className="w-3.5 h-3.5 mr-1"/> 등록
      </button>
    </div>
  )
}

function RecipientPicker({ selected, onChange }: { selected: string[]; onChange: (emails: string[]) => void }) {
  const supabase = createClientSupabase()
  const [members, setMembers] = useState<{ email: string; name?: string }[]>([])
  const [emailToName, setEmailToName] = useState<Record<string, string>>({})
  const [keyword, setKeyword] = useState('')
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('team').select('email, name_ko').eq('is_active', true)
      const list = (data as TeamMember[] || []).map((r) => ({ email: r.email, name: r.name_ko || undefined }))
      setMembers(list)
      const map: Record<string, string> = {}
      list.forEach(m => { if (m.name) map[m.email] = m.name })
      setEmailToName(map)
    }
    load()
  }, [supabase])
  const filtered = members.filter(m => {
    const t = keyword.toLowerCase()
    return (m.name || '').toLowerCase().includes(t) || m.email.toLowerCase().includes(t)
  }).filter(m => !selected.includes(m.email))
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {selected.map((email, idx) => (
          <span key={`${email}-${idx}`} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs inline-flex items-center">
            {emailToName[email] || email}
            <button className="ml-1 text-blue-600" onClick={() => onChange(selected.filter(s => s !== email))}>×</button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="이름 또는 이메일 검색" className="flex-1 px-3 py-2 border rounded-md"/>
        <div className="relative">
          {keyword && filtered.length > 0 && (
            <div className="absolute top-full left-0 bg-white border rounded shadow z-10 w-72 max-h-48 overflow-y-auto">
              {filtered.map((m, idx) => (
                <button key={`${m.email}-${idx}`} onClick={() => { onChange([...selected, m.email]); setKeyword('') }} className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-sm">
                  {m.name || m.email}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PositionPicker({ selected, onChange, selectedRecipients, onRecipientsChange }: { selected: string[]; onChange: (positions: string[]) => void; selectedRecipients: string[]; onRecipientsChange: (emails: string[]) => void }) {
  const supabase = createClientSupabase()
  const [positions, setPositions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [membersByPosition, setMembersByPosition] = useState<Record<string, { email: string; name?: string }[]>>({})
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('team').select('position, email, name_ko').eq('is_active', true)
      const unique = Array.from(new Set((data as TeamMember[] || []).map((r) => (r.position || '').trim()).filter(Boolean)))
      setPositions(unique)
      const grouped: Record<string, { email: string; name?: string }[]> = {}
      ;(data as TeamMember[] || []).forEach((r) => {
        const p = (r.position || '').trim()
        if (!p) return
        grouped[p] = grouped[p] || []
        grouped[p].push({ email: r.email, name: r.name_ko || undefined })
      })
      setMembersByPosition(grouped)
    }
    load()
  }, [supabase])
  const toggle = (p: string) => {
    if (selected.includes(p)) onChange(selected.filter(s => s !== p))
    else onChange([...selected, p])
  }
  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-700 font-medium">포지션(그룹) 선택</div>
      <div className="flex flex-wrap gap-2">
        {selected.map((p, idx) => (
          <span key={`${p}-${idx}`} className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs inline-flex items-center">
            {p}
            <button className="ml-1 text-purple-600" onClick={() => onChange(selected.filter(s => s !== p))}>×</button>
          </span>
        ))}
      </div>
      <div>
        <button onClick={() => setOpen(!open)} className="px-3 py-1.5 border rounded-md text-sm">{open ? '닫기' : '포지션 목록 열기'}</button>
        {open && (
          <div className="mt-2 space-y-3">
            {positions.map((p) => {
              const members = membersByPosition[p] || []
              const allSelected = members.length>0 && members.every(m => selectedRecipients.includes(m.email))
              return (
                <div key={p} className="border rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <label className={`px-3 py-1.5 border rounded-md text-sm cursor-pointer ${selected.includes(p) ? 'bg-purple-600 text-white border-purple-600' : 'hover:bg-gray-50'}`} onClick={() => toggle(p)}>{p}</label>
                    <button
                      className="text-xs px-2 py-1 border rounded-md hover:bg-gray-50"
                      onClick={() => {
                        if (allSelected) {
                          // unselect all members
                          onRecipientsChange(selectedRecipients.filter(e => !members.some(m => m.email === e)))
                        } else {
                          // select all members
                          const merged = Array.from(new Set([...selectedRecipients, ...members.map(m => m.email)]))
                          onRecipientsChange(merged)
                        }
                      }}
                    >{allSelected ? '전체 해제' : '전체 선택'}</button>
                  </div>
                  {members.length > 0 ? (
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {members.map(m => {
                        const sel = selectedRecipients.includes(m.email)
                        return (
                          <label key={m.email} className={`px-3 py-2 border rounded-md text-sm cursor-pointer ${sel ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'}`
                          } onClick={() => {
                            if (sel) onRecipientsChange(selectedRecipients.filter(e => e !== m.email))
                            else onRecipientsChange([...selectedRecipients, m.email])
                          }}>
                            {m.name || ''}
                          </label>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-gray-500">이 포지션에 등록된 팀원이 없습니다.</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
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
        {['daily', 'weekly', 'monthly', 'yearly'].map(category => {
          const categoryTodos = opTodos.filter(todo => todo.category === category)
          return (
            <div key={category} className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-3">
                <h5 className="font-medium text-sm">
                  {category === 'daily' ? '일일' : 
                   category === 'weekly' ? '주간' :
                   category === 'monthly' ? '월간' : '연간'}
                </h5>
                <button
                  onClick={() => openHistoryModal(category as 'daily' | 'weekly' | 'monthly' | 'yearly')}
                  className="p-1 text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                  title="히스토리 보기"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {categoryTodos.length === 0 ? (
                  <div className="text-xs text-gray-500 text-center py-4 border-2 border-dashed border-gray-200 rounded w-full">
                    항목 없음
                  </div>
                ) : (
                  categoryTodos.map(todo => (
                    <div key={todo.id} className="inline-block">
          <button
                        onClick={() => {
                          console.log('Button clicked for todo:', todo.id, 'current completed:', todo.completed)
                          toggleTodoCompletion(todo.id, !todo.completed)
                        }}
                        className={`inline-flex items-center space-x-2 px-4 py-2 text-left transition-all duration-300 transform hover:scale-105 ${
                          todo.completed 
                            ? 'bg-gradient-to-br from-emerald-100 to-emerald-200 border-2 border-emerald-300 text-emerald-800 shadow-lg' 
                            : 'bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 text-gray-700 hover:from-blue-50 hover:to-blue-100 hover:border-blue-300 hover:shadow-md'
                        }`}
                        style={{
                          borderRadius: '20px',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        {/* 구름 모양 배경 효과 */}
                        <div className="absolute inset-0 opacity-10">
                          <div className="absolute -top-1 -left-1 w-4 h-4 bg-white rounded-full"></div>
                          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-white rounded-full"></div>
                          <div className="absolute -bottom-0.5 -left-0.5 w-3 h-3 bg-white rounded-full"></div>
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full"></div>
      </div>

                        <div className="relative flex items-center justify-center w-full">
                          <div className="text-center">
                            <span className={`text-sm font-medium whitespace-nowrap ${
                              todo.completed ? 'line-through opacity-75' : ''
                            }`}>
                              {todo.title}
                            </span>
                          </div>
                        </div>
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


function ProjectPanel({ projects }: { projects: Project[] }) {
  const statusColors = {
    planning: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-blue-100 text-blue-700',
    on_hold: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700'
  }

  const priorityColors = {
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-blue-100 text-blue-600',
    high: 'bg-orange-100 text-orange-600',
    urgent: 'bg-red-100 text-red-600'
  }

  if (projects.length === 0) {
    return <div className="text-sm text-gray-500">등록된 프로젝트가 없습니다.</div>
  }

  return (
    <div className="space-y-3">
      {projects.map(project => (
        <div key={project.id} className="border rounded-lg p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-medium text-gray-900">{project.title}</h4>
              {project.description && (
                <p className="text-sm text-gray-600 mt-1">{project.description}</p>
              )}
              <div className="flex items-center space-x-2 mt-2">
                <span className={`px-2 py-1 rounded-full text-xs ${statusColors[project.status as keyof typeof statusColors]}`}>
                  {project.status}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs ${priorityColors[project.priority as keyof typeof priorityColors]}`}>
                  {project.priority}
                </span>
                <span className="text-xs text-gray-500">
                  {project.progress}%
                </span>
              </div>
              {project.tags && project.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {project.tags.map((tag: string, idx: number) => (
                    <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="text-xs text-gray-400 ml-2">
              {new Date(project.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      ))}
    </div>
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

  const typeColors = {
    bug: 'bg-red-100 text-red-600',
    feature: 'bg-green-100 text-green-600',
    task: 'bg-blue-100 text-blue-600',
    improvement: 'bg-purple-100 text-purple-600'
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
                  {issue.status}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs ${priorityColors[issue.priority as keyof typeof priorityColors]}`}>
                  {issue.priority}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs ${typeColors[issue.type as keyof typeof typeColors]}`}>
                  {issue.type}
                </span>
              </div>
              {issue.tags && issue.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {issue.tags.map((tag: string, idx: number) => (
                    <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
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

