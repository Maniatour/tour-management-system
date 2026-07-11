'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useRoutePersistedState } from '@/hooks/useRoutePersistedState'
import { useTranslations } from 'next-intl'
import ReactCountryFlag from 'react-country-flag'
import { supabase } from '@/lib/supabase'
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Eye,
  User,
  Car,
  CreditCard,
  Shield,
  FileText,
  Grid,
  List,
  Download,
} from 'lucide-react'
import type { Database } from '@/lib/supabase'
import { formatPaymentMethodDisplay } from '@/lib/paymentMethodDisplay'
import TeamMemberForm from '@/components/team/TeamMemberForm'

type TeamMember = Database['public']['Tables']['team']['Row']
type TeamMemberInsert = Database['public']['Tables']['team']['Insert']
type TeamMemberUpdate = Database['public']['Tables']['team']['Update']
type TeamCardPaymentMethodRow = Pick<
  Database['public']['Tables']['payment_methods']['Row'],
  'id' | 'method' | 'display_name' | 'status' | 'method_type' | 'user_email' | 'card_holder_name'
>

const TEAM_LIST_UI_DEFAULT = {
  searchTerm: '',
  statusFilter: 'active' as 'active' | 'inactive' | 'all',
  sortField: 'name_ko' as keyof TeamMember,
  sortDirection: 'asc' as 'asc' | 'desc',
  viewMode: 'card' as 'table' | 'card'
}

export default function AdminTeam() {
  const t = useTranslations('team')
  const params = useParams()
  const locale = (params?.locale as string) || 'ko'
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [listUi, setListUi] = useRoutePersistedState('team-list', TEAM_LIST_UI_DEFAULT)
  const { searchTerm, statusFilter, sortField, sortDirection, viewMode } = listUi
  const setSearchTerm = (v: string) => setListUi((prev) => ({ ...prev, searchTerm: v }))
  const setStatusFilter = (v: 'active' | 'inactive' | 'all') => setListUi((prev) => ({ ...prev, statusFilter: v }))
  const setSortField = (v: keyof TeamMember) => setListUi((prev) => ({ ...prev, sortField: v }))
  const setSortDirection = (v: 'asc' | 'desc') => setListUi((prev) => ({ ...prev, sortDirection: v }))
  const setViewMode = (v: 'table' | 'card') => setListUi((prev) => ({ ...prev, viewMode: v }))
  const [showForm, setShowForm] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [memberDocuments, setMemberDocuments] = useState<{[email: string]: {[type: string]: Array<{id: string, name: string, url: string, path: string, size: number, uploadedAt: string}>}}>({})
  const [paymentMethodsByUserEmail, setPaymentMethodsByUserEmail] = useState<
    Record<string, TeamCardPaymentMethodRow[]>
  >({})

  // 인라인 편집 상태
  const [inlineEditing, setInlineEditing] = useState<{ email: string; field: string } | null>(null)
  const [inlineEditValue, setInlineEditValue] = useState<string>('')

  const teamMemberEmailsKey = useMemo(
    () => teamMembers.map((m) => m.email.toLowerCase()).sort().join('|'),
    [teamMembers]
  )

  // 카드뷰: 팀원 이메일 기준 연결 결제수단 일괄 조회 (payment_methods.user_email)
  useEffect(() => {
    if (viewMode !== 'card' || teamMembers.length === 0) {
      setPaymentMethodsByUserEmail({})
      return
    }

    let cancelled = false
    const emails = [...new Set(teamMembers.map((m) => m.email.toLowerCase()))]
    const chunkSize = 80

    ;(async () => {
      const map: Record<string, TeamCardPaymentMethodRow[]> = {}
      for (let i = 0; i < emails.length; i += chunkSize) {
        const chunk = emails.slice(i, i + chunkSize)
        const { data, error } = await supabase
          .from('payment_methods')
          .select('id, method, display_name, status, method_type, user_email, card_holder_name')
          .in('user_email', chunk)
          .order('method', { ascending: true })

        if (cancelled) return
        if (error) {
          console.error('팀 카드뷰 결제수단 조회 오류:', error)
          continue
        }
        for (const row of data || []) {
          const key = (row.user_email || '').toLowerCase()
          if (!key) continue
          if (!map[key]) map[key] = []
          map[key].push(row as TeamCardPaymentMethodRow)
        }
      }
      if (!cancelled) setPaymentMethodsByUserEmail(map)
    })()

    return () => {
      cancelled = true
    }
  }, [viewMode, teamMemberEmailsKey])

  // 팀원 목록 불러오기
  const fetchTeamMembers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('team')
        .select('*')
        .order('name_ko')

      if (error) {
        console.error('Error fetching team members:', error)
        return
      }

      setTeamMembers(data || [])
    } catch (error) {
      console.error('Error fetching team members:', error)
    } finally {
      setLoading(false)
    }
  }

  // 새 팀원 추가
  const handleAddMember = async (memberData: TeamMemberInsert) => {
    try {
      // 이메일을 소문자로 정규화
      const normalizedData = {
        ...memberData,
        email: memberData.email.toLowerCase().trim()
      }
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('team')
        .insert(normalizedData)

      if (error) {
        console.error('Error adding team member:', error)
        // 중복 이메일 에러 처리
        if (error.code === '23505' || error.message?.includes('duplicate key')) {
          alert(`이메일 "${normalizedData.email}"이(가) 이미 등록되어 있습니다.`)
        } else if (error.code === '42501') {
          alert('팀원을 추가할 권한이 없습니다. 관리자에게 문의하세요.')
        } else {
          alert(`팀원 추가 중 오류가 발생했습니다: ${error.message || error.code}`)
        }
        return
      }

      alert('팀원이 성공적으로 추가되었습니다!')
      setShowForm(false)
      fetchTeamMembers()
    } catch (error) {
      console.error('Error adding team member:', error)
      alert('팀원 추가 중 오류가 발생했습니다.')
    }
  }

  // 팀원 정보 수정
  const handleEditMember = async (email: string, updateData: TeamMemberUpdate) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('team')
        .update(updateData)
        .eq('email', email)

      if (error) {
        console.error('Error updating team member:', error)
        alert('팀원 정보 수정 중 오류가 발생했습니다.')
        return
      }

      alert('팀원 정보가 성공적으로 수정되었습니다!')
      setShowForm(false)
      setEditingMember(null)
      fetchTeamMembers()
    } catch (error) {
      console.error('Error updating team member:', error)
      alert('팀원 정보 수정 중 오류가 발생했습니다.')
    }
  }

  // 팀원 삭제 — 성공 시 true (모달 닫기 등에 사용)
  const handleDeleteMember = async (email: string): Promise<boolean> => {
    if (!confirm(t('deleteConfirm'))) return false

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('team')
        .delete()
        .eq('email', email)

      if (error) {
        console.error('Error deleting team member:', error)
        alert('팀원 삭제 중 오류가 발생했습니다.')
        return false
      }

      alert('팀원이 성공적으로 삭제되었습니다!')
      fetchTeamMembers()
      return true
    } catch (error) {
      console.error('Error deleting team member:', error)
      alert('팀원 삭제 중 오류가 발생했습니다.')
      return false
    }
  }

  // 팀원 활성/비활성 상태 토글
  const handleToggleActive = async (email: string, currentStatus: boolean) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('team')
        .update({ is_active: !currentStatus })
        .eq('email', email)

      if (error) {
        console.error('Error toggling team member status:', error)
        alert('팀원 상태 변경 중 오류가 발생했습니다.')
        return
      }

      alert(`팀원이 ${!currentStatus ? '활성화' : '비활성화'}되었습니다!`)
      fetchTeamMembers()
    } catch (error) {
      console.error('Error toggling team member status:', error)
      alert('팀원 상태 변경 중 오류가 발생했습니다.')
    }
  }

  // 인라인 편집 시작
  const handleInlineEditStart = (email: string, field: string, currentValue: string) => {
    setInlineEditing({ email, field })
    setInlineEditValue(currentValue || '')
  }

  // 인라인 편집 저장
  const handleInlineEditSave = async () => {
    if (!inlineEditing) return
    
    const { email, field } = inlineEditing
    const member = teamMembers.find(m => m.email === email)
    if (!member) return

    // 값이 변경되지 않았으면 취소
    const currentValue = (member as Record<string, unknown>)[field] as string || ''
    if (inlineEditValue === currentValue) {
      setInlineEditing(null)
      return
    }

    try {
      const updateData: Record<string, string | null> = {
        [field]: inlineEditValue.trim() || null
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('team')
        .update(updateData)
        .eq('email', email)

      if (error) {
        console.error('인라인 수정 오류:', error)
        alert('수정 중 오류가 발생했습니다.')
      } else {
        // 로컬 상태 즉시 업데이트 (리로드 없이)
        setTeamMembers(prev => prev.map(m => 
          m.email === email 
            ? { ...m, [field]: inlineEditValue.trim() || null } as TeamMember
            : m
        ))
      }
    } catch (error) {
      console.error('인라인 수정 오류:', error)
      alert('수정 중 오류가 발생했습니다.')
    } finally {
      setInlineEditing(null)
    }
  }

  // 인라인 편집 취소
  const handleInlineEditCancel = () => {
    setInlineEditing(null)
    setInlineEditValue('')
  }

  // 인라인 편집 키 이벤트
  const handleInlineEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleInlineEditSave()
    } else if (e.key === 'Escape') {
      handleInlineEditCancel()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      handleInlineEditSave()
    }
  }

  // 정렬 처리 함수
  const handleSort = (field: keyof TeamMember) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // 정렬된 팀원 목록
  const getSortedMembers = (members: TeamMember[]) => {
    return [...members].sort((a, b) => {
      let aValue = a[sortField]
      let bValue = b[sortField]

      // null/undefined 값 처리
      if (aValue === null || aValue === undefined) aValue = ''
      if (bValue === null || bValue === undefined) bValue = ''

      // 문자열 비교
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue, 'ko')
        return sortDirection === 'asc' ? comparison : -comparison
      }

      // 숫자 비교
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
      }

      // 불린 비교
      if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        const comparison = aValue === bValue ? 0 : aValue ? 1 : -1
        return sortDirection === 'asc' ? comparison : -comparison
      }

      return 0
    })
  }

  // 컴포넌트 마운트 시 팀원 목록 불러오기
  useEffect(() => {
    fetchTeamMembers()
  }, [])

  // 팀원 문서 목록 불러오기
  const fetchMemberDocuments = async (email: string) => {
    if (memberDocuments[email]) return // 이미 로드된 경우 스킵
    
    try {
      const documentTypes = ['contract', 'id_copy', 'bank_info', 'other']
      const allDocuments: {[key: string]: Array<{id: string, name: string, url: string, path: string, size: number, uploadedAt: string}>} = {}
      
      for (const docType of documentTypes) {
        const prefix = `team-documents/${email}/${docType}/`
        const { data: files, error } = await supabase.storage
          .from('documents')
          .list(prefix, {
            limit: 100,
            offset: 0,
            sortBy: { column: 'created_at', order: 'desc' }
          })
        
        if (error) {
          console.error(`${docType} 문서 목록 조회 오류:`, error)
          allDocuments[docType] = []
          continue
        }
        
        if (files && files.length > 0) {
          allDocuments[docType] = files
            .filter(file => file.name !== '.emptyFolderPlaceholder')
            .map(file => {
              const filePath = `${prefix}${file.name}`
              const { data: { publicUrl } } = supabase.storage
                .from('documents')
                .getPublicUrl(filePath)
              
              return {
                id: file.id || `${docType}-${file.name}`,
                name: file.name,
                url: publicUrl,
                path: filePath,
                size: file.metadata?.size || 0,
                uploadedAt: file.created_at || new Date().toISOString()
              }
            })
        } else {
          allDocuments[docType] = []
        }
      }
      
      setMemberDocuments(prev => ({
        ...prev,
        [email]: allDocuments
      }))
    } catch (error) {
      console.error('문서 목록 불러오기 오류:', error)
    }
  }

  // 검색된 팀원 목록
  const filteredMembers = teamMembers.filter(member => {
    // 상태 필터 적용 (대소문자 구별 없이)
    if (statusFilter === 'active' && String(member.is_active).toLowerCase() !== 'true') return false
    if (statusFilter === 'inactive' && String(member.is_active).toLowerCase() === 'true') return false
    
    // 검색어 필터 적용
    return (
      member.name_ko.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.name_en?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.nick_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.home_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (String(member.is_active).toLowerCase() === 'true' ? '활성' : '비활성').includes(searchTerm.toLowerCase())
    )
  })

  // 정렬된 팀원 목록
  const sortedMembers = getSortedMembers(filteredMembers)

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 페이지 헤더 - 모바일 최적화 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-gray-600">팀원 정보를 관리하고 모니터링합니다.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex bg-gray-100 rounded-md p-1">
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'card'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <List size={16} />
            </button>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 flex items-center gap-1.5 text-sm font-medium"
          >
            <Plus size={16} />
            <span>{t('addMember')}</span>
          </button>
        </div>
      </div>

      {/* 검색 및 필터 - 모바일 최적화 */}
      <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-sm"
          />
        </div>
        
        {/* 상태 필터 버튼들 - 모바일 최적화 */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              statusFilter === 'active'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            활성 리스트
          </button>
          <button
            onClick={() => setStatusFilter('inactive')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              statusFilter === 'inactive'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            비활성 리스트
          </button>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            전체 리스트
          </button>
        </div>
      </div>

      {/* 팀원 목록 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">팀원 목록을 불러오는 중...</p>
        </div>
      ) : (
        <>
          {/* 필터 정보 표시 */}
          <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
            <div>
              {statusFilter === 'active' && '활성 팀원'}
              {statusFilter === 'inactive' && '비활성 팀원'}
              {statusFilter === 'all' && '전체 팀원'}
              : {sortedMembers.length}명
            </div>
            <div>
              전체: {teamMembers.length}명
            </div>
          </div>
          
          {viewMode === 'table' ? (
            /* 테이블 뷰 - 인라인 편집 지원 */
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('name_ko')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>이름</span>
                        {sortField === 'name_ko' && (
                          <span className="text-primary">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      닉네임
                    </th>
                    <th 
                      className="hidden sm:table-cell px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('email')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>이메일</span>
                        {sortField === 'email' && (
                          <span className="text-primary">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="hidden md:table-cell px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('phone')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>전화번호</span>
                        {sortField === 'phone' && (
                          <span className="text-primary">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('position')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>직책</span>
                        {sortField === 'position' && (
                          <span className="text-primary">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('is_active')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>상태</span>
                        {sortField === 'is_active' && (
                          <span className="text-primary">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedMembers.map((member) => (
                    <tr key={member.email} className="hover:bg-gray-50 group">
                      {/* 이름 (한국어 + 영어) */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        {inlineEditing?.email === member.email && inlineEditing?.field === 'name_ko' ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={inlineEditValue}
                                onChange={(e) => setInlineEditValue(e.target.value)}
                                onKeyDown={handleInlineEditKeyDown}
                                onBlur={handleInlineEditSave}
                                autoFocus
                                className="w-full px-2 py-1 text-sm border border-blue-400 rounded focus:ring-2 focus:ring-ring focus:outline-none bg-primary/5"
                                placeholder="한국어 이름"
                              />
                            </div>
                          </div>
                        ) : inlineEditing?.email === member.email && inlineEditing?.field === 'name_en' ? (
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-gray-900">{member.name_ko}</div>
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={inlineEditValue}
                                onChange={(e) => setInlineEditValue(e.target.value)}
                                onKeyDown={handleInlineEditKeyDown}
                                onBlur={handleInlineEditSave}
                                autoFocus
                                className="w-full px-2 py-0.5 text-xs border border-blue-400 rounded focus:ring-2 focus:ring-ring focus:outline-none bg-primary/5"
                                placeholder="영어 이름"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="min-w-[100px]">
                            <div
                              className="text-sm font-medium text-gray-900 cursor-pointer hover:text-primary hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors"
                              onClick={() => handleInlineEditStart(member.email, 'name_ko', member.name_ko)}
                              title="클릭하여 수정"
                            >
                              {member.name_ko}
                            </div>
                            <div
                              className="text-xs text-gray-500 cursor-pointer hover:text-primary hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors"
                              onClick={() => handleInlineEditStart(member.email, 'name_en', member.name_en || '')}
                              title="클릭하여 수정"
                            >
                              {member.name_en || <span className="text-gray-300 italic">영문명</span>}
                            </div>
                            <div className="sm:hidden text-xs text-gray-400 truncate">{member.email}</div>
                          </div>
                        )}
                      </td>

                      {/* 닉네임 */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        {inlineEditing?.email === member.email && inlineEditing?.field === 'nick_name' ? (
                          <input
                            type="text"
                            value={inlineEditValue}
                            onChange={(e) => setInlineEditValue(e.target.value)}
                            onKeyDown={handleInlineEditKeyDown}
                            onBlur={handleInlineEditSave}
                            autoFocus
                            className="w-full px-2 py-1 text-sm border border-blue-400 rounded focus:ring-2 focus:ring-ring focus:outline-none bg-primary/5 max-w-[100px]"
                            placeholder="닉네임"
                          />
                        ) : (
                          <div
                            className="text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors min-w-[60px]"
                            onClick={() => handleInlineEditStart(member.email, 'nick_name', member.nick_name || '')}
                            title="클릭하여 수정"
                          >
                            {member.nick_name ? (
                              <span className="text-primary font-medium">{member.nick_name}</span>
                            ) : (
                              <span className="text-gray-300 italic text-xs">미설정</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 이메일 (읽기전용) */}
                      <td className="hidden sm:table-cell px-3 py-2 whitespace-nowrap text-sm text-gray-600">
                        {member.email}
                      </td>

                      {/* 전화번호 */}
                      <td className="hidden md:table-cell px-3 py-2 whitespace-nowrap">
                        {inlineEditing?.email === member.email && inlineEditing?.field === 'phone' ? (
                          <input
                            type="tel"
                            value={inlineEditValue}
                            onChange={(e) => setInlineEditValue(e.target.value)}
                            onKeyDown={handleInlineEditKeyDown}
                            onBlur={handleInlineEditSave}
                            autoFocus
                            className="w-full px-2 py-1 text-sm border border-blue-400 rounded focus:ring-2 focus:ring-ring focus:outline-none bg-primary/5 max-w-[140px]"
                            placeholder="전화번호"
                          />
                        ) : (
                          <div
                            className="text-sm text-gray-900 cursor-pointer hover:text-primary hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors"
                            onClick={() => handleInlineEditStart(member.email, 'phone', member.phone || '')}
                            title="클릭하여 수정"
                          >
                            {member.phone || <span className="text-gray-300">-</span>}
                          </div>
                        )}
                      </td>

                      {/* 직책 */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        {inlineEditing?.email === member.email && inlineEditing?.field === 'position' ? (
                          <select
                            value={inlineEditValue}
                            onChange={(e) => {
                              setInlineEditValue(e.target.value)
                              // 셀렉트는 선택 즉시 저장
                              setTimeout(() => {
                                setInlineEditing(null)
                                // 직접 저장 처리
                                const updatePosition = async () => {
                                  try {
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    const { error } = await (supabase as any)
                                      .from('team')
                                      .update({ position: e.target.value || null })
                                      .eq('email', member.email)
                                    if (!error) {
                                      setTeamMembers(prev => prev.map(m => 
                                        m.email === member.email 
                                          ? { ...m, position: e.target.value || null } as TeamMember
                                          : m
                                      ))
                                    }
                                  } catch (err) {
                                    console.error('직책 수정 오류:', err)
                                  }
                                }
                                updatePosition()
                              }, 0)
                            }}
                            onBlur={handleInlineEditCancel}
                            autoFocus
                            className="px-2 py-1 text-sm border border-blue-400 rounded focus:ring-2 focus:ring-ring focus:outline-none bg-primary/5"
                          >
                            <option value="">미지정</option>
                            <option value="manager">매니저</option>
                            <option value="admin">관리자</option>
                            <option value="tour guide">투어 가이드</option>
                            <option value="driver">운전기사</option>
                            <option value="op">운영자</option>
                          </select>
                        ) : (
                          <div
                            className="text-sm text-gray-900 cursor-pointer hover:text-primary hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors"
                            onClick={() => handleInlineEditStart(member.email, 'position', member.position || '')}
                            title="클릭하여 수정"
                          >
                            {member.position ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                {member.position}
                              </span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 상태 */}
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleToggleActive(member.email, member.is_active ?? true)}
                          className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                            member.is_active 
                              ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                              : 'bg-red-100 text-red-800 hover:bg-red-200'
                          }`}
                        >
                          {member.is_active ? '활성' : '비활성'}
                        </button>
                      </td>

                      {/* 작업 */}
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => {
                              setSelectedMember(member)
                              setShowDetailModal(true)
                            }}
                            className="p-1 text-primary hover:text-foreground hover:bg-muted/50 rounded transition-colors"
                            title="상세보기"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingMember(member)
                              setShowForm(true)
                            }}
                            className="p-1 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded transition-colors"
                            title="전체 수정"
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteMember(member.email)}
                            className="p-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors"
                            title="삭제"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          ) : (
            /* 카드뷰 - 모바일 최적화 */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {sortedMembers.map((member) => (
                <div
                  key={member.email}
                  className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => {
                    setEditingMember(member)
                    setShowForm(true)
                  }}
                >
                  <div className="p-4 sm:p-6">
                    {/* 카드 헤더 */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          {member.avatar_url ? (
                            <img
                              src={member.avatar_url}
                              alt={member.name_ko}
                              className="h-12 w-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center">
                              <User size={24} className="text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 min-w-0">
                            <h3 className="text-lg font-semibold text-gray-900 truncate">
                              {member.name_ko}
                              {member.nick_name && (
                                <span className="ml-1.5 text-sm font-normal text-primary">({member.nick_name})</span>
                              )}
                            </h3>
                          </div>
                          <p className="text-sm text-gray-600 mt-0.5 flex items-center gap-2 min-w-0">
                            {member.languages && member.languages.length > 0 ? (
                              <span className="flex flex-shrink-0 items-center gap-1" aria-hidden>
                                {member.languages.map((lang: string, index: number) => (
                                  <ReactCountryFlag
                                    key={index}
                                    countryCode={lang === 'KR' ? 'KR' : lang === 'EN' ? 'US' : lang === 'JP' ? 'JP' : lang === 'CN' ? 'CN' : lang === 'ES' ? 'ES' : lang === 'FR' ? 'FR' : lang === 'DE' ? 'DE' : lang === 'RU' ? 'RU' : 'US'}
                                    svg
                                    style={{
                                      width: '16px',
                                      height: '12px',
                                      borderRadius: '2px'
                                    }}
                                    title={lang}
                                  />
                                ))}
                              </span>
                            ) : null}
                            <span className="truncate min-w-0">{member.name_en || '영문명 없음'}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleActive(member.email, member.is_active ?? true)
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                            member.is_active ? 'bg-green-600' : 'bg-gray-200'
                          }`}
                          aria-label={member.is_active ? '비활성화' : '활성화'}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              member.is_active ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* 카드 내용 */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">직책</span>
                        <span className="font-medium">{member.position || '미지정'}</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">이메일</span>
                        <span className="font-medium text-primary truncate ml-2">{member.email}</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">전화번호</span>
                        <span className="font-medium">{member.phone || '미등록'}</span>
                      </div>

                      {member.home_address?.trim() ? (
                        <div className="text-sm">
                          <span className="text-gray-500 block mb-0.5">집주소</span>
                          <p className="font-medium text-gray-800 line-clamp-2 break-words" title={member.home_address}>
                            {member.home_address}
                          </p>
                        </div>
                      ) : null}

                      <TeamMemberCardLinkedPaymentMethods
                        memberEmail={member.email}
                        memberNickName={member.nick_name}
                        memberNameEn={member.name_en}
                        memberNameKo={member.name_ko}
                        methods={paymentMethodsByUserEmail[member.email.toLowerCase()] ?? []}
                        manageHref={`/${locale}/admin/payment-methods?user_email=${encodeURIComponent(member.email)}`}
                      />

                      {/* 특별 자격사항 */}
                      <div className="border-t pt-3">
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-gray-500">자격사항</span>
                        </div>
                        <div className="flex space-x-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            member.cpr 
                              ? (member.cpr_expired && new Date(member.cpr_expired) < new Date() 
                                  ? 'bg-red-100 text-red-800' 
                                  : 'bg-green-100 text-green-800')
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            <Shield size={12} className="mr-1" />
                            CPR {member.cpr ? (member.cpr_expired && new Date(member.cpr_expired) < new Date() ? '(만료)' : '') : '(없음)'}
                          </span>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            member.medical_report 
                              ? (member.medical_expired && new Date(member.medical_expired) < new Date() 
                                  ? 'bg-red-100 text-red-800' 
                                  : 'bg-green-100 text-green-800')
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            <FileText size={12} className="mr-1" />
                            의료보고서 {member.medical_report ? (member.medical_expired && new Date(member.medical_expired) < new Date() ? '(만료)' : '') : '(없음)'}
                          </span>
                          {member.cdl_driver_license && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-900">
                              <Car size={12} className="mr-1" />
                              CDL
                            </span>
                          )}
                          {member.personal_car_model && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <Car size={12} className="mr-1" />
                              개인차량
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 문서 목록 */}
                      <TeamMemberDocuments 
                        memberEmail={member.email}
                        onLoadDocuments={() => fetchMemberDocuments(member.email)}
                        documents={memberDocuments[member.email] || {}}
                      />

                    </div>

                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 팀원 추가/편집 폼 */}
      {showForm && (
        <TeamMemberForm
          member={editingMember}
          onSubmit={editingMember ? 
            (data) => handleEditMember(editingMember.email, data) : 
            handleAddMember
          }
          onCancel={() => {
            setShowForm(false)
            setEditingMember(null)
          }}
          {...(editingMember
            ? {
                onDelete: async () => {
                  const deleted = await handleDeleteMember(editingMember.email)
                  if (deleted) {
                    setShowForm(false)
                    setEditingMember(null)
                  }
                },
              }
            : {})}
          onDocumentChange={(email) => {
            // 문서 변경 시 해당 팀원의 문서 목록 다시 로드
            if (email) {
              fetchMemberDocuments(email)
            }
          }}
        />
      )}

      {/* 팀원 상세 정보 모달 */}
      {showDetailModal && selectedMember && (
        <TeamMemberDetailModal
          member={selectedMember}
          onClose={() => {
            setShowDetailModal(false)
            setSelectedMember(null)
          }}
        />
      )}
    </div>
  )
}

function teamCardPaymentMethodBadgeClass(status: string | null): string {
  const isActive = (status || '').trim().toLowerCase() === 'active'
  if (isActive) {
    return 'bg-green-100 text-green-900 border-green-300'
  }
  return 'bg-pink-100 text-pink-900 border-pink-300'
}

/** 팀 카드뷰: 해당 이메일(payment_methods.user_email)에 연결된 결제수단 요약 + 관리 페이지 링크 */
function TeamMemberCardLinkedPaymentMethods({
  memberEmail: _memberEmail,
  memberNickName,
  memberNameEn,
  memberNameKo,
  methods,
  manageHref,
}: {
  memberEmail: string
  memberNickName: string | null
  memberNameEn: string | null
  memberNameKo: string
  methods: TeamCardPaymentMethodRow[]
  manageHref: string
}) {
  const displayLimit = 12

  return (
    <div className="border-t pt-3" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm text-gray-500 flex items-center gap-1.5 min-w-0">
          <CreditCard size={14} className="flex-shrink-0" />
          <span className="truncate">연결 결제수단</span>
        </span>
        <Link
          href={manageHref}
          onClick={(e) => e.stopPropagation()}
          className="text-xs font-medium text-primary hover:text-primary/80 whitespace-nowrap"
        >
          관리
        </Link>
      </div>
      {methods.length === 0 ? (
        <p className="text-xs text-gray-400">등록된 결제수단이 없습니다.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
          {methods.slice(0, displayLimit).map((m) => {
            const label = formatPaymentMethodDisplay(
              {
                id: m.id,
                method: m.method,
                display_name: m.display_name,
                user_email: m.user_email,
                card_holder_name: m.card_holder_name,
              },
              {
                nick_name: memberNickName,
                name_en: memberNameEn,
                name_ko: memberNameKo,
              }
            )
            const st = (m.status || '').trim()
            const badgeCls = teamCardPaymentMethodBadgeClass(m.status)
            return (
              <span
                key={m.id}
                className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-tight ${badgeCls}`}
                title={st ? `${label} (${st})` : label}
              >
                <span className="truncate">{label}</span>
              </span>
            )
          })}
        </div>
      )}
      {methods.length > displayLimit ? (
        <p className="text-[11px] text-gray-400 mt-1">외 {methods.length - displayLimit}건 · 관리에서 전체 보기</p>
      ) : null}
    </div>
  )
}

// 팀원 문서 컴포넌트
function TeamMemberDocuments({
  memberEmail: _memberEmail,
  onLoadDocuments,
  documents
}: {
  memberEmail: string
  onLoadDocuments: () => void
  documents: {[type: string]: Array<{id: string, name: string, url: string, path: string, size: number, uploadedAt: string}>}
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isExpanded && Object.keys(documents).length === 0) {
      setIsLoading(true)
      onLoadDocuments()
      setTimeout(() => setIsLoading(false), 500)
    }
  }, [isExpanded, documents, onLoadDocuments])

  const documentTypeLabels: {[key: string]: string} = {
    contract: '계약서',
    id_copy: '신분증 사본',
    bank_info: 'W9',
    other: '기타 문서'
  }

  const totalDocuments = Object.values(documents).reduce((sum, docs) => sum + docs.length, 0)

  if (totalDocuments === 0 && !isExpanded) {
    return (
      <div className="border-t pt-3" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="flex items-center justify-between w-full text-sm text-gray-600 hover:text-gray-900"
        >
          <span className="flex items-center">
            <FileText size={14} className="mr-2" />
            문서 보기
          </span>
          <span className="text-xs text-gray-400">클릭하여 로드</span>
        </button>
      </div>
    )
  }

  return (
    <div className="border-t pt-3" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-sm text-gray-700 hover:text-gray-900 mb-2"
      >
        <span className="flex items-center">
          <FileText size={14} className="mr-2" />
          문서 ({totalDocuments}개)
        </span>
        <span className="text-xs text-gray-400">
          {isExpanded ? '접기' : '펼치기'}
        </span>
      </button>

      {isExpanded && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-4 text-sm text-gray-500">
              문서를 불러오는 중...
            </div>
          ) : totalDocuments === 0 ? (
            <div className="text-center py-4 text-sm text-gray-500">
              업로드된 문서가 없습니다.
            </div>
          ) : (
            Object.entries(documents).map(([type, docs]) => {
              if (docs.length === 0) return null
              return (
                <div key={type} className="space-y-1">
                  <div className="text-xs font-medium text-gray-500 px-1">
                    {documentTypeLabels[type] || type}
                  </div>
                  {docs.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 hover:border-border transition-colors group"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center flex-1 min-w-0">
                        <FileText className="w-3 h-3 mr-2 text-gray-400 group-hover:text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-700 truncate group-hover:text-primary" title={doc.name}>
                            {doc.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {(doc.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Download className="w-3 h-3 text-gray-400 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  ))}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// 팀원 상세 정보 모달
function TeamMemberDetailModal({ 
  member, 
  onClose 
}: { 
  member: TeamMember
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-[95vw] sm:max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-2xl font-bold">팀원 상세 정보</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <span className="sr-only">닫기</span>
            <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
          {/* 기본 정보 */}
          <div>
            <h3 className="text-lg font-medium mb-4 flex items-center">
              <User className="h-5 w-5 mr-2" />
              기본 정보
            </h3>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-500">이름 (한국어)</span>
                <p className="text-gray-900">{member.name_ko}</p>
              </div>
              {member.name_en && (
                <div>
                  <span className="text-sm font-medium text-gray-500">이름 (영어)</span>
                  <p className="text-gray-900">{member.name_en}</p>
                </div>
              )}
              {member.nick_name && (
                <div>
                  <span className="text-sm font-medium text-gray-500">닉네임</span>
                  <p className="text-gray-900">{member.nick_name}</p>
                </div>
              )}
              <div>
                <span className="text-sm font-medium text-gray-500">이메일</span>
                <p className="text-gray-900">{member.email}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">전화번호</span>
                <p className="text-gray-900">{member.phone || '미입력'}</p>
              </div>
              {member.position && (
                <div>
                  <span className="text-sm font-medium text-gray-500">직책</span>
                  <p className="text-gray-900">{member.position}</p>
                </div>
              )}
              {member.hire_date && (
                <div>
                  <span className="text-sm font-medium text-gray-500">입사일</span>
                  <p className="text-gray-900">{member.hire_date}</p>
                </div>
              )}
              {member.home_address?.trim() ? (
                <div>
                  <span className="text-sm font-medium text-gray-500">집주소</span>
                  <p className="text-gray-900 whitespace-pre-wrap">{member.home_address}</p>
                </div>
              ) : null}
            </div>
          </div>

          {/* 개인 정보 */}
          <div>
            <h3 className="text-lg font-medium mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              개인 정보
            </h3>
            <div className="space-y-3">
              {member.emergency_contact && (
                <div>
                  <span className="text-sm font-medium text-gray-500">비상 연락처</span>
                  <p className="text-gray-900">{member.emergency_contact}</p>
                </div>
              )}
              {member.date_of_birth && (
                <div>
                  <span className="text-sm font-medium text-gray-500">생년월일</span>
                  <p className="text-gray-900">{member.date_of_birth}</p>
                </div>
              )}
              {member.ssn && (
                <div>
                  <span className="text-sm font-medium text-gray-500">주민등록번호</span>
                  <p className="text-gray-900">{member.ssn}</p>
                </div>
              )}
            </div>
          </div>

          {/* 차량 정보 */}
          {(member.personal_car_model || member.car_year || member.car_plate) && (
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center">
                <Car className="h-5 w-5 mr-2" />
                차량 정보
              </h3>
              <div className="space-y-3">
                {member.personal_car_model && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">차량 모델</span>
                    <p className="text-gray-900">{member.personal_car_model}</p>
                  </div>
                )}
                {member.car_year && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">차량 연도</span>
                    <p className="text-gray-900">{member.car_year}</p>
                  </div>
                )}
                {member.car_plate && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">차량 번호판</span>
                    <p className="text-gray-900">{member.car_plate}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 자격증 정보 */}
          {(member.cpr || member.medical_report || member.cdl_driver_license) && (
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                자격증 정보
              </h3>
              <div className="space-y-3">
                {member.cdl_driver_license && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">CDL 운전면허</span>
                    <p className="text-gray-900">보유</p>
                  </div>
                )}
                {member.cpr && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">CPR 자격증</span>
                    <p className="text-gray-900">보유</p>
                    {member.cpr_acquired && (
                      <p className="text-sm text-gray-500">취득일: {member.cpr_acquired}</p>
                    )}
                    {member.cpr_expired && (
                      <p className="text-sm text-gray-500">만료일: {member.cpr_expired}</p>
                    )}
                  </div>
                )}
                {member.medical_report && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">의료 보고서</span>
                    <p className="text-gray-900">보유</p>
                    {member.medical_acquired && (
                      <p className="text-sm text-gray-500">취득일: {member.medical_acquired}</p>
                    )}
                    {member.medical_expired && (
                      <p className="text-sm text-gray-500">만료일: {member.medical_expired}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6 pt-6 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}


