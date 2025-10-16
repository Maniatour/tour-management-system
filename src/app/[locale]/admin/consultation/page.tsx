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
  Clock,
  Workflow,
  Play,
  Pause,
  Square,
  ArrowRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  GitBranch,
  Maximize2,
  Minimize2,
  X
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useOptimizedData } from '@/hooks/useOptimizedData'
import WorkflowDiagram from '@/components/WorkflowDiagram'
import WorkflowTemplateModal from '@/components/WorkflowTemplateModal'
import type { 
  ConsultationCategory, 
  ConsultationTemplateWithRelations, 
  ConsultationLogWithRelations,
  TemplateType,
  Language
} from '@/types/consultation'

export default function ConsultationManagementPage() {
  const { locale } = useParams()
  const [activeTab, setActiveTab] = useState<'templates' | 'workflows' | 'logs' | 'stats'>('templates')
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
  
  // 워크플로우 모달 상태
  const [showWorkflowModal, setShowWorkflowModal] = useState(false)
  const [editingWorkflow, setEditingWorkflow] = useState<any>(null)
  const [showWorkflowDeleteModal, setShowWorkflowDeleteModal] = useState(false)
  const [workflowToDelete, setWorkflowToDelete] = useState<any>(null)
  const [showWorkflowDiagram, setShowWorkflowDiagram] = useState(false)
  const [selectedWorkflowForDiagram, setSelectedWorkflowForDiagram] = useState<any>(null)
  const [workflowDiagramMode, setWorkflowDiagramMode] = useState<'diagram' | 'manual' | 'edit'>('manual')
  const [isWorkflowModalFullscreen, setIsWorkflowModalFullscreen] = useState(false)
  const [savedWorkflowSettings, setSavedWorkflowSettings] = useState<{[workflowId: string]: {
    zoom: number
    backgroundSize: { width: number; height: number }
    nodeSize: { width: number; height: number }
    panelPosition: { x: number; y: number }
  }}>({})

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

  // 워크플로우 데이터 로딩 (임시로 비활성화)
  const { data: workflows, loading: workflowsLoading, refetch: refetchWorkflows } = useOptimizedData({
    fetchFn: async () => {
      // 테이블이 존재하지 않을 경우 빈 배열 반환
      try {
        const { data, error } = await supabase
          .from('consultation_workflows')
          .select(`
            id, name_ko, name_en, description_ko, description_en,
            category_id, product_id, channel_id, is_active, is_default,
            tags, created_by, updated_by, created_at, updated_at,
            category:consultation_categories(id, name_ko, name_en, icon, color),
            product:products(id, name, name_ko, name_en),
            channel:channels(id, name)
          `)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: false })
        
        if (error) {
          console.warn('워크플로우 테이블이 존재하지 않습니다. 데이터베이스에 테이블을 생성해주세요.')
          return []
        }
        return data || []
      } catch (error) {
        console.warn('워크플로우 테이블 접근 오류:', error)
        return []
      }
    },
    cacheKey: 'consultation_workflows',
    dependencies: []
  })

  // 워크플로우 단계 데이터 로딩 (임시로 비활성화)
  const { data: workflowSteps, loading: workflowStepsLoading, refetch: refetchWorkflowSteps } = useOptimizedData({
    fetchFn: async () => {
      // 테이블이 존재하지 않을 경우 빈 배열 반환
      try {
        const { data, error } = await supabase
          .from('consultation_workflow_steps')
          .select(`
            id, workflow_id, step_name_ko, step_name_en, step_description_ko, step_description_en,
            step_order, step_type, action_type, template_id, condition_type, condition_value,
            next_step_id, alternative_step_id, timeout_minutes, is_active, is_required,
            node_color, text_color, node_shape, position, group_id,
            created_at, updated_at,
            template:consultation_templates(id, question_ko, question_en, answer_ko, answer_en)
          `)
          .order('workflow_id', { ascending: true })
          .order('step_order', { ascending: true })
        
        if (error) {
          console.warn('워크플로우 단계 테이블이 존재하지 않습니다.')
          return []
        }
        return data || []
      } catch (error) {
        console.warn('워크플로우 단계 테이블 접근 오류:', error)
        return []
      }
    },
    cacheKey: 'consultation_workflow_steps',
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

  // 워크플로우 활성화/비활성화 토글
  const toggleWorkflowActive = useCallback(async (workflow: any) => {
    try {
      const { error } = await supabase
        .from('consultation_workflows')
        .update({ is_active: !workflow.is_active })
        .eq('id', workflow.id)
      
      if (error) throw error
      
      refetchWorkflows()
    } catch (error) {
      console.error('워크플로우 활성화 상태 업데이트 실패:', error)
    }
  }, [refetchWorkflows])

  // 워크플로우 다이어그램 보기
  const showWorkflowDiagramModal = (workflow: any, mode: 'diagram' | 'manual' | 'edit' = 'manual') => {
    const workflowSteps = groupedWorkflowSteps[workflow.id] || []
    
    // 저장된 설정 불러오기
    const savedSettings = localStorage.getItem(`workflow_settings_${workflow.id}`)
    let initialSettings = undefined
    if (savedSettings) {
      try {
        initialSettings = JSON.parse(savedSettings)
      } catch (error) {
        console.error('저장된 설정 파싱 실패:', error)
      }
    }
    
    setSelectedWorkflowForDiagram({
      ...workflow,
      steps: workflowSteps,
      initialSettings
    })
    setWorkflowDiagramMode(mode)
    setShowWorkflowDiagram(true)
  }

  // 워크플로우 저장
  const handleWorkflowSave = async (data: { 
    steps: any[]
    zoom: number
    backgroundSize: { width: number; height: number }
    nodeSize: { width: number; height: number }
    panelPosition: { x: number; y: number }
  }) => {
    try {
      if (!selectedWorkflowForDiagram) return

      // 단계들 저장
      const { steps } = data
      for (const step of steps) {
        const { error } = await supabase
          .from('consultation_workflow_steps')
          .upsert({
            id: step.id,
            workflow_id: selectedWorkflowForDiagram.id,
            step_name_ko: step.step_name_ko,
            step_name_en: step.step_name_en,
            step_type: step.step_type,
            step_order: step.step_order,
            description_ko: step.description_ko,
            description_en: step.description_en,
            node_shape: step.node_shape,
            node_color: step.node_color,
            text_color: step.text_color,
            next_step_id: step.next_step_id,
            alternative_step_id: step.alternative_step_id,
            group_id: step.group_id,
            position: step.position
          })

        if (error) {
          console.error('워크플로우 단계 저장 실패:', error)
          return
        }
      }

      // 설정 저장 (로컬 스토리지에)
      if (selectedWorkflowForDiagram.id) {
        setSavedWorkflowSettings(prev => ({
          ...prev,
          [selectedWorkflowForDiagram.id]: {
            zoom: data.zoom,
            backgroundSize: data.backgroundSize,
            nodeSize: data.nodeSize,
            panelPosition: data.panelPosition
          }
        }))
        
        // 로컬 스토리지에도 저장
        localStorage.setItem(`workflow_settings_${selectedWorkflowForDiagram.id}`, JSON.stringify({
          zoom: data.zoom,
          backgroundSize: data.backgroundSize,
          nodeSize: data.nodeSize,
          panelPosition: data.panelPosition
        }))
      }

      await refetchWorkflows()
      alert('워크플로우가 저장되었습니다.')
    } catch (error) {
      console.error('워크플로우 저장 실패:', error)
      alert('워크플로우 저장에 실패했습니다.')
    }
  }

  // 템플릿 선택 핸들러
  const handleTemplateSelect = async (template: any) => {
    try {
      // 템플릿을 기반으로 새 워크플로우 생성
      const newWorkflow = {
        name_ko: template.name,
        name_en: template.name,
        description_ko: template.description,
        description_en: template.description,
        category_id: categories?.[0]?.id, // 첫 번째 카테고리 사용
        is_active: true,
        is_default: false,
        steps: template.steps.map((step: any, index: number) => ({
          ...step,
          step_order: index + 1,
          id: `step_${Date.now()}_${index}`,
        }))
      }

      // 워크플로우 생성
      const { data: workflowData, error: workflowError } = await supabase
        .from('consultation_workflows')
        .insert([{
          name_ko: newWorkflow.name_ko,
          name_en: newWorkflow.name_en,
          description_ko: newWorkflow.description_ko,
          description_en: newWorkflow.description_en,
          category_id: newWorkflow.category_id,
          is_active: newWorkflow.is_active,
          is_default: newWorkflow.is_default,
        }])
        .select()
        .single()

      if (workflowError) throw workflowError

      // 워크플로우 단계 생성
      const stepsToInsert = newWorkflow.steps.map((step: any) => ({
        workflow_id: workflowData.id,
        step_name_ko: step.step_name_ko,
        step_name_en: step.step_name_en,
        step_description_ko: step.step_description_ko,
        step_description_en: step.step_description_en,
        step_order: step.step_order,
        step_type: step.step_type,
        action_type: step.action_type,
        condition_type: step.condition_type,
        condition_value: step.condition_value,
        next_step_id: step.next_step_id,
        alternative_step_id: step.alternative_step_id,
        is_active: step.is_active,
        is_required: step.is_required,
        node_shape: step.node_shape,
        node_color: step.node_color,
        text_color: step.text_color,
      }))

      const { error: stepsError } = await supabase
        .from('consultation_workflow_steps')
        .insert(stepsToInsert)

      if (stepsError) throw stepsError

      // 데이터 새로고침
      await refetchWorkflows()
      await refetchWorkflowSteps()
      
      setShowTemplateModal(false)
      alert('템플릿이 성공적으로 적용되었습니다!')
    } catch (error) {
      console.error('템플릿 적용 실패:', error)
      alert('템플릿 적용에 실패했습니다.')
    }
  }

  // 워크플로우 삭제
  const deleteWorkflow = useCallback(async () => {
    if (!workflowToDelete) return
    
    try {
      const { error } = await supabase
        .from('consultation_workflows')
        .delete()
        .eq('id', workflowToDelete.id)
      
      if (error) throw error
      
      setShowWorkflowDeleteModal(false)
      setWorkflowToDelete(null)
      refetchWorkflows()
    } catch (error) {
      console.error('워크플로우 삭제 실패:', error)
    }
  }, [workflowToDelete, refetchWorkflows])

  // 워크플로우 단계 그룹화 함수
  const groupedWorkflowSteps = workflowSteps?.reduce((acc, step) => {
    if (!acc[step.workflow_id]) {
      acc[step.workflow_id] = []
    }
    acc[step.workflow_id].push(step)
    return acc
  }, {} as Record<string, any[]>) || {}

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">상담 관리</h1>
            <p className="text-gray-600">FAQ 템플릿과 상담 안내를 관리하세요</p>
          </div>
          <div className="flex gap-3">
            {activeTab === 'templates' && (
              <button
                onClick={() => setShowTemplateModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus size={20} />
                새 템플릿 추가
              </button>
            )}
            {activeTab === 'workflows' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTemplateModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <FileText size={20} />
                  템플릿 사용
                </button>
                <button
                  onClick={() => setShowWorkflowModal(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Plus size={20} />
                  새 워크플로우 추가
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'templates', name: '템플릿 관리', icon: MessageCircle },
              { id: 'workflows', name: '워크플로우', icon: Workflow },
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

      {/* 워크플로우 탭 */}
      {activeTab === 'workflows' && (
        <div className="space-y-6">
          {/* 워크플로우 목록 */}
          <div className="space-y-4">
            {workflows?.map(workflow => {
              const steps = groupedWorkflowSteps[workflow.id] || []
              return (
                <div
                  key={workflow.id}
                  className={`bg-white p-6 rounded-lg shadow-sm border ${
                    !workflow.is_active ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {/* 카테고리 아이콘 */}
                      {workflow.category && (
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                          style={{ backgroundColor: workflow.category.color }}
                        >
                          <Workflow size={16} />
                        </div>
                      )}
                      
                      <div className="flex-1">
                        {/* 제목줄 */}
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-gray-900 text-base">
                            {workflow.name_ko}
                          </h3>
                          {workflow.is_default && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                              기본 워크플로우
                            </span>
                          )}
                          {!workflow.is_active && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                              비활성
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          {workflow.category && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                              {workflow.category.name_ko}
                            </span>
                          )}
                          {workflow.product && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                              {workflow.product.name_ko}
                            </span>
                          )}
                          {workflow.channel && (
                            <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full">
                              {workflow.channel.name}
                            </span>
                          )}
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                            {steps.length}단계
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* 활성화/비활성화 버튼 */}
                      <button
                        onClick={() => toggleWorkflowActive(workflow)}
                        className={`p-2 rounded-lg hover:bg-gray-100 ${
                          workflow.is_active ? 'text-green-500' : 'text-gray-400'
                        }`}
                      >
                        {workflow.is_active ? <Play size={16} /> : <Pause size={16} />}
                      </button>

                      {/* 메뉴얼 보기 버튼 */}
                      <button
                        onClick={() => showWorkflowDiagramModal(workflow, 'manual')}
                        className="p-2 rounded-lg hover:bg-gray-100 text-blue-500"
                        title="워크플로우 메뉴얼 보기"
                      >
                        <GitBranch size={16} />
                      </button>

                      {/* 편집 버튼 */}
                      <button
                        onClick={() => showWorkflowDiagramModal(workflow, 'edit')}
                        className="p-2 rounded-lg hover:bg-gray-100 text-green-500"
                        title="워크플로우 편집"
                      >
                        <Edit size={16} />
                      </button>

                      {/* 설정 버튼 */}
                      <button
                        onClick={async () => {
                          try {
                            // 해당 워크플로우의 단계들을 불러오기
                            const { data: steps, error } = await supabase
                              .from('consultation_workflow_steps')
                              .select(`
                                id, workflow_id, step_name_ko, step_name_en, step_description_ko, step_description_en,
                                step_order, step_type, action_type, template_id, condition_type, condition_value,
                                next_step_id, alternative_step_id, timeout_minutes, is_active, is_required,
                                node_color, text_color, node_shape, position, group_id,
                                created_at, updated_at,
                                template:consultation_templates(id, question_ko, question_en, answer_ko, answer_en)
                              `)
                              .eq('workflow_id', workflow.id)
                              .order('step_order', { ascending: true })
                            
                            if (error) {
                              console.warn('워크플로우 단계 불러오기 실패:', error)
                            }
                            
                            setEditingWorkflow({
                              ...workflow,
                              steps: steps || []
                            })
                            setShowWorkflowModal(true)
                          } catch (error) {
                            console.error('워크플로우 편집 모달 열기 실패:', error)
                            setEditingWorkflow(workflow)
                            setShowWorkflowModal(true)
                          }
                        }}
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                        title="워크플로우 설정"
                      >
                        <Settings size={16} />
                      </button>

                      {/* 삭제 버튼 */}
                      <button
                        onClick={() => {
                          setWorkflowToDelete(workflow)
                          setShowWorkflowDeleteModal(true)
                        }}
                        className="p-2 rounded-lg hover:bg-gray-100 text-red-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* 워크플로우 설명 */}
                  <div className="mb-4">
                    <p className="text-sm text-gray-600">{workflow.description_ko}</p>
                  </div>

                  {/* 워크플로우 단계 표시 */}
                  {steps.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">워크플로우 단계</h4>
                      <div className="flex flex-wrap gap-2">
                        {steps.map((step, index) => (
                          <div
                            key={step.id}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-sm"
                          >
                            <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">
                              {step.step_order}
                            </span>
                            <span className="text-gray-700">{step.step_name_ko}</span>
                            <div className="flex items-center gap-1">
                              {step.step_type === 'action' && <CheckCircle size={14} className="text-green-500" />}
                              {step.step_type === 'decision' && <AlertCircle size={14} className="text-yellow-500" />}
                              {step.step_type === 'condition' && <XCircle size={14} className="text-red-500" />}
                            </div>
                            {index < steps.length - 1 && (
                              <ArrowRight size={14} className="text-gray-400" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 태그 */}
                  {workflow.tags && workflow.tags.length > 0 && (
                    <div className="flex items-center gap-2 mt-3">
                      <Tag size={14} className="text-gray-400" />
                      <div className="flex gap-1">
                        {workflow.tags.map(tag => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {workflows?.length === 0 && (
              <div className="text-center py-12">
                <Workflow size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">워크플로우 기능 설정 필요</h3>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-4 max-w-2xl mx-auto">
                  <h4 className="text-md font-semibold text-yellow-800 mb-2">📋 데이터베이스 테이블 생성 필요</h4>
                  <p className="text-yellow-700 text-sm mb-4">
                    워크플로우 기능을 사용하려면 먼저 데이터베이스에 필요한 테이블들을 생성해야 합니다.
                  </p>
                  <div className="text-left bg-white p-4 rounded border text-xs text-gray-600 mb-4">
                    <p className="font-medium mb-2">Supabase 대시보드에서 다음 SQL을 실행하세요:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Supabase 대시보드 → SQL Editor로 이동</li>
                      <li>프로젝트 루트의 <code className="bg-gray-100 px-1 rounded">create_consultation_workflow_schema.sql</code> 파일 내용 복사</li>
                      <li>SQL Editor에 붙여넣기 후 실행</li>
                      <li>페이지 새로고침</li>
                    </ol>
                  </div>
                  <button
                    onClick={() => window.location.reload()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 mr-2"
                  >
                    페이지 새로고침
                  </button>
                  <button
                    onClick={() => setShowWorkflowModal(true)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    워크플로우 추가 시도
                  </button>
                </div>
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

      {/* 워크플로우 추가/편집 모달 */}
      {showWorkflowModal && (
        <WorkflowModal
          workflow={editingWorkflow}
          categories={categories || []}
          products={products || []}
          channels={channels || []}
          templates={templates || []}
          isFullscreen={isWorkflowModalFullscreen}
          onToggleFullscreen={() => setIsWorkflowModalFullscreen(!isWorkflowModalFullscreen)}
          onClose={() => {
            setShowWorkflowModal(false)
            setEditingWorkflow(null)
            setIsWorkflowModalFullscreen(false)
          }}
          onSave={() => {
            refetchWorkflows()
            refetchWorkflowSteps()
            setShowWorkflowModal(false)
            setEditingWorkflow(null)
            setIsWorkflowModalFullscreen(false)
          }}
        />
      )}

      {/* 워크플로우 삭제 확인 모달 */}
      {showWorkflowDeleteModal && workflowToDelete && (
        <WorkflowDeleteModal
          workflow={workflowToDelete}
          onClose={() => {
            setShowWorkflowDeleteModal(false)
            setWorkflowToDelete(null)
          }}
          onConfirm={deleteWorkflow}
        />
      )}

      {/* 워크플로우 다이어그램 모달 */}
      {showWorkflowDiagram && selectedWorkflowForDiagram && (
        <WorkflowDiagram
          steps={selectedWorkflowForDiagram.steps || []}
          workflowName={selectedWorkflowForDiagram.name_ko}
          mode={workflowDiagramMode}
          onClose={() => {
            setShowWorkflowDiagram(false)
            setSelectedWorkflowForDiagram(null)
          }}
          onSave={handleWorkflowSave}
          initialSettings={selectedWorkflowForDiagram.initialSettings}
        />
      )}

      {/* 워크플로우 템플릿 모달 */}
      {showTemplateModal && (
        <WorkflowTemplateModal
          onSelectTemplate={handleTemplateSelect}
          onClose={() => setShowTemplateModal(false)}
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

// 워크플로우 모달 컴포넌트
function WorkflowModal({ 
  workflow, 
  categories, 
  products, 
  channels, 
  templates, 
  isFullscreen,
  onToggleFullscreen,
  onClose, 
  onSave 
}: {
  workflow?: any
  categories: ConsultationCategory[]
  products: any[]
  channels: any[]
  templates: any[]
  isFullscreen: boolean
  onToggleFullscreen: () => void
  onClose: () => void
  onSave: () => void
}) {
  const [formData, setFormData] = useState({
    name_ko: workflow?.name_ko || '',
    name_en: workflow?.name_en || '',
    description_ko: workflow?.description_ko || '',
    description_en: workflow?.description_en || '',
    category_id: workflow?.category_id || '',
    product_id: workflow?.product_id || '',
    channel_id: workflow?.channel_id || '',
    is_active: workflow?.is_active ?? true,
    is_default: workflow?.is_default ?? false,
    tags: workflow?.tags?.join(', ') || ''
  })

  const [steps, setSteps] = useState<any[]>(workflow?.steps || [])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const addStep = () => {
    const newStep = {
      id: `temp_${Date.now()}`,
      step_name_ko: '',
      step_name_en: '',
      step_description_ko: '',
      step_description_en: '',
      step_order: steps.length + 1,
      step_type: 'action',
      action_type: 'send_template',
      template_id: '',
      condition_type: '',
      condition_value: '',
      timeout_minutes: 0,
      is_active: true,
      is_required: true,
      node_color: '#3b82f6',
      text_color: '#ffffff',
      node_shape: 'rectangle',
      position: null,
      group_id: null
    }
    setSteps([...steps, newStep])
  }

  const updateStep = (index: number, field: string, value: any) => {
    const updatedSteps = [...steps]
    updatedSteps[index] = { ...updatedSteps[index], [field]: value }
    setSteps(updatedSteps)
  }

  const removeStep = (index: number) => {
    const updatedSteps = steps.filter((_, i) => i !== index)
    // 단계 순서 재정렬
    updatedSteps.forEach((step, i) => {
      step.step_order = i + 1
    })
    setSteps(updatedSteps)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const submitData = {
        name_ko: formData.name_ko,
        name_en: formData.name_en,
        description_ko: formData.description_ko,
        description_en: formData.description_en,
        category_id: formData.category_id || null,
        product_id: formData.product_id || null,
        channel_id: formData.channel_id || null,
        is_active: formData.is_active,
        is_default: formData.is_default,
        tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()).filter(Boolean) : []
      }

      let workflowId: string

      if (workflow) {
        // 편집
        const { data, error } = await supabase
          .from('consultation_workflows')
          .update(submitData)
          .eq('id', workflow.id)
          .select()
          .single()
        
        if (error) {
          if (error.code === 'PGRST205') {
            alert('워크플로우 테이블이 존재하지 않습니다. 먼저 데이터베이스에 테이블을 생성해주세요.')
            return
          }
          throw error
        }
        workflowId = data.id
      } else {
        // 새로 추가
        const { data, error } = await supabase
          .from('consultation_workflows')
          .insert(submitData)
          .select()
          .single()
        
        if (error) {
          if (error.code === 'PGRST205') {
            alert('워크플로우 테이블이 존재하지 않습니다. 먼저 데이터베이스에 테이블을 생성해주세요.')
            return
          }
          throw error
        }
        workflowId = data.id
      }

      // 기존 단계 삭제 (편집 시)
      if (workflow) {
        const { error: deleteError } = await supabase
          .from('consultation_workflow_steps')
          .delete()
          .eq('workflow_id', workflowId)
        
        if (deleteError && deleteError.code !== 'PGRST205') {
          console.warn('단계 삭제 오류:', deleteError)
        }
      }

      // 새 단계 추가
      if (steps.length > 0) {
        const stepsToInsert = steps.map((step, index) => ({
          workflow_id: workflowId,
          step_name_ko: step.step_name_ko,
          step_name_en: step.step_name_en,
          step_description_ko: step.step_description_ko,
          step_description_en: step.step_description_en,
          step_order: index + 1,
          step_type: step.step_type,
          action_type: step.action_type,
          template_id: step.template_id || null,
          condition_type: step.condition_type || null,
          condition_value: step.condition_value || null,
          timeout_minutes: step.timeout_minutes,
          is_active: step.is_active,
          is_required: step.is_required,
          node_color: step.node_color || null,
          text_color: step.text_color || null,
          node_shape: step.node_shape || 'rectangle',
          position: step.position || null,
          group_id: step.group_id || null
        }))

        const { error: stepsError } = await supabase
          .from('consultation_workflow_steps')
          .insert(stepsToInsert)
        
        if (stepsError) {
          if (stepsError.code === 'PGRST205') {
            alert('워크플로우 단계 테이블이 존재하지 않습니다. 데이터베이스에 테이블을 생성해주세요.')
            return
          }
          throw stepsError
        }
      }

      onSave()
    } catch (error) {
      console.error('워크플로우 저장 실패:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${isFullscreen ? 'p-0' : 'p-4'}`}>
      <div className={`bg-white shadow-xl w-full overflow-hidden ${isFullscreen ? 'h-full rounded-none' : 'max-w-6xl max-h-[90vh] rounded-lg'}`}>
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {workflow ? '워크플로우 편집' : '새 워크플로우 추가'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleFullscreen}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
              title={isFullscreen ? '축소' : '전체화면'}
            >
              {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 콘텐츠 */}
        <div className={`${isFullscreen ? 'h-[calc(100vh-80px)] overflow-y-auto' : 'max-h-[calc(90vh-80px)] overflow-y-auto'}`}>
          <div className="p-6">

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 기본 정보 */}
            <div className={`grid gap-4 ${isFullscreen ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🇰🇷 워크플로우 이름 (한국어)</label>
                <input
                  type="text"
                  value={formData.name_ko}
                  onChange={(e) => setFormData({ ...formData, name_ko: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🇺🇸 워크플로우 이름 (English)</label>
                <input
                  type="text"
                  value={formData.name_en}
                  onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🇰🇷 설명 (한국어)</label>
                <textarea
                  value={formData.description_ko}
                  onChange={(e) => setFormData({ ...formData, description_ko: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🇺🇸 설명 (English)</label>
                <textarea
                  value={formData.description_en}
                  onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* 카테고리 및 필터 */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">카테고리 선택</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name_ko}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상품</label>
                <select
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">상품 선택</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name_ko}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">채널</label>
                <select
                  value={formData.channel_id}
                  onChange={(e) => setFormData({ ...formData, channel_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">채널 선택</option>
                  {channels.map(channel => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 워크플로우 단계 */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">워크플로우 단계</h3>
                <button
                  type="button"
                  onClick={addStep}
                  className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Plus size={16} />
                  단계 추가
                </button>
              </div>

              <div className={`space-y-4 ${isFullscreen ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : ''}`}>
                {steps.map((step, index) => (
                  <div key={step.id} className={`border border-gray-200 rounded-lg p-4 ${isFullscreen ? '' : ''}`}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">단계 {index + 1}</h4>
                      <button
                        type="button"
                        onClick={() => removeStep(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className={`grid gap-4 mb-3 ${isFullscreen ? 'grid-cols-3' : 'grid-cols-2'}`}>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">단계 이름 (한국어)</label>
                        <input
                          type="text"
                          value={step.step_name_ko}
                          onChange={(e) => updateStep(index, 'step_name_ko', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">단계 이름 (English)</label>
                        <input
                          type="text"
                          value={step.step_name_en}
                          onChange={(e) => updateStep(index, 'step_name_en', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">단계 타입</label>
                        <select
                          value={step.step_type}
                          onChange={(e) => updateStep(index, 'step_type', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        >
                          <option value="action">액션</option>
                          <option value="decision">결정</option>
                          <option value="condition">조건</option>
                          <option value="template">템플릿</option>
                          <option value="manual">수동</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">액션 타입</label>
                        <select
                          value={step.action_type}
                          onChange={(e) => updateStep(index, 'action_type', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        >
                          <option value="send_template">템플릿 전송</option>
                          <option value="ask_question">질문하기</option>
                          <option value="wait_response">응답 대기</option>
                          <option value="escalate">에스컬레이션</option>
                          <option value="close">상담 종료</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">템플릿</label>
                        <select
                          value={step.template_id}
                          onChange={(e) => updateStep(index, 'template_id', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        >
                          <option value="">템플릿 선택</option>
                          {templates.map(template => (
                            <option key={template.id} value={template.id}>
                              {template.question_ko}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* 조건문 설정 섹션 */}
                    {step.step_type === 'condition' && (
                      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h5 className="text-sm font-semibold text-blue-800 mb-3">🔍 조건문 설정</h5>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">조건 타입</label>
                            <select
                              value={step.condition_type || ''}
                              onChange={(e) => updateStep(index, 'condition_type', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="">조건 타입 선택</option>
                              <option value="customer_response">고객 응답</option>
                              <option value="time_elapsed">시간 경과</option>
                              <option value="product_match">상품 매칭</option>
                              <option value="channel_match">채널 매칭</option>
                              <option value="category_match">카테고리 매칭</option>
                              <option value="language_preference">언어 선호도</option>
                              <option value="escalation_needed">에스컬레이션 필요</option>
                              <option value="custom_field">사용자 정의 필드</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">조건 값</label>
                            <input
                              type="text"
                              value={step.condition_value || ''}
                              onChange={(e) => updateStep(index, 'condition_value', e.target.value)}
                              placeholder="조건 값 입력 (예: 예, 아니오, 30분)"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                        <div className="mt-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">조건 설명</label>
                          <textarea
                            value={step.step_description_ko || ''}
                            onChange={(e) => updateStep(index, 'step_description_ko', e.target.value)}
                            placeholder="조건문이 무엇을 확인하는지 설명하세요"
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    )}

                    {/* 결정문 설정 섹션 */}
                    {step.step_type === 'decision' && (
                      <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <h5 className="text-sm font-semibold text-yellow-800 mb-3">🤔 결정문 설정</h5>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">결정 기준</label>
                            <select
                              value={step.condition_type || ''}
                              onChange={(e) => updateStep(index, 'condition_type', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                            >
                              <option value="">결정 기준 선택</option>
                              <option value="customer_choice">고객 선택</option>
                              <option value="response_analysis">응답 분석</option>
                              <option value="time_based">시간 기반</option>
                              <option value="priority_based">우선순위 기반</option>
                              <option value="escalation_check">에스컬레이션 확인</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">결정 옵션</label>
                            <input
                              type="text"
                              value={step.condition_value || ''}
                              onChange={(e) => updateStep(index, 'condition_value', e.target.value)}
                              placeholder="결정 옵션 (예: 예/아니오, 계속/중단)"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                        <div className="mt-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">결정 설명</label>
                          <textarea
                            value={step.step_description_ko || ''}
                            onChange={(e) => updateStep(index, 'step_description_ko', e.target.value)}
                            placeholder="어떤 기준으로 결정을 내리는지 설명하세요"
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    )}

                    {/* 다음 단계 설정 */}
                    <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <h5 className="text-sm font-semibold text-gray-800 mb-3">➡️ 다음 단계 설정</h5>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">성공 시 다음 단계</label>
                          <select
                            value={step.next_step_id || ''}
                            onChange={(e) => updateStep(index, 'next_step_id', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                          >
                            <option value="">다음 단계 선택</option>
                            {steps.map((s, i) => (
                              i > index && (
                                <option key={s.id} value={s.id}>
                                  단계 {i + 1}: {s.step_name_ko || '이름 없음'}
                                </option>
                              )
                            ))}
                            <option value="end">워크플로우 종료</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">실패 시 다음 단계</label>
                          <select
                            value={step.alternative_step_id || ''}
                            onChange={(e) => updateStep(index, 'alternative_step_id', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                          >
                            <option value="">대안 단계 선택</option>
                            {steps.map((s, i) => (
                              i > index && (
                                <option key={s.id} value={s.id}>
                                  단계 {i + 1}: {s.step_name_ko || '이름 없음'}
                                </option>
                              )
                            ))}
                            <option value="escalate">에스컬레이션</option>
                            <option value="end">워크플로우 종료</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 기타 설정 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">태그 (쉼표로 구분)</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="예: 일반문의, 예약문의"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                  className="rounded"
                />
                기본 워크플로우
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
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
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

// 워크플로우 삭제 확인 모달 컴포넌트
function WorkflowDeleteModal({ 
  workflow, 
  onClose, 
  onConfirm 
}: {
  workflow: any
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-semibold mb-4">워크플로우 삭제</h2>
        <div className="text-gray-600 mb-6">
          <p className="mb-2">다음 워크플로우를 삭제하시겠습니까?</p>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm font-medium text-gray-900">{workflow.name_ko}</p>
            <p className="text-xs text-gray-500 mt-1">{workflow.description_ko}</p>
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
