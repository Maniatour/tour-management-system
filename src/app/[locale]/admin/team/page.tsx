'use client'

import React, { useState, useEffect } from 'react'
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
  Download
} from 'lucide-react'
import type { Database } from '@/lib/supabase'

type TeamMember = Database['public']['Tables']['team']['Row']
type TeamMemberInsert = Database['public']['Tables']['team']['Insert']
type TeamMemberUpdate = Database['public']['Tables']['team']['Update']

export default function AdminTeam() {
  const t = useTranslations('team')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active')
  const [sortField, setSortField] = useState<keyof TeamMember>('name_ko')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [showForm, setShowForm] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'card'>('card')
  const [memberDocuments, setMemberDocuments] = useState<{[email: string]: {[type: string]: Array<{id: string, name: string, url: string, path: string, size: number, uploadedAt: string}>}}>({})

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

  // 팀원 삭제
  const handleDeleteMember = async (email: string) => {
    if (!confirm(t('deleteConfirm'))) return

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('team')
        .delete()
        .eq('email', email)

      if (error) {
        console.error('Error deleting team member:', error)
        alert('팀원 삭제 중 오류가 발생했습니다.')
        return
      }

      alert('팀원이 성공적으로 삭제되었습니다!')
      fetchTeamMembers()
    } catch (error) {
      console.error('Error deleting team member:', error)
      alert('팀원 삭제 중 오류가 발생했습니다.')
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
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <List size={16} />
            </button>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 flex items-center gap-1.5 text-sm font-medium"
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
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
                ? 'bg-blue-600 text-white'
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
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
            /* 테이블 뷰 - 모바일 최적화 */
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('name_ko')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>{t('columns.name')}</span>
                        {sortField === 'name_ko' && (
                          <span className="text-blue-600">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="hidden sm:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('email')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>{t('columns.email')}</span>
                        {sortField === 'email' && (
                          <span className="text-blue-600">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="hidden md:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('phone')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>{t('columns.phone')}</span>
                        {sortField === 'phone' && (
                          <span className="text-blue-600">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('position')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>{t('columns.position')}</span>
                        {sortField === 'position' && (
                          <span className="text-blue-600">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    {/* 주소 컬럼 제거 - 데이터베이스에 address 컬럼이 없음 */}
                    {/* <th 
                      className="hidden lg:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('address')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>주소</span>
                        {sortField === 'address' && (
                          <span className="text-blue-600">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th> */}
                    <th 
                      className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('is_active')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>상태</span>
                        {sortField === 'is_active' && (
                          <span className="text-blue-600">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('columns.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedMembers.map((member) => (
                    <tr key={member.email} className="hover:bg-gray-50">
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10">
                            {member.avatar_url ? (
                              <img
                                className="h-8 w-8 sm:h-10 sm:w-10 rounded-full"
                                src={member.avatar_url}
                                alt={member.name_ko}
                              />
                            ) : (
                              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gray-300 flex items-center justify-center">
                                <User className="h-4 w-4 sm:h-6 sm:w-6 text-gray-600" />
                              </div>
                            )}
                          </div>
                          <div className="ml-2 sm:ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {member.name_ko}
                            </div>
                            {member.name_en && (
                              <div className="text-xs sm:text-sm text-gray-500">{member.name_en}</div>
                            )}
                            {/* 모바일에서 이메일 표시 */}
                            <div className="sm:hidden text-xs text-gray-500 truncate">
                              {member.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {member.email}
                      </td>
                      <td className="hidden md:table-cell px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {member.phone || '-'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {member.position || '-'}
                      </td>
                      {/* 주소 컬럼 제거 - 데이터베이스에 address 컬럼이 없음 */}
                      {/* <td className="hidden lg:table-cell px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {member.address || '-'}
                      </td> */}
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleToggleActive(member.email, member.is_active ?? true)}
                          className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            member.is_active 
                              ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                              : 'bg-red-100 text-red-800 hover:bg-red-200'
                          }`}
                        >
                          {member.is_active ? '활성' : '비활성'}
                        </button>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setSelectedMember(member)
                              setShowDetailModal(true)
                            }}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingMember(member)
                              setShowForm(true)
                            }}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteMember(member.email)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 size={16} />
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
                <div key={member.email} className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
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
                          <div className="flex items-center space-x-2">
                            <h3 className="text-lg font-semibold text-gray-900 truncate">
                              {member.name_ko}
                            </h3>
                            {member.languages && member.languages.length > 0 && (
                              <div className="flex space-x-1">
                                {member.languages.map((lang, index) => (
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
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 truncate">
                            {member.name_en || '영문명 없음'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleActive(member.email, member.is_active ?? true)
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                            member.is_active ? 'bg-green-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              member.is_active ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => {
                              setEditingMember(member)
                              setShowForm(true)
                            }}
                            className="p-1.5 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                            title="편집"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteMember(member.email)}
                            className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="삭제"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
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
                        <span className="font-medium text-blue-600 truncate ml-2">{member.email}</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">전화번호</span>
                        <span className="font-medium">{member.phone || '미등록'}</span>
                      </div>
                      


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

// 팀원 폼 컴포넌트
function TeamMemberForm({ 
  member, 
  onSubmit, 
  onCancel,
  onDocumentChange
}: { 
  member: TeamMember | null
  onSubmit: (data: TeamMemberInsert) => void
  onCancel: () => void
  onDocumentChange?: (email: string) => void
}) {
  // 문서 타입별 문서 목록을 관리
  type DocumentItem = {
    id: string
    name: string
    url: string
    path: string
    size: number
    uploadedAt: string
  }
  
  const [uploadedDocuments, setUploadedDocuments] = useState<{[key: string]: DocumentItem[]}>({})
  const [uploading, setUploading] = useState<{[key: string]: boolean}>({})
  
  // 컴포넌트 마운트 시 기존 문서 불러오기
  useEffect(() => {
    if (member?.email) {
      loadExistingDocuments()
    }
  }, [member?.email])

  // 기존 문서 불러오기
  const loadExistingDocuments = async () => {
    if (!member?.email) return
    
    try {
      const documentTypes = ['contract', 'id_copy', 'bank_info', 'other']
      const allDocuments: {[key: string]: DocumentItem[]} = {}
      
      for (const docType of documentTypes) {
        const prefix = `team-documents/${member.email}/${docType}/`
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
      
      setUploadedDocuments(allDocuments)
    } catch (error) {
      console.error('문서 목록 불러오기 오류:', error)
    }
  }
  
  // 문서 업로드 함수 (여러 개 업로드 가능)
  const handleDocumentUpload = async (files: FileList | null, documentType: string) => {
    if (!files || files.length === 0) return
    
    if (!member?.email) {
      alert('팀원 이메일이 필요합니다. 먼저 이메일을 입력해주세요.')
      return
    }
    
    setUploading(prev => ({ ...prev, [documentType]: true }))
    
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // 파일 크기 체크 (10MB 제한)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`파일 "${file.name}"의 크기가 너무 큽니다. 최대 10MB까지 업로드 가능합니다.`)
        }

        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `team-documents/${member.email}/${documentType}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file)

        if (uploadError) {
          throw new Error(`파일 "${file.name}" 업로드 실패: ${uploadError.message}`)
        }

        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath)

        return {
          id: `${documentType}-${fileName}`,
          name: file.name,
          url: publicUrl,
          path: filePath,
          size: file.size,
          uploadedAt: new Date().toISOString()
        }
      })
      
      const uploadedDocs = await Promise.all(uploadPromises)
      
      setUploadedDocuments(prev => ({
        ...prev,
        [documentType]: [...(prev[documentType] || []), ...uploadedDocs]
      }))
      
      // 부모 컴포넌트에 문서 변경 알림
      if (member?.email && onDocumentChange) {
        onDocumentChange(member.email)
      }
      
      alert(`${uploadedDocs.length}개의 문서가 성공적으로 업로드되었습니다!`)
    } catch (error: any) {
      console.error('문서 업로드 오류:', error)
      
      // 버킷이 없는 경우 명확한 에러 메시지
      if (error?.message?.includes('Bucket not found') || error?.message?.includes('not found')) {
        alert('문서 저장소가 설정되지 않았습니다. 관리자에게 문의해주세요.\n\n에러: ' + error.message)
      } else {
        alert('문서 업로드 중 오류가 발생했습니다.\n\n에러: ' + (error?.message || '알 수 없는 오류'))
      }
    } finally {
      setUploading(prev => ({ ...prev, [documentType]: false }))
    }
  }
  
  // 문서 삭제 함수
  const handleDocumentDelete = async (e: React.MouseEvent, documentType: string, documentId: string, filePath: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!confirm('이 문서를 삭제하시겠습니까?')) return
    
    try {
      const { error } = await supabase.storage
        .from('documents')
        .remove([filePath])
      
      if (error) {
        throw error
      }
      
      setUploadedDocuments(prev => ({
        ...prev,
        [documentType]: (prev[documentType] || []).filter(doc => doc.id !== documentId)
      }))
      
      // 부모 컴포넌트에 문서 변경 알림
      if (member?.email && onDocumentChange) {
        onDocumentChange(member.email)
      }
      
      alert('문서가 삭제되었습니다.')
    } catch (error: any) {
      console.error('문서 삭제 오류:', error)
      alert('문서 삭제 중 오류가 발생했습니다.\n\n에러: ' + (error?.message || '알 수 없는 오류'))
    }
  }
  
  // 문서 교체 함수 (수정)
  const handleDocumentReplace = async (file: File, documentType: string, oldDocumentId: string, oldFilePath: string) => {
    if (!member?.email) {
      alert('팀원 이메일이 필요합니다.')
      return
    }
    
    // 파일 크기 체크
    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기가 너무 큽니다. 최대 10MB까지 업로드 가능합니다.')
      return
    }
    
    setUploading(prev => ({ ...prev, [documentType]: true }))
    
    try {
      // 새 파일 업로드
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const newFilePath = `team-documents/${member.email}/${documentType}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(newFilePath, file)

      if (uploadError) {
        throw uploadError
      }

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(newFilePath)

      // 기존 파일 삭제
      try {
        await supabase.storage
          .from('documents')
          .remove([oldFilePath])
      } catch (deleteError) {
        console.warn('기존 파일 삭제 실패 (무시):', deleteError)
      }

      // 문서 목록 업데이트
      setUploadedDocuments(prev => ({
        ...prev,
        [documentType]: (prev[documentType] || []).map(doc => 
          doc.id === oldDocumentId 
            ? {
                id: oldDocumentId,
                name: file.name,
                url: publicUrl,
                path: newFilePath,
                size: file.size,
                uploadedAt: new Date().toISOString()
              }
            : doc
        )
      }))
      
      // 부모 컴포넌트에 문서 변경 알림
      if (member?.email && onDocumentChange) {
        onDocumentChange(member.email)
      }
      
      alert('문서가 성공적으로 교체되었습니다!')
    } catch (error: any) {
      console.error('문서 교체 오류:', error)
      alert('문서 교체 중 오류가 발생했습니다.\n\n에러: ' + (error?.message || '알 수 없는 오류'))
    } finally {
      setUploading(prev => ({ ...prev, [documentType]: false }))
    }
  }
  
  const [formData, setFormData] = useState<TeamMemberInsert>({
    email: member?.email || '',
    name_ko: member?.name_ko || '',
    name_en: member?.name_en || '',
    phone: member?.phone || '',
    position: member?.position || '',
    languages: member?.languages || ['KR'],
    avatar_url: member?.avatar_url || '',
    is_active: member?.is_active ?? true,
    hire_date: member?.hire_date || '',
    // address: member?.address || '', // 데이터베이스에 address 컬럼이 없음
    emergency_contact: member?.emergency_contact || '',
    date_of_birth: member?.date_of_birth || '',
    ssn: member?.ssn || '',
    personal_car_model: member?.personal_car_model || '',
    car_year: member?.car_year || null,
    car_plate: member?.car_plate || '',
    bank_name: member?.bank_name || '',
    account_holder: member?.account_holder || '',
    bank_number: member?.bank_number || '',
    routing_number: member?.routing_number || '',
    cpr: member?.cpr || false,
    cpr_acquired: member?.cpr_acquired || '',
    cpr_expired: member?.cpr_expired || '',
    medical_report: member?.medical_report || false,
    medical_acquired: member?.medical_acquired || '',
    medical_expired: member?.medical_expired || ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // 필수 필드 검증 (전화번호는 선택사항으로 변경)
    if (!formData.email || !formData.name_ko) {
      alert('이메일과 한국어 이름은 필수 입력 항목입니다.')
      return
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      alert('올바른 이메일 형식을 입력해주세요.')
      return
    }

    // 날짜 필드의 빈 문자열을 null로 변환
    const processedData = {
      ...formData,
      hire_date: formData.hire_date || null,
      date_of_birth: formData.date_of_birth || null,
      cpr_acquired: formData.cpr_acquired || null,
      cpr_expired: formData.cpr_expired || null,
      medical_acquired: formData.medical_acquired || null,
      medical_expired: formData.medical_expired || null,
      phone: formData.phone || null
    }

    onSubmit(processedData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {member ? '팀원 정보 수정' : '새 팀원 추가'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 기본 정보 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                한국어 이름 *
              </label>
              <input
                type="text"
                value={formData.name_ko}
                onChange={(e) => setFormData({...formData, name_ko: e.target.value})}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                영어 이름
              </label>
              <input
                type="text"
                value={formData.name_en || ''}
                onChange={(e) => setFormData({...formData, name_en: e.target.value})}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                직책
              </label>
              <select
                value={formData.position || ''}
                onChange={(e) => setFormData({...formData, position: e.target.value})}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">직책 선택</option>
                <option value="manager">매니저</option>
                <option value="admin">관리자</option>
                <option value="tour guide">투어 가이드</option>
                <option value="driver">운전기사</option>
                <option value="op">운영자</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이메일 *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value.toLowerCase()})}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                required
              />
            </div>
            
            <div>
              {/* 주소 필드 제거 - 데이터베이스에 address 컬럼이 없음 */}
              {/* <label className="block text-sm font-medium text-gray-700 mb-1">
                주소
              </label>
              <input
                type="text"
                value={formData.address || ''}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="주소를 입력하세요"
              /> */}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                전화번호
              </label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="전화번호를 입력하세요 (선택사항)"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                비상 연락처
              </label>
              <input
                type="text"
                value={formData.emergency_contact || ''}
                onChange={(e) => setFormData({...formData, emergency_contact: e.target.value})}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* 사용 언어 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              사용 언어
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'KR', label: '한국어' },
                { value: 'EN', label: '영어' },
                { value: 'JP', label: '일본어' },
                { value: 'CN', label: '중국어' },
                { value: 'ES', label: '스페인어' },
                { value: 'FR', label: '프랑스어' },
                { value: 'DE', label: '독일어' },
                { value: 'RU', label: '러시아어' }
              ].map((language) => (
                <button
                  key={language.value}
                  type="button"
                  onClick={() => {
                    const currentLanguages = formData.languages || []
                    if (currentLanguages.includes(language.value)) {
                      setFormData({
                        ...formData,
                        languages: currentLanguages.filter((lang: string) => lang !== language.value)
                      })
                    } else {
                      setFormData({
                        ...formData,
                        languages: [...currentLanguages, language.value]
                      })
                    }
                  }}
                  className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                    (formData.languages || []).includes(language.value)
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {language.label}
                </button>
              ))}
            </div>
          </div>

          {/* 개인 정보 */}
          <div className="border-t pt-4">
            <h3 className="text-base font-medium mb-3 flex items-center">
              <User className="h-4 w-4 mr-2" />
              개인 정보
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  생년월일
                </label>
                <input
                  type="date"
                  value={formData.date_of_birth || ''}
                  onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  입사일
                </label>
                <input
                  type="date"
                  value={formData.hire_date || ''}
                  onChange={(e) => setFormData({...formData, hire_date: e.target.value})}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SSN
                </label>
                <input
                  type="text"
                  value={formData.ssn || ''}
                  onChange={(e) => setFormData({...formData, ssn: e.target.value})}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>

          {/* 차량 정보 - 한 줄에 배치 */}
          <div className="border-t pt-4">
            <h3 className="text-base font-medium mb-3 flex items-center">
              <Car className="h-4 w-4 mr-2" />
              차량 정보
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  개인 차량 모델
                </label>
                <input
                  type="text"
                  value={formData.personal_car_model || ''}
                  onChange={(e) => setFormData({...formData, personal_car_model: e.target.value})}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  차량 연도
                </label>
                <input
                  type="number"
                  min="1900"
                  max="2030"
                  value={formData.car_year || ''}
                  onChange={(e) => setFormData({...formData, car_year: e.target.value ? parseInt(e.target.value) : null})}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  차량 번호판
                </label>
                <input
                  type="text"
                  value={formData.car_plate || ''}
                  onChange={(e) => setFormData({...formData, car_plate: e.target.value})}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>

          {/* 은행 정보 */}
          <div className="border-t pt-4">
            <h3 className="text-base font-medium mb-3 flex items-center">
              <CreditCard className="h-4 w-4 mr-2" />
              은행 정보
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  은행명
                </label>
                <input
                  type="text"
                  value={formData.bank_name || ''}
                  onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  예금주
                </label>
                <input
                  type="text"
                  value={formData.account_holder || ''}
                  onChange={(e) => setFormData({...formData, account_holder: e.target.value})}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  계좌번호
                </label>
                <input
                  type="text"
                  value={formData.bank_number || ''}
                  onChange={(e) => setFormData({...formData, bank_number: e.target.value})}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  라우팅 번호
                </label>
                <input
                  type="text"
                  value={formData.routing_number || ''}
                  onChange={(e) => setFormData({...formData, routing_number: e.target.value})}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>

          {/* 자격증 및 의료 정보 - 좌우로 나누어 배치 */}
          <div className="border-t pt-4">
            <h3 className="text-base font-medium mb-3 flex items-center">
              <Shield className="h-4 w-4 mr-2" />
              자격증 및 의료 정보
            </h3>
            
            {/* CPR 자격증 정보 - 좌측 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="cpr"
                    checked={formData.cpr || false}
                    onChange={(e) => setFormData({...formData, cpr: e.target.checked})}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="cpr" className="text-sm font-medium text-gray-700">
                    CPR 자격증
                  </label>
                </div>
                
                {formData.cpr && (
                  <div className="space-y-2 ml-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        CPR 취득일
                      </label>
                      <input
                        type="date"
                        value={formData.cpr_acquired || ''}
                        onChange={(e) => setFormData({...formData, cpr_acquired: e.target.value})}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        CPR 만료일
                      </label>
                      <input
                        type="date"
                        value={formData.cpr_expired || ''}
                        onChange={(e) => setFormData({...formData, cpr_expired: e.target.value})}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              {/* 의료 보고서 정보 - 우측 */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="medical_report"
                    checked={formData.medical_report || false}
                    onChange={(e) => setFormData({...formData, medical_report: e.target.checked})}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="medical_report" className="text-sm font-medium text-gray-700">
                    의료 보고서
                  </label>
                </div>
                
                {formData.medical_report && (
                  <div className="space-y-2 ml-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        의료 보고서 취득일
                      </label>
                      <input
                        type="date"
                        value={formData.medical_acquired || ''}
                        onChange={(e) => setFormData({...formData, medical_acquired: e.target.value})}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        의료 보고서 만료일
                      </label>
                      <input
                        type="date"
                        value={formData.medical_expired || ''}
                        onChange={(e) => setFormData({...formData, medical_expired: e.target.value})}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 문서 업로드 섹션 */}
          <div className="border-t pt-4">
            <h3 className="text-base font-medium mb-3 flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              문서 관리
            </h3>
            
            {/* 문서 타입별 섹션 */}
            {[
              { type: 'contract', label: '계약서', accept: '.pdf,.doc,.docx' },
              { type: 'id_copy', label: '신분증 사본', accept: '.pdf,.jpg,.jpeg,.png' },
              { type: 'bank_info', label: 'W9', accept: '.pdf,.jpg,.jpeg,.png' },
              { type: 'other', label: '기타 문서', accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png' }
            ].map(({ type, label, accept }) => (
              <div key={type} className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {label}
                  </label>
                  <span className="text-xs text-gray-500">
                    {(uploadedDocuments[type] || []).length}개 업로드됨
                  </span>
                </div>
                
                {/* 업로드 영역 */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 mb-2">
                  <input
                    type="file"
                    accept={accept}
                    multiple
                    onChange={(e) => handleDocumentUpload(e.target.files, type)}
                    className="hidden"
                    id={`${type}-upload`}
                    disabled={uploading[type]}
                  />
                  <label
                    htmlFor={`${type}-upload`}
                    className={`flex items-center justify-center cursor-pointer ${uploading[type] ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'} rounded p-2`}
                  >
                    <Plus className="w-4 h-4 mr-2 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {uploading[type] ? '업로드 중...' : '문서 추가'}
                    </span>
                  </label>
                </div>
                
                {/* 업로드된 문서 목록 */}
                {(uploadedDocuments[type] || []).length > 0 && (
                  <div className="space-y-2">
                    {uploadedDocuments[type].map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200"
                      >
                        <div className="flex items-center flex-1 min-w-0">
                          <FileText className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-700 truncate" title={doc.name}>
                              {doc.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {(doc.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-2">
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="다운로드"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <label className="p-1.5 text-green-600 hover:bg-green-50 rounded cursor-pointer" title="교체">
                            <Edit className="w-4 h-4" />
                            <input
                              type="file"
                              accept={accept}
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  handleDocumentReplace(file, type, doc.id, doc.path)
                                  e.target.value = '' // 같은 파일을 다시 선택할 수 있도록
                                }
                              }}
                              className="hidden"
                              disabled={uploading[type]}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={(e) => handleDocumentDelete(e, type, doc.id, doc.path)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            title="삭제"
                            disabled={uploading[type]}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 버튼 */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              {member ? '수정' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// 팀원 문서 컴포넌트
function TeamMemberDocuments({
  memberEmail,
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
      <div className="border-t pt-3">
        <button
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
    <div className="border-t pt-3">
      <button
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
                      className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 hover:border-blue-300 transition-colors group"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center flex-1 min-w-0">
                        <FileText className="w-3 h-3 mr-2 text-gray-400 group-hover:text-blue-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-700 truncate group-hover:text-blue-600" title={doc.name}>
                            {doc.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {(doc.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Download className="w-3 h-3 text-gray-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
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
              {/* 주소 정보 제거 - 데이터베이스에 address 컬럼이 없음 */}
              {/* {member.address && (
                <div>
                  <span className="text-sm font-medium text-gray-500">주소</span>
                  <p className="text-gray-900">{member.address}</p>
                </div>
              )} */}
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
          {(member.cpr || member.medical_report) && (
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                자격증 정보
              </h3>
              <div className="space-y-3">
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


