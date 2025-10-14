'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientSupabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslations } from 'next-intl'
import { CheckCircle, Circle, AlertCircle, MessageSquare, Plus, X, Calendar, User, Clock } from 'lucide-react'

type Todo = Database['public']['Tables']['op_todos']['Row']
type Announcement = Database['public']['Tables']['team_announcements']['Row']
type Issue = Database['public']['Tables']['issues']['Row']

export default function GuideTeamBoard({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const supabase = createClientSupabase()
  const { user, userRole, simulatedUser, isSimulating } = useAuth()
  const t = useTranslations('guide')
  const { locale } = use(params)
  
  // 번역 함수
  const getText = (ko: string, en: string) => locale === 'en' ? en : ko
  
  // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보 사용
  const currentUser = isSimulating && simulatedUser ? simulatedUser : user
  const currentUserEmail = isSimulating && simulatedUser ? simulatedUser.email : user?.email
  
  const [todos, setTodos] = useState<Todo[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'todos' | 'announcements' | 'issues'>('todos')
  
  // 새 전달사항 추가 상태
  const [showNewAnnouncement, setShowNewAnnouncement] = useState(false)
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
    tags: '',
    recipients: [] as string[]
  })

  // 새 이슈 추가 상태
  const [showWorkModal, setShowWorkModal] = useState(false)
  const [workModalType, setWorkModalType] = useState<'issue' | null>(null)
  const [newIssue, setNewIssue] = useState({
    title: '',
    description: '',
    status: 'open' as 'open' | 'in_progress' | 'resolved' | 'closed',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical'
  })

  // 팀 멤버 상태
  const [teamMembers, setTeamMembers] = useState<Array<{email: string, name_ko: string | null, position: string | null, is_active: boolean}>>([])
  const [taskRecipientMode, setTaskRecipientMode] = useState<'individual' | 'group'>('individual')
  const [selectedTaskPositions, setSelectedTaskPositions] = useState<string[]>([])
  const [selectedTaskIndividuals, setSelectedTaskIndividuals] = useState<string[]>([])
  const [activePositionTab, setActivePositionTab] = useState<string>('Office Manager')

  useEffect(() => {
    loadTeamBoardData()
    loadTeamMembers()
  }, [currentUserEmail])

  const loadTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team')
        .select('email, name_ko, position, is_active')
        .eq('is_active', true)
        .order('name_ko')

      if (error) {
        console.error('Error loading team members:', error)
        return
      }

      setTeamMembers(data || [])
    } catch (error) {
      console.error('Error loading team members:', error)
    }
  }

  const loadTeamBoardData = async () => {
    try {
      setLoading(true)
      
      if (!currentUserEmail) return

      // 할 일 목록 로드 (가이드 담당자만)
      const { data: todosData, error: todosError } = await supabase
        .from('op_todos')
        .select('*')
        .eq('assigned_to', currentUserEmail)
        .order('created_at', { ascending: false })
        .limit(20)

      if (todosError) {
        console.error('Error loading todos:', todosError)
      } else {
        setTodos(todosData || [])
      }

      // 전달사항 로드 (해당 팀원에게 전달된 것들)
      const { data: announcementsData, error: announcementsError } = await supabase
        .from('team_announcements')
        .select(`
          *,
          team_announcement_acknowledgments!left(ack_by, ack_at)
        `)
        .eq('is_archived', false)
        .or(`recipients.is.null,recipients.cs.{${currentUserEmail}}`)
        .order('created_at', { ascending: false })
        .limit(10)

      if (announcementsError) {
        console.error('Error loading announcements:', announcementsError)
      } else {
        // 내가 확인하지 않은 전달사항만 필터링
        const unreadAnnouncements = (announcementsData || []).filter(announcement => {
          const acknowledgments = announcement.team_announcement_acknowledgments || []
          return !acknowledgments.some(ack => ack.ack_by === currentUserEmail)
        })
        setAnnouncements(unreadAnnouncements)
      }

      // 이슈 로드 (해결되지 않은 것들)
      const { data: issuesData, error: issuesError } = await supabase
        .from('issues')
        .select('*')
        .neq('status', 'resolved')
        .neq('status', 'closed')
        .order('created_at', { ascending: false })
        .limit(10)

      if (issuesError) {
        console.error('Error loading issues:', issuesError)
      } else {
        setIssues(issuesData || [])
      }

    } catch (error) {
      console.error('Error loading team board data:', error)
    } finally {
      setLoading(false)
    }
  }

  // 할 일 완료 처리
  const handleTodoComplete = async (todoId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('op_todos')
        .update({ 
          completed: completed,
          completed_at: completed ? new Date().toISOString() : null
        })
        .eq('id', todoId)

      if (error) {
        console.error('Error updating todo:', error)
        return
      }

      // 로컬 상태 업데이트
      setTodos(prev => prev.map(todo => 
        todo.id === todoId 
          ? { ...todo, completed: completed, completed_at: completed ? new Date().toISOString() : null }
          : todo
      ))
    } catch (error) {
      console.error('Error updating todo:', error)
    }
  }

  // 전달사항 확인 처리
  const handleAnnouncementAck = async (announcementId: string) => {
    try {
      if (!currentUserEmail) return

      const { error } = await supabase
        .from('team_announcement_acknowledgments')
        .insert({
          announcement_id: announcementId,
          ack_by: currentUserEmail,
          ack_at: new Date().toISOString()
        })

      if (error) {
        console.error('Error acknowledging announcement:', error)
        return
      }

      // 전달사항 목록에서 제거
      setAnnouncements(prev => prev.filter(announcement => announcement.id !== announcementId))
    } catch (error) {
      console.error('Error acknowledging announcement:', error)
    }
  }

  // 새 전달사항 추가
  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!currentUserEmail || !newAnnouncement.title.trim()) {
      alert(getText('제목을 입력해주세요.', 'Please enter a title.'))
      return
    }

    try {
      const payload = {
        title: newAnnouncement.title.trim(),
        content: newAnnouncement.content.trim(),
        priority: newAnnouncement.priority,
        tags: newAnnouncement.tags ? newAnnouncement.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
        recipients: selectedTaskIndividuals.length > 0 ? selectedTaskIndividuals : null,
        target_positions: selectedTaskPositions.length > 0 ? selectedTaskPositions : null,
        created_by: currentUserEmail
      }

      const { error } = await supabase
        .from('team_announcements')
        .insert([payload] as any)
        .select()
        .single()

      if (error) {
        console.error('Error adding announcement:', error)
        alert(getText('전달사항 추가 중 오류가 발생했습니다.', 'An error occurred while adding the announcement.'))
        return
      }

      // 폼 초기화
      setNewAnnouncement({ title: '', content: '', priority: 'normal', tags: '', recipients: [] })
      setSelectedTaskIndividuals([])
      setSelectedTaskPositions([])
      setShowNewAnnouncement(false)
      
      // 데이터 다시 로드
      loadTeamBoardData()
    } catch (error) {
      console.error('Error adding announcement:', error)
      alert(getText('전달사항 추가 중 오류가 발생했습니다.', 'An error occurred while adding the announcement.'))
    }
  }

  // 새 이슈 추가
  const handleAddIssue = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!currentUserEmail || !newIssue.title.trim()) {
      alert(getText('제목을 입력해주세요.', 'Please enter a title.'))
      return
    }

    try {
      const payload = {
        title: newIssue.title.trim(),
        description: newIssue.description.trim(),
        status: newIssue.status,
        priority: newIssue.priority,
        reported_by: currentUserEmail
      }

      const { error } = await supabase
        .from('issues')
        .insert([payload] as any)
        .select()
        .single()

      if (error) {
        console.error('Error adding issue:', error)
        alert(getText('이슈 추가 중 오류가 발생했습니다.', 'An error occurred while adding the issue.'))
        return
      }

      // 폼 초기화
      setNewIssue({ title: '', description: '', status: 'open', priority: 'medium' })
      closeWorkModal()
      
      // 데이터 다시 로드
      loadTeamBoardData()
    } catch (error) {
      console.error('Error adding issue:', error)
      alert(getText('이슈 추가 중 오류가 발생했습니다.', 'An error occurred while adding the issue.'))
    }
  }

  // 업무 모달 열기/닫기 함수들
  const openWorkModal = (type: 'issue') => {
    setWorkModalType(type)
    setShowWorkModal(true)
  }

  const closeWorkModal = () => {
    setShowWorkModal(false)
    setWorkModalType(null)
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'daily':
        return 'text-blue-600 bg-blue-100'
      case 'monthly':
        return 'text-purple-600 bg-purple-100'
      case 'yearly':
        return 'text-orange-600 bg-orange-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getCategoryText = (category: string) => {
    switch (category) {
      case 'daily':
        return getText('일일', 'Daily')
      case 'monthly':
        return getText('월간', 'Monthly')
      case 'yearly':
        return getText('연간', 'Yearly')
      default:
        return category
    }
  }

  const getScopeText = (scope: string) => {
    switch (scope) {
      case 'common':
        return getText('공통', 'Common')
      case 'individual':
        return getText('개인', 'Individual')
      default:
        return scope
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{getText('팀 보드를 불러오는 중...', 'Loading team board...')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-lg p-4 sm:p-6 text-white">
        <h1 className="text-xl sm:text-2xl font-bold mb-2">
          {getText('팀 보드', 'Team Board')}
        </h1>
        <p className="text-indigo-100">
          {getText('할 일, 전달사항, 이슈를 확인하고 관리하세요', 'Check and manage todos, announcements, and issues')}
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-4 sm:space-x-8 px-4 sm:px-6 overflow-x-auto" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('todos')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'todos'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 mr-2" />
                {getText('할 일', 'Todos')} ({todos.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('announcements')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'announcements'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <MessageSquare className="w-4 h-4 mr-2" />
                {getText('전달사항', 'Announcements')} ({announcements.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('issues')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'issues'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                {getText('이슈', 'Issues')} ({issues.length})
              </div>
            </button>
          </nav>
        </div>

        {/* 탭 콘텐츠 */}
        <div className="p-4 sm:p-6">
          {/* 할 일 탭 */}
          {activeTab === 'todos' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">{getText('할 일 목록', 'Todo List')}</h2>
              </div>

              {todos.length > 0 ? (
                <div className="space-y-3">
                  {todos.map((todo) => (
                    <div
                      key={todo.id}
                      className={`border rounded-lg p-4 hover:bg-gray-50 transition-colors ${
                        todo.completed ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <button
                          onClick={() => handleTodoComplete(todo.id, !todo.completed)}
                          className="mt-1"
                        >
                          {todo.completed ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <Circle className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                          )}
                        </button>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className={`font-medium ${
                              todo.completed ? 'text-gray-500 line-through' : 'text-gray-900'
                            }`}>
                              {todo.title}
                            </h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(todo.category || 'daily')}`}>
                              {getCategoryText(todo.category || 'daily')}
                            </span>
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              {getScopeText(todo.scope || 'individual')}
                            </span>
                          </div>
                          
                          {todo.description && (
                            <p className={`text-sm ${
                              todo.completed ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              {todo.description}
                            </p>
                          )}
                          
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                            {todo.due_date && (
                              <div className="flex items-center">
                                <Calendar className="w-3 h-3 mr-1" />
                                        {new Date(todo.due_date).toLocaleDateString(locale === 'en' ? 'en-US' : 'ko-KR')}
                              </div>
                            )}
                            {todo.assigned_to && (
                              <div className="flex items-center">
                                <User className="w-3 h-3 mr-1" />
                                {todo.assigned_to}
                              </div>
                            )}
                            <div className="flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                                {new Date(todo.created_at).toLocaleDateString(locale === 'en' ? 'en-US' : 'ko-KR')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>{getText('할 일이 없습니다', 'No todos available')}</p>
                </div>
              )}
            </div>
          )}

          {/* 전달사항 탭 */}
          {activeTab === 'announcements' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">{getText('전달사항', 'Announcements')}</h2>
                <button
                  onClick={() => setShowNewAnnouncement(true)}
                  className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {getText('추가', 'Add')}
                </button>
              </div>
              
              {announcements.length > 0 ? (
                <div className="space-y-3">
                  {announcements.map((announcement) => (
                    <div
                      key={announcement.id}
                      className="border border-blue-200 rounded-lg p-4 bg-blue-50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-2">
                            {announcement.title}
                          </h3>
                          <p className="text-gray-700 mb-3">
                            {announcement.content}
                          </p>
                          <div className="flex items-center text-xs text-gray-500">
                            <User className="w-3 h-3 mr-1" />
                            {announcement.created_by}
                            <span className="mx-2">•</span>
                            <Clock className="w-3 h-3 mr-1" />
                            {new Date(announcement.created_at).toLocaleDateString(locale === 'en' ? 'en-US' : 'ko-KR')}
                          </div>
                        </div>
                        <button
                          onClick={() => handleAnnouncementAck(announcement.id)}
                          className="ml-4 px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          {getText('확인', 'Acknowledge')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>{getText('확인하지 않은 전달사항이 없습니다', 'No unread announcements')}</p>
                </div>
              )}
            </div>
          )}

          {/* 이슈 탭 */}
          {activeTab === 'issues' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">{getText('이슈', 'Issues')}</h2>
                <button
                  onClick={() => openWorkModal('issue')}
                  className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {getText('추가', 'Add')}
                </button>
              </div>
              
              {issues.length > 0 ? (
                <div className="space-y-3">
                  {issues.map((issue) => (
                    <div
                      key={issue.id}
                      className="border border-red-200 rounded-lg p-4 bg-red-50"
                    >
                      <div className="flex items-start space-x-3">
                        <AlertCircle className="w-5 h-5 text-red-600 mt-1" />
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-2">
                            {issue.title}
                          </h3>
                          <p className="text-gray-700 mb-3">
                            {issue.description}
                          </p>
                          <div className="flex items-center text-xs text-gray-500">
                            <User className="w-3 h-3 mr-1" />
                            {issue.reported_by}
                            <span className="mx-2">•</span>
                            <Clock className="w-3 h-3 mr-1" />
                            {new Date(issue.created_at).toLocaleDateString(locale === 'en' ? 'en-US' : 'ko-KR')}
                            <span className="mx-2">•</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              issue.status === 'open' ? 'bg-red-100 text-red-600' :
                              issue.status === 'in_progress' ? 'bg-yellow-100 text-yellow-600' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {issue.status === 'open' ? getText('열림', 'Open') :
                               issue.status === 'in_progress' ? getText('진행중', 'In Progress') :
                               issue.status === 'resolved' ? getText('해결됨', 'Resolved') : getText('닫힘', 'Closed')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>{getText('해결되지 않은 이슈가 없습니다', 'No unresolved issues')}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 새 전달사항 추가 모달 */}
      {showNewAnnouncement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-4">
            <div className="p-4">
               <div className="mb-4">
                 <h3 className="text-lg font-semibold mb-3">{getText('새 공지 작성', 'Create New Announcement')}</h3>
                 <div className={`flex items-center gap-2 ${locale === 'en' ? 'flex-wrap' : ''}`}>
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
                       {p === 'normal' ? getText('보통', 'Normal') : 
                        p === 'low' ? getText('낮음', 'Low') : 
                        p === 'high' ? getText('높음', 'High') : 
                        getText('긴급', 'Urgent')}
                     </button>
                   ))}
                 </div>
               </div>
              <form onSubmit={handleAddAnnouncement}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{getText('제목', 'Title')}</label>
                    <input
                      type="text"
                      value={newAnnouncement.title}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder={getText('공지 제목', 'Announcement title')}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{getText('내용', 'Content')}</label>
                    <textarea
                      value={newAnnouncement.content}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      rows={3}
                      placeholder={getText('공지 내용', 'Announcement content')}
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{getText('태그', 'Tags')}</label>
                      <input
                        type="text"
                        value={newAnnouncement.tags}
                        onChange={(e) => setNewAnnouncement({ ...newAnnouncement, tags: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder={getText('예: 긴급, 회의', 'e.g.: urgent, meeting')}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{getText('전달 대상', 'Recipients')}</label>
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
                          {getText('개별 선택', 'Individual')}
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
                          {getText('그룹 선택', 'Group')}
                        </button>
                      </div>
                      
                      {taskRecipientMode === 'individual' ? (
                        <div className="border rounded">
                           {/* 탭 헤더 */}
                           <div className="flex border-b overflow-x-auto">
                             {['Office Manager', 'Super', 'Tour Guide', 'OP', 'Driver']
                               .filter(position => locale === 'ko' || position !== 'Super')
                               .map(position => (
                               <button
                                 key={position}
                                 type="button"
                                 onClick={() => setActivePositionTab(position)}
                                 className={`px-2 py-2 text-xs font-medium border-r last:border-r-0 transition-colors whitespace-nowrap ${
                                   activePositionTab === position
                                     ? 'bg-blue-600 text-white'
                                     : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                 }`}
                               >
                                 {position === 'Office Manager' ? getText('매니저', 'Manager') :
                                  position === 'Super' ? getText('슈퍼', '') :
                                  position === 'Tour Guide' ? getText('가이드', 'Guide') :
                                  position === 'OP' ? getText('OP', 'Office') :
                                  position === 'Driver' ? getText('드라이버', 'Driver') : position}
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
                         <div className="space-y-2">
                           {['Office Manager', 'Super', 'Tour Guide', 'OP', 'Driver']
                             .filter(position => locale === 'ko' || position !== 'Super')
                             .map(position => (
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
                                 {position === 'Office Manager' ? getText('매니저', 'Manager') :
                                  position === 'Super' ? getText('슈퍼', '') :
                                  position === 'Tour Guide' ? getText('가이드', 'Guide') :
                                  position === 'OP' ? getText('OP', 'Office') :
                                  position === 'Driver' ? getText('드라이버', 'Driver') : position}
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
                  
                  <div className="flex space-x-3 pt-4">
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {getText('추가하기', 'Add')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewAnnouncement(false)}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                    >
                      {getText('취소', 'Cancel')}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 이슈 모달 */}
      {showWorkModal && workModalType === 'issue' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-4">
            <div className="p-4">
               <div className="mb-4">
                 <h3 className="text-lg font-semibold mb-3">{getText('새 이슈', 'New Issue')}</h3>
                 <div className={`flex items-center gap-2 ${locale === 'en' ? 'flex-wrap' : ''}`}>
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
                       {p === 'low' ? getText('낮음', 'Low') : 
                        p === 'medium' ? getText('보통', 'Medium') : 
                        p === 'high' ? getText('높음', 'High') : 
                        getText('치명적', 'Critical')}
                     </button>
                   ))}
                 </div>
               </div>
            
              <form onSubmit={handleAddIssue}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{getText('이슈 제목', 'Issue Title')}</label>
                    <input 
                      value={newIssue.title} 
                      onChange={e => setNewIssue({ ...newIssue, title: e.target.value })} 
                      placeholder={getText('이슈 제목을 입력하세요', 'Enter issue title')} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{getText('설명', 'Description')}</label>
                    <textarea 
                      value={newIssue.description} 
                      onChange={e => setNewIssue({ ...newIssue, description: e.target.value })} 
                      placeholder={getText('이슈 설명을 입력하세요', 'Enter issue description')} 
                      rows={4} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  
                  
                  <div className="flex space-x-3 pt-4">
                    <button
                      type="submit"
                      className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                    >
                      {getText('추가하기', 'Add')}
                    </button>
                    <button
                      type="button"
                      onClick={closeWorkModal}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                    >
                      {getText('취소', 'Cancel')}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
