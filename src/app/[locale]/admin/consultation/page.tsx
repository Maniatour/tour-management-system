'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { 
  Plus, 
  Search, 
  Filter, 
  Star, 
  StarOff, 
  Eye, 
  EyeOff, 
  Edit, 
  Trash2, 
  Copy, 
  MessageCircle,
  HelpCircle,
  Calendar,
  DollarSign,
  Map,
  FileText,
  Users,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  Tag,
  Globe,
  Clock
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useOptimizedData } from '@/hooks/useOptimizedData'
import type { 
  ConsultationCategory, 
  ConsultationTemplateWithRelations, 
  ConsultationLogWithRelations,
  TemplateType,
  Language
} from '@/types/consultation'

export default function ConsultationManagementPage() {
  const { locale } = useParams()
  const [activeTab, setActiveTab] = useState<'templates' | 'logs' | 'stats'>('templates')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [expandedProductCategories, setExpandedProductCategories] = useState<string[]>([])
  const [expandedChannelTypes, setExpandedChannelTypes] = useState<string[]>([])
  const [showInactive, setShowInactive] = useState(false)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  // 언어 선택 제거 - 한 페이지에 한국어/영어 동시 표시
  
  // 모달 상태
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ConsultationTemplateWithRelations | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<ConsultationTemplateWithRelations | null>(null)

  // 데이터 로딩
  const { data: categories, loading: categoriesLoading, refetch: refetchCategories } = useOptimizedData<ConsultationCategory>({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('consultation_categories')
        .select('id, name_ko, name_en, description_ko, description_en, icon, color, sort_order, is_active, created_at, updated_at')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      
      if (error) throw error
      return data || []
    },
    cacheKey: 'consultation_categories',
    dependencies: []
  })

  const { data: templates, loading: templatesLoading, refetch: refetchTemplates } = useOptimizedData<ConsultationTemplateWithRelations>({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('consultation_templates')
        .select(`
          id, category_id, product_id, channel_id, question_ko, question_en, answer_ko, answer_en,
          template_type, priority, is_active, is_favorite, usage_count, last_used_at, tags,
          created_by, updated_by, created_at, updated_at,
          category:consultation_categories(id, name_ko, name_en, icon, color),
          product:products(id, name, name_ko, name_en),
          channel:channels(id, name)
        `)
        .order('priority', { ascending: false })
      
      if (error) throw error
      return data || []
    },
    cacheKey: 'consultation_templates',
    dependencies: []
  })

  const { data: products } = useOptimizedData({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, name_ko, name_en, category, sub_category')
        .eq('status', 'active')
        .order('category', { ascending: true })
        .order('sub_category', { ascending: true })
        .order('name_ko', { ascending: true })
      
      if (error) throw error
      return data || []
    },
    cacheKey: 'products_active',
    dependencies: []
  })

  const { data: channels } = useOptimizedData({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('channels')
        .select('id, name, type')
        .eq('status', 'active')
        .order('type', { ascending: true })
        .order('name', { ascending: true })
      
      if (error) throw error
      return data || []
    },
    cacheKey: 'channels_active',
    dependencies: []
  })

  // 상품 그룹화 함수
  const groupedProducts = products?.reduce((acc, product) => {
    const category = product.category || '기타'
    const subCategory = product.sub_category || '기타'
    
    if (!acc[category]) {
      acc[category] = {}
    }
    if (!acc[category][subCategory]) {
      acc[category][subCategory] = []
    }
    acc[category][subCategory].push(product)
    return acc
  }, {} as Record<string, Record<string, any[]>>) || {}

  // 채널 그룹화 함수
  const groupedChannels = channels?.reduce((acc, channel) => {
    const type = channel.type || '기타'
    if (!acc[type]) {
      acc[type] = []
    }
    acc[type].push(channel)
    return acc
  }, {} as Record<string, any[]>) || {}

  // 필터링된 템플릿
  const filteredTemplates = templates?.filter(template => {
    if (!showInactive && !template.is_active) return false
    if (showFavoritesOnly && !template.is_favorite) return false
    if (selectedCategory !== 'all' && template.category_id !== selectedCategory) return false
    
    // 다중 상품 필터
    if (selectedProducts.length > 0) {
      if (!template.product_id || !selectedProducts.includes(template.product_id)) return false
    }
    
    // 다중 채널 필터
    if (selectedChannels.length > 0) {
      if (!template.channel_id || !selectedChannels.includes(template.channel_id)) return false
    }
    
    const searchLower = searchTerm.toLowerCase()
    // 한국어와 영어 모두 검색 대상에 포함
    const questionKo = template.question_ko.toLowerCase()
    const questionEn = template.question_en.toLowerCase()
    const answerKo = template.answer_ko.toLowerCase()
    const answerEn = template.answer_en.toLowerCase()
    
    return questionKo.includes(searchLower) || 
           questionEn.includes(searchLower) ||
           answerKo.includes(searchLower) ||
           answerEn.includes(searchLower) ||
           template.tags?.some(tag => tag.toLowerCase().includes(searchLower))
  }) || []

  // 템플릿 복사 함수 (한국어 버전)
  const copyTemplateKo = useCallback(async (template: ConsultationTemplateWithRelations) => {
    try {
      await navigator.clipboard.writeText(template.answer_ko)
      
      // 사용 횟수 증가
      await supabase.rpc('increment_template_usage', { template_id: template.id })
      
      // 템플릿 목록 새로고침
      refetchTemplates()
      
      // 성공 알림
      const toast = document.createElement('div')
      toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
      toast.textContent = '한국어 템플릿이 클립보드에 복사되었습니다!'
      document.body.appendChild(toast)
      setTimeout(() => document.body.removeChild(toast), 3000)
    } catch (error) {
      console.error('복사 실패:', error)
    }
  }, [refetchTemplates])

  // 템플릿 복사 함수 (영어 버전)
  const copyTemplateEn = useCallback(async (template: ConsultationTemplateWithRelations) => {
    try {
      await navigator.clipboard.writeText(template.answer_en)
      
      // 사용 횟수 증가
      await supabase.rpc('increment_template_usage', { template_id: template.id })
      
      // 템플릿 목록 새로고침
      refetchTemplates()
      
      // 성공 알림
      const toast = document.createElement('div')
      toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
      toast.textContent = 'English template copied to clipboard!'
      document.body.appendChild(toast)
      setTimeout(() => document.body.removeChild(toast), 3000)
    } catch (error) {
      console.error('복사 실패:', error)
    }
  }, [refetchTemplates])

  // 템플릿 즐겨찾기 토글
  const toggleFavorite = useCallback(async (template: ConsultationTemplateWithRelations) => {
    try {
      const { error } = await supabase
        .from('consultation_templates')
        .update({ is_favorite: !template.is_favorite })
        .eq('id', template.id)
      
      if (error) throw error
      
      refetchTemplates()
    } catch (error) {
      console.error('즐겨찾기 업데이트 실패:', error)
    }
  }, [refetchTemplates])

  // 템플릿 활성화/비활성화 토글
  const toggleActive = useCallback(async (template: ConsultationTemplateWithRelations) => {
    try {
      const { error } = await supabase
        .from('consultation_templates')
        .update({ is_active: !template.is_active })
        .eq('id', template.id)
      
      if (error) throw error
      
      refetchTemplates()
    } catch (error) {
      console.error('활성화 상태 업데이트 실패:', error)
    }
  }, [refetchTemplates])

  // 템플릿 삭제
  const deleteTemplate = useCallback(async () => {
    if (!templateToDelete) return
    
    try {
      const { error } = await supabase
        .from('consultation_templates')
        .delete()
        .eq('id', templateToDelete.id)
      
      if (error) throw error
      
      setShowDeleteModal(false)
      setTemplateToDelete(null)
      refetchTemplates()
    } catch (error) {
      console.error('템플릿 삭제 실패:', error)
    }
  }, [templateToDelete, refetchTemplates])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">상담 관리</h1>
            <p className="text-gray-600">FAQ 템플릿과 상담 안내를 관리하세요</p>
          </div>
          <button
            onClick={() => setShowTemplateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus size={20} />
            새 템플릿 추가
          </button>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'templates', name: '템플릿 관리', icon: MessageCircle },
              { id: 'logs', name: '상담 로그', icon: Clock },
              { id: 'stats', name: '통계', icon: BarChart3 }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon size={16} />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* 템플릿 관리 탭 */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          {/* 필터 및 검색 */}
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="space-y-4 mb-4">
              {/* 검색 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="템플릿 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

               {/* 카테고리 탭 */}
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-3">카테고리</label>
                 <div className="flex flex-wrap gap-2">
                   <button
                     onClick={() => setSelectedCategory('all')}
                     className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                       selectedCategory === 'all'
                         ? 'bg-gray-800 text-white shadow-md'
                         : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
                     }`}
                   >
                     모든 카테고리
                   </button>
                   {categories?.map(category => (
                     <button
                       key={category.id}
                       onClick={() => setSelectedCategory(category.id)}
                       className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                         selectedCategory === category.id
                           ? 'text-white shadow-md'
                           : 'text-gray-700 hover:shadow-sm'
                       }`}
                       style={{
                         backgroundColor: selectedCategory === category.id ? category.color : '#f3f4f6',
                         borderColor: selectedCategory === category.id ? category.color : 'transparent'
                       }}
                     >
                       <div 
                         className="w-2 h-2 rounded-full"
                         style={{ backgroundColor: selectedCategory === category.id ? 'white' : category.color }}
                       />
                       {category.name_ko}
                     </button>
                   ))}
                 </div>
               </div>

               {/* 상품 그룹화 선택 */}
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-3">상품 선택</label>
                 
                 {/* 카테고리 탭 */}
                 <div className="mb-3">
                   <div className="flex flex-wrap gap-2">
                     <button
                       onClick={() => setExpandedProductCategories([])}
                       className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                         expandedProductCategories.length === 0
                           ? 'bg-gray-800 text-white shadow-md'
                           : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
                       }`}
                     >
                       모든 카테고리
                     </button>
                     {Object.keys(groupedProducts).map(category => (
                       <button
                         key={category}
                         onClick={() => {
                           if (expandedProductCategories.includes(category)) {
                             setExpandedProductCategories(expandedProductCategories.filter(c => c !== category))
                           } else {
                             setExpandedProductCategories([...expandedProductCategories, category])
                           }
                         }}
                         className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                           expandedProductCategories.includes(category)
                             ? 'bg-blue-500 text-white shadow-md'
                             : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
                         }`}
                       >
                         {category}
                       </button>
                     ))}
                   </div>
                 </div>

                 {/* 서브카테고리 탭 */}
                 {expandedProductCategories.length > 0 && (
                   <div className="mb-3">
                     <div className="flex flex-wrap gap-2">
                       {expandedProductCategories.map(category => 
                         Object.keys(groupedProducts[category] || {}).map(subCategory => (
                           <button
                             key={`${category}-${subCategory}`}
                             onClick={() => {
                               const categoryProducts = groupedProducts[category]?.[subCategory] || []
                               const allSelected = categoryProducts.every(product => selectedProducts.includes(product.id))
                               
                               if (allSelected) {
                                 // 모든 상품이 선택되어 있으면 해제
                                 setSelectedProducts(selectedProducts.filter(id => 
                                   !categoryProducts.some(product => product.id === id)
                                 ))
                               } else {
                                 // 일부 또는 아무것도 선택되지 않았으면 모두 선택
                                 const newSelections = categoryProducts
                                   .filter(product => !selectedProducts.includes(product.id))
                                   .map(product => product.id)
                                 setSelectedProducts([...selectedProducts, ...newSelections])
                               }
                             }}
                             className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                               groupedProducts[category]?.[subCategory]?.every(product => selectedProducts.includes(product.id))
                                 ? 'bg-blue-400 text-white shadow-md'
                                 : groupedProducts[category]?.[subCategory]?.some(product => selectedProducts.includes(product.id))
                                 ? 'bg-blue-200 text-blue-800 shadow-sm'
                                 : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
                             }`}
                           >
                             {subCategory}
                           </button>
                         ))
                       )}
                     </div>
                   </div>
                 )}

                 {/* 개별 상품 선택 */}
                 {expandedProductCategories.length > 0 && (
                   <>
                     <div className="border-t border-gray-200 my-3"></div>
                     <div className="flex flex-wrap gap-1">
                       {expandedProductCategories.map(category => 
                         Object.values(groupedProducts[category] || {}).flat().map(product => (
                           <button
                             key={product.id}
                             onClick={() => {
                               if (selectedProducts.includes(product.id)) {
                                 setSelectedProducts(selectedProducts.filter(id => id !== product.id))
                               } else {
                                 setSelectedProducts([...selectedProducts, product.id])
                               }
                             }}
                             className={`px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                               selectedProducts.includes(product.id)
                                 ? 'bg-blue-500 text-white shadow-md'
                                 : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
                             }`}
                           >
                             {product.name_ko}
                           </button>
                         ))
                       )}
                     </div>
                   </>
                 )}

                 {selectedProducts.length > 0 && (
                   <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                     <div className="text-xs text-blue-700 font-medium">
                       선택됨: {selectedProducts.length}개 상품
                     </div>
                   </div>
                 )}
               </div>

               {/* 채널 그룹화 선택 */}
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-3">채널 선택</label>
                 
                 {/* 채널 타입 탭 */}
                 <div className="mb-3">
                   <div className="flex flex-wrap gap-2">
                     <button
                       onClick={() => setExpandedChannelTypes([])}
                       className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                         expandedChannelTypes.length === 0
                           ? 'bg-gray-800 text-white shadow-md'
                           : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
                       }`}
                     >
                       모든 타입
                     </button>
                     {Object.keys(groupedChannels).map(type => (
                       <button
                         key={type}
                         onClick={() => {
                           if (expandedChannelTypes.includes(type)) {
                             setExpandedChannelTypes(expandedChannelTypes.filter(t => t !== type))
                           } else {
                             setExpandedChannelTypes([...expandedChannelTypes, type])
                           }
                         }}
                         className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                           expandedChannelTypes.includes(type)
                             ? 'bg-green-500 text-white shadow-md'
                             : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
                         }`}
                       >
                         {type}
                       </button>
                     ))}
                   </div>
                 </div>

                 {/* 개별 채널 선택 */}
                 {expandedChannelTypes.length > 0 && (
                   <>
                     <div className="border-t border-gray-200 my-3"></div>
                     <div className="flex flex-wrap gap-1">
                       {expandedChannelTypes.map(type => 
                         groupedChannels[type]?.map(channel => (
                           <button
                             key={channel.id}
                             onClick={() => {
                               if (selectedChannels.includes(channel.id)) {
                                 setSelectedChannels(selectedChannels.filter(id => id !== channel.id))
                               } else {
                                 setSelectedChannels([...selectedChannels, channel.id])
                               }
                             }}
                             className={`px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                               selectedChannels.includes(channel.id)
                                 ? 'bg-green-500 text-white shadow-md'
                                 : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
                             }`}
                           >
                             {channel.name}
                           </button>
                         ))
                       )}
                     </div>
                   </>
                 )}

                 {selectedChannels.length > 0 && (
                   <div className="mt-3 p-2 bg-green-50 rounded-lg">
                     <div className="text-xs text-green-700 font-medium">
                       선택됨: {selectedChannels.length}개 채널
                     </div>
                   </div>
                 )}
               </div>
            </div>

            <div className="flex items-center gap-4">
              {/* 토글 옵션 */}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="rounded"
                />
                비활성화된 항목 표시
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showFavoritesOnly}
                  onChange={(e) => setShowFavoritesOnly(e.target.checked)}
                  className="rounded"
                />
                즐겨찾기만 표시
              </label>
            </div>
          </div>

          {/* 템플릿 목록 */}
          <div className="space-y-4">
            {filteredTemplates.map(template => (
              <div
                key={template.id}
                className={`bg-white p-6 rounded-lg shadow-sm border ${
                  !template.is_active ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {/* 카테고리 아이콘 */}
                    {template.category && (
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                        style={{ backgroundColor: template.category.color }}
                      >
                        <HelpCircle size={16} />
                      </div>
                    )}
                    
                    <div className="flex-1">
                      {/* 제목줄 */}
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900 text-base">
                          {template.category?.name_ko || '카테고리 없음'}
                        </h3>
                        {template.is_favorite && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                            ⭐ 즐겨찾기
                          </span>
                        )}
                        {!template.is_active && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                            비활성
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        {template.product && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                            {template.product.name_ko}
                          </span>
                        )}
                        {template.channel && (
                          <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full">
                            {template.channel.name}
                          </span>
                        )}
                        {!template.product && !template.channel && (
                          <span className="text-gray-400">상품/채널 미선택</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* 즐겨찾기 버튼 */}
                    <button
                      onClick={() => toggleFavorite(template)}
                      className={`p-2 rounded-lg hover:bg-gray-100 ${
                        template.is_favorite ? 'text-yellow-500' : 'text-gray-400'
                      }`}
                    >
                      {template.is_favorite ? <Star size={16} /> : <StarOff size={16} />}
                    </button>

                    {/* 활성화/비활성화 버튼 */}
                    <button
                      onClick={() => toggleActive(template)}
                      className={`p-2 rounded-lg hover:bg-gray-100 ${
                        template.is_active ? 'text-green-500' : 'text-gray-400'
                      }`}
                    >
                      {template.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>

                    {/* 복사 버튼들 */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => copyTemplateKo(template)}
                        className="p-2 rounded-lg hover:bg-gray-100 text-blue-500"
                        title="한국어 답변 복사"
                      >
                        <Copy size={16} />
                      </button>
                      <span className="text-xs text-gray-400">KO</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => copyTemplateEn(template)}
                        className="p-2 rounded-lg hover:bg-gray-100 text-green-500"
                        title="English answer copy"
                      >
                        <Copy size={16} />
                      </button>
                      <span className="text-xs text-gray-400">EN</span>
                    </div>

                    {/* 편집 버튼 */}
                    <button
                      onClick={() => {
                        setEditingTemplate(template)
                        setShowTemplateModal(true)
                      }}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                    >
                      <Edit size={16} />
                    </button>

                    {/* 삭제 버튼 */}
                    <button
                      onClick={() => {
                        setTemplateToDelete(template)
                        setShowDeleteModal(true)
                      }}
                      className="p-2 rounded-lg hover:bg-gray-100 text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* 질문을 좌우로 배치 */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* 한국어 질문 */}
                  <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                    {template.question_ko || '질문이 없습니다.'}
                  </div>
                  {/* 영어 질문 */}
                  <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                    {template.question_en || 'No question available.'}
                  </div>
                </div>

                {/* 답변 내용 - 좌우 배치 */}
                <div className="grid grid-cols-2 gap-4">
                  {/* 한국어 답변 */}
                  <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border-l-4 border-blue-400">
                    {template.answer_ko || '답변이 없습니다.'}
                  </div>

                  {/* 영어 답변 */}
                  <div className="text-sm text-gray-600 bg-green-50 p-3 rounded-lg border-l-4 border-green-400">
                    {template.answer_en || 'No answer available.'}
                  </div>
                </div>

                {/* 태그 */}
                {template.tags && template.tags.length > 0 && (
                  <div className="flex items-center gap-2 mt-3">
                    <Tag size={14} className="text-gray-400" />
                    <div className="flex gap-1">
                      {template.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {filteredTemplates.length === 0 && (
              <div className="text-center py-12">
                <MessageCircle size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">템플릿이 없습니다</h3>
                <p className="text-gray-500 mb-4">새로운 상담 템플릿을 추가해보세요.</p>
                <button
                  onClick={() => setShowTemplateModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  첫 번째 템플릿 추가
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 상담 로그 탭 */}
      {activeTab === 'logs' && (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold mb-4">상담 로그</h2>
          <p className="text-gray-500">상담 기록을 확인할 수 있습니다.</p>
          {/* 상담 로그 구현 예정 */}
        </div>
      )}

      {/* 통계 탭 */}
      {activeTab === 'stats' && (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold mb-4">상담 통계</h2>
          <p className="text-gray-500">상담 통계를 확인할 수 있습니다.</p>
          {/* 통계 구현 예정 */}
        </div>
      )}

      {/* 템플릿 추가/편집 모달 */}
      {showTemplateModal && (
        <TemplateModal
          template={editingTemplate}
          categories={categories || []}
          products={products || []}
          channels={channels || []}
          onClose={() => {
            setShowTemplateModal(false)
            setEditingTemplate(null)
          }}
          onSave={() => {
            refetchTemplates()
            setShowTemplateModal(false)
            setEditingTemplate(null)
          }}
        />
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteModal && templateToDelete && (
        <DeleteModal
          template={templateToDelete}
          onClose={() => {
            setShowDeleteModal(false)
            setTemplateToDelete(null)
          }}
          onConfirm={deleteTemplate}
        />
      )}
    </div>
  )
}

// 템플릿 모달 컴포넌트
function TemplateModal({ 
  template, 
  categories, 
  products, 
  channels, 
  onClose, 
  onSave 
}: {
  template?: ConsultationTemplateWithRelations | null
  categories: ConsultationCategory[]
  products: any[]
  channels: any[]
  onClose: () => void
  onSave: () => void
}) {
  const [formData, setFormData] = useState({
    category_id: template?.category_id || '',
    product_ids: template?.product_id ? [template.product_id] : [],
    channel_ids: template?.channel_id ? [template.channel_id] : [],
    question_ko: template?.question_ko || '',
    question_en: template?.question_en || '',
    answer_ko: template?.answer_ko || '',
    answer_en: template?.answer_en || '',
    template_type: template?.template_type || 'faq',
    tags: template?.tags?.join(', ') || '',
    is_active: template?.is_active ?? true,
    is_favorite: template?.is_favorite ?? false
  })

  const [expandedModalProductCategories, setExpandedModalProductCategories] = useState<string[]>([])
  const [expandedModalChannelTypes, setExpandedModalChannelTypes] = useState<string[]>([])

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // 다중 선택된 상품과 채널을 처리
      const submitData = {
        category_id: formData.category_id || null,
        product_id: formData.product_ids.length === 1 ? formData.product_ids[0] : null,
        channel_id: formData.channel_ids.length === 1 ? formData.channel_ids[0] : null,
        question_ko: formData.question_ko,
        question_en: formData.question_en,
        answer_ko: formData.answer_ko,
        answer_en: formData.answer_en,
        template_type: formData.template_type,
        tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
        is_active: formData.is_active,
        is_favorite: formData.is_favorite
      }

      if (template) {
        // 편집
        const { error } = await supabase
          .from('consultation_templates')
          .update(submitData)
          .eq('id', template.id)
        
        if (error) throw error
      } else {
        // 새로 추가 - 다중 선택된 경우 각각의 조합으로 템플릿 생성
        if (formData.product_ids.length > 1 || formData.channel_ids.length > 1) {
          // 다중 선택된 경우 각 조합으로 템플릿 생성
          const combinations = []
          const products = formData.product_ids.length > 0 ? formData.product_ids : [null]
          const channels = formData.channel_ids.length > 0 ? formData.channel_ids : [null]
          
          for (const productId of products) {
            for (const channelId of channels) {
              combinations.push({
                ...submitData,
                product_id: productId,
                channel_id: channelId
              })
            }
          }
          
          const { error } = await supabase
            .from('consultation_templates')
            .insert(combinations)
          
          if (error) throw error
        } else {
          // 단일 선택된 경우
          const { error } = await supabase
            .from('consultation_templates')
            .insert(submitData)
          
          if (error) throw error
        }
      }

      onSave()
    } catch (error) {
      console.error('템플릿 저장 실패:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            {template ? '템플릿 편집' : '새 템플릿 추가'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
             {/* 카테고리 탭 */}
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-3">카테고리</label>
               <div className="flex flex-wrap gap-2">
                 <button
                   onClick={() => setFormData({ ...formData, category_id: '' })}
                   className={`px-3 py-2 rounded-full text-xs font-medium transition-all duration-200 ${
                     !formData.category_id
                       ? 'bg-gray-800 text-white shadow-md'
                       : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
                   }`}
                 >
                   카테고리 선택 안함
                 </button>
                 {categories.map(category => (
                   <button
                     key={category.id}
                     onClick={() => setFormData({ ...formData, category_id: category.id })}
                     className={`px-3 py-2 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-2 ${
                       formData.category_id === category.id
                         ? 'text-white shadow-md'
                         : 'text-gray-700 hover:shadow-sm'
                     }`}
                     style={{
                       backgroundColor: formData.category_id === category.id ? category.color : '#f3f4f6',
                       borderColor: formData.category_id === category.id ? category.color : 'transparent'
                     }}
                   >
                     <div 
                       className="w-1.5 h-1.5 rounded-full"
                       style={{ backgroundColor: formData.category_id === category.id ? 'white' : category.color }}
                     />
                     {category.name_ko}
                   </button>
                 ))}
               </div>
             </div>

             {/* 상품 및 채널 그룹화 선택 */}
             <div className="space-y-6">
               {/* 상품 그룹화 선택 */}
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-3">상품 선택</label>
                 
                 {/* 카테고리 탭 */}
                 <div className="mb-3">
                   <div className="flex flex-wrap gap-2">
                     <button
                       onClick={() => setExpandedModalProductCategories([])}
                       className={`px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                         expandedModalProductCategories.length === 0
                           ? 'bg-gray-800 text-white shadow-md'
                           : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
                       }`}
                     >
                       모든 카테고리
                     </button>
                     {Object.keys(
                       products.reduce((acc, product) => {
                         const category = product.category || '기타'
                         if (!acc[category]) {
                           acc[category] = {}
                         }
                         return acc
                       }, {} as Record<string, any>)
                     ).map(category => (
                       <button
                         key={category}
                         onClick={() => {
                           if (expandedModalProductCategories.includes(category)) {
                             setExpandedModalProductCategories(expandedModalProductCategories.filter(c => c !== category))
                           } else {
                             setExpandedModalProductCategories([...expandedModalProductCategories, category])
                           }
                         }}
                         className={`px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                           expandedModalProductCategories.includes(category)
                             ? 'bg-blue-500 text-white shadow-md'
                             : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
                         }`}
                       >
                         {category}
                       </button>
                     ))}
                   </div>
                 </div>

                 {/* 서브카테고리 탭 */}
                 {expandedModalProductCategories.length > 0 && (
                   <div className="mb-3">
                     <div className="flex flex-wrap gap-2">
                       {expandedModalProductCategories.map(category => 
                         Object.keys(
                           products.reduce((acc, product) => {
                             if (product.category === category) {
                               const subCategory = product.sub_category || '기타'
                               if (!acc[subCategory]) {
                                 acc[subCategory] = []
                               }
                               acc[subCategory].push(product)
                             }
                             return acc
                           }, {} as Record<string, any[]>)
                         ).map(subCategory => (
                           <button
                             key={`${category}-${subCategory}`}
                             onClick={() => {
                               const categoryProducts = products.filter(p => 
                                 p.category === category && (p.sub_category || '기타') === subCategory
                               )
                               const allSelected = categoryProducts.every(product => formData.product_ids.includes(product.id))
                               
                               if (allSelected) {
                                 setFormData({ 
                                   ...formData, 
                                   product_ids: formData.product_ids.filter(id => 
                                     !categoryProducts.some(product => product.id === id)
                                   )
                                 })
                               } else {
                                 const newSelections = categoryProducts
                                   .filter(product => !formData.product_ids.includes(product.id))
                                   .map(product => product.id)
                                 setFormData({ ...formData, product_ids: [...formData.product_ids, ...newSelections] })
                               }
                             }}
                             className={`px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                               products.filter(p => p.category === category && (p.sub_category || '기타') === subCategory)
                                 .every(product => formData.product_ids.includes(product.id))
                                 ? 'bg-blue-400 text-white shadow-md'
                                 : products.filter(p => p.category === category && (p.sub_category || '기타') === subCategory)
                                 .some(product => formData.product_ids.includes(product.id))
                                 ? 'bg-blue-200 text-blue-800 shadow-sm'
                                 : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
                             }`}
                           >
                             {subCategory}
                           </button>
                         ))
                       )}
                     </div>
                   </div>
                 )}

                 {/* 개별 상품 선택 */}
                 {expandedModalProductCategories.length > 0 && (
                   <>
                     <div className="border-t border-gray-200 my-3"></div>
                     <div className="flex flex-wrap gap-1">
                       {expandedModalProductCategories.map(category => 
                         products.filter(p => p.category === category).map(product => (
                           <button
                             key={product.id}
                             onClick={() => {
                               if (formData.product_ids.includes(product.id)) {
                                 setFormData({ ...formData, product_ids: formData.product_ids.filter(id => id !== product.id) })
                               } else {
                                 setFormData({ ...formData, product_ids: [...formData.product_ids, product.id] })
                               }
                             }}
                             className={`px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                               formData.product_ids.includes(product.id)
                                 ? 'bg-blue-500 text-white shadow-sm'
                                 : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                             }`}
                           >
                             {product.name_ko}
                           </button>
                         ))
                       )}
                     </div>
                   </>
                 )}

                 {formData.product_ids.length > 0 && (
                   <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                     <div className="text-xs text-blue-700 font-medium">
                       선택됨: {formData.product_ids.length}개 상품
                     </div>
                   </div>
                 )}
               </div>

               {/* 채널 그룹화 선택 */}
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-3">채널 선택</label>
                 
                 {/* 채널 타입 탭 */}
                 <div className="mb-3">
                   <div className="flex flex-wrap gap-2">
                     <button
                       onClick={() => setExpandedModalChannelTypes([])}
                       className={`px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                         expandedModalChannelTypes.length === 0
                           ? 'bg-gray-800 text-white shadow-md'
                           : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
                       }`}
                     >
                       모든 타입
                     </button>
                     {Object.keys(
                       channels.reduce((acc, channel) => {
                         const type = channel.type || '기타'
                         if (!acc[type]) {
                           acc[type] = []
                         }
                         acc[type].push(channel)
                         return acc
                       }, {} as Record<string, any[]>)
                     ).map(type => (
                       <button
                         key={type}
                         onClick={() => {
                           if (expandedModalChannelTypes.includes(type)) {
                             setExpandedModalChannelTypes(expandedModalChannelTypes.filter(t => t !== type))
                           } else {
                             setExpandedModalChannelTypes([...expandedModalChannelTypes, type])
                           }
                         }}
                         className={`px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                           expandedModalChannelTypes.includes(type)
                             ? 'bg-green-500 text-white shadow-md'
                             : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
                         }`}
                       >
                         {type}
                       </button>
                     ))}
                   </div>
                 </div>

                 {/* 개별 채널 선택 */}
                 {expandedModalChannelTypes.length > 0 && (
                   <>
                     <div className="border-t border-gray-200 my-3"></div>
                     <div className="flex flex-wrap gap-1">
                       {expandedModalChannelTypes.map(type => 
                         channels.filter(c => c.type === type).map(channel => (
                           <button
                             key={channel.id}
                             onClick={() => {
                               if (formData.channel_ids.includes(channel.id)) {
                                 setFormData({ ...formData, channel_ids: formData.channel_ids.filter(id => id !== channel.id) })
                               } else {
                                 setFormData({ ...formData, channel_ids: [...formData.channel_ids, channel.id] })
                               }
                             }}
                             className={`px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                               formData.channel_ids.includes(channel.id)
                                 ? 'bg-green-500 text-white shadow-sm'
                                 : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                             }`}
                           >
                             {channel.name}
                           </button>
                         ))
                       )}
                     </div>
                   </>
                 )}

                 {formData.channel_ids.length > 0 && (
                   <div className="mt-2 p-2 bg-green-50 rounded-lg">
                     <div className="text-xs text-green-700 font-medium">
                       선택됨: {formData.channel_ids.length}개 채널
                     </div>
                   </div>
                 )}
               </div>
             </div>

            {/* 질문 - 좌우 배치 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🇰🇷 질문 (한국어)</label>
                <input
                  type="text"
                  value={formData.question_ko}
                  onChange={(e) => setFormData({ ...formData, question_ko: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🇺🇸 질문 (English)</label>
                <input
                  type="text"
                  value={formData.question_en}
                  onChange={(e) => setFormData({ ...formData, question_en: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* 답변 - 좌우 배치 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🇰🇷 답변 (한국어)</label>
                <textarea
                  value={formData.answer_ko}
                  onChange={(e) => setFormData({ ...formData, answer_ko: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🇺🇸 답변 (English)</label>
                <textarea
                  value={formData.answer_en}
                  onChange={(e) => setFormData({ ...formData, answer_en: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* 기타 설정 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">템플릿 타입</label>
                <select
                  value={formData.template_type}
                  onChange={(e) => setFormData({ ...formData, template_type: e.target.value as TemplateType })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="faq">FAQ</option>
                  <option value="greeting">인사말</option>
                  <option value="closing">마무리</option>
                  <option value="policy">정책</option>
                  <option value="general">일반</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">태그 (쉼표로 구분)</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="예: 가격, 취소, 예약"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* 체크박스 */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded"
                />
                활성화
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_favorite}
                  onChange={(e) => setFormData({ ...formData, is_favorite: e.target.checked })}
                  className="rounded"
                />
                즐겨찾기
              </label>
            </div>

            {/* 버튼 */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? '저장 중...' : '저장'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// 삭제 확인 모달 컴포넌트
function DeleteModal({ 
  template, 
  onClose, 
  onConfirm 
}: {
  template: ConsultationTemplateWithRelations
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-semibold mb-4">템플릿 삭제</h2>
        <div className="text-gray-600 mb-6">
          <p className="mb-2">다음 템플릿을 삭제하시겠습니까?</p>
          <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg">
            <div>
              <p className="text-sm font-medium text-blue-800">🇰🇷 {template.question_ko}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-green-800">🇺🇸 {template.question_en}</p>
            </div>
          </div>
          <p className="text-sm text-red-600 mt-2">이 작업은 되돌릴 수 없습니다.</p>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  )
}
