'use client'

import React, { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Eye,
  User,
  Mail,
  Phone,
  Calendar,
  Car,
  CreditCard,
  Shield,
  FileText
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type TeamMember = Database['public']['Tables']['team']['Row']
type TeamMemberInsert = Database['public']['Tables']['team']['Insert']
type TeamMemberUpdate = Database['public']['Tables']['team']['Update']

export default function AdminTeam() {
  const t = useTranslations('team')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)

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
      const { error } = await supabase
        .from('team')
        .insert(memberData)

      if (error) {
        console.error('Error adding team member:', error)
        alert('팀원 추가 중 오류가 발생했습니다.')
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
      const { error } = await supabase
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
      const { error } = await supabase
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

  // 컴포넌트 마운트 시 팀원 목록 불러오기
  useEffect(() => {
    fetchTeamMembers()
  }, [])

  // 검색된 팀원 목록
  const filteredMembers = teamMembers.filter(member =>
    member.name_ko.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.name_en?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.position?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
          <p className="mt-2 text-gray-600">팀원 정보를 관리하고 모니터링합니다.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>{t('addMember')}</span>
        </button>
      </div>

      {/* 검색 및 필터 */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* 팀원 목록 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">팀원 목록을 불러오는 중...</p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('columns.name')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('columns.email')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('columns.phone')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('columns.position')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('columns.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('columns.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMembers.map((member) => (
                  <tr key={member.email} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          {member.avatar_url ? (
                            <img
                              className="h-10 w-10 rounded-full"
                              src={member.avatar_url}
                              alt={member.name_ko}
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <User className="h-6 w-6 text-gray-600" />
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {member.name_ko}
                          </div>
                          {member.name_en && (
                            <div className="text-sm text-gray-500">{member.name_en}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {member.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {member.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {member.position || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(member.status || 'active')}`}>
                        {getStatusLabel(member.status || 'active')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
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
  onCancel 
}: { 
  member: TeamMember | null
  onSubmit: (data: TeamMemberInsert) => void
  onCancel: () => void
}) {
  const t = useTranslations('team')
  const [formData, setFormData] = useState<TeamMemberInsert>({
    email: member?.email || '',
    name_ko: member?.name_ko || '',
    name_en: member?.name_en || '',
    phone: member?.phone || '',
    position: member?.position || '',
    languages: member?.languages || ['ko'],
    avatar_url: member?.avatar_url || '',
    is_active: member?.is_active ?? true,
    hire_date: member?.hire_date || '',
    status: member?.status || 'active',
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
    
    // 필수 필드 검증
    if (!formData.email || !formData.name_ko || !formData.phone) {
      alert('이메일, 한국어 이름, 전화번호는 필수 입력 항목입니다.')
      return
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      alert('올바른 이메일 형식을 입력해주세요.')
      return
    }

    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {member ? '팀원 정보 수정' : '새 팀원 추가'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 기본 정보 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이메일 *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                required
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
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                상태
              </label>
              <select
                value={formData.status || 'active'}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="active">활성</option>
                <option value="inactive">비활성</option>
                <option value="vacation">휴가</option>
                <option value="terminated">퇴사</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                전화번호 *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                required
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
                { value: 'ko', label: '한국어' },
                { value: 'en', label: '영어' },
                { value: 'ja', label: '일본어' },
                { value: 'zh', label: '중국어' },
                { value: 'es', label: '스페인어' },
                { value: 'fr', label: '프랑스어' },
                { value: 'de', label: '독일어' },
                { value: 'ru', label: '러시아어' }
              ].map((language) => (
                <button
                  key={language.value}
                  type="button"
                  onClick={() => {
                    const currentLanguages = formData.languages || []
                    if (currentLanguages.includes(language.value)) {
                      setFormData({
                        ...formData,
                        languages: currentLanguages.filter(lang => lang !== language.value)
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

// 팀원 상세 정보 모달
function TeamMemberDetailModal({ 
  member, 
  onClose 
}: { 
  member: TeamMember
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">팀원 상세 정보</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <span className="sr-only">닫기</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                <p className="text-gray-900">{member.phone}</p>
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

// 헬퍼 함수들
function getStatusLabel(status: string): string {
  const statusMap: Record<string, string> = {
    'active': '활성',
    'inactive': '비활성',
    'vacation': '휴가',
    'terminated': '퇴사'
  }
  return statusMap[status] || status
}

function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    'active': 'bg-green-100 text-green-800',
    'inactive': 'bg-gray-100 text-gray-800',
    'vacation': 'bg-yellow-100 text-yellow-800',
    'terminated': 'bg-red-100 text-red-800'
  }
  return colorMap[status] || 'bg-gray-100 text-gray-800'
}
