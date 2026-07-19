'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { Plus, Search, Edit, Trash2, Copy, Upload, ChevronUp, ChevronDown, BookOpen, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import LocaleDropdown from '@/components/LocaleDropdown'
import { supabase } from '@/lib/supabase'
import ImageUpload from '@/components/common/ImageUpload'
import {
  applyGroupI18nToOptionContent,
  getOptionTemplateLocalizedText,
  mergeOptionTemplateGroupI18n,
  mergeOptionTemplateOptionI18n,
  type OptionTemplateContentI18n,
} from '@/lib/optionTemplateLocales'
import { getSiteLocaleMeta, type SiteLocale } from '@/lib/siteLocales'

interface ChoiceTemplate {
  id: string
  name: string
  name_ko?: string
  description?: string
  description_ko?: string
  description_en?: string
  category: string
  adult_price: number
  child_price: number
  infant_price: number
  price_type: string
  status: string
  tags?: string[]
  is_choice_template: boolean
  choice_type: 'single' | 'multiple' | 'quantity'
  min_selections: number
  max_selections: number
  template_group?: string
  template_group_ko?: string
  template_group_description_ko?: string
  template_group_description_en?: string
  content_i18n?: OptionTemplateContentI18n | null
  is_required: boolean
  sort_order: number
  image_url?: string
  image_alt?: string
  thumbnail_url?: string
  image_order?: number
  created_at: string
}

interface GlobalChoicesManagerProps {
  onTemplateSelect?: (template: ChoiceTemplate) => void
}

export default function GlobalChoicesManager({ }: GlobalChoicesManagerProps) {
  const t = useTranslations('common')
  const [templates, setTemplates] = useState<ChoiceTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ChoiceTemplate | null>(null)
  const [selectedGroupForNewTemplate, setSelectedGroupForNewTemplate] = useState<{
    template_group: string,
    template_group_ko: string,
    choice_type: 'single' | 'multiple' | 'quantity',
    is_required: boolean,
    min_selections: number,
    max_selections: number,
    max_sort_order: number
  } | null>(null)
  const [showImportChoicesModal, setShowImportChoicesModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<{
    template_group: string, 
    template_group_ko: string, 
    template_group_description_ko?: string, 
    template_group_description_en?: string,
    content_i18n?: OptionTemplateContentI18n | null,
    choice_type?: 'single' | 'multiple' | 'quantity',
    is_required?: boolean,
    min_selections?: number,
    max_selections?: number
  } | null>(null)
  const [showAddGroupModal, setShowAddGroupModal] = useState(false)
  const [deletingGroup, setDeletingGroup] = useState<string | null>(null)
  const [allCardsCollapsed, setAllCardsCollapsed] = useState(false)
  const [showWorkflowGuide, setShowWorkflowGuide] = useState(false)

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('options')
        .select('*')
        .eq('is_choice_template', true)
        .order('template_group', { ascending: true })
        .order('sort_order', { ascending: true })

      if (error) {
        console.error('Error fetching templates:', error)
        return
      }

      setTemplates((data || []) as ChoiceTemplate[])
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddTemplate = async (template: Omit<ChoiceTemplate, 'id' | 'created_at'>) => {
    try {
      // 이미지 URL 유효성 검사 및 정리
      const isValidUrl = (url: string | null | undefined): string | null => {
        if (!url || url.trim() === '') return null
        try {
          new URL(url)
          return url.trim()
        } catch {
          return null
        }
      }

      const newTemplate = {
        id: crypto.randomUUID(),
        name: template.name,
        name_ko: template.name_ko,
        description: template.description,
        description_ko: template.description_ko,
        description_en: template.description_en,
        category: template.category,
        adult_price: template.adult_price,
        child_price: template.child_price,
        infant_price: template.infant_price,
        price_type: template.price_type,
        status: template.status,
        tags: template.tags || [],
        is_choice_template: true,
        choice_type: template.choice_type,
        min_selections: template.min_selections,
        max_selections: template.max_selections,
        template_group: template.template_group,
        template_group_ko: template.template_group_ko,
        template_group_description_ko: template.template_group_description_ko,
        template_group_description_en: template.template_group_description_en,
        content_i18n: template.content_i18n || {},
        is_required: template.is_required,
        sort_order: template.sort_order,
        image_url: isValidUrl(template.image_url),
        image_alt: template.image_alt || null,
        thumbnail_url: isValidUrl(template.thumbnail_url),
        image_order: template.image_order || null
      }

      const { data, error } = await supabase
        .from('options')
        .insert([newTemplate as never])
        .select()

      if (error) {
        console.error('Error adding template:', error)
        return
      }

      if (data) {
        setTemplates([data[0] as ChoiceTemplate, ...templates])
      }
      setShowAddForm(false)
    } catch (error) {
      console.error('Error adding template:', error)
    }
  }

  const handleEditTemplate = async (template: Omit<ChoiceTemplate, 'id' | 'created_at'>) => {
    if (editingTemplate) {
      try {
        // 이미지 URL 유효성 검사 및 정리
        const isValidUrl = (url: string | null | undefined): string | null => {
          if (!url || url.trim() === '') return null
          try {
            new URL(url)
            return url.trim()
          } catch {
            return null
          }
        }

        const updatedTemplate = {
          name: template.name,
          name_ko: template.name_ko,
          description: template.description,
          description_ko: template.description_ko,
          description_en: template.description_en,
          category: template.category,
          adult_price: template.adult_price,
          child_price: template.child_price,
          infant_price: template.infant_price,
          price_type: template.price_type,
          status: template.status,
          tags: template.tags || [],
          choice_type: template.choice_type,
          min_selections: template.min_selections,
          max_selections: template.max_selections,
          template_group: template.template_group,
          template_group_ko: template.template_group_ko,
          template_group_description_ko: template.template_group_description_ko,
          template_group_description_en: template.template_group_description_en,
          content_i18n: template.content_i18n || {},
          is_required: template.is_required,
          sort_order: template.sort_order,
          image_url: isValidUrl(template.image_url),
          image_alt: template.image_alt || null,
          thumbnail_url: isValidUrl(template.thumbnail_url),
          image_order: template.image_order || null
        }

        const { error } = await supabase
          .from('options')
          .update(updatedTemplate as never)
          .eq('id', editingTemplate.id)

        if (error) {
          console.error('Error updating template:', error)
          return
        }

        setTemplates(templates.map(t => t.id === editingTemplate.id ? { ...t, ...updatedTemplate } as ChoiceTemplate : t))
        setEditingTemplate(null)
      } catch (error) {
        console.error('Error updating template:', error)
      }
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (confirm('이 초이스 템플릿을 삭제하시겠습니까?')) {
      try {
        const { error } = await supabase
          .from('options')
          .delete()
          .eq('id', id)

        if (error) {
          console.error('Error deleting template:', error)
          return
        }

        setTemplates(templates.filter(t => t.id !== id))
      } catch (error) {
        console.error('Error deleting template:', error)
      }
    }
  }

  // 템플릿 복사 함수
  const handleCopyTemplate = async (template: ChoiceTemplate) => {
    try {
      // 같은 그룹 내의 최대 sort_order 찾기
      const sameGroupTemplates = templates.filter(t => t.template_group === template.template_group)
      const maxSortOrder = sameGroupTemplates.length > 0 
        ? Math.max(...sameGroupTemplates.map(t => t.sort_order || 0))
        : -1

      const copiedTemplate = {
        id: crypto.randomUUID(),
        name: `${template.name} (복사본)`,
        name_ko: template.name_ko ? `${template.name_ko} (복사본)` : undefined,
        description: template.description,
        description_ko: template.description_ko,
        description_en: template.description_en,
        category: template.category,
        adult_price: template.adult_price,
        child_price: template.child_price,
        infant_price: template.infant_price,
        price_type: template.price_type,
        status: template.status,
        tags: template.tags || [],
        is_choice_template: true,
        choice_type: template.choice_type,
        min_selections: template.min_selections,
        max_selections: template.max_selections,
        template_group: template.template_group,
        template_group_ko: template.template_group_ko,
        template_group_description_ko: template.template_group_description_ko,
        template_group_description_en: template.template_group_description_en,
        content_i18n: template.content_i18n || {},
        is_required: template.is_required,
        sort_order: maxSortOrder + 1,
        image_url: template.image_url,
        image_alt: template.image_alt,
        thumbnail_url: template.thumbnail_url,
        image_order: template.image_order
      }

      const { data, error } = await supabase
        .from('options')
        .insert([copiedTemplate as never])
        .select()

      if (error) {
        console.error('Error copying template:', error)
        alert('템플릿 복사 중 오류가 발생했습니다.')
        return
      }

      if (data && data[0]) {
        setTemplates([...templates, data[0] as ChoiceTemplate])
        alert('템플릿이 성공적으로 복사되었습니다.')
      }
    } catch (error) {
      console.error('Error copying template:', error)
      alert('템플릿 복사 중 오류가 발생했습니다.')
    }
  }

  // 정렬순서 변경 함수
  const handleChangeSortOrder = async (templateId: string, direction: 'up' | 'down') => {
    try {
      const currentTemplate = templates.find(t => t.id === templateId)
      if (!currentTemplate) return

      // 같은 그룹 내의 템플릿들만 가져오기
      const sameGroupTemplates = templates
        .filter(t => t.template_group === currentTemplate.template_group)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

      const currentIndex = sameGroupTemplates.findIndex(t => t.id === templateId)
      if (currentIndex === -1) return

      let targetIndex: number
      if (direction === 'up') {
        if (currentIndex === 0) return // 이미 맨 위
        targetIndex = currentIndex - 1
      } else {
        if (currentIndex === sameGroupTemplates.length - 1) return // 이미 맨 아래
        targetIndex = currentIndex + 1
      }

      // 배열에서 항목 위치 변경
      const reorderedTemplates = [...sameGroupTemplates]
      const [movedTemplate] = reorderedTemplates.splice(currentIndex, 1)
      reorderedTemplates.splice(targetIndex, 0, movedTemplate)

      // 모든 템플릿의 sort_order를 0부터 순차적으로 재할당
      const updatePromises = reorderedTemplates.map((template, index) => 
        supabase
          .from('options')
          .update({ sort_order: index })
          .eq('id', template.id)
      )

      const results = await Promise.all(updatePromises)
      
      // 오류 확인
      const hasError = results.some(result => result.error)
      if (hasError) {
        const errors = results.filter(result => result.error).map(result => result.error)
        console.error('Error updating sort orders:', errors)
        alert('순서 변경 중 오류가 발생했습니다.')
        return
      }

      // 데이터베이스에서 최신 데이터 다시 불러오기
      await fetchTemplates()
    } catch (error) {
      console.error('Error changing sort order:', error)
      alert('순서 변경 중 오류가 발생했습니다.')
    }
  }

  // 템플릿 그룹 추가 함수
  const handleAddGroup = async (groupData: {
    template_group: string,
    template_group_ko: string,
    template_group_description_ko?: string,
    template_group_description_en?: string,
    content_i18n?: OptionTemplateContentI18n,
    choice_type: 'single' | 'multiple' | 'quantity',
    is_required: boolean,
    min_selections: number,
    max_selections: number
  }) => {
    try {
      // 빈 템플릿 하나 생성 (그룹 메타데이터만 저장)
      const newTemplate = {
        id: crypto.randomUUID(),
        name: `${groupData.template_group}_placeholder`,
        name_ko: '템플릿 옵션을 추가하세요',
        description: '이 템플릿은 그룹 메타데이터를 저장하기 위한 플레이스홀더입니다. 실제 옵션을 추가해주세요.',
        category: 'activity',
        adult_price: 0,
        child_price: 0,
        infant_price: 0,
        price_type: 'per_person',
        status: 'active',
        tags: [],
        is_choice_template: true,
        choice_type: groupData.choice_type,
        min_selections: groupData.min_selections,
        max_selections: groupData.max_selections,
        template_group: groupData.template_group,
        template_group_ko: groupData.template_group_ko,
        template_group_description_ko: groupData.template_group_description_ko || null,
        template_group_description_en: groupData.template_group_description_en || null,
        content_i18n: groupData.content_i18n || {},
        is_required: groupData.is_required,
        sort_order: 0
      }

      const { data, error } = await supabase
        .from('options')
        .insert([newTemplate])
        .select()

      if (error) {
        console.error('Error adding group:', error)
        alert('초이스 그룹 추가 중 오류가 발생했습니다.')
        return
      }

      if (data && data[0]) {
        await fetchTemplates()
        setShowAddGroupModal(false)
        alert('초이스 그룹이 성공적으로 추가되었습니다. 이제 옵션을 추가해주세요.')
      }
    } catch (error) {
      console.error('Error adding group:', error)
      alert('초이스 그룹 추가 중 오류가 발생했습니다.')
    }
  }

  // 템플릿 그룹 삭제 함수
  const handleDeleteGroup = async (templateGroup: string) => {
    if (!confirm('이 초이스 그룹과 그룹 내 모든 템플릿을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return
    }

    try {
      setDeletingGroup(templateGroup)
      
      const { error } = await supabase
        .from('options')
        .delete()
        .eq('is_choice_template', true)
        .eq('template_group', templateGroup)

      if (error) {
        console.error('Error deleting group:', error)
        alert('초이스 그룹 삭제 중 오류가 발생했습니다.')
        return
      }

      setTemplates(templates.filter(t => t.template_group !== templateGroup))
      setDeletingGroup(null)
      alert('초이스 그룹이 성공적으로 삭제되었습니다.')
    } catch (error) {
      console.error('Error deleting group:', error)
      alert('초이스 그룹 삭제 중 오류가 발생했습니다.')
      setDeletingGroup(null)
    }
  }

  // 템플릿 그룹 수정 함수
  const handleEditGroup = async (
    oldGroup: {
      template_group: string, 
      template_group_ko: string, 
      template_group_description_ko?: string, 
      template_group_description_en?: string,
      choice_type?: 'single' | 'multiple' | 'quantity',
      is_required?: boolean,
      min_selections?: number,
      max_selections?: number
    }, 
    newGroup: {
      template_group: string, 
      template_group_ko: string, 
      template_group_description_ko?: string, 
      template_group_description_en?: string,
      content_i18n?: OptionTemplateContentI18n,
      choice_type?: 'single' | 'multiple' | 'quantity',
      is_required?: boolean,
      min_selections?: number,
      max_selections?: number
    }
  ) => {
    try {
      // 해당 그룹에 속한 모든 템플릿 찾기
      const groupTemplates = templates.filter(t => 
        t.template_group === oldGroup.template_group
      )

      if (groupTemplates.length === 0) {
        alert('수정할 템플릿을 찾을 수 없습니다.')
        return
      }

      const results = await Promise.all(
        groupTemplates.map((row) => {
          const mergedContent = applyGroupI18nToOptionContent(
            row.content_i18n,
            newGroup.content_i18n || {}
          )
          const updateData: Record<string, unknown> = {
            template_group: newGroup.template_group,
            template_group_ko: newGroup.template_group_ko,
            content_i18n: mergedContent,
          }
          if (newGroup.template_group_description_ko !== undefined) {
            updateData.template_group_description_ko =
              newGroup.template_group_description_ko || null
          }
          if (newGroup.template_group_description_en !== undefined) {
            updateData.template_group_description_en =
              newGroup.template_group_description_en || null
          }
          if (newGroup.choice_type !== undefined) {
            updateData.choice_type = newGroup.choice_type
          }
          if (newGroup.is_required !== undefined) {
            updateData.is_required = newGroup.is_required
          }
          if (newGroup.min_selections !== undefined) {
            updateData.min_selections = newGroup.min_selections
          }
          if (newGroup.max_selections !== undefined) {
            updateData.max_selections = newGroup.max_selections
          }
          return supabase.from('options').update(updateData as never).eq('id', row.id)
        })
      )

      const error = results.find((r) => r.error)?.error
      if (error) {
        console.error('Error updating template group:', error)
        alert('템플릿 그룹 수정 중 오류가 발생했습니다.')
        return
      }

      setEditingGroup(null)
      await fetchTemplates() // 최신 데이터 다시 불러오기
      alert('템플릿 그룹이 성공적으로 수정되었습니다.')
    } catch (error) {
      console.error('Error updating template group:', error)
      alert('템플릿 그룹 수정 중 오류가 발생했습니다.')
    }
  }

  // 기존 상품 초이스를 템플릿으로 가져오기
  const importChoicesAsTemplates = async (productId: string) => {
    try {
      // 상품 초이스 가져오기
      const { data: productChoices, error: choicesError } = await supabase
        .from('product_choices')
        .select(`
          *,
          options:choice_options(*)
        `)
        .eq('product_id', productId)

      if (choicesError) {
        console.error('Error fetching product choices:', choicesError)
        return
      }

      if (!productChoices || productChoices.length === 0) {
        alert('해당 상품에 등록된 초이스가 없습니다.')
        return
      }

      // 상품 정보 가져오기
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('name, name_ko')
        .eq('id', productId)
        .single()

      if (productError) {
        console.error('Error fetching product:', productError)
        return
      }

      // 각 초이스 그룹을 템플릿으로 변환
      for (const choice of productChoices) {
        const templateGroup = `${product.name_ko || product.name} - ${choice.choice_group_ko}`
        const templateGroupKo = `${product.name_ko || product.name} - ${choice.choice_group_ko}`

        // 템플릿 그룹이 이미 존재하는지 확인
        const { data: existingTemplate } = await supabase
          .from('options')
          .select('id')
          .eq('is_choice_template', true)
          .eq('template_group', templateGroup)
          .limit(1)

        if (existingTemplate && existingTemplate.length > 0) {
          continue // 이미 존재하는 템플릿 그룹은 건너뛰기
        }

        // 각 옵션을 템플릿으로 변환
        // 이미지 URL 유효성 검사 함수
        const isValidUrl = (url: string | null | undefined): string | null => {
          if (!url || url.trim() === '') return null
          try {
            new URL(url)
            return url.trim()
          } catch {
            return null
          }
        }

        for (const option of choice.options || []) {
          const newTemplate = {
            id: crypto.randomUUID(),
            name: option.option_name,
            name_ko: option.option_name_ko,
            description: option.description || null,
            description_ko: option.description_ko || null,
            description_en: null,
            category: 'choice_template', // NOT NULL 필드이므로 기본값 설정
            adult_price: option.adult_price || 0,
            child_price: option.child_price || 0,
            infant_price: option.infant_price || 0,
            price_type: 'per_person',
            status: 'active',
            tags: [],
            is_choice_template: true,
            choice_type: choice.choice_type,
            min_selections: choice.min_selections,
            max_selections: choice.max_selections,
            template_group: templateGroup,
            template_group_ko: templateGroupKo,
            is_required: choice.is_required,
            sort_order: option.sort_order || 0,
            image_url: isValidUrl(option.image_url),
            image_alt: option.image_alt || null,
            thumbnail_url: isValidUrl(option.thumbnail_url)
          }

          const { error } = await supabase
            .from('options')
            .insert([newTemplate])

          if (error) {
            console.error('Error importing template:', error)
            alert(`템플릿 가져오기 중 오류가 발생했습니다: ${error.message}`)
            return
          }
        }
      }

      // 템플릿 목록 새로고침
      await fetchTemplates()
      setShowImportChoicesModal(false)
      alert('초이스가 템플릿으로 성공적으로 가져와졌습니다.')
    } catch (error) {
      console.error('Error importing choices:', error)
      alert('초이스 가져오기 중 오류가 발생했습니다.')
    }
  }

  const getCategoryColor = (category: string) => {
    const categoryColors: Record<string, string> = {
      'accommodation': 'bg-primary/10 text-primary',
      'transportation': 'bg-green-100 text-green-800',
      'meal': 'bg-orange-100 text-orange-800',
      'activity': 'bg-purple-100 text-purple-800',
      'insurance': 'bg-indigo-100 text-indigo-800',
      'equipment': 'bg-amber-100 text-amber-800'
    }
    
    return categoryColors[category] || 'bg-gray-100 text-gray-800'
  }

  const getCategoryLabel = (category: string) => {
    const categoryLabels: Record<string, string> = {
      'accommodation': '숙박',
      'transportation': '교통',
      'meal': '식사',
      'activity': '액티비티',
      'insurance': '보험',
      'equipment': '장비'
    }
    
    return categoryLabels[category] || category
  }

  const getChoiceTypeLabel = (type: string) => {
    const typeLabels: Record<string, string> = {
      'single': '단일 선택',
      'multiple': '다중 선택',
      'quantity': '수량 선택'
    }
    
    return typeLabels[type] || type
  }

  const getPriceTypeLabel = (type: string) => {
    const typeLabels: Record<string, string> = {
      'per_person': '인당',
      'per_group': '그룹당',
      'fixed': '고정'
    }
    
    return typeLabels[type] || type
  }

  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category).filter(Boolean))).sort()]

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (template.name_ko && template.name_ko.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (template.description && template.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (template.tags && template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
    
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory
    
    return matchesSearch && matchesCategory
  })

  // 템플릿 그룹별로 그룹화
  const groupedTemplates = filteredTemplates.reduce((groups, template) => {
    const group = template.template_group_ko || template.template_group || '기타'
    if (!groups[group]) {
      groups[group] = []
    }
    groups[group].push(template)
    return groups
  }, {} as Record<string, ChoiceTemplate[]>)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">{t('loading')}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 검색 및 필터 - 모바일: 2열 그리드, 데스크톱: 한 줄 */}
      <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:gap-4 items-stretch">
        <div className="relative col-span-1 sm:flex-1 min-w-0">
          <Search className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 sm:w-5 sm:h-5 w-4 h-4" />
          <input
            type="text"
            placeholder="초이스 템플릿 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="col-span-1 px-3 sm:px-4 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent min-w-0 sm:min-w-[140px]"
        >
          <option value="all">모든 카테고리</option>
          {categories.map(category => (
            <option key={category} value={category}>
              {getCategoryLabel(category)}
            </option>
          ))}
        </select>
        <button
          onClick={() => setShowWorkflowGuide(true)}
          className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-primary bg-muted/50 border border-border rounded-lg hover:bg-muted flex items-center justify-center gap-1 sm:space-x-2 min-w-0"
        >
          <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
          <span className="truncate">워크플로우 가이드</span>
        </button>
        <button
          onClick={() => setAllCardsCollapsed(!allCardsCollapsed)}
          className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-1 sm:space-x-2 min-w-0"
        >
          {allCardsCollapsed ? (
            <>
              <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="truncate">상세보기</span>
            </>
          ) : (
            <>
              <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="truncate">접어보기</span>
            </>
          )}
        </button>
        <button
          onClick={() => setShowImportChoicesModal(true)}
          className="col-span-1 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-1 sm:space-x-2 min-w-0"
        >
          <Upload className="w-3.5 h-3.5 sm:w-5 sm:h-5 flex-shrink-0" />
          <span className="truncate">기존 초이스 가져오기</span>
        </button>
        <button
          onClick={() => setShowAddGroupModal(true)}
          className="col-span-1 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-1 sm:space-x-2 min-w-0"
        >
          <Plus className="w-3.5 h-3.5 sm:w-5 sm:h-5 flex-shrink-0" />
          <span className="truncate">그룹 추가</span>
        </button>
      </div>

      {/* 템플릿 목록 - 그룹별 표시 */}
      {Object.entries(groupedTemplates).map(([groupName, groupTemplates]) => {
        // 그룹의 원본 정보 가져오기 (첫 번째 템플릿에서)
        const firstTemplate = groupTemplates[0]
        const groupInfo = {
          template_group: firstTemplate.template_group || '',
          template_group_ko: firstTemplate.template_group_ko || firstTemplate.template_group || '',
          template_group_description_ko: firstTemplate.template_group_description_ko || '',
          template_group_description_en: firstTemplate.template_group_description_en || '',
          content_i18n: firstTemplate.content_i18n || {},
        }
        
        return (
        <div key={groupName} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 space-y-4">
          <div className="border-b border-gray-200 pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {groupName} ({groupTemplates.length}개)
                </h3>
                {(groupInfo.template_group_description_ko || groupInfo.template_group_description_en) && (
                  <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {groupInfo.template_group_description_ko && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">설명 (한국어)</p>
                          <p className="text-sm text-gray-700">{groupInfo.template_group_description_ko}</p>
                        </div>
                      )}
                      {groupInfo.template_group_description_en && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">설명 (영어)</p>
                          <p className="text-sm text-gray-700">{groupInfo.template_group_description_en}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2 ml-4">
                <button
                  onClick={() => {
                    const maxSortOrder = groupTemplates.length > 0 
                      ? Math.max(...groupTemplates.map(t => t.sort_order)) 
                      : -1
                    setSelectedGroupForNewTemplate({
                      template_group: groupInfo.template_group,
                      template_group_ko: groupInfo.template_group_ko,
                      choice_type: firstTemplate.choice_type,
                      is_required: firstTemplate.is_required,
                      min_selections: firstTemplate.min_selections,
                      max_selections: firstTemplate.max_selections,
                      max_sort_order: maxSortOrder
                    })
                    setShowAddForm(true)
                  }}
                  className="p-1 text-primary hover:text-foreground hover:bg-muted/50 rounded"
                  title="템플릿 추가"
                >
                  <Plus size={16} />
                </button>
                <button
                  onClick={() => setEditingGroup({
                    ...groupInfo,
                    choice_type: firstTemplate.choice_type,
                    is_required: firstTemplate.is_required,
                    min_selections: firstTemplate.min_selections,
                    max_selections: firstTemplate.max_selections
                  })}
                  className="p-1 text-primary hover:text-foreground hover:bg-muted/50 rounded"
                  title="그룹 수정"
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => handleDeleteGroup(firstTemplate.template_group || '')}
                  disabled={deletingGroup === firstTemplate.template_group}
                  className="p-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded disabled:opacity-50"
                  title="그룹 삭제"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(360px, 100%), 1fr))' }}>
            {groupTemplates
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((template, index, sortedArray) => {
                const isFirst = index === 0
                const isLast = index === sortedArray.length - 1
                return (
                  <div 
                    key={template.id} 
                    className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer max-w-full min-w-0 overflow-hidden"
                    onClick={() => setEditingTemplate(template)}
                  >
                    {/* 카드 헤더 */}
                    <div className="p-4 border-b border-gray-100 min-w-0">
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <div className="flex items-center space-x-3 min-w-0 flex-1 overflow-hidden">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-medium text-primary">{index + 1}</span>
                          </div>
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <h4 className="text-sm font-semibold text-gray-900 truncate" title={template.name}>
                              {template.name}
                            </h4>
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col space-y-0.5 mr-1">
                            <button
                              onClick={() => handleChangeSortOrder(template.id, 'up')}
                              disabled={isFirst}
                              className={`p-0.5 text-gray-600 hover:text-primary hover:bg-muted/50 rounded ${
                                isFirst ? 'opacity-30 cursor-not-allowed' : ''
                              }`}
                              title="위로 이동"
                            >
                              <ChevronUp size={12} />
                            </button>
                            <button
                              onClick={() => handleChangeSortOrder(template.id, 'down')}
                              disabled={isLast}
                              className={`p-0.5 text-gray-600 hover:text-primary hover:bg-muted/50 rounded ${
                                isLast ? 'opacity-30 cursor-not-allowed' : ''
                              }`}
                              title="아래로 이동"
                            >
                              <ChevronDown size={12} />
                            </button>
                          </div>
                          <button
                            onClick={() => setEditingTemplate(template)}
                            className="p-1 text-primary hover:text-foreground hover:bg-muted/50 rounded"
                            title="편집"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCopyTemplate(template)
                            }}
                            className="p-1 text-green-600 hover:text-green-900 hover:bg-green-50 rounded"
                            title="복사"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="p-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded"
                            title="삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      
                      {/* 카테고리, 가격유형, 초이스 타입 뱃지 */}
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(template.category)}`}>
                          {getCategoryLabel(template.category)}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {getPriceTypeLabel(template.price_type)}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {getChoiceTypeLabel(template.choice_type)}
                        </span>
                      </div>
                    </div>

                    {/* 카드 본문 */}
                    {!allCardsCollapsed && (
                      <div className="p-4 space-y-3">
                        {/* 이미지 */}
                        {template.image_url && (
                          <div className="relative w-full bg-gray-100 rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                            <img
                              src={template.thumbnail_url || template.image_url}
                              alt={template.image_alt || template.name_ko || template.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          </div>
                        )}

                        {/* 옵션명(고객 한글), 옵션명(고객 영어), ID */}
                        <div className="space-y-1">
                          {template.name_ko && (
                            <p className="text-sm text-gray-900 font-medium">{template.name_ko}</p>
                          )}
                          {template.name && (
                            <p className="text-xs text-gray-600">{template.name}</p>
                          )}
                          <p className="text-xs text-gray-500">ID: {template.id}</p>
                        </div>

                        {/* 설명 */}
                        {(template.description_ko || template.description || template.description_en) && (
                          <div className="space-y-1">
                            {template.description_ko && (
                              <p className="text-sm text-gray-600 line-clamp-2">{template.description_ko}</p>
                            )}
                            {!template.description_ko && template.description && (
                              <p className="text-sm text-gray-600 line-clamp-2">{template.description}</p>
                            )}
                            {!template.description_ko && !template.description && template.description_en && (
                              <p className="text-sm text-gray-600 line-clamp-2">{template.description_en}</p>
                            )}
                          </div>
                        )}

                        {/* 가격 정보 */}
                        <div className="text-xs text-gray-500">
                          <div className="flex justify-between">
                            <span>성인: ${template.adult_price}</span>
                            <span>아동: ${template.child_price}</span>
                            <span>유아: ${template.infant_price}</span>
                          </div>
                          <div className="text-center mt-1">
                            {getPriceTypeLabel(template.price_type)}
                          </div>
                        </div>

                        {/* 태그 */}
                        {template.tags && template.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {template.tags.map((tag, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* 상태 */}
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            template.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {template.status === 'active' ? '활성' : '비활성'}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            template.is_required ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {template.is_required ? '필수' : '선택'}
                          </span>
                        </div>

                        {/* 정렬순서 표시 (최소화) */}
                        <div className="text-[10px] text-gray-400 text-center pt-0.5">
                          #{index + 1}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
          </div>
        </div>
        )
      })}

      {/* 템플릿 추가/편집 모달 */}
      {(showAddForm || editingTemplate) && (
        <TemplateForm
          template={editingTemplate || (selectedGroupForNewTemplate ? {
            id: '',
            name: '',
            name_ko: '',
            description: '',
            description_ko: '',
            description_en: '',
            category: 'activity',
            adult_price: 0,
            child_price: 0,
            infant_price: 0,
            price_type: 'per_person',
            status: 'active',
            tags: [],
            is_choice_template: true,
            choice_type: selectedGroupForNewTemplate.choice_type,
            min_selections: selectedGroupForNewTemplate.min_selections,
            max_selections: selectedGroupForNewTemplate.max_selections,
            template_group: selectedGroupForNewTemplate.template_group,
            template_group_ko: selectedGroupForNewTemplate.template_group_ko,
            is_required: selectedGroupForNewTemplate.is_required,
            sort_order: selectedGroupForNewTemplate.max_sort_order + 1,
            image_url: '',
            image_alt: '',
            thumbnail_url: '',
            image_order: 0,
            created_at: ''
          } : null)}
          onSubmit={editingTemplate ? handleEditTemplate : handleAddTemplate}
          onCancel={() => {
            setShowAddForm(false)
            setEditingTemplate(null)
            setSelectedGroupForNewTemplate(null)
          }}
        />
      )}

      {/* 기존 초이스 가져오기 모달 */}
      {showImportChoicesModal && (
        <ImportChoicesModal
          onImport={importChoicesAsTemplates}
          onClose={() => setShowImportChoicesModal(false)}
        />
      )}

      {/* 템플릿 그룹 추가 모달 */}
      {showAddGroupModal && (
        <GroupAddModal
          onSubmit={handleAddGroup}
          onClose={() => setShowAddGroupModal(false)}
        />
      )}

      {/* 템플릿 그룹 편집 모달 */}
      {editingGroup && (
        <GroupEditModal
          group={editingGroup}
          onSubmit={(newGroup) => handleEditGroup(editingGroup, newGroup)}
          onClose={() => setEditingGroup(null)}
        />
      )}

      {/* 워크플로우 가이드 모달 */}
      {showWorkflowGuide && (
        <WorkflowGuideModal
          onClose={() => setShowWorkflowGuide(false)}
        />
      )}
    </div>
  )
}

// 워크플로우 가이드 모달 컴포넌트
interface WorkflowGuideModalProps {
  onClose: () => void
}

function WorkflowGuideModal({ onClose }: WorkflowGuideModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <BookOpen className="mr-2 text-primary" size={24} />
            초이스 템플릿 워크플로우 가이드
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          {/* 개요 */}
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <h3 className="text-lg font-semibold text-foreground mb-2">📋 개요</h3>
            <p className="text-sm text-primary">
              초이스 템플릿 라이브러리에서는 <strong>재사용 템플릿</strong>을 생성하고 관리합니다.
              이 템플릿은 상품 편집의 <strong>이 상품의 초이스</strong>에서 불러올 수 있으며,
              각 상품에서 필요한 옵션만 선택하거나 수정할 수 있습니다.
            </p>
          </div>

          {/* Step 1 */}
          <div className="border border-gray-200 rounded-lg p-5">
            <div className="flex items-start mb-3">
              <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold mr-3">
                1
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">템플릿 그룹 생성</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>1. <strong>"그룹 추가"</strong> 버튼 클릭</p>
                  <p>2. 그룹 정보 입력:</p>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li>그룹 이름 (영문): 예) <code className="bg-gray-100 px-1 rounded">national_park_fee</code></li>
                    <li>그룹 이름 (한글): 예) <code className="bg-gray-100 px-1 rounded">국립공원 입장료</code></li>
                    <li>초이스 타입: 단일 선택, 다중 선택, 수량 선택</li>
                    <li>필수 여부: 체크박스로 설정</li>
                    <li>최소/최대 선택 수: 숫자 입력</li>
                  </ul>
                  <p>3. <strong>"그룹 추가"</strong> 버튼으로 저장</p>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="border border-gray-200 rounded-lg p-5">
            <div className="flex items-start mb-3">
              <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold mr-3">
                2
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">템플릿 옵션 추가</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>1. 생성된 그룹 아래에 <strong>"템플릿 추가"</strong> 버튼 클릭</p>
                  <p>2. 모든 가능한 옵션을 등록:</p>
                  <div className="bg-gray-50 border border-gray-200 rounded p-3 ml-4">
                    <p className="font-medium mb-2">예시: 국립공원 입장료 템플릿</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>미국 거주자 ($8)</li>
                      <li>비 거주자 ($100)</li>
                      <li>애뉴얼 패스 구매자 ($250)</li>
                      <li>애뉴얼 패스 동행자 ($0)</li>
                      <li>그랜드캐년 입장료</li>
                      <li>자이언캐년 입장료</li>
                      <li>브라이스 캐년 입장료</li>
                      <li>요세미티 입장료</li>
                      <li>세쿼이아 입장료</li>
                      <li>... (모든 가능한 국립공원)</li>
                    </ul>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    💡 <strong>팁:</strong> 템플릿에는 모든 가능한 옵션을 등록해두면, 
                    상품별로 필요한 옵션만 선택할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="border border-gray-200 rounded-lg p-5">
            <div className="flex items-start mb-3">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold mr-3">
                3
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">상품 편집에서 템플릿 사용</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>1. <strong>상품 편집</strong> &gt; <strong>이 상품의 초이스</strong> 탭으로 이동</p>
                  <p>2. <strong>"템플릿에서 불러오기"</strong> 버튼 클릭</p>
                  <p>3. 생성한 템플릿 선택 (예: "국립공원 입장료")</p>
                  <p>4. 템플릿의 모든 옵션이 포함된 초이스 그룹이 생성됩니다.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="border border-gray-200 rounded-lg p-5">
            <div className="flex items-start mb-3">
              <div className="flex-shrink-0 w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center font-bold mr-3">
                4
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">상품별 커스터마이징</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>템플릿을 불러온 후, 각 상품에서 필요한 옵션만 선택/수정할 수 있습니다:</p>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li><strong>옵션 삭제:</strong> 각 옵션 옆의 삭제 버튼 (🗑️) 클릭</li>
                    <li><strong>옵션 추가:</strong> "옵션 추가" 버튼으로 새로운 옵션 추가</li>
                    <li><strong>옵션 수정:</strong> 옵션 이름, 가격, 설명 등 수정</li>
                    <li><strong>동적 가격 설정:</strong> 동적 가격 관리에서 상품별, 날짜별 가격 설정</li>
                  </ul>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-3">
                    <p className="font-medium text-yellow-900 mb-2">📌 예시: 밤도깨비 투어</p>
                    <p className="text-xs text-yellow-800">
                      템플릿 불러오기 → 그랜드캐년만 남기고 나머지 공원 옵션 삭제
                    </p>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-2">
                    <p className="font-medium text-yellow-900 mb-2">📌 예시: 그랜드서클 투어</p>
                    <p className="text-xs text-yellow-800">
                      템플릿을 3번 불러오기 → 각 그룹 이름을 "그랜드캐년 입장료", "자이언캐년 입장료", "브라이스 캐년 입장료"로 수정 → 각 그룹에서 불필요한 공원 옵션 삭제
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 중요 사항 */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-red-900 mb-2">⚠️ 중요 사항</h3>
            <ul className="space-y-2 text-sm text-red-800">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span><strong>템플릿과 상품 초이스는 독립적입니다.</strong> 템플릿을 수정해도 이미 불러온 상품 초이스에는 영향이 없습니다.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span><strong>상품 초이스를 수정해도 템플릿에는 영향이 없습니다.</strong> 각각 독립적으로 관리됩니다.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span><strong>동적 가격은 상품별로 설정해야 합니다.</strong> 템플릿의 기본 가격은 참고용입니다.</span>
              </li>
            </ul>
          </div>

          {/* 워크플로우 다이어그램 */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">🔄 워크플로우 다이어그램</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center mr-3">1</div>
                <div className="flex-1">
                  <p className="font-medium">옵션·초이스 템플릿 → 초이스 템플릿</p>
                  <p className="text-xs text-gray-600">"국립공원 입장료" 템플릿 그룹 생성 + 모든 옵션 등록</p>
                </div>
              </div>
              <div className="flex justify-center">
                <ChevronDown className="text-gray-400" size={20} />
              </div>
              <div className="flex items-center">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">2</div>
                <div className="flex-1">
                  <p className="font-medium">상품 편집 → 이 상품의 초이스</p>
                  <p className="text-xs text-gray-600">템플릿에서 "국립공원 입장료" 불러오기</p>
                </div>
              </div>
              <div className="flex justify-center">
                <ChevronDown className="text-gray-400" size={20} />
              </div>
              <div className="flex items-center">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">3</div>
                <div className="flex-1">
                  <p className="font-medium">상품별 커스터마이징</p>
                  <p className="text-xs text-gray-600">불필요한 옵션 삭제, 필요한 옵션만 남기기, 가격 수정</p>
                </div>
              </div>
              <div className="flex justify-center">
                <ChevronDown className="text-gray-400" size={20} />
              </div>
              <div className="flex items-center">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center mr-3">4</div>
                <div className="flex-1">
                  <p className="font-medium">동적 가격 설정</p>
                  <p className="text-xs text-gray-600">상품별, 날짜별로 다른 가격 적용</p>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="border border-gray-200 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">❓ 자주 묻는 질문</h3>
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-gray-900 mb-1">Q: 템플릿에서 옵션을 삭제하면 이미 불러온 상품 초이스에도 영향이 있나요?</p>
                <p className="text-gray-700">A: 아니요. 템플릿을 불러온 후에는 상품별 초이스로 독립적으로 관리되므로 영향이 없습니다.</p>
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-1">Q: 상품에서 옵션을 삭제하면 템플릿에도 영향이 있나요?</p>
                <p className="text-gray-700">A: 아니요. 상품 초이스와 템플릿은 완전히 독립적입니다.</p>
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-1">Q: 여러 상품에서 같은 템플릿을 사용할 수 있나요?</p>
                <p className="text-gray-700">A: 네, 가능합니다. 각 상품에서 템플릿을 불러온 후 개별적으로 수정할 수 있습니다.</p>
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-1">Q: 템플릿에 새로운 옵션을 추가하면 어떻게 되나요?</p>
                <p className="text-gray-700">A: 템플릿에만 추가되고, 이미 불러온 상품 초이스에는 자동으로 추가되지 않습니다. 필요하면 각 상품에서 수동으로 추가하거나 템플릿을 다시 불러와야 합니다.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

interface TemplateFormProps {
  template?: ChoiceTemplate | null
  onSubmit: (template: Omit<ChoiceTemplate, 'id' | 'created_at'>) => void
  onCancel: () => void
}

function TemplateForm({ template, onSubmit, onCancel }: TemplateFormProps) {
  const [editLocale, setEditLocale] = useState<SiteLocale>('ko')
  const [contentI18n, setContentI18n] = useState<OptionTemplateContentI18n>(
    () => (template?.content_i18n || {}) as OptionTemplateContentI18n
  )
  const [nameDraft, setNameDraft] = useState(() =>
    getOptionTemplateLocalizedText(template || {}, 'name', 'ko')
  )
  const [descriptionDraft, setDescriptionDraft] = useState(() =>
    getOptionTemplateLocalizedText(template || {}, 'description', 'ko')
  )
  const [formData, setFormData] = useState({
    name: template?.name || '',
    name_ko: template?.name_ko || '',
    description: template?.description || '',
    description_ko: template?.description_ko || '',
    description_en: template?.description_en || '',
    category: template?.category || '',
    adult_price: template?.adult_price || 0,
    child_price: template?.child_price || 0,
    infant_price: template?.infant_price || 0,
    price_type: template?.price_type || 'per_person',
    status: template?.status || 'active',
    tags: template?.tags || [],
    choice_type: template?.choice_type || 'single' as 'single' | 'multiple' | 'quantity',
    min_selections: template?.min_selections || 1,
    max_selections: template?.max_selections || 1,
    template_group: template?.template_group || '',
    template_group_ko: template?.template_group_ko || '',
    template_group_description_ko: template?.template_group_description_ko || '',
    template_group_description_en: template?.template_group_description_en || '',
    is_required: template?.is_required ?? true,
    sort_order: template?.sort_order || 0,
    image_url: template?.image_url || '',
    image_alt: template?.image_alt || '',
    thumbnail_url: template?.thumbnail_url || '',
    image_order: template?.image_order || 0
  })

  const switchLocale = (next: SiteLocale) => {
    const merged = mergeOptionTemplateOptionI18n(
      { ...template, ...formData, content_i18n: contentI18n },
      editLocale,
      nameDraft,
      descriptionDraft
    )
    setContentI18n(merged.content_i18n)
    setFormData((prev) => ({
      ...prev,
      name: merged.name,
      name_ko: merged.name_ko || '',
      description: merged.description || '',
      description_ko: merged.description_ko || '',
      description_en: merged.description_en || '',
    }))
    setEditLocale(next)
    setNameDraft(
      getOptionTemplateLocalizedText(
        { content_i18n: merged.content_i18n },
        'name',
        next
      )
    )
    setDescriptionDraft(
      getOptionTemplateLocalizedText(
        { content_i18n: merged.content_i18n },
        'description',
        next
      )
    )
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const merged = mergeOptionTemplateOptionI18n(
      { ...template, ...formData, content_i18n: contentI18n },
      editLocale,
      nameDraft,
      descriptionDraft
    )
    onSubmit({
      ...formData,
      name: merged.name,
      name_ko: merged.name_ko || undefined,
      description: merged.description || undefined,
      description_ko: merged.description_ko || undefined,
      description_en: merged.description_en || undefined,
      content_i18n: merged.content_i18n,
    } as Omit<ChoiceTemplate, 'id' | 'created_at'>)
  }

  const addTag = () => {
    const input = document.getElementById('tagInput') as HTMLInputElement
    const tag = input.value.trim()
    if (tag && !formData.tags.includes(tag)) {
      setFormData({ ...formData, tags: [...formData.tags, tag] })
      input.value = ''
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(tag => tag !== tagToRemove) })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {template && template.id ? '초이스 템플릿 편집' : '초이스 템플릿 추가'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-700">고객용 텍스트</p>
            <LocaleDropdown
              value={editLocale}
              onChange={switchLocale}
              size="sm"
              showLabel
              ariaLabel="Template content language"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              초이스 이름 ({getSiteLocaleMeta(editLocale).label})
              {editLocale === 'en' || editLocale === 'ko' ? (
                <span className="text-red-500"> *</span>
              ) : null}
            </label>
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              required={editLocale === 'en' || editLocale === 'ko'}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              설명 ({getSiteLocaleMeta(editLocale).label})
            </label>
            <textarea
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">초이스 타입</label>
              <select
                value={formData.choice_type}
                onChange={(e) => setFormData({ ...formData, choice_type: e.target.value as 'single' | 'multiple' | 'quantity' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              >
                <option value="single">단일 선택</option>
                <option value="multiple">다중 선택</option>
                <option value="quantity">수량 선택</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                required
              >
                <option value="">카테고리 선택</option>
                <option value="accommodation">숙박</option>
                <option value="transportation">교통</option>
                <option value="meal">식사</option>
                <option value="activity">액티비티</option>
                <option value="insurance">보험</option>
                <option value="equipment">장비</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">가격 타입</label>
              <select
                value={formData.price_type}
                onChange={(e) => setFormData({ ...formData, price_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              >
                <option value="per_person">인당</option>
                <option value="per_group">그룹당</option>
                <option value="fixed">고정</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">성인 가격</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.adult_price}
                onChange={(e) => setFormData({ ...formData, adult_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">아동 가격</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.child_price}
                onChange={(e) => setFormData({ ...formData, child_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">유아 가격</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.infant_price}
                onChange={(e) => setFormData({ ...formData, infant_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">최소 선택 수</label>
              <input
                type="number"
                min="0"
                value={formData.min_selections}
                onChange={(e) => setFormData({ ...formData, min_selections: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">최대 선택 수</label>
              <input
                type="number"
                min="1"
                value={formData.max_selections}
                onChange={(e) => setFormData({ ...formData, max_selections: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_required}
                onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                className="mr-2"
              />
              필수 선택
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.status === 'active'}
                onChange={(e) => setFormData({ ...formData, status: e.target.checked ? 'active' : 'inactive' })}
                className="mr-2"
              />
              활성 상태
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이미지</label>
            <ImageUpload
              imageUrl={formData.image_url}
              thumbnailUrl={formData.thumbnail_url}
              imageAlt={formData.image_alt}
              onImageChange={(imageUrl, thumbnailUrl, imageAlt) => {
                setFormData({ ...formData, image_url: imageUrl, thumbnail_url: thumbnailUrl, image_alt: imageAlt })
              }}
              onImageRemove={() => {
                setFormData({ ...formData, image_url: '', thumbnail_url: '', image_alt: '' })
              }}
              folder="choices"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이미지 대체 텍스트</label>
            <input
              type="text"
              value={formData.image_alt}
              onChange={(e) => setFormData({ ...formData, image_alt: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              placeholder="이미지 설명"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">태그</label>
            <div className="flex space-x-2">
              <input
                id="tagInput"
                type="text"
                placeholder="태그 입력"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                추가
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-2 text-primary hover:text-primary/80"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-primary text-primary-foreground py-2 px-4 rounded-lg hover:bg-primary/90"
            >
              {template ? '수정' : '추가'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// 기존 초이스 가져오기 모달 컴포넌트
interface ImportChoicesModalProps {
  onImport: (productId: string) => void
  onClose: () => void
}

function ImportChoicesModal({ onImport, onClose }: ImportChoicesModalProps) {
  const t = useTranslations('common')
  const [products, setProducts] = useState<Array<{id: string, name: string, name_ko?: string}>>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('products')
        .select('id, name, name_ko')
        .order('name_ko', { ascending: true })

      if (error) {
        console.error('Error loading products:', error)
        return
      }

      setProducts((data || []) as Array<{ id: string; name: string; name_ko?: string }>)
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleImport = () => {
    if (selectedProductId) {
      onImport(selectedProductId)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-96">
          <div className="text-center">{t('loading')}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <h3 className="text-lg font-medium text-gray-900 mb-4">기존 초이스 가져오기</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              상품 선택
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
            >
              <option value="">상품을 선택하세요</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name_ko || product.name}
                </option>
              ))}
            </select>
          </div>
          <div className="text-sm text-gray-600">
            <p>선택한 상품의 초이스가 템플릿으로 변환됩니다.</p>
            <p>이미 존재하는 템플릿 그룹은 건너뛰어집니다.</p>
          </div>
        </div>
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
          >
            취소
          </button>
          <button
            onClick={handleImport}
            disabled={!selectedProductId}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            가져오기
          </button>
        </div>
      </div>
    </div>
  )
}

// 템플릿 그룹 추가 모달 컴포넌트
interface GroupAddModalProps {
  onSubmit: (groupData: {
    template_group: string,
    template_group_ko: string,
    template_group_description_ko?: string,
    template_group_description_en?: string,
    content_i18n?: OptionTemplateContentI18n,
    choice_type: 'single' | 'multiple' | 'quantity',
    is_required: boolean,
    min_selections: number,
    max_selections: number
  }) => void
  onClose: () => void
}

function GroupAddModal({ onSubmit, onClose }: GroupAddModalProps) {
  const [editLocale, setEditLocale] = useState<SiteLocale>('ko')
  const [contentI18n, setContentI18n] = useState<OptionTemplateContentI18n>({})
  const [groupNameDraft, setGroupNameDraft] = useState('')
  const [groupDescriptionDraft, setGroupDescriptionDraft] = useState('')
  const [formData, setFormData] = useState({
    template_group: '',
    template_group_ko: '',
    template_group_description_ko: '',
    template_group_description_en: '',
    choice_type: 'single' as 'single' | 'multiple' | 'quantity',
    is_required: true,
    min_selections: 1,
    max_selections: 1
  })

  const switchLocale = (next: SiteLocale) => {
    const merged = mergeOptionTemplateGroupI18n(
      { content_i18n: contentI18n },
      editLocale,
      groupNameDraft,
      groupDescriptionDraft,
      formData.template_group
    )
    setContentI18n(merged.content_i18n)
    setFormData((prev) => ({
      ...prev,
      template_group: merged.template_group || prev.template_group,
      template_group_ko: merged.template_group_ko || '',
      template_group_description_ko: merged.template_group_description_ko || '',
      template_group_description_en: merged.template_group_description_en || '',
    }))
    setEditLocale(next)
    setGroupNameDraft(
      getOptionTemplateLocalizedText(
        { content_i18n: merged.content_i18n },
        'group_name',
        next
      )
    )
    setGroupDescriptionDraft(
      getOptionTemplateLocalizedText(
        { content_i18n: merged.content_i18n },
        'group_description',
        next
      )
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.template_group.trim()) {
      alert('초이스 그룹 키(영문 식별자)를 입력해주세요.')
      return
    }
    const merged = mergeOptionTemplateGroupI18n(
      { content_i18n: contentI18n },
      editLocale,
      groupNameDraft,
      groupDescriptionDraft,
      formData.template_group
    )
    if (!merged.template_group_ko?.trim() && !groupNameDraft.trim()) {
      alert('고객용 그룹 표시 이름을 입력해주세요.')
      return
    }
    onSubmit({
      ...formData,
      template_group: formData.template_group.trim(),
      template_group_ko: merged.template_group_ko || groupNameDraft.trim(),
      ...(merged.template_group_description_ko
        ? { template_group_description_ko: merged.template_group_description_ko }
        : {}),
      ...(merged.template_group_description_en
        ? { template_group_description_en: merged.template_group_description_en }
        : {}),
      content_i18n: merged.content_i18n,
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-medium text-gray-900 mb-4">초이스 그룹 추가</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              그룹 키 (영문 식별자) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.template_group}
              onChange={(e) => setFormData({ ...formData, template_group: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              placeholder="예: national_park_fee"
              required
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-700">고객용 그룹 텍스트</p>
            <LocaleDropdown
              value={editLocale}
              onChange={switchLocale}
              size="sm"
              showLabel
              ariaLabel="Group content language"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              그룹 표시 이름 ({getSiteLocaleMeta(editLocale).label})
              {editLocale === 'ko' ? <span className="text-red-500"> *</span> : null}
            </label>
            <input
              type="text"
              value={groupNameDraft}
              onChange={(e) => setGroupNameDraft(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              placeholder="예: 국립공원 입장료"
              required={editLocale === 'ko'}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              설명 ({getSiteLocaleMeta(editLocale).label})
            </label>
            <textarea
              value={groupDescriptionDraft}
              onChange={(e) => setGroupDescriptionDraft(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
              placeholder="초이스 그룹에 대한 설명"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                초이스 타입
              </label>
              <select
                value={formData.choice_type}
                onChange={(e) => setFormData({ ...formData, choice_type: e.target.value as 'single' | 'multiple' | 'quantity' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              >
                <option value="single">단일 선택</option>
                <option value="multiple">다중 선택</option>
                <option value="quantity">수량 선택</option>
              </select>
            </div>
            <div>
              <label className="flex items-center mt-6">
                <input
                  type="checkbox"
                  checked={formData.is_required}
                  onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                  className="mr-2"
                />
                필수 선택
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                최소 선택 수
              </label>
              <input
                type="number"
                min="0"
                value={formData.min_selections}
                onChange={(e) => setFormData({ ...formData, min_selections: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                최대 선택 수
              </label>
              <input
                type="number"
                min="1"
                value={formData.max_selections}
                onChange={(e) => setFormData({ ...formData, max_selections: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              />
            </div>
          </div>

          <div className="text-sm text-gray-600 bg-primary/5 p-3 rounded-lg">
            <p className="font-medium mb-1">💡 안내</p>
            <p>그룹을 추가한 후, 템플릿 추가 버튼을 사용하여 이 그룹에 옵션을 추가할 수 있습니다.</p>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md hover:bg-purple-700"
            >
              그룹 추가
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// 템플릿 그룹 편집 모달 컴포넌트
interface GroupEditModalProps {
  group: {
    template_group: string, 
    template_group_ko: string, 
    template_group_description_ko?: string, 
    template_group_description_en?: string,
    content_i18n?: OptionTemplateContentI18n | null,
    choice_type?: 'single' | 'multiple' | 'quantity',
    is_required?: boolean,
    min_selections?: number,
    max_selections?: number
  }
  onSubmit: (newGroup: {
    template_group: string, 
    template_group_ko: string, 
    template_group_description_ko?: string, 
    template_group_description_en?: string,
    content_i18n?: OptionTemplateContentI18n,
    choice_type?: 'single' | 'multiple' | 'quantity',
    is_required?: boolean,
    min_selections?: number,
    max_selections?: number
  }) => void
  onClose: () => void
}

function GroupEditModal({ group, onSubmit, onClose }: GroupEditModalProps) {
  const [editLocale, setEditLocale] = useState<SiteLocale>('ko')
  const [contentI18n, setContentI18n] = useState<OptionTemplateContentI18n>(
    () => (group.content_i18n || {}) as OptionTemplateContentI18n
  )
  const [groupNameDraft, setGroupNameDraft] = useState(() =>
    getOptionTemplateLocalizedText(group, 'group_name', 'ko')
  )
  const [groupDescriptionDraft, setGroupDescriptionDraft] = useState(() =>
    getOptionTemplateLocalizedText(group, 'group_description', 'ko')
  )
  const [formData, setFormData] = useState({
    template_group: group.template_group || '',
    template_group_ko: group.template_group_ko || '',
    template_group_description_ko: group.template_group_description_ko || '',
    template_group_description_en: group.template_group_description_en || '',
    choice_type: group.choice_type || 'single' as 'single' | 'multiple' | 'quantity',
    is_required: group.is_required ?? true,
    min_selections: group.min_selections || 1,
    max_selections: group.max_selections || 1
  })

  const switchLocale = (next: SiteLocale) => {
    const merged = mergeOptionTemplateGroupI18n(
      { ...group, content_i18n: contentI18n },
      editLocale,
      groupNameDraft,
      groupDescriptionDraft,
      formData.template_group
    )
    setContentI18n(merged.content_i18n)
    setFormData((prev) => ({
      ...prev,
      template_group_ko: merged.template_group_ko || '',
      template_group_description_ko: merged.template_group_description_ko || '',
      template_group_description_en: merged.template_group_description_en || '',
    }))
    setEditLocale(next)
    setGroupNameDraft(
      getOptionTemplateLocalizedText(
        { content_i18n: merged.content_i18n },
        'group_name',
        next
      )
    )
    setGroupDescriptionDraft(
      getOptionTemplateLocalizedText(
        { content_i18n: merged.content_i18n },
        'group_description',
        next
      )
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.template_group.trim()) {
      alert('초이스 그룹 키(영문 식별자)를 입력해주세요.')
      return
    }
    const merged = mergeOptionTemplateGroupI18n(
      { ...group, content_i18n: contentI18n },
      editLocale,
      groupNameDraft,
      groupDescriptionDraft,
      formData.template_group
    )
    onSubmit({
      ...formData,
      template_group: formData.template_group.trim(),
      template_group_ko: merged.template_group_ko || groupNameDraft.trim(),
      ...(merged.template_group_description_ko
        ? { template_group_description_ko: merged.template_group_description_ko }
        : {}),
      ...(merged.template_group_description_en
        ? { template_group_description_en: merged.template_group_description_en }
        : {}),
      content_i18n: merged.content_i18n,
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
        <h3 className="text-lg font-medium text-gray-900 mb-4">초이스 그룹 수정</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              그룹 키 (영문 식별자)
            </label>
            <input
              type="text"
              value={formData.template_group}
              onChange={(e) => setFormData({ ...formData, template_group: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              placeholder="예: Accommodation"
              required
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-700">고객용 그룹 텍스트</p>
            <LocaleDropdown
              value={editLocale}
              onChange={switchLocale}
              size="sm"
              showLabel
              ariaLabel="Group content language"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              그룹 표시 이름 ({getSiteLocaleMeta(editLocale).label})
            </label>
            <input
              type="text"
              value={groupNameDraft}
              onChange={(e) => setGroupNameDraft(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              placeholder="예: 숙박 선택"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              설명 ({getSiteLocaleMeta(editLocale).label})
            </label>
            <textarea
              value={groupDescriptionDraft}
              onChange={(e) => setGroupDescriptionDraft(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
              placeholder="초이스 그룹에 대한 설명"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                초이스 타입
              </label>
              <select
                value={formData.choice_type}
                onChange={(e) => setFormData({ ...formData, choice_type: e.target.value as 'single' | 'multiple' | 'quantity' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              >
                <option value="single">단일 선택</option>
                <option value="multiple">다중 선택</option>
                <option value="quantity">수량 선택</option>
              </select>
            </div>
            <div>
              <label className="flex items-center mt-6">
                <input
                  type="checkbox"
                  checked={formData.is_required}
                  onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                  className="mr-2"
                />
                필수 선택
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                최소 선택 수
              </label>
              <input
                type="number"
                min="0"
                value={formData.min_selections}
                onChange={(e) => setFormData({ ...formData, min_selections: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                최대 선택 수
              </label>
              <input
                type="number"
                min="1"
                value={formData.max_selections}
                onChange={(e) => setFormData({ ...formData, max_selections: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              />
            </div>
          </div>

          <div className="text-sm text-gray-600 bg-yellow-50 p-3 rounded-lg">
            <p className="font-medium mb-1">⚠️ 주의사항</p>
            <p>이 그룹에 속한 모든 템플릿의 그룹 정보(이름, 설명, 타입, 필수 여부, 선택 수)가 변경됩니다.</p>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-primary/90"
            >
              수정
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}