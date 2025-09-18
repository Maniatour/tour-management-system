'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { use } from 'react'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import { createClientSupabase } from '@/lib/supabase'
import { useTranslations } from 'next-intl'
import { Check, CheckCircle2, ChevronDown, ChevronUp, Loader2, MessageCircle, Pin, PinOff, Plus, Send, X } from 'lucide-react'

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
  category: 'daily' | 'monthly' | 'yearly'
  assigned_to: string | null
  due_date: string | null
  completed: boolean
  completed_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export default function TeamBoardPage({ params }: TeamBoardPageProps) {
  const { locale } = use(params)
  const { authUser } = useAuth()
  const supabase = createClientSupabase()
  
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
  const [newTodo, setNewTodo] = useState<{ title: string; description: string; scope: 'common'|'individual'; category: 'daily'|'monthly'|'yearly'; assigned_to: string }>(
    { title: '', description: '', scope: 'common', category: 'daily', assigned_to: '' }
  )
  
  // 프로젝트 관련 상태
  const [projects, setProjects] = useState<any[]>([])
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
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
  const [issues, setIssues] = useState<any[]>([])
  const [showNewIssueModal, setShowNewIssueModal] = useState(false)
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

  useEffect(() => {
    fetchAll()
  }, [])

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

      setAnnouncements((anns || []) as Announcement[])
      const byAnn: Record<string, Comment[]> = {}
      ;(cmts || []).forEach((c: any) => {
        const key = c.announcement_id
        byAnn[key] = byAnn[key] || []
        byAnn[key].push(c)
      })
      setCommentsByAnnouncement(byAnn)

      const aMap: Record<string, Acknowledgment[]> = {}
      ;(acks || []).forEach((a: any) => {
        const key = a.announcement_id
        aMap[key] = aMap[key] || []
        aMap[key].push(a)
      })
      setAcksByAnnouncement(aMap)

      setOpTodos((opTodos || []) as OpTodo[])
      setProjects((projs || []) as any[])
      setIssues((iss || []) as any[])
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
          const emails = posMembers.map((m: any) => (m.email as string).toLowerCase())
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
        }])
        .select()
        .single()
      if (error) throw error
      setAnnouncements([data as any, ...announcements])
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
      setAnnouncements(announcements.map(a => a.id === announcement.id ? (data as any) : a))
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
      setCommentsByAnnouncement(prev => ({ ...prev, [announcementId]: [...(prev[announcementId] || []), data as any] }))
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
      setAcksByAnnouncement(prev => ({ ...prev, [announcementId]: [...(prev[announcementId] || []), data as any] }))
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
    try {
      const { data, error } = await supabase
        .from('op_todos')
        .update({ completed: !todo.completed, completed_at: !todo.completed ? new Date().toISOString() : null })
        .eq('id', todo.id)
        .select()
        .single()
      if (error) throw error
      setOpTodos(prev => prev.map(t => t.id === todo.id ? (data as any) : t))
    } catch (e) {
      console.error(e)
      alert('ToDo 완료 상태 변경 중 오류가 발생했습니다.')
    }
  }

  const createTodo = async () => {
    if (!newTodo.title.trim() || !authUser?.email) return
    if (newTodo.scope === 'individual' && !newTodo.assigned_to.trim()) {
      alert('개별 업무는 담당자 이메일이 필요합니다.')
      return
    }
    try {
      const payload: any = {
        title: newTodo.title.trim(),
        description: newTodo.description.trim() || null,
        scope: newTodo.scope,
        category: newTodo.category,
        assigned_to: newTodo.scope === 'individual' ? newTodo.assigned_to.trim() : null,
        created_by: authUser.email,
      }
      const { data, error } = await supabase
        .from('op_todos')
        .insert([payload])
        .select()
        .single()
      if (error) throw error
      setOpTodos(prev => [data as any, ...prev])
      setShowNewTodoModal(false)
      setNewTodo({ title: '', description: '', scope: 'common', category: 'daily', assigned_to: '' })
    } catch (e) {
      console.error(e)
      alert('ToDo 생성 중 오류가 발생했습니다.')
    }
  }

  const createProject = async () => {
    if (!newProject.title.trim() || !authUser?.email) return
    setSubmitting(true)
    try {
      const payload: any = {
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
      setProjects(prev => [data as any, ...prev])
      setShowNewProjectModal(false)
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
      const payload: any = {
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
      setIssues(prev => [data as any, ...prev])
      setShowNewIssueModal(false)
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
                setSubmitting(true)
                const { error } = await supabase
                  .from('op_todos')
                  .update({ completed: is_completed, completed_at: is_completed ? new Date().toISOString() : null })
                  .eq('id', id)
                if (error) {
                  console.error('Error toggling todo completion:', error)
                  alert('Failed to toggle todo completion.')
                } else {
                  setOpTodos(prev => prev.map(todo => (todo.id === id ? { ...todo, completed: is_completed } : todo)))
                }
                setSubmitting(false)
              }}
            />

            {/* 2) 업무(Tasks) */}
            <section className="bg-white rounded-lg shadow border p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">{t('tasks')}</h2>
                <button
                  onClick={() => {
                    setNewTodo({ ...newTodo, category: 'all', scope: 'individual', assigned_to: authUser?.email || '' })
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
                          if (status === 'todo') return !todo.completed && todo.category === 'all'
                          if (status === 'in_progress') return false // No explicit 'in_progress' status in current schema
                          if (status === 'completed') return todo.completed && todo.category === 'all'
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
                    const mineAck = !!acks.find(x => (x.ack_by || '').toLowerCase() === myEmail)
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
                  onClick={() => setShowNewProjectModal(true)}
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
                  onClick={() => setShowNewIssueModal(true)}
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
                <select value={newAnnouncement.priority} onChange={e => setNewAnnouncement({ ...newAnnouncement, priority: e.target.value as any })} className="px-3 py-2 border rounded-md">
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
            <h3 className="text-lg font-semibold mb-3">새 ToDo</h3>
            <div className="space-y-3">
              <input value={newTodo.title} onChange={e => setNewTodo({ ...newTodo, title: e.target.value })} placeholder="제목" className="w-full px-3 py-2 border rounded-md"/>
              <textarea value={newTodo.description} onChange={e => setNewTodo({ ...newTodo, description: e.target.value })} placeholder="설명 (선택)" rows={4} className="w-full px-3 py-2 border rounded-md"/>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select value={newTodo.scope} onChange={e => setNewTodo({ ...newTodo, scope: e.target.value as any })} className="px-3 py-2 border rounded-md">
                  <option value="common">공통</option>
                  <option value="individual">개별</option>
                </select>
                <select value={newTodo.category} onChange={e => setNewTodo({ ...newTodo, category: e.target.value as any })} className="px-3 py-2 border rounded-md">
                  <option value="daily">Daily</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
                <input value={newTodo.assigned_to} onChange={e => setNewTodo({ ...newTodo, assigned_to: e.target.value })} placeholder="담당자 이메일 (개별일 때)" className="px-3 py-2 border rounded-md"/>
              </div>
              <div className="flex justify-end space-x-2">
                <button onClick={() => setShowNewTodoModal(false)} className="px-3 py-1.5 border rounded-md">취소</button>
                <button onClick={createTodo} className="px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">등록</button>
              </div>
            </div>
          </Modal>
        )}

        {/* New Project Modal */}
        {showNewProjectModal && (
          <Modal onClose={() => setShowNewProjectModal(false)}>
            <h3 className="text-lg font-semibold mb-3">새 프로젝트</h3>
            <div className="space-y-3">
              <input value={newProject.title} onChange={e => setNewProject({ ...newProject, title: e.target.value })} placeholder="프로젝트명" className="w-full px-3 py-2 border rounded-md"/>
              <textarea value={newProject.description} onChange={e => setNewProject({ ...newProject, description: e.target.value })} placeholder="설명" rows={4} className="w-full px-3 py-2 border rounded-md"/>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select value={newProject.status} onChange={e => setNewProject({ ...newProject, status: e.target.value as any })} className="px-3 py-2 border rounded-md">
                  <option value="planning">기획</option>
                  <option value="in_progress">진행중</option>
                  <option value="on_hold">보류</option>
                  <option value="completed">완료</option>
                  <option value="cancelled">취소</option>
                </select>
                <select value={newProject.priority} onChange={e => setNewProject({ ...newProject, priority: e.target.value as any })} className="px-3 py-2 border rounded-md">
                  <option value="low">낮음</option>
                  <option value="medium">보통</option>
                  <option value="high">높음</option>
                  <option value="urgent">긴급</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input type="date" value={newProject.start_date} onChange={e => setNewProject({ ...newProject, start_date: e.target.value })} className="px-3 py-2 border rounded-md"/>
                <input type="date" value={newProject.end_date} onChange={e => setNewProject({ ...newProject, end_date: e.target.value })} className="px-3 py-2 border rounded-md"/>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input value={newProject.tags} onChange={e => setNewProject({ ...newProject, tags: e.target.value })} placeholder="태그 (쉼표 구분)" className="px-3 py-2 border rounded-md"/>
                <input type="number" min="0" max="100" value={newProject.progress} onChange={e => setNewProject({ ...newProject, progress: parseInt(e.target.value) || 0 })} placeholder="진행률 (%)" className="px-3 py-2 border rounded-md"/>
              </div>
              <div className="flex justify-end space-x-2">
                <button onClick={() => setShowNewProjectModal(false)} className="px-3 py-1.5 border rounded-md">취소</button>
                <button disabled={submitting} onClick={createProject} className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50">
                  {submitting ? '등록 중...' : '등록'}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* New Issue Modal */}
        {showNewIssueModal && (
          <Modal onClose={() => setShowNewIssueModal(false)}>
            <h3 className="text-lg font-semibold mb-3">새 이슈</h3>
            <div className="space-y-3">
              <input value={newIssue.title} onChange={e => setNewIssue({ ...newIssue, title: e.target.value })} placeholder="이슈 제목" className="w-full px-3 py-2 border rounded-md"/>
              <textarea value={newIssue.description} onChange={e => setNewIssue({ ...newIssue, description: e.target.value })} placeholder="설명" rows={4} className="w-full px-3 py-2 border rounded-md"/>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select value={newIssue.status} onChange={e => setNewIssue({ ...newIssue, status: e.target.value as any })} className="px-3 py-2 border rounded-md">
                  <option value="open">열림</option>
                  <option value="in_progress">진행중</option>
                  <option value="resolved">해결됨</option>
                  <option value="closed">닫힘</option>
                </select>
                <select value={newIssue.priority} onChange={e => setNewIssue({ ...newIssue, priority: e.target.value as any })} className="px-3 py-2 border rounded-md">
                  <option value="low">낮음</option>
                  <option value="medium">보통</option>
                  <option value="high">높음</option>
                  <option value="critical">치명적</option>
                </select>
                <select value={newIssue.type} onChange={e => setNewIssue({ ...newIssue, type: e.target.value as any })} className="px-3 py-2 border rounded-md">
                  <option value="bug">버그</option>
                  <option value="feature">기능</option>
                  <option value="task">작업</option>
                  <option value="improvement">개선</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input value={newIssue.assigned_to} onChange={e => setNewIssue({ ...newIssue, assigned_to: e.target.value })} placeholder="담당자 이메일" className="px-3 py-2 border rounded-md"/>
                <input type="date" value={newIssue.due_date} onChange={e => setNewIssue({ ...newIssue, due_date: e.target.value })} className="px-3 py-2 border rounded-md"/>
              </div>
              <input value={newIssue.tags} onChange={e => setNewIssue({ ...newIssue, tags: e.target.value })} placeholder="태그 (쉼표 구분)" className="w-full px-3 py-2 border rounded-md"/>
              <div className="flex justify-end space-x-2">
                <button onClick={() => setShowNewIssueModal(false)} className="px-3 py-1.5 border rounded-md">취소</button>
                <button disabled={submitting} onClick={createIssue} className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
                  {submitting ? '등록 중...' : '등록'}
                </button>
              </div>
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
      <div className="bg-white rounded-lg p-4 w-full max-w-2xl mx-4">
        <div className="flex justify-end mb-2">
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-700">
            <X className="w-4 h-4"/>
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
      const list = (data || []).map((r: any) => ({ email: r.email as string, name: r.name_ko as string }))
      setMembers(list)
      const map: Record<string, string> = {}
      list.forEach(m => { if (m.name) map[m.email] = m.name })
      setEmailToName(map)
    }
    load()
  }, [])
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
      const unique = Array.from(new Set((data || []).map((r: any) => (r.position || '').trim()).filter(Boolean)))
      setPositions(unique)
      const grouped: Record<string, { email: string; name?: string }[]> = {}
      ;(data || []).forEach((r: any) => {
        const p = (r.position || '').trim()
        if (!p) return
        grouped[p] = grouped[p] || []
        grouped[p].push({ email: (r.email as string), name: r.name_ko as string })
      })
      setMembersByPosition(grouped)
    }
    load()
  }, [])
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

function ChecklistPanel({ opTodos, onAddTodo, toggleTodoCompletion }: { opTodos: OpTodo[]; onAddTodo: () => void; toggleTodoCompletion: (id: string, is_completed: boolean) => Promise<void> }) {
  const [activeCategory, setActiveCategory] = useState<'daily' | 'monthly' | 'yearly'>('daily')
  
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
        'noTodos': '등록된 ToDo가 없습니다.',
        'filters.catDaily': 'Daily',
        'filters.catMonthly': 'Monthly',
        'filters.catYearly': 'Yearly'
      }
      return fallbacks[key] || key
    }
  }

  const filteredTodos = useMemo(() => {
    return opTodos.filter(todo => todo.category === activeCategory)
  }, [opTodos, activeCategory])

  const completionPercentage = useMemo(() => {
    if (filteredTodos.length === 0) return 0
    const completedCount = filteredTodos.filter(todo => todo.completed).length
    return Math.round((completedCount / filteredTodos.length) * 100)
  }, [filteredTodos])

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

      <div className="flex border-b mb-4">
        {['daily', 'monthly', 'yearly'].map(cat => (
          <button
            key={cat}
            className={`px-4 py-2 text-sm font-medium ${activeCategory === cat ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveCategory(cat as 'daily' | 'monthly' | 'yearly')}
          >
            {t(`filters.cat${cat.charAt(0).toUpperCase() + cat.slice(1)}`)}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filteredTodos.length === 0 ? (
          <p className="text-sm text-gray-500">{t('noTodos')}</p>
        ) : (
          filteredTodos.map(todo => (
            <div key={todo.id} className="flex items-center justify-between p-2 border rounded-md">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onClick={() => toggleTodoCompletion(todo.id, !todo.completed)}
                  className="mr-2"
                />
                <span className={`${todo.completed ? 'line-through text-gray-500' : ''}`}>
                  {todo.title}
                </span>
              </div>
              <div className="text-xs text-gray-400">{todo.assigned_to}</div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}


function ProjectPanel({ projects }: { projects: any[] }) {
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

function IssuePanel({ issues }: { issues: any[] }) {
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

