'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Eye,
  MapPin,
  Clock,
  Users,
  Image as ImageIcon,
  Filter,
  ChevronDown,
  Star,
  Globe
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useOptimizedData } from '@/hooks/useOptimizedData'

// 타입 정의
interface TourCourse {
  id: string
  name_ko: string
  name_en: string
  description_ko?: string
  description_en?: string
  category: string
  duration_hours: number
  difficulty_level: 'easy' | 'medium' | 'hard'
  max_participants: number
  min_participants: number
  price_adult?: number
  price_child?: number
  price_infant?: number
  is_active: boolean
  created_at: string
  updated_at: string
  photos?: TourCoursePhoto[]
  maps?: TourCourseMap[]
  products?: any[]
}

interface TourCoursePhoto {
  id: string
  course_id: string
  photo_url: string
  photo_alt_ko?: string
  photo_alt_en?: string
  display_order: number
  is_primary: boolean
}

interface TourCourseMap {
  id: string
  course_id: string
  map_type: string
  map_data?: any
  map_url?: string
}

const CATEGORIES = [
  { value: 'city_tour', label: '시티 투어' },
  { value: 'nature_tour', label: '자연 투어' },
  { value: 'adventure_tour', label: '어드벤처 투어' },
  { value: 'cultural_tour', label: '문화 투어' },
  { value: 'food_tour', label: '푸드 투어' },
  { value: 'night_tour', label: '나이트 투어' }
]

const DIFFICULTY_LEVELS = [
  { value: 'easy', label: '쉬움', color: 'text-green-600' },
  { value: 'medium', label: '보통', color: 'text-yellow-600' },
  { value: 'hard', label: '어려움', color: 'text-red-600' }
]

export default function TourCoursesPage() {
  // 최적화된 투어 코스 데이터 로딩
  const { data: tourCourses = [], loading, refetch: refetchCourses } = useOptimizedData({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('tour_courses')
        .select(`
          *,
          photos:tour_course_photos(*),
          maps:tour_course_maps(*),
          products:tour_course_products(
            product:products(id, name_ko, name_en)
          )
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching tour courses:', error)
        return []
      }

      return data || []
    },
    cacheKey: 'tour-courses',
    cacheTime: 5 * 60 * 1000 // 5분 캐시
  })

  // 최적화된 상품 데이터 로딩
  const { data: products = [] } = useOptimizedData({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name_ko, name_en')
        .order('name_ko', { ascending: true })

      if (error) {
        console.error('Error fetching products:', error)
        return []
      }

      return data || []
    },
    cacheKey: 'products-for-courses',
    cacheTime: 10 * 60 * 1000 // 10분 캐시
  })

  // 상태 관리
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [difficultyFilter, setDifficultyFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingCourse, setEditingCourse] = useState<TourCourse | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<TourCourse | null>(null)
  const [formData, setFormData] = useState<Partial<TourCourse>>({
    name_ko: '',
    name_en: '',
    description_ko: '',
    description_en: '',
    category: 'city_tour',
    duration_hours: 1,
    difficulty_level: 'easy',
    max_participants: 50,
    min_participants: 1,
    price_adult: 0,
    price_child: 0,
    price_infant: 0,
    is_active: true
  })

  // 필터링된 투어 코스 목록
  const filteredCourses = (tourCourses || []).filter(course => {
    const matchesSearch = 
      course.name_ko.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.description_ko?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.description_en?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesCategory = categoryFilter === 'all' || course.category === categoryFilter
    const matchesDifficulty = difficultyFilter === 'all' || course.difficulty_level === difficultyFilter
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && course.is_active) ||
      (statusFilter === 'inactive' && !course.is_active)

    return matchesSearch && matchesCategory && matchesDifficulty && matchesStatus
  })

  // 폼 열기/닫기
  const openForm = (course?: TourCourse) => {
    if (course) {
      setEditingCourse(course)
      setFormData(course)
    } else {
      setEditingCourse(null)
      setFormData({
        name_ko: '',
        name_en: '',
        description_ko: '',
        description_en: '',
        category: 'city_tour',
        duration_hours: 1,
        difficulty_level: 'easy',
        max_participants: 50,
        min_participants: 1,
        price_adult: 0,
        price_child: 0,
        price_infant: 0,
        is_active: true
      })
    }
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingCourse(null)
  }

  // 투어 코스 저장
  const saveCourse = async () => {
    try {
      if (editingCourse) {
        // 수정
        const { error } = await supabase
          .from('tour_courses')
          .update(formData)
          .eq('id', editingCourse.id)

        if (error) throw error
        alert('투어 코스가 성공적으로 수정되었습니다!')
      } else {
        // 추가
        const { error } = await supabase
          .from('tour_courses')
          .insert([formData])

        if (error) throw error
        alert('투어 코스가 성공적으로 추가되었습니다!')
      }

      closeForm()
      refetchCourses()
    } catch (error) {
      console.error('Error saving tour course:', error)
      alert('투어 코스 저장 중 오류가 발생했습니다.')
    }
  }

  // 투어 코스 삭제
  const deleteCourse = async (courseId: string) => {
    if (!confirm('정말로 이 투어 코스를 삭제하시겠습니까?')) return

    try {
      const { error } = await supabase
        .from('tour_courses')
        .delete()
        .eq('id', courseId)

      if (error) throw error
      alert('투어 코스가 성공적으로 삭제되었습니다!')
      refetchCourses()
    } catch (error) {
      console.error('Error deleting tour course:', error)
      alert('투어 코스 삭제 중 오류가 발생했습니다.')
    }
  }

  // 상세보기
  const viewDetails = (course: TourCourse) => {
    setSelectedCourse(course)
    setShowDetailModal(true)
  }

  // 카테고리 라벨 가져오기
  const getCategoryLabel = (category: string) => {
    return CATEGORIES.find(c => c.value === category)?.label || category
  }

  // 난이도 라벨 가져오기
  const getDifficultyLabel = (difficulty: string) => {
    return DIFFICULTY_LEVELS.find(d => d.value === difficulty)?.label || difficulty
  }

  // 난이도 색상 가져오기
  const getDifficultyColor = (difficulty: string) => {
    return DIFFICULTY_LEVELS.find(d => d.value === difficulty)?.color || 'text-gray-600'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">투어 코스를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">투어 코스 관리</h1>
        <p className="text-gray-600">투어 코스를 추가, 수정, 삭제하고 관리할 수 있습니다.</p>
      </div>

      {/* 검색 및 필터 */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* 검색 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="투어 코스 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 카테고리 필터 */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">모든 카테고리</option>
            {CATEGORIES.map(category => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>

          {/* 난이도 필터 */}
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">모든 난이도</option>
            {DIFFICULTY_LEVELS.map(level => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>

          {/* 상태 필터 */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">모든 상태</option>
            <option value="active">활성</option>
            <option value="inactive">비활성</option>
          </select>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex justify-between items-center mb-6">
        <div className="text-sm text-gray-600">
          총 {filteredCourses.length}개의 투어 코스
        </div>
        <button
          onClick={() => openForm()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          투어 코스 추가
        </button>
      </div>

      {/* 투어 코스 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCourses.map((course) => (
          <div key={course.id} className="bg-white rounded-lg shadow-sm border overflow-hidden">
            {/* 이미지 */}
            <div className="h-48 bg-gray-200 relative">
              {course.photos && course.photos.length > 0 ? (
                <img
                  src={course.photos.find(p => p.is_primary)?.photo_url || course.photos[0].photo_url}
                  alt={course.name_ko}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <ImageIcon className="h-12 w-12" />
                </div>
              )}
              <div className="absolute top-2 right-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  course.is_active 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {course.is_active ? '활성' : '비활성'}
                </span>
              </div>
            </div>

            {/* 내용 */}
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">
                  {course.name_ko}
                </h3>
                <div className="flex gap-1">
                  <button
                    onClick={() => viewDetails(course)}
                    className="p-1 text-gray-400 hover:text-blue-600"
                    title="상세보기"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => openForm(course)}
                    className="p-1 text-gray-400 hover:text-green-600"
                    title="수정"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteCourse(course.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {course.description_ko || course.description_en || '설명이 없습니다.'}
              </p>

              {/* 메타 정보 */}
              <div className="space-y-2">
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Globe className="h-4 w-4" />
                    <span>{getCategoryLabel(course.category)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{course.duration_hours}시간</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{course.min_participants}-{course.max_participants}명</span>
                  </div>
                  <div className={`flex items-center gap-1 ${getDifficultyColor(course.difficulty_level)}`}>
                    <Star className="h-4 w-4" />
                    <span>{getDifficultyLabel(course.difficulty_level)}</span>
                  </div>
                </div>

                {/* 가격 정보 */}
                {course.price_adult && (
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">성인: ${course.price_adult}</span>
                    {course.price_child && <span className="ml-2">어린이: ${course.price_child}</span>}
                    {course.price_infant && <span className="ml-2">유아: ${course.price_infant}</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 빈 상태 */}
      {filteredCourses.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Globe className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">투어 코스가 없습니다</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || categoryFilter !== 'all' || difficultyFilter !== 'all' || statusFilter !== 'all'
              ? '검색 조건에 맞는 투어 코스가 없습니다.'
              : '새로운 투어 코스를 추가해보세요.'
            }
          </p>
          {(!searchTerm && categoryFilter === 'all' && difficultyFilter === 'all' && statusFilter === 'all') && (
            <button
              onClick={() => openForm()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              첫 번째 투어 코스 추가
            </button>
          )}
        </div>
      )}

      {/* 폼 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">
                {editingCourse ? '투어 코스 수정' : '투어 코스 추가'}
              </h2>

              <div className="space-y-4">
                {/* 기본 정보 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      한국어 이름 *
                    </label>
                    <input
                      type="text"
                      value={formData.name_ko || ''}
                      onChange={(e) => setFormData({ ...formData, name_ko: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      영어 이름 *
                    </label>
                    <input
                      type="text"
                      value={formData.name_en || ''}
                      onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      카테고리 *
                    </label>
                    <select
                      value={formData.category || 'city_tour'}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {CATEGORIES.map(category => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      난이도 *
                    </label>
                    <select
                      value={formData.difficulty_level || 'easy'}
                      onChange={(e) => setFormData({ ...formData, difficulty_level: e.target.value as 'easy' | 'medium' | 'hard' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {DIFFICULTY_LEVELS.map(level => (
                        <option key={level.value} value={level.value}>
                          {level.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      진행시간 (시간) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.duration_hours || 1}
                      onChange={(e) => setFormData({ ...formData, duration_hours: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      최소 인원 *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.min_participants || 1}
                      onChange={(e) => setFormData({ ...formData, min_participants: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      최대 인원 *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.max_participants || 50}
                      onChange={(e) => setFormData({ ...formData, max_participants: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                {/* 설명 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    한국어 설명
                  </label>
                  <textarea
                    value={formData.description_ko || ''}
                    onChange={(e) => setFormData({ ...formData, description_ko: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    영어 설명
                  </label>
                  <textarea
                    value={formData.description_en || ''}
                    onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* 가격 정보 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      성인 가격 ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price_adult || 0}
                      onChange={(e) => setFormData({ ...formData, price_adult: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      어린이 가격 ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price_child || 0}
                      onChange={(e) => setFormData({ ...formData, price_child: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      유아 가격 ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price_infant || 0}
                      onChange={(e) => setFormData({ ...formData, price_infant: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* 상태 */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active || false}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                    활성 상태
                  </label>
                </div>
              </div>

              {/* 버튼 */}
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={closeForm}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  취소
                </button>
                <button
                  onClick={saveCourse}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingCourse ? '수정' : '추가'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 상세보기 모달 */}
      {showDetailModal && selectedCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  {selectedCourse.name_ko}
                </h2>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 기본 정보 */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">기본 정보</h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">한국어 이름:</span> {selectedCourse.name_ko}</div>
                      <div><span className="font-medium">영어 이름:</span> {selectedCourse.name_en}</div>
                      <div><span className="font-medium">카테고리:</span> {getCategoryLabel(selectedCourse.category)}</div>
                      <div><span className="font-medium">난이도:</span> 
                        <span className={`ml-1 ${getDifficultyColor(selectedCourse.difficulty_level)}`}>
                          {getDifficultyLabel(selectedCourse.difficulty_level)}
                        </span>
                      </div>
                      <div><span className="font-medium">진행시간:</span> {selectedCourse.duration_hours}시간</div>
                      <div><span className="font-medium">인원:</span> {selectedCourse.min_participants}-{selectedCourse.max_participants}명</div>
                      <div><span className="font-medium">상태:</span> 
                        <span className={`ml-1 ${selectedCourse.is_active ? 'text-green-600' : 'text-red-600'}`}>
                          {selectedCourse.is_active ? '활성' : '비활성'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 설명 */}
                  <div>
                    <h3 className="text-lg font-semibold mb-2">설명</h3>
                    <div className="space-y-2 text-sm">
                      {selectedCourse.description_ko && (
                        <div>
                          <span className="font-medium">한국어:</span>
                          <p className="mt-1 text-gray-600">{selectedCourse.description_ko}</p>
                        </div>
                      )}
                      {selectedCourse.description_en && (
                        <div>
                          <span className="font-medium">영어:</span>
                          <p className="mt-1 text-gray-600">{selectedCourse.description_en}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 가격 정보 */}
                  {(selectedCourse.price_adult || selectedCourse.price_child || selectedCourse.price_infant) && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">가격 정보</h3>
                      <div className="space-y-1 text-sm">
                        {selectedCourse.price_adult && (
                          <div><span className="font-medium">성인:</span> ${selectedCourse.price_adult}</div>
                        )}
                        {selectedCourse.price_child && (
                          <div><span className="font-medium">어린이:</span> ${selectedCourse.price_child}</div>
                        )}
                        {selectedCourse.price_infant && (
                          <div><span className="font-medium">유아:</span> ${selectedCourse.price_infant}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 사진 */}
                <div>
                  <h3 className="text-lg font-semibold mb-2">사진</h3>
                  {selectedCourse.photos && selectedCourse.photos.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {selectedCourse.photos.map((photo) => (
                        <img
                          key={photo.id}
                          src={photo.photo_url}
                          alt={photo.photo_alt_ko || selectedCourse.name_ko}
                          className="w-full h-24 object-cover rounded-lg"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                      <p>등록된 사진이 없습니다</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 연결된 상품 */}
              {selectedCourse.products && selectedCourse.products.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-2">연결된 상품</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedCourse.products.map((product) => (
                      <div key={product.id} className="bg-gray-50 p-3 rounded-lg">
                        <div className="font-medium">{product.product?.name_ko}</div>
                        <div className="text-sm text-gray-600">{product.product?.name_en}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
